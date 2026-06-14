export type MigrationSeverity = "error" | "warning";

export type MigrationIssue = {
  sheet: string;
  row: number;
  column?: string;
  severity: MigrationSeverity;
  code: string;
  message: string;
  legacyId?: string;
};

export type CustomerImportRow = {
  rowNumber: number;
  legacyCustomerId: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  city: string | null;
  branchId: number | null;
  walletBalance: string;
  outstandingAmount: string;
  lastPaymentDate: string | null;
  customerSince: string | null;
  historicalWashCount: number | null;
  historicalSolarVisitCount: number | null;
  operationalNotes: string | null;
  photoUrl: string | null;
  temporaryPassword: string | null;
  createLogin: boolean;
  status: "active" | "inactive" | "suspended";
  legacySegment: string | null;
};

export type ParsedWorkbook = {
  customers: CustomerImportRow[];
  issues: MigrationIssue[];
};

export type CustomerImportResult = {
  batchId: number | null;
  created: number;
  updated: number;
  skipped: number;
  usersCreated: number;
  issues: MigrationIssue[];
};

export type PreviewResult = {
  summary: {
    customers: number;
    errors: number;
    warnings: number;
  };
  sheets: {
    Customers: {
      rows: CustomerImportRow[];
      errors: MigrationIssue[];
      warnings: MigrationIssue[];
    };
  };
  canImport: boolean;
};
