import Link from "next/link";

export function ActionCard({
  href,
  title,
  detail,
}: {
  href: string;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-16 min-w-0 flex-col justify-center rounded-xl bg-white px-4 py-3 text-left ring-1 ring-slate-300 hover:ring-slate-950"
    >
      <span className="text-base font-bold text-slate-950">{title}</span>
      <span className="mt-1 text-sm font-medium text-slate-600">{detail}</span>
    </Link>
  );
}
