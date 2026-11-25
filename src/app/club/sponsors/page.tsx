import { ClubSponsors } from "@/components/cloud/club-sponsors";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Sponsors and branding" };

export default function Page() {
  return (
    <div>
      <PageHeader title="Sponsors and branding" description="Sponsor records and logos, plus this club's watermark and backdrop for pitches, tactics boards, and the app." />
      <ClubSponsors />
    </div>
  );
}
