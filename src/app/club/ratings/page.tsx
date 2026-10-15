import { ClubRatings } from "@/components/cloud/club-ratings";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Player ratings" };

export default function Page() {
  return (
    <div>
      <PageHeader title="Player ratings" description="Rate players in your own teams. You can add, change, and delete ratings." />
      <ClubRatings />
    </div>
  );
}
