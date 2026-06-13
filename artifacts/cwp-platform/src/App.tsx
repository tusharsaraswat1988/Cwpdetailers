import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { BrandingProvider } from "@/lib/branding";
import { ConnectivityProvider } from "@/services/ConnectivityContext";
import { ConnectivityBanner } from "@/components/connectivity/ConnectivityBanner";
import { AppSplashGate } from "@/components/pwa/AppSplashGate";
import { PwaRouteHeadSync } from "@/components/pwa/PwaRouteHeadSync";

import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import CityServicePage from "@/pages/CityServicePage";
import Login from "@/pages/Login";
import AdminLogin from "@/pages/AdminLogin";
import Register from "@/pages/Register";

import AdminDashboard from "@/pages/admin/Dashboard";
import AdminCustomers from "@/pages/admin/Customers";
import AdminCustomerDetail from "@/pages/admin/CustomerDetail";
import AdminStaff from "@/pages/admin/Staff";
import AdminStaffDetail from "@/pages/admin/StaffDetail";
import AdminBookings from "@/pages/admin/Bookings";
import AdminSubscriptions from "@/pages/admin/Subscriptions";
import AdminInvoices from "@/pages/admin/Invoices";
import AdminComplaints from "@/pages/admin/Complaints";
import AdminBranches from "@/pages/admin/Branches";
import AdminServices from "@/pages/admin/Services";
import ServiceCatalog from "@/pages/admin/ServiceCatalog";
import AdminMasterData from "@/pages/admin/MasterData";
import AdminAnalytics from "@/pages/admin/Analytics";
import AdminNotifications from "@/pages/admin/Notifications";
import { CommunicationCenter } from "@/features/communications";
import AdminFranchisees from "@/pages/admin/Franchisees";
import AdminStaffApproval from "@/pages/admin/StaffApproval";
import AdminCredentials from "@/pages/admin/Credentials";
import AdminChurnedCustomers from "@/pages/admin/ChurnedCustomers";
import AdminLeads from "@/pages/admin/Leads";
import AdminQuotationBuilder from "@/pages/admin/QuotationBuilder";
import AdminExpenses from "@/pages/admin/Expenses";
import AdminDues from "@/pages/admin/Dues";
import AdminDailyOps from "@/pages/admin/DailyOps";
import BrandIdentity from "@/pages/admin/BrandIdentity";
import SystemStatus from "@/pages/admin/SystemStatus";
import AdminPushLogs from "@/pages/admin/PushLogs";
import LegalCMS from "@/pages/admin/LegalCMS";
import BusinessInfoPage from "@/pages/admin/BusinessInfo";
import ComplianceSettings from "@/pages/admin/ComplianceSettings";
import SeoSettingsPage from "@/pages/admin/SeoSettings";

import PrivacyPolicy from "@/pages/legal/PrivacyPolicy";
import TermsAndConditions from "@/pages/legal/TermsAndConditions";
import RefundPolicy from "@/pages/legal/RefundPolicy";
import DataDeletion from "@/pages/legal/DataDeletion";
import AboutUs from "@/pages/legal/AboutUs";
import ContactUs from "@/pages/legal/ContactUs";

import CustomerDashboard from "@/pages/customer/Dashboard";
import BookService from "@/pages/customer/BookService";
import MyAssets from "@/pages/customer/MyAssets";
import CustomerHistory from "@/pages/customer/History";
import CustomerInvoices from "@/pages/customer/Invoices";
import CustomerComplaints from "@/pages/customer/Complaints";
import CustomerWallet from "@/pages/customer/Wallet";
import CustomerServices from "@/pages/customer/Services";
import CustomerAccount from "@/pages/customer/Account";

import StaffDashboard from "@/pages/staff/Dashboard";
import StaffJobs from "@/pages/staff/Jobs";
import StaffEarnings from "@/pages/staff/Earnings";
import StaffProfile from "@/pages/staff/Profile";

import FranchiseeDashboard from "@/pages/franchisee/Dashboard";
import FranchiseeBookings from "@/pages/franchisee/Bookings";
import FranchiseeStaff from "@/pages/franchisee/Staff";
import FranchiseeChurned from "@/pages/franchisee/ChurnedCustomers";
import FranchiseeLeads from "@/pages/franchisee/Leads";
import OperationsWall from "@/pages/admin/OperationsWall";
import FounderDashboard from "@/pages/admin/FounderDashboard";
import {
  DcmsDashboardPage, DcmsPlansPage, DcmsSubscriptionsPage, DcmsVisitsPage, DcmsAssignmentsPage,
  DcmsStaffPerformancePage,
  StaffDailyCleaningPage, CustomerDailyCleaningPage, CustomerDcmsHistoryPage, CustomerDcmsGalleryPage,
  StaffDailyRoutePage, DcmsWashHistoryPage,
} from "@/features/daily-cleaning";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
    },
  },
});

function ProtectedRoute({ component: Component, roles, permission, loginPath = "/login" }: {
  component: React.ComponentType;
  roles?: string[];
  permission?: { resource: string; action: string };
  loginPath?: string;
}) {
  const { user, isLoading, hasPermission } = useAuth();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <Redirect to={loginPath} />;
  if (roles && !roles.includes(user.role)) return <Redirect to={loginPath} />;
  if (permission && !hasPermission(permission.resource, permission.action)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-md">
          <p className="text-white font-display text-xl mb-1">Access restricted</p>
          <p className="text-white/50 text-sm">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }
  return <Component />;
}

function AdminRoot() {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (user && ["admin", "superadmin", "manager"].includes(user.role)) {
    return <Redirect to="/admin/dashboard" />;
  }
  return <Redirect to="/admin/login" />;
}

function Router() {
  return (
    <Switch>
      {/* Public */}
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/register" component={Register} />

      {/* Public Legal Pages */}
      <Route path="/privacy-policy" component={PrivacyPolicy} />
      <Route path="/terms-and-conditions" component={TermsAndConditions} />
      <Route path="/refund-policy" component={RefundPolicy} />
      <Route path="/data-deletion" component={DataDeletion} />
      <Route path="/about-us" component={AboutUs} />
      <Route path="/contact-us" component={ContactUs} />

      {/* Admin — admin/superadmin/manager can reach; per-page permission gates fine-tune */}
      <Route path="/admin/dashboard" component={() => <ProtectedRoute component={AdminDashboard} roles={["admin", "superadmin", "manager"]} loginPath="/admin/login" />} />
      <Route path="/admin/customers/:id" component={() => <ProtectedRoute component={AdminCustomerDetail} roles={["admin", "superadmin", "manager"]} permission={{ resource: "customers", action: "view" }} loginPath="/admin/login" />} />
      <Route path="/admin/customers" component={() => <ProtectedRoute component={AdminCustomers} roles={["admin", "superadmin", "manager"]} permission={{ resource: "customers", action: "view" }} loginPath="/admin/login" />} />
      <Route path="/admin/staff" component={() => <ProtectedRoute component={AdminStaff} roles={["admin", "superadmin", "manager"]} permission={{ resource: "staff", action: "view" }} loginPath="/admin/login" />} />
      <Route path="/admin/staff-approval" component={() => <ProtectedRoute component={AdminStaffApproval} roles={["admin", "superadmin"]} permission={{ resource: "staff", action: "approve" }} loginPath="/admin/login" />} />
      <Route path="/admin/staff/:id" component={() => <ProtectedRoute component={AdminStaffDetail} roles={["admin", "superadmin", "manager"]} permission={{ resource: "staff", action: "view" }} loginPath="/admin/login" />} />
      <Route path="/admin/bookings" component={() => <ProtectedRoute component={AdminBookings} roles={["admin", "superadmin", "manager"]} permission={{ resource: "bookings", action: "view" }} loginPath="/admin/login" />} />
      <Route path="/admin/daily-ops" component={() => <ProtectedRoute component={AdminDailyOps} roles={["admin", "superadmin", "manager"]} permission={{ resource: "subscriptions", action: "view" }} loginPath="/admin/login" />} />
      <Route path="/admin/daily-cleaning/plans" component={() => <ProtectedRoute component={DcmsPlansPage} roles={["admin", "superadmin", "manager"]} permission={{ resource: "daily_cleaning", action: "manage_plans" }} loginPath="/admin/login" />} />
      <Route path="/admin/daily-cleaning/subscriptions" component={() => <ProtectedRoute component={DcmsSubscriptionsPage} roles={["admin", "superadmin", "manager"]} permission={{ resource: "daily_cleaning", action: "manage_subscriptions" }} loginPath="/admin/login" />} />
      <Route path="/admin/daily-cleaning/visits" component={() => <ProtectedRoute component={DcmsVisitsPage} roles={["admin", "superadmin", "manager"]} permission={{ resource: "daily_cleaning", action: "view" }} loginPath="/admin/login" />} />
      <Route path="/admin/daily-cleaning/washes" component={() => <ProtectedRoute component={DcmsWashHistoryPage} roles={["admin", "superadmin", "manager"]} permission={{ resource: "daily_cleaning", action: "view" }} loginPath="/admin/login" />} />
      <Route path="/admin/daily-cleaning/staff-performance" component={() => <ProtectedRoute component={DcmsStaffPerformancePage} roles={["admin", "superadmin", "manager"]} permission={{ resource: "daily_cleaning", action: "view_reports" }} loginPath="/admin/login" />} />
      <Route path="/admin/daily-cleaning/assignments" component={() => <ProtectedRoute component={DcmsAssignmentsPage} roles={["admin", "superadmin", "manager"]} permission={{ resource: "daily_cleaning", action: "manage_assignments" }} loginPath="/admin/login" />} />
      <Route path="/admin/daily-cleaning" component={() => <ProtectedRoute component={DcmsDashboardPage} roles={["admin", "superadmin", "manager"]} permission={{ resource: "daily_cleaning", action: "view_reports" }} loginPath="/admin/login" />} />
      <Route path="/admin/subscriptions" component={() => <ProtectedRoute component={AdminSubscriptions} roles={["admin", "superadmin", "manager"]} permission={{ resource: "subscriptions", action: "view" }} loginPath="/admin/login" />} />
      <Route path="/admin/invoices" component={() => <ProtectedRoute component={AdminInvoices} roles={["admin", "superadmin", "manager"]} permission={{ resource: "invoices", action: "view" }} loginPath="/admin/login" />} />
      <Route path="/admin/complaints" component={() => <ProtectedRoute component={AdminComplaints} roles={["admin", "superadmin", "manager"]} permission={{ resource: "complaints", action: "view" }} loginPath="/admin/login" />} />
      <Route path="/admin/branches" component={() => <ProtectedRoute component={AdminBranches} roles={["admin", "superadmin", "manager"]} permission={{ resource: "branches", action: "view" }} loginPath="/admin/login" />} />
      <Route path="/admin/masters" component={() => <ProtectedRoute component={AdminMasterData} roles={["admin", "superadmin", "manager"]} permission={{ resource: "masters", action: "view" }} loginPath="/admin/login" />} />
      <Route path="/admin/services" component={() => <ProtectedRoute component={AdminServices} roles={["admin", "superadmin", "manager"]} permission={{ resource: "services", action: "view" }} loginPath="/admin/login" />} />
      <Route path="/admin/catalog" component={() => <ProtectedRoute component={ServiceCatalog} roles={["admin", "superadmin", "manager"]} permission={{ resource: "services", action: "view" }} loginPath="/admin/login" />} />
      <Route path="/admin/analytics" component={() => <ProtectedRoute component={AdminAnalytics} roles={["admin", "superadmin", "manager"]} permission={{ resource: "analytics", action: "view" }} loginPath="/admin/login" />} />
      <Route path="/admin/notifications" component={() => <ProtectedRoute component={AdminNotifications} roles={["admin", "superadmin", "manager"]} permission={{ resource: "notifications", action: "view" }} loginPath="/admin/login" />} />
      <Route path="/admin/push-logs" component={() => <ProtectedRoute component={AdminPushLogs} roles={["admin", "superadmin", "manager"]} permission={{ resource: "notifications", action: "view" }} loginPath="/admin/login" />} />
      <Route path="/admin/communications" component={() => <ProtectedRoute component={CommunicationCenter} roles={["admin", "superadmin", "manager"]} permission={{ resource: "communications", action: "view" }} loginPath="/admin/login" />} />
      <Route path="/admin/franchisees" component={() => <ProtectedRoute component={AdminFranchisees} roles={["admin", "superadmin"]} permission={{ resource: "franchisees", action: "view" }} loginPath="/admin/login" />} />
      <Route path="/admin/credentials" component={() => <ProtectedRoute component={AdminCredentials} roles={["admin", "superadmin"]} permission={{ resource: "staff", action: "approve" }} loginPath="/admin/login" />} />
      <Route path="/admin/churned" component={() => <ProtectedRoute component={AdminChurnedCustomers} roles={["admin", "superadmin", "manager"]} permission={{ resource: "churned", action: "view" }} loginPath="/admin/login" />} />
      <Route path="/admin/leads" component={() => <ProtectedRoute component={AdminLeads} roles={["admin", "superadmin", "manager"]} permission={{ resource: "leads", action: "view" }} loginPath="/admin/login" />} />
      <Route path="/admin/quotations" component={() => <ProtectedRoute component={AdminQuotationBuilder} roles={["admin", "superadmin", "manager"]} permission={{ resource: "invoices", action: "view" }} loginPath="/admin/login" />} />
      <Route path="/admin/expenses" component={() => <ProtectedRoute component={AdminExpenses} roles={["admin", "superadmin", "manager"]} permission={{ resource: "invoices", action: "view" }} loginPath="/admin/login" />} />
      <Route path="/admin/dues" component={() => <ProtectedRoute component={AdminDues} roles={["admin", "superadmin", "manager"]} permission={{ resource: "invoices", action: "view" }} loginPath="/admin/login" />} />
      <Route path="/admin/operations-wall" component={() => <ProtectedRoute component={OperationsWall} roles={["admin", "superadmin", "manager"]} loginPath="/admin/login" />} />
      <Route path="/admin/founder" component={() => <ProtectedRoute component={FounderDashboard} roles={["superadmin"]} loginPath="/admin/login" />} />
      <Route path="/admin/settings/brand" component={() => <ProtectedRoute component={BrandIdentity} roles={["admin", "superadmin", "manager"]} permission={{ resource: "settings", action: "view" }} loginPath="/admin/login" />} />
      <Route path="/admin/settings/system" component={() => <ProtectedRoute component={SystemStatus} roles={["admin", "superadmin", "manager"]} permission={{ resource: "settings", action: "view" }} loginPath="/admin/login" />} />
      <Route path="/admin/settings/business" component={() => <ProtectedRoute component={BusinessInfoPage} roles={["admin", "superadmin"]} permission={{ resource: "settings", action: "view" }} loginPath="/admin/login" />} />
      <Route path="/admin/settings/seo" component={() => <ProtectedRoute component={SeoSettingsPage} roles={["admin", "superadmin"]} permission={{ resource: "settings", action: "view" }} loginPath="/admin/login" />} />
      <Route path="/admin/compliance" component={() => <ProtectedRoute component={ComplianceSettings} roles={["admin", "superadmin"]} permission={{ resource: "settings", action: "view" }} loginPath="/admin/login" />} />
      <Route path="/admin/legal" component={() => <ProtectedRoute component={LegalCMS} roles={["admin", "superadmin", "manager"]} permission={{ resource: "settings", action: "view" }} loginPath="/admin/login" />} />
      <Route path="/admin" component={AdminRoot} />

      {/* Customer */}
      <Route path="/customer/dashboard" component={() => <ProtectedRoute component={CustomerDashboard} roles={["customer"]} />} />
      <Route path="/customer/wallet" component={() => <ProtectedRoute component={CustomerWallet} roles={["customer"]} />} />
      <Route path="/customer/services" component={() => <ProtectedRoute component={CustomerServices} roles={["customer"]} />} />
      <Route path="/customer/account" component={() => <ProtectedRoute component={CustomerAccount} roles={["customer"]} />} />
      <Route path="/customer/bookings" component={() => <ProtectedRoute component={BookService} roles={["customer"]} />} />
      <Route path="/customer/assets" component={() => <ProtectedRoute component={MyAssets} roles={["customer"]} />} />
      <Route path="/customer/history" component={() => <ProtectedRoute component={CustomerHistory} roles={["customer"]} />} />
      <Route path="/customer/invoices" component={() => <ProtectedRoute component={CustomerInvoices} roles={["customer"]} />} />
      <Route path="/customer/complaints" component={() => <ProtectedRoute component={CustomerComplaints} roles={["customer"]} />} />
      <Route path="/customer/daily-cleaning/history" component={() => <ProtectedRoute component={CustomerDcmsHistoryPage} roles={["customer"]} />} />
      <Route path="/customer/daily-cleaning/gallery" component={() => <ProtectedRoute component={CustomerDcmsGalleryPage} roles={["customer"]} />} />
      <Route path="/customer/daily-cleaning" component={() => <ProtectedRoute component={CustomerDailyCleaningPage} roles={["customer"]} />} />

      {/* Staff — mobile-first field app (Sprint 3) */}
      <Route path="/staff/dashboard" component={() => <ProtectedRoute component={StaffDashboard} roles={["staff"]} />} />
      <Route path="/staff/jobs" component={() => <ProtectedRoute component={StaffJobs} roles={["staff"]} />} />
      <Route path="/staff/earnings" component={() => <ProtectedRoute component={StaffEarnings} roles={["staff"]} />} />
      <Route path="/staff/profile" component={() => <ProtectedRoute component={StaffProfile} roles={["staff"]} />} />
      <Route path="/staff/daily-route" component={() => <ProtectedRoute component={StaffDailyRoutePage} roles={["staff"]} permission={{ resource: "daily_cleaning", action: "complete_visits" }} />} />
      <Route path="/staff/daily-cleaning" component={() => <Redirect to="/staff/daily-route" />} />
      <Route path="/staff/schedule" component={() => <Redirect to="/staff/jobs" />} />
      <Route path="/staff/attendance" component={() => <Redirect to="/staff/profile" />} />
      <Route path="/staff/performance" component={() => <Redirect to="/staff/profile" />} />

      {/* Franchisee */}
      <Route path="/franchisee/dashboard" component={() => <ProtectedRoute component={FranchiseeDashboard} roles={["franchisee"]} />} />
      <Route path="/franchisee/bookings" component={() => <ProtectedRoute component={FranchiseeBookings} roles={["franchisee"]} />} />
      <Route path="/franchisee/staff" component={() => <ProtectedRoute component={FranchiseeStaff} roles={["franchisee"]} />} />
      <Route path="/franchisee/churned" component={() => <ProtectedRoute component={FranchiseeChurned} roles={["franchisee"]} />} />
      <Route path="/franchisee/leads" component={() => <ProtectedRoute component={FranchiseeLeads} roles={["franchisee"]} permission={{ resource: "leads", action: "view" }} />} />
      {/* QW-11: Fix broken franchisee notifications route */}
      <Route path="/franchisee/notifications" component={() => <ProtectedRoute component={() => (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="text-center max-w-sm">
            <p className="font-display font-bold text-lg mb-2">Notifications</p>
            <p className="text-muted-foreground text-sm">Push notifications for franchisees are coming soon.</p>
          </div>
        </div>
      )} roles={["franchisee"]} />} />

      {/* City SEO pages: /varanasi/daily-car-cleaning — must be after all fixed routes */}
      <Route path="/:citySlug/:serviceSlug" component={CityServicePage} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConnectivityProvider>
        <AuthProvider>
          <BrandingProvider>
            <AppSplashGate />
            <TooltipProvider>
              <ConnectivityBanner className="sticky top-0 z-40" />
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <PwaRouteHeadSync />
                <Router />
              </WouterRouter>
              <Toaster />
            </TooltipProvider>
          </BrandingProvider>
        </AuthProvider>
      </ConnectivityProvider>
    </QueryClientProvider>
  );
}

export default App;
