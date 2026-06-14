import { useEffect, useRef, useState } from "react";
import { useRequestUploadUrl } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Camera, Loader2, Trash2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveMediaUrl, uploadFileToCloudinary } from "@/lib/media-url";
import { CustomerAvatar } from "./CustomerAvatar";

type Size = "sm" | "md" | "lg";

type Props = {
  customerId: number;
  name?: string;
  photoUrl?: string | null;
  editable?: boolean;
  size?: Size;
  onUpdated?: (photoUrl: string | null) => void;
  className?: string;
  testIdPrefix?: string;
};

async function patchCustomerPhoto(customerId: number, photoUrl: string | null) {
  const res = await fetch(`/api/customers/${customerId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ photoUrl }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to update photo");
  }
  return res.json();
}

export function CustomerPhotoEditor({
  customerId,
  name,
  photoUrl,
  editable = true,
  size = "md",
  onUpdated,
  className,
  testIdPrefix = "customer-photo",
}: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const requestUpload = useRequestUploadUrl();
  const [busy, setBusy] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string | null | undefined>(photoUrl);

  useEffect(() => {
    setCurrentUrl(photoUrl);
  }, [photoUrl]);

  const displayUrl = currentUrl !== undefined ? currentUrl : photoUrl;
  const hasPhoto = Boolean(resolveMediaUrl(displayUrl));

  const uploadFile = async (file: File) => {
    setBusy(true);
    try {
      const presign = await requestUpload.mutateAsync({
        data: { name: file.name, size: file.size, contentType: file.type },
      });
      const secureUrl = await uploadFileToCloudinary(file, presign);
      await patchCustomerPhoto(customerId, secureUrl);
      setCurrentUrl(secureUrl);
      onUpdated?.(secureUrl);
      toast({ title: hasPhoto ? "Photo updated" : "Photo added" });
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Could not save photo",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removePhoto = async () => {
    setBusy(true);
    try {
      await patchCustomerPhoto(customerId, null);
      setCurrentUrl(null);
      onUpdated?.(null);
      toast({ title: "Photo removed" });
    } catch (err) {
      toast({
        title: "Remove failed",
        description: err instanceof Error ? err.message : "Could not remove photo",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  if (!editable) {
    return (
      <CustomerAvatar name={name} photoUrl={displayUrl} size={size} className={className} />
    );
  }

  return (
    <div className={cn("flex items-center gap-3", className)} data-testid={`${testIdPrefix}-editor`}>
      <button
        type="button"
        className="relative rounded-full group disabled:opacity-60"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        aria-label={hasPhoto ? "Change profile photo" : "Upload profile photo"}
        data-testid={`${testIdPrefix}-trigger`}
      >
        {hasPhoto ? (
          <CustomerAvatar name={name} photoUrl={displayUrl} size={size} />
        ) : (
          <div className={cn(
            "rounded-full bg-primary/10 flex items-center justify-center border-2 border-dashed border-primary/30",
            size === "lg" ? "w-16 h-16" : size === "md" ? "w-12 h-12" : "w-9 h-9",
          )}>
            <User size={size === "lg" ? 24 : size === "md" ? 20 : 16} className="text-primary" />
          </div>
        )}
        <span className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          {busy ? <Loader2 size={18} className="text-white animate-spin" /> : <Camera size={18} className="text-white" />}
        </span>
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) void uploadFile(file);
        }}
        data-testid={`${testIdPrefix}-input`}
      />

      <div className="flex flex-col gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          data-testid={`${testIdPrefix}-upload-btn`}
        >
          {busy ? "Uploading…" : hasPhoto ? "Change photo" : "Upload photo"}
        </Button>
        {hasPhoto && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => void removePhoto()}
            className="text-destructive hover:text-destructive h-8"
            data-testid={`${testIdPrefix}-remove-btn`}
          >
            <Trash2 size={14} className="mr-1.5" />Remove
          </Button>
        )}
      </div>
    </div>
  );
}
