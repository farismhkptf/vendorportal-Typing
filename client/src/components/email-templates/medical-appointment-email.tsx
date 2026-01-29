import { Building2, Calendar, Clock, MapPin, Phone, Mail, User, FileText, Stethoscope, UserCheck, MessageCircle, BadgeCheck } from "lucide-react";

interface MedicalAppointmentEmailProps {
  woNumber: string;
  companyName: string;
  applicantName: string;
  centerName: string;
  centerType: "Normal" | "VIP";
  appointmentDate: string;
  appointmentTime: string;
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
  centerName,
  centerType,
  appointmentDate,
  appointmentTime,
  medicalAssistName,
  medicalAssistPhone,
  crmName,
  crmPhone,
  notes,
}: MedicalAppointmentEmailProps) {
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
          <div className="text-white font-semibold text-base">The P.R.O. Company</div>
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
          <p>Dear <span className="font-semibold">{companyName}</span>,</p>
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
                  <span className="font-semibold underline">Medical Examination</span>
                </div>
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
                <div className="flex gap-2">
                  <span className="text-muted-foreground min-w-[40px]">Date:</span>
                  <span className="font-semibold text-[#4a7c59]">{appointmentDate}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground min-w-[40px]">Time:</span>
                  <span className="font-semibold text-[#4a7c59]">{appointmentTime}</span>
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
          <div className="px-3 py-3 text-xs text-gray-700 space-y-2">
            <p className="flex gap-2">
              <span className="text-blue-600">•</span>
              Please ensure the applicant carries their <span className="font-semibold underline">original passport</span>. Our team member will be joining with all necessary required documents.
            </p>
            <p className="flex gap-2">
              <span className="text-blue-600">•</span>
              If there are any changes or assistance required, please contact the assigned <span className="font-semibold underline">Client Relationship Manager</span>.
            </p>
            {notes && (
              <p className="flex gap-2">
                <span className="text-blue-600">•</span>
                {notes}
              </p>
            )}
          </div>
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
          <p>Once the medical is completed, we are expecting the result <span className="font-semibold">within 24 hours</span> from the medical test.</p>
          <p>Thank you for your continued trust in <span className="font-semibold text-[#2d5a3d]">The P.R.O. Company</span> and the team.</p>
        </div>
        
        <div className="text-xs text-gray-600">
          <p>Warm regards,</p>
          <p className="font-semibold">Operations Team</p>
          <p className="font-semibold text-[#2d5a3d]">The P.R.O. Company</p>
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
