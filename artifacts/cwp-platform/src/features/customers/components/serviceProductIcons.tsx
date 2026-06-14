import {
  Sparkles,
  Package,
  Sun,
  Car,
  Calendar,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import type { ServiceProductId } from "@workspace/customer-model";

const ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  package: Package,
  sun: Sun,
  car: Car,
  calendar: Calendar,
  clipboard: ClipboardList,
};

export function serviceProductIcon(iconKey: string): LucideIcon {
  return ICONS[iconKey] ?? Car;
}

export function ServiceProductIcon({
  iconKey,
  size = 14,
  className,
}: {
  productId?: ServiceProductId;
  iconKey?: string;
  size?: number;
  className?: string;
}) {
  const Icon = serviceProductIcon(iconKey ?? "car");
  return <Icon size={size} className={className} />;
}
