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

export function buildAppointmentEmail(data: AppointmentEmailData): string {
  const {
    workOrder,
    company,
    appointment,
    center,
    assignedStaff,
    rmStaff,
    rmUserEmail,
    applicantPhotoUrl,
    appLogoUrl,
  } = data;

  const applicantName = workOrder?.applicantName ?? "—";
  const companyName = company?.name ?? "—";
  const appointmentType = appointment.type ?? "Medical";
  const emailTitle = `Your ${appointmentType} Test Appointment – Keystone Business Solutions`;

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
  const rmInitials = rmName ? getInitials(rmName) : (rmEmail ? getInitials(rmEmail.split("@")[0]) : "RM");
  const rmDisplayName = rmName || "Your Relationship Manager";

  const logoBlock = appLogoUrl
    ? `<img src="${escapeHtml(appLogoUrl)}" alt="Logo" width="32" height="32" style="width:32px;height:32px;border-radius:7px;display:block;" />`
    : `<div class="logo-mark" style="width:32px;height:32px;border-radius:7px;text-align:center;line-height:32px;font-size:14px;font-weight:600;letter-spacing:-0.02em;">K</div>`;

  const avatarBlock = applicantPhotoUrl
    ? `<img src="${escapeHtml(applicantPhotoUrl)}" alt="${escapeHtml(applicantName)}" width="56" height="56" style="width:56px;height:56px;border-radius:50%;display:block;object-fit:cover;" class="avatar-photo" />`
    : `<div class="avatar-applicant" style="width:56px;height:56px;border-radius:50%;text-align:center;line-height:52px;font-size:17px;font-weight:700;letter-spacing:-0.02em;">${escapeHtml(initials)}</div>`;

  const applicationNumberBlock = applicationNumber
    ? `<tr><td class="card-divider" style="height:1px;font-size:0;line-height:0;" colspan="2">&nbsp;</td></tr>
       <tr>
         <td class="text-label" style="padding:12px 20px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;">${escapeHtml(appointmentType)} Application</td>
         <td class="text-secondary" style="padding:12px 20px;font-size:12px;font-weight:500;letter-spacing:0.04em;text-align:right;">${escapeHtml(applicationNumber)}</td>
       </tr>`
    : "";

  const phoneIconSvg = `<img src="data:image/svg+xml,%3Csvg width='11' height='11' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.61 21 3 13.39 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.58a1 1 0 01-.25 1.01l-2.2 2.2z' fill='%235e5e6a'/%3E%3C/svg%3E" width="11" height="11" style="vertical-align:middle;margin-right:4px;opacity:0.6;" alt="" />`;

  const emailIconSvg = `<img src="data:image/svg+xml,%3Csvg width='11' height='11' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z' fill='%235e5e6a'/%3E%3C/svg%3E" width="11" height="11" style="vertical-align:middle;margin-right:4px;opacity:0.6;" alt="" />`;

  const guideSection = guideName
    ? `<tr><td style="padding-top:32px;padding-bottom:0;" colspan="2">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">
          <tr><td class="text-label" style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;padding-bottom:14px;">Your On-Site Guide</td></tr>
          <tr><td>
            <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">
              <tr>
                <td style="vertical-align:top;width:44px;padding-right:13px;">
                  <div class="avatar-guide" style="width:44px;height:44px;border-radius:50%;text-align:center;line-height:40px;font-size:13px;font-weight:700;letter-spacing:-0.02em;">${escapeHtml(guideInitials)}</div>
                </td>
                <td style="vertical-align:top;">
                  <div class="text-primary" style="font-size:15px;font-weight:500;letter-spacing:-0.01em;line-height:1.3;padding-bottom:4px;">${escapeHtml(guideName)} <span class="text-label" style="font-size:12px;font-weight:400;">&middot; On-Site Support</span></div>
                  ${guidePhone ? `<div class="text-secondary" style="font-size:13px;padding-bottom:9px;">${phoneIconSvg}<a href="tel:${escapeHtml(guidePhone)}" class="text-secondary" style="text-decoration:none;border-bottom:1px solid #e8e8ed;">${escapeHtml(guidePhone)}</a></div>` : ""}
                  <div class="text-secondary" style="font-size:13px;font-weight:400;line-height:1.65;">On-site to assist you throughout.</div>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </td></tr>`
    : "";

  const crmContactSection = (() => {
    if (!guideName || !hasRmContact) return "";
    const contactLines: string[] = [];
    if (rmPhone) {
      contactLines.push(`<div class="text-secondary" style="font-size:13px;padding-bottom:9px;">${phoneIconSvg}<a href="tel:${escapeHtml(rmPhone)}" class="text-secondary" style="text-decoration:none;border-bottom:1px solid #e8e8ed;">${escapeHtml(rmPhone)}</a></div>`);
    }
    if (rmEmail) {
      contactLines.push(`<div class="text-secondary" style="font-size:13px;padding-bottom:9px;">${emailIconSvg}<a href="mailto:${escapeHtml(rmEmail)}" class="text-secondary" style="text-decoration:none;border-bottom:1px solid #e8e8ed;">${escapeHtml(rmEmail)}</a></div>`);
    }
    return `<tr><td style="padding-top:16px;" colspan="2">
        <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">
          <tr>
            <td style="vertical-align:top;width:44px;padding-right:13px;">
              <div class="avatar-crm" style="width:44px;height:44px;border-radius:50%;text-align:center;line-height:40px;font-size:13px;font-weight:700;letter-spacing:-0.02em;">${escapeHtml(rmInitials)}</div>
            </td>
            <td style="vertical-align:top;">
              <div class="text-primary" style="font-size:15px;font-weight:500;letter-spacing:-0.01em;line-height:1.3;padding-bottom:4px;">${escapeHtml(rmDisplayName)} <span class="text-label" style="font-size:12px;font-weight:400;">&middot; Relationship Manager</span></div>
              ${contactLines.join("\n              ")}
            </td>
          </tr>
        </table>
      </td></tr>`;
  })();

  const notesBlock = appointment.notes
    ? `<tr><td colspan="2" style="padding-top:32px;">
        <div class="text-label" style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;padding-bottom:14px;">Notes</div>
        <div class="text-secondary" style="font-size:13px;font-weight:400;line-height:1.65;">${escapeHtml(appointment.notes)}</div>
      </td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>${escapeHtml(emailTitle)}</title>
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
    .avatar-crm { background:#dbeafe; color:#1d4ed8; border:2px solid #ffffff; }
    .avatar-photo { border:2px solid #ffffff; }
    .text-primary { color:#1d1d1f; }
    .text-secondary { color:#5e5e6a; }
    .text-label { color:#8e8e98; }
    .card-bg { background:#f8f8fc; border-color:#e8e8ed; }
    .card-divider { background:#e8e8ed; }
    .link-primary { color:#1d1d1f; border-color:#e8e8ed; }
    .notice-icon-light { display:inline !important; }
    .notice-icon-dark { display:none !important; }
    @media only screen and (max-width: 520px) {
        .email-container { width: 100% !important; }
        .email-content { padding: 32px 24px 36px !important; }
        .company-name { font-size: 22px !important; }
        .applicant-name { font-size: 19px !important; }
        .appt-datetime { font-size: 17px !important; }
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
        .avatar-applicant { background: #1e3a8a !important; color: #93c5fd !important; border-color: #1c1c1e !important; }
        .avatar-guide { background: #14532d !important; color: #86efac !important; border-color: #1c1c1e !important; }
        .avatar-crm { background: #1e3a8a !important; color: #93c5fd !important; border-color: #1c1c1e !important; }
        .avatar-photo { border-color: #1c1c1e !important; }
        .footer-divider-line { background: #2c2c2e !important; }
        .hr-note-text { color: #636366 !important; }
        .notice-text { color: #f5f5f7 !important; }
        .notice-icon-light { display: none !important; }
        .notice-icon-dark { display: inline !important; }
    }
    </style>
</head>
<body class="email-body" style="margin:0;padding:0;background-color:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1d1d1f;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
  <tr>
    <td style="padding:32px 20px;" align="center">
      <table role="presentation" class="email-container" width="580" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;max-width:580px;width:100%;">
        <tr>
          <td class="email-shell" style="background:#ffffff;border-radius:24px;overflow:hidden;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
              <tr>
                <td class="email-content" style="padding:44px 40px 44px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">

                    <!-- HEADER -->
                    <tr>
                      <td class="border-subtle" style="padding-bottom:20px;border-bottom:1px solid #e8e8ed;" colspan="2">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                          <tr>
                            <td style="vertical-align:middle;width:43px;padding-right:11px;">
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
                        <div class="company-name text-primary" style="font-size:26px;font-weight:600;letter-spacing:-0.03em;line-height:1.15;padding-bottom:6px;">${escapeHtml(companyName)}</div>
                        <div class="text-label" style="font-size:13px;font-weight:400;letter-spacing:0.02em;padding-bottom:24px;">Your ${escapeHtml(appointmentType)} Test Appointment</div>
                      </td>
                    </tr>

                    <!-- APPLICANT -->
                    <tr>
                      <td class="border-subtle" style="padding-bottom:24px;border-bottom:1px solid #e8e8ed;" colspan="2">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                          <tr>
                            <td style="vertical-align:middle;width:72px;padding-right:16px;">
                              ${avatarBlock}
                            </td>
                            <td style="vertical-align:middle;">
                              <div class="applicant-name text-primary" style="font-size:22px;font-weight:500;letter-spacing:-0.02em;line-height:1.2;padding-bottom:5px;">${escapeHtml(applicantName)}</div>
                              <div class="text-label" style="font-size:12px;font-weight:400;letter-spacing:0.01em;">Applicant</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <tr><td style="height:24px;font-size:0;line-height:0;" colspan="2">&nbsp;</td></tr>

                    <!-- APPOINTMENT CARD -->
                    <tr>
                      <td colspan="2">
                        <table role="presentation" class="card-bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:#f8f8fc;border:1px solid #e8e8ed;border-radius:16px;overflow:hidden;">
                          <tr>
                            <td style="padding:16px 20px;" colspan="2">
                              <div class="text-label" style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;padding-bottom:5px;">Date &amp; Time</div>
                              <div class="appt-datetime text-primary" style="font-size:20px;font-weight:600;letter-spacing:-0.025em;line-height:1.2;">${escapeHtml(dateStr)} &nbsp;&middot;&nbsp; ${escapeHtml(timeStr)}</div>
                            </td>
                          </tr>
                          <tr><td class="card-divider" style="height:1px;font-size:0;line-height:0;" colspan="2">&nbsp;</td></tr>
                          <tr>
                            <td style="padding:16px 20px;" colspan="2">
                              <div class="text-label" style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;padding-bottom:5px;">Location</div>
                              <div class="text-primary" style="font-size:14px;font-weight:500;letter-spacing:-0.01em;padding-bottom:3px;">${escapeHtml(centerName)}</div>
                              ${centerAddress ? `<div class="text-secondary" style="font-size:13px;line-height:1.5;padding-bottom:8px;">${escapeHtml(centerAddress)}</div>` : ""}
                              <a href="${escapeHtml(mapsUrl)}" class="link-primary" style="display:inline-block;font-size:12px;text-decoration:none;border-bottom:1px solid #e8e8ed;padding-bottom:1px;">View on Google Maps &#8599;</a>
                            </td>
                          </tr>
                          ${applicationNumberBlock}
                        </table>
                      </td>
                    </tr>

                    ${guideSection}

                    ${crmContactSection}

                    <!-- BEFORE YOU GO -->
                    <tr>
                      <td style="padding-top:32px;" colspan="2">
                        <div class="text-label" style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;padding-bottom:14px;">Before You Go</div>
                        <table role="presentation" class="card-bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:#f8f8fc;border:1px solid #e8e8ed;border-radius:16px;">
                          <tr>
                            <td style="padding:16px 20px;">
                              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                                <tr>
                                  <td style="width:28px;vertical-align:top;padding-right:11px;padding-bottom:12px;">
                                    <img class="notice-icon-light" src="data:image/svg+xml,%3Csvg width='17' height='17' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='12' cy='12' r='9' stroke='%231d1d1f' stroke-width='1.5'/%3E%3Cpath d='M12 7v5.5l3 2' stroke='%231d1d1f' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E" width="17" height="17" alt="" style="display:inline;opacity:0.4;margin-top:2px;" />
                                    <img class="notice-icon-dark" src="data:image/svg+xml,%3Csvg width='17' height='17' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='12' cy='12' r='9' stroke='%23f5f5f7' stroke-width='1.5'/%3E%3Cpath d='M12 7v5.5l3 2' stroke='%23f5f5f7' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E" width="17" height="17" alt="" style="display:none;opacity:0.4;margin-top:2px;" />
                                  </td>
                                  <td class="notice-text text-primary" style="vertical-align:top;font-size:13px;font-weight:500;line-height:1.55;padding-bottom:12px;">
                                    Arrive at least 10 minutes before your appointment time.
                                  </td>
                                </tr>
                                <tr>
                                  <td style="width:28px;vertical-align:top;padding-right:11px;">
                                    <img class="notice-icon-light" src="data:image/svg+xml,%3Csvg width='17' height='17' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='4' y='3' width='12' height='16' rx='2' stroke='%231d1d1f' stroke-width='1.5'/%3E%3Cpath d='M8 8h6M8 12h4' stroke='%231d1d1f' stroke-width='1.5' stroke-linecap='round'/%3E%3Cpath d='M16 8h2a2 2 0 012 2v9a2 2 0 01-2 2H8a2 2 0 01-2-2v-1' stroke='%231d1d1f' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E" width="17" height="17" alt="" style="display:inline;opacity:0.4;margin-top:2px;" />
                                    <img class="notice-icon-dark" src="data:image/svg+xml,%3Csvg width='17' height='17' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='4' y='3' width='12' height='16' rx='2' stroke='%23f5f5f7' stroke-width='1.5'/%3E%3Cpath d='M8 8h6M8 12h4' stroke='%23f5f5f7' stroke-width='1.5' stroke-linecap='round'/%3E%3Cpath d='M16 8h2a2 2 0 012 2v9a2 2 0 01-2 2H8a2 2 0 01-2-2v-1' stroke='%23f5f5f7' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E" width="17" height="17" alt="" style="display:none;opacity:0.4;margin-top:2px;" />
                                  </td>
                                  <td class="notice-text text-primary" style="vertical-align:top;font-size:13px;font-weight:500;line-height:1.55;">
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

                    <!-- HR NOTE -->
                    <tr>
                      <td colspan="2" style="padding-top:32px;">
                        <div class="hr-note-text" style="font-size:13px;font-weight:400;color:#8e8e98;line-height:1.6;text-align:center;">For any questions, please contact your HR team.</div>
                      </td>
                    </tr>

                    <!-- FOOTER -->
                    <tr>
                      <td class="border-subtle" colspan="2" style="padding-top:32px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-top:1px solid #e8e8ed;">
                          <tr><td style="height:20px;font-size:0;line-height:0;">&nbsp;</td></tr>
                          <tr>
                            <td style="text-align:center;">
                              <div class="text-primary" style="font-size:12px;font-weight:500;letter-spacing:-0.01em;">
                                <a href="https://www.procompany.ae" class="link-primary" style="text-decoration:none;">Keystone Business Solutions</a>
                              </div>
                              <div class="footer-divider-line" style="width:24px;height:1px;background:#e8e8ed;margin:7px auto;"></div>
                              <div class="text-secondary" style="font-size:10px;margin-bottom:3px;">
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
