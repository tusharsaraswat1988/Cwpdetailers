import { useCallback, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resolveMediaUrl, uploadFileToCloudinary } from "@/lib/media-url";
import { cn } from "@/lib/utils";
import { ImagePlus, Loader2, Link2, X } from "lucide-react";

const ACCEPT = "image/jpeg,image/png,image/webp";
const ACCEPT_LABEL = "JPG, PNG, or WebP";
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_LABEL = "5 MB";

type Props = {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
  /** Allow pasting an external URL as a secondary option. Default true. */
  allowUrlPaste?: boolean;
};

async function requestUploadUrl(file: File) {
  const res = await fetch("/api/storage/uploads/request-url", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || "image/jpeg" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Upload not available. Check Cloudinary configuration.");
  }
  return res.json();
}

function validateImageFile(file: File): string | null {
  const typeOk =
    ACCEPT.split(",").includes(file.type) ||
    /\.(jpe?g|png|webp)$/i.test(file.name);
  if (!typeOk) return `Use ${ACCEPT_LABEL} only.`;
  if (file.size > MAX_BYTES) return `File is too large. Max size is ${MAX_LABEL}.`;
  if (file.size < 1) return "File is empty.";
  return null;
}

export function ImageDropzone({
  value,
  onChange,
  label = "Service image",
  disabled,
  className,
  allowUrlPaste = true,
}: Props) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUrl, setShowUrl] = useState(false);

  const preview = resolveMediaUrl(value);

  const upload = useCallback(async (file: File) => {
    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const presign = await requestUploadUrl(file);
      const url = await uploadFileToCloudinary(file, presign);
      onChange(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [onChange]);

  const onFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file || disabled || uploading) return;
    void upload(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    if (disabled || uploading) return;
    onFiles(e.dataTransfer.files);
  };

  if (preview) {
    return (
      <div className={cn("space-y-1.5", className)} data-testid="image-dropzone">
        <Label>{label}</Label>
        <div className="relative rounded-xl border border-border overflow-hidden bg-muted/30">
          <img
            src={preview}
            alt="Service preview"
            className="w-full h-40 object-cover"
            data-testid="image-dropzone-preview"
          />
          {!disabled && (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="absolute top-2 right-2 h-8 w-8 rounded-full shadow-md bg-background/95 hover:bg-background"
              onClick={() => { onChange(""); setError(null); }}
              aria-label="Remove image"
              data-testid="image-dropzone-remove"
            >
              <X size={16} />
            </Button>
          )}
          {!disabled && (
            <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/55 to-transparent">
              <button
                type="button"
                className="text-xs text-white/90 hover:text-white underline-offset-2 hover:underline"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? "Uploading…" : "Replace image"}
              </button>
            </div>
          )}
        </div>
        <input
          ref={fileRef}
          id={inputId}
          type="file"
          accept={ACCEPT}
          className="hidden"
          disabled={disabled || uploading}
          onChange={e => {
            onFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)} data-testid="image-dropzone">
      <Label htmlFor={inputId}>{label}</Label>

      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={e => {
          if (disabled || uploading) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileRef.current?.click();
          }
        }}
        onDragEnter={e => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={e => { e.preventDefault(); setDragging(false); }}
        onDrop={onDrop}
        onClick={() => { if (!disabled && !uploading) fileRef.current?.click(); }}
        className={cn(
          "relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors cursor-pointer",
          "hover:border-primary/50 hover:bg-primary/5",
          dragging && "border-primary bg-primary/10",
          (disabled || uploading) && "opacity-60 cursor-not-allowed pointer-events-none",
          error ? "border-destructive/50" : "border-border",
        )}
        data-testid="image-dropzone-area"
      >
        {uploading ? (
          <Loader2 size={28} className="animate-spin text-primary" />
        ) : (
          <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
            <ImagePlus size={22} className="text-primary" />
          </div>
        )}
        <div className="space-y-0.5">
          <p className="text-sm font-medium">
            {uploading ? "Uploading image…" : dragging ? "Drop to upload" : "Drop image here, or browse"}
          </p>
          <p className="text-xs text-muted-foreground">
            {ACCEPT_LABEL} · up to {MAX_LABEL}
          </p>
        </div>
        {!uploading && (
          <span className="text-xs font-medium text-primary">Upload image</span>
        )}
      </div>

      <input
        ref={fileRef}
        id={inputId}
        type="file"
        accept={ACCEPT}
        className="hidden"
        disabled={disabled || uploading}
        onChange={e => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}

      {allowUrlPaste && !disabled && (
        <div>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowUrl(v => !v)}
          >
            <Link2 size={12} />
            {showUrl ? "Hide link option" : "Or paste an image link"}
          </button>
          {showUrl && (
            <Input
              className="mt-1.5"
              value={value}
              onChange={e => { onChange(e.target.value); setError(null); }}
              placeholder="https://…"
              data-testid="image-dropzone-url"
            />
          )}
        </div>
      )}
    </div>
  );
}
