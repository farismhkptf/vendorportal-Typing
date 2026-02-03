import { Building2, Calendar, Clock, MapPin, Phone, Mail, User, FileText, Stethoscope, UserCheck, MessageCircle, BadgeCheck, ExternalLink } from "lucide-react";

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
    <div className="bg-gradient-to-b from-[#e8f0e8] to-white rounded-lg overflow-hidden text-sm font-sans">
      <div 
        className="px-4 py-3 flex items-center gap-3"
        style={{
          background: "linear-gradient(135deg, #4a7c59 0%, #2d5a3d 100%)",
        }}
      >
        <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
          <Stethoscope className="h-4 w-4 text-white" />
        </div>
        <div>
          <div className="text-white font-semibold text-base">The P.R.O. Company™</div>
          <div className="text-white/80 text-xs">Government Services & PRO Solutions</div>
        </div>
      </div>
      
      <div className="px-4 py-4">
        <div className="flex items-center gap-3 mb-4 bg-white rounded-lg px-4 py-3 border border-[#4a7c59]/20">
          <div className="h-10 w-10 rounded-lg bg-[#4a7c59]/10 flex items-center justify-center">
            <Calendar className="h-5 w-5 text-[#4a7c59]" />
          </div>
          <div>
            <div className="font-semibold text-[#2d5a3d] text-lg">Medical Appointment Scheduled</div>
            <div className="text-muted-foreground text-xs">{woNumber}</div>
          </div>
        </div>
        
        <div className="text-gray-700 mb-4">
          <p>Dear <span className="font-semibold">Team</span>,</p>
          <p className="mt-2">This is to inform you that the <span className="font-semibold">medical appointment</span> has been successfully scheduled for the following employee under the below work order.</p>
        </div>
        
        <div className="bg-white rounded-lg border border-[#4a7c59]/20 mb-4 overflow-hidden">
          <div className="bg-[#4a7c59]/10 px-3 py-2 flex items-center gap-2 border-b border-[#4a7c59]/20">
            <FileText className="h-4 w-4 text-[#4a7c59]" />
            <span className="font-semibold text-[#2d5a3d] text-sm">Appointment Details</span>
          </div>
          <div className="px-3 py-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div className="space-y-2">
                <div className="flex gap-2">
                  <span className="text-muted-foreground min-w-[90px]">Work Order No:</span>
                  <span className="font-semibold text-[#2d5a3d]">{woNumber}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground min-w-[90px]">Company Name:</span>
                  <span className="font-semibold">{companyName}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground min-w-[90px]">Applicant Name:</span>
                  <span className="font-semibold">{applicantName}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground min-w-[90px]">Service Type:</span>
                  <span className="font-semibold">{serviceType}</span>
                </div>
                {applicationNumber && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground min-w-[90px]">Application No:</span>
                    <span className="font-semibold text-[#4a7c59]">{applicationNumber}</span>
                  </div>
                )}
              </div>
              
              <div className="space-y-2 border-l pl-4 border-[#4a7c59]/10">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="h-3.5 w-3.5 text-[#4a7c59]" />
                  <span className="font-semibold text-[#2d5a3d] text-xs">Medical Center:</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground min-w-[40px]">Name:</span>
                  <span className="font-semibold text-[#4a7c59]">{centerName}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground min-w-[40px]">Type:</span>
                  <span className="font-semibold">{centerType}</span>
                </div>
                {centerAddress && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground min-w-[40px]">Address:</span>
                    <span className="font-medium text-gray-700">{centerAddress}</span>
                  </div>
                )}
                {googleMapsUrl && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground min-w-[40px]">Map:</span>
                    <a 
                      href={googleMapsUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[#4a7c59] underline flex items-center gap-1 hover:text-[#2d5a3d]"
                    >
                      View on Google Maps
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                <div className="flex gap-2">
                  <span className="text-muted-foreground min-w-[40px]">Date:</span>
                  <span className="font-bold text-[#2d5a3d] bg-[#4a7c59]/10 px-2 py-0.5 rounded">{appointmentDate}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground min-w-[40px]">Time:</span>
                  <span className="font-bold text-[#2d5a3d] bg-[#4a7c59]/10 px-2 py-0.5 rounded">{appointmentTime}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {medicalAssistName && (
          <div className="bg-white rounded-lg border border-[#4a7c59]/20 mb-4 overflow-hidden">
            <div className="bg-[#4a7c59]/10 px-3 py-2 flex items-center gap-2 border-b border-[#4a7c59]/20">
              <UserCheck className="h-4 w-4 text-[#4a7c59]" />
              <span className="font-semibold text-[#2d5a3d] text-sm">Assigned Staff for Assistance</span>
            </div>
            <div className="px-3 py-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#4a7c59]/20 flex items-center justify-center">
                <User className="h-5 w-5 text-[#4a7c59]" />
              </div>
              <div>
                <div className="font-semibold">{medicalAssistName}</div>
                {medicalAssistPhone && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    Staff Number: {medicalAssistPhone}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        <div className="bg-blue-50 rounded-lg border border-blue-200 mb-4 overflow-hidden">
          <div className="bg-blue-100 px-3 py-2 flex items-center gap-2 border-b border-blue-200">
            <BadgeCheck className="h-4 w-4 text-blue-600" />
            <span className="font-semibold text-blue-800 text-sm">Important Notes</span>
          </div>
          <ul className="px-3 py-3 text-xs text-gray-700 space-y-2 list-none">
            <li className="flex gap-2">
              <span className="text-blue-600 flex-shrink-0">•</span>
              <span>Please ensure the applicant arrives at least <span className="font-semibold">10 minutes before</span> the scheduled appointment time.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-600 flex-shrink-0">•</span>
              <span>Please ensure the applicant carries their <span className="font-semibold underline">original passport</span>. Our team member will be joining with all necessary required documents.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-600 flex-shrink-0">•</span>
              <span>If there are any changes or assistance required, please contact the assigned <span className="font-semibold underline">Client Relationship Manager</span>.</span>
            </li>
            {notes && (
              <li className="flex gap-2">
                <span className="text-blue-600 flex-shrink-0">•</span>
                <span>{notes}</span>
              </li>
            )}
          </ul>
        </div>
        
        {crmName && (
          <div className="bg-white rounded-lg border border-[#4a7c59]/20 mb-4 overflow-hidden">
            <div className="bg-[#4a7c59]/10 px-3 py-2 flex items-center gap-2 border-b border-[#4a7c59]/20">
              <MessageCircle className="h-4 w-4 text-[#4a7c59]" />
              <span className="font-semibold text-[#2d5a3d] text-sm">Client Relationship Manager</span>
            </div>
            <div className="px-3 py-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#4a7c59]/20 flex items-center justify-center">
                <User className="h-5 w-5 text-[#4a7c59]" />
              </div>
              <div>
                <div className="font-semibold">{crmName}</div>
                {crmPhone && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    Contact Number: {crmPhone}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        <div className="text-xs text-gray-600 space-y-2 mb-4">
          <p>Once the medical is completed, we are expecting the result <span className="font-semibold">after completing</span> the medical test.</p>
          <p>Thank you for your continued trust in <span className="font-semibold text-[#2d5a3d]">The P.R.O. Company™</span> and the team.</p>
        </div>
        
        <div className="text-xs text-gray-600">
          <p>Warm regards,</p>
          <p className="font-semibold">Operations Team</p>
          <p className="font-semibold text-[#2d5a3d]">The P.R.O. Company™</p>
        </div>
      </div>
      
      <div 
        className="px-4 py-3 flex items-center justify-between text-xs text-white/90"
        style={{
          background: "linear-gradient(135deg, #4a7c59 0%, #2d5a3d 100%)",
        }}
      >
        <div className="flex items-center gap-1">
          <Building2 className="h-3 w-3" />
          <span>Government Services & PRO Solutions</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Phone className="h-3 w-3" />
            <span>+971 4 123 4567</span>
          </div>
          <div className="flex items-center gap-1">
            <Mail className="h-3 w-3" />
            <span>support@procompany.com</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Export a function to generate HTML for copying to clipboard
export function generateMedicalAppointmentEmailHtml(props: MedicalAppointmentEmailProps): string {
  const googleMapsUrl = props.centerAddress 
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(props.centerAddress)}`
    : null;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; background: linear-gradient(to bottom, #e8f0e8, #ffffff); border-radius: 8px; overflow: hidden;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #4a7c59 0%, #2d5a3d 100%); padding: 12px 16px;">
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="vertical-align: middle; padding-right: 12px;">
            <div style="width: 32px; height: 32px; background: rgba(255,255,255,0.2); border-radius: 50%; text-align: center; line-height: 32px; color: white;">&#x1F3E5;</div>
          </td>
          <td style="vertical-align: middle;">
            <div style="color: white; font-weight: 600; font-size: 16px;">The P.R.O. Company™</div>
            <div style="color: rgba(255,255,255,0.8); font-size: 12px;">Government Services & PRO Solutions</div>
          </td>
        </tr>
      </table>
    </div>
    
    <!-- Content -->
    <div style="padding: 16px;">
      <!-- Title Box -->
      <div style="background: white; border: 1px solid rgba(74, 124, 89, 0.2); border-radius: 8px; padding: 12px 16px; margin-bottom: 16px;">
        <table cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="vertical-align: middle; padding-right: 12px;">
              <div style="width: 40px; height: 40px; background: rgba(74, 124, 89, 0.1); border-radius: 8px; text-align: center; line-height: 40px; font-size: 20px;">&#x1F4C5;</div>
            </td>
            <td style="vertical-align: middle;">
              <div style="font-weight: 600; color: #2d5a3d; font-size: 18px;">Medical Appointment Scheduled</div>
              <div style="color: #666; font-size: 12px;">${props.woNumber}</div>
            </td>
          </tr>
        </table>
      </div>
      
      <!-- Greeting -->
      <div style="color: #374151; margin-bottom: 16px;">
        <p style="margin: 0;">Dear <strong>Team</strong>,</p>
        <p style="margin: 8px 0 0 0;">This is to inform you that the <strong>medical appointment</strong> has been successfully scheduled for the following employee under the below work order.</p>
      </div>
      
      <!-- Appointment Details -->
      <div style="background: white; border: 1px solid rgba(74, 124, 89, 0.2); border-radius: 8px; margin-bottom: 16px; overflow: hidden;">
        <div style="background: rgba(74, 124, 89, 0.1); padding: 8px 12px; border-bottom: 1px solid rgba(74, 124, 89, 0.2);">
          <strong style="color: #2d5a3d; font-size: 14px;">&#x1F4C4; Appointment Details</strong>
        </div>
        <div style="padding: 12px;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="font-size: 12px;">
            <tr>
              <td style="vertical-align: top; width: 50%; padding-right: 16px;">
                <table cellpadding="0" cellspacing="4" border="0" width="100%">
                  <tr><td style="color: #666; width: 100px;">Work Order No:</td><td style="font-weight: 600; color: #2d5a3d;">${props.woNumber}</td></tr>
                  <tr><td style="color: #666;">Company Name:</td><td style="font-weight: 600;">${props.companyName}</td></tr>
                  <tr><td style="color: #666;">Applicant Name:</td><td style="font-weight: 600;">${props.applicantName}</td></tr>
                  <tr><td style="color: #666;">Service Type:</td><td style="font-weight: 600;">${props.serviceType}</td></tr>
                  ${props.applicationNumber ? `<tr><td style="color: #666;">Application No:</td><td style="font-weight: 600; color: #4a7c59;">${props.applicationNumber}</td></tr>` : ''}
                </table>
              </td>
              <td style="vertical-align: top; width: 50%; border-left: 1px solid rgba(74, 124, 89, 0.1); padding-left: 16px;">
                <div style="margin-bottom: 4px;"><strong style="color: #2d5a3d; font-size: 12px;">&#x1F4CD; Medical Center:</strong></div>
                <table cellpadding="0" cellspacing="4" border="0" width="100%">
                  <tr><td style="color: #666; width: 50px;">Name:</td><td style="font-weight: 600; color: #4a7c59;">${props.centerName}</td></tr>
                  <tr><td style="color: #666;">Type:</td><td style="font-weight: 600;">${props.centerType}</td></tr>
                  ${props.centerAddress ? `<tr><td style="color: #666;">Address:</td><td style="font-weight: 500; color: #374151;">${props.centerAddress}</td></tr>` : ''}
                  ${googleMapsUrl ? `<tr><td style="color: #666;">Map:</td><td><a href="${googleMapsUrl}" target="_blank" style="color: #4a7c59; text-decoration: underline;">View on Google Maps &#x2197;</a></td></tr>` : ''}
                  <tr><td style="color: #666;">Date:</td><td style="font-weight: 700; color: #2d5a3d; background: rgba(74, 124, 89, 0.1); padding: 2px 8px; border-radius: 4px;">${props.appointmentDate}</td></tr>
                  <tr><td style="color: #666;">Time:</td><td style="font-weight: 700; color: #2d5a3d; background: rgba(74, 124, 89, 0.1); padding: 2px 8px; border-radius: 4px;">${props.appointmentTime}</td></tr>
                </table>
              </td>
            </tr>
          </table>
        </div>
      </div>
      
      ${props.medicalAssistName ? `
      <!-- Assigned Staff -->
      <div style="background: white; border: 1px solid rgba(74, 124, 89, 0.2); border-radius: 8px; margin-bottom: 16px; overflow: hidden;">
        <div style="background: rgba(74, 124, 89, 0.1); padding: 8px 12px; border-bottom: 1px solid rgba(74, 124, 89, 0.2);">
          <strong style="color: #2d5a3d; font-size: 14px;">&#x2705; Assigned Staff for Assistance</strong>
        </div>
        <div style="padding: 12px;">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="vertical-align: middle; padding-right: 12px;">
                <div style="width: 40px; height: 40px; background: rgba(74, 124, 89, 0.2); border-radius: 50%; text-align: center; line-height: 40px; font-size: 18px;">&#x1F464;</div>
              </td>
              <td style="vertical-align: middle;">
                <div style="font-weight: 600;">${props.medicalAssistName}</div>
                ${props.medicalAssistPhone ? `<div style="font-size: 12px; color: #666;">&#x1F4DE; Staff Number: ${props.medicalAssistPhone}</div>` : ''}
              </td>
            </tr>
          </table>
        </div>
      </div>
      ` : ''}
      
      <!-- Important Notes -->
      <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; margin-bottom: 16px; overflow: hidden;">
        <div style="background: #dbeafe; padding: 8px 12px; border-bottom: 1px solid #bfdbfe;">
          <strong style="color: #1e40af; font-size: 14px;">&#x2705; Important Notes</strong>
        </div>
        <div style="padding: 12px; font-size: 12px; color: #374151;">
          <p style="margin: 0 0 8px 0;"><span style="color: #2563eb;">•</span> Please ensure the applicant arrives at least <strong>10 minutes before</strong> the scheduled appointment time.</p>
          <p style="margin: 0 0 8px 0;"><span style="color: #2563eb;">•</span> Please ensure the applicant carries their <strong style="text-decoration: underline;">original passport</strong>. Our team member will be joining with all necessary required documents.</p>
          <p style="margin: 0 0 8px 0;"><span style="color: #2563eb;">•</span> If there are any changes or assistance required, please contact the assigned <strong style="text-decoration: underline;">Client Relationship Manager</strong>.</p>
          ${props.notes ? `<p style="margin: 0;"><span style="color: #2563eb;">•</span> ${props.notes}</p>` : ''}
        </div>
      </div>
      
      ${props.crmName ? `
      <!-- CRM -->
      <div style="background: white; border: 1px solid rgba(74, 124, 89, 0.2); border-radius: 8px; margin-bottom: 16px; overflow: hidden;">
        <div style="background: rgba(74, 124, 89, 0.1); padding: 8px 12px; border-bottom: 1px solid rgba(74, 124, 89, 0.2);">
          <strong style="color: #2d5a3d; font-size: 14px;">&#x1F4AC; Client Relationship Manager</strong>
        </div>
        <div style="padding: 12px;">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="vertical-align: middle; padding-right: 12px;">
                <div style="width: 40px; height: 40px; background: rgba(74, 124, 89, 0.2); border-radius: 50%; text-align: center; line-height: 40px; font-size: 18px;">&#x1F464;</div>
              </td>
              <td style="vertical-align: middle;">
                <div style="font-weight: 600;">${props.crmName}</div>
                ${props.crmPhone ? `<div style="font-size: 12px; color: #666;">&#x1F4DE; Contact Number: ${props.crmPhone}</div>` : ''}
              </td>
            </tr>
          </table>
        </div>
      </div>
      ` : ''}
      
      <!-- Closing -->
      <div style="font-size: 12px; color: #4b5563; margin-bottom: 16px;">
        <p style="margin: 0 0 8px 0;">Once the medical is completed, we are expecting the result <strong>after completing</strong> the medical test.</p>
        <p style="margin: 0;">Thank you for your continued trust in <strong style="color: #2d5a3d;">The P.R.O. Company™</strong> and the team.</p>
      </div>
      
      <!-- Signature -->
      <div style="font-size: 12px; color: #4b5563;">
        <p style="margin: 0;">Warm regards,</p>
        <p style="margin: 0; font-weight: 600;">Operations Team</p>
        <p style="margin: 0; font-weight: 600; color: #2d5a3d;">The P.R.O. Company™</p>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="background: linear-gradient(135deg, #4a7c59 0%, #2d5a3d 100%); padding: 12px 16px; font-size: 12px; color: rgba(255,255,255,0.9);">
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td>&#x1F3E2; Government Services & PRO Solutions</td>
          <td style="text-align: right;">
            &#x1F4DE; +971 4 123 4567 &nbsp;&nbsp; &#x2709; support@procompany.com
          </td>
        </tr>
      </table>
    </div>
  </div>
</body>
</html>
  `.trim();
}
