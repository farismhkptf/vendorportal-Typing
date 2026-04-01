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

function buildCalendarPillButtons(googleUrl: string, appleUrl: string, outlookUrl: string): string {
  const pillStyle = `display:inline-block;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;font-weight:500;color:#1d1d1f;text-decoration:none;border:1px solid #e8e8ed;background:#f8f8fc;padding:4px 10px;border-radius:20px;white-space:nowrap;`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;display:inline-table;">
    <tr>
      <td style="padding-left:6px;"><a href="${escapeHtml(googleUrl)}" style="${pillStyle}">&#128197; Google</a></td>
      <td style="padding-left:6px;"><a href="${escapeHtml(appleUrl)}" style="${pillStyle}">&#128197; Apple</a></td>
      <td style="padding-left:6px;"><a href="${escapeHtml(outlookUrl)}" style="${pillStyle}">&#128197; Outlook</a></td>
    </tr>
  </table>`;
}

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
    ? `<img src="${escapeHtml(appLogoUrl)}" alt="Logo" width="34" height="34" style="width:34px;height:34px;border-radius:8px;display:block;" />`
    : `<div class="logo-mark" style="width:34px;height:34px;border-radius:8px;text-align:center;line-height:34px;font-size:15px;font-weight:600;letter-spacing:-0.02em;">${escapeHtml(companyInitial)}</div>`;

  const avatarBlock = applicantPhotoUrl
    ? `<img src="${escapeHtml(applicantPhotoUrl)}" alt="${escapeHtml(applicantName)}" width="72" height="72" style="width:72px;height:72px;border-radius:50%;display:block;border:2px solid #ffffff;" />`
    : `<div class="avatar-applicant" style="width:72px;height:72px;border-radius:50%;text-align:center;line-height:68px;font-size:22px;font-weight:600;letter-spacing:-0.02em;">${escapeHtml(initials)}</div>`;

  const dotSpan = `<span style="display:inline-block;width:3px;height:3px;background:#a1a1a8;border-radius:50%;vertical-align:middle;margin:0 6px;"></span>`;
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
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:linear-gradient(135deg,#1d4ed8 0%,#3b82f6 100%);border-radius:20px;">
          <tr><td style="padding:24px 28px;text-align:center;">
            <div style="font-size:13px;font-weight:500;color:rgba(255,255,255,0.75);letter-spacing:0.03em;text-transform:uppercase;padding-bottom:8px;">Your Appointment Card</div>
            <div style="font-size:15px;font-weight:400;color:rgba(255,255,255,0.85);line-height:1.5;padding-bottom:20px;">Open your digital appointment card on any device. Add it to Apple Wallet for quick access.</div>
            <a href="${escapeHtml(cardUrl)}" style="display:inline-block;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.30);color:#ffffff;font-size:15px;font-weight:600;letter-spacing:-0.01em;text-decoration:none;padding:12px 28px;border-radius:12px;">View Appointment Card &#8599;</a>
          </td></tr>
        </table>
      </td></tr>`
    : "";

  const rescheduleBox = hasRmContact
    ? `<tr><td colspan="2" style="padding-top:40px;">
        <table role="presentation" class="card-bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:#f8f8fc;border:1px solid #e8e8ed;border-radius:16px;">
          <tr><td style="padding:18px 22px;">
            <div class="text-secondary" style="font-size:14px;line-height:1.65;margin-bottom:12px;"><span class="reschedule-strong" style="font-size:14px;font-weight:600;color:#1d1d1f;">Need to reschedule?</span> Contact your Relationship Manager and we'll arrange a new slot at no cost.</div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
              <tr>
                <td style="font-size:12px;font-weight:500;color:#3a3a3c;letter-spacing:0.005em;white-space:nowrap;">${escapeHtml(rmDisplayName)}</td>
                ${rmPhone ? `<td style="padding-left:6px;white-space:nowrap;"><span style="display:inline-block;width:3px;height:3px;background:#a1a1a8;border-radius:50%;vertical-align:middle;margin-right:6px;"></span><a href="tel:${escapeHtml(rmPhone)}" style="font-size:12px;font-weight:400;color:#8e8e98;text-decoration:none;border-bottom:1px solid #e8e8ed;">${escapeHtml(rmPhone)}</a></td>` : ""}
                ${rmEmail ? `<td style="padding-left:6px;white-space:nowrap;"><span style="display:inline-block;width:3px;height:3px;background:#a1a1a8;border-radius:50%;vertical-align:middle;margin-right:6px;"></span><a href="mailto:${escapeHtml(rmEmail)}" style="font-size:12px;font-weight:400;color:#8e8e98;text-decoration:none;border-bottom:1px solid #e8e8ed;">${escapeHtml(rmEmail)}</a></td>` : ""}
              </tr>
            </table>
          </td></tr>
        </table>
      </td></tr>`
    : "";

  const guideSection = guideName
    ? `<tr><td style="padding-top:40px;" colspan="2">
        <div class="text-label" style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;padding-bottom:16px;">Your On-Site Guide</div>
        <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">
          <tr>
            <td style="vertical-align:top;width:52px;padding-right:14px;">
              <div class="avatar-guide" style="width:52px;height:52px;border-radius:50%;text-align:center;line-height:48px;font-size:17px;font-weight:600;letter-spacing:-0.02em;box-shadow:0 2px 8px rgba(0,0,0,0.05);">${escapeHtml(guideInitials)}</div>
            </td>
            <td style="vertical-align:top;">
              <div class="text-primary" style="font-size:16px;font-weight:500;letter-spacing:-0.015em;line-height:1.3;margin-bottom:5px;">${escapeHtml(guideName)} <span class="text-label" style="font-size:12px;font-weight:400;letter-spacing:0.01em;">· On-Site Support</span></div>
              ${guidePhone ? `<div class="text-secondary" style="font-size:13px;margin-bottom:10px;line-height:1.5;"><a href="tel:${escapeHtml(guidePhone)}" style="text-decoration:none;border-bottom:1px solid #e8e8ed;color:#5e5e6a;">${escapeHtml(guidePhone)}</a></div>` : ""}
            </td>
          </tr>
        </table>
        ${guideDescText ? `<div class="text-secondary" style="font-size:14px;font-weight:400;line-height:1.7;letter-spacing:0.005em;padding-top:10px;">${guideDescText}</div>` : ""}
      </td></tr>`
    : "";

  const applicationNumberBlock = applicationNumber
    ? `<tr><td class="card-divider" style="height:1px;font-size:0;line-height:0;" colspan="2">&nbsp;</td></tr>
       <tr>
         <td style="padding:13px 22px;" colspan="2">
           <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
             <tr>
               <td style="vertical-align:middle;"><div class="text-label" style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0;">Application Reference</div></td>
               <td style="vertical-align:middle;text-align:right;"><div class="text-secondary" style="font-size:12px;font-weight:500;color:#5e5e6a;letter-spacing:0.04em;">${escapeHtml(applicationNumber)}</div></td>
             </tr>
           </table>
         </td>
       </tr>`
    : "";

  const notesBlock = appointment.notes
    ? `<tr><td colspan="2" style="padding-top:36px;">
        <div class="text-label" style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;padding-bottom:14px;">Notes</div>
        <div class="text-secondary" style="font-size:14px;font-weight:400;line-height:1.6;">${escapeHtml(appointment.notes)}</div>
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
    <style>
    .logo-mark { background:#1d1d1f; color:#ffffff; }
    .avatar-applicant { background:#dbeafe; color:#1d4ed8; border:2px solid #ffffff; }
    .avatar-guide { background:#dcfce7; color:#15803d; border:2px solid #ffffff; }
    .avatar-photo { border:2px solid #ffffff; }
    .text-primary { color:#1d1d1f; }
    .text-secondary { color:#5e5e6a; }
    .text-label { color:#8e8e98; }
    .card-bg { background:#f8f8fc; border-color:#e8e8ed; }
    .card-divider { background:#e8e8ed; }
    .link-primary { color:#1d1d1f; border-color:#e8e8ed; }
    .link-underline { border-bottom-color:#e8e8ed; }
    .notice-icon-light { display:inline !important; }
    .notice-icon-dark { display:none !important; }
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
        .border-subtle { border-color: #2c2c2e !important; }
        .logo-mark { background: #f5f5f7 !important; color: #1c1c1e !important; }
        .text-primary { color: #f5f5f7 !important; }
        .text-secondary { color: #8e8e98 !important; }
        .text-label { color: #636366 !important; }
        .card-bg { background: #2c2c2e !important; border-color: #3a3a3c !important; }
        .card-divider { background: #3a3a3c !important; }
        .link-primary { color: #f5f5f7 !important; border-color: #3a3a3c !important; }
        .link-underline { border-bottom-color: #3a3a3c !important; }
        .avatar-applicant { background: #1e3a8a !important; color: #93c5fd !important; border-color: #1c1c1e !important; }
        .avatar-guide { background: #14532d !important; color: #86efac !important; border-color: #1c1c1e !important; }
        .avatar-photo { border-color: #1c1c1e !important; }
        .footer-divider-line { background: #2c2c2e !important; }
        .notice-text { color: #f5f5f7 !important; }
        .notice-icon-light { display: none !important; }
        .notice-icon-dark { display: inline !important; }
    }
    </style>
</head>
<body class="email-body" style="margin:0;padding:0;background-color:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#1d1d1f;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
  <tr>
    <td style="padding:30px 20px;" align="center">
      <table role="presentation" class="email-container" width="720" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;max-width:720px;width:100%;">
        <tr>
          <td class="email-shell" style="background:#ffffff;border-radius:28px;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,0.08);">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
              <tr>
                <td class="email-content" style="padding:56px 48px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">

                    <!-- HEADER -->
                    <tr>
                      <td class="border-subtle" style="padding-bottom:16px;border-bottom:1px solid #e8e8ed;" colspan="2">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                          <tr>
                            <td style="vertical-align:middle;width:36px;padding-right:12px;">
                              ${logoBlock}
                            </td>
                            <td style="vertical-align:middle;">
                              <div class="text-primary" style="font-size:13px;font-weight:500;letter-spacing:-0.01em;line-height:1.35;">The P.R.O. Company</div>
                              <div class="text-label" style="font-size:11px;font-weight:400;letter-spacing:0.04em;margin-top:2px;">Everything. In Order.</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <tr><td style="height:32px;font-size:0;line-height:0;" colspan="2">&nbsp;</td></tr>

                    <!-- HERO -->
                    <tr>
                      <td colspan="2">
                        <div class="company-name text-primary" style="font-size:32px;font-weight:600;letter-spacing:-0.03em;line-height:1.1;padding-bottom:8px;">${escapeHtml(companyName)}</div>
                        <div class="text-label" style="font-size:14px;font-weight:400;letter-spacing:0.01em;padding-bottom:32px;">${appointmentLabel}</div>
                      </td>
                    </tr>

                    <!-- APPLICANT -->
                    <tr>
                      <td class="border-subtle" style="padding-bottom:28px;border-bottom:1px solid #e8e8ed;" colspan="2">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                          <tr>
                            <td style="vertical-align:middle;width:92px;padding-right:20px;">
                              ${avatarBlock}
                            </td>
                            <td style="vertical-align:middle;">
                              <div class="applicant-name text-primary" style="font-size:26px;font-weight:500;letter-spacing:-0.02em;line-height:1.2;padding-bottom:6px;">${escapeHtml(applicantName)}</div>
                              <div class="text-label" style="font-size:13px;font-weight:400;letter-spacing:0.01em;">${applicantMetaHtml}</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <tr><td style="height:16px;font-size:0;line-height:0;" colspan="2">&nbsp;</td></tr>

                    <!-- APPOINTMENT CARD -->
                    <tr>
                      <td colspan="2">
                        <table role="presentation" class="card-bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:#f8f8fc;border:1px solid #e8e8ed;border-radius:20px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
                          <tr>
                            <td style="padding:18px 22px;" colspan="2">
                              <div class="text-label" style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;padding-bottom:6px;">Date &amp; Time</div>
                              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                                <tr>
                                  <td style="vertical-align:middle;">
                                    <div class="appt-datetime text-primary" style="font-size:20px;font-weight:600;letter-spacing:-0.02em;line-height:1.2;">${escapeHtml(dateStr)} &nbsp;&middot;&nbsp; ${escapeHtml(timeStr)}</div>
                                  </td>
                                  <td style="vertical-align:middle;text-align:right;white-space:nowrap;">
                                    ${eidCalendarPills}
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                          <tr><td class="card-divider" style="height:1px;font-size:0;line-height:0;" colspan="2">&nbsp;</td></tr>
                          <tr>
                            <td style="padding:18px 22px;" colspan="2">
                              <div class="text-label" style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;padding-bottom:6px;">Location</div>
                              <div class="text-primary" style="font-size:15px;font-weight:500;letter-spacing:-0.01em;padding-bottom:2px;">${escapeHtml(centerName)}</div>
                              ${centerAddress ? `<div class="text-secondary" style="font-size:13px;line-height:1.6;padding-bottom:4px;">${escapeHtml(centerAddress)}</div>` : ""}
                              <a href="${escapeHtml(mapsUrl)}" class="link-primary" style="display:inline-block;font-size:12px;text-decoration:none;border-bottom:1px solid #e8e8ed;padding-bottom:1px;margin-top:9px;letter-spacing:0.005em;">View on Google Maps &#8599;</a>
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
                        <div class="text-label" style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;padding-bottom:14px;">Before You Go</div>
                        <table role="presentation" class="card-bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:#f8f8fc;border:1px solid #e8e8ed;border-radius:16px;">
                          <tr>
                            <td style="padding:18px 22px;">
                              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                                <tr>
                                  <td style="width:16px;vertical-align:top;padding-right:10px;padding-bottom:12px;">
                                    <span style="font-size:14px;color:#a1a1a8;line-height:1.6;">&#8226;</span>
                                  </td>
                                  <td class="text-secondary" style="vertical-align:top;font-size:14px;font-weight:400;color:#5e5e6a;line-height:1.6;padding-bottom:12px;">
                                    Arrive at least 10 minutes before your appointment time.
                                  </td>
                                </tr>
                                <tr>
                                  <td style="width:16px;vertical-align:top;padding-right:10px;padding-bottom:12px;">
                                    <span style="font-size:14px;color:#a1a1a8;line-height:1.6;">&#8226;</span>
                                  </td>
                                  <td class="text-secondary" style="vertical-align:top;font-size:14px;font-weight:400;color:#5e5e6a;line-height:1.6;padding-bottom:12px;">
                                    Bring your original passport. No copies or digital versions accepted.
                                  </td>
                                </tr>
                                <tr>
                                  <td style="width:16px;vertical-align:top;padding-right:10px;">
                                    <span style="font-size:14px;color:#a1a1a8;line-height:1.6;">&#8226;</span>
                                  </td>
                                  <td class="text-secondary" style="vertical-align:top;font-size:14px;font-weight:400;color:#5e5e6a;line-height:1.6;">
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
                      <td class="border-subtle" colspan="2" style="padding-top:28px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-top:1px solid #e8e8ed;">
                          <tr><td style="height:20px;font-size:0;line-height:0;">&nbsp;</td></tr>
                          <tr>
                            <td style="text-align:center;">
                              <div class="text-primary" style="font-size:13px;font-weight:500;letter-spacing:-0.005em;">
                                <a href="https://www.procompany.ae" class="link-primary" style="text-decoration:none;">The P.R.O. Company&#8482;</a>
                              </div>
                              <div class="footer-divider-line" style="width:32px;height:1px;background:#e8e8ed;margin:6px auto;"></div>
                              <div class="text-secondary" style="font-size:11px;margin-bottom:4px;">
                                Powered by <a href="https://www.procompany.ae" class="text-secondary" style="text-decoration:none;">The P.R.O. Company</a>
                              </div>
                              <div class="text-secondary" style="font-size:10px;letter-spacing:0.01em;">&copy; ${new Date().getFullYear()} The P.R.O. Company&#8482;. All rights reserved.</div>
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
    ? `<img src="${escapeHtml(appLogoUrl)}" alt="Logo" width="34" height="34" style="width:34px;height:34px;border-radius:8px;display:block;" />`
    : `<div class="logo" style="width:34px;height:34px;background:#1d1d1f;border-radius:8px;text-align:center;line-height:34px;font-size:15px;font-weight:600;letter-spacing:-0.02em;color:#ffffff;display:inline-block;">${escapeHtml(companyInitial)}</div>`;

  const avatarBlock = applicantPhotoUrl
    ? `<img src="${escapeHtml(applicantPhotoUrl)}" alt="${escapeHtml(applicantName)}" width="64" height="64" style="width:64px;height:64px;border-radius:50%;display:block;border:2px solid #ffffff;" />`
    : `<div class="avatar avatar-a" style="width:64px;height:64px;border-radius:50%;background:#dbeafe;color:#1d4ed8;text-align:center;line-height:60px;font-size:19px;font-weight:700;letter-spacing:-0.02em;border:2px solid #ffffff;display:inline-block;">${escapeHtml(initials)}</div>`;

  const calendarTitle = `${appointmentLabel} – ${companyName}`;
  const calendarLocation = centerAddress ? `${centerName}, ${centerAddress}` : centerName;
  const googleUrl = isValidDate ? buildGoogleCalendarUrl(calendarTitle, dt, calendarLocation) : "#";
  const appleUrl = isValidDate ? buildAppleCalendarIcsUrl(calendarTitle, dt, calendarLocation) : "#";
  const outlookUrl = isValidDate ? buildOutlookCalendarUrl(calendarTitle, dt, calendarLocation) : "#";

  const serviceTypeMeta = serviceType?.name ?? appointment.type ?? "Medical";
  const applicantMetaParts = ["Applicant", escapeHtml(serviceTypeMeta)];
  if (applicationNumber) applicantMetaParts.push(escapeHtml(applicationNumber));
  const dotSpan = `<span style="display:inline-block;width:3px;height:3px;background:#a1a1a8;border-radius:50%;vertical-align:middle;margin:0 6px;"></span>`;
  const applicantMetaHtml = applicantMetaParts.join(` ${dotSpan} `);

  const applicationNumberBlock = applicationNumber
    ? `<tr><td class="appt-divider" style="height:1px;font-size:0;line-height:0;background:#e8e8ed;" colspan="2">&nbsp;</td></tr>
       <tr>
         <td class="appt-ref-row" style="padding:13px 22px;" colspan="2">
           <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
             <tr>
               <td style="vertical-align:middle;"><div class="data-label" style="font-size:10px;font-weight:600;color:#8e8e98;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0;">Medical Application</div></td>
               <td style="vertical-align:middle;text-align:right;"><div class="appt-ref-value" style="font-size:12px;font-weight:500;color:#5e5e6a;letter-spacing:0.04em;">${escapeHtml(applicationNumber)}</div></td>
             </tr>
           </table>
         </td>
       </tr>`
    : "";

  const guideSection = guideName
    ? `<tr><td style="padding-top:40px;" colspan="2">
        <div class="section-heading" style="font-size:10px;font-weight:600;color:#8e8e98;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:16px;">Your On-Site Guide</div>
        <table cellpadding="0" cellspacing="0" border="0" role="presentation" class="guide-row" style="border-collapse:collapse;">
          <tr>
            <td style="vertical-align:top;width:46px;padding-right:14px;">
              <div class="avatar avatar-s" style="width:46px;height:46px;border-radius:50%;background:#dcfce7;color:#15803d;text-align:center;line-height:42px;font-size:14px;font-weight:700;letter-spacing:-0.02em;box-shadow:0 2px 8px rgba(0,0,0,0.06);display:inline-block;">${escapeHtml(guideInitials)}</div>
            </td>
            <td style="vertical-align:top;" class="guide-info">
              <div class="guide-name" style="font-size:16px;font-weight:500;color:#1d1d1f;letter-spacing:-0.015em;line-height:1.3;margin-bottom:5px;">${escapeHtml(guideName)} <span class="guide-role-inline" style="font-size:12px;font-weight:400;color:#8e8e98;letter-spacing:0.01em;">· On-Site Support</span></div>
              ${guidePhone ? `<div class="guide-phone" style="font-size:13px;font-weight:400;color:#5e5e6a;margin-bottom:10px;line-height:1.5;"><a href="tel:${escapeHtml(guidePhone)}" style="color:#5e5e6a;text-decoration:none;border-bottom:1px solid #e8e8ed;">${escapeHtml(guidePhone)}</a></div>` : ""}
            </td>
          </tr>
        </table>
        ${guideDescText ? `<div class="guide-description" style="font-size:14px;font-weight:400;color:#5e5e6a;line-height:1.7;letter-spacing:0.005em;padding-top:10px;">${guideDescText}</div>` : ""}
      </td></tr>`
    : "";

  const notesBlock = appointment.notes
    ? `<tr><td colspan="2" style="padding-top:40px;">
        <div class="section-heading" style="font-size:10px;font-weight:600;color:#8e8e98;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:16px;">Notes</div>
        <div class="guide-description" style="font-size:14px;font-weight:400;color:#5e5e6a;line-height:1.7;letter-spacing:0.005em;">${escapeHtml(appointment.notes)}</div>
      </td></tr>`
    : "";

  const cardUrl = (appBaseUrl && appointment.rescheduleToken)
    ? `${appBaseUrl}/card/${appointment.rescheduleToken}`
    : null;

  const cardLinkBlock = cardUrl
    ? `<tr><td colspan="2" style="padding-top:40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:linear-gradient(135deg,#1d4ed8 0%,#3b82f6 100%);border-radius:16px;">
          <tr><td style="padding:24px 28px;text-align:center;">
            <div style="font-size:13px;font-weight:500;color:rgba(255,255,255,0.75);letter-spacing:0.03em;text-transform:uppercase;margin-bottom:8px;">Your Appointment Card</div>
            <div style="font-size:14px;font-weight:400;color:rgba(255,255,255,0.85);line-height:1.6;margin-bottom:20px;">Open your digital appointment card on any device. Add it to Apple Wallet for quick access.</div>
            <a href="${escapeHtml(cardUrl)}" style="display:inline-block;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.30);color:#ffffff;font-size:15px;font-weight:600;letter-spacing:-0.01em;text-decoration:none;padding:12px 28px;border-radius:12px;">View Appointment Card &#8599;</a>
          </td></tr>
        </table>
      </td></tr>`
    : "";

  const rescheduleBox = hasRmContact
    ? `<tr><td colspan="2">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:#f8f8fc;border:1px solid #e8e8ed;border-radius:16px;margin-top:40px;">
          <tr><td style="padding:18px 22px;">
            <div style="font-size:14px;font-weight:400;color:#5e5e6a;line-height:1.65;margin-bottom:12px;"><strong style="font-size:14px;font-weight:600;color:#1d1d1f;">Need to reschedule?</strong> Contact your Relationship Manager and we&rsquo;ll arrange a new slot at no cost.</div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
              <tr>
                <td style="font-size:12px;font-weight:500;color:#3a3a3c;letter-spacing:0.005em;white-space:nowrap;">${escapeHtml(rmDisplayName)}</td>
                ${rmPhone ? `<td style="padding-left:6px;white-space:nowrap;"><span style="display:inline-block;width:3px;height:3px;background:#a1a1a8;border-radius:50%;vertical-align:middle;margin-right:6px;"></span><a href="tel:${escapeHtml(rmPhone)}" style="font-size:12px;font-weight:400;color:#8e8e98;text-decoration:none;border-bottom:1px solid #e8e8ed;">${escapeHtml(rmPhone)}</a></td>` : ""}
                ${rmEmail ? `<td style="padding-left:6px;white-space:nowrap;"><span style="display:inline-block;width:3px;height:3px;background:#a1a1a8;border-radius:50%;vertical-align:middle;margin-right:6px;"></span><a href="mailto:${escapeHtml(rmEmail)}" style="font-size:12px;font-weight:400;color:#8e8e98;text-decoration:none;border-bottom:1px solid #e8e8ed;">${escapeHtml(rmEmail)}</a></td>` : ""}
              </tr>
            </table>
          </td></tr>
        </table>
      </td></tr>`
    : "";

  const dhaBadgeBlock = `<tr>
    <td colspan="2" style="padding-top:36px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:#f0f7ff;border:1px solid #c2daf0;border-radius:16px;">
        <tr>
          <td style="padding:18px 22px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;">
              <tr>
                <td style="vertical-align:middle;padding-right:16px;width:44px;">
                  <div style="width:40px;height:40px;background:#006994;border-radius:50%;text-align:center;line-height:40px;font-size:18px;font-weight:700;color:#f5c518;display:inline-block;">&#9733;</div>
                </td>
                <td style="vertical-align:middle;">
                  <div style="font-size:12px;font-weight:700;color:#004a6e;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:2px;">Dubai Health Authority</div>
                  <div style="font-size:11px;font-weight:400;color:#336a8a;letter-spacing:0.01em;line-height:1.4;">This medical fitness examination is conducted under DHA regulations and standards.</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;

  return buildEmailHtmlTemplate({
    appointmentLabel,
    companyName,
    logoBlock,
    avatarBlock,
    applicantName,
    applicantMetaHtml,
    dateStr,
    timeStr,
    centerName,
    centerAddress,
    mapsUrl,
    applicationNumberBlock,
    guideSection,
    notesBlock,
    googleUrl,
    appleUrl,
    outlookUrl,
    cardLinkBlock,
    rescheduleBox,
    dhaBadgeBlock,
  });
}

interface EmailTemplateParams {
  appointmentLabel: string;
  companyName: string;
  logoBlock: string;
  avatarBlock: string;
  applicantName: string;
  applicantMetaHtml: string;
  dateStr: string;
  timeStr: string;
  centerName: string;
  centerAddress: string;
  mapsUrl: string;
  applicationNumberBlock: string;
  guideSection: string;
  notesBlock: string;
  googleUrl: string;
  appleUrl: string;
  outlookUrl: string;
  cardLinkBlock: string;
  rescheduleBox: string;
  dhaBadgeBlock?: string;
}

function buildEmailHtmlTemplate(p: EmailTemplateParams): string {
  const {
    appointmentLabel, companyName, logoBlock, avatarBlock,
    applicantName, applicantMetaHtml, dateStr, timeStr,
    centerName, centerAddress, mapsUrl, applicationNumberBlock,
    guideSection, notesBlock, googleUrl, appleUrl, outlookUrl,
    cardLinkBlock, rescheduleBox, dhaBadgeBlock,
  } = p;
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
    <style>

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            background-color: #f5f5f7;
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif;
            font-size: 15px;
            line-height: 1.6;
            color: #1d1d1f;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            padding: 32px 20px;
        }

        /* ── SHELL ── */
        .email {
            max-width: 680px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 24px;
            overflow: hidden;
        }

        .content { padding: 52px 48px 52px; }

        .logo {
            width: 34px; height: 34px;
            background: #1d1d1f;
            border-radius: 8px;
            text-align: center;
            line-height: 34px;
            color: #ffffff;
            font-size: 15px; font-weight: 600;
            letter-spacing: -0.02em;
            display: inline-block;
        }

        .brand-name {
            font-size: 14px;
            font-weight: 500;
            color: #1d1d1f;
            letter-spacing: -0.01em;
            line-height: 1.35;
        }

        .brand-tagline {
            font-size: 11px;
            font-weight: 400;
            color: #8e8e98;
            letter-spacing: 0.04em;
            margin-top: 2px;
        }

        /* ── HERO ── */
        .company {
            font-size: 30px;
            font-weight: 600;
            letter-spacing: -0.03em;
            line-height: 1.1;
            color: #1d1d1f;
            margin-bottom: 8px;
        }

        .service-type {
            font-size: 14px;
            font-weight: 400;
            color: #8e8e98;
            letter-spacing: 0.02em;
            margin-bottom: 32px;
        }

        .avatar {
            width: 64px; height: 64px;
            border-radius: 50%;
            text-align: center;
            line-height: 60px;
            font-size: 19px; font-weight: 700;
            letter-spacing: -0.02em;
            border: 2px solid #ffffff;
            display: inline-block;
        }

        .avatar-a { background: #dbeafe; color: #1d4ed8; }

        .avatar-s {
            width: 46px; height: 46px;
            line-height: 42px;
            font-size: 14px;
            background: #dcfce7;
            color: #15803d;
        }

        .applicant-name {
            font-size: 24px;
            font-weight: 500;
            letter-spacing: -0.025em;
            line-height: 1.2;
            color: #1d1d1f;
            margin-bottom: 6px;
        }

        /* ── APPOINTMENT CARD ── */
        .appt-block { padding: 18px 22px; }

        .appt-divider { height: 1px; background: #e8e8ed; }

        .data-label {
            font-size: 10px;
            font-weight: 600;
            color: #8e8e98;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            margin-bottom: 6px;
        }

        .appt-datetime {
            font-size: 22px;
            font-weight: 600;
            letter-spacing: -0.025em;
            line-height: 1.2;
            color: #1d1d1f;
        }

        .appt-location-name {
            font-size: 15px;
            font-weight: 500;
            color: #1d1d1f;
            letter-spacing: -0.01em;
            line-height: 1.3;
            margin-bottom: 4px;
        }

        .appt-location-address {
            font-size: 13px;
            font-weight: 400;
            color: #5e5e6a;
            line-height: 1.55;
            margin-bottom: 9px;
        }

        .map-link {
            display: inline-block;
            font-size: 12px;
            font-weight: 400;
            color: #1d1d1f;
            text-decoration: none;
            border-bottom: 1px solid #e8e8ed;
            padding-bottom: 1px;
            letter-spacing: 0.005em;
        }

        .appt-ref-value {
            font-size: 12px;
            font-weight: 500;
            color: #5e5e6a;
            letter-spacing: 0.04em;
        }

        /* ── SECTION HEADING ── */
        .section-heading {
            font-size: 10px;
            font-weight: 600;
            color: #8e8e98;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            margin-top: 40px;
            margin-bottom: 16px;
        }

        /* ── GUIDE ── */
        .guide-name {
            font-size: 16px;
            font-weight: 500;
            color: #1d1d1f;
            letter-spacing: -0.015em;
            line-height: 1.3;
            margin-bottom: 5px;
        }

        .guide-role-inline {
            font-size: 12px;
            font-weight: 400;
            color: #8e8e98;
            letter-spacing: 0.01em;
        }

        .guide-phone {
            font-size: 13px;
            font-weight: 400;
            color: #5e5e6a;
            margin-bottom: 10px;
            line-height: 1.5;
        }

        .guide-phone a {
            color: #5e5e6a;
            text-decoration: none;
            border-bottom: 1px solid #e8e8ed;
        }

        .guide-description {
            font-size: 14px;
            font-weight: 400;
            color: #5e5e6a;
            line-height: 1.7;
            letter-spacing: 0.005em;
        }

        /* ── AFTER APPOINTMENT ── */
        .after-text {
            font-size: 14px;
            font-weight: 400;
            color: #5e5e6a;
            line-height: 1.7;
            letter-spacing: 0.005em;
        }

        /* ── FOOTER ── */
        .footer-brand {
            font-size: 12px;
            font-weight: 500;
            color: #1d1d1f;
            letter-spacing: -0.01em;
        }

        .footer-brand a { color: #1d1d1f; text-decoration: none; }

        .footer-powered {
            font-size: 11px;
            font-weight: 400;
            color: #a1a1a8;
            letter-spacing: 0.01em;
            margin-bottom: 4px;
        }

        .footer-powered a {
            color: #a1a1a8;
            text-decoration: none;
        }

        .footer-legal {
            font-size: 10px;
            font-weight: 400;
            color: #a1a1a8;
            letter-spacing: 0.015em;
        }

        /* ── MOBILE ── */
        @media only screen and (max-width: 600px) {
            .content          { padding: 36px 24px 40px; }
            .company          { font-size: 26px; }
            .applicant-name   { font-size: 21px; }
            .avatar           { width: 56px; height: 56px; font-size: 17px; }
            .appt-datetime    { font-size: 18px; }
        }

        /* ── DARK MODE ── */
        @media (prefers-color-scheme: dark) {
            body  { background: #000; }
            .email { background: #1c1c1e; }

            .brand-name, .company, .applicant-name,
            .appt-datetime, .appt-location-name,
            .guide-name, .footer-brand { color: #f5f5f7; }

            .brand-tagline, .service-type,
            .guide-description, .after-text,
            .footer-powered, .footer-legal { color: #8e8e98; }

            .data-label, .section-heading { color: #636366; }

            .appt-divider { background: #3a3a3c; }

            .appt-location-address, .appt-ref-value,
            .guide-phone, .guide-phone a { color: #8e8e98; }

            .map-link { color: #f5f5f7; border-color: #3a3a3c; }

            .avatar-a { background: #1e3a8a; color: #93c5fd; }
            .avatar-s { background: #14532d; color: #86efac; }
        }

    </style>
</head>
<body style="margin:0;padding:32px 20px;background-color:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1d1d1f;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">
<table role="presentation" class="email-container" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;max-width:680px;margin:0 auto;">
  <tr>
    <td class="email" style="background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 20px 48px -8px rgba(0,0,0,0.10);">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
        <tr>
          <td class="content" style="padding:52px 48px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">

              <!-- HEADER -->
              <tr>
                <td class="header" style="padding-bottom:22px;margin-bottom:40px;border-bottom:1px solid #e8e8ed;" colspan="2">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                    <tr>
                      <td style="vertical-align:middle;padding-right:12px;">
                        ${logoBlock}
                      </td>
                      <td style="vertical-align:middle;">
                        <div class="brand-name" style="font-size:14px;font-weight:500;color:#1d1d1f;letter-spacing:-0.01em;line-height:1.35;">The P.R.O. Company</div>
                        <div class="brand-tagline" style="font-size:11px;font-weight:400;color:#8e8e98;letter-spacing:0.04em;margin-top:2px;">Everything. In Order.</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr><td style="height:40px;font-size:0;line-height:0;" colspan="2">&nbsp;</td></tr>

              <!-- HERO -->
              <tr>
                <td colspan="2">
                  <div class="company" style="font-size:30px;font-weight:600;letter-spacing:-0.03em;line-height:1.1;color:#1d1d1f;margin-bottom:8px;">${escapeHtml(companyName)}</div>
                  <div class="service-type" style="font-size:14px;font-weight:400;color:#8e8e98;letter-spacing:0.02em;margin-bottom:32px;">${appointmentLabel}</div>
                </td>
              </tr>

              <!-- APPLICANT -->
              <tr>
                <td class="applicant-row" style="padding-bottom:28px;margin-bottom:28px;border-bottom:1px solid #e8e8ed;" colspan="2">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                    <tr>
                      <td style="vertical-align:middle;padding-right:18px;">
                        ${avatarBlock}
                      </td>
                      <td style="vertical-align:middle;">
                        <div class="applicant-name" style="font-size:24px;font-weight:500;letter-spacing:-0.025em;line-height:1.2;color:#1d1d1f;margin-bottom:6px;">${escapeHtml(applicantName)}</div>
                        <div class="applicant-meta" style="font-size:12px;font-weight:400;color:#8e8e98;letter-spacing:0.01em;">${applicantMetaHtml}</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr><td style="height:28px;font-size:0;line-height:0;" colspan="2">&nbsp;</td></tr>

              <!-- APPOINTMENT CARD -->
              <tr>
                <td colspan="2">
                  <table role="presentation" class="appt-card" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:#f8f8fc;border:1px solid #e8e8ed;border-radius:16px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.05);margin-bottom:10px;">
                    <tr>
                      <td class="appt-block" style="padding:18px 22px;" colspan="2">
                        <div class="data-label" style="font-size:10px;font-weight:600;color:#8e8e98;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">Date &amp; Time</div>
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                          <tr>
                            <td style="vertical-align:middle;">
                              <div class="appt-datetime" style="font-size:22px;font-weight:600;letter-spacing:-0.025em;line-height:1.2;color:#1d1d1f;">${escapeHtml(dateStr)} &nbsp;&middot;&nbsp; ${escapeHtml(timeStr)}</div>
                            </td>
                            <td style="vertical-align:middle;text-align:right;white-space:nowrap;">
                              ${buildCalendarPillButtons(googleUrl, appleUrl, outlookUrl)}
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr><td class="appt-divider" style="height:1px;font-size:0;line-height:0;background:#e8e8ed;" colspan="2">&nbsp;</td></tr>
                    <tr>
                      <td class="appt-block" style="padding:18px 22px;" colspan="2">
                        <div class="data-label" style="font-size:10px;font-weight:600;color:#8e8e98;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">Location</div>
                        <div class="appt-location-name" style="font-size:15px;font-weight:500;color:#1d1d1f;letter-spacing:-0.01em;line-height:1.3;margin-bottom:4px;">${escapeHtml(centerName)}</div>
                        ${centerAddress ? `<div class="appt-location-address" style="font-size:13px;font-weight:400;color:#5e5e6a;line-height:1.55;margin-bottom:9px;">${escapeHtml(centerAddress)}</div>` : ""}
                        <a href="${escapeHtml(mapsUrl)}" class="map-link" style="display:inline-block;font-size:12px;font-weight:400;color:#1d1d1f;text-decoration:none;border-bottom:1px solid #e8e8ed;padding-bottom:1px;letter-spacing:0.005em;">View on Google Maps &#8599;</a>
                      </td>
                    </tr>
                    ${applicationNumberBlock}
                  </table>
                </td>
              </tr>

              ${guideSection}

              ${dhaBadgeBlock ?? ""}

              <!-- BEFORE YOU GO -->
              <tr>
                <td style="padding-top:40px;" colspan="2">
                  <div class="section-heading" style="font-size:10px;font-weight:600;color:#8e8e98;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:16px;">Before You Go</div>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:#f8f8fc;border:1px solid #e8e8ed;border-radius:16px;">
                    <tr>
                      <td style="padding:18px 22px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                          <tr>
                            <td style="width:16px;vertical-align:top;padding-right:10px;padding-bottom:12px;">
                              <span style="font-size:14px;color:#a1a1a8;line-height:1.55;">&#8226;</span>
                            </td>
                            <td style="vertical-align:top;font-size:14px;font-weight:500;color:#1d1d1f;line-height:1.55;letter-spacing:-0.005em;padding-bottom:12px;">
                              Arrive at least 10 minutes before your appointment time.
                            </td>
                          </tr>
                          <tr>
                            <td style="width:16px;vertical-align:top;padding-right:10px;padding-bottom:12px;">
                              <span style="font-size:14px;color:#a1a1a8;line-height:1.55;">&#8226;</span>
                            </td>
                            <td style="vertical-align:top;font-size:14px;font-weight:500;color:#1d1d1f;line-height:1.55;letter-spacing:-0.005em;padding-bottom:12px;">
                              Bring your original passport. No copies or digital versions accepted.
                            </td>
                          </tr>
                          <tr>
                            <td style="width:16px;vertical-align:top;padding-right:10px;padding-bottom:12px;">
                              <span style="font-size:14px;color:#a1a1a8;line-height:1.55;">&#8226;</span>
                            </td>
                            <td style="vertical-align:top;font-size:14px;font-weight:500;color:#1d1d1f;line-height:1.55;letter-spacing:-0.005em;padding-bottom:12px;">
                              Dress comfortably &mdash; loose, modest clothing works best. Shoulders and knees must be covered.
                            </td>
                          </tr>
                          <tr>
                            <td style="width:16px;vertical-align:top;padding-right:10px;">
                              <span style="font-size:14px;color:#a1a1a8;line-height:1.55;">&#8226;</span>
                            </td>
                            <td style="vertical-align:top;font-size:14px;font-weight:500;color:#1d1d1f;line-height:1.55;letter-spacing:-0.005em;">
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
                  <div class="section-heading" style="font-size:10px;font-weight:600;color:#8e8e98;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:16px;">After the Appointment</div>
                  <div class="after-text" style="font-size:14px;font-weight:400;color:#5e5e6a;line-height:1.7;letter-spacing:0.005em;">Results are typically issued within 24 hours, and all subsequent steps will be managed by our team, with no action required unless DHA requests a follow up.</div>
                </td>
              </tr>

              ${rescheduleBox}

              <!-- FOOTER -->
              <tr>
                <td class="footer" colspan="2" style="margin-top:48px;padding-top:24px;border-top:1px solid #e8e8ed;text-align:center;">
                  <div class="footer-brand" style="font-size:12px;font-weight:500;color:#1d1d1f;letter-spacing:-0.01em;">
                    <a href="https://www.procompany.ae" style="color:#1d1d1f;text-decoration:none;">The P.R.O. Company&#8482;</a>
                  </div>
                  <div class="footer-divider" style="width:24px;height:1px;background:#e8e8ed;margin:8px auto;"></div>
                  <div class="footer-powered" style="font-size:11px;font-weight:400;color:#a1a1a8;letter-spacing:0.01em;margin-bottom:4px;">
                    Powered by <a href="https://www.procompany.ae" style="color:#a1a1a8;text-decoration:none;">The P.R.O. Company</a>
                  </div>
                  <div class="footer-legal" style="font-size:10px;font-weight:400;color:#a1a1a8;letter-spacing:0.015em;">&copy; ${new Date().getFullYear()} The P.R.O. Company&#8482;. All rights reserved.</div>
                  <div class="footer-licensed" style="font-size:10px;font-weight:400;color:#a1a1a8;letter-spacing:0.015em;margin-top:2px;">Licensed under Keystone Business Solutions LLC</div>
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