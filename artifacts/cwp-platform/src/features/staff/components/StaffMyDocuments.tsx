import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRequestUploadUrl } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { uploadFileToCloudinary, resolveMediaUrl } from "@/lib/media-url";
import {
  staffEcosystemApi,
  STAFF_ECOSYSTEM_QUERY_KEY,
  DOC_LABELS,
  MANDATORY_DOCS,
  type StaffDocument,
  type StaffMeProfile,
} from "@/lib/staff-ecosystem/api";
import { Download, Eye, Upload, FileText } from "lucide-react";

function StaffDocumentCard({
  label,
  docType,
  doc,
  onUpload,
}: {
  label: string;
  docType: string;
  doc?: StaffDocument;
  onUpload: (file: File, docId?: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Card className={doc ? "" : "border-dashed"}>
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-xs flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <FileText size={12} className="text-primary" />
            {label}
          </span>
          {doc?.isExpired && <Badge variant="destructive" className="text-[9px]">Expired</Badge>}
          {!doc && MANDATORY_DOCS.includes(docType) && (
            <Badge variant="secondary" className="text-[9px]">Required</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-2">
        {doc ? (
          <>
            {doc.documentNumber && <p className="text-[10px] text-muted-foreground">#{doc.documentNumber}</p>}
            {doc.expiryDate && <p className="text-[10px] text-muted-foreground">Expires {doc.expiryDate}</p>}
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="outline" className="h-7 text-[10px]" asChild>
                <a href={resolveMediaUrl(doc.fileUrl)} target="_blank" rel="noreferrer">
                  <Eye size={10} className="mr-1" />View
                </a>
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[10px]" asChild>
                <a href={resolveMediaUrl(doc.fileUrl)} download target="_blank" rel="noreferrer">
                  <Download size={10} className="mr-1" />Download
                </a>
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => inputRef.current?.click()}>
                <Upload size={10} className="mr-1" />Replace
              </Button>
            </div>
          </>
        ) : (
          <Button size="sm" variant="secondary" className="w-full h-8 text-xs" onClick={() => inputRef.current?.click()}>
            <Upload size={12} className="mr-1" />Upload document
          </Button>
        )}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) onUpload(f, doc?.id);
            e.target.value = "";
          }}
        />
      </CardContent>
    </Card>
  );
}

const DOC_TYPES = [
  ...MANDATORY_DOCS,
  "staff_consent_form",
  "vehicle_insurance",
  "vehicle_registration",
  "police_verification",
  "medical_certificate",
];

export function StaffMyDocuments({ profile }: { profile: StaffMeProfile }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const requestUpload = useRequestUploadUrl();

  const uploadMutation = useMutation({
    mutationFn: async ({ file, documentType, docId }: { file: File; documentType: string; docId?: number }) => {
      const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
      if (!allowed.includes(file.type)) throw new Error("Use PDF, JPG, PNG, or WEBP");

      const presign = await requestUpload.mutateAsync({
        data: { name: file.name, size: file.size, contentType: file.type },
      });
      const url = await uploadFileToCloudinary(file, presign as Parameters<typeof uploadFileToCloudinary>[1]);

      if (docId) {
        return staffEcosystemApi.replaceMyDocument(docId, {
          fileUrl: url,
          contentType: file.type,
          fileSizeBytes: file.size,
        });
      }
      return staffEcosystemApi.uploadMyDocument({
        documentType,
        fileUrl: url,
        contentType: file.type,
        fileSizeBytes: file.size,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, "me-profile"] });
      toast({ title: "Document uploaded", description: "Admin will review your updated documents." });
    },
    onError: (err: Error) =>
      toast({ title: "Upload failed", description: err.message, variant: "destructive" }),
  });

  const docMap = Object.fromEntries(profile.documents.map(d => [d.documentType, d]));

  return (
    <section className="space-y-3" data-testid="staff-my-documents">
      <div>
        <h2 className="text-sm font-semibold">My Documents</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Upload missing compliance documents. Admin verifies before assignments.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {DOC_TYPES.map(docType => (
          <StaffDocumentCard
            key={docType}
            docType={docType}
            label={DOC_LABELS[docType] ?? docType}
            doc={docMap[docType]}
            onUpload={(file, docId) =>
              uploadMutation.mutate({ file, documentType: docType, docId })
            }
          />
        ))}
      </div>
    </section>
  );
}
