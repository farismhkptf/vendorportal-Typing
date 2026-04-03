import { storage } from "../storage";

export interface StatusPushPayload {
  eventType: string;
  workOrderId: string;
  woNumber?: string | null;
  applicantName?: string | null;
  companyId?: string | null;
  status?: string | null;
  details?: Record<string, unknown>;
  timestamp: string;
}

async function getIntegrationConfig(): Promise<{ webhookUrl: string; outboundApiKey: string } | null> {
  const settings = await storage.getAppSettings();
  if (!settings?.clientPortalWebhookUrl || !settings?.clientPortalOutboundApiKey) {
    return null;
  }
  return {
    webhookUrl: settings.clientPortalWebhookUrl,
    outboundApiKey: settings.clientPortalOutboundApiKey,
  };
}

async function doHttpPush(webhookUrl: string, outboundApiKey: string, payload: StatusPushPayload): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": outboundApiKey,
      "X-Source": "pro-portal",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}: ${body.substring(0, 200)}`);
  }
}

export async function pushStatusToClientPortal(payload: StatusPushPayload): Promise<void> {
  const config = await getIntegrationConfig();
  if (!config) return;

  const idempotencyKey = `${payload.eventType}.${payload.workOrderId}.${payload.timestamp}`;

  let event;
  try {
    event = await storage.publishCrossPortalEvent({
      idempotencyKey,
      sourceApp: "vendor_portal",
      eventType: payload.eventType,
      aggregateType: "work_order",
      aggregateId: payload.workOrderId,
      payload: payload as unknown as Record<string, unknown>,
      workOrderId: payload.workOrderId,
      companyId: payload.companyId || null,
      status: "pending",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return;
    }
    throw err;
  }

  try {
    await doHttpPush(config.webhookUrl, config.outboundApiKey, payload);
    await storage.updateCrossPortalEvent(event.id, {
      status: "sent",
      processedAt: new Date(),
      attemptCount: 1,
      lastAttemptAt: new Date(),
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await storage.updateCrossPortalEvent(event.id, {
      status: "failed",
      errorMessage: errorMsg,
      attemptCount: 1,
      lastAttemptAt: new Date(),
    });
    console.error(`[client-portal-push] Push failed for event ${event.id}:`, errorMsg);
  }
}

export async function retryFailedPushes(): Promise<number> {
  const config = await getIntegrationConfig();
  if (!config) return 0;

  // Fetch pending and failed events directly from DB (bounded, no in-memory scan)
  const [allPending, allFailed] = await Promise.all([
    storage.getPendingCrossPortalEvents(50),
    storage.getFailedCrossPortalEvents(50),
  ]);

  // Deduplicate by id in case an event appears in both lists
  const seen = new Set<string>();
  const toRetry = [...allPending, ...allFailed].filter(ev => {
    if (seen.has(ev.id)) return false;
    seen.add(ev.id);
    return true;
  });
  let retried = 0;

  for (const event of toRetry) {
    const rawPayload = event.payload as Record<string, unknown>;
    // Only process events with the standard StatusPushPayload shape;
    // skip legacy events that were written directly to cross_portal_events
    // with non-conformant payload fields (e.g. jobCode/woId without eventType/workOrderId)
    if (!rawPayload?.eventType || !rawPayload?.workOrderId || !rawPayload?.timestamp) {
      console.warn(`[client-portal-push] Skipping event ${event.id}: non-standard payload shape (eventType/workOrderId/timestamp missing)`);
      continue;
    }
    const payload = rawPayload as unknown as StatusPushPayload;
    try {
      await doHttpPush(config.webhookUrl, config.outboundApiKey, payload);
      await storage.updateCrossPortalEvent(event.id, {
        status: "sent",
        processedAt: new Date(),
        attemptCount: (event.attemptCount || 0) + 1,
        lastAttemptAt: new Date(),
        errorMessage: null,
      });
      retried++;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await storage.updateCrossPortalEvent(event.id, {
        status: "failed",
        errorMessage: errorMsg,
        attemptCount: (event.attemptCount || 0) + 1,
        lastAttemptAt: new Date(),
      });
    }
  }

  if (retried > 0) {
    console.log(`[client-portal-push] Retried and delivered ${retried} events`);
  }
  return retried;
}
