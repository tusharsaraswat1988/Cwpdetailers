import { IndianRupee } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface WalletChipProps {
  balance: number;
  href?: string;
  lowBalance?: boolean;
  className?: string;
}

export function WalletChip({ balance, href = "/customer/wallet", lowBalance, className }: WalletChipProps) {
  const content = (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums transition-colors",
        lowBalance
          ? "bg-amber-500/10 text-amber-700 border border-amber-500/20"
          : "bg-primary/10 text-primary border border-primary/20",
        href && "hover:bg-primary/15",
        className,
      )}
    >
      <IndianRupee size={12} />
      {balance.toLocaleString("en-IN")}
    </span>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

export default WalletChip;
