import { MembersBoard } from "@/components/admin/members-board";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Members" };

export default function MembersPage() {
  return (
    <div>
      <PageHeader
        title="Member management"
        description="Search a member, then send a statement, agree instalments, or record a promise to pay."
      />
      <MembersBoard />
    </div>
  );
}
