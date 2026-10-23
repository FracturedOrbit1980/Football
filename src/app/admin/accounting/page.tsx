import { AccountingBoard } from "@/components/admin/accounting-board";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Accounting" };

export default function AccountingPage() {
  return (
    <div>
      <PageHeader
        title="Registration accounting"
        description="Set each player's season fee and record the money received. Filter by team to see what that squad still owes."
      />
      <AccountingBoard />
    </div>
  );
}
