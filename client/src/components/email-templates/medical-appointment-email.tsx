export interface MedicalAppointmentEmailProps {
  applicantName: string;
  companyName: string;
  appointmentType: string;
  dateStr: string;
  timeStr: string;
  centerName: string;
  centerAddress?: string;
  mapsUrl?: string;
  applicationNumber?: string;
  guideName?: string;
  guidePhone?: string;
  guideDescription?: string;
  rmName?: string;
  rmPhone?: string;
  rmEmail?: string;
  notes?: string;
  applicantPhotoUrl?: string;
  appLogoUrl?: string;
  cardUrl?: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const calendarGoogleSvg = `<img src="data:image/svg+xml,%3Csvg viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='3' y='4' width='18' height='17' rx='2' fill='white' stroke='%23dadce0'/%3E%3Crect x='3' y='4' width='18' height='5' rx='2' fill='%234285F4'/%3E%3Crect x='3' y='7' width='18' height='2' fill='%234285F4'/%3E%3Crect x='7' y='2' width='2' height='4' rx='1' fill='%234285F4'/%3E%3Crect x='15' y='2' width='2' height='4' rx='1' fill='%234285F4'/%3E%3Cpath d='M10 14.5L11.5 16L14.5 13' stroke='%2334A853' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E" width="22" height="22" alt="Google Calendar" style="display:block;opacity:0.65;" />`;

const calendarAppleSvg = `<img src="data:image/svg+xml,%3Csvg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='3' y='4' width='18' height='17' rx='2.5' fill='white' stroke='%23d1d1d6' stroke-width='1'/%3E%3Crect x='3' y='4' width='18' height='6' rx='2.5' fill='%23ff3b30'/%3E%3Crect x='3' y='8' width='18' height='2' fill='%23ff3b30'/%3E%3Crect x='7.5' y='2.5' width='1.5' height='3.5' rx='0.75' fill='%235e5e6a'/%3E%3Crect x='15' y='2.5' width='1.5' height='3.5' rx='0.75' fill='%235e5e6a'/%3E%3C/svg%3E" width="22" height="22" alt="Apple Calendar" style="display:block;opacity:0.65;" />`;

const calendarOutlookSvg = `<img src="data:image/svg+xml,%3Csvg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='9' y='3' width='13' height='13' rx='1.5' fill='%230078D4'/%3E%3Crect x='9' y='3' width='13' height='4' rx='1.5' fill='%23005fa3'/%3E%3Crect x='9' y='5' width='13' height='2' fill='%23005fa3'/%3E%3Crect x='12' y='2' width='1.5' height='3' rx='0.75' fill='%230078D4'/%3E%3Crect x='18' y='2' width='1.5' height='3' rx='0.75' fill='%230078D4'/%3E%3Crect x='2' y='8' width='11' height='13' rx='1.5' fill='%231d1d1f'/%3E%3C/svg%3E" width="22" height="22" alt="Outlook Calendar" style="display:block;opacity:0.65;" />`;

export function generateMedicalAppointmentEmailHtml(props: MedicalAppointmentEmailProps): string {
  const {
    applicantName,
    companyName,
    appointmentType,
    dateStr,
    timeStr,
    centerName,
    centerAddress = "",
    mapsUrl = "#",
    applicationNumber = "",
    guideName = "",
    guidePhone = "",
    guideDescription = "",
    rmName = "",
    rmPhone = "",
    rmEmail = "",
    notes = "",
    applicantPhotoUrl,
    appLogoUrl,
    cardUrl = "",
  } = props;

  const initials = getInitials(applicantName);
  const guideInitials = guideName ? getInitials(guideName) : "";
  const hasRmContact = !!(rmName || rmPhone || rmEmail);
  const rmDisplayName = rmName || "Your Relationship Manager";

  const guideDescText = guideDescription ||
    (guideName ? `${escapeHtml(guideName.split(" ")[0])} will meet your employee at the main entrance, bring all required documents, handle registration, and manage the queue. They simply need to be present.` : "");

  const logoBlock = appLogoUrl
    ? `<img src="${escapeHtml(appLogoUrl)}" alt="Logo" width="36" height="36" style="width:36px;height:36px;border-radius:8px;display:block;" />`
    : `<div class="logo-mark" style="width:36px;height:36px;border-radius:8px;text-align:center;line-height:36px;font-size:17px;font-weight:600;letter-spacing:-0.02em;">K</div>`;

  const avatarBlock = applicantPhotoUrl
    ? `<img src="${escapeHtml(applicantPhotoUrl)}" alt="${escapeHtml(applicantName)}" width="72" height="72" style="width:72px;height:72px;border-radius:50%;display:block;object-fit:cover;border:2px solid #ffffff;box-shadow:0 4px 14px rgba(0,0,0,0.07);" class="avatar-photo" />`
    : `<div class="avatar-applicant" style="width:72px;height:72px;border-radius:50%;text-align:center;line-height:68px;font-size:22px;font-weight:600;letter-spacing:-0.02em;box-shadow:0 4px 14px rgba(0,0,0,0.07);">${escapeHtml(initials)}</div>`;

  const applicantMetaParts = ["Applicant"];
  if (appointmentType) applicantMetaParts.push(escapeHtml(appointmentType));
  if (applicationNumber) applicantMetaParts.push(escapeHtml(applicationNumber));
  const applicantMetaHtml = applicantMetaParts.join(` <span style="display:inline-block;width:3px;height:3px;background:#a1a1a8;border-radius:50%;vertical-align:middle;margin:0 6px;"></span> `);

  const applicationNumberBlock = applicationNumber
    ? `<tr><td class="card-divider" style="height:1px;font-size:0;line-height:0;" colspan="2">&nbsp;</td></tr>
       <tr>
         <td class="text-label" style="padding:14px 22px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;">Medical Application</td>
         <td class="text-secondary" style="padding:14px 22px;font-size:13px;font-weight:500;letter-spacing:0.02em;text-align:right;">${escapeHtml(applicationNumber)}</td>
       </tr>`
    : "";

  const phoneIconImg = `<img src="data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.61 21 3 13.39 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.58a1 1 0 01-.25 1.01l-2.2 2.2z' fill='%235e5e6a'/%3E%3C/svg%3E" width="12" height="12" style="vertical-align:middle;margin-right:4px;opacity:0.5;" alt="" />`;

  const emailIconImg = `<img src="data:image/svg+xml,%3Csvg width='11' height='11' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z' fill='%235e5e6a'/%3E%3C/svg%3E" width="11" height="11" style="vertical-align:middle;margin-right:3px;opacity:0.45;" alt="" />`;

  const guideSection = guideName
    ? `<tr><td style="padding-top:36px;" colspan="2">
        <div class="text-label" style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;padding-bottom:14px;">Your On-Site Guide</div>
        <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">
          <tr>
            <td style="vertical-align:top;width:52px;padding-right:14px;">
              <div class="avatar-guide" style="width:52px;height:52px;border-radius:50%;text-align:center;line-height:48px;font-size:17px;font-weight:600;letter-spacing:-0.02em;box-shadow:0 2px 8px rgba(0,0,0,0.05);">${escapeHtml(guideInitials)}</div>
            </td>
            <td style="vertical-align:top;">
              <div class="text-primary" style="font-size:18px;font-weight:500;letter-spacing:-0.01em;line-height:1.3;padding-bottom:1px;">${escapeHtml(guideName)} <span class="text-label" style="font-size:13px;font-weight:400;letter-spacing:0.01em;">· On-Site Support</span></div>
              ${guidePhone ? `<div style="font-size:15px;padding-bottom:10px;">${phoneIconImg}<a href="tel:${escapeHtml(guidePhone)}" class="text-secondary link-underline" style="text-decoration:none;border-bottom:1px solid #e8e8ed;">${escapeHtml(guidePhone)}</a></div>` : ""}
            </td>
          </tr>
        </table>
        ${guideDescText ? `<div class="text-secondary" style="font-size:14px;font-weight:400;line-height:1.6;padding-top:10px;">${guideDescText}</div>` : ""}
      </td></tr>`
    : "";

  const notesBlock = notes
    ? `<tr><td colspan="2" style="padding-top:36px;">
        <div class="text-label" style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;padding-bottom:14px;">Notes</div>
        <div class="text-secondary" style="font-size:14px;font-weight:400;line-height:1.6;">${escapeHtml(notes)}</div>
      </td></tr>`
    : "";

  const rescheduleBox = hasRmContact
    ? `<tr><td colspan="2" style="padding-top:36px;">
        <table role="presentation" class="card-bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:#f8f8fc;border:1px solid #e8e8ed;border-radius:20px;">
          <tr><td style="padding:18px 22px;">
            <div class="text-secondary" style="font-size:14px;line-height:1.6;"><span class="text-primary" style="font-weight:500;">Need to reschedule?</span> Contact your Relationship Manager and we'll arrange a new slot at no cost.</div>
            <div style="padding-top:10px;">
              <span class="text-primary" style="font-size:13px;font-weight:500;">${escapeHtml(rmDisplayName)}</span>
              ${rmPhone ? `<span style="display:inline-block;width:3px;height:3px;background:#a1a1a8;border-radius:50%;vertical-align:middle;margin:0 6px;"></span>${phoneIconImg}<a href="tel:${escapeHtml(rmPhone)}" class="text-secondary link-underline" style="font-size:13px;text-decoration:none;border-bottom:1px solid #e8e8ed;padding-bottom:1px;">${escapeHtml(rmPhone)}</a>` : ""}
              ${rmEmail ? `<span style="display:inline-block;width:3px;height:3px;background:#a1a1a8;border-radius:50%;vertical-align:middle;margin:0 6px;"></span>${emailIconImg}<a href="mailto:${escapeHtml(rmEmail)}" class="text-secondary link-underline" style="font-size:13px;text-decoration:none;border-bottom:1px solid #e8e8ed;padding-bottom:1px;">${escapeHtml(rmEmail)}</a>` : ""}
            </div>
          </td></tr>
        </table>
      </td></tr>`
    : "";

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

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Medical Test Appointment – Keystone Business Solutions</title>
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
<body class="email-body" style="margin:0;padding:0;background-color:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#1d1d1f;-webkit-font-smoothing:antialiased;">
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

                    <tr>
                      <td class="border-subtle" style="padding-bottom:16px;border-bottom:1px solid #e8e8ed;" colspan="2">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                          <tr>
                            <td style="vertical-align:middle;width:48px;padding-right:12px;">${logoBlock}</td>
                            <td style="vertical-align:middle;">
                              <div class="text-primary" style="font-size:17px;font-weight:500;letter-spacing:-0.01em;line-height:1.3;">Keystone Business Solutions</div>
                              <div class="text-label" style="font-size:11px;font-weight:400;letter-spacing:0.02em;margin-top:1px;">Everything. In Order.</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <tr><td style="height:32px;font-size:0;line-height:0;" colspan="2">&nbsp;</td></tr>

                    <tr>
                      <td colspan="2">
                        <div class="company-name text-primary" style="font-size:30px;font-weight:500;letter-spacing:-0.015em;line-height:1.2;padding-bottom:6px;">${escapeHtml(companyName)}</div>
                        <div class="text-label" style="font-size:15px;font-weight:400;letter-spacing:0.02em;padding-bottom:28px;">Medical Test Appointment</div>
                      </td>
                    </tr>

                    <tr>
                      <td class="border-subtle" style="padding-bottom:28px;border-bottom:1px solid #e8e8ed;" colspan="2">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                          <tr>
                            <td style="vertical-align:middle;width:92px;padding-right:20px;">${avatarBlock}</td>
                            <td style="vertical-align:middle;">
                              <div class="applicant-name text-primary" style="font-size:26px;font-weight:500;letter-spacing:-0.01em;line-height:1.2;padding-bottom:3px;">${escapeHtml(applicantName)}</div>
                              <div class="text-label" style="font-size:13px;font-weight:400;">${applicantMetaHtml}</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <tr><td style="height:16px;font-size:0;line-height:0;" colspan="2">&nbsp;</td></tr>

                    <tr>
                      <td colspan="2">
                        <table role="presentation" class="card-bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:#f8f8fc;border:1px solid #e8e8ed;border-radius:20px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
                          <tr>
                            <td style="padding:18px 22px;" colspan="2">
                              <div class="text-label" style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;padding-bottom:4px;">Date &amp; Time</div>
                              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                                <tr>
                                  <td style="vertical-align:middle;">
                                    <div class="appt-datetime text-primary" style="font-size:19px;font-weight:600;letter-spacing:-0.01em;line-height:1.2;">${escapeHtml(dateStr)} &middot; ${escapeHtml(timeStr)}</div>
                                  </td>
                                  <td style="vertical-align:middle;text-align:right;white-space:nowrap;">
                                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;display:inline-table;">
                                      <tr>
                                        <td style="padding-left:10px;">${calendarGoogleSvg}</td>
                                        <td style="padding-left:10px;">${calendarAppleSvg}</td>
                                        <td style="padding-left:10px;">${calendarOutlookSvg}</td>
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
                              <div class="text-label" style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;padding-bottom:4px;">Location</div>
                              <div class="text-primary" style="font-size:15px;font-weight:500;letter-spacing:-0.01em;padding-bottom:2px;">${escapeHtml(centerName)}</div>
                              ${centerAddress ? `<div class="text-secondary" style="font-size:13px;line-height:1.6;padding-bottom:4px;">${escapeHtml(centerAddress)}</div>` : ""}
                              <a href="${escapeHtml(mapsUrl)}" class="link-primary" style="display:inline-block;font-size:13px;text-decoration:none;border-bottom:1px solid #e8e8ed;padding-bottom:2px;margin-top:4px;">View on Google Maps &#8599;</a>
                            </td>
                          </tr>
                          ${applicationNumberBlock}
                        </table>
                      </td>
                    </tr>

                    ${guideSection}

                    <tr>
                      <td style="padding-top:36px;" colspan="2">
                        <div class="text-label" style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;padding-bottom:14px;">Before You Go</div>
                        <table role="presentation" class="card-bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:#f8f8fc;border:1px solid #e8e8ed;border-radius:20px;">
                          <tr>
                            <td style="padding:20px 22px;">
                              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                                <tr>
                                  <td style="width:32px;vertical-align:top;padding-right:12px;padding-bottom:10px;">
                                    <img class="notice-icon-light" src="data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='12' cy='12' r='9' stroke='%231d1d1f' stroke-width='1.5'/%3E%3Cpath d='M12 7v5.5l3 2' stroke='%231d1d1f' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E" width="20" height="20" alt="" style="display:inline;opacity:0.5;margin-top:1px;" />
                                    <img class="notice-icon-dark" src="data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='12' cy='12' r='9' stroke='%23f5f5f7' stroke-width='1.5'/%3E%3Cpath d='M12 7v5.5l3 2' stroke='%23f5f5f7' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E" width="20" height="20" alt="" style="display:none;opacity:0.5;margin-top:1px;" />
                                  </td>
                                  <td class="notice-text text-primary" style="vertical-align:top;font-size:15px;font-weight:500;line-height:1.5;padding-bottom:10px;">Arrive at least 10 minutes before your appointment time.</td>
                                </tr>
                                <tr>
                                  <td style="width:32px;vertical-align:top;padding-right:12px;">
                                    <img class="notice-icon-light" src="data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='4' y='3' width='12' height='16' rx='2' stroke='%231d1d1f' stroke-width='1.5'/%3E%3Cpath d='M8 8h6M8 12h4' stroke='%231d1d1f' stroke-width='1.5' stroke-linecap='round'/%3E%3Cpath d='M16 8h2a2 2 0 012 2v9a2 2 0 01-2 2H8a2 2 0 01-2-2v-1' stroke='%231d1d1f' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E" width="20" height="20" alt="" style="display:inline;opacity:0.5;margin-top:1px;" />
                                    <img class="notice-icon-dark" src="data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='4' y='3' width='12' height='16' rx='2' stroke='%23f5f5f7' stroke-width='1.5'/%3E%3Cpath d='M8 8h6M8 12h4' stroke='%23f5f5f7' stroke-width='1.5' stroke-linecap='round'/%3E%3Cpath d='M16 8h2a2 2 0 012 2v9a2 2 0 01-2 2H8a2 2 0 01-2-2v-1' stroke='%23f5f5f7' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E" width="20" height="20" alt="" style="display:none;opacity:0.5;margin-top:1px;" />
                                  </td>
                                  <td class="notice-text text-primary" style="vertical-align:top;font-size:15px;font-weight:500;line-height:1.5;">Bring your original passport. No copies or digital versions accepted.</td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    ${notesBlock}

                    <tr>
                      <td colspan="2" style="padding-top:36px;">
                        <div class="text-label" style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;padding-bottom:14px;">After the Appointment</div>
                        <div class="text-secondary" style="font-size:14px;font-weight:400;line-height:1.6;">Results are shared within 24 hours. We handle everything that follows &mdash; no action needed on your end.</div>
                      </td>
                    </tr>

                    ${rescheduleBox}

                    ${cardLinkBlock}

                    <tr>
                      <td class="border-subtle" colspan="2" style="padding-top:28px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-top:1px solid #e8e8ed;">
                          <tr><td style="height:20px;font-size:0;line-height:0;">&nbsp;</td></tr>
                          <tr>
                            <td style="text-align:center;">
                              <div class="text-primary" style="font-size:13px;font-weight:500;letter-spacing:-0.005em;"><a href="https://www.procompany.ae" class="link-primary" style="text-decoration:none;">Keystone Business Solutions</a></div>
                              <div class="footer-divider-line" style="width:32px;height:1px;background:#e8e8ed;margin:6px auto;"></div>
                              <div class="text-secondary" style="font-size:11px;margin-bottom:4px;">Powered by <a href="https://www.procompany.ae" class="text-secondary" style="text-decoration:none;">Keystone Business Solutions</a></div>
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

import { useState, useEffect } from "react";

const lightTheme = {
  black: "#1d1d1f",
  grayDark: "#3a3a3c",
  grayMid: "#5e5e6a",
  grayLight: "#8e8e98",
  grayLighter: "#a1a1a8",
  bg: "#f5f5f7",
  white: "#ffffff",
  border: "#e8e8ed",
  card: "#f8f8fc",
  font: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif',
  avatarABg: "#dbeafe",
  avatarAFg: "#1d4ed8",
  avatarSBg: "#dcfce7",
  avatarSFg: "#15803d",
};

const darkTheme = {
  ...lightTheme,
  black: "#f5f5f7",
  grayDark: "#f5f5f7",
  grayMid: "#8e8e98",
  grayLight: "#636366",
  grayLighter: "#8e8e98",
  bg: "#000000",
  white: "#1c1c1e",
  border: "#2c2c2e",
  card: "#2c2c2e",
  avatarABg: "#1e3a8a",
  avatarAFg: "#93c5fd",
  avatarSBg: "#14532d",
  avatarSFg: "#86efac",
};

function usePrefersDark(): boolean {
  const [dark, setDark] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)").matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return dark;
}

function PhoneIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: "inline", verticalAlign: "middle", marginRight: 4, opacity: 0.5 }}>
      <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.61 21 3 13.39 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.58a1 1 0 01-.25 1.01l-2.2 2.2z" fill="currentColor" />
    </svg>
  );
}

function EmailIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: "inline", verticalAlign: "middle", marginRight: 3, opacity: 0.45 }}>
      <path d="M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" fill="currentColor" />
    </svg>
  );
}

function GoogleCalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 22, height: 22, display: "block", opacity: 0.65 }}>
      <rect x="3" y="4" width="18" height="17" rx="2" fill="white" stroke="#dadce0" />
      <rect x="3" y="4" width="18" height="5" rx="2" fill="#4285F4" />
      <rect x="3" y="7" width="18" height="2" fill="#4285F4" />
      <rect x="7" y="2" width="2" height="4" rx="1" fill="#4285F4" />
      <rect x="15" y="2" width="2" height="4" rx="1" fill="#4285F4" />
      <path d="M10 14.5L11.5 16L14.5 13" stroke="#34A853" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AppleCalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ width: 22, height: 22, display: "block", opacity: 0.65 }}>
      <rect x="3" y="4" width="18" height="17" rx="2.5" fill="white" stroke="#d1d1d6" strokeWidth="1" />
      <rect x="3" y="4" width="18" height="6" rx="2.5" fill="#ff3b30" />
      <rect x="3" y="8" width="18" height="2" fill="#ff3b30" />
      <rect x="7.5" y="2.5" width="1.5" height="3.5" rx="0.75" fill="#5e5e6a" />
      <rect x="15" y="2.5" width="1.5" height="3.5" rx="0.75" fill="#5e5e6a" />
    </svg>
  );
}

function OutlookCalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ width: 22, height: 22, display: "block", opacity: 0.65 }}>
      <rect x="9" y="3" width="13" height="13" rx="1.5" fill="#0078D4" />
      <rect x="9" y="3" width="13" height="4" rx="1.5" fill="#005fa3" />
      <rect x="9" y="5" width="13" height="2" fill="#005fa3" />
      <rect x="12" y="2" width="1.5" height="3" rx="0.75" fill="#0078D4" />
      <rect x="18" y="2" width="1.5" height="3" rx="0.75" fill="#0078D4" />
      <rect x="2" y="8" width="11" height="13" rx="1.5" fill="#1d1d1f" />
    </svg>
  );
}

function MetaDot({ color }: { color: string }) {
  return <span style={{ display: "inline-block", width: 3, height: 3, background: color, borderRadius: "50%", verticalAlign: "middle", margin: "0 6px" }} />;
}

export function MedicalAppointmentEmail(props: MedicalAppointmentEmailProps) {
  const {
    applicantName,
    companyName,
    appointmentType,
    dateStr,
    timeStr,
    centerName,
    centerAddress = "",
    mapsUrl = "#",
    applicationNumber = "",
    guideName = "",
    guidePhone = "",
    guideDescription = "",
    rmName = "",
    rmPhone = "",
    rmEmail = "",
    notes = "",
    applicantPhotoUrl,
    appLogoUrl,
    cardUrl = "",
  } = props;

  const isDark = usePrefersDark();
  const t = isDark ? darkTheme : lightTheme;
  const iconStroke = isDark ? "#f5f5f7" : "#1d1d1f";

  const initials = getInitials(applicantName);
  const guideInitials = guideName ? getInitials(guideName) : "";
  const hasRmContact = !!(rmName || rmPhone || rmEmail);
  const rmDisplayName = rmName || "Your Relationship Manager";

  const guideDescText = guideDescription ||
    (guideName ? `${guideName.split(" ")[0]} will meet your employee at the main entrance, bring all required documents, handle registration, and manage the queue. They simply need to be present.` : "");

  const cardBorderColor = isDark ? "#3a3a3c" : t.border;

  return (
    <div style={{ background: t.bg, fontFamily: t.font, fontSize: 15, lineHeight: 1.5, color: t.black, WebkitFontSmoothing: "antialiased", padding: "30px 20px" }} data-testid="email-wrapper">
      <div style={{ maxWidth: 720, margin: "0 auto", background: t.white, borderRadius: 28, overflow: "hidden", boxShadow: isDark ? "0 25px 50px -12px rgba(255,255,255,0.04)" : "0 25px 50px -12px rgba(0,0,0,0.08)" }}>
        <div style={{ padding: "56px 48px" }}>

          <div style={{ display: "flex", alignItems: "center", marginBottom: 32, paddingBottom: 16, borderBottom: `1px solid ${t.border}` }} data-testid="email-header">
            {appLogoUrl ? (
              <img src={appLogoUrl} alt="Logo" width={36} height={36} style={{ width: 36, height: 36, borderRadius: 8, marginRight: 12, flexShrink: 0 }} />
            ) : (
              <div style={{ width: 36, height: 36, borderRadius: 8, background: isDark ? "#f5f5f7" : "#1d1d1f", color: isDark ? "#1c1c1e" : "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 600, marginRight: 12, flexShrink: 0 }}>K</div>
            )}
            <div>
              <div style={{ fontSize: 17, fontWeight: 500, color: t.black, letterSpacing: "-0.01em", lineHeight: 1.3 }}>Keystone Business Solutions</div>
              <div style={{ fontSize: 11, fontWeight: 400, color: t.grayLight, letterSpacing: "0.02em" }}>Everything. In Order.</div>
            </div>
          </div>

          <div style={{ fontSize: 30, fontWeight: 500, letterSpacing: "-0.015em", color: t.black, marginBottom: 6, lineHeight: 1.2 }} data-testid="text-company-name">{companyName}</div>
          <div style={{ fontSize: 15, fontWeight: 400, color: t.grayLight, marginBottom: 28 }} data-testid="text-service-type">Medical Test Appointment</div>

          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 28, paddingBottom: 24, borderBottom: `1px solid ${t.border}` }} data-testid="applicant-row">
            {applicantPhotoUrl ? (
              <img src={applicantPhotoUrl} alt={applicantName} width={72} height={72} style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: `2px solid ${isDark ? t.white : "#ffffff"}`, boxShadow: "0 4px 14px rgba(0,0,0,0.07)", flexShrink: 0 }} />
            ) : (
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: t.avatarABg, color: t.avatarAFg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", flexShrink: 0, border: `2px solid ${isDark ? t.white : "#ffffff"}`, boxShadow: "0 4px 14px rgba(0,0,0,0.07)" }} data-testid="avatar-applicant">{initials}</div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 26, fontWeight: 500, color: t.black, marginBottom: 3, lineHeight: 1.2, letterSpacing: "-0.01em" }} data-testid="text-applicant-name">{applicantName}</div>
              <div style={{ fontSize: 13, color: t.grayLight, display: "flex", alignItems: "center" }} data-testid="text-applicant-meta">
                Applicant
                {appointmentType && <><MetaDot color={t.grayLighter} />{appointmentType}</>}
                {applicationNumber && <><MetaDot color={t.grayLighter} />{applicationNumber}</>}
              </div>
            </div>
          </div>

          <div style={{ background: t.card, border: `1px solid ${cardBorderColor}`, borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 0 }} data-testid="appointment-card">
            <div style={{ padding: "18px 22px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: t.grayLight, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 4 }}>Date &amp; Time</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" as const }}>
                <div style={{ fontSize: 19, fontWeight: 600, color: t.black, letterSpacing: "-0.01em" }} data-testid="text-datetime">{dateStr} · {timeStr}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }} data-testid="calendar-icons">
                  <span title="Google Calendar"><GoogleCalendarIcon /></span>
                  <span title="Apple Calendar"><AppleCalendarIcon /></span>
                  <span title="Outlook Calendar"><OutlookCalendarIcon /></span>
                </div>
              </div>
            </div>
            <div style={{ height: 1, background: isDark ? "#3a3a3c" : t.border }} />
            <div style={{ padding: "18px 22px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: t.grayLight, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 4 }}>Location</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: t.black, marginBottom: 2 }} data-testid="text-center-name">{centerName}</div>
              {centerAddress && <div style={{ fontSize: 13, color: t.grayMid, lineHeight: 1.6, marginBottom: 4 }} data-testid="text-center-address">{centerAddress}</div>}
              <a href={mapsUrl} style={{ display: "inline-block", fontSize: 13, color: t.black, textDecoration: "none", borderBottom: `1px solid ${t.border}`, paddingBottom: 2, marginTop: 4 }} data-testid="link-maps">View on Google Maps ↗</a>
            </div>
            {applicationNumber && (
              <>
                <div style={{ height: 1, background: isDark ? "#3a3a3c" : t.border }} />
                <div style={{ padding: "14px 22px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: t.grayLight, textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>Medical Application</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: t.grayMid, letterSpacing: "0.02em" }} data-testid="text-application-number">{applicationNumber}</div>
                </div>
              </>
            )}
          </div>

          {guideName && (
            <div style={{ marginTop: 36 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: t.grayLight, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 14 }}>Your On-Site Guide</div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: t.avatarSBg, color: t.avatarSFg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em", flexShrink: 0, border: `2px solid ${isDark ? t.white : "#ffffff"}`, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }} data-testid="avatar-guide">{guideInitials}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 18, fontWeight: 500, color: t.black, marginBottom: 1 }} data-testid="text-guide-name">{guideName} <span style={{ fontSize: 13, fontWeight: 400, color: t.grayLight, letterSpacing: "0.01em" }}>· On-Site Support</span></div>
                  {guidePhone && (
                    <div style={{ fontSize: 15 }} data-testid="text-guide-phone">
                      <PhoneIcon />
                      <a href={`tel:${guidePhone}`} style={{ color: t.grayMid, textDecoration: "none", borderBottom: `1px solid ${t.border}` }}>{guidePhone}</a>
                    </div>
                  )}
                </div>
              </div>
              {guideDescText && (
                <div style={{ fontSize: 14, color: t.grayMid, lineHeight: 1.6 }} data-testid="text-guide-description">{guideDescText}</div>
              )}
            </div>
          )}

          <div style={{ marginTop: 36 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: t.grayLight, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 14 }}>Before You Go</div>
            <div style={{ background: t.card, border: `1px solid ${cardBorderColor}`, borderRadius: 20, padding: "20px 22px", display: "flex", flexDirection: "column" as const, gap: 10 }} data-testid="notice-card">
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, fontSize: 15, fontWeight: 500, color: t.black, lineHeight: 1.5 }}>
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1, opacity: 0.5 }}>
                  <circle cx="12" cy="12" r="9" stroke={iconStroke} strokeWidth="1.5" />
                  <path d="M12 7v5.5l3 2" stroke={iconStroke} strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Arrive at least 10 minutes before your appointment time.
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, fontSize: 15, fontWeight: 500, color: t.black, lineHeight: 1.5 }}>
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1, opacity: 0.5 }}>
                  <rect x="4" y="3" width="12" height="16" rx="2" stroke={iconStroke} strokeWidth="1.5" />
                  <path d="M8 8h6M8 12h4" stroke={iconStroke} strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M16 8h2a2 2 0 012 2v9a2 2 0 01-2 2H8a2 2 0 01-2-2v-1" stroke={iconStroke} strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Bring your original passport. No copies or digital versions accepted.
              </div>
            </div>
          </div>

          {notes && (
            <div style={{ marginTop: 36 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: t.grayLight, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 14 }}>Notes</div>
              <div style={{ fontSize: 14, fontWeight: 400, color: t.grayMid, lineHeight: 1.6 }} data-testid="text-notes">{notes}</div>
            </div>
          )}

          <div style={{ marginTop: 36 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: t.grayLight, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 14 }}>After the Appointment</div>
            <div style={{ fontSize: 14, color: t.grayMid, lineHeight: 1.6 }} data-testid="text-after-appointment">Results are shared within 24 hours. We handle everything that follows — no action needed on your end.</div>
          </div>

          {hasRmContact && (
            <div style={{ background: t.card, borderRadius: 20, padding: "18px 22px", marginTop: 36, border: `1px solid ${cardBorderColor}` }} data-testid="reschedule-box">
              <div style={{ fontSize: 14, color: t.grayMid, lineHeight: 1.6 }}>
                <span style={{ fontWeight: 500, color: t.black }}>Need to reschedule?</span> Contact your Relationship Manager and we'll arrange a new slot at no cost.
              </div>
              <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap" as const, gap: "6px 16px", marginTop: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: t.black }} data-testid="text-rm-name">{rmDisplayName}</span>
                {rmPhone && (
                  <>
                    <MetaDot color={t.grayLighter} />
                    <a href={`tel:${rmPhone}`} style={{ fontSize: 13, color: t.grayMid, textDecoration: "none", borderBottom: `1px solid ${t.border}`, paddingBottom: 1 }} data-testid="text-rm-phone">
                      <PhoneIcon />{rmPhone}
                    </a>
                  </>
                )}
                {rmEmail && (
                  <>
                    <MetaDot color={t.grayLighter} />
                    <a href={`mailto:${rmEmail}`} style={{ fontSize: 13, color: t.grayMid, textDecoration: "none", borderBottom: `1px solid ${t.border}`, paddingBottom: 1 }} data-testid="text-rm-email">
                      <EmailIcon />{rmEmail}
                    </a>
                  </>
                )}
              </div>
            </div>
          )}

          {cardUrl && (
            <div style={{ background: "linear-gradient(135deg,#1d4ed8 0%,#3b82f6 100%)", borderRadius: 20, padding: "24px 28px", marginTop: 36, textAlign: "center" as const }} data-testid="card-link-block">
              <div style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.75)", letterSpacing: "0.03em", textTransform: "uppercase" as const, marginBottom: 8 }}>Your Appointment Card</div>
              <div style={{ fontSize: 15, fontWeight: 400, color: "rgba(255,255,255,0.85)", lineHeight: 1.5, marginBottom: 20 }}>Open your digital appointment card on any device. Add it to Apple Wallet for quick access.</div>
              <a href={cardUrl} style={{ display: "inline-block", background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.30)", color: "#ffffff", fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", textDecoration: "none", padding: "12px 28px", borderRadius: 12 }} data-testid="link-view-card">View Appointment Card ↗</a>
            </div>
          )}

          <div style={{ marginTop: 28, paddingTop: 20, borderTop: `1px solid ${t.border}`, textAlign: "center" as const }} data-testid="email-footer">
            <div style={{ fontSize: 13, fontWeight: 500, color: t.black, letterSpacing: "-0.005em" }}>
              <a href="https://www.procompany.ae" style={{ color: t.black, textDecoration: "none" }}>Keystone Business Solutions</a>
            </div>
            <div style={{ width: 32, height: 1, background: t.border, margin: "6px auto" }} />
            <div style={{ fontSize: 11, color: t.grayLighter, marginBottom: 4 }}>
              Powered by <a href="https://www.procompany.ae" style={{ color: t.grayLighter, textDecoration: "none" }}>Keystone Business Solutions</a>
            </div>
            <div style={{ fontSize: 10, color: t.grayLighter, letterSpacing: "0.01em" }}>© {new Date().getFullYear()} Keystone Business Solutions. All rights reserved.</div>
          </div>

        </div>
      </div>
    </div>
  );
}