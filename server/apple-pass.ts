import { PKPass } from "passkit-generator";
import crypto from "crypto";

function decodeCert(value: string): Buffer {
  // If it looks like a PEM, use as-is; otherwise try base64 decode
  const trimmed = value.trim();
  if (trimmed.startsWith("-----")) {
    return Buffer.from(trimmed);
  }
  return Buffer.from(trimmed, "base64");
}

export type PassField = { key: string; label: string; value: string };

export interface WalletPassFields {
  header: PassField[];
  primary: PassField[];
  secondary: PassField[];
  auxiliary: PassField[];
  back: PassField[];
  qrMessage: string;
  description: string;
}

/**
 * Pure function: derives all Apple Wallet pass fields from appointment data.
 * Separated from PKPass construction so it can be unit-tested without Apple certs.
 */
export function buildWalletPassFields(opts: {
  appointmentType: "Medical" | "EID" | string;
  datetime: Date;
  cardUrl: string;
  applicantName: string | null | undefined;
  centerName: string | null | undefined;
  centerArea: string | null | undefined;
  companyName: string | null | undefined;
  woNumber: string | null | undefined;
  assignedStaffName: string | null | undefined;
  assignedStaffPhone: string | null | undefined;
}): WalletPassFields {
  const {
    appointmentType,
    datetime: dt,
    cardUrl,
    applicantName,
    centerName,
    centerArea,
    companyName,
    woNumber,
    assignedStaffName,
    assignedStaffPhone,
  } = opts;

  const dateStr = dt.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const timeStr = dt.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });

  const arrivalDt = new Date(dt.getTime() - 15 * 60 * 1000);
  const arrivalTimeStr = arrivalDt.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });
  const recommendedArrival = `${arrivalTimeStr} (15 min before appointment)`;

  const isEID = appointmentType === "EID";
  const description = isEID ? "Emirates ID Biometrics" : "Medical Fitness Appointment";

  const centerDisplay = centerArea ? `${centerName || "—"} — ${centerArea}` : (centerName || "—");

  const header: PassField[] = [];
  const primary: PassField[] = [];
  const secondary: PassField[] = [];
  const auxiliary: PassField[] = [];
  const back: PassField[] = [];

  if (isEID) {
    primary.push({ key: "time", label: "Appointment Time", value: timeStr });
    secondary.push({ key: "date", label: "Date", value: dateStr });
    auxiliary.push({ key: "center", label: "Biometrics Center", value: centerDisplay });
    auxiliary.push({ key: "applicant", label: "Applicant", value: applicantName || "—" });
    if (companyName) {
      auxiliary.push({ key: "company", label: "Company", value: companyName });
    }
  } else {
    header.push({ key: "type", label: "Appointment", value: "Medical Fitness" });
    primary.push({ key: "applicant", label: "Applicant", value: applicantName || "—" });
    secondary.push({ key: "date", label: "Date", value: dateStr });
    secondary.push({ key: "time", label: "Time", value: timeStr });
    auxiliary.push({ key: "center", label: "Medical Center", value: centerDisplay });
    if (companyName) {
      auxiliary.push({ key: "company", label: "Company", value: companyName });
    }
  }

  back.push({ key: "ref", label: "Reference", value: woNumber || "—" });
  back.push({ key: "arrival", label: "Recommended Arrival", value: recommendedArrival });
  back.push({ key: "duration", label: "Estimated Duration", value: "15 – 30 minutes" });

  if (isEID) {
    back.push({
      key: "document",
      label: "Required Documents",
      value: "Original passport and original Emirates ID (no copies accepted)",
    });
    const assistContact = assignedStaffName
      ? (assignedStaffPhone ? `${assignedStaffName} — ${assignedStaffPhone}` : assignedStaffName)
      : "Will be assigned before your appointment";
    back.push({ key: "guide", label: "On-Site Guide", value: assistContact });
    back.push({
      key: "guide_note",
      label: "Guide Assistance",
      value: "Your guide will meet you on arrival and handle the queue and registration on your behalf.",
    });
  } else {
    back.push({ key: "document", label: "Required Document", value: "Original passport (must be valid)" });
    back.push({ key: "attire", label: "Attire", value: "Smart casual. Shoulders and knees must be covered." });
    back.push({
      key: "jewellery",
      label: "Jewellery & Accessories",
      value: "Please remove all metal jewellery and accessories before your appointment.",
    });
    const assistContact = assignedStaffName
      ? (assignedStaffPhone ? `${assignedStaffName} — ${assignedStaffPhone}` : assignedStaffName)
      : "Will be assigned before your appointment";
    back.push({ key: "assist", label: "On-Site Assist", value: assistContact });
  }

  return { header, primary, secondary, auxiliary, back, qrMessage: cardUrl, description };
}

export async function generateAppointmentPass(opts: {
  passTypeIdentifier: string;
  teamIdentifier: string;
  serialNumber?: string;
  description?: string;
  organizationName?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  labelColor?: string;
  qrMessage?: string;
  // header/primary/secondary fields
  fields?: {
    header?: { key: string; label: string; value: string }[];
    primary?: { key: string; label: string; value: string }[];
    secondary?: { key: string; label: string; value: string }[];
    auxiliary?: { key: string; label: string; value: string }[];
    back?: { key: string; label: string; value: string }[];
  };
}): Promise<Buffer> {
  const cert = process.env.APPLE_PASS_CERT;
  const key = process.env.APPLE_PASS_KEY;
  const wwdr = process.env.APPLE_PASS_WWDR;
  const passphrase = process.env.APPLE_PASS_PASSPHRASE;

  if (!cert || !key || !wwdr) {
    throw new Error("Missing Apple Wallet certificate environment variables (APPLE_PASS_CERT, APPLE_PASS_KEY, APPLE_PASS_WWDR)");
  }

  const pass = new PKPass(
    {},
    {
      wwdr: decodeCert(wwdr),
      signerCert: decodeCert(cert),
      signerKey: decodeCert(key),
      signerKeyPassphrase: passphrase,
    },
    {
      passTypeIdentifier: opts.passTypeIdentifier,
      teamIdentifier: opts.teamIdentifier,
      serialNumber: opts.serialNumber ?? crypto.randomUUID(),
      description: opts.description ?? "Appointment Pass",
      organizationName: opts.organizationName ?? "The P.R.O. Company",
      backgroundColor: opts.backgroundColor ?? "rgb(0,0,0)",
      foregroundColor: opts.foregroundColor ?? "rgb(255,255,255)",
      labelColor: opts.labelColor ?? "rgb(255,255,255)",
    }
  );

  // Set pass type to generic
  pass.type = "generic";

  // QR barcode
  pass.setBarcodes({
    message: opts.qrMessage ?? "PRO-APPOINTMENT",
    format: "PKBarcodeFormatQR",
    messageEncoding: "iso-8859-1",
  });

  // Fields
  const fields = opts.fields ?? {};

  if (fields.header) {
    for (const f of fields.header) pass.headerFields.push(f);
  }
  if (fields.primary) {
    for (const f of fields.primary) pass.primaryFields.push(f);
  }
  if (fields.secondary) {
    for (const f of fields.secondary) pass.secondaryFields.push(f);
  }
  if (fields.auxiliary) {
    for (const f of fields.auxiliary) pass.auxiliaryFields.push(f);
  }
  if (fields.back) {
    for (const f of fields.back) pass.backFields.push(f);
  }

  const buffer = await pass.getAsBuffer();
  return buffer;
}
