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
  const day = dt.getDate();
  const month = months[dt.getMonth()];
  const year = dt.getFullYear();
  let hours = dt.getHours();
  const mins = dt.getMinutes().toString().padStart(2, "0");
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

const calendarGoogleSvgImg = `<img src="data:image/svg+xml,%3Csvg viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='3' y='4' width='18' height='17' rx='2' fill='white' stroke='%23dadce0'/%3E%3Crect x='3' y='4' width='18' height='5' rx='2' fill='%234285F4'/%3E%3Crect x='3' y='7' width='18' height='2' fill='%234285F4'/%3E%3Crect x='7' y='2' width='2' height='4' rx='1' fill='%234285F4'/%3E%3Crect x='15' y='2' width='2' height='4' rx='1' fill='%234285F4'/%3E%3Cpath d='M10 14.5L11.5 16L14.5 13' stroke='%2334A853' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E" width="22" height="22" alt="Google Calendar" style="display:block;opacity:0.65;" />`;

const calendarAppleSvgImg = `<img src="data:image/svg+xml,%3Csvg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='3' y='4' width='18' height='17' rx='2.5' fill='white' stroke='%23d1d1d6' stroke-width='1'/%3E%3Crect x='3' y='4' width='18' height='6' rx='2.5' fill='%23ff3b30'/%3E%3Crect x='3' y='8' width='18' height='2' fill='%23ff3b30'/%3E%3Crect x='7.5' y='2.5' width='1.5' height='3.5' rx='0.75' fill='%235e5e6a'/%3E%3Crect x='15' y='2.5' width='1.5' height='3.5' rx='0.75' fill='%235e5e6a'/%3E%3C/svg%3E" width="22" height="22" alt="Apple Calendar" style="display:block;opacity:0.65;" />`;

const calendarOutlookSvgImg = `<img src="data:image/svg+xml,%3Csvg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='9' y='3' width='13' height='13' rx='1.5' fill='%230078D4'/%3E%3Crect x='9' y='3' width='13' height='4' rx='1.5' fill='%23005fa3'/%3E%3Crect x='9' y='5' width='13' height='2' fill='%23005fa3'/%3E%3Crect x='12' y='2' width='1.5' height='3' rx='0.75' fill='%230078D4'/%3E%3Crect x='18' y='2' width='1.5' height='3' rx='0.75' fill='%230078D4'/%3E%3Crect x='2' y='8' width='11' height='13' rx='1.5' fill='%231d1d1f'/%3E%3C/svg%3E" width="22" height="22" alt="Outlook Calendar" style="display:block;opacity:0.65;" />`;

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
    ? `<img src="${escapeHtml(applicantPhotoUrl)}" alt="${escapeHtml(applicantName)}" width="72" height="72" style="width:72px;height:72px;border-radius:50%;display:block;object-fit:cover;border:2px solid #ffffff;box-shadow:0 4px 14px rgba(0,0,0,0.07);" class="avatar-photo" />`
    : `<div class="avatar-applicant" style="width:72px;height:72px;border-radius:50%;text-align:center;line-height:68px;font-size:22px;font-weight:600;letter-spacing:-0.02em;box-shadow:0 4px 14px rgba(0,0,0,0.07);">${escapeHtml(initials)}</div>`;

  const dotSpan = `<span style="display:inline-block;width:3px;height:3px;background:#a1a1a8;border-radius:50%;vertical-align:middle;margin:0 6px;"></span>`;
  const eidServiceTypeMeta = serviceType?.name ?? appointment.type ?? "EID";
  const applicantMetaParts = ["Applicant", escapeHtml(eidServiceTypeMeta)];
  if (applicationNumber) applicantMetaParts.push(escapeHtml(applicationNumber));
  const applicantMetaHtml = applicantMetaParts.join(` ${dotSpan} `);

  const phoneIconSvg = `<img src="data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.61 21 3 13.39 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.58a1 1 0 01-.25 1.01l-2.2 2.2z' fill='%235e5e6a'/%3E%3C/svg%3E" width="12" height="12" style="vertical-align:middle;margin-right:4px;opacity:0.5;" alt="" />`;
  const emailIconSvg = `<img src="data:image/svg+xml,%3Csvg width='11' height='11' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z' fill='%235e5e6a'/%3E%3C/svg%3E" width="11" height="11" style="vertical-align:middle;margin-right:3px;opacity:0.45;" alt="" />`;

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
            <div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px;">
              <span class="reschedule-rm-name" style="font-size:12px;font-weight:500;color:#3a3a3c;letter-spacing:0.005em;">${escapeHtml(rmDisplayName)}</span>
              ${rmPhone ? `<span style="display:inline-block;width:3px;height:3px;background:#a1a1a8;border-radius:50%;vertical-align:middle;"></span><a href="tel:${escapeHtml(rmPhone)}" class="reschedule-rm-link" style="font-size:12px;font-weight:400;color:#8e8e98;text-decoration:none;border-bottom:1px solid #e8e8ed;">${phoneIconSvg}${escapeHtml(rmPhone)}</a>` : ""}
              ${rmEmail ? `<span style="display:inline-block;width:3px;height:3px;background:#a1a1a8;border-radius:50%;vertical-align:middle;"></span><a href="mailto:${escapeHtml(rmEmail)}" class="reschedule-rm-link" style="font-size:12px;font-weight:400;color:#8e8e98;text-decoration:none;border-bottom:1px solid #e8e8ed;">${emailIconSvg}${escapeHtml(rmEmail)}</a>` : ""}
            </div>
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
              ${guidePhone ? `<div class="text-secondary" style="font-size:13px;margin-bottom:10px;line-height:1.5;">${phoneIconSvg}<a href="tel:${escapeHtml(guidePhone)}" class="text-secondary link-underline" style="text-decoration:none;border-bottom:1px solid #e8e8ed;color:#5e5e6a;">${escapeHtml(guidePhone)}</a></div>` : ""}
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
                              <div class="text-primary" style="font-size:13px;font-weight:500;letter-spacing:-0.01em;line-height:1.35;">Keystone Business Solutions</div>
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
                                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;display:inline-table;">
                                      <tr>
                                        <td style="padding-left:10px;">${calendarGoogleSvgImg}</td>
                                        <td style="padding-left:10px;">${calendarAppleSvgImg}</td>
                                        <td style="padding-left:10px;">${calendarOutlookSvgImg}</td>
                                      </tr>
                                    </table>
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
                                  <td style="width:32px;vertical-align:top;padding-right:12px;padding-bottom:10px;">
                                    <img class="notice-icon-light" src="data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='12' cy='12' r='9' stroke='%231d1d1f' stroke-width='1.5'/%3E%3Cpath d='M12 7v5.5l3 2' stroke='%231d1d1f' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E" width="20" height="20" alt="" style="display:inline;opacity:0.5;margin-top:1px;" />
                                    <img class="notice-icon-dark" src="data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='12' cy='12' r='9' stroke='%23f5f5f7' stroke-width='1.5'/%3E%3Cpath d='M12 7v5.5l3 2' stroke='%23f5f5f7' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E" width="20" height="20" alt="" style="display:none;opacity:0.5;margin-top:1px;" />
                                  </td>
                                  <td class="text-secondary" style="vertical-align:top;font-size:14px;font-weight:400;line-height:1.6;padding-bottom:14px;">
                                    Arrive at least 10 minutes before your appointment time.
                                  </td>
                                </tr>
                                <tr>
                                  <td style="width:32px;vertical-align:top;padding-right:12px;">
                                    <img class="notice-icon-light" src="data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='4' y='3' width='12' height='16' rx='2' stroke='%231d1d1f' stroke-width='1.5'/%3E%3Cpath d='M8 8h6M8 12h4' stroke='%231d1d1f' stroke-width='1.5' stroke-linecap='round'/%3E%3Cpath d='M16 8h2a2 2 0 012 2v9a2 2 0 01-2 2H8a2 2 0 01-2-2v-1' stroke='%231d1d1f' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E" width="20" height="20" alt="" style="display:inline;opacity:0.5;margin-top:1px;" />
                                    <img class="notice-icon-dark" src="data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='4' y='3' width='12' height='16' rx='2' stroke='%23f5f5f7' stroke-width='1.5'/%3E%3Cpath d='M8 8h6M8 12h4' stroke='%23f5f5f7' stroke-width='1.5' stroke-linecap='round'/%3E%3Cpath d='M16 8h2a2 2 0 012 2v9a2 2 0 01-2 2H8a2 2 0 01-2-2v-1' stroke='%23f5f5f7' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E" width="20" height="20" alt="" style="display:none;opacity:0.5;margin-top:1px;" />
                                  </td>
                                  <td class="text-secondary" style="vertical-align:top;font-size:14px;font-weight:400;line-height:1.6;">
                                    Bring your original Emirates ID and any previously provided documents.
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
                      <td colspan="2" style="padding-top:36px;">
                        <div class="text-label" style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;padding-bottom:14px;">After the Appointment</div>
                        <div class="text-secondary" style="font-size:14px;font-weight:400;line-height:1.6;">Results are shared within 24 hours. We handle everything that follows &mdash; no action needed on your end.</div>
                      </td>
                    </tr>

                    ${rescheduleBox}

                    <!-- FOOTER -->
                    <tr>
                      <td class="border-subtle" colspan="2" style="padding-top:28px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-top:1px solid #e8e8ed;">
                          <tr><td style="height:20px;font-size:0;line-height:0;">&nbsp;</td></tr>
                          <tr>
                            <td style="text-align:center;">
                              <div class="text-primary" style="font-size:13px;font-weight:500;letter-spacing:-0.005em;">
                                <a href="https://www.procompany.ae" class="link-primary" style="text-decoration:none;">Keystone Business Solutions</a>
                              </div>
                              <div class="footer-divider-line" style="width:32px;height:1px;background:#e8e8ed;margin:6px auto;"></div>
                              <div class="text-secondary" style="font-size:11px;margin-bottom:4px;">
                                Powered by <a href="https://www.procompany.ae" class="text-secondary" style="text-decoration:none;">Keystone Business Solutions</a>
                              </div>
                              <div class="text-secondary" style="font-size:10px;letter-spacing:0.01em;">&copy; ${new Date().getFullYear()} Keystone Business Solutions. All rights reserved.</div>
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
    ? `<img src="${escapeHtml(applicantPhotoUrl)}" alt="${escapeHtml(applicantName)}" width="64" height="64" style="width:64px;height:64px;border-radius:50%;display:block;object-fit:cover;border:2px solid #ffffff;box-shadow:0 3px 12px rgba(0,0,0,0.08);" />`
    : `<div class="avatar avatar-a" style="width:64px;height:64px;border-radius:50%;background:#dbeafe;color:#1d4ed8;text-align:center;line-height:60px;font-size:19px;font-weight:700;letter-spacing:-0.02em;border:2px solid #ffffff;box-shadow:0 3px 12px rgba(0,0,0,0.08);display:inline-block;">${escapeHtml(initials)}</div>`;

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

  const phoneIconSvg = `<img src="data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.61 21 3 13.39 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.58a1 1 0 01-.25 1.01l-2.2 2.2z' fill='%235e5e6a'/%3E%3C/svg%3E" width="12" height="12" style="vertical-align:middle;margin-right:4px;opacity:0.5;" alt="" />`;

  const emailIconSvg = `<img src="data:image/svg+xml,%3Csvg width='11' height='11' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z' fill='%235e5e6a'/%3E%3C/svg%3E" width="11" height="11" style="vertical-align:middle;margin-right:3px;opacity:0.45;" alt="" />`;

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
              ${guidePhone ? `<div class="guide-phone" style="font-size:13px;font-weight:400;color:#5e5e6a;margin-bottom:10px;line-height:1.5;">${phoneIconSvg}<a href="tel:${escapeHtml(guidePhone)}" style="color:#5e5e6a;text-decoration:none;border-bottom:1px solid #e8e8ed;">${escapeHtml(guidePhone)}</a></div>` : ""}
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
        <div class="reschedule-box" style="background:#f8f8fc;border:1px solid #e8e8ed;border-radius:16px;padding:18px 22px;margin-top:40px;">
          <div class="reschedule-text" style="font-size:14px;font-weight:400;color:#5e5e6a;line-height:1.65;margin-bottom:12px;"><strong style="font-size:14px;font-weight:600;color:#1d1d1f;">Need to reschedule?</strong> Contact your Relationship Manager and we&rsquo;ll arrange a new slot at no cost.</div>
          <div class="reschedule-rm" style="display:flex;align-items:center;flex-wrap:wrap;gap:6px;">
            <span class="reschedule-rm-name" style="font-size:12px;font-weight:500;color:#3a3a3c;letter-spacing:0.005em;">${escapeHtml(rmDisplayName)}</span>
            ${rmPhone ? `<span class="reschedule-rm-dot" style="display:inline-block;width:3px;height:3px;background:#a1a1a8;border-radius:50%;"></span><a href="tel:${escapeHtml(rmPhone)}" class="reschedule-rm-link" style="font-size:12px;font-weight:400;color:#8e8e98;text-decoration:none;border-bottom:1px solid #e8e8ed;">${phoneIconSvg}${escapeHtml(rmPhone)}</a>` : ""}
            ${rmEmail ? `<span class="reschedule-rm-dot" style="display:inline-block;width:3px;height:3px;background:#a1a1a8;border-radius:50%;"></span><a href="mailto:${escapeHtml(rmEmail)}" class="reschedule-rm-link" style="font-size:12px;font-weight:400;color:#8e8e98;text-decoration:none;border-bottom:1px solid #e8e8ed;">${emailIconSvg}${escapeHtml(rmEmail)}</a>` : ""}
          </div>
        </div>
      </td></tr>`
    : "";

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
}

function buildEmailHtmlTemplate(p: EmailTemplateParams): string {
  const {
    appointmentLabel, companyName, logoBlock, avatarBlock,
    applicantName, applicantMetaHtml, dateStr, timeStr,
    centerName, centerAddress, mapsUrl, applicationNumberBlock,
    guideSection, notesBlock, googleUrl, appleUrl, outlookUrl,
    cardLinkBlock, rescheduleBox,
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

        :root {
            --black:        #1d1d1f;
            --gray-dark:    #3a3a3c;
            --gray-mid:     #5e5e6a;
            --gray-light:   #8e8e98;
            --gray-lighter: #a1a1a8;
            --bg:           #f5f5f7;
            --white:        #ffffff;
            --border:       #e8e8ed;
            --card:         #f8f8fc;
            --font:         -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif;
            --avatar-a-bg:  #dbeafe;
            --avatar-a-fg:  #1d4ed8;
            --avatar-s-bg:  #dcfce7;
            --avatar-s-fg:  #15803d;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            background-color: var(--bg);
            font-family: var(--font);
            font-size: 15px;
            line-height: 1.6;
            color: var(--black);
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            padding: 32px 20px;
        }

        /* ── SHELL ── */
        .email {
            max-width: 680px;
            margin: 0 auto;
            background: var(--white);
            border-radius: 24px;
            box-shadow: 0 20px 48px -8px rgba(0,0,0,0.10);
            overflow: hidden;
        }

        .content { padding: 52px 48px 52px; }

        /* ── HEADER ── */
        .header {
            display: flex;
            align-items: center;
            padding-bottom: 22px;
            margin-bottom: 40px;
            border-bottom: 1px solid var(--border);
        }

        .logo {
            width: 34px; height: 34px;
            background: var(--black);
            border-radius: 8px;
            display: flex; align-items: center; justify-content: center;
            color: var(--white);
            font-size: 15px; font-weight: 600;
            letter-spacing: -0.02em;
            flex-shrink: 0;
            margin-right: 12px;
        }

        .brand-name {
            font-size: 14px;
            font-weight: 500;
            color: var(--black);
            letter-spacing: -0.01em;
            line-height: 1.35;
        }

        .brand-tagline {
            font-size: 11px;
            font-weight: 400;
            color: var(--gray-light);
            letter-spacing: 0.04em;
            margin-top: 2px;
        }

        /* ── HERO ── */
        .company {
            font-size: 30px;
            font-weight: 600;
            letter-spacing: -0.03em;
            line-height: 1.1;
            color: var(--black);
            margin-bottom: 8px;
        }

        .service-type {
            font-size: 14px;
            font-weight: 400;
            color: var(--gray-light);
            letter-spacing: 0.02em;
            margin-bottom: 32px;
        }

        /* ── APPLICANT ROW ── */
        .applicant-row {
            display: flex;
            align-items: center;
            gap: 18px;
            padding-bottom: 28px;
            margin-bottom: 28px;
            border-bottom: 1px solid var(--border);
        }

        .avatar {
            width: 64px; height: 64px;
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-size: 19px; font-weight: 700;
            letter-spacing: -0.02em;
            flex-shrink: 0;
            border: 2px solid var(--white);
            box-shadow: 0 3px 12px rgba(0,0,0,0.08);
        }

        .avatar-a { background: var(--avatar-a-bg); color: var(--avatar-a-fg); }

        .avatar-s {
            width: 46px; height: 46px;
            font-size: 14px;
            background: var(--avatar-s-bg);
            color: var(--avatar-s-fg);
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }

        .applicant-name {
            font-size: 24px;
            font-weight: 500;
            letter-spacing: -0.025em;
            line-height: 1.2;
            color: var(--black);
            margin-bottom: 6px;
        }

        .applicant-meta {
            font-size: 12px;
            font-weight: 400;
            color: var(--gray-light);
            display: flex; align-items: center;
            gap: 7px;
            letter-spacing: 0.01em;
        }

        .meta-dot {
            width: 3px; height: 3px;
            background: var(--gray-lighter);
            border-radius: 50%;
            flex-shrink: 0;
        }

        /* ── APPOINTMENT CARD ── */
        .appt-card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 16px;
            overflow: hidden;
            margin-bottom: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }

        .appt-block { padding: 18px 22px; }

        .appt-divider { height: 1px; background: var(--border); }

        .data-label {
            font-size: 10px;
            font-weight: 600;
            color: var(--gray-light);
            text-transform: uppercase;
            letter-spacing: 0.1em;
            margin-bottom: 6px;
        }

        .appt-datetime {
            font-size: 22px;
            font-weight: 600;
            letter-spacing: -0.025em;
            line-height: 1.2;
            color: var(--black);
        }

        .appt-datetime-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
        }

        .calendar-icons { display: flex; align-items: center; gap: 12px; }

        .calendar-icon {
            width: 24px; height: 24px;
            opacity: 0.55;
            transition: opacity 0.15s;
            display: flex; align-items: center; justify-content: center;
            text-decoration: none;
            flex-shrink: 0;
        }

        .calendar-icon:hover { opacity: 1; }
        .calendar-icon svg { width: 100%; height: 100%; }

        .appt-location-name {
            font-size: 15px;
            font-weight: 500;
            color: var(--black);
            letter-spacing: -0.01em;
            line-height: 1.3;
            margin-bottom: 4px;
        }

        .appt-location-address {
            font-size: 13px;
            font-weight: 400;
            color: var(--gray-mid);
            line-height: 1.55;
            margin-bottom: 9px;
        }

        .map-link {
            display: inline-block;
            font-size: 12px;
            font-weight: 400;
            color: var(--black);
            text-decoration: none;
            border-bottom: 1px solid var(--border);
            padding-bottom: 1px;
            letter-spacing: 0.005em;
            transition: border-color 0.15s;
        }

        .map-link:hover { border-color: var(--black); }

        .appt-ref-row {
            padding: 13px 22px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
        }

        .appt-ref-value {
            font-size: 12px;
            font-weight: 500;
            color: var(--gray-mid);
            letter-spacing: 0.04em;
        }

        /* ── SECTION HEADING ── */
        .section-heading {
            font-size: 10px;
            font-weight: 600;
            color: var(--gray-light);
            text-transform: uppercase;
            letter-spacing: 0.1em;
            margin-top: 40px;
            margin-bottom: 16px;
        }

        /* ── GUIDE ── */
        .guide-row {
            display: flex;
            align-items: flex-start;
            gap: 14px;
        }

        .guide-info { flex: 1; }

        .guide-name {
            font-size: 16px;
            font-weight: 500;
            color: var(--black);
            letter-spacing: -0.015em;
            line-height: 1.3;
            margin-bottom: 5px;
        }

        .guide-role-inline {
            font-size: 12px;
            font-weight: 400;
            color: var(--gray-light);
            letter-spacing: 0.01em;
        }

        .guide-phone {
            font-size: 13px;
            font-weight: 400;
            color: var(--gray-mid);
            margin-bottom: 10px;
            line-height: 1.5;
        }

        .guide-phone a {
            color: var(--gray-mid);
            text-decoration: none;
            border-bottom: 1px solid var(--border);
            transition: color 0.15s, border-color 0.15s;
        }

        .guide-phone a:hover { color: var(--black); border-color: var(--black); }

        .guide-description {
            font-size: 14px;
            font-weight: 400;
            color: var(--gray-mid);
            line-height: 1.7;
            letter-spacing: 0.005em;
        }

        /* ── BEFORE YOU GO ── */
        .notice-card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 18px 22px;
            display: flex;
            flex-direction: column;
            gap: 14px;
        }

        .notice-item {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            font-size: 14px;
            font-weight: 500;
            color: var(--black);
            line-height: 1.55;
            letter-spacing: -0.005em;
        }

        .notice-icon {
            width: 18px; height: 18px;
            flex-shrink: 0;
            margin-top: 2px;
            opacity: 0.4;
        }

        /* ── AFTER APPOINTMENT ── */
        .after-text {
            font-size: 14px;
            font-weight: 400;
            color: var(--gray-mid);
            line-height: 1.7;
            letter-spacing: 0.005em;
        }

        /* ── RESCHEDULE ── */
        .reschedule-box {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 18px 22px;
            margin-top: 40px;
        }

        .reschedule-text {
            font-size: 14px;
            font-weight: 400;
            color: var(--gray-mid);
            line-height: 1.65;
            margin-bottom: 12px;
        }

        .reschedule-text strong {
            font-size: 14px;
            font-weight: 600;
            color: var(--black);
        }

        .reschedule-rm {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 6px;
        }

        .reschedule-rm-name {
            font-size: 12px;
            font-weight: 500;
            color: var(--gray-dark);
            letter-spacing: 0.005em;
        }

        .reschedule-rm-dot {
            width: 3px; height: 3px;
            background: var(--gray-lighter);
            border-radius: 50%;
            flex-shrink: 0;
        }

        .reschedule-rm-link {
            font-size: 12px;
            font-weight: 400;
            color: var(--gray-light);
            text-decoration: none;
            border-bottom: 1px solid var(--border);
            transition: color 0.15s, border-color 0.15s;
        }

        .reschedule-rm-link:hover { color: var(--black); border-color: var(--black); }

        /* ── FOOTER ── */
        .footer {
            margin-top: 48px;
            padding-top: 24px;
            border-top: 1px solid var(--border);
            text-align: center;
        }

        .footer-brand {
            font-size: 12px;
            font-weight: 500;
            color: var(--black);
            letter-spacing: -0.01em;
        }

        .footer-brand a { color: var(--black); text-decoration: none; }

        .footer-divider {
            width: 24px; height: 1px;
            background: var(--border);
            margin: 8px auto;
        }

        .footer-powered {
            font-size: 11px;
            font-weight: 400;
            color: var(--gray-lighter);
            letter-spacing: 0.01em;
            margin-bottom: 4px;
        }

        .footer-powered a {
            color: var(--gray-lighter);
            text-decoration: none;
            border-bottom: 1px solid transparent;
            transition: color 0.15s, border-color 0.15s;
        }

        .footer-powered a:hover { color: var(--black); border-color: var(--border); }

        .footer-legal {
            font-size: 10px;
            font-weight: 400;
            color: var(--gray-lighter);
            letter-spacing: 0.015em;
        }

        /* ── MOBILE ── */
        @media only screen and (max-width: 600px) {
            .content          { padding: 36px 24px 40px; }
            .company          { font-size: 26px; }
            .applicant-name   { font-size: 21px; }
            .avatar           { width: 56px; height: 56px; font-size: 17px; }
            .appt-datetime    { font-size: 18px; }
            .appt-datetime-row { flex-direction: column; align-items: flex-start; gap: 10px; }
        }

        /* ── DARK MODE ── */
        @media (prefers-color-scheme: dark) {
            body  { background: #000; }
            .email { background: #1c1c1e; box-shadow: 0 20px 48px -8px rgba(0,0,0,0.5); }

            .header, .applicant-row, .footer { border-color: #2c2c2e; }

            .brand-name, .company, .applicant-name,
            .appt-datetime, .appt-location-name,
            .guide-name, .footer-brand { color: #f5f5f7; }

            .brand-tagline, .service-type, .applicant-meta,
            .guide-description, .after-text,
            .footer-powered, .footer-legal { color: #8e8e98; }

            .data-label, .section-heading { color: #636366; }

            .appt-card, .notice-card, .reschedule-box {
                background: #2c2c2e;
                border-color: #3a3a3c;
            }

            .appt-divider { background: #3a3a3c; }

            .appt-location-address, .appt-ref-value,
            .guide-phone, .guide-phone a { color: #8e8e98; }

            .map-link, .footer-brand a, .footer-powered a {
                color: #f5f5f7; border-color: #3a3a3c;
            }

            .notice-item { color: #f5f5f7; }
            .notice-icon path, .notice-icon circle { stroke: #f5f5f7; }

            .reschedule-text strong, .reschedule-rm-name { color: #f5f5f7; }
            .reschedule-rm-link { color: #8e8e98; border-color: #3a3a3c; }

            .footer-divider { background: #2c2c2e; }
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
                        <div class="brand-name" style="font-size:14px;font-weight:500;color:#1d1d1f;letter-spacing:-0.01em;line-height:1.35;">Keystone Business Solutions</div>
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
                              <table role="presentation" class="calendar-icons" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;display:inline-table;">
                                <tr>
                                  <td style="padding-left:12px;"><a href="${escapeHtml(googleUrl)}" class="calendar-icon" title="Add to Google Calendar" style="display:block;text-decoration:none;opacity:0.55;">${calendarGoogleSvgImg}</a></td>
                                  <td style="padding-left:12px;"><a href="${escapeHtml(appleUrl)}" class="calendar-icon" title="Add to Apple Calendar" style="display:block;text-decoration:none;opacity:0.55;">${calendarAppleSvgImg}</a></td>
                                  <td style="padding-left:12px;"><a href="${escapeHtml(outlookUrl)}" class="calendar-icon" title="Add to Outlook Calendar" style="display:block;text-decoration:none;opacity:0.55;">${calendarOutlookSvgImg}</a></td>
                                </tr>
                              </table>
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

              <!-- BEFORE YOU GO -->
              <tr>
                <td style="padding-top:40px;" colspan="2">
                  <div class="section-heading" style="font-size:10px;font-weight:600;color:#8e8e98;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:16px;">Before You Go</div>
                  <table role="presentation" class="notice-card" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:#f8f8fc;border:1px solid #e8e8ed;border-radius:16px;padding:18px 22px;">
                    <tr>
                      <td style="padding:18px 22px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                          <tr>
                            <td style="width:30px;vertical-align:top;padding-right:12px;padding-bottom:14px;">
                              <img src="data:image/svg+xml,%3Csvg width='18' height='18' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='12' cy='12' r='9' stroke='%231d1d1f' stroke-width='1.5'/%3E%3Cpath d='M12 7v5.5l3 2' stroke='%231d1d1f' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E" class="notice-icon" width="18" height="18" alt="" style="display:block;opacity:0.4;margin-top:2px;" />
                            </td>
                            <td class="notice-item" style="vertical-align:top;font-size:14px;font-weight:500;color:#1d1d1f;line-height:1.55;letter-spacing:-0.005em;padding-bottom:14px;">
                              Arrive at least 10 minutes before your appointment time.
                            </td>
                          </tr>
                          <tr>
                            <td style="width:30px;vertical-align:top;padding-right:12px;">
                              <img src="data:image/svg+xml,%3Csvg width='18' height='18' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='4' y='3' width='12' height='16' rx='2' stroke='%231d1d1f' stroke-width='1.5'/%3E%3Cpath d='M8 8h6M8 12h4' stroke='%231d1d1f' stroke-width='1.5' stroke-linecap='round'/%3E%3Cpath d='M16 8h2a2 2 0 012 2v9a2 2 0 01-2 2H8a2 2 0 01-2-2v-1' stroke='%231d1d1f' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E" class="notice-icon" width="18" height="18" alt="" style="display:block;opacity:0.4;margin-top:2px;" />
                            </td>
                            <td class="notice-item" style="vertical-align:top;font-size:14px;font-weight:500;color:#1d1d1f;line-height:1.55;letter-spacing:-0.005em;">
                              Bring your original passport. No copies or digital versions accepted.
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
                  <div class="after-text" style="font-size:14px;font-weight:400;color:#5e5e6a;line-height:1.7;letter-spacing:0.005em;">Results are shared within 24 hours. We handle everything that follows &mdash; no action needed on your end.</div>
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
                    Powered by <a href="https://www.procompany.ae" style="color:#a1a1a8;text-decoration:none;">Keystone Business Solutions</a>
                  </div>
                  <div class="footer-legal" style="font-size:10px;font-weight:400;color:#a1a1a8;letter-spacing:0.015em;">&copy; ${new Date().getFullYear()} The P.R.O. Company&#8482;. All rights reserved.</div>
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