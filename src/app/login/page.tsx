import { LoginForm } from "@/components/cloud/login-form";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Sign in" description="We email you a one-time sign-in link. Use the address your club invited." />
      <LoginForm />
    </div>
  );
}
