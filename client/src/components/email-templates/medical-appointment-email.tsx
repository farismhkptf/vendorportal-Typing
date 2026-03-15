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
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join("");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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
    rmName = "",
    rmPhone = "",
    rmEmail = "",
    notes = "",
    applicantPhotoUrl,
    appLogoUrl,
  } = props;

  const initials = getInitials(applicantName);
  const guideInitials = guideName ? getInitials(guideName) : "";
  const rmInitials = rmName ? getInitials(rmName) : (rmEmail ? getInitials(rmEmail.split("@")[0]) : "RM");
  const hasRmContact = !!(rmName || rmPhone || rmEmail);
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

  const phoneIconImg = `<img src="data:image/svg+xml,%3Csvg width='11' height='11' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.61 21 3 13.39 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.58a1 1 0 01-.25 1.01l-2.2 2.2z' fill='%235e5e6a'/%3E%3C/svg%3E" width="11" height="11" style="vertical-align:middle;margin-right:4px;opacity:0.6;" alt="" />`;

  const emailIconImg = `<img src="data:image/svg+xml,%3Csvg width='11' height='11' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z' fill='%235e5e6a'/%3E%3C/svg%3E" width="11" height="11" style="vertical-align:middle;margin-right:4px;opacity:0.6;" alt="" />`;

  const guideSection = guideName
    ? `<tr><td style="padding-top:32px;" colspan="2">
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
                  ${guidePhone ? `<div class="text-secondary" style="font-size:13px;padding-bottom:9px;">${phoneIconImg}<a href="tel:${escapeHtml(guidePhone)}" class="text-secondary" style="text-decoration:none;border-bottom:1px solid #e8e8ed;">${escapeHtml(guidePhone)}</a></div>` : ""}
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
      contactLines.push(`<div class="text-secondary" style="font-size:13px;padding-bottom:9px;">${phoneIconImg}<a href="tel:${escapeHtml(rmPhone)}" class="text-secondary" style="text-decoration:none;border-bottom:1px solid #e8e8ed;">${escapeHtml(rmPhone)}</a></div>`);
    }
    if (rmEmail) {
      contactLines.push(`<div class="text-secondary" style="font-size:13px;padding-bottom:9px;">${emailIconImg}<a href="mailto:${escapeHtml(rmEmail)}" class="text-secondary" style="text-decoration:none;border-bottom:1px solid #e8e8ed;">${escapeHtml(rmEmail)}</a></div>`);
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

  const notesBlock = notes
    ? `<tr><td colspan="2" style="padding-top:32px;">
        <div class="text-label" style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;padding-bottom:14px;">Notes</div>
        <div class="text-secondary" style="font-size:13px;font-weight:400;line-height:1.65;">${escapeHtml(notes)}</div>
      </td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Your ${escapeHtml(appointmentType)} Test Appointment – Keystone Business Solutions</title>
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
<body class="email-body" style="margin:0;padding:0;background-color:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1d1d1f;-webkit-font-smoothing:antialiased;">
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
                    <tr>
                      <td class="border-subtle" style="padding-bottom:20px;border-bottom:1px solid #e8e8ed;" colspan="2">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                          <tr>
                            <td style="vertical-align:middle;width:43px;padding-right:11px;">${logoBlock}</td>
                            <td style="vertical-align:middle;">
                              <div class="text-primary" style="font-size:13px;font-weight:500;letter-spacing:-0.01em;line-height:1.35;">Keystone Business Solutions</div>
                              <div class="text-label" style="font-size:11px;font-weight:400;letter-spacing:0.04em;margin-top:2px;">Everything. In Order.</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr><td style="height:32px;font-size:0;line-height:0;" colspan="2">&nbsp;</td></tr>
                    <tr>
                      <td colspan="2">
                        <div class="company-name text-primary" style="font-size:26px;font-weight:600;letter-spacing:-0.03em;line-height:1.15;padding-bottom:6px;">${escapeHtml(companyName)}</div>
                        <div class="text-label" style="font-size:13px;font-weight:400;letter-spacing:0.02em;padding-bottom:24px;">Your ${escapeHtml(appointmentType)} Test Appointment</div>
                      </td>
                    </tr>
                    <tr>
                      <td class="border-subtle" style="padding-bottom:24px;border-bottom:1px solid #e8e8ed;" colspan="2">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                          <tr>
                            <td style="vertical-align:middle;width:72px;padding-right:16px;">${avatarBlock}</td>
                            <td style="vertical-align:middle;">
                              <div class="applicant-name text-primary" style="font-size:22px;font-weight:500;letter-spacing:-0.02em;line-height:1.2;padding-bottom:5px;">${escapeHtml(applicantName)}</div>
                              <div class="text-label" style="font-size:12px;font-weight:400;letter-spacing:0.01em;">Applicant</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr><td style="height:24px;font-size:0;line-height:0;" colspan="2">&nbsp;</td></tr>
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
                                  <td class="notice-text text-primary" style="vertical-align:top;font-size:13px;font-weight:500;line-height:1.55;padding-bottom:12px;">Arrive at least 10 minutes before your appointment time.</td>
                                </tr>
                                <tr>
                                  <td style="width:28px;vertical-align:top;padding-right:11px;">
                                    <img class="notice-icon-light" src="data:image/svg+xml,%3Csvg width='17' height='17' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='4' y='3' width='12' height='16' rx='2' stroke='%231d1d1f' stroke-width='1.5'/%3E%3Cpath d='M8 8h6M8 12h4' stroke='%231d1d1f' stroke-width='1.5' stroke-linecap='round'/%3E%3Cpath d='M16 8h2a2 2 0 012 2v9a2 2 0 01-2 2H8a2 2 0 01-2-2v-1' stroke='%231d1d1f' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E" width="17" height="17" alt="" style="display:inline;opacity:0.4;margin-top:2px;" />
                                    <img class="notice-icon-dark" src="data:image/svg+xml,%3Csvg width='17' height='17' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='4' y='3' width='12' height='16' rx='2' stroke='%23f5f5f7' stroke-width='1.5'/%3E%3Cpath d='M8 8h6M8 12h4' stroke='%23f5f5f7' stroke-width='1.5' stroke-linecap='round'/%3E%3Cpath d='M16 8h2a2 2 0 012 2v9a2 2 0 01-2 2H8a2 2 0 01-2-2v-1' stroke='%23f5f5f7' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E" width="17" height="17" alt="" style="display:none;opacity:0.4;margin-top:2px;" />
                                  </td>
                                  <td class="notice-text text-primary" style="vertical-align:top;font-size:13px;font-weight:500;line-height:1.55;">Bring your original passport. No copies or digital versions accepted.</td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    ${notesBlock}
                    <tr>
                      <td colspan="2" style="padding-top:32px;">
                        <div class="hr-note-text" style="font-size:13px;font-weight:400;color:#8e8e98;line-height:1.6;text-align:center;">For any questions, please contact your HR team.</div>
                      </td>
                    </tr>
                    <tr>
                      <td class="border-subtle" colspan="2" style="padding-top:32px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-top:1px solid #e8e8ed;">
                          <tr><td style="height:20px;font-size:0;line-height:0;">&nbsp;</td></tr>
                          <tr>
                            <td style="text-align:center;">
                              <div class="text-primary" style="font-size:12px;font-weight:500;letter-spacing:-0.01em;"><a href="https://www.procompany.ae" class="link-primary" style="text-decoration:none;">Keystone Business Solutions</a></div>
                              <div class="footer-divider-line" style="width:24px;height:1px;background:#e8e8ed;margin:7px auto;"></div>
                              <div class="text-secondary" style="font-size:10px;margin-bottom:3px;">Powered by <a href="https://www.procompany.ae" class="text-secondary" style="text-decoration:none;">Keystone Business Solutions</a></div>
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

function PhoneIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: "inline", verticalAlign: "middle", marginRight: 4, opacity: 0.4 }}>
      <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.61 21 3 13.39 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.58a1 1 0 01-.25 1.01l-2.2 2.2z" fill="currentColor" />
    </svg>
  );
}

function EmailIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: "inline", verticalAlign: "middle", marginRight: 4, opacity: 0.4 }}>
      <path d="M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" fill="currentColor" />
    </svg>
  );
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
    rmName = "",
    rmPhone = "",
    rmEmail = "",
    notes = "",
    applicantPhotoUrl,
    appLogoUrl,
  } = props;

  const isDark = usePrefersDark();
  const t = isDark ? darkTheme : lightTheme;
  const iconStroke = isDark ? "#f5f5f7" : "#1d1d1f";
  const avatarBorder = isDark ? "#1c1c1e" : "#ffffff";
  const emailShadow = isDark ? "0 20px 48px -8px rgba(0,0,0,0.5)" : "0 20px 48px -8px rgba(0,0,0,0.10)";
  const cardBorderColor = isDark ? "#3a3a3c" : t.border;
  const dividerBg = isDark ? "#3a3a3c" : t.border;

  const hasRmContact = !!(rmName || rmPhone || rmEmail);
  const rmDisplayName = rmName || "Your Relationship Manager";
  const initials = getInitials(applicantName);
  const guideInitials = guideName ? getInitials(guideName) : "";
  const rmInitials = rmName ? getInitials(rmName) : (rmEmail ? getInitials(rmEmail.split("@")[0]) : "RM");

  return (
    <div style={{ backgroundColor: t.bg, fontFamily: t.font, fontSize: 15, lineHeight: 1.6, color: t.black, WebkitFontSmoothing: "antialiased", padding: "32px 20px" }} data-testid="medical-email-preview">
      <div style={{ maxWidth: 580, margin: "0 auto", background: t.white, borderRadius: 24, boxShadow: emailShadow, overflow: "hidden" }}>
        <div style={{ padding: "44px 40px 44px" }}>

          <div style={{ display: "flex", alignItems: "center", paddingBottom: 20, marginBottom: 32, borderBottom: `1px solid ${t.border}` }} data-testid="email-header">
            {appLogoUrl ? (
              <img src={appLogoUrl} alt="Logo" style={{ width: 32, height: 32, borderRadius: 7, flexShrink: 0, marginRight: 11 }} />
            ) : (
              <div style={{ width: 32, height: 32, background: isDark ? "#f5f5f7" : "#1d1d1f", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", color: isDark ? "#1c1c1e" : "#ffffff", fontSize: 14, fontWeight: 600, letterSpacing: "-0.02em", flexShrink: 0, marginRight: 11 }}>K</div>
            )}
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: t.black, letterSpacing: "-0.01em", lineHeight: 1.35 }}>Keystone Business Solutions</div>
              <div style={{ fontSize: 11, fontWeight: 400, color: t.grayLight, letterSpacing: "0.04em", marginTop: 2 }}>Everything. In Order.</div>
            </div>
          </div>

          <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.15, color: t.black, marginBottom: 6 }} data-testid="text-company-name">{companyName}</div>
          <div style={{ fontSize: 13, fontWeight: 400, color: t.grayLight, letterSpacing: "0.02em", marginBottom: 24 }} data-testid="text-service-type">Your {appointmentType} Test Appointment</div>

          <div style={{ display: "flex", alignItems: "center", gap: 16, paddingBottom: 24, marginBottom: 24, borderBottom: `1px solid ${t.border}` }} data-testid="applicant-row">
            {applicantPhotoUrl ? (
              <img src={applicantPhotoUrl} alt={applicantName} style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: `2px solid ${avatarBorder}`, boxShadow: "0 3px 12px rgba(0,0,0,0.08)" }} />
            ) : (
              <div style={{ width: 56, height: 56, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em", flexShrink: 0, border: `2px solid ${avatarBorder}`, boxShadow: "0 3px 12px rgba(0,0,0,0.08)", background: t.avatarABg, color: t.avatarAFg }} data-testid="avatar-applicant">{initials}</div>
            )}
            <div>
              <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.2, color: t.black, marginBottom: 5 }} data-testid="text-applicant-name">{applicantName}</div>
              <div style={{ fontSize: 12, fontWeight: 400, color: t.grayLight, letterSpacing: "0.01em" }}>Applicant</div>
            </div>
          </div>

          <div style={{ background: t.card, border: `1px solid ${cardBorderColor}`, borderRadius: 16, overflow: "hidden", marginBottom: 10, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }} data-testid="appointment-card">
            <div style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: t.grayLight, textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: 5 }}>Date & Time</div>
              <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.2, color: t.black }} data-testid="text-datetime">{dateStr} &nbsp;·&nbsp; {timeStr}</div>
            </div>
            <div style={{ height: 1, background: dividerBg }} />
            <div style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: t.grayLight, textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: 5 }}>Location</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: t.black, letterSpacing: "-0.01em", marginBottom: 3 }} data-testid="text-center-name">{centerName}</div>
              {centerAddress && <div style={{ fontSize: 13, color: t.grayMid, lineHeight: 1.5, marginBottom: 8 }} data-testid="text-center-address">{centerAddress}</div>}
              <a href={mapsUrl} style={{ display: "inline-block", fontSize: 12, color: t.black, textDecoration: "none", borderBottom: `1px solid ${cardBorderColor}`, paddingBottom: 1 }} data-testid="link-maps">View on Google Maps ↗</a>
            </div>
            {applicationNumber && (
              <>
                <div style={{ height: 1, background: dividerBg }} />
                <div style={{ padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: t.grayLight, textTransform: "uppercase" as const, letterSpacing: "0.1em" }}>{appointmentType} Application</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: t.grayMid, letterSpacing: "0.04em" }} data-testid="text-application-number">{applicationNumber}</div>
                </div>
              </>
            )}
          </div>

          {guideName && (
            <>
              <div style={{ fontSize: 10, fontWeight: 600, color: t.grayLight, textTransform: "uppercase" as const, letterSpacing: "0.1em", marginTop: 32, marginBottom: 14 }}>Your On-Site Guide</div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 13 }} data-testid="guide-row">
                <div style={{ width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, letterSpacing: "-0.02em", flexShrink: 0, background: t.avatarSBg, color: t.avatarSFg, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: `2px solid ${avatarBorder}` }} data-testid="avatar-guide">{guideInitials}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 500, color: t.black, letterSpacing: "-0.01em", lineHeight: 1.3, marginBottom: 4 }} data-testid="text-guide-name">
                    {guideName} <span style={{ fontSize: 12, fontWeight: 400, color: t.grayLight }}>· On-Site Support</span>
                  </div>
                  {guidePhone && (
                    <div style={{ fontSize: 13, color: t.grayMid, marginBottom: 9 }} data-testid="text-guide-phone">
                      <PhoneIcon />
                      <a href={`tel:${guidePhone}`} style={{ color: t.grayMid, textDecoration: "none", borderBottom: `1px solid ${t.border}` }}>{guidePhone}</a>
                    </div>
                  )}
                  <div style={{ fontSize: 13, fontWeight: 400, color: t.grayMid, lineHeight: 1.65 }}>On-site to assist you throughout.</div>
                </div>
              </div>
            </>
          )}

          {guideName && hasRmContact && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 13, marginTop: 16 }} data-testid="crm-contact-row">
              <div style={{ width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, letterSpacing: "-0.02em", flexShrink: 0, background: t.avatarABg, color: t.avatarAFg, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: `2px solid ${avatarBorder}` }} data-testid="avatar-crm">{rmInitials}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: t.black, letterSpacing: "-0.01em", lineHeight: 1.3, marginBottom: 4 }} data-testid="text-rm-name">
                  {rmDisplayName} <span style={{ fontSize: 12, fontWeight: 400, color: t.grayLight }}>· Relationship Manager</span>
                </div>
                {rmPhone && (
                  <div style={{ fontSize: 13, color: t.grayMid, marginBottom: 9 }} data-testid="text-rm-phone">
                    <PhoneIcon />
                    <a href={`tel:${rmPhone}`} style={{ color: t.grayMid, textDecoration: "none", borderBottom: `1px solid ${t.border}` }}>{rmPhone}</a>
                  </div>
                )}
                {rmEmail && (
                  <div style={{ fontSize: 13, color: t.grayMid, marginBottom: 9 }} data-testid="text-rm-email">
                    <EmailIcon />
                    <a href={`mailto:${rmEmail}`} style={{ color: t.grayMid, textDecoration: "none", borderBottom: `1px solid ${t.border}` }}>{rmEmail}</a>
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ fontSize: 10, fontWeight: 600, color: t.grayLight, textTransform: "uppercase" as const, letterSpacing: "0.1em", marginTop: 32, marginBottom: 14 }}>Before You Go</div>
          <div style={{ background: t.card, border: `1px solid ${cardBorderColor}`, borderRadius: 16, padding: "16px 20px", display: "flex", flexDirection: "column" as const, gap: 12 }} data-testid="notice-card">
            <div style={{ display: "flex", alignItems: "flex-start", gap: 11, fontSize: 13, fontWeight: 500, color: t.black, lineHeight: 1.55 }}>
              <svg width={17} height={17} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 2, opacity: 0.4 }}>
                <circle cx="12" cy="12" r="9" stroke={iconStroke} strokeWidth="1.5" />
                <path d="M12 7v5.5l3 2" stroke={iconStroke} strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Arrive at least 10 minutes before your appointment time.
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 11, fontSize: 13, fontWeight: 500, color: t.black, lineHeight: 1.55 }}>
              <svg width={17} height={17} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 2, opacity: 0.4 }}>
                <rect x="4" y="3" width="12" height="16" rx="2" stroke={iconStroke} strokeWidth="1.5" />
                <path d="M8 8h6M8 12h4" stroke={iconStroke} strokeWidth="1.5" strokeLinecap="round" />
                <path d="M16 8h2a2 2 0 012 2v9a2 2 0 01-2 2H8a2 2 0 01-2-2v-1" stroke={iconStroke} strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Bring your original passport. No copies or digital versions accepted.
            </div>
          </div>

          {notes && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: t.grayLight, textTransform: "uppercase" as const, letterSpacing: "0.1em", marginTop: 32, marginBottom: 14 }}>Notes</div>
              <div style={{ fontSize: 13, fontWeight: 400, color: t.grayMid, lineHeight: 1.65 }} data-testid="text-notes">{notes}</div>
            </div>
          )}

          <div style={{ fontSize: 13, fontWeight: 400, color: isDark ? "#636366" : t.grayLight, lineHeight: 1.6, marginTop: 32, textAlign: "center" as const }}>For any questions, please contact your HR team.</div>

          <div style={{ marginTop: 32, paddingTop: 20, borderTop: `1px solid ${t.border}`, textAlign: "center" as const }} data-testid="email-footer">
            <div style={{ fontSize: 12, fontWeight: 500, color: t.black, letterSpacing: "-0.01em" }}>
              <a href="https://www.procompany.ae" style={{ color: t.black, textDecoration: "none" }}>Keystone Business Solutions</a>
            </div>
            <div style={{ width: 24, height: 1, background: t.border, margin: "7px auto" }} />
            <div style={{ fontSize: 10, color: t.grayLighter, marginBottom: 3 }}>
              Powered by <a href="https://www.procompany.ae" style={{ color: t.grayLighter, textDecoration: "none" }}>Keystone Business Solutions</a>
            </div>
            <div style={{ fontSize: 10, color: t.grayLighter, letterSpacing: "0.01em" }}>© {new Date().getFullYear()} Keystone Business Solutions. All rights reserved.</div>
          </div>

        </div>
      </div>
    </div>
  );
}
