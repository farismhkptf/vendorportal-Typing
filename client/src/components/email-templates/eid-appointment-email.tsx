import { MapPin, User, CreditCard } from "lucide-react";
import logoPath from "../../assets/logos/logo-main.png";

const BRAND = {
  primary: "#2d5a87",
  primaryDark: "#1e3f61",
  primaryLight: "#e8f0f8",
  accent: "#0e7490",
  accentLight: "#ecfeff",
  text: "#1a1a2e",
  textMuted: "#64748b",
  border: "#e2e8f0",
  white: "#ffffff",
  bg: "#f8fafc",
};

interface EidAppointmentEmailProps {
  woNumber: string;
  companyName: string;
  applicantName: string;
  serviceType: string;
  centerName: string;
  centerAddress?: string;
  centerType: "Normal" | "VIP";
  appointmentDate: string;
  appointmentTime: string;
  applicationNumber?: string;
  assistName?: string;
  assistPhone?: string;
  crmName?: string;
  crmPhone?: string;
  notes?: string;
}

export function EidAppointmentEmail({
  woNumber,
  companyName,
  applicantName,
  serviceType,
  centerName,
  centerAddress,
  centerType,
  appointmentDate,
  appointmentTime,
  applicationNumber,
  assistName,
  assistPhone,
  crmName,
  crmPhone,
  notes,
}: EidAppointmentEmailProps) {
  const googleMapsUrl = centerAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(centerAddress)}`
    : null;

  return (
    <div style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif", background: BRAND.bg, maxWidth: 620 }}>
      <div style={{ background: BRAND.primary, padding: "20px 24px", display: "flex", alignItems: "center", gap: 14 }}>
        <img src={logoPath} alt="Logo" style={{ width: 44, height: 44, borderRadius: 8, background: "rgba(255,255,255,0.15)", padding: 4 }} />
        <div style={{ color: BRAND.white, fontWeight: 700, fontSize: 18, letterSpacing: -0.3 }}>The P.R.O. Company</div>
      </div>

      <div style={{ padding: "24px" }}>
        <div style={{ background: BRAND.accentLight, border: `1px solid ${BRAND.accent}33`, borderRadius: 10, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: `${BRAND.accent}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CreditCard style={{ width: 22, height: 22, color: BRAND.accent }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, color: BRAND.text, fontSize: 17 }}>Emirates ID Appointment</div>
            <div style={{ color: BRAND.textMuted, fontSize: 12, marginTop: 2 }}>Ref: {woNumber}</div>
          </div>
        </div>

        <p style={{ color: BRAND.text, fontSize: 14, margin: "0 0 6px 0" }}>Dear <strong>Team</strong>,</p>
        <p style={{ color: "#475569", fontSize: 13, margin: "0 0 20px 0", lineHeight: 1.6 }}>
          The following Emirates ID biometrics appointment has been scheduled. Please find the details below.
        </p>

        <div style={{ background: BRAND.white, border: `1px solid ${BRAND.border}`, borderRadius: 12, marginBottom: 16, overflow: "hidden" }}>
          <div style={{ background: BRAND.accentLight, padding: "20px 24px", textAlign: "center", borderBottom: `1px solid ${BRAND.border}` }}>
            <div style={{ display: "flex", justifyContent: "center", gap: 24 }}>
              <div>
                <div style={{ fontSize: 10, color: BRAND.textMuted, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 4 }}>Date</div>
                <div style={{ fontWeight: 700, color: BRAND.primaryDark, fontSize: 18 }}>{appointmentDate}</div>
              </div>
              <div style={{ width: 1, background: `${BRAND.accent}33` }} />
              <div>
                <div style={{ fontSize: 10, color: BRAND.textMuted, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 4 }}>Time</div>
                <div style={{ fontWeight: 700, color: BRAND.primaryDark, fontSize: 18 }}>{appointmentTime}</div>
              </div>
            </div>
          </div>

          <div style={{ padding: "16px 24px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
              <DetailRow label="Work Order" value={woNumber} highlight />
              <DetailRow label="Company" value={companyName} />
              <DetailRow label="Applicant" value={applicantName} />
              <DetailRow label="Service Type" value={serviceType} />
              {applicationNumber && <DetailRow label="Application No" value={applicationNumber} highlight />}
            </div>

            <div style={{ borderTop: `1px solid ${BRAND.border}`, margin: "14px 0" }} />

            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <MapPin style={{ width: 14, height: 14, color: BRAND.accent }} />
              <span style={{ fontWeight: 600, color: BRAND.primaryDark, fontSize: 12 }}>Emirates ID Center</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
              <DetailRow label="Center" value={centerName} highlight />
              <DetailRow label="Type" value={centerType} />
              {centerAddress && <DetailRow label="Address" value={centerAddress} />}
            </div>

            {googleMapsUrl && (
              <div style={{ textAlign: "center", marginTop: 14 }}>
                <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: BRAND.primaryLight, color: BRAND.primaryDark,
                  padding: "8px 20px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                  textDecoration: "none", border: `1px solid ${BRAND.border}`,
                }}>
                  <MapPin style={{ width: 13, height: 13 }} /> View on Maps
                </a>
              </div>
            )}
          </div>
        </div>

        {(assistName || crmName) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {assistName && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: BRAND.white, border: `1px solid ${BRAND.border}`, borderRadius: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: BRAND.primaryLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <User style={{ width: 16, height: 16, color: BRAND.primary }} />
                </div>
                <div style={{ flex: 1, fontSize: 13 }}>
                  <span style={{ fontWeight: 600, color: BRAND.text }}>Staff:</span>{" "}
                  <span style={{ color: BRAND.text }}>{assistName}</span>
                  {assistPhone && <span style={{ color: BRAND.textMuted, marginLeft: 8 }}>{assistPhone}</span>}
                </div>
              </div>
            )}
            {crmName && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: BRAND.white, border: `1px solid ${BRAND.border}`, borderRadius: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: BRAND.primaryLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <User style={{ width: 16, height: 16, color: BRAND.primary }} />
                </div>
                <div style={{ flex: 1, fontSize: 13 }}>
                  <span style={{ fontWeight: 600, color: BRAND.text }}>CRM:</span>{" "}
                  <span style={{ color: BRAND.text }}>{crmName}</span>
                  {crmPhone && <span style={{ color: BRAND.textMuted, marginLeft: 8 }}>{crmPhone}</span>}
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ borderLeft: `3px solid ${BRAND.accent}`, background: "#f0fafb", borderRadius: "0 8px 8px 0", padding: "14px 18px", marginBottom: 16, fontSize: 13, color: "#374151", lineHeight: 1.7 }}>
          Please ensure the applicant arrives at least <strong>10 minutes before</strong> the scheduled time with their <strong>original passport</strong> and all required documents. For any changes or assistance, please contact the assigned <strong>Client Relationship Manager</strong>.
          {notes && <><br /><br />{notes}</>}
        </div>

        <div style={{ fontSize: 13, color: "#475569", marginBottom: 16, lineHeight: 1.6 }}>
          <p style={{ margin: 0 }}>We'll update you once the Emirates ID process is complete. Thank you.</p>
        </div>

        <div style={{ fontSize: 13, color: "#475569" }}>
          <p style={{ margin: 0 }}>Warm regards,</p>
          <p style={{ margin: "2px 0 0 0", fontWeight: 700, color: BRAND.primary }}>The P.R.O. Company</p>
        </div>
      </div>

      <div style={{ background: BRAND.primaryDark, padding: "20px 24px", textAlign: "center" }}>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.25)", marginBottom: 14 }} />
        <a href="https://www.procompany.ae" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,0.85)", textDecoration: "none", fontSize: 13, fontWeight: 500 }}>
          www.procompany.ae
        </a>
        <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 8 }}>
          &copy; 2026 The P.R.O. Company&trade;&nbsp;&nbsp;All rights reserved.
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <span style={{ color: BRAND.textMuted, minWidth: 90, fontSize: 12 }}>{label}:</span>
      <span style={{ fontWeight: highlight ? 600 : 400, color: highlight ? BRAND.primaryDark : BRAND.text, fontSize: 12 }}>{value}</span>
    </div>
  );
}

export function generateEidAppointmentEmailHtml(props: EidAppointmentEmailProps): string {
  const googleMapsUrl = props.centerAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(props.centerAddress)}`
    : null;

  const logoUrl = "https://www.procompany.ae/assets/logo-main-B8Q70aGP.png";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #1a1a2e; background: #f8fafc;">
  <div style="max-width: 620px; margin: 0 auto; background: #f8fafc;">
    <!-- Header -->
    <div style="background: #2d5a87; padding: 20px 24px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td style="vertical-align: middle; width: 52px;">
            <img src="${logoUrl}" alt="The P.R.O. Company" width="44" height="44" style="display: block; border-radius: 8px; background: rgba(255,255,255,0.15); padding: 4px;" />
          </td>
          <td style="vertical-align: middle; padding-left: 14px;">
            <div style="color: #ffffff; font-weight: 700; font-size: 18px; letter-spacing: -0.3px;">The P.R.O. Company</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Content -->
    <div style="padding: 24px;">
      <!-- Title Banner -->
      <div style="background: #ecfeff; border: 1px solid rgba(14, 116, 144, 0.2); border-radius: 10px; padding: 14px 18px; margin-bottom: 20px;">
        <table cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="vertical-align: middle; width: 50px;">
              <div style="width: 42px; height: 42px; background: rgba(14, 116, 144, 0.1); border-radius: 10px; text-align: center; line-height: 42px; font-size: 16px; color: #0e7490; font-weight: 700;">EID</div>
            </td>
            <td style="vertical-align: middle; padding-left: 12px;">
              <div style="font-weight: 700; color: #1a1a2e; font-size: 17px;">Emirates ID Appointment</div>
              <div style="color: #64748b; font-size: 12px; margin-top: 2px;">Ref: ${props.woNumber}</div>
            </td>
          </tr>
        </table>
      </div>

      <!-- Greeting -->
      <p style="margin: 0 0 6px 0; color: #1a1a2e; font-size: 14px;">Dear <strong>Team</strong>,</p>
      <p style="margin: 0 0 20px 0; color: #475569; font-size: 13px; line-height: 1.6;">The following Emirates ID biometrics appointment has been scheduled. Please find the details below.</p>

      <!-- Appointment Card -->
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 16px; overflow: hidden;">
        <!-- Hero Date/Time -->
        <div style="background: #ecfeff; padding: 20px 24px; text-align: center; border-bottom: 1px solid #e2e8f0;">
          <table cellpadding="0" cellspacing="0" border="0" align="center">
            <tr>
              <td style="text-align: center; padding: 0 20px;">
                <div style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Date</div>
                <div style="font-weight: 700; color: #1e3f61; font-size: 18px;">${props.appointmentDate}</div>
              </td>
              <td style="width: 1px; background: rgba(14,116,144,0.2);"></td>
              <td style="text-align: center; padding: 0 20px;">
                <div style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Time</div>
                <div style="font-weight: 700; color: #1e3f61; font-size: 18px;">${props.appointmentTime}</div>
              </td>
            </tr>
          </table>
        </div>

        <!-- Details -->
        <div style="padding: 16px 24px;">
          <table cellpadding="0" cellspacing="5" border="0" width="100%" style="font-size: 12px;">
            <tr><td style="color: #64748b; width: 100px;">Work Order:</td><td style="font-weight: 600; color: #1e3f61;">${props.woNumber}</td></tr>
            <tr><td style="color: #64748b;">Company:</td><td style="font-weight: 400;">${props.companyName}</td></tr>
            <tr><td style="color: #64748b;">Applicant:</td><td style="font-weight: 400;">${props.applicantName}</td></tr>
            <tr><td style="color: #64748b;">Service Type:</td><td style="font-weight: 400;">${props.serviceType}</td></tr>
            ${props.applicationNumber ? `<tr><td style="color: #64748b;">Application No:</td><td style="font-weight: 600; color: #1e3f61;">${props.applicationNumber}</td></tr>` : ""}
          </table>

          <div style="border-top: 1px solid #e2e8f0; margin: 14px 0;"></div>

          <div style="margin-bottom: 10px; font-weight: 600; color: #1e3f61; font-size: 12px;">Emirates ID Center</div>
          <table cellpadding="0" cellspacing="5" border="0" width="100%" style="font-size: 12px;">
            <tr><td style="color: #64748b; width: 100px;">Center:</td><td style="font-weight: 600; color: #1e3f61;">${props.centerName}</td></tr>
            <tr><td style="color: #64748b;">Type:</td><td style="font-weight: 400;">${props.centerType}</td></tr>
            ${props.centerAddress ? `<tr><td style="color: #64748b;">Address:</td><td style="font-weight: 400;">${props.centerAddress}</td></tr>` : ""}
          </table>

          ${googleMapsUrl ? `
          <div style="text-align: center; margin-top: 14px;">
            <a href="${googleMapsUrl}" target="_blank" style="display: inline-block; background: #e8f0f8; color: #1e3f61; padding: 8px 20px; border-radius: 20px; font-size: 12px; font-weight: 600; text-decoration: none; border: 1px solid #e2e8f0;">View on Maps</a>
          </div>
          ` : ""}
        </div>
      </div>

      ${props.assistName || props.crmName ? `
      <!-- Contacts -->
      <div style="margin-bottom: 16px;">
        ${props.assistName ? `
        <div style="display: flex; align-items: center; padding: 10px 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 8px;">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="vertical-align: middle; width: 40px;">
                <div style="width: 32px; height: 32px; background: #e8f0f8; border-radius: 50%; text-align: center; line-height: 32px; font-size: 13px; color: #2d5a87; font-weight: 700;">${props.assistName.charAt(0)}</div>
              </td>
              <td style="vertical-align: middle; font-size: 13px;">
                <strong style="color: #1a1a2e;">Staff:</strong> <span style="color: #1a1a2e;">${props.assistName}</span>
                ${props.assistPhone ? `<span style="color: #64748b; margin-left: 8px;">${props.assistPhone}</span>` : ""}
              </td>
            </tr>
          </table>
        </div>
        ` : ""}
        ${props.crmName ? `
        <div style="display: flex; align-items: center; padding: 10px 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px;">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="vertical-align: middle; width: 40px;">
                <div style="width: 32px; height: 32px; background: #e8f0f8; border-radius: 50%; text-align: center; line-height: 32px; font-size: 13px; color: #2d5a87; font-weight: 700;">${props.crmName.charAt(0)}</div>
              </td>
              <td style="vertical-align: middle; font-size: 13px;">
                <strong style="color: #1a1a2e;">CRM:</strong> <span style="color: #1a1a2e;">${props.crmName}</span>
                ${props.crmPhone ? `<span style="color: #64748b; margin-left: 8px;">${props.crmPhone}</span>` : ""}
              </td>
            </tr>
          </table>
        </div>
        ` : ""}
      </div>
      ` : ""}

      <!-- Important Notes -->
      <div style="border-left: 3px solid #0e7490; background: #f0fafb; border-radius: 0 8px 8px 0; padding: 14px 18px; margin-bottom: 16px; font-size: 13px; color: #374151; line-height: 1.7;">
        Please ensure the applicant arrives at least <strong>10 minutes before</strong> the scheduled time with their <strong>original passport</strong> and all required documents. For any changes or assistance, please contact the assigned <strong>Client Relationship Manager</strong>.
        ${props.notes ? `<br><br>${props.notes}` : ""}
      </div>

      <!-- Closing -->
      <div style="font-size: 13px; color: #475569; margin-bottom: 16px; line-height: 1.6;">
        <p style="margin: 0;">We'll update you once the Emirates ID process is complete. Thank you.</p>
      </div>

      <!-- Signature -->
      <div style="font-size: 13px; color: #475569;">
        <p style="margin: 0;">Warm regards,</p>
        <p style="margin: 2px 0 0 0; font-weight: 700; color: #2d5a87;">The P.R.O. Company</p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #1e3f61; padding: 20px 24px; text-align: center;">
      <div style="border-top: 1px solid rgba(255,255,255,0.25); margin-bottom: 14px;"></div>
      <a href="https://www.procompany.ae" target="_blank" style="color: rgba(255,255,255,0.85); text-decoration: none; font-size: 13px; font-weight: 500;">www.procompany.ae</a>
      <div style="color: rgba(255,255,255,0.55); font-size: 11px; margin-top: 8px;">&copy; 2026 The P.R.O. Company&trade;&nbsp;&nbsp;All rights reserved.</div>
    </div>
  </div>
</body>
</html>
  `.trim();
}
