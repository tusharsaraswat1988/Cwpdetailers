import { Badge } from "@/components/ui/badge";
import type { CustomerProfile } from "@workspace/customer-model";

type Props = {
  profile?: CustomerProfile | null;
  max?: number;
  className?: string;
};

function toneClass(tone: string) {
  switch (tone) {
    case "primary":
      return "text-primary border-primary/30 bg-primary/5";
    case "success":
      return "text-green-600 border-green-600/30 bg-green-600/5";
    case "secondary":
      return "text-blue-600 border-blue-600/30 bg-blue-600/5";
    default:
      return "text-muted-foreground";
  }
}

export function CustomerPersonaBadges({ profile, max = 4, className }: Props) {
  if (!profile?.labels.badges.length) return null;

  const badges = profile.labels.badges.slice(0, max);
  const overflow = profile.labels.badges.length - badges.length;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className ?? ""}`}>
      {badges.map(b => (
        <Badge
          key={b.id}
          variant="outline"
          className={`text-xs font-normal ${toneClass(b.tone)}`}
        >
          {b.label}
        </Badge>
      ))}
      {overflow > 0 && (
        <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
          +{overflow}
        </Badge>
      )}
    </div>
  );
}

export function CustomerPersonaSummary({ profile }: { profile?: CustomerProfile | null }) {
  if (!profile) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm">
      <p className="font-medium">{profile.labels.primary}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{profile.labels.description}</p>
      <CustomerPersonaBadges profile={profile} max={6} className="mt-2" />
    </div>
  );
}
