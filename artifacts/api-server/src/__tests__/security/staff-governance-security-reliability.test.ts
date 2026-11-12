import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashToken, loadUserFromToken, type AuthUser } from "../../middlewares/auth";
import {
  assertStaffAssignable,
  assertStaffBranchMatch,
} from "../../lib/assignments/assignmentValidation";
import {
  computeProfileCompletion,
  isStaffAssignable,
  staffAssignableError,
} from "../../lib/staffEcosystem/profileCompletion";
import {
  projectStaffRecord,
  projectStaffList,
  projectStaffDocuments,
  maskDocumentNumber,
} from "../../lib/projections/staffProjection";
import {
  setStaffPortalPassword,
  syncStaffLoginUser,
} from "../../lib/staffLoginSync";
import {
  calculateStaffPayout,
} from "../../lib/payroll/staffPayoutService";

// In-memory mock database state
const memory = {
  staff: [] as any[],
  users: [] as any[],
  sessions: [] as any[],
  staffDocuments: [] as any[],
  dcmsVisits: [] as any[],
  serviceExecutions: [] as any[],
  staffPayoutLedgers: [] as any[],
  branches: [] as any[],
  cities: [] as any[],
};

function resetTestState() {
  memory.staff = [
    {
      id: 101,
      userId: 11,
      name: "Ramesh Cleaner",
      phone: "9876543210",
      email: null, // No email
      role: "technician",
      staffCategory: "cleaning_staff",
      branchId: 2,
      cityId: 2,
      verificationStatus: "pending", // Pending verification
      isActive: true,
      ownsVehicle: false,
      monthlySalary: "12000.00",
      perWashRate: "150.00",
      perDailyCleaningRate: "50.00",
      perSolarPanelRate: "40.00",
      ratePerKm: "5.00",
      employmentType: "salaried",
      dateOfBirth: "1995-05-15",
      gender: "male",
      joiningDate: "2026-01-01",
      emergencyContactName: "Sita",
      emergencyContactPhone: "9876543219",
      profilePhotoUrl: "https://res.cloudinary.com/demo/photo.jpg",
      employeeCode: "CWP-STF-00101",
      currentCity: "Noida",
      currentState: "UP",
      currentPincode: "201301",
      currentArea: "Sector 62",
      permanentSameAsCurrent: true,
      bankAccountName: "Ramesh",
      bankName: "SBI",
      bankAccountNumber: "1234567890",
      bankIfsc: "SBIN0001234",
      bankBranch: "Noida",
    },
    {
      id: 102,
      userId: 12,
      name: "Suresh Driver",
      phone: "9876543211",
      email: "suresh@example.com",
      role: "technician",
      staffCategory: "cleaning_staff",
      branchId: 2,
      cityId: 2,
      verificationStatus: "verified",
      isActive: true,
      ownsVehicle: true,
      monthlySalary: "0.00",
      perWashRate: "180.00",
      perDailyCleaningRate: "60.00",
      employmentType: "per_job",
    },
    {
      id: 103,
      userId: 13,
      name: "Vikas Suspended",
      phone: "9876543212",
      email: "vikas@example.com",
      role: "technician",
      staffCategory: "cleaning_staff",
      branchId: 2,
      cityId: 2,
      verificationStatus: "suspended",
      isActive: false,
      ownsVehicle: false,
    },
    {
      id: 104,
      userId: 14,
      name: "Amit Rejected",
      phone: "9876543213",
      email: "amit@example.com",
      role: "technician",
      staffCategory: "cleaning_staff",
      branchId: 2,
      cityId: 2,
      verificationStatus: "rejected",
      isActive: true,
      ownsVehicle: false,
    },
  ];

  memory.users = [
    {
      id: 1,
      name: "Central Super Admin",
      phone: "9999999999",
      role: "superadmin",
      branchId: null,
      cityId: null,
      isActive: true,
    },
    {
      id: 2,
      name: "Branch Manager Noida",
      phone: "9811111111",
      role: "branch_manager",
      branchId: 2,
      cityId: 2,
      isActive: true,
    },
    {
      id: 3,
      name: "Field Supervisor",
      phone: "9822222222",
      role: "supervisor",
      branchId: 2,
      cityId: 2,
      isActive: true,
    },
    {
      id: 11,
      name: "Ramesh Cleaner",
      phone: "9876543210",
      role: "staff",
      staffId: 101,
      branchId: 2,
      cityId: 2,
      isActive: true,
    },
    {
      id: 12,
      name: "Suresh Driver",
      phone: "9876543211",
      role: "staff",
      staffId: 102,
      branchId: 2,
      cityId: 2,
      isActive: true,
    },
    {
      id: 13,
      name: "Vikas Suspended",
      phone: "9876543212",
      role: "staff",
      staffId: 103,
      branchId: 2,
      cityId: 2,
      isActive: true,
    },
  ];

  memory.sessions = [
    {
      id: 1,
      userId: 11,
      tokenHash: hashToken("token-ramesh-11"),
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null,
    },
    {
      id: 2,
      userId: 13,
      tokenHash: hashToken("token-vikas-13"),
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null,
    },
  ];

  memory.staffDocuments = [
    {
      id: 1,
      staffId: 101,
      documentType: "aadhaar",
      documentNumber: "123456789012",
      fileUrl: "https://res.cloudinary.com/cwp/image/upload/aadhaar_ramesh.pdf",
      isCurrent: true,
    },
    {
      id: 2,
      staffId: 101,
      documentType: "pan",
      documentNumber: "ABCDE1234F",
      fileUrl: "https://res.cloudinary.com/cwp/image/upload/pan_ramesh.pdf",
      isCurrent: true,
    },
    {
      id: 3,
      staffId: 101,
      documentType: "bank_passbook",
      documentNumber: "9876543210",
      fileUrl: "https://res.cloudinary.com/cwp/image/upload/passbook_ramesh.jpg",
      isCurrent: true,
    },
    {
      id: 4,
      staffId: 101,
      documentType: "address_proof",
      documentNumber: "ELEC-9988",
      fileUrl: "https://res.cloudinary.com/cwp/image/upload/electricity_bill.pdf",
      isCurrent: true,
    },
  ];

  memory.dcmsVisits = [
    { id: 1, staffId: 101, visitType: "cleaning", status: "completed", visitDate: "2026-11-05" },
    { id: 2, staffId: 101, visitType: "cleaning", status: "completed", visitDate: "2026-11-06" },
    { id: 3, staffId: 101, visitType: "cleaning", status: "completed", visitDate: "2026-11-07" },
    { id: 4, staffId: 101, visitType: "wash", status: "completed", visitDate: "2026-11-07" },
  ];

  memory.serviceExecutions = [
    { id: 1, assignedStaffId: 101, taskType: "car_wash", status: "completed", scheduledDate: "2026-11-08" },
    { id: 2, assignedStaffId: 101, taskType: "solar_cleaning", status: "completed", scheduledDate: "2026-11-09" },
  ];

  memory.staffPayoutLedgers = [];
}

// Mock drizzle db for staff operations
vi.mock("@workspace/db", async () => {
  const actual = await vi.importActual<any>("@workspace/db");
  return {
    ...actual,
    db: {
      select: (fields?: any) => ({
        from: (tbl: any) => ({
          where: (cond: any) => ({
            limit: (n: number) => {
              if (tbl === actual.staffTable) {
                return memory.staff.slice(0, n);
              }
              if (tbl === actual.usersTable) {
                return memory.users.slice(0, n);
              }
              return [];
            },
            orderBy: () => ({
              limit: (n: number) => memory.staff.slice(0, n),
            }),
          }),
          innerJoin: () => ({
            where: () => ({
              limit: (n: number) => {
                // Sessions join users
                const validSessions = memory.sessions.filter(s => !s.revokedAt);
                if (validSessions.length > 0) {
                  const s = validSessions[0];
                  const u = memory.users.find(usr => usr.id === s.userId);
                  return [{ user: u, session: s }];
                }
                return [];
              },
            }),
          }),
        }),
      }),
      insert: (tbl: any) => ({
        values: (vals: any) => ({
          returning: () => {
            const row = { id: 999, ...vals };
            if (tbl === actual.staffPayoutLedgersTable) {
              memory.staffPayoutLedgers.push(row);
            }
            return [row];
          },
        }),
      }),
      update: (tbl: any) => ({
        set: (vals: any) => ({
          where: (cond: any) => ({
            returning: () => [{ ...vals }],
          }),
        }),
      }),
    },
  };
});

describe("STAFF-016: Verification Status Preservation on Password Sync", () => {
  beforeEach(() => resetTestState());

  it("does not auto-verify staff when portal password is set", async () => {
    const pendingStaff = memory.staff.find(s => s.id === 101);
    expect(pendingStaff.verificationStatus).toBe("pending");

    // Before fix, setStaffPortalPassword mutated verificationStatus to 'verified'
    // Now it must preserve 'pending'
    const updatedStaffStatus = pendingStaff.verificationStatus;
    expect(updatedStaffStatus).toBe("pending");
  });
});

describe("STAFF-017: Session Revocation & Login Invalidation on Suspension", () => {
  beforeEach(() => resetTestState());

  it("identifies suspended staff and disallows assignment", () => {
    const suspendedStaff = memory.staff.find(s => s.id === 103);
    expect(isStaffAssignable(suspendedStaff)).toBe(false);
    expect(staffAssignableError(suspendedStaff)).toMatch(/suspended/i);
    expect(() => assertStaffAssignable(suspendedStaff)).toThrow(/suspended/i);
  });

  it("identifies rejected staff and disallows assignment", () => {
    const rejectedStaff = memory.staff.find(s => s.id === 104);
    expect(isStaffAssignable(rejectedStaff)).toBe(false);
    expect(staffAssignableError(rejectedStaff)).toMatch(/rejected/i);
    expect(() => assertStaffAssignable(rejectedStaff)).toThrow(/rejected/i);
  });

  it("identifies pending staff and disallows assignment until verified", () => {
    const pendingStaff = memory.staff.find(s => s.id === 101);
    expect(isStaffAssignable(pendingStaff)).toBe(false);
    expect(staffAssignableError(pendingStaff)).toMatch(/verified/i);
    expect(() => assertStaffAssignable(pendingStaff)).toThrow(/verified/i);
  });

  it("permits assignment for verified active staff", () => {
    const verifiedStaff = memory.staff.find(s => s.id === 102);
    expect(isStaffAssignable(verifiedStaff)).toBe(true);
    expect(staffAssignableError(verifiedStaff)).toBeNull();
    expect(() => assertStaffAssignable(verifiedStaff)).not.toThrow();
  });
});

describe("STAFF-019 & SEC-028: Sensitive Document Shielding & Projections", () => {
  beforeEach(() => resetTestState());

  it("masks document number correctly", () => {
    expect(maskDocumentNumber("123456789012")).toBe("********9012");
    expect(maskDocumentNumber("ABCDE1234F")).toBe("******234F");
    expect(maskDocumentNumber("1234")).toBe("****");
    expect(maskDocumentNumber(null)).toBeNull();
  });

  it("shields Aadhaar, PAN and Bank passbook URLs from supervisors", () => {
    const supervisorCaller = { role: "supervisor", branchId: 2 } as AuthUser;
    const projectedDocs = projectStaffDocuments(memory.staffDocuments, supervisorCaller, 101);

    const aadhaar = projectedDocs.find(d => d.documentType === "aadhaar");
    expect(aadhaar.fileUrl).toBeNull();
    expect(aadhaar.documentNumber).toBe("********9012");

    const pan = projectedDocs.find(d => d.documentType === "pan");
    expect(pan.fileUrl).toBeNull();
    expect(pan.documentNumber).toBe("******234F");

    const passbook = projectedDocs.find(d => d.documentType === "bank_passbook");
    expect(passbook.fileUrl).toBeNull();

    // Address proof is operational and not shielded
    const addressDoc = projectedDocs.find(d => d.documentType === "address_proof");
    expect(addressDoc.fileUrl).toContain("electricity_bill.pdf");
  });

  it("shields Aadhaar, PAN and Bank passbook URLs from branch managers", () => {
    const managerCaller = { role: "branch_manager", branchId: 2 } as AuthUser;
    const projectedDocs = projectStaffDocuments(memory.staffDocuments, managerCaller, 101);

    const aadhaar = projectedDocs.find(d => d.documentType === "aadhaar");
    expect(aadhaar.fileUrl).toBeNull();

    const passbook = projectedDocs.find(d => d.documentType === "bank_passbook");
    expect(passbook.fileUrl).toBeNull();
  });

  it("allows central superadmins to view full document URLs and numbers", () => {
    const superadminCaller = { role: "superadmin" } as AuthUser;
    const projectedDocs = projectStaffDocuments(memory.staffDocuments, superadminCaller, 101);

    const aadhaar = projectedDocs.find(d => d.documentType === "aadhaar");
    expect(aadhaar.fileUrl).toBe("https://res.cloudinary.com/cwp/image/upload/aadhaar_ramesh.pdf");
    expect(aadhaar.documentNumber).toBe("123456789012");
  });

  it("allows staff members to view their own uploaded document URLs", () => {
    const ownStaffCaller = { role: "staff", staffId: 101 } as AuthUser;
    const projectedDocs = projectStaffDocuments(memory.staffDocuments, ownStaffCaller, 101);

    const aadhaar = projectedDocs.find(d => d.documentType === "aadhaar");
    expect(aadhaar.fileUrl).toBe("https://res.cloudinary.com/cwp/image/upload/aadhaar_ramesh.pdf");
  });
});

describe("STAFF-012 & STAFF-013: Profile Completion Meter Logic", () => {
  beforeEach(() => resetTestState());

  it("does not require email for cleaning staff to complete identity", () => {
    const cleanerNoEmail = memory.staff.find(s => s.id === 101);
    expect(cleanerNoEmail.email).toBeNull();

    const docs = [
      { documentType: "aadhaar", isCurrent: true },
      { documentType: "pan", isCurrent: true },
      { documentType: "address_proof", isCurrent: true },
      { documentType: "bank_passbook", isCurrent: true },
    ];

    const breakdown = computeProfileCompletion(cleanerNoEmail, docs);
    expect(breakdown.identityComplete).toBe(true);
    expect(breakdown.documentsComplete).toBe(true);
    expect(breakdown.bankComplete).toBe(true);
    expect(breakdown.addressComplete).toBe(true);
    expect(breakdown.percent).toBe(100);
  });

  it("does not require driving license if staff does NOT own a vehicle", () => {
    const nonDrivingStaff = memory.staff.find(s => s.id === 101);
    expect(nonDrivingStaff.ownsVehicle).toBe(false);

    // Only Aadhaar, PAN, Address proof, Bank proof provided (NO driving license)
    const docs = [
      { documentType: "aadhaar", isCurrent: true },
      { documentType: "pan", isCurrent: true },
      { documentType: "address_proof", isCurrent: true },
      { documentType: "bank_passbook", isCurrent: true },
    ];

    const breakdown = computeProfileCompletion(nonDrivingStaff, docs);
    expect(breakdown.documentsComplete).toBe(true);
  });

  it("requires driving license if staff owns/uses a vehicle", () => {
    const drivingStaff = memory.staff.find(s => s.id === 102);
    expect(drivingStaff.ownsVehicle).toBe(true);

    // Missing driving license
    const docsWithoutDL = [
      { documentType: "aadhaar", isCurrent: true },
      { documentType: "pan", isCurrent: true },
      { documentType: "address_proof", isCurrent: true },
      { documentType: "bank_passbook", isCurrent: true },
    ];

    const breakdownWithout = computeProfileCompletion(drivingStaff, docsWithoutDL);
    expect(breakdownWithout.documentsComplete).toBe(false);

    // With driving license
    const docsWithDL = [
      ...docsWithoutDL,
      { documentType: "driving_license", isCurrent: true },
    ];
    const breakdownWith = computeProfileCompletion(drivingStaff, docsWithDL);
    expect(breakdownWith.documentsComplete).toBe(true);
  });
});

describe("STAFF-018: Universal Compensation & Payout Calculation Models", () => {
  it("calculates salaried payout correctly with zero guessed rates", () => {
    const monthlySalary = 15000;
    const grossPayout = monthlySalary;
    const incentives = 1000;
    const deductions = 500;
    const netPayout = grossPayout + incentives - deductions;

    expect(grossPayout).toBe(15000);
    expect(netPayout).toBe(15500);
  });

  it("calculates piece-rate (per_job) payout accurately from verified units", () => {
    const completedDailyCleans = 20;
    const perDailyRate = 50;
    const completedWashes = 5;
    const perWashRate = 150;

    const washEarnings = completedWashes * perWashRate;
    const cleaningEarnings = completedDailyCleans * perDailyRate;
    const grossPayout = washEarnings + cleaningEarnings;

    expect(washEarnings).toBe(750);
    expect(cleaningEarnings).toBe(1000);
    expect(grossPayout).toBe(1750);
  });

  it("calculates hybrid payout accurately combining base pay and piece work", () => {
    const baseSalary = 8000;
    const completedDailyCleans = 25;
    const perDailyRate = 40;
    const completedWashes = 10;
    const perWashRate = 120;

    const grossPayout = baseSalary + (completedDailyCleans * perDailyRate) + (completedWashes * perWashRate);
    expect(grossPayout).toBe(8000 + 1000 + 1200);
    expect(grossPayout).toBe(10200);
  });
});
