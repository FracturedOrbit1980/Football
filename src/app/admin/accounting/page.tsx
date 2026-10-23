import { AccountingBoard } from "@/components/admin/accounting-board";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Accounting" };

export default function AccountingPage() {
  return (
    <div>
      <PageHeader
        title="Registration accounting"
        description="Set each player's season fee, record the money received and credit club sponsorship. Search the age analysis by name, ID, registration reference, mobile or guardian, and choose a bucket to chase the oldest accounts first."
      />
      <AccountingBoard />
    </div>
  );
}
