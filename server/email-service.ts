import nodemailer from "nodemailer";

interface SendEmailOptions {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  from?: string;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

function createTransporter() {
  const user = process.env.ZOHO_SMTP_USER;
  const pass = process.env.ZOHO_SMTP_PASS;

  if (!user || !pass) {
    throw new Error("ZOHO_SMTP_USER and ZOHO_SMTP_PASS environment secrets are not configured.");
  }

  return nodemailer.createTransport({
    host: "smtp.zoho.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
}

export async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
  const user = process.env.ZOHO_SMTP_USER;
  if (!user || !process.env.ZOHO_SMTP_PASS) {
    return { success: false, error: "Email service is not configured. Please add ZOHO_SMTP_USER and ZOHO_SMTP_PASS secrets." };
  }

  try {
    const transporter = createTransporter();
    const fromAddress = options.from || user;
    const info = await transporter.sendMail({
      from: `"The P.R.O. Company" <${fromAddress}>`,
      to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
      cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(", ") : options.cc) : undefined,
      replyTo: options.replyTo || user,
      subject: options.subject,
      html: options.html,
    });
    return { success: true, messageId: info.messageId };
  } catch (err: unknown) {
    console.error("Email send error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to send email" };
  }
}

export function isEmailConfigured(): boolean {
  return !!(process.env.ZOHO_SMTP_USER && process.env.ZOHO_SMTP_PASS);
}
