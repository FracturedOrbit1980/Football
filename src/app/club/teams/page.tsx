import { ClubTeams } from "@/components/cloud/club-teams";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Teams and staff" };

export default function Page() {
  return (
    <div>
      <PageHeader title="Teams and staff" description="Create teams, give each team a coach, a manager, and an optional fitness lead, and invite people by email." />
      <ClubTeams />
    </div>
  );
}
