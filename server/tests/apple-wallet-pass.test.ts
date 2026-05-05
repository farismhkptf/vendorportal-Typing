/**
 * Unit tests for Apple Wallet pass field mapping (Task #120)
 *
 * Tests the `buildWalletPassFields` pure function which derives all Apple Wallet
 * pass fields from appointment data. These tests run without Apple certificates
 * and verify that date, time, location, and client name always appear in the
 * correct pass zones for both EID and Medical appointment types.
 *
 * Run with:
 *   NODE_TEST=1 npx tsx --test server/tests/apple-wallet-pass.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildWalletPassFields } from "../apple-pass";

// Fixed datetime for deterministic output: Wednesday 14 May 2025, 10:30 AM UTC
const FIXED_DATETIME = new Date("2025-05-14T06:30:00.000Z"); // 10:30 AM GMT+4 (UAE)

const BASE_OPTS = {
  datetime: FIXED_DATETIME,
  cardUrl: "https://app.procompany.ae/card/abc123",
  applicantName: "John Smith",
  centerName: "Al Barsha Medical Centre",
  centerArea: "Al Barsha",
  companyName: "Acme Corp",
  woNumber: "WO-2025-001",
  assignedStaffName: "Ahmed Ali",
  assignedStaffPhone: "+971501234567",
};

// Helper: find a field by key across all zones
function findField(fields: ReturnType<typeof buildWalletPassFields>, key: string) {
  const all = [
    ...fields.header,
    ...fields.primary,
    ...fields.secondary,
    ...fields.auxiliary,
    ...fields.back,
  ];
  return all.find(f => f.key === key);
}

describe("buildWalletPassFields — Medical appointment", () => {
  const fields = buildWalletPassFields({ ...BASE_OPTS, appointmentType: "Medical" });

  it("sets description to Medical Fitness Appointment", () => {
    assert.equal(fields.description, "Medical Fitness Appointment");
  });

  it("sets QR message to the card URL", () => {
    assert.equal(fields.qrMessage, BASE_OPTS.cardUrl);
  });

  it("puts applicant name in primary fields", () => {
    const f = fields.primary.find(f => f.key === "applicant");
    assert.ok(f, "applicant field missing from primary");
    assert.equal(f!.value, "John Smith");
  });

  it("puts date in secondary fields", () => {
    const f = fields.secondary.find(f => f.key === "date");
    assert.ok(f, "date field missing from secondary");
    assert.match(f!.value, /2025/);
  });

  it("puts time in secondary fields", () => {
    const f = fields.secondary.find(f => f.key === "time");
    assert.ok(f, "time field missing from secondary");
    assert.match(f!.value, /am|pm/i);
  });

  it("puts center with area in auxiliary fields", () => {
    const f = fields.auxiliary.find(f => f.key === "center");
    assert.ok(f, "center field missing from auxiliary");
    assert.ok(f!.value.includes("Al Barsha Medical Centre"), `center value: ${f!.value}`);
    assert.ok(f!.value.includes("Al Barsha"), `area missing from center value: ${f!.value}`);
  });

  it("puts company name in auxiliary fields", () => {
    const f = fields.auxiliary.find(f => f.key === "company");
    assert.ok(f, "company field missing from auxiliary");
    assert.equal(f!.value, "Acme Corp");
  });

  it("puts WO number in back fields", () => {
    const f = fields.back.find(f => f.key === "ref");
    assert.ok(f, "ref field missing from back");
    assert.equal(f!.value, "WO-2025-001");
  });

  it("includes recommended arrival in back fields", () => {
    const f = fields.back.find(f => f.key === "arrival");
    assert.ok(f, "arrival field missing from back");
    assert.match(f!.value, /15 min before/i);
  });

  it("includes original passport requirement in back fields", () => {
    const f = fields.back.find(f => f.key === "document");
    assert.ok(f, "document field missing from back");
    assert.match(f!.value, /passport/i);
  });

  it("includes on-site assist with phone in back fields", () => {
    const f = fields.back.find(f => f.key === "assist");
    assert.ok(f, "assist field missing from back");
    assert.ok(f!.value.includes("Ahmed Ali"), `staff name missing: ${f!.value}`);
    assert.ok(f!.value.includes("+971501234567"), `phone missing: ${f!.value}`);
  });

  it("has Medical Fitness in header fields", () => {
    const f = fields.header.find(f => f.key === "type");
    assert.ok(f, "type field missing from header");
    assert.equal(f!.value, "Medical Fitness");
  });

  it("does not have guide_note field (EID-only)", () => {
    const f = findField(fields, "guide_note");
    assert.equal(f, undefined, "guide_note should not appear on Medical passes");
  });
});

describe("buildWalletPassFields — EID appointment", () => {
  const fields = buildWalletPassFields({ ...BASE_OPTS, appointmentType: "EID" });

  it("sets description to Emirates ID Biometrics", () => {
    assert.equal(fields.description, "Emirates ID Biometrics");
  });

  it("puts appointment time in primary fields", () => {
    const f = fields.primary.find(f => f.key === "time");
    assert.ok(f, "time field missing from primary");
    assert.match(f!.value, /am|pm/i);
  });

  it("puts date in secondary fields", () => {
    const f = fields.secondary.find(f => f.key === "date");
    assert.ok(f, "date field missing from secondary");
    assert.match(f!.value, /2025/);
  });

  it("puts center in auxiliary fields labelled Biometrics Center", () => {
    const f = fields.auxiliary.find(f => f.key === "center");
    assert.ok(f, "center field missing from auxiliary");
    assert.equal(f!.label, "Biometrics Center");
    assert.ok(f!.value.includes("Al Barsha Medical Centre"), `center value: ${f!.value}`);
  });

  it("puts applicant name in auxiliary fields", () => {
    const f = fields.auxiliary.find(f => f.key === "applicant");
    assert.ok(f, "applicant field missing from auxiliary");
    assert.equal(f!.value, "John Smith");
  });

  it("puts company name in auxiliary fields", () => {
    const f = fields.auxiliary.find(f => f.key === "company");
    assert.ok(f, "company field missing from auxiliary");
    assert.equal(f!.value, "Acme Corp");
  });

  it("includes Emirates ID in required documents back field", () => {
    const f = fields.back.find(f => f.key === "document");
    assert.ok(f, "document field missing from back");
    assert.match(f!.value, /Emirates ID/i);
    assert.match(f!.value, /passport/i);
  });

  it("includes guide with phone in back fields", () => {
    const f = fields.back.find(f => f.key === "guide");
    assert.ok(f, "guide field missing from back");
    assert.ok(f!.value.includes("Ahmed Ali"), `staff name missing: ${f!.value}`);
    assert.ok(f!.value.includes("+971501234567"), `phone missing: ${f!.value}`);
  });

  it("includes guide_note in back fields", () => {
    const f = fields.back.find(f => f.key === "guide_note");
    assert.ok(f, "guide_note field missing from back");
    assert.match(f!.value, /queue/i);
  });

  it("does not have type header field (Medical-only)", () => {
    const f = fields.header.find(f => f.key === "type");
    assert.equal(f, undefined, "type header should not appear on EID passes");
  });

  it("does not have assist field (EID uses guide instead)", () => {
    const f = findField(fields, "assist");
    assert.equal(f, undefined, "assist field should not appear on EID passes");
  });
});

describe("buildWalletPassFields — edge cases", () => {
  it("falls back to em-dash when applicant name is missing", () => {
    const fields = buildWalletPassFields({
      ...BASE_OPTS,
      appointmentType: "Medical",
      applicantName: null,
    });
    const f = fields.primary.find(f => f.key === "applicant");
    assert.ok(f);
    assert.equal(f!.value, "—");
  });

  it("shows center name only when area is absent", () => {
    const fields = buildWalletPassFields({
      ...BASE_OPTS,
      appointmentType: "EID",
      centerArea: null,
    });
    const f = fields.auxiliary.find(f => f.key === "center");
    assert.ok(f);
    assert.equal(f!.value, "Al Barsha Medical Centre");
  });

  it("omits company field when company is null", () => {
    const fields = buildWalletPassFields({
      ...BASE_OPTS,
      appointmentType: "Medical",
      companyName: null,
    });
    const f = findField(fields, "company");
    assert.equal(f, undefined, "company field should be omitted when no company");
  });

  it("falls back for unassigned staff on Medical", () => {
    const fields = buildWalletPassFields({
      ...BASE_OPTS,
      appointmentType: "Medical",
      assignedStaffName: null,
      assignedStaffPhone: null,
    });
    const f = fields.back.find(f => f.key === "assist");
    assert.ok(f);
    assert.match(f!.value, /Will be assigned/i);
  });

  it("falls back for unassigned guide on EID", () => {
    const fields = buildWalletPassFields({
      ...BASE_OPTS,
      appointmentType: "EID",
      assignedStaffName: null,
      assignedStaffPhone: null,
    });
    const f = fields.back.find(f => f.key === "guide");
    assert.ok(f);
    assert.match(f!.value, /Will be assigned/i);
  });

  it("uses staff name only when phone is absent", () => {
    const fields = buildWalletPassFields({
      ...BASE_OPTS,
      appointmentType: "Medical",
      assignedStaffPhone: null,
    });
    const f = fields.back.find(f => f.key === "assist");
    assert.ok(f);
    assert.equal(f!.value, "Ahmed Ali");
  });
});
