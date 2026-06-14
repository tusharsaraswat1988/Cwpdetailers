import { useState, type ReactNode } from "react";
import { downloadInvoicePdf } from "../downloadInvoicePdf";
import { useToast } from "@/hooks/use-toast";

type Props = {
  invoiceId: number;
  invoiceNumber?: string | null;
  className?: string;
  children?: ReactNode;
  title?: string;
  "data-testid"?: string;
};

export function InvoicePdfButton({ invoiceId, invoiceNumber, className, children, title = "Download PDF", "data-testid": testId }: Props) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      await downloadInvoicePdf(invoiceId, invoiceNumber);
    } catch (err) {
      toast({
        title: "PDF download failed",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      title={title}
      data-testid={testId}
      className={className ?? "text-xs text-primary hover:underline flex items-center gap-1 disabled:opacity-50"}
    >
      {children ?? (loading ? "Opening…" : "PDF")}
    </button>
  );
}
