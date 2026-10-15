import { ClubPlayers } from "@/components/cloud/club-players";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Players" };

export default function Page() {
  return (
    <div>
      <PageHeader title="Players" description="Register players with a guardian, issue player cards, and invite families to the player portal." />
      <ClubPlayers />
    </div>
  );
}
