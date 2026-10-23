import { ClubOverview } from "@/components/admin/club-overview";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Club admin" };

export default function AdminPage() {
  return (
    <div>
      <PageHeader
        title="Club overview"
        description="Open an age and a league here. Register players on People, set season fees on Accounting, then the head coach allocates players and runs drills and attendance."
      />
      <ClubOverview />
    </div>
  );
}
