import { ClubHome } from "@/components/cloud/club-home";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Club" };

export default function Page() {
  return (
    <div>
      <PageHeader title="Club" description="Choose your club and open the screens your role allows." />
      <ClubHome />
    </div>
  );
}
