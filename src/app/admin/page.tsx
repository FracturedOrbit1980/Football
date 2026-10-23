import { ClubOverview } from "@/components/admin/club-overview";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Club admin" };

export default function AdminPage() {
  return (
    <div>
      <PageHeader
        title="Club overview"
        description="Every registered club is listed with its players and balances. Open a club, then open an age and a league, register players on People, set season fees on Accounting, and let the head coach allocate players and run drills and attendance."
      />
      <ClubOverview />
    </div>
  );
}
