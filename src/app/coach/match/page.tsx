import { LiveMatchTracker } from "@/components/match/live-match-tracker";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Live match" };

export default function MatchPage() {
  return (
    <div>
      <PageHeader
        className="match-title"
        title="Live match"
        description="Pick a shape, start the clock, then tap a pitch player and a bench player to substitute."
      />
      <LiveMatchTracker />
    </div>
  );
}
