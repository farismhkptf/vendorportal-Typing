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
  const [viewCommunicationsApt, setViewCommunicationsApt] = useState<AppointmentWithRelations | null>(null);

  useEffect(() => {
    if (!appointments || !searchParams) return;
    const params = new URLSearchParams(searchParams);
    const viewMessagesId = params.get("viewMessages");
    if (viewMessagesId) {
      const apt = appointments.find(a => a.id === viewMessagesId);
      if (apt) setViewCommunicationsApt(apt);
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

    return { whatsappBody, apt, contactSection, serviceName, formattedDate, formattedTime };
  }, [companies, staffList, serviceTypes]);

  const viewCommunicationsData = useMemo(() => {
    if (!viewCommunicationsApt) return null;
    return buildMessagesData(viewCommunicationsApt);
  }, [viewCommunicationsApt, buildMessagesData]);

  return {
    viewCommunicationsApt,
    setViewCommunicationsApt,
    viewCommunicationsData,
    buildMessagesData,
  };
}
