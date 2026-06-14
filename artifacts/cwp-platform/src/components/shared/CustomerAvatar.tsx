import { User } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveMediaUrl } from "@/lib/media-url";

type Size = "xs" | "sm" | "md" | "lg";

const sizeClass: Record<Size, string> = {
  xs: "w-7 h-7",
  sm: "w-9 h-9",
  md: "w-12 h-12",
  lg: "w-16 h-16",
};

const iconSize: Record<Size, number> = {
  xs: 13,
  sm: 16,
  md: 20,
  lg: 24,
};

type Props = {
  name?: string;
  photoUrl?: string | null;
  size?: Size;
  className?: string;
};

export function CustomerAvatar({ name, photoUrl, size = "sm", className }: Props) {
  const src = resolveMediaUrl(photoUrl);
  return (
    <div
      className={cn(
        "rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden",
        sizeClass[size],
        className,
      )}
      title={name}
    >
      {src ? (
        <img src={src} alt={name ? `${name} photo` : "Customer"} className="w-full h-full object-cover" />
      ) : (
        <User size={iconSize[size]} className="text-primary" />
      )}
    </div>
  );
}
