import {
  pgTable, serial, text, integer, boolean, date, timestamp, pgEnum, unique, numeric,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { staffTable } from "./staff";
import { usersTable } from "./users";

export const staffSkillLevelEnum = pgEnum("staff_skill_level", ["trainee", "basic", "intermediate", "expert"]);
export const staffDocumentTypeEnum = pgEnum("staff_document_type", [
  "aadhaar", "pan", "driving_license", "address_proof", "bank_cancelled_cheque", "bank_passbook",
  "staff_consent_form", "vehicle_insurance", "vehicle_registration", "police_verification", "medical_certificate", "other",
]);

export const staffRoleMasterTable = pgTable("staff_role_master", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const staffRoleAssignmentsTable = pgTable("staff_role_assignments", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull().references(() => staffTable.id, { onDelete: "cascade" }),
  roleId: integer("role_id").notNull().references(() => staffRoleMasterTable.id, { onDelete: "cascade" }),
  skillLevel: staffSkillLevelEnum("skill_level").notNull().default("basic"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [unique("staff_role_assignments_staff_role").on(t.staffId, t.roleId)]);

export const staffDocumentsTable = pgTable("staff_documents", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull().references(() => staffTable.id, { onDelete: "cascade" }),
  documentType: staffDocumentTypeEnum("document_type").notNull(),
  documentNumber: text("document_number"),
  title: text("title"),
  description: text("description"),
  fileUrl: text("file_url").notNull(),
  contentType: text("content_type"),
  fileSizeBytes: integer("file_size_bytes"),
  expiryDate: date("expiry_date"),
  uploadedByUserId: integer("uploaded_by_user_id").references(() => usersTable.id),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  isCurrent: boolean("is_current").notNull().default(true),
  replacedByDocumentId: integer("replaced_by_document_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const staffNotesTable = pgTable("staff_notes", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull().references(() => staffTable.id, { onDelete: "cascade" }),
  authorUserId: integer("author_user_id").references(() => usersTable.id),
  authorName: text("author_name"),
  note: text("note").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertStaffRoleMasterSchema = createInsertSchema(staffRoleMasterTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertStaffDocumentSchema = createInsertSchema(staffDocumentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertStaffNoteSchema = createInsertSchema(staffNotesTable).omit({ id: true, createdAt: true });

export type StaffRoleMaster = typeof staffRoleMasterTable.$inferSelect;
export type StaffDocument = typeof staffDocumentsTable.$inferSelect;
export type StaffNote = typeof staffNotesTable.$inferSelect;
