export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  PassportCopy: "Passport Copy",
  Photo: "Photo",
  EntryPermit: "Entry Permit",
  ChangeStatus: "Change Status",
  CurrentResidency: "Current Residency Copy",
  OldResidencyOrId: "Old Residency/ID Copy",
  CurrentEmiratesId: "Current Emirates ID Copy",
  SponsorEmiratesId: "Sponsor Emirates ID Copy",
  BirthCertificate: "Birth Certificate",
  LostEmiratesId: "Lost Emirates ID Copy",
};

export const SERVICE_CATEGORY_LABELS: Record<string, string> = {
  NewVisaInside: "New Visa (Inside)",
  NewVisaOutside: "New Visa (Outside)",
  GoldenVisa: "Golden Visa",
  RenewVisa: "Renew Visa",
  NewbornDependent: "Newborn Dependent",
  LostReplaceEid: "Lost/Replace Emirates ID",
};

export type DocumentType = keyof typeof DOCUMENT_TYPE_LABELS;
export type ServiceCategory = keyof typeof SERVICE_CATEGORY_LABELS;
