import type { DocumentCustodyRecord } from "@shared/schema";
import { CUSTODY_DOC_CATEGORY_LABELS, CUSTODY_DOC_SUBTYPE_LABELS } from "@shared/schema";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(d: Date | string): string {
  const dt = new Date(d);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
}

function buildEmailShell(content: string, subject: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;color:#1d1d1f; }
    .shell { max-width:620px;margin:30px auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.06); }
    .header { padding:28px 36px 20px;border-bottom:1px solid #e8e8ed; }
    .brand { font-size:13px;font-weight:600;color:#1d1d1f;letter-spacing:-0.01em; }
    .tagline { font-size:11px;color:#8e8e98;margin-top:2px; }
    .body { padding:32px 36px; }
    .ref-badge { display:inline-block;background:#f0f4ff;color:#3b5bdb;font-size:12px;font-weight:600;letter-spacing:0.04em;padding:4px 12px;border-radius:20px;margin-bottom:20px; }
    .title { font-size:22px;font-weight:600;color:#1d1d1f;letter-spacing:-0.02em;margin-bottom:6px; }
    .subtitle { font-size:14px;color:#6e6e77;margin-bottom:28px; }
    .detail-card { background:#f8f8fc;border:1px solid #e8e8ed;border-radius:14px;padding:20px;margin-bottom:20px; }
    .detail-row { display:flex;justify-content:space-between;align-items:flex-start;padding:7px 0;border-bottom:1px solid #f0f0f5; }
    .detail-row:last-child { border-bottom:none; }
    .detail-label { font-size:12px;color:#8e8e98;font-weight:500; }
    .detail-value { font-size:13px;color:#1d1d1f;font-weight:500;text-align:right;max-width:60%; }
    .note-box { background:#fff8f0;border:1px solid #ffe4b5;border-radius:10px;padding:14px 18px;margin-top:20px;font-size:13px;color:#92400e;line-height:1.6; }
    .footer { padding:20px 36px;border-top:1px solid #e8e8ed;font-size:11px;color:#8e8e98;text-align:center; }
    @media (prefers-color-scheme: dark) {
      body { background:#000; }
      .shell { background:#1c1c1e; }
      .header, .footer { border-color:#2c2c2e; }
      .brand { color:#f5f5f7; }
      .title { color:#f5f5f7; }
      .detail-card { background:#2c2c2e;border-color:#3a3a3c; }
      .detail-row { border-color:#3a3a3c; }
      .detail-value { color:#f5f5f7; }
    }
  </style>
</head>
<body>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr><td style="padding:24px 16px;">
    <div class="shell">
      <div class="header">
        <div class="brand">The P.R.O. Company</div>
        <div class="tagline">Everything. In Order.</div>
      </div>
      <div class="body">${content}</div>
      <div class="footer">This is an automated notification from The P.R.O. Company. Please do not reply to this email.</div>
    </div>
  </td></tr>
</table>
</body>
</html>`;
}

export interface CustodyEmailData {
  record: DocumentCustodyRecord;
  companyName: string;
}

export function buildCustodyCollectionEmail(data: CustodyEmailData): string {
  const { record, companyName } = data;
  const docLabel = record.docSubtype === "Other" && record.docCustomName
    ? escapeHtml(record.docCustomName)
    : escapeHtml(CUSTODY_DOC_SUBTYPE_LABELS[record.docSubtype] || record.docSubtype);
  const categoryLabel = escapeHtml(CUSTODY_DOC_CATEGORY_LABELS[record.docCategory] || record.docCategory);
  const dateReceived = formatDate(record.updatedAt || record.createdAt);

  const content = `
    <div class="ref-badge">${escapeHtml(record.referenceNumber)}</div>
    <div class="title">Document Received</div>
    <div class="subtitle">We have received your original document and it is now in our custody.</div>
    <div class="detail-card">
      <div class="detail-row">
        <span class="detail-label">Company</span>
        <span class="detail-value">${escapeHtml(companyName)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Document Type</span>
        <span class="detail-value">${docLabel}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Service Category</span>
        <span class="detail-value">${categoryLabel}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Reference Number</span>
        <span class="detail-value">${escapeHtml(record.referenceNumber)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date Received</span>
        <span class="detail-value">${dateReceived}</span>
      </div>
    </div>
    <div class="note-box">
      Your original document is safely held by our team. We will notify you once processing is complete and the document is ready for collection or return.
    </div>
  `;

  return buildEmailShell(content, `Document Received — ${record.referenceNumber}`);
}

export function buildCustodyReturnEmail(data: CustodyEmailData): string {
  const { record, companyName } = data;
  const docLabel = record.docSubtype === "Other" && record.docCustomName
    ? escapeHtml(record.docCustomName)
    : escapeHtml(CUSTODY_DOC_SUBTYPE_LABELS[record.docSubtype] || record.docSubtype);
  const categoryLabel = escapeHtml(CUSTODY_DOC_CATEGORY_LABELS[record.docCategory] || record.docCategory);
  const completionDate = formatDate(record.updatedAt || new Date());

  const content = `
    <div class="ref-badge">${escapeHtml(record.referenceNumber)}</div>
    <div class="title">Document Ready for Collection</div>
    <div class="subtitle">Your original document has been processed and is ready to be returned to you.</div>
    <div class="detail-card">
      <div class="detail-row">
        <span class="detail-label">Company</span>
        <span class="detail-value">${escapeHtml(companyName)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Document Type</span>
        <span class="detail-value">${docLabel}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Service Category</span>
        <span class="detail-value">${categoryLabel}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Reference Number</span>
        <span class="detail-value">${escapeHtml(record.referenceNumber)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Completion Date</span>
        <span class="detail-value">${completionDate}</span>
      </div>
    </div>
    <div class="note-box">
      Please contact your Relationship Manager to arrange document delivery or collection at our office. Please quote reference <strong>${escapeHtml(record.referenceNumber)}</strong> when reaching out.
    </div>
  `;

  return buildEmailShell(content, `Document Ready — ${record.referenceNumber}`);
}
