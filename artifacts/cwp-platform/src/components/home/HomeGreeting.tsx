import { cn } from "@/lib/utils";

interface HomeGreetingProps {
  customerName?: string;
  className?: string;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatCustomerName(rawName?: string | null): string | null {
  if (!rawName) return null;
  const trimmed = rawName.trim();
  if (
    !trimmed ||
    trimmed.toLowerCase() === "there" ||
    trimmed.toLowerCase() === "undefined" ||
    trimmed.toLowerCase() === "null" ||
    trimmed.toLowerCase() === "customer"
  ) {
    return null;
  }
  const firstWord = trimmed.split(/\s+/)[0];
  if (
    !firstWord ||
    firstWord.toLowerCase() === "there" ||
    firstWord.toLowerCase() === "undefined" ||
    firstWord.toLowerCase() === "null" ||
    firstWord.toLowerCase() === "customer"
  ) {
    return null;
  }
  return firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
}

export function HomeGreeting({ customerName, className }: HomeGreetingProps) {
  const greeting = getGreeting();
  const displayName = formatCustomerName(customerName);

  return (
    <div className={cn("py-0.5", className)} data-testid="home-greeting">
      <h1 className="font-display font-bold text-lg sm:text-xl text-foreground tracking-tight flex items-center gap-1.5 leading-tight">
        <span>{greeting}{displayName ? "," : ""}</span>
        {displayName && <span className="text-primary">{displayName}</span>}
      </h1>
    </div>
  );
}

export default HomeGreeting;
