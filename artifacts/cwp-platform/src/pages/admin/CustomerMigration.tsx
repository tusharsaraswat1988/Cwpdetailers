import { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, Play, Eye, Download } from "lucide-react";
import { importCustomerMigration, previewCustomerMigration, migrationSampleDownloadUrl } from "@/features/customers/api";
import { Can } from "@/components/Can";

type PreviewData = {
  summary: { customers: number; errors: number; warnings: number };
  canImport: boolean;
  sheets: {
    Customers: {
      errors: Array<{ row: number; message: string; severity: string }>;
      warnings: Array<{ row: number; message: string; severity: string }>;
    };
  };
};

type ImportResult = {
  dryRun: boolean;
  created: number;
  updated: number;
  skipped: number;
  usersCreated: number;
  batchId: number | null;
  issues: Array<{ row: number; message: string; severity: string }>;
};

export default function AdminCustomerMigration() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState<"preview" | "dry" | "import" | null>(null);

  const runPreview = async () => {
    if (!file) return;
    setBusy("preview");
    try {
      const data = await previewCustomerMigration(file);
      setPreview(data);
      setResult(null);
      toast({ title: "Preview ready", description: `${data.summary.customers} rows · ${data.summary.errors} errors` });
    } catch (err) {
      toast({ title: "Preview failed", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const runImport = async (dryRun: boolean) => {
    if (!file) return;
    setBusy(dryRun ? "dry" : "import");
    try {
      const data = await importCustomerMigration(file, dryRun);
      setResult(data);
      toast({
        title: dryRun ? "Dry run complete" : "Import committed",
        description: `Created ${data.created}, updated ${data.updated}, logins ${data.usersCreated}`,
      });
    } catch (err) {
      toast({ title: "Import failed", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-5 max-w-3xl">
        <PageHeader
          title="Customer migration"
          description="Import legacy customers from Excel. Use legacy_segment=legacy_contact for old phone-only contacts."
        />

        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-4 text-sm space-y-2">
            <p className="font-medium">Legacy contacts (phone-only, dormant)</p>
            <p className="text-muted-foreground">
              Set <code className="bg-muted px-1 rounded text-xs">status=inactive</code>,{" "}
              <code className="bg-muted px-1 rounded text-xs">legacy_segment=legacy_contact</code>,{" "}
              <code className="bg-muted px-1 rounded text-xs">create_login=N</code>.
              Name can be a placeholder if unknown. After import, message them from{" "}
              <strong>Legacy Contacts</strong> or Communication Center audience &quot;Legacy Contacts (Dormant)&quot;.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet size={16} /> Upload workbook
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={e => {
                setFile(e.target.files?.[0] ?? null);
                setPreview(null);
                setResult(null);
              }}
              data-testid="input-migration-file"
            />
            {file && <p className="text-sm text-muted-foreground">{file.name} · {(file.size / 1024).toFixed(1)} KB</p>}
            <Button variant="outline" size="sm" asChild data-testid="btn-download-migration-sample">
              <a href={migrationSampleDownloadUrl()} download="customer-import-template.xlsx">
                <Download size={14} className="mr-1.5" /> Download sample template
              </a>
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={!file || busy !== null} onClick={() => void runPreview()}>
                <Eye size={14} className="mr-1.5" />
                {busy === "preview" ? "Previewing…" : "Preview"}
              </Button>
              <Can resource="customers" action="create">
                <Button variant="outline" disabled={!file || !preview?.canImport || busy !== null} onClick={() => void runImport(true)}>
                  <Play size={14} className="mr-1.5" />
                  {busy === "dry" ? "Running…" : "Dry run"}
                </Button>
                <Button disabled={!file || !preview?.canImport || busy !== null} className="bg-primary text-secondary" onClick={() => void runImport(false)}>
                  <Upload size={14} className="mr-1.5" />
                  {busy === "import" ? "Importing…" : "Commit import"}
                </Button>
              </Can>
            </div>
          </CardContent>
        </Card>

        {preview && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Preview summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{preview.summary.customers} customers</Badge>
                <Badge variant={preview.summary.errors ? "destructive" : "outline"}>{preview.summary.errors} errors</Badge>
                <Badge variant="outline">{preview.summary.warnings} warnings</Badge>
                <Badge className={preview.canImport ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}>
                  {preview.canImport ? "Ready to import" : "Fix errors first"}
                </Badge>
              </div>
              {[...preview.sheets.Customers.errors, ...preview.sheets.Customers.warnings].slice(0, 20).map((issue, i) => (
                <p key={i} className="text-muted-foreground">
                  Row {issue.row}: {issue.message}
                </p>
              ))}
            </CardContent>
          </Card>
        )}

        {result && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{result.dryRun ? "Dry run result" : "Import result"}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>Created: {result.created} · Updated: {result.updated} · Logins: {result.usersCreated}</p>
              {result.batchId && <p className="text-muted-foreground">Batch #{result.batchId}</p>}
              {result.issues.slice(0, 10).map((issue, i) => (
                <p key={i} className="text-muted-foreground">Row {issue.row}: {issue.message}</p>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
