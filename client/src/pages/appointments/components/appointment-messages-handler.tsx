import { useState, useCallback, useMemo, useEffect } from "react";
import { toProperCase } from "@/lib/proper-case";
import type { Staff, Company, ServiceType } from "@shared/schema";
import type { AppointmentWithRelations } from "./types";

interface ToastFn {
  (opts: { title: string; description?: string; variant?: "default" | "destructive" }): void;
}

export function useAppointmentMessages(
  companies: Company[] | undefined,
  staffList: Staff[] | undefined,
  serviceTypes: ServiceType[] | undefined,
  searchParams: string,
  appointments: AppointmentWithRelations[] | undefined,
  toast: ToastFn,
) {
  const [viewMessagesApt, setViewMessagesApt] = useState<AppointmentWithRelations | null>(null);
  const [viewEmailPreviewHtml, setViewEmailPreviewHtml] = useState<string>("");
  const [messageCopied, setMessageCopied] = useState<"email" | "whatsapp" | null>(null);
  const [emailFullscreen, setEmailFullscreen] = useState(false);
  const [viewEmailDraftApt, setViewEmailDraftApt] = useState<AppointmentWithRelations | null>(null);
  const [downloadingDraft, setDownloadingDraft] = useState(false);

  useEffect(() => {
    if (!appointments || !searchParams) return;
    const params = new URLSearchParams(searchParams);
    const viewMessagesId = params.get("viewMessages");
    if (viewMessagesId) {
      const apt = appointments.find(a => a.id === viewMessagesId);
      if (apt) {
        setViewMessagesApt(apt);
        setMessageCopied(null);
      }
    }
  }, [appointments, searchParams]);

  const buildMessagesData = useCallback((apt: AppointmentWithRelations) => {
    const wo = apt.workOrder;
    const center = apt.center;
    const company = wo?.companyId ? companies?.find(c => c.id === wo.companyId) : null;
    const assist = company?.assistStaffId ? staffList?.find(s => s.id === company.assistStaffId) : null;
    const crm = company?.rmStaffId ? staffList?.find(s => s.id === company.rmStaffId) : null;
    const serviceType = wo?.serviceTypeId ? serviceTypes?.find(st => st.id === wo.serviceTypeId) : null;
    const serviceName = serviceType?.name || (apt.type === "Medical" ? "Medical Examination" : "Emirates ID");
    
    const aptDate = new Date(apt.datetime);
    const formattedDate = aptDate.toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });
    const formattedTime = aptDate.toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit", hour12: true
    });

    const contactLines = [];
    if (assist) {
      const label = apt.type === "Medical" ? "Medical Assistant" : "Field Assistant";
      contactLines.push(`${label}: ${assist.name}${assist.phone ? ` - ${assist.phone}` : ""}`);
    }
    if (crm) {
      contactLines.push(`Client Relations: ${crm.name}${crm.phone ? ` - ${crm.phone}` : ""}`);
    }
    const contactSection = contactLines.length > 0 ? `Your P.R.O. Team:\n${contactLines.join("\n")}` : "";

    const centerLabel = apt.type === "Medical" ? "Medical Center" : "Emirates ID Center";
    const locationLink = center?.address 
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(center.address)}`
      : "";
    const assistanceSection = assist 
      ? `\u{1F464} Assistance: ${assist.name}\n\u{1F4DE} ${assist.phone || ""}` 
      : "";

    const emailBody = `Dear ${toProperCase(company?.name || wo?.company?.name || "")} Team,

We have scheduled ${apt.type === "Medical" ? "a medical" : "an Emirates ID"} appointment for your employee:

Applicant: ${toProperCase(wo?.applicantName || "")}
${wo?.applicantPhone ? `Contact: ${wo.applicantPhone}` : ""}

Appointment Details:
- Date: ${formattedDate}
- Time: ${formattedTime}
- ${centerLabel}: ${center?.name || "TBD"}
${center?.address ? `- Address: ${center.address}` : ""}
${center?.googleMapsUrl ? `- Location: ${center.googleMapsUrl}` : ""}
${apt.applicationNumber ? `- Application Number: ${apt.applicationNumber}` : ""}

${contactSection}

${apt.notes ? `Note: ${apt.notes}` : ""}

Please ensure the applicant arrives 15 minutes before the scheduled time with all required documents.
${apt.type === "EID" ? "\nOnce the Emirates ID process is completed, we will update you with the status.\n" : ""}
Best regards,
The P.R.O. Company\u2122`;

    const whatsappBody = `Hello \u{1F44B}

Your ${apt.type === "Medical" ? "medical" : "Emirates ID"} appointment has been scheduled successfully for the following work.

\u{1F4C4} WO: ${wo?.woNumber || ""}
\u{1F464} Applicant: ${toProperCase(wo?.applicantName || "")}
\u{1F3E2} Company: ${toProperCase(company?.name || wo?.company?.name || "")}
\u{1F9FE} Service: ${toProperCase(serviceName)}
${apt.applicationNumber ? `\u{1F522} Application No: ${apt.applicationNumber}` : ""}

${apt.type === "Medical" ? "\u{1F3E5}" : "\u{1FAAA}"} ${centerLabel}: ${center?.name || "TBD"}
\u{1F4C5} Date: ${formattedDate}
\u23F0 Time: ${formattedTime}
${center?.address ? `\u{1F4CD} Location: ${center.address}` : ""}
${locationLink ? `\u{1F5FA}\uFE0F Map: ${locationLink}` : ""}

${assistanceSection}

\u26A0\uFE0F *Important:*
\u2022 Please arrive at least *10 minutes before* the scheduled time.
\u2022 Please ensure the applicant brings their *original passport*.
${apt.notes ? `\u2022 ${apt.notes}` : ""}
${apt.type === "EID" ? "\nOnce the Emirates ID process is completed, we will update you with the status.\n" : ""}
Thank you,
*The P.R.O. Company\u2122*`;

    return { emailBody, whatsappBody, apt };
  }, [companies, staffList, serviceTypes]);

  const viewMessagesData = useMemo(() => {
    if (!viewMessagesApt) return null;
    return buildMessagesData(viewMessagesApt);
  }, [viewMessagesApt, buildMessagesData]);

  useEffect(() => {
    if (!viewMessagesApt) {
      setViewEmailPreviewHtml("");
      return;
    }
    if (viewMessagesApt.emailDraft) {
      setViewEmailPreviewHtml(viewMessagesApt.emailDraft);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/email-preview/appointment/${viewMessagesApt.id}`, {
      signal: controller.signal,
    })
      .then(r => r.ok ? r.text() : Promise.reject())
      .then(html => setViewEmailPreviewHtml(html))
      .catch((err) => {
        if (err?.name !== "AbortError") {
          toast({ title: "Preview unavailable", description: "Could not load email preview.", variant: "destructive" });
        }
      });
    return () => controller.abort();
  }, [viewMessagesApt]);

  const handleCopyViewMessage = async (type: "email" | "whatsapp") => {
    if (!viewMessagesData) return;
    const { emailBody, whatsappBody } = viewMessagesData;

    if (type === "whatsapp") {
      await navigator.clipboard.writeText(whatsappBody);
    } else {
      const htmlToCopy = viewEmailPreviewHtml || emailBody;
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([htmlToCopy], { type: "text/html" }),
            "text/plain": new Blob([emailBody], { type: "text/plain" }),
          }),
        ]);
      } catch {
        await navigator.clipboard.writeText(emailBody);
      }
    }
    setMessageCopied(type);
    setTimeout(() => setMessageCopied(null), 2000);
    toast({
      title: "Copied!",
      description: `${type === "email" ? "Email (with formatting)" : "WhatsApp"} message copied to clipboard.`,
    });
  };

  const handleDownloadAsJpg = async (apt: AppointmentWithRelations, type: "email" | "whatsapp") => {
    setDownloadingDraft(true);
    let container: HTMLDivElement | null = null;
    try {
      const html2canvas = (await import("html2canvas")).default;
      container = document.createElement("div");
      container.style.position = "fixed";
      container.style.left = "-9999px";
      container.style.top = "0";
      container.style.backgroundColor = "#ffffff";
      container.style.color = "#000000";
      container.style.width = "700px";
      container.style.padding = "24px";
      container.style.fontFamily = "system-ui, -apple-system, sans-serif";
      document.body.appendChild(container);

      const data = buildMessagesData(apt);

      if (type === "email") {
        if (apt.emailDraft) {
          const DOMPurify = (await import("dompurify")).default;
          container.innerHTML = DOMPurify.sanitize(apt.emailDraft, { FORCE_BODY: true });
        } else {
          try {
            const res = await fetch(`/api/email-preview/appointment/${apt.id}`);
            const DOMPurify = (await import("dompurify")).default;
            container.innerHTML = DOMPurify.sanitize(await res.text(), { FORCE_BODY: true });
          } catch {
            container.innerHTML = "<p>Email preview unavailable</p>";
          }
        }
      } else {
        const pre = document.createElement("pre");
        pre.style.whiteSpace = "pre-wrap";
        pre.style.fontFamily = "system-ui, -apple-system, sans-serif";
        pre.style.fontSize = "14px";
        pre.style.lineHeight = "1.6";
        pre.style.margin = "0";
        pre.style.color = "#000000";
        pre.textContent = data.whatsappBody;
        container.appendChild(pre);
      }

      await new Promise(r => setTimeout(r, 100));

      const canvas = await html2canvas(container, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });

      const link = document.createElement("a");
      const woNumber = (apt.workOrder?.woNumber || "draft").replace(/[^a-zA-Z0-9_-]/g, "-");
      const aptType = (apt.type || "appointment").replace(/[^a-zA-Z0-9_-]/g, "-");
      link.download = `${woNumber}-${aptType}-${type}-draft.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 0.95);
      link.click();
    } catch (err) {
      toast({ title: "Download failed", description: "Could not generate the image. Please try again." });
    } finally {
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
      setDownloadingDraft(false);
    }
  };

  return {
    viewMessagesApt,
    setViewMessagesApt,
    viewEmailPreviewHtml,
    messageCopied,
    emailFullscreen,
    setEmailFullscreen,
    viewEmailDraftApt,
    setViewEmailDraftApt,
    downloadingDraft,
    viewMessagesData,
    handleCopyViewMessage,
    handleDownloadAsJpg,
  };
}
