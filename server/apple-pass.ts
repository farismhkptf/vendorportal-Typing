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
