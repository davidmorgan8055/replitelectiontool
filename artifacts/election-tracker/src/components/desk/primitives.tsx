import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtMargin, marginParty, type Party } from "@/lib/election";

export const partyText: Record<Party, string> = {
  D: "text-[hsl(var(--dem))]",
  R: "text-[hsl(var(--rep))]",
  I: "text-foreground",
  O: "text-foreground",
};

export function PartyChip({ party }: { party: Party }) {
  const cls =
    party === "D"
      ? "bg-[hsl(var(--dem))] text-white"
      : party === "R"
        ? "bg-[hsl(var(--rep))] text-white"
        : "bg-muted text-foreground border border-border";
  return (
    <span aria-label={party === "D" ? "Democrat" : party === "R" ? "Republican" : party === "I" ? "Independent" : "Other"}
      className={cn("inline-grid h-4 w-4 shrink-0 place-items-center rounded-[3px] font-mono text-[10px] font-bold leading-none", cls)}>
      {party === "O" ? "\u00b7" : party}
    </span>
  );
}

export function Margin({ value, className, testId }: { value: number | null; className?: string; testId?: string }) {
  const p = marginParty(value);
  return (
    <span data-testid={testId} className={cn("tabnum font-mono font-semibold", p ? partyText[p] : "text-muted-foreground", className)}>
      {fmtMargin(value)}
    </span>
  );
}

export function SourceLink({ href, children, testId }: { href: string; children: ReactNode; testId?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" data-testid={testId}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground underline decoration-border underline-offset-2 transition-colors hover:text-foreground hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-ring rounded-sm">
      {children}
      <ExternalLink className="h-3 w-3" aria-hidden />
    </a>
  );
}

export function Panel({ title, kicker, children, className, id, aside }: { title: string; kicker?: string; children: ReactNode; className?: string; id?: string; aside?: ReactNode }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-h` : undefined} className={cn("rounded-lg border border-card-border bg-card", className)}>
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3 sm:px-5">
        <div>
          {kicker && <p className="eyebrow">{kicker}</p>}
          <h2 id={id ? `${id}-h` : undefined} className="text-base font-semibold tracking-tight">{title}</h2>
        </div>
        {aside}
      </header>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  );
}
