import { PeopleBoard } from "@/components/admin/people-board";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "People" };

export default function PeoplePage() {
  return (
    <div>
      <PageHeader
        title="Registration"
        description="Register every player with an ID and mobile, search the register by reference or name, and keep their correspondence history together. The head coach allocates them to a team and league, then manages ratings and attendance."
      />
      <PeopleBoard />
    </div>
  );
}
