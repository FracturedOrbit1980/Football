import { SessionPlanner } from "@/components/coach/session-planner";
import { TeamPicker } from "@/components/coach/team-picker";
import { ActionCard } from "@/components/layout/action-card";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Coach" };

export default function CoachPage() {
  return (
    <div>
      <PageHeader
        title="Coach this team"
        description="Pick the age and division, then open the squad, a drill, or the match."
      />
      <div className="mb-6 grid grid-cols-2 gap-3">
        <ActionCard href="/coach/roster" title="Squad" detail="Open one player for their rating, details, and training week." />
        <ActionCard href="/coach/drills" title="Run a drill" detail="Pick an age, then a skill level, and start the session clock." />
        <ActionCard href="/coach/editor" title="Drill editor" detail="Lay out the practice, record frames, and save the animation." />
        <ActionCard href="/coach/match" title="Live match" detail="Place the allocated squad and keep the clock for players on the pitch." />
      </div>
      <TeamPicker />
      <SessionPlanner />
    </div>
  );
}
