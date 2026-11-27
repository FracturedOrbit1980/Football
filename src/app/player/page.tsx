import { PageHeader } from "@/components/layout/page-header";
import { PlayerHome } from "@/components/player/player-home";

export const metadata = { title: "Player" };

export default function PlayerPage() {
  return (
    <div>
      <PageHeader
        title="My game"
        description="Choose your name and PIN to see ratings, homework, and attendance."
      />
      <PlayerHome />
    </div>
  );
}
