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

export function HomeGreeting({ customerName, className }: HomeGreetingProps) {
  const greeting = getGreeting();
  const firstName = customerName ? customerName.trim().split(" ")[0] : "there";

  return (
    <div className={className} data-testid="home-greeting">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {greeting},
      </p>
      <h1 className="font-display font-bold text-2xl sm:text-3xl text-foreground tracking-tight mt-0.5">
        {firstName}
      </h1>
    </div>
  );
}

export default HomeGreeting;
