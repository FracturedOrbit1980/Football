/** Bump when the privacy notice text changes; consents record the version shown. */
export const PRIVACY_POLICY_VERSION = "2026-10-15";

export interface PrivacyNoticeSettings {
  club_name: string | null;
  responsible_party: string | null;
  physical_address: string | null;
  info_officer_name: string | null;
  info_officer_email: string | null;
  info_officer_phone: string | null;
  hosting_region: string | null;
  retention_months: number | null;
  policy_version: string | null;
}

export const INFORMATION_REGULATOR = {
  name: "Information Regulator (South Africa)",
  address: "Woodmead North Office Park, 54 Maxwell Drive, Woodmead, Johannesburg, 2191",
  postal: "P.O. Box 31533, Braamfontein, Johannesburg, 2017",
  phone: "010 023 5200 (toll free 0800 017 160)",
  enquiries: "enquiries@inforegulator.org.za",
  complaints: "POPIAComplaints@inforegulator.org.za",
  website: "https://inforegulator.org.za",
};
