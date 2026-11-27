export function PageHeader({
  title,
  description,
  className = "",
}: {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <header className={`mb-5 ${className}`}>
      <h1 className="text-[clamp(1.6rem,1.15rem+1.5vw,2.4rem)] font-black tracking-tight text-slate-950">{title}</h1>
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-slate-700">{description}</p>
    </header>
  );
}
