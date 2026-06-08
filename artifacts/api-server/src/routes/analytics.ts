import { Router } from "express";
import { db } from "@workspace/db";
import { bookingsTable, customersTable, subscriptionsTable, staffTable, invoicesTable, complaintsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

// Helper to normalize db.execute results to array
function toRows<T = Record<string, unknown>>(result: any): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && Array.isArray(result.rows)) return result.rows as T[];
  if (result && typeof result[Symbol.iterator] === "function") return Array.from(result) as T[];
  return [];
}

router.get("/analytics/dashboard", async (req, res) => {
  try {
    const [
      todayRevenue, monthRevenue, totalRevenue, activeSubscriptions, totalCustomers,
      newCustomersThisMonth, pendingDuesTotal, activeJobs, completedJobsToday,
      openComplaints, revenueByCategory, cityWiseStats, subscriptionBreakdown
    ] = await Promise.all([
      db.execute(sql`SELECT COALESCE(SUM(amount::numeric), 0) as total FROM payments WHERE DATE(created_at) = CURRENT_DATE`),
      db.execute(sql`SELECT COALESCE(SUM(amount::numeric), 0) as total FROM payments WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())`),
      db.execute(sql`SELECT COALESCE(SUM(amount::numeric), 0) as total FROM payments WHERE status = 'completed'`),
      db.select({ count: sql<number>`count(*)` }).from(subscriptionsTable).where(eq(subscriptionsTable.status, "active")),
      db.select({ count: sql<number>`count(*)` }).from(customersTable),
      db.execute(sql`SELECT COUNT(*) as count FROM customers WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())`),
      db.execute(sql`SELECT COALESCE(SUM(due_amount::numeric), 0) as total FROM invoices WHERE status IN ('sent', 'overdue')`),
      db.select({ count: sql<number>`count(*)` }).from(bookingsTable).where(eq(bookingsTable.status, "in_progress")),
      db.execute(sql`SELECT COUNT(*) as count FROM bookings WHERE status = 'completed' AND DATE(scheduled_date) = CURRENT_DATE`),
      db.select({ count: sql<number>`count(*)` }).from(complaintsTable).where(eq(complaintsTable.status, "open")),
      db.execute(sql`
        SELECT s.category, COALESCE(SUM(b.amount::numeric), 0) as amount
        FROM bookings b LEFT JOIN services s ON b.service_id = s.id
        WHERE b.status = 'completed'
        GROUP BY s.category
      `),
      db.execute(sql`
        SELECT c.city, COUNT(DISTINCT c.id) as customers, COALESCE(SUM(p.amount::numeric), 0) as revenue
        FROM customers c
        LEFT JOIN payments p ON p.customer_id = c.id
        WHERE c.city IS NOT NULL
        GROUP BY c.city
        ORDER BY revenue DESC
        LIMIT 10
      `),
      db.execute(sql`
        SELECT type, COUNT(*) as count FROM subscriptions WHERE status = 'active' GROUP BY type
      `),
    ]);

    const totalCustomerCount = Number(totalCustomers[0]?.count ?? 0);
    const repeatResult = await db.execute(sql`
      SELECT customer_id FROM bookings
      WHERE status = 'completed'
      GROUP BY customer_id
      HAVING COUNT(*) > 1
    `);

    const repeatRows = toRows(repeatResult);
    const repeatCustomerPercent = totalCustomerCount > 0
      ? Math.round((repeatRows.length / totalCustomerCount) * 100)
      : 0;

    const catRows = toRows(revenueByCategory);
    const cityRows = toRows(cityWiseStats);
    const subRows = toRows(subscriptionBreakdown);

    return res.json({
      todayRevenue: Number(toRows(todayRevenue)[0]?.total ?? 0),
      monthRevenue: Number(toRows(monthRevenue)[0]?.total ?? 0),
      totalRevenue: Number(toRows(totalRevenue)[0]?.total ?? 0),
      activeSubscriptions: Number(activeSubscriptions[0]?.count ?? 0),
      totalCustomers: totalCustomerCount,
      newCustomersThisMonth: Number(toRows(newCustomersThisMonth)[0]?.count ?? 0),
      pendingDuesTotal: Number(toRows(pendingDuesTotal)[0]?.total ?? 0),
      activeJobs: Number(activeJobs[0]?.count ?? 0),
      completedJobsToday: Number(toRows(completedJobsToday)[0]?.count ?? 0),
      openComplaints: Number(openComplaints[0]?.count ?? 0),
      repeatCustomerPercent,
      revenueByCategory: catRows.map((r: any) => ({ category: r.category || "unknown", amount: Number(r.amount) })),
      cityWiseStats: cityRows.map((r: any) => ({ city: r.city, revenue: Number(r.revenue), customers: Number(r.customers) })),
      subscriptionBreakdown: subRows.map((r: any) => ({ type: r.type, count: Number(r.count) })),
    });
  } catch (err) {
    req.log.error({ err }, "Dashboard stats error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/analytics/revenue", async (req, res) => {
  try {
    const { period = "month" } = req.query as Record<string, string>;

    const [totalResult, paidResult, pendingResult, byPeriodResult, byServiceResult, byBranchResult] = await Promise.all([
      db.execute(sql`SELECT COALESCE(SUM(total_amount::numeric), 0) as total FROM invoices`),
      db.execute(sql`SELECT COALESCE(SUM(amount::numeric), 0) as total FROM payments WHERE status = 'completed'`),
      db.execute(sql`SELECT COALESCE(SUM(due_amount::numeric), 0) as total FROM invoices WHERE status IN ('sent', 'overdue')`),
      db.execute(sql`
        SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') as label,
        COALESCE(SUM(amount::numeric), 0) as revenue
        FROM payments WHERE status = 'completed'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY DATE_TRUNC('month', created_at) ASC
        LIMIT 12
      `),
      db.execute(sql`
        SELECT s.name as service_name, COALESCE(SUM(b.amount::numeric), 0) as revenue, COUNT(*) as bookings
        FROM bookings b LEFT JOIN services s ON b.service_id = s.id
        WHERE b.status = 'completed'
        GROUP BY s.name ORDER BY revenue DESC LIMIT 10
      `),
      db.execute(sql`
        SELECT br.name as branch_name, COALESCE(SUM(p.amount::numeric), 0) as revenue
        FROM branches br LEFT JOIN customers c ON c.branch_id = br.id
        LEFT JOIN payments p ON p.customer_id = c.id
        GROUP BY br.name ORDER BY revenue DESC
      `),
    ]);

    return res.json({
      period,
      totalRevenue: Number(toRows(totalResult)[0]?.total ?? 0),
      paidRevenue: Number(toRows(paidResult)[0]?.total ?? 0),
      pendingRevenue: Number(toRows(pendingResult)[0]?.total ?? 0),
      revenueByPeriod: toRows(byPeriodResult).map((r: any) => ({ label: r.label, revenue: Number(r.revenue) })),
      revenueByService: toRows(byServiceResult).map((r: any) => ({ serviceName: r.service_name || "Unknown", revenue: Number(r.revenue), bookings: Number(r.bookings) })),
      revenueByBranch: toRows(byBranchResult).map((r: any) => ({ branchName: r.branch_name, revenue: Number(r.revenue) })),
    });
  } catch (err) {
    req.log.error({ err }, "Revenue analytics error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/analytics/customers", async (req, res) => {
  try {
    const [totalResult, activeResult, newResult, cityResult, growthResult, repeatResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(customersTable),
      db.select({ count: sql<number>`count(*)` }).from(customersTable).where(eq(customersTable.status, "active")),
      db.execute(sql`SELECT COUNT(*) as count FROM customers WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())`),
      db.execute(sql`SELECT city, COUNT(*) as count FROM customers WHERE city IS NOT NULL GROUP BY city ORDER BY count DESC LIMIT 10`),
      db.execute(sql`
        SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') as month,
        COUNT(*) as count
        FROM customers
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY DATE_TRUNC('month', created_at) ASC LIMIT 12
      `),
      db.execute(sql`
        SELECT customer_id FROM bookings
        WHERE status = 'completed' GROUP BY customer_id HAVING COUNT(*) > 1
      `),
    ]);

    const total = Number(totalResult[0]?.count ?? 0);
    const repeatCount = toRows(repeatResult).length;

    return res.json({
      totalCustomers: total,
      activeCustomers: Number(activeResult[0]?.count ?? 0),
      newThisMonth: Number(toRows(newResult)[0]?.count ?? 0),
      repeatCustomerPercent: total > 0 ? Math.round((repeatCount / total) * 100) : 0,
      churnRate: 0,
      customersByCity: toRows(cityResult).map((r: any) => ({ city: r.city, count: Number(r.count) })),
      customerGrowth: toRows(growthResult).map((r: any) => ({ month: r.month, count: Number(r.count), newCustomers: Number(r.count) })),
    });
  } catch (err) {
    req.log.error({ err }, "Customer analytics error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/analytics/staff-leaderboard", async (req, res) => {
  try {
    const { month } = req.query as Record<string, string>;
    const monthFilter = month || new Date().toISOString().slice(0, 7);

    const results = await db.execute(sql`
      SELECT
        s.id as staff_id, s.name as staff_name,
        COUNT(b.id) FILTER (WHERE b.status = 'completed') as jobs_completed,
        COALESCE(SUM(b.amount::numeric) FILTER (WHERE b.status = 'completed'), 0) as revenue_generated,
        COALESCE(AVG(b.rating) FILTER (WHERE b.rating IS NOT NULL), 0) as average_rating
      FROM staff s
      LEFT JOIN bookings b ON b.staff_id = s.id
        AND TO_CHAR(b.scheduled_date::date, 'YYYY-MM') = ${monthFilter}
      WHERE s.is_active = true
      GROUP BY s.id, s.name
      ORDER BY jobs_completed DESC, revenue_generated DESC
      LIMIT 20
    `);

    return res.json(toRows(results).map((r: any, idx: number) => ({
      rank: idx + 1,
      staffId: r.staff_id,
      staffName: r.staff_name,
      jobsCompleted: Number(r.jobs_completed),
      revenueGenerated: Number(r.revenue_generated),
      averageRating: Number(r.average_rating),
      efficiencyScore: Math.round((Number(r.jobs_completed) * 0.5 + Number(r.average_rating) * 10) * 10) / 10,
    })));
  } catch (err) {
    req.log.error({ err }, "Staff leaderboard error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/analytics/outstanding-dues", async (req, res) => {
  try {
    const [totalResult, countResult, overdueResult, topDebtorsResult] = await Promise.all([
      db.execute(sql`SELECT COALESCE(SUM(due_amount::numeric), 0) as total FROM invoices WHERE status IN ('sent', 'overdue')`),
      db.execute(sql`SELECT COUNT(DISTINCT customer_id) as count FROM invoices WHERE status IN ('sent', 'overdue') AND due_amount::numeric > 0`),
      db.execute(sql`SELECT COUNT(*) as count FROM invoices WHERE status = 'overdue'`),
      db.execute(sql`
        SELECT c.id as customer_id, c.name as customer_name,
        SUM(i.due_amount::numeric) as due_amount,
        COALESCE(MAX(CURRENT_DATE - i.due_date::date), 0) as days_past_due
        FROM invoices i JOIN customers c ON i.customer_id = c.id
        WHERE i.status IN ('sent', 'overdue') AND i.due_amount::numeric > 0
        GROUP BY c.id, c.name
        ORDER BY due_amount DESC LIMIT 10
      `),
    ]);

    return res.json({
      totalDues: Number(toRows(totalResult)[0]?.total ?? 0),
      customersWithDues: Number(toRows(countResult)[0]?.count ?? 0),
      overdueInvoices: Number(toRows(overdueResult)[0]?.count ?? 0),
      topDebtors: toRows(topDebtorsResult).map((r: any) => ({
        customerId: r.customer_id,
        customerName: r.customer_name,
        dueAmount: Number(r.due_amount),
        daysPastDue: Number(r.days_past_due) || 0,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Outstanding dues error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
