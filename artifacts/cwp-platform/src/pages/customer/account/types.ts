export type CustomerProfile = {
  id: number;
  name: string;
  phone: string;
  email?: string | null;
  photoUrl?: string | null;
  totalDues?: string;
  lastPaymentDate?: string | null;
  customerSince?: string | null;
  historicalWashCount?: number | null;
  historicalSolarVisitCount?: number | null;
};
