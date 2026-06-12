import { pgTable, serial, integer, text, date, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const attendanceStatusEnum = pgEnum("attendance_status", ["present", "absent", "late", "half_day"]);

export const attendanceTable = pgTable("attendance", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull(),
  date: date("date").notNull(),
  status: attendanceStatusEnum("status").notNull(),
  checkInTime: text("check_in_time"),
  checkOutTime: text("check_out_time"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({ id: true, createdAt: true });
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendanceTable.$inferSelect;
