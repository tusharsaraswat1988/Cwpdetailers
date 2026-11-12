import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  resolveLegalEntity,
  buildLegalEntitySnapshot,
  generateLegalEntityDocumentNumber,
} from "../../lib/billing/legalEntityService";
import type { LegalEntity } from "@workspace/db";

describe("Legal Entity & Concurrency-Safe Invoice Billing Architecture (LEG-001, LEG-004, LEG-005)", () => {
  const mockCorpEntity: LegalEntity = {
    id: 1,
    code: "CWP_CORP",
    name: "CWP Detailers and Motors",
    tradeName: "CWP Detailers",
    entityType: "company",
    gstin: "09BYWPS9468R3ZG",
    panNumber: "BYWPS9468R",
    stateCode: "09",
    stateName: "Uttar Pradesh",
    addressLine1: "0, Near Ishita School Seer Goverdhanpur",
    addressLine2: null,
    city: "Varanasi",
    pincode: "221011",
    phone: "7054007733",
    email: "cwpdetailers@gmail.com",
    website: "www.cwpdetailers.in",
    bankAccountName: "CWP DETAILERS AND MOTORS",
    bankName: "State Bank of India, BHELUPURA",
    bankAccountNumber: "42105505194",
    bankIfsc: "SBIN0001773",
    bankBranch: "Bhelupura",
    upiId: "pinelabs.stq4501838@pineaxis",
    defaultSac: "998533",
    invoicePrefix: "CWP",
    isActive: true,
    isDefault: true,
    termsAndConditions: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockNoidaEntity: LegalEntity = {
    id: 2,
    code: "CWP_NOIDA_LLP",
    name: "Clean Wave Detailers Noida LLP",
    tradeName: "CWP Noida",
    entityType: "llp",
    gstin: "09AABCC1234D1Z5",
    panNumber: "AABCC1234D",
    stateCode: "09",
    stateName: "Uttar Pradesh",
    addressLine1: "Tower 4, Sector 16C, Gaur City 2",
    addressLine2: "Greater Noida West",
    city: "Noida",
    pincode: "201009",
    phone: "9876543210",
    email: "noida@cwpdetailers.in",
    website: "www.cwpdetailers.in",
    bankAccountName: "CLEAN WAVE DETAILERS NOIDA LLP",
    bankName: "HDFC Bank, Sector 62",
    bankAccountNumber: "50200012345678",
    bankIfsc: "HDFC0001234",
    bankBranch: "Sector 62 Noida",
    upiId: "cwpnoida@hdfcbank",
    defaultSac: "998533",
    invoicePrefix: "CWP-NDA",
    isActive: true,
    isDefault: false,
    termsAndConditions: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe("1. buildLegalEntitySnapshot (LEG-004: Immutable Historical Invoicing)", () => {
    it("creates an exact immutable snapshot of all legal and bank properties", () => {
      const snapshot = buildLegalEntitySnapshot(mockNoidaEntity);
      expect(snapshot).toEqual({
        id: 2,
        code: "CWP_NOIDA_LLP",
        name: "Clean Wave Detailers Noida LLP",
        tradeName: "CWP Noida",
        entityType: "llp",
        gstin: "09AABCC1234D1Z5",
        panNumber: "AABCC1234D",
        stateCode: "09",
        stateName: "Uttar Pradesh",
        address: "Tower 4, Sector 16C, Gaur City 2, Greater Noida West",
        city: "Noida",
        pincode: "201009",
        phone: "9876543210",
        email: "noida@cwpdetailers.in",
        website: "www.cwpdetailers.in",
        bankAccountName: "CLEAN WAVE DETAILERS NOIDA LLP",
        bankName: "HDFC Bank, Sector 62",
        bankAccountNumber: "50200012345678",
        bankIfsc: "HDFC0001234",
        upiId: "cwpnoida@hdfcbank",
        defaultSac: "998533",
        invoicePrefix: "CWP-NDA",
      });
    });
  });

  describe("2. generateLegalEntityDocumentNumber (LEG-005: Concurrency-Safe Invoice Series)", () => {
    function createMockTx(seqValue: number) {
      return {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
              then: (resolve: any, reject: any) => Promise.resolve([{ maxNum: null }]).then(resolve, reject),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            onConflictDoUpdate: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ currentValue: seqValue }]),
            }),
          }),
        }),
      } as unknown as Parameters<typeof generateLegalEntityDocumentNumber>[0]["tx"];
    }

    it("generates tax invoice series using the legal entity's distinct prefix", async () => {
      const mockTx = createMockTx(1001);

      const num1 = await generateLegalEntityDocumentNumber({
        legalEntity: mockCorpEntity,
        documentType: "tax_invoice",
        tx: mockTx,
      });

      expect(num1).toMatch(/^CWP\/\d{2}-\d{2}\/1001$/);

      const num2 = await generateLegalEntityDocumentNumber({
        legalEntity: mockNoidaEntity,
        documentType: "tax_invoice",
        tx: mockTx,
      });

      expect(num2).toMatch(/^CWP-NDA\/\d{2}-\d{2}\/1001$/);
    });

    it("formats credit notes and debit notes correctly with distinct series", async () => {
      const mockTx = createMockTx(1005);

      const cn = await generateLegalEntityDocumentNumber({
        legalEntity: mockNoidaEntity,
        documentType: "credit_note",
        tx: mockTx,
      });

      expect(cn).toMatch(/^CWP-NDA\/CN\/\d{2}-\d{2}\/1005$/);

      const dn = await generateLegalEntityDocumentNumber({
        legalEntity: mockCorpEntity,
        documentType: "debit_note",
        tx: mockTx,
      });

      expect(dn).toMatch(/^CWP\/DN\/\d{2}-\d{2}\/1005$/);
    });
  });

  describe("3. resolveLegalEntity (LEG-001: Explicit Billing Assignment)", () => {
    it("resolves the branch's assigned legal entity when branchId is provided", async () => {
      const mockTx = {
        select: vi.fn().mockImplementation((fields) => ({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(async () => {
                // If checking branch:
                if (fields?.legalEntityId) {
                  return [{ legalEntityId: 2 }];
                }
                // If selecting legal entity with id 2:
                return [mockNoidaEntity];
              }),
            }),
          }),
        })),
      } as unknown as Parameters<typeof resolveLegalEntity>[1];

      const entity = await resolveLegalEntity({ branchId: 10 }, mockTx);
      expect(entity.id).toBe(2);
      expect(entity.code).toBe("CWP_NOIDA_LLP");
      expect(entity.invoicePrefix).toBe("CWP-NDA");
    });

    it("falls back to default corporate entity when branch has no explicit entity", async () => {
      const mockTx = {
        select: vi.fn().mockImplementation((fields) => ({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(async () => {
                if (fields?.legalEntityId) {
                  return [{ legalEntityId: null }];
                }
                return [mockCorpEntity];
              }),
            }),
          }),
        })),
      } as unknown as Parameters<typeof resolveLegalEntity>[1];

      const entity = await resolveLegalEntity({ branchId: 99 }, mockTx);
      expect(entity.id).toBe(1);
      expect(entity.code).toBe("CWP_CORP");
      expect(entity.isDefault).toBe(true);
    });
  });
});
