import { pgTable, serial, text, integer, numeric, boolean, date, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const staffRoleEnum = pgEnum("staff_role", ["technician", "supervisor", "driver", "solar_technician"]);
export const staffCategoryEnum = pgEnum("staff_category", ["supervisor", "cleaning_staff"]);
export const staffVerificationEnum = pgEnum("staff_verification_status", ["pending", "verified", "rejected", "suspended"]);
export const staffGenderEnum = pgEnum("staff_gender", ["male", "female", "other", "prefer_not_to_say"]);
export const staffEmploymentTypeEnum = pgEnum("staff_employment_type", ["salaried", "per_job", "hybrid"]);
export const staffPetrolModelEnum = pgEnum("staff_petrol_model", ["included", "per_km"]);
export const staffAvailabilityEnum = pgEnum("staff_availability", ["available", "unavailable"]);
export const staffVehicleTypeEnum = pgEnum("staff_vehicle_type", ["two_wheeler", "three_wheeler", "four_wheeler", "other"]);

export const staffTable = pgTable("staff", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  franchiseeId: integer("franchisee_id"),
  companyId: integer("company_id"),
  employeeCode: text("employee_code"),
  name: text("name").notNull(),
  profilePhotoUrl: text("profile_photo_url"),
  phone: text("phone").notNull(),
  alternatePhone: text("alternate_phone"),
  email: text("email"),
  dateOfBirth: date("date_of_birth"),
  gender: staffGenderEnum("gender"),
  joiningDate: date("joining_date"),
  role: staffRoleEnum("role").notNull(),
  staffCategory: staffCategoryEnum("staff_category").notNull().default("cleaning_staff"),
  branchId: integer("branch_id").notNull(),
  cityId: integer("city_id"),
  city: text("city"),
  reportingManagerId: integer("reporting_manager_id"),
  employmentType: staffEmploymentTypeEnum("employment_type").default("salaried"),
  monthlySalary: numeric("monthly_salary", { precision: 10, scale: 2 }),
  perWashRate: numeric("per_wash_rate", { precision: 10, scale: 2 }),
  perDailyCleaningRate: numeric("per_daily_cleaning_rate", { precision: 10, scale: 2 }),
  perSolarPanelRate: numeric("per_solar_panel_rate", { precision: 10, scale: 2 }),
  perSolarAmcVisitRate: numeric("per_solar_amc_visit_rate", { precision: 10, scale: 2 }),
  ownsVehicle: boolean("owns_vehicle").notNull().default(false),
  vehicleType: staffVehicleTypeEnum("vehicle_type"),
  vehicleRegistrationNumber: text("vehicle_registration_number"),
  petrolModel: staffPetrolModelEnum("petrol_model"),
  ratePerKm: numeric("rate_per_km", { precision: 10, scale: 2 }),
  availability: staffAvailabilityEnum("availability").notNull().default("available"),
  weeklyOff: text("weekly_off"),
  workingHoursStart: text("working_hours_start"),
  workingHoursEnd: text("working_hours_end"),
  currentHouseNumber: text("current_house_number"),
  currentStreet: text("current_street"),
  currentArea: text("current_area"),
  currentLandmark: text("current_landmark"),
  currentCity: text("current_city"),
  currentState: text("current_state"),
  currentPincode: text("current_pincode"),
  permanentHouseNumber: text("permanent_house_number"),
  permanentStreet: text("permanent_street"),
  permanentArea: text("permanent_area"),
  permanentLandmark: text("permanent_landmark"),
  permanentCity: text("permanent_city"),
  permanentState: text("permanent_state"),
  permanentPincode: text("permanent_pincode"),
  permanentSameAsCurrent: boolean("permanent_same_as_current").notNull().default(false),
  localAddress: text("local_address"),
  permanentAddress: text("permanent_address"),
  guardianName: text("guardian_name"),
  guardianPhone: text("guardian_phone"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  aadhaar: text("aadhaar"),
  pan: text("pan"),
  bankAccountName: text("bank_account_name"),
  bankName: text("bank_name"),
  bankAccountNumber: text("bank_account_number"),
  bankIfsc: text("bank_ifsc"),
  bankBranch: text("bank_branch"),
  upiId: text("upi_id"),
  bankPassbookUrl: text("bank_passbook_url"),
  agreementUrl: text("agreement_url"),
  verificationStatus: staffVerificationEnum("verification_status").notNull().default("pending"),
  verificationNotes: text("verification_notes"),
  verifiedAt: timestamp("verified_at"),
  isActive: boolean("is_active").notNull().default(true),
  profileCompletionPercent: integer("profile_completion_percent").notNull().default(0),
  identityComplete: boolean("identity_complete").notNull().default(false),
  documentsComplete: boolean("documents_complete").notNull().default(false),
  bankComplete: boolean("bank_complete").notNull().default(false),
  addressComplete: boolean("address_complete").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertStaffSchema = createInsertSchema(staffTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStaff = z.infer<typeof insertStaffSchema>;
export type Staff = typeof staffTable.$inferSelect;
