import { MembersBoard } from "@/components/admin/members-board";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Members" };

export default function MembersPage() {
  return (
    <div>
      <PageHeader
        title="Member management"
        description="Search every member by name, surname, ID number, registration reference, mobile number or guardian details. Send statements in bulk, agree instalment plans over a time frame, record promises to pay, and sponsor a player's fee."
      />
      <MembersBoard />
    </div>
  );
}
