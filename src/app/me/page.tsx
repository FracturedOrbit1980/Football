import { PlayerPortal } from "@/components/cloud/player-portal";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "My player portal" };

export default function Page() {
  return (
    <div>
      <PageHeader title="My player portal" description="Your own player record, ratings, kit, and subs. Nobody else's." />
      <PlayerPortal />
    </div>
  );
}
