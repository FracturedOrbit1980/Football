import { ClubFinance } from "@/components/cloud/club-finance";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Finance" };

export default function Page() {
  return (
    <div>
      <PageHeader title="Finance" description="Budget lines, kit allocation, and subs per player. Run statements for everyone or a filtered group." />
      <ClubFinance />
    </div>
  );
}
