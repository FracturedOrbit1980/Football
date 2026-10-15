import { PlatformAdmin } from "@/components/cloud/platform-admin";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Platform" };

export default function Page() {
  return (
    <div>
      <PageHeader title="Platform" description="Create clubs and invite each club's first admin. Platform admins cannot see player data." />
      <PlatformAdmin />
    </div>
  );
}
