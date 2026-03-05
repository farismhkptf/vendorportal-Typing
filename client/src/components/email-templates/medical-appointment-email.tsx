import { Calendar, MapPin, Phone, User, FileText, Stethoscope, UserCheck, MessageCircle, BadgeCheck, ExternalLink } from "lucide-react";
import logoPath from "../../assets/logos/logo-main.png";

const BRAND = {
  primary: "#2d5a87",
  primaryDark: "#1e3f61",
  primaryLight: "#e8f0f8",
  accent: "#c4544a",
  accentLight: "#fdf2f1",
  text: "#1a1a2e",
  textMuted: "#64748b",
  border: "#e2e8f0",
  white: "#ffffff",
  bg: "#f8fafc",
};

interface MedicalAppointmentEmailProps {
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
  medicalAssistName?: string;
  medicalAssistPhone?: string;
  crmName?: string;
  crmPhone?: string;
  notes?: string;
}

export function MedicalAppointmentEmail({
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
  medicalAssistName,
  medicalAssistPhone,
  crmName,
  crmPhone,
  notes,
}: MedicalAppointmentEmailProps) {
  const googleMapsUrl = centerAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(centerAddress)}`
    : null;

  return (
    <div style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif", background: BRAND.bg, maxWidth: 620 }}>
      <div style={{ background: BRAND.primary, padding: "20px 24px", display: "flex", alignItems: "center", gap: 14 }}>
        <img src={logoPath} alt="Logo" style={{ width: 44, height: 44, borderRadius: 8, background: "rgba(255,255,255,0.15)", padding: 4 }} />
        <div>
          <div style={{ color: BRAND.white, fontWeight: 700, fontSize: 18, letterSpacing: -0.3 }}>The P.R.O. Company</div>
          <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 1 }}>Government Services & PRO Solutions</div>
        </div>
      </div>

      <div style={{ padding: "24px" }}>
        <div style={{ background: BRAND.accentLight, border: `1px solid ${BRAND.accent}33`, borderRadius: 10, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: `${BRAND.accent}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Stethoscope style={{ width: 22, height: 22, color: BRAND.accent }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, color: BRAND.text, fontSize: 17 }}>Medical Appointment</div>
            <div style={{ color: BRAND.textMuted, fontSize: 12, marginTop: 2 }}>Ref: {woNumber}</div>
          </div>
        </div>

        <p style={{ color: BRAND.text, fontSize: 14, margin: "0 0 6px 0" }}>Dear <strong>Team</strong>,</p>
        <p style={{ color: "#475569", fontSize: 13, margin: "0 0 20px 0", lineHeight: 1.6 }}>
          The medical appointment has been scheduled for the following applicant. Please find the details below.
        </p>

        <div style={{ background: BRAND.white, border: `1px solid ${BRAND.border}`, borderRadius: 10, marginBottom: 16, overflow: "hidden" }}>
          <div style={{ background: BRAND.primaryLight, padding: "10px 16px", borderBottom: `1px solid ${BRAND.border}`, display: "flex", alignItems: "center", gap: 8 }}>
            <FileText style={{ width: 15, height: 15, color: BRAND.primary }} />
            <span style={{ fontWeight: 600, color: BRAND.primaryDark, fontSize: 13 }}>Appointment Details</span>
          </div>
          <div style={{ padding: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 13 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <DetailRow label="Work Order" value={woNumber} highlight />
                <DetailRow label="Company" value={companyName} />
                <DetailRow label="Applicant" value={applicantName} />
                <DetailRow label="Service Type" value={serviceType} />
                {applicationNumber && <DetailRow label="Application No" value={applicationNumber} highlight />}
              </div>
              <div style={{ borderLeft: `1px solid ${BRAND.border}`, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <MapPin style={{ width: 14, height: 14, color: BRAND.primary }} />
                  <span style={{ fontWeight: 600, color: BRAND.primaryDark, fontSize: 12 }}>Medical Center</span>
                </div>
                <DetailRow label="Center" value={centerName} highlight />
                <DetailRow label="Type" value={centerType} />
                {centerAddress && <DetailRow label="Address" value={centerAddress} />}
                {googleMapsUrl && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <span style={{ color: BRAND.textMuted, minWidth: 60, fontSize: 12 }}>Map:</span>
                    <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" style={{ color: BRAND.primary, textDecoration: "underline", fontSize: 12, display: "flex", alignItems: "center", gap: 3 }}>
                      Google Maps <ExternalLink style={{ width: 10, height: 10 }} />
                    </a>
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <div style={{ background: BRAND.primaryLight, border: `1px solid ${BRAND.primary}22`, borderRadius: 8, padding: "8px 14px", textAlign: "center", flex: 1 }}>
                    <div style={{ fontSize: 10, color: BRAND.textMuted, textTransform: "uppercase" as const, letterSpacing: 0.5, marginBottom: 3 }}>Date</div>
                    <div style={{ fontWeight: 700, color: BRAND.primaryDark, fontSize: 14 }}>{appointmentDate}</div>
                  </div>
                  <div style={{ background: BRAND.primaryLight, border: `1px solid ${BRAND.primary}22`, borderRadius: 8, padding: "8px 14px", textAlign: "center", flex: 1 }}>
                    <div style={{ fontSize: 10, color: BRAND.textMuted, textTransform: "uppercase" as const, letterSpacing: 0.5, marginBottom: 3 }}>Time</div>
                    <div style={{ fontWeight: 700, color: BRAND.primaryDark, fontSize: 14 }}>{appointmentTime}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {(medicalAssistName || crmName) && (
          <div style={{ display: "grid", gridTemplateColumns: medicalAssistName && crmName ? "1fr 1fr" : "1fr", gap: 12, marginBottom: 16 }}>
            {medicalAssistName && (
              <ContactCard
                title="Assigned Staff"
                icon={<UserCheck style={{ width: 14, height: 14, color: BRAND.primary }} />}
                name={medicalAssistName}
                phone={medicalAssistPhone}
                phoneLabel="Staff Number"
              />
            )}
            {crmName && (
              <ContactCard
                title="Client Relationship Manager"
                icon={<MessageCircle style={{ width: 14, height: 14, color: BRAND.primary }} />}
                name={crmName}
                phone={crmPhone}
                phoneLabel="Contact Number"
              />
            )}
          </div>
        )}

        <div style={{ background: "#f0f7ff", border: "1px solid #c7ddf5", borderRadius: 10, marginBottom: 16, overflow: "hidden" }}>
          <div style={{ background: "#ddeaf8", padding: "10px 16px", borderBottom: "1px solid #c7ddf5", display: "flex", alignItems: "center", gap: 8 }}>
            <BadgeCheck style={{ width: 15, height: 15, color: BRAND.primary }} />
            <span style={{ fontWeight: 600, color: BRAND.primaryDark, fontSize: 13 }}>Important Notes</span>
          </div>
          <div style={{ padding: "14px 16px", fontSize: 13, color: "#374151" }}>
            <p style={{ margin: "0 0 8px 0", display: "flex", gap: 8 }}>
              <span style={{ color: BRAND.primary, flexShrink: 0 }}>•</span>
              <span>Please ensure the applicant arrives at least <strong>10 minutes before</strong> the scheduled time.</span>
            </p>
            <p style={{ margin: "0 0 8px 0", display: "flex", gap: 8 }}>
              <span style={{ color: BRAND.primary, flexShrink: 0 }}>•</span>
              <span>Please ensure the applicant carries their <strong style={{ textDecoration: "underline" }}>original passport</strong>. Our team member will join with all required documents.</span>
            </p>
            <p style={{ margin: "0 0 8px 0", display: "flex", gap: 8 }}>
              <span style={{ color: BRAND.primary, flexShrink: 0 }}>•</span>
              <span>For any changes or assistance, please contact the assigned <strong style={{ textDecoration: "underline" }}>Client Relationship Manager</strong>.</span>
            </p>
            {notes && (
              <p style={{ margin: 0, display: "flex", gap: 8 }}>
                <span style={{ color: BRAND.primary, flexShrink: 0 }}>•</span>
                <span>{notes}</span>
              </p>
            )}
          </div>
        </div>

        <div style={{ fontSize: 13, color: "#475569", marginBottom: 16, lineHeight: 1.6 }}>
          <p style={{ margin: "0 0 6px 0" }}>Once the medical is completed, we are expecting the result after completing the medical test.</p>
          <p style={{ margin: 0 }}>Thank you for your continued trust in <strong style={{ color: BRAND.primaryDark }}>The P.R.O. Company</strong>.</p>
        </div>

        <div style={{ fontSize: 13, color: "#475569" }}>
          <p style={{ margin: 0 }}>Warm regards,</p>
          <p style={{ margin: "2px 0 0 0", fontWeight: 600 }}>Operations Team</p>
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
      <span style={{ color: BRAND.textMuted, minWidth: 60, fontSize: 12 }}>{label}:</span>
      <span style={{ fontWeight: highlight ? 600 : 500, color: highlight ? BRAND.primaryDark : BRAND.text, fontSize: 12 }}>{value}</span>
    </div>
  );
}

function ContactCard({ title, icon, name, phone, phoneLabel }: { title: string; icon: React.ReactNode; name: string; phone?: string; phoneLabel: string }) {
  return (
    <div style={{ background: BRAND.white, border: `1px solid ${BRAND.border}`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ background: BRAND.primaryLight, padding: "8px 14px", borderBottom: `1px solid ${BRAND.border}`, display: "flex", alignItems: "center", gap: 6 }}>
        {icon}
        <span style={{ fontWeight: 600, color: BRAND.primaryDark, fontSize: 12 }}>{title}</span>
      </div>
      <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: BRAND.primaryLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <User style={{ width: 18, height: 18, color: BRAND.primary }} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: BRAND.text }}>{name}</div>
          {phone && (
            <div style={{ fontSize: 12, color: BRAND.textMuted, display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
              <Phone style={{ width: 11, height: 11 }} /> {phoneLabel}: {phone}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function generateMedicalAppointmentEmailHtml(props: MedicalAppointmentEmailProps): string {
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
            <div style="color: rgba(255,255,255,0.75); font-size: 12px; margin-top: 1px;">Government Services & PRO Solutions</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Content -->
    <div style="padding: 24px;">
      <!-- Title Banner -->
      <div style="background: #fdf2f1; border: 1px solid rgba(196, 84, 74, 0.2); border-radius: 10px; padding: 14px 18px; margin-bottom: 20px;">
        <table cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="vertical-align: middle; width: 50px;">
              <div style="width: 42px; height: 42px; background: rgba(196, 84, 74, 0.1); border-radius: 10px; text-align: center; line-height: 42px; font-size: 18px; color: #c4544a; font-weight: 700;">M</div>
            </td>
            <td style="vertical-align: middle; padding-left: 12px;">
              <div style="font-weight: 700; color: #1a1a2e; font-size: 17px;">Medical Appointment</div>
              <div style="color: #64748b; font-size: 12px; margin-top: 2px;">Ref: ${props.woNumber}</div>
            </td>
          </tr>
        </table>
      </div>

      <!-- Greeting -->
      <p style="margin: 0 0 6px 0; color: #1a1a2e; font-size: 14px;">Dear <strong>Team</strong>,</p>
      <p style="margin: 0 0 20px 0; color: #475569; font-size: 13px; line-height: 1.6;">The medical appointment has been scheduled for the following applicant. Please find the details below.</p>

      <!-- Appointment Details -->
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 16px; overflow: hidden;">
        <div style="background: #e8f0f8; padding: 10px 16px; border-bottom: 1px solid #e2e8f0;">
          <strong style="color: #1e3f61; font-size: 13px;">Appointment Details</strong>
        </div>
        <div style="padding: 16px;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="font-size: 12px;">
            <tr>
              <td style="vertical-align: top; width: 50%; padding-right: 16px;">
                <table cellpadding="0" cellspacing="6" border="0" width="100%">
                  <tr><td style="color: #64748b; width: 90px;">Work Order:</td><td style="font-weight: 600; color: #1e3f61;">${props.woNumber}</td></tr>
                  <tr><td style="color: #64748b;">Company:</td><td style="font-weight: 600;">${props.companyName}</td></tr>
                  <tr><td style="color: #64748b;">Applicant:</td><td style="font-weight: 600;">${props.applicantName}</td></tr>
                  <tr><td style="color: #64748b;">Service Type:</td><td style="font-weight: 600;">${props.serviceType}</td></tr>
                  ${props.applicationNumber ? `<tr><td style="color: #64748b;">Application No:</td><td style="font-weight: 600; color: #2d5a87;">${props.applicationNumber}</td></tr>` : ""}
                </table>
              </td>
              <td style="vertical-align: top; width: 50%; border-left: 1px solid #e2e8f0; padding-left: 16px;">
                <div style="margin-bottom: 6px; font-weight: 600; color: #1e3f61; font-size: 12px;">Medical Center</div>
                <table cellpadding="0" cellspacing="6" border="0" width="100%">
                  <tr><td style="color: #64748b; width: 60px;">Center:</td><td style="font-weight: 600; color: #2d5a87;">${props.centerName}</td></tr>
                  <tr><td style="color: #64748b;">Type:</td><td style="font-weight: 600;">${props.centerType}</td></tr>
                  ${props.centerAddress ? `<tr><td style="color: #64748b;">Address:</td><td style="font-weight: 500;">${props.centerAddress}</td></tr>` : ""}
                  ${googleMapsUrl ? `<tr><td style="color: #64748b;">Map:</td><td><a href="${googleMapsUrl}" target="_blank" style="color: #2d5a87; text-decoration: underline;">Google Maps</a></td></tr>` : ""}
                </table>
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 10px;">
                  <tr>
                    <td style="width: 48%; background: #e8f0f8; border: 1px solid rgba(45,90,135,0.13); border-radius: 8px; padding: 8px 10px; text-align: center;">
                      <div style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px;">Date</div>
                      <div style="font-weight: 700; color: #1e3f61; font-size: 14px;">${props.appointmentDate}</div>
                    </td>
                    <td style="width: 4%;"></td>
                    <td style="width: 48%; background: #e8f0f8; border: 1px solid rgba(45,90,135,0.13); border-radius: 8px; padding: 8px 10px; text-align: center;">
                      <div style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px;">Time</div>
                      <div style="font-weight: 700; color: #1e3f61; font-size: 14px;">${props.appointmentTime}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </div>
      </div>

      ${props.medicalAssistName || props.crmName ? `
      <!-- Staff Cards -->
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 16px;">
        <tr>
          ${props.medicalAssistName ? `
          <td style="vertical-align: top; ${props.crmName ? "width: 48%; padding-right: 6px;" : "width: 100%;"}">
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
              <div style="background: #e8f0f8; padding: 8px 14px; border-bottom: 1px solid #e2e8f0;">
                <strong style="color: #1e3f61; font-size: 12px;">Assigned Staff</strong>
              </div>
              <div style="padding: 12px 14px;">
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="vertical-align: middle; width: 44px;">
                      <div style="width: 36px; height: 36px; background: #e8f0f8; border-radius: 50%; text-align: center; line-height: 36px; font-size: 14px; color: #2d5a87; font-weight: 700;">${props.medicalAssistName.charAt(0)}</div>
                    </td>
                    <td style="vertical-align: middle;">
                      <div style="font-weight: 600; font-size: 13px;">${props.medicalAssistName}</div>
                      ${props.medicalAssistPhone ? `<div style="font-size: 12px; color: #64748b; margin-top: 2px;">Staff: ${props.medicalAssistPhone}</div>` : ""}
                    </td>
                  </tr>
                </table>
              </div>
            </div>
          </td>
          ` : ""}
          ${props.crmName ? `
          ${props.medicalAssistName ? `<td style="width: 4%;"></td>` : ""}
          <td style="vertical-align: top; ${props.medicalAssistName ? "width: 48%; padding-left: 6px;" : "width: 100%;"}">
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
              <div style="background: #e8f0f8; padding: 8px 14px; border-bottom: 1px solid #e2e8f0;">
                <strong style="color: #1e3f61; font-size: 12px;">Client Relationship Manager</strong>
              </div>
              <div style="padding: 12px 14px;">
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="vertical-align: middle; width: 44px;">
                      <div style="width: 36px; height: 36px; background: #e8f0f8; border-radius: 50%; text-align: center; line-height: 36px; font-size: 14px; color: #2d5a87; font-weight: 700;">${props.crmName.charAt(0)}</div>
                    </td>
                    <td style="vertical-align: middle;">
                      <div style="font-weight: 600; font-size: 13px;">${props.crmName}</div>
                      ${props.crmPhone ? `<div style="font-size: 12px; color: #64748b; margin-top: 2px;">Contact: ${props.crmPhone}</div>` : ""}
                    </td>
                  </tr>
                </table>
              </div>
            </div>
          </td>
          ` : ""}
        </tr>
      </table>
      ` : ""}

      <!-- Important Notes -->
      <div style="background: #f0f7ff; border: 1px solid #c7ddf5; border-radius: 10px; margin-bottom: 16px; overflow: hidden;">
        <div style="background: #ddeaf8; padding: 10px 16px; border-bottom: 1px solid #c7ddf5;">
          <strong style="color: #1e3f61; font-size: 13px;">Important Notes</strong>
        </div>
        <div style="padding: 14px 16px; font-size: 13px; color: #374151; line-height: 1.6;">
          <p style="margin: 0 0 8px 0;"><span style="color: #2d5a87;">&#8226;</span>&nbsp; Please ensure the applicant arrives at least <strong>10 minutes before</strong> the scheduled time.</p>
          <p style="margin: 0 0 8px 0;"><span style="color: #2d5a87;">&#8226;</span>&nbsp; Please ensure the applicant carries their <strong style="text-decoration: underline;">original passport</strong>. Our team member will join with all required documents.</p>
          <p style="margin: 0 0 8px 0;"><span style="color: #2d5a87;">&#8226;</span>&nbsp; For any changes or assistance, please contact the assigned <strong style="text-decoration: underline;">Client Relationship Manager</strong>.</p>
          ${props.notes ? `<p style="margin: 0;"><span style="color: #2d5a87;">&#8226;</span>&nbsp; ${props.notes}</p>` : ""}
        </div>
      </div>

      <!-- Closing -->
      <div style="font-size: 13px; color: #475569; margin-bottom: 16px; line-height: 1.6;">
        <p style="margin: 0 0 6px 0;">Once the medical is completed, we are expecting the result after completing the medical test.</p>
        <p style="margin: 0;">Thank you for your continued trust in <strong style="color: #1e3f61;">The P.R.O. Company</strong>.</p>
      </div>

      <!-- Signature -->
      <div style="font-size: 13px; color: #475569;">
        <p style="margin: 0;">Warm regards,</p>
        <p style="margin: 2px 0 0 0; font-weight: 600;">Operations Team</p>
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
