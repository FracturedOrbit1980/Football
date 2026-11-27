import { ClubOverview } from "@/components/admin/club-overview";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Club admin" };

export default function AdminPage() {
  return (
    <div>
      <PageHeader
        title="Club overview"
        description="Pick an age and a division. Register players on People, set fees under Fees, and send statements on Members."
      />
      <ClubOverview />
    </div>
  );
}
