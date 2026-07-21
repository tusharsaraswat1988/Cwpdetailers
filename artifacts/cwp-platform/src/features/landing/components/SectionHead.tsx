import { cn } from "@/lib/utils";
import { Reveal } from "../lib/Reveal";

type SectionHeadProps = {
  eyebrow: string;
  title: string;
  desc?: string;
  align?: "left" | "center";
  className?: string;
};

/** Shared eyebrow + title + optional description for landing sections. */
export function SectionHead({
  eyebrow,
  title,
  desc,
  align = "left",
  className,
}: SectionHeadProps) {
  return (
    <Reveal
      className={cn(
        "max-w-2xl",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--landing-accent)]">
        {eyebrow}
      </p>
      <h2 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
        {title}
      </h2>
      {desc ? (
        <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
          {desc}
        </p>
      ) : null}
    </Reveal>
  );
}
