import { PeopleBoard } from "@/components/admin/people-board";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "People" };

export default function PeoplePage() {
  return (
    <div>
      <PageHeader
        title="Registration"
        description="Search by name, ID, or mobile, then open a player to edit the record."
      />
      <PeopleBoard />
    </div>
  );
}
