export const VALID_COMPANIES = [
  "PT Telkom Infrastruktur Indonesia",
  "PT Telkom Akses",
  "PT Fiberhome",
  "PT. Telkomsel",
] as const;

export type Company = (typeof VALID_COMPANIES)[number];
