import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useUpdateCustomer } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetCustomerQueryKey, getListCustomersQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Archive } from "lucide-react";
import { apiToFounderStatus } from "@/lib/customerStatus";

type Props = {
  customerId: number;
  customerName: string;
  status: "active" | "inactive" | "suspended";
};

export function ArchiveCustomerButton({ customerId, customerName, status }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const founderStatus = apiToFounderStatus(status);

  const archiveMutation = useUpdateCustomer({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetCustomerQueryKey(customerId) });
        qc.invalidateQueries({ queryKey: getListCustomersQueryKey() });
        toast({ title: "Customer archived", description: "Removed from daily operations. History is preserved." });
        setOpen(false);
      },
      onError: (err: Error) => {
        toast({ title: "Could not archive", description: err.message, variant: "destructive" });
      },
    },
  });

  if (founderStatus === "archived") {
    return (
      <BadgeArchived />
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-amber-700 border-amber-500/30" data-testid="btn-archive-customer">
          <Archive size={14} className="mr-1.5" />Archive Customer
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive {customerName}?</AlertDialogTitle>
          <AlertDialogDescription>
            Archived customers are hidden from daily operations. Bookings, invoices, payments, and complaints stay on file.
            Use this for duplicates, test records, or merged profiles — not for customers who simply stopped services (mark those Inactive instead).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => archiveMutation.mutate({ id: customerId, data: { status: "suspended" } as { status: "suspended" } })}
            disabled={archiveMutation.isPending}
          >
            {archiveMutation.isPending ? "Archiving…" : "Archive"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function BadgeArchived() {
  return (
    <span className="inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700">
      Archived
    </span>
  );
}
