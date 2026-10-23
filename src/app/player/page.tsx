import { PageHeader } from "@/components/layout/page-header";
import { PlayerHome } from "@/components/player/player-home";

export const metadata = { title: "Player" };

export default function PlayerPage() {
  return (
    <div>
      <PageHeader
        title="My game"
        description="Choose your name and enter your PIN to open your own ratings, feedback, and attendance. Your coach keeps this profile private."
      />
      <PlayerHome />
    </div>
  );
}
