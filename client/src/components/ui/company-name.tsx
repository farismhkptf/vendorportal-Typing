interface CompanyNameProps {
  className?: string;
  showTm?: boolean;
}

export function CompanyName({ className = "", showTm = true }: CompanyNameProps) {
  return (
    <span className={className} data-testid="text-company-name">
      The <span className="font-bold" style={{ color: "hsl(var(--logo-color))" }}>P.R.O.</span> Company{showTm && <span className="text-[0.65em] align-super">&#8482;</span>}
    </span>
  );
}
