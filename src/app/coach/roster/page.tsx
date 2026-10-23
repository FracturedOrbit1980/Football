import { RosterBoard } from "@/components/coach/roster-board";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Squad" };

export default function RosterPage() {
  return (
    <div>
      <PageHeader
        title="Squad"
        description="Allocate registered players to your team, set positions, save ratings and attendance, and protect each profile with a PIN."
      />
      <RosterBoard />
    </div>
  );
}
