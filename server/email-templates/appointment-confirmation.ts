import type { WorkOrder, Company, ServiceType, Appointment, Center, Staff } from "@shared/schema";

export interface AppointmentEmailData {
  workOrder?: WorkOrder;
  company?: Company;
  serviceType?: ServiceType;
  appointment: Appointment;
  center?: Center;
  assignedStaff?: Staff;
  rmStaff?: Staff;
  rmUserEmail?: string;
  applicantPhotoUrl?: string;
  appLogoUrl?: string;
  appBaseUrl?: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join("");
}

function formatDateTimeParts(dt: Date): { dateStr: string; timeStr: string } {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const day = dt.getUTCDate();
  const month = months[dt.getUTCMonth()];
  const year = dt.getUTCFullYear();
  let hours = dt.getUTCHours();
  const mins = dt.getUTCMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return {
    dateStr: `${day} ${month} ${year}`,
    timeStr: `${hours}:${mins} ${ampm}`,
  };
}

function formatIcsDate(dt: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
}

function buildGoogleCalendarUrl(title: string, dt: Date, location: string): string {
  const start = formatIcsDate(dt);
  const end = formatIcsDate(new Date(dt.getTime() + 60 * 60 * 1000));
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${start}/${end}`,
    location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function buildOutlookCalendarUrl(title: string, dt: Date, location: string): string {
  const start = dt.toISOString();
  const end = new Date(dt.getTime() + 60 * 60 * 1000).toISOString();
  const params = new URLSearchParams({
    subject: title,
    startdt: start,
    enddt: end,
    location,
    body: title,
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

function buildAppleCalendarIcsUrl(title: string, dt: Date, location: string): string {
  const start = formatIcsDate(dt);
  const end = formatIcsDate(new Date(dt.getTime() + 60 * 60 * 1000));
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${title}`,
    `LOCATION:${location}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return `data:text/calendar;charset=utf8,${encodeURIComponent(ics)}`;
}

const PILL_TD_STYLE = `font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:500;color:#1d1d1f;border:1px solid #e8e8ed;background-color:#f8f8fc;padding:4px 10px;white-space:nowrap;`;

function buildCalendarPillButtons(googleUrl: string, appleUrl: string, outlookUrl: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;">
    <tr>
      <td style="padding-left:6px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;">
          <tr><td style="${PILL_TD_STYLE}"><a href="${escapeHtml(googleUrl)}" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:500;color:#1d1d1f;text-decoration:none;">&#128197; Google</a></td></tr>
        </table>
      </td>
      <td style="padding-left:6px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;">
          <tr><td style="${PILL_TD_STYLE}"><a href="${escapeHtml(appleUrl)}" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:500;color:#1d1d1f;text-decoration:none;">&#128197; Apple</a></td></tr>
        </table>
      </td>
      <td style="padding-left:6px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;">
          <tr><td style="${PILL_TD_STYLE}"><a href="${escapeHtml(outlookUrl)}" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:500;color:#1d1d1f;text-decoration:none;">&#128197; Outlook</a></td></tr>
        </table>
      </td>
    </tr>
  </table>`;
}

const MEDIA_QUERY_STYLES = `
    @media only screen and (max-width: 600px) {
        .email-container { width: 100% !important; }
        .email-content { padding: 36px 24px !important; }
        .company-name { font-size: 26px !important; }
        .applicant-name { font-size: 22px !important; }
        .appt-datetime { font-size: 16px !important; }
    }
    @media (prefers-color-scheme: dark) {
        .email-body { background: #000000 !important; }
        .email-shell { background: #1c1c1e !important; }
    }
`;

export function buildAppointmentEmail(data: AppointmentEmailData): string {
  const appointmentType = data.appointment.type ?? "Medical";
  if (appointmentType === "EID") {
    return buildEidAppointmentEmail(data);
  }
  return buildMedicalAppointmentEmail(data);
}

function buildEidAppointmentEmail(data: AppointmentEmailData): string {
  const {
    workOrder,
    company,
    serviceType,
    appointment,
    center,
    assignedStaff,
    rmStaff,
    rmUserEmail,
    applicantPhotoUrl,
    appLogoUrl,
    appBaseUrl,
  } = data;

  const applicantName = workOrder?.applicantName ?? "—";
  const companyName = company?.name ?? "—";
  const appointmentLabel = serviceType?.name ?? "Emirates ID Biometrics Appointment";

  const dt = new Date(appointment.datetime);
  const isValidDate = !isNaN(dt.getTime());
  const { dateStr, timeStr } = isValidDate
    ? formatDateTimeParts(dt)
    : { dateStr: "—", timeStr: "" };

  const centerName = center?.name ?? "—";
  const centerAddress = center?.address ?? "";
  const mapsUrl = center?.googleMapsUrl ?? `https://www.google.com/maps/search/${encodeURIComponent(centerName + " " + centerAddress)}`;
  const applicationNumber = appointment.applicationNumber ?? "";

  const initials = getInitials(applicantName);
  const guideName = assignedStaff?.name ?? "";
  const guideInitials = guideName ? getInitials(guideName) : "";
  const guidePhone = assignedStaff?.phone ?? "";

  const rmName = rmStaff?.name ?? "";
  const rmPhone = rmStaff?.phone ?? "";
  const rmEmail = rmUserEmail ?? rmStaff?.email ?? "";
  const hasRmContact = !!(rmName || rmPhone || rmEmail);
  const rmDisplayName = rmName || "Your Relationship Manager";

  const guideDescText = guideName
    ? `Our on-site support will meet your employee on site and guide them through the entire process. All required documentation will be checked, registration will be completed, and the queue will be managed on their behalf.`
    : "";

  const companyInitial = companyName !== "—" ? companyName.charAt(0).toUpperCase() : "K";

  const logoBlock = appLogoUrl
    ? `<img src="${escapeHtml(appLogoUrl)}" alt="Logo" width="34" height="34" style="width:34px;height:34px;display:block;" />`
    : `<div style="width:34px;height:34px;background:#1d1d1f;text-align:center;line-height:34px;font-size:15px;font-weight:600;letter-spacing:-0.02em;color:#ffffff;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;">${escapeHtml(companyInitial)}</div>`;

  const avatarBlock = (applicantPhotoUrl && applicantPhotoUrl.startsWith("https://"))
    ? `<img src="${escapeHtml(applicantPhotoUrl)}" alt="${escapeHtml(applicantName)}" width="72" height="72" style="width:72px;height:72px;display:block;border:2px solid #ffffff;" />`
    : `<div style="width:72px;height:72px;background:#dbeafe;color:#1d4ed8;text-align:center;line-height:68px;font-size:22px;font-weight:600;letter-spacing:-0.02em;border:2px solid #ffffff;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;">${escapeHtml(initials)}</div>`;

  const dotSpan = `<span style="display:inline-block;width:3px;height:3px;background:#a1a1a8;vertical-align:middle;margin:0 6px;"></span>`;
  const eidServiceTypeMeta = serviceType?.name ?? appointment.type ?? "EID";
  const applicantMetaParts = ["Applicant", escapeHtml(eidServiceTypeMeta)];
  if (applicationNumber) applicantMetaParts.push(escapeHtml(applicationNumber));
  const applicantMetaHtml = applicantMetaParts.join(` ${dotSpan} `);

  const eidCalendarTitle = `${appointmentLabel} – ${companyName}`;
  const eidCalendarLocation = centerAddress ? `${centerName}, ${centerAddress}` : centerName;
  const eidGoogleUrl = isValidDate ? buildGoogleCalendarUrl(eidCalendarTitle, dt, eidCalendarLocation) : "#";
  const eidAppleUrl = isValidDate ? buildAppleCalendarIcsUrl(eidCalendarTitle, dt, eidCalendarLocation) : "#";
  const eidOutlookUrl = isValidDate ? buildOutlookCalendarUrl(eidCalendarTitle, dt, eidCalendarLocation) : "#";
  const eidCalendarPills = buildCalendarPillButtons(eidGoogleUrl, eidAppleUrl, eidOutlookUrl);

  const cardUrl = (appBaseUrl && appointment.rescheduleToken)
    ? `${appBaseUrl}/card/${appointment.rescheduleToken}`
    : null;

  const cardLinkBlock = cardUrl
    ? `<tr><td colspan="2" style="padding-top:36px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:#1d4ed8;">
          <tr><td style="padding:24px 28px;text-align:center;">
            <div style="font-size:13px;font-weight:500;color:#c7d9ff;letter-spacing:0.03em;text-transform:uppercase;padding-bottom:8px;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;">Your Appointment Card</div>
            <div style="font-size:15px;font-weight:400;color:#dce9ff;line-height:1.5;padding-bottom:20px;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;">Open your digital appointment card on any device for quick access.</div>
            <a href="${escapeHtml(cardUrl)}" style="display:inline-block;background:#2d5fd4;border:1px solid #4a7be8;color:#ffffff;font-size:15px;font-weight:600;letter-spacing:-0.01em;text-decoration:none;padding:12px 28px;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;">View Appointment Card &#8599;</a>
          </td></tr>
        </table>
      </td></tr>`
    : "";

  const rescheduleBox = hasRmContact
    ? `<tr><td colspan="2" style="padding-top:40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:#f8f8fc;border:1px solid #e8e8ed;">
          <tr><td style="padding:18px 22px;">
            <div style="font-size:14px;line-height:1.65;margin-bottom:12px;color:#5e5e6a;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;"><span style="font-size:14px;font-weight:600;color:#1d1d1f;">Need to reschedule?</span> Contact your Relationship Manager and we'll arrange a new slot at no cost.</div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
              <tr>
                <td style="font-size:12px;font-weight:500;color:#3a3a3c;letter-spacing:0.005em;white-space:nowrap;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;">${escapeHtml(rmDisplayName)}</td>
                ${rmPhone ? `<td style="padding-left:6px;white-space:nowrap;"><span style="display:inline-block;width:3px;height:3px;background:#a1a1a8;vertical-align:middle;margin-right:6px;"></span><a href="tel:${escapeHtml(rmPhone)}" style="font-size:12px;font-weight:400;color:#8e8e98;text-decoration:none;border-bottom:1px solid #e8e8ed;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;">${escapeHtml(rmPhone)}</a></td>` : ""}
                ${rmEmail ? `<td style="padding-left:6px;white-space:nowrap;"><span style="display:inline-block;width:3px;height:3px;background:#a1a1a8;vertical-align:middle;margin-right:6px;"></span><a href="mailto:${escapeHtml(rmEmail)}" style="font-size:12px;font-weight:400;color:#8e8e98;text-decoration:none;border-bottom:1px solid #e8e8ed;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;">${escapeHtml(rmEmail)}</a></td>` : ""}
              </tr>
            </table>
          </td></tr>
        </table>
      </td></tr>`
    : "";

  const guideSection = guideName
    ? `<tr><td style="padding-top:40px;" colspan="2">
        <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;padding-bottom:16px;color:#8e8e98;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;">Your On-Site Guide</div>
        <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">
          <tr>
            <td style="vertical-align:top;width:52px;padding-right:14px;">
              <div style="width:52px;height:52px;background:#dcfce7;color:#15803d;text-align:center;line-height:48px;font-size:17px;font-weight:600;letter-spacing:-0.02em;border:2px solid #ffffff;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;">${escapeHtml(guideInitials)}</div>
            </td>
            <td style="vertical-align:top;">
              <div style="font-size:16px;font-weight:500;letter-spacing:-0.015em;line-height:1.3;margin-bottom:5px;color:#1d1d1f;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;">${escapeHtml(guideName)} <span style="font-size:12px;font-weight:400;letter-spacing:0.01em;color:#8e8e98;">· On-Site Support</span></div>
              ${guidePhone ? `<div style="font-size:13px;margin-bottom:10px;line-height:1.5;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;"><a href="tel:${escapeHtml(guidePhone)}" style="text-decoration:none;border-bottom:1px solid #e8e8ed;color:#5e5e6a;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;">${escapeHtml(guidePhone)}</a></div>` : ""}
            </td>
          </tr>
        </table>
        ${guideDescText ? `<div style="font-size:14px;font-weight:400;line-height:1.7;letter-spacing:0.005em;padding-top:10px;color:#5e5e6a;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;">${guideDescText}</div>` : ""}
      </td></tr>`
    : "";

  const applicationNumberBlock = applicationNumber
    ? `<tr><td style="height:1px;font-size:0;line-height:0;background:#e8e8ed;" colspan="2">&nbsp;</td></tr>
       <tr>
         <td style="padding:13px 22px;" colspan="2">
           <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
             <tr>
               <td style="vertical-align:middle;"><div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0;color:#8e8e98;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;">Application Reference</div></td>
               <td style="vertical-align:middle;text-align:right;"><div style="font-size:12px;font-weight:500;color:#5e5e6a;letter-spacing:0.04em;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;">${escapeHtml(applicationNumber)}</div></td>
             </tr>
           </table>
         </td>
       </tr>`
    : "";

  const notesBlock = appointment.notes
    ? `<tr><td colspan="2" style="padding-top:36px;">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;padding-bottom:14px;color:#8e8e98;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;">Notes</div>
        <div style="font-size:14px;font-weight:400;line-height:1.6;color:#5e5e6a;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;">${escapeHtml(appointment.notes)}</div>
      </td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>${appointmentLabel} – ${escapeHtml(companyName)}</title>
    <!--[if mso]>
    <noscript>
    <xml>
    <o:OfficeDocumentSettings>
    <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
    </xml>
    </noscript>
    <![endif]-->
    <style>${MEDIA_QUERY_STYLES}</style>
</head>
<body class="email-body" style="margin:0;padding:0;background-color:#f5f5f7;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;font-size:15px;line-height:1.5;color:#1d1d1f;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:#f5f5f7;">
  <tr>
    <td style="padding:30px 20px;" align="center">
      <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" border="0" align="center" style="border-collapse:collapse;width:600px;">
        <tr>
          <td class="email-shell" style="background:#ffffff;border:1px solid #e8e8ed;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
              <tr>
                <td class="email-content" style="padding:48px 40px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">

                    <!-- HEADER -->
                    <tr>
                      <td style="padding-bottom:16px;border-bottom:1px solid #e8e8ed;" colspan="2">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                          <tr>
                            <td style="vertical-align:middle;width:36px;padding-right:12px;">
                              ${logoBlock}
                            </td>
                            <td style="vertical-align:middle;">
                              <div style="font-size:13px;font-weight:500;letter-spacing:-0.01em;line-height:1.35;color:#1d1d1f;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;">The P.R.O. Company</div>
                              <div style="font-size:11px;font-weight:400;letter-spacing:0.04em;margin-top:2px;color:#8e8e98;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;">Everything. In Order.</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <tr><td style="height:32px;font-size:0;line-height:0;" colspan="2">&nbsp;</td></tr>

                    <!-- HERO -->
                    <tr>
                      <td colspan="2">
                        <div class="company-name" style="font-size:28px;font-weight:600;letter-spacing:-0.03em;line-height:1.1;padding-bottom:8px;color:#1d1d1f;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;">${escapeHtml(companyName)}</div>
                        <div style="font-size:14px;font-weight:400;letter-spacing:0.01em;padding-bottom:32px;color:#8e8e98;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;">${appointmentLabel}</div>
                      </td>
                    </tr>

                    <!-- APPLICANT -->
                    <tr>
                      <td style="padding-bottom:28px;border-bottom:1px solid #e8e8ed;" colspan="2">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                          <tr>
                            <td style="vertical-align:middle;width:92px;padding-right:20px;">
                              ${avatarBlock}
                            </td>
                            <td style="vertical-align:middle;">
                              <div class="applicant-name" style="font-size:24px;font-weight:500;letter-spacing:-0.02em;line-height:1.2;padding-bottom:6px;color:#1d1d1f;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;">${escapeHtml(applicantName)}</div>
                              <div style="font-size:13px;font-weight:400;letter-spacing:0.01em;color:#8e8e98;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;">${applicantMetaHtml}</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <tr><td style="height:16px;font-size:0;line-height:0;" colspan="2">&nbsp;</td></tr>

                    <!-- APPOINTMENT CARD -->
                    <tr>
                      <td colspan="2">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:#f8f8fc;border:1px solid #e8e8ed;">
                          <tr>
                            <td style="padding:18px 22px;" colspan="2">
                              <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;padding-bottom:6px;color:#8e8e98;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;">Date &amp; Time</div>
                              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                                <tr>
                                  <td style="vertical-align:middle;">
                                    <div class="appt-datetime" style="font-size:18px;font-weight:600;letter-spacing:-0.02em;line-height:1.2;color:#1d1d1f;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;">${escapeHtml(dateStr)} &nbsp;&middot;&nbsp; ${escapeHtml(timeStr)}</div>
                                  </td>
                                  <td style="vertical-align:middle;text-align:right;white-space:nowrap;">
                                    ${eidCalendarPills}
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                          <tr><td style="height:1px;font-size:0;line-height:0;background:#e8e8ed;" colspan="2">&nbsp;</td></tr>
                          <tr>
                            <td style="padding:18px 22px;" colspan="2">
                              <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;padding-bottom:6px;color:#8e8e98;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;">Location</div>
                              <div style="font-size:15px;font-weight:500;letter-spacing:-0.01em;padding-bottom:2px;color:#1d1d1f;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;">${escapeHtml(centerName)}</div>
                              ${centerAddress ? `<div style="font-size:13px;line-height:1.6;padding-bottom:4px;color:#5e5e6a;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;">${escapeHtml(centerAddress)}</div>` : ""}
                              <a href="${escapeHtml(mapsUrl)}" style="display:inline-block;font-size:12px;text-decoration:none;border-bottom:1px solid #e8e8ed;padding-bottom:1px;margin-top:9px;letter-spacing:0.005em;color:#1d1d1f;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;">View on Google Maps &#8599;</a>
                            </td>
                          </tr>
                          ${applicationNumberBlock}
                        </table>
                      </td>
                    </tr>

                    ${guideSection}

                    <!-- BEFORE YOU GO -->
                    <tr>
                      <td style="padding-top:36px;" colspan="2">
                        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;padding-bottom:14px;color:#8e8e98;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;">Before You Go</div>
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:#f8f8fc;border:1px solid #e8e8ed;">
                          <tr>
                            <td style="padding:18px 22px;">
                              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                                <tr>
                                  <td style="width:16px;vertical-align:top;padding-right:10px;padding-bottom:12px;">
                                    <span style="font-size:14px;color:#a1a1a8;line-height:1.6;">&#8226;</span>
                                  </td>
                                  <td style="vertical-align:top;font-size:14px;font-weight:400;color:#5e5e6a;line-height:1.6;padding-bottom:12px;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;">
                                    Arrive at least 10 minutes before your appointment time.
                                  </td>
                                </tr>
                                <tr>
                                  <td style="width:16px;vertical-align:top;padding-right:10px;padding-bottom:12px;">
                                    <span style="font-size:14px;color:#a1a1a8;line-height:1.6;">&#8226;</span>
                                  </td>
                                  <td style="vertical-align:top;font-size:14px;font-weight:400;color:#5e5e6a;line-height:1.6;padding-bottom:12px;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;">
                                    Bring your original passport. No copies or digital versions accepted.
                                  </td>
                                </tr>
                                <tr>
                                  <td style="width:16px;vertical-align:top;padding-right:10px;">
                                    <span style="font-size:14px;color:#a1a1a8;line-height:1.6;">&#8226;</span>
                                  </td>
                                  <td style="vertical-align:top;font-size:14px;font-weight:400;color:#5e5e6a;line-height:1.6;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;">
                                    Your guide will meet you on arrival and handle the queue and registration on your behalf.
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    ${notesBlock}

                    ${cardLinkBlock}

                    ${rescheduleBox}

                    <!-- FOOTER -->
                    <tr>
                      <td colspan="2" style="padding-top:28px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-top:1px solid #e8e8ed;">
                          <tr><td style="height:20px;font-size:0;line-height:0;">&nbsp;</td></tr>
                          <tr>
                            <td style="text-align:center;">
                              <div style="font-size:13px;font-weight:500;letter-spacing:-0.005em;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;">
                                <a href="https://www.procompany.ae" style="text-decoration:none;color:#1d1d1f;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;">The P.R.O. Company&#8482;</a>
                              </div>
                              <div style="width:32px;height:1px;background:#e8e8ed;margin:6px auto;font-size:0;line-height:0;">&nbsp;</div>
                              <div style="font-size:10px;letter-spacing:0.01em;color:#a1a1a8;font-family:Arial,Helvetica,'Helvetica Neue',sans-serif;">&copy; ${new Date().getFullYear()} The P.R.O. Company&#8482;. All rights reserved.</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function buildMedicalAppointmentEmail(data: AppointmentEmailData): string {
  const {
    workOrder,
    company,
    serviceType,
    appointment,
    center,
    assignedStaff,
    rmStaff,
    rmUserEmail,
    applicantPhotoUrl,
    appLogoUrl,
    appBaseUrl,
  } = data;

  const applicantName = workOrder?.applicantName ?? "—";
  const companyName = company?.name ?? "—";
  const appointmentLabel = serviceType?.name ?? "Medical Fitness Appointment";

  const dt = new Date(appointment.datetime);
  const isValidDate = !isNaN(dt.getTime());
  const { dateStr, timeStr } = isValidDate
    ? formatDateTimeParts(dt)
    : { dateStr: "—", timeStr: "" };

  const centerName = center?.name ?? "—";
  const centerAddress = center?.address ?? "";
  const mapsUrl = center?.googleMapsUrl ?? `https://www.google.com/maps/search/${encodeURIComponent(centerName + " " + centerAddress)}`;
  const applicationNumber = appointment.applicationNumber ?? "";

  const initials = getInitials(applicantName);
  const guideName = assignedStaff?.name ?? "";
  const guideInitials = guideName ? getInitials(guideName) : "";
  const guidePhone = assignedStaff?.phone ?? "";

  const rmName = rmStaff?.name ?? "";
  const rmPhone = rmStaff?.phone ?? "";
  const rmEmail = rmUserEmail ?? rmStaff?.email ?? "";
  const hasRmContact = !!(rmName || rmPhone || rmEmail);
  const rmDisplayName = rmName || "Your Relationship Manager";

  const guideDescText = guideName
    ? `Our on-site support will meet your employee on site and guide them through the entire process. All required documentation will be checked, registration will be completed, and the queue will be managed on their behalf.`
    : "";

  const companyInitial = companyName !== "—" ? companyName.charAt(0).toUpperCase() : "K";

  const logoBlock = appLogoUrl
    ? `<img src="${escapeHtml(appLogoUrl)}" alt="Logo" width="34" height="34" style="width:34px;height:34px;display:block;" />`
    : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;"><tr><td width="34" height="34" style="width:34px;height:34px;background-color:#1d1d1f;text-align:center;vertical-align:middle;font-size:15px;font-weight:600;letter-spacing:-0.02em;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(companyInitial)}</td></tr></table>`;

  const avatarBlock = (applicantPhotoUrl && applicantPhotoUrl.startsWith("https://"))
    ? `<img src="${escapeHtml(applicantPhotoUrl)}" alt="${escapeHtml(applicantName)}" width="64" height="64" style="width:64px;height:64px;display:block;border:2px solid #ffffff;" />`
    : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;"><tr><td width="64" height="64" style="width:64px;height:64px;background-color:#dbeafe;color:#1d4ed8;text-align:center;vertical-align:middle;font-size:19px;font-weight:700;letter-spacing:-0.02em;border:2px solid #ffffff;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(initials)}</td></tr></table>`;

  const calendarTitle = `${appointmentLabel} – ${companyName}`;
  const calendarLocation = centerAddress ? `${centerName}, ${centerAddress}` : centerName;
  const googleUrl = isValidDate ? buildGoogleCalendarUrl(calendarTitle, dt, calendarLocation) : "#";
  const appleUrl = isValidDate ? buildAppleCalendarIcsUrl(calendarTitle, dt, calendarLocation) : "#";
  const outlookUrl = isValidDate ? buildOutlookCalendarUrl(calendarTitle, dt, calendarLocation) : "#";

  const serviceTypeMeta = serviceType?.name ?? appointment.type ?? "Medical";
  const applicantMetaParts = ["Applicant", escapeHtml(serviceTypeMeta)];
  if (applicationNumber) applicantMetaParts.push(escapeHtml(applicationNumber));
  const applicantMetaHtml = applicantMetaParts.join(`&nbsp;&middot;&nbsp;`);

  const applicationNumberBlock = applicationNumber
    ? `<tr><td style="height:1px;font-size:0;line-height:0;background-color:#e8e8ed;" colspan="2">&nbsp;</td></tr>
       <tr>
         <td style="padding:13px 22px;" colspan="2">
           <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;">
             <tr>
               <td style="vertical-align:middle;"><div style="font-size:10px;font-weight:600;color:#8e8e98;text-transform:uppercase;letter-spacing:0.1em;font-family:Arial,Helvetica,sans-serif;">Medical Application</div></td>
               <td style="vertical-align:middle;text-align:right;"><div style="font-size:12px;font-weight:500;color:#5e5e6a;letter-spacing:0.04em;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(applicationNumber)}</div></td>
             </tr>
           </table>
         </td>
       </tr>`
    : "";

  const guideSection = guideName
    ? `<tr><td style="padding-top:40px;" colspan="2">
        <div style="font-size:10px;font-weight:600;color:#8e8e98;text-transform:uppercase;letter-spacing:0.1em;padding-bottom:16px;font-family:Arial,Helvetica,sans-serif;">Your On-Site Guide</div>
        <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;">
          <tr>
            <td style="vertical-align:top;width:46px;padding-right:14px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;"><tr><td width="46" height="46" style="width:46px;height:46px;background-color:#dcfce7;color:#15803d;text-align:center;vertical-align:middle;font-size:14px;font-weight:700;letter-spacing:-0.02em;border:2px solid #ffffff;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(guideInitials)}</td></tr></table>
            </td>
            <td style="vertical-align:top;">
              <div style="font-size:16px;font-weight:500;color:#1d1d1f;letter-spacing:-0.015em;line-height:1.3;mso-line-height-rule:exactly;padding-bottom:5px;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(guideName)} <span style="font-size:12px;font-weight:400;color:#8e8e98;letter-spacing:0.01em;">· On-Site Support</span></div>
              ${guidePhone ? `<div style="font-size:13px;font-weight:400;color:#5e5e6a;padding-bottom:10px;line-height:1.5;mso-line-height-rule:exactly;font-family:Arial,Helvetica,sans-serif;"><a href="tel:${escapeHtml(guidePhone)}" style="color:#5e5e6a;text-decoration:none;border-bottom:1px solid #e8e8ed;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(guidePhone)}</a></div>` : ""}
            </td>
          </tr>
        </table>
        ${guideDescText ? `<div style="font-size:14px;font-weight:400;color:#5e5e6a;line-height:1.7;mso-line-height-rule:exactly;letter-spacing:0.005em;padding-top:10px;font-family:Arial,Helvetica,sans-serif;">${guideDescText}</div>` : ""}
      </td></tr>`
    : "";

  const notesBlock = appointment.notes
    ? `<tr><td colspan="2" style="padding-top:40px;">
        <div style="font-size:10px;font-weight:600;color:#8e8e98;text-transform:uppercase;letter-spacing:0.1em;padding-bottom:16px;font-family:Arial,Helvetica,sans-serif;">Notes</div>
        <div style="font-size:14px;font-weight:400;color:#5e5e6a;line-height:1.7;mso-line-height-rule:exactly;letter-spacing:0.005em;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(appointment.notes)}</div>
      </td></tr>`
    : "";

  const cardUrl = (appBaseUrl && appointment.rescheduleToken)
    ? `${appBaseUrl}/card/${appointment.rescheduleToken}`
    : null;

  const cardLinkBlock = cardUrl
    ? `<tr><td colspan="2" style="padding-top:40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;background-color:#1d4ed8;">
          <tr><td style="padding:24px 28px;text-align:center;">
            <div style="font-size:13px;font-weight:500;color:#c7d9ff;letter-spacing:0.03em;text-transform:uppercase;padding-bottom:8px;font-family:Arial,Helvetica,sans-serif;">Your Appointment Card</div>
            <div style="font-size:14px;font-weight:400;color:#dce9ff;line-height:1.6;mso-line-height-rule:exactly;padding-bottom:20px;font-family:Arial,Helvetica,sans-serif;">Open your digital appointment card on any device for quick access.</div>
            <!--[if mso]>
            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escapeHtml(cardUrl)}" style="height:44px;v-text-anchor:middle;width:220px;" arcsize="0%" strokecolor="#4a7be8" fillcolor="#2d5fd4">
              <w:anchorlock/>
              <center style="color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;">View Appointment Card &#8599;</center>
            </v:roundrect>
            <![endif]--><!--[if !mso]><!-->
            <a href="${escapeHtml(cardUrl)}" style="display:inline-block;background-color:#2d5fd4;border:1px solid #4a7be8;color:#ffffff;font-size:15px;font-weight:600;letter-spacing:-0.01em;text-decoration:none;padding:12px 28px;font-family:Arial,Helvetica,sans-serif;">View Appointment Card &#8599;</a>
            <!--<![endif]-->
          </td></tr>
        </table>
      </td></tr>`
    : "";

  const rescheduleBox = hasRmContact
    ? `<tr><td colspan="2" style="padding-top:40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;background-color:#f8f8fc;border:1px solid #e8e8ed;">
          <tr><td style="padding:18px 22px;">
            <div style="font-size:14px;font-weight:400;color:#5e5e6a;line-height:1.65;padding-bottom:12px;font-family:Arial,Helvetica,sans-serif;mso-line-height-rule:exactly;"><span style="font-size:14px;font-weight:600;color:#1d1d1f;">Need to reschedule?</span> Contact your Relationship Manager and we&rsquo;ll arrange a new slot at no cost.</div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;">
              <tr>
                <td style="font-size:12px;font-weight:500;color:#3a3a3c;letter-spacing:0.005em;white-space:nowrap;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(rmDisplayName)}</td>
                ${rmPhone ? `<td style="padding-left:6px;white-space:nowrap;">&nbsp;&middot;&nbsp;<a href="tel:${escapeHtml(rmPhone)}" style="font-size:12px;font-weight:400;color:#8e8e98;text-decoration:none;border-bottom:1px solid #e8e8ed;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(rmPhone)}</a></td>` : ""}
                ${rmEmail ? `<td style="padding-left:6px;white-space:nowrap;">&nbsp;&middot;&nbsp;<a href="mailto:${escapeHtml(rmEmail)}" style="font-size:12px;font-weight:400;color:#8e8e98;text-decoration:none;border-bottom:1px solid #e8e8ed;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(rmEmail)}</a></td>` : ""}
              </tr>
            </table>
          </td></tr>
        </table>
      </td></tr>`
    : "";

  const dhaBadgeBlock = `<tr>
    <td colspan="2" style="padding-top:36px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;background-color:#f0f7ff;border:1px solid #c2daf0;">
        <tr>
          <td style="padding:18px 22px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;width:100%;">
              <tr>
                <td style="vertical-align:middle;padding-right:16px;width:44px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;"><tr><td width="40" height="40" style="width:40px;height:40px;background-color:#006994;text-align:center;vertical-align:middle;font-size:18px;font-weight:700;color:#f5c518;font-family:Arial,Helvetica,sans-serif;">&#9733;</td></tr></table>
                </td>
                <td style="vertical-align:middle;">
                  <div style="font-size:12px;font-weight:700;color:#004a6e;letter-spacing:0.04em;text-transform:uppercase;padding-bottom:2px;font-family:Arial,Helvetica,sans-serif;">Dubai Health Authority</div>
                  <div style="font-size:11px;font-weight:400;color:#336a8a;letter-spacing:0.01em;line-height:1.4;mso-line-height-rule:exactly;font-family:Arial,Helvetica,sans-serif;">This medical fitness examination is conducted under DHA regulations and standards.</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>${appointmentLabel} – ${escapeHtml(companyName)}</title>
    <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
    <style>${MEDIA_QUERY_STYLES}</style>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f7;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;mso-line-height-rule:exactly;color:#1d1d1f;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;background-color:#f5f5f7;">
  <tr>
    <td style="padding:32px 20px;" align="center">
      <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" border="0" align="center" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;width:600px;">
        <tr>
          <td style="background-color:#ffffff;border:1px solid #e8e8ed;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;">
              <tr>
                <td class="email-content" style="padding:52px 48px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;">

                    <!-- HEADER -->
                    <tr>
                      <td style="padding-bottom:22px;border-bottom:1px solid #e8e8ed;" colspan="2">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;">
                          <tr>
                            <td style="vertical-align:middle;padding-right:12px;">
                              ${logoBlock}
                            </td>
                            <td style="vertical-align:middle;">
                              <div style="font-size:14px;font-weight:500;color:#1d1d1f;letter-spacing:-0.01em;line-height:1.35;mso-line-height-rule:exactly;font-family:Arial,Helvetica,sans-serif;">The P.R.O. Company</div>
                              <div style="font-size:11px;font-weight:400;color:#8e8e98;letter-spacing:0.04em;padding-top:2px;font-family:Arial,Helvetica,sans-serif;">Everything. In Order.</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <tr><td style="height:40px;font-size:0;line-height:0;" colspan="2">&nbsp;</td></tr>

                    <!-- HERO -->
                    <tr>
                      <td colspan="2" style="padding-bottom:8px;">
                        <div class="company-name" style="font-size:28px;font-weight:600;letter-spacing:-0.03em;line-height:1.1;mso-line-height-rule:exactly;color:#1d1d1f;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(companyName)}</div>
                      </td>
                    </tr>
                    <tr>
                      <td colspan="2" style="padding-bottom:32px;">
                        <div style="font-size:14px;font-weight:400;color:#8e8e98;letter-spacing:0.02em;font-family:Arial,Helvetica,sans-serif;">${appointmentLabel}</div>
                      </td>
                    </tr>

                    <!-- APPLICANT -->
                    <tr>
                      <td style="padding-bottom:28px;border-bottom:1px solid #e8e8ed;" colspan="2">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;">
                          <tr>
                            <td style="vertical-align:middle;padding-right:18px;">
                              ${avatarBlock}
                            </td>
                            <td style="vertical-align:middle;">
                              <div class="applicant-name" style="font-size:24px;font-weight:500;letter-spacing:-0.025em;line-height:1.2;mso-line-height-rule:exactly;color:#1d1d1f;padding-bottom:6px;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(applicantName)}</div>
                              <div style="font-size:12px;font-weight:400;color:#8e8e98;letter-spacing:0.01em;font-family:Arial,Helvetica,sans-serif;">${applicantMetaHtml}</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <tr><td style="height:28px;font-size:0;line-height:0;" colspan="2">&nbsp;</td></tr>

                    <!-- APPOINTMENT CARD -->
                    <tr>
                      <td colspan="2">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;background-color:#f8f8fc;border:1px solid #e8e8ed;">
                          <tr>
                            <td style="padding:18px 22px;" colspan="2">
                              <div style="font-size:10px;font-weight:600;color:#8e8e98;text-transform:uppercase;letter-spacing:0.1em;padding-bottom:6px;font-family:Arial,Helvetica,sans-serif;">Date &amp; Time</div>
                              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;">
                                <tr>
                                  <td style="vertical-align:middle;">
                                    <div class="appt-datetime" style="font-size:20px;font-weight:600;letter-spacing:-0.025em;line-height:1.2;mso-line-height-rule:exactly;color:#1d1d1f;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(dateStr)} &nbsp;&middot;&nbsp; ${escapeHtml(timeStr)}</div>
                                  </td>
                                  <td style="vertical-align:middle;text-align:right;white-space:nowrap;">
                                    ${buildCalendarPillButtons(googleUrl, appleUrl, outlookUrl)}
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                          <tr><td style="height:1px;font-size:0;line-height:0;background-color:#e8e8ed;" colspan="2">&nbsp;</td></tr>
                          <tr>
                            <td style="padding:18px 22px;" colspan="2">
                              <div style="font-size:10px;font-weight:600;color:#8e8e98;text-transform:uppercase;letter-spacing:0.1em;padding-bottom:6px;font-family:Arial,Helvetica,sans-serif;">Location</div>
                              <div style="font-size:15px;font-weight:500;color:#1d1d1f;letter-spacing:-0.01em;line-height:1.3;mso-line-height-rule:exactly;padding-bottom:4px;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(centerName)}</div>
                              ${centerAddress ? `<div style="font-size:13px;font-weight:400;color:#5e5e6a;line-height:1.55;mso-line-height-rule:exactly;padding-bottom:9px;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(centerAddress)}</div>` : ""}
                              <a href="${escapeHtml(mapsUrl)}" style="display:inline-block;font-size:12px;font-weight:400;color:#1d1d1f;text-decoration:none;border-bottom:1px solid #e8e8ed;padding-bottom:1px;letter-spacing:0.005em;font-family:Arial,Helvetica,sans-serif;">View on Google Maps &#8599;</a>
                            </td>
                          </tr>
                          ${applicationNumberBlock}
                        </table>
                      </td>
                    </tr>

                    ${guideSection}

                    ${dhaBadgeBlock}

                    <!-- BEFORE YOU GO -->
                    <tr>
                      <td style="padding-top:40px;" colspan="2">
                        <div style="font-size:10px;font-weight:600;color:#8e8e98;text-transform:uppercase;letter-spacing:0.1em;padding-bottom:16px;font-family:Arial,Helvetica,sans-serif;">Before You Go</div>
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;background-color:#f8f8fc;border:1px solid #e8e8ed;">
                          <tr>
                            <td style="padding:18px 22px;">
                              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;">
                                <tr>
                                  <td style="width:16px;vertical-align:top;padding-right:10px;padding-bottom:12px;">
                                    <span style="font-size:14px;color:#a1a1a8;line-height:1.55;mso-line-height-rule:exactly;">&#8226;</span>
                                  </td>
                                  <td style="vertical-align:top;font-size:14px;font-weight:500;color:#1d1d1f;line-height:1.55;mso-line-height-rule:exactly;letter-spacing:-0.005em;padding-bottom:12px;font-family:Arial,Helvetica,sans-serif;">
                                    Arrive at least 10 minutes before your appointment time.
                                  </td>
                                </tr>
                                <tr>
                                  <td style="width:16px;vertical-align:top;padding-right:10px;padding-bottom:12px;">
                                    <span style="font-size:14px;color:#a1a1a8;line-height:1.55;mso-line-height-rule:exactly;">&#8226;</span>
                                  </td>
                                  <td style="vertical-align:top;font-size:14px;font-weight:500;color:#1d1d1f;line-height:1.55;mso-line-height-rule:exactly;letter-spacing:-0.005em;padding-bottom:12px;font-family:Arial,Helvetica,sans-serif;">
                                    Bring your original passport. No copies or digital versions accepted.
                                  </td>
                                </tr>
                                <tr>
                                  <td style="width:16px;vertical-align:top;padding-right:10px;padding-bottom:12px;">
                                    <span style="font-size:14px;color:#a1a1a8;line-height:1.55;mso-line-height-rule:exactly;">&#8226;</span>
                                  </td>
                                  <td style="vertical-align:top;font-size:14px;font-weight:500;color:#1d1d1f;line-height:1.55;mso-line-height-rule:exactly;letter-spacing:-0.005em;padding-bottom:12px;font-family:Arial,Helvetica,sans-serif;">
                                    Dress comfortably &mdash; loose, modest clothing works best. Shoulders and knees must be covered.
                                  </td>
                                </tr>
                                <tr>
                                  <td style="width:16px;vertical-align:top;padding-right:10px;">
                                    <span style="font-size:14px;color:#a1a1a8;line-height:1.55;mso-line-height-rule:exactly;">&#8226;</span>
                                  </td>
                                  <td style="vertical-align:top;font-size:14px;font-weight:500;color:#1d1d1f;line-height:1.55;mso-line-height-rule:exactly;letter-spacing:-0.005em;font-family:Arial,Helvetica,sans-serif;">
                                    Leave jewellery at home. The examination includes an X-ray and metal accessories must be removed.
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    ${notesBlock}

                    ${cardLinkBlock}

                    <!-- AFTER THE APPOINTMENT -->
                    <tr>
                      <td colspan="2" style="padding-top:40px;">
                        <div style="font-size:10px;font-weight:600;color:#8e8e98;text-transform:uppercase;letter-spacing:0.1em;padding-bottom:16px;font-family:Arial,Helvetica,sans-serif;">After the Appointment</div>
                        <div style="font-size:14px;font-weight:400;color:#5e5e6a;line-height:1.7;mso-line-height-rule:exactly;letter-spacing:0.005em;font-family:Arial,Helvetica,sans-serif;">Results are typically issued within 24 hours, and all subsequent steps will be managed by our team, with no action required unless DHA requests a follow up.</div>
                      </td>
                    </tr>

                    ${rescheduleBox}

                    <!-- FOOTER -->
                    <tr>
                      <td colspan="2" style="padding-top:48px;border-top:1px solid #e8e8ed;text-align:center;">
                        <div style="font-size:12px;font-weight:500;color:#1d1d1f;letter-spacing:-0.01em;font-family:Arial,Helvetica,sans-serif;">
                          <a href="https://www.procompany.ae" style="color:#1d1d1f;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">The P.R.O. Company&#8482;</a>
                        </div>
                        <div style="width:24px;height:1px;background-color:#e8e8ed;margin:8px auto;font-size:0;line-height:0;">&nbsp;</div>
                        <div style="font-size:10px;font-weight:400;color:#a1a1a8;letter-spacing:0.015em;font-family:Arial,Helvetica,sans-serif;">&copy; ${new Date().getFullYear()} The P.R.O. Company&#8482;. All rights reserved.</div>
                        <div style="font-size:10px;font-weight:400;color:#a1a1a8;letter-spacing:0.015em;padding-top:2px;font-family:Arial,Helvetica,sans-serif;">Licensed under Keystone Business Solutions LLC</div>
                      </td>
                    </tr>

                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
