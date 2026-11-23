import React, { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { MaterialSymbol } from "@/lib/design-system/MaterialSymbol";

export interface WorkflowGuide {
  id: string;
  title: string;
  category: string;
  icon: string;
  summary: string;
  estimatedTime: string;
  primaryAction: {
    label: string;
    href: string;
    icon: string;
  };
  steps: Array<{
    number: number;
    title: string;
    detail: string;
    tip?: string;
    action?: {
      label: string;
      href: string;
    };
  }>;
  commonPitfalls: string[];
}

export const WORKFLOW_GUIDES: WorkflowGuide[] = [
  {
    id: "branch_creation",
    title: "New Branch Creation & Network Setup",
    category: "Network & Expansion",
    icon: "account_tree",
    summary: "Complete procedure to provision a new operating branch, bind city coverage, assign managers, and complete the readiness checklist.",
    estimatedTime: "5 - 10 mins",
    primaryAction: {
      label: "Go to Branches Hub",
      href: "/admin/branches",
      icon: "open_in_new",
    },
    steps: [
      {
        number: 1,
        title: "City Selection & Lifecycle Activation",
        detail: "Ensure the operating city (e.g. Noida, Varanasi) has status set to 'Active' or 'Setup in Progress' in Cities Hub.",
        tip: "Draft cities cannot be serviced by customers until transitioned to 'Active'.",
        action: { label: "View Cities Hub", href: "/admin/cities" },
      },
      {
        number: 2,
        title: "Create Branch Profile & Operating Model",
        detail: "Navigate to Branches > Click '+ Add Branch'. Provide Branch Name, unique Branch Code (e.g. NOID-EXPWY), and select Operating Model: COCO (Company-Owned) or FOFO (Franchise-Owned).",
        tip: "Branch code must be 3-10 uppercase alphanumeric characters.",
        action: { label: "Create Branch", href: "/admin/branches" },
      },
      {
        number: 3,
        title: "Designate Operational Headquarters & Geo-Coordinates",
        detail: "Enter the physical workshop address, primary phone number, and GPS latitude/longitude. This serves as the dispatch anchor for technician distance calculations.",
      },
      {
        number: 4,
        title: "Assign Operational Zones & Gated Societies",
        detail: "Map local residential gated societies and tower clusters to this branch in Societies & Towers hub to enable doorstep car cleaning.",
        action: { label: "Map Societies", href: "/admin/societies" },
      },
      {
        number: 5,
        title: "Assign Branch Manager & Verify Readiness",
        detail: "Assign authorized branch managers under Branch Team. Review the automated 6-point Branch Readiness Checklist to ensure 100% operational score before launch.",
      },
    ],
    commonPitfalls: [
      "Leaving branch status as 'suspended' or 'draft' will hide service slots from customers.",
      "Branch manager must be assigned before field cleaners can submit daily attendance.",
    ],
  },

  {
    id: "catalog_setup",
    title: "Product & Service Catalog Configuration",
    category: "Commercial & Services",
    icon: "inventory_2",
    summary: "How to define new doorstep car wash packages, daily cleaning (DCMS) plans, solar services, and activate city pricing matrices.",
    estimatedTime: "3 - 5 mins",
    primaryAction: {
      label: "Open Catalog Manager",
      href: "/admin/services",
      icon: "open_in_new",
    },
    steps: [
      {
        number: 1,
        title: "Choose Division & Service Category",
        detail: "In Service Catalog, select the appropriate tab: Detailing Wash Services, Wash Packages, Daily Cleaning (DCMS), or Solar Panel Cleaning.",
        action: { label: "Service Catalog", href: "/admin/services" },
      },
      {
        number: 2,
        title: "Define Service Specifications & Tax Slab",
        detail: "Enter Service Name, short customer-facing description, estimated service duration (minutes), and GST rate (typically 18% for detailing).",
        tip: "HSN/SAC Code 998714 applies to automotive wash; 998719 applies to solar cleaning.",
      },
      {
        number: 3,
        title: "Configure Vehicle Category Pricing Tiers",
        detail: "Set differential base pricing across vehicle types: Hatchback, Sedan, SUV, and Luxury. Daily cleaning plans can also specify monthly frequency (Daily, 3x/week, Alternate Days).",
      },
      {
        number: 4,
        title: "Turn ON in City Availability Matrix",
        detail: "Switch to the 'City Matrix' tab in Catalog Manager. Toggle the green switch for your target city/branch. Services are hidden until enabled in the matrix.",
        action: { label: "City Matrix Tab", href: "/admin/services?tab=city-matrix" },
      },
    ],
    commonPitfalls: [
      "Adding a service without enabling it in the City Availability Matrix makes it invisible in customer booking flows.",
      "Changing prices does not retroactively change existing active recurring subscriptions.",
    ],
  },

  {
    id: "customer_onboarding",
    title: "Customer Registration & Asset Onboarding",
    category: "Customers & CRM",
    icon: "person_add",
    summary: "Standard operating procedure to register new customers, map gated residential addresses, register vehicle assets, and create app logins.",
    estimatedTime: "2 - 3 mins",
    primaryAction: {
      label: "Open Customer Directory",
      href: "/admin/customers",
      icon: "open_in_new",
    },
    steps: [
      {
        number: 1,
        title: "Enter Primary Customer Identity",
        detail: "Click '+ New Customer' in Customer Directory. Enter full customer name, verified 10-digit mobile number, and optional email.",
        tip: "The mobile number serves as the customer's permanent login identifier.",
        action: { label: "Customer Directory", href: "/admin/customers" },
      },
      {
        number: 2,
        title: "Map Residential Service Address",
        detail: "For apartment dwellers: Select Gated Society, Tower / Block, and Flat Number. For standalone houses: Enter street address and pincode.",
        tip: "Accurate tower selection ensures the cleaner finds the vehicle easily in basement parking.",
      },
      {
        number: 3,
        title: "Register Vehicle Asset or Solar Plant",
        detail: "Add vehicle make & model (e.g. Hyundai Creta), registration number (e.g. UP 32 AB 1234), vehicle category (SUV), and parking slot location.",
      },
      {
        number: 4,
        title: "Generate App Login & Dispatch Credentials",
        detail: "Keep 'Create App Login' checked. A temporary password or instant OTP login will be provisioned so the customer can track services on their phone.",
      },
    ],
    commonPitfalls: [
      "Duplicate phone numbers are rejected by backend contact identity guards.",
      "Ensure the customer's society matches the active branch's serviceable coverage area.",
    ],
  },

  {
    id: "service_assignment",
    title: "Cleaner & Technician Service Assignment",
    category: "Daily Operations",
    icon: "assignment_ind",
    summary: "Assigning dedicated daily route cleaners for monthly subscriptions and certified technicians for on-demand detailing jobs.",
    estimatedTime: "2 - 4 mins",
    primaryAction: {
      label: "Go to Assignment Board",
      href: "/admin/assign-services",
      icon: "open_in_new",
    },
    steps: [
      {
        number: 1,
        title: "Triage Unassigned Service Queue",
        detail: "Open Assignment Board (`/admin/assign-services`). Filter by 'Unassigned' to inspect upcoming bookings and monthly wash rosters needing staff allocation.",
        action: { label: "Assignment Board", href: "/admin/assign-services" },
      },
      {
        number: 2,
        title: "Differentiate DCMS vs Detailing Assignment",
        detail: "Daily Cleaning (DCMS): Assign a cleaner for the full monthly recurring roster covering that society tower. On-Demand Detailing: Assign a technician for the specific time slot.",
        tip: "Daily cleaners should ideally handle cars within 1-2 adjacent towers to minimize transit time.",
      },
      {
        number: 3,
        title: "Validate Staff Eligibility & Availability",
        detail: "The system automatically checks staff role certification, active status, branch binding, and slot capacity before allowing confirmation.",
      },
      {
        number: 4,
        title: "Dispatch to Staff Mobile App",
        detail: "Once assigned, the job appears on the staff member's Daily Route in their mobile Staff App with customer vehicle slot and notes.",
      },
    ],
    commonPitfalls: [
      "Assigning an inactive or unverified staff member will fail validation.",
      "Staff must check in their daily attendance selfie before routes become executable.",
    ],
  },

  {
    id: "stage_tracking",
    title: "Service Completion Stage Progression & Quality Audit",
    category: "Execution Intelligence",
    icon: "task_alt",
    summary: "How to monitor, analyze, and troubleshoot services across all 6 completion stages from initial dispatch to photo evidence sign-off.",
    estimatedTime: "Daily continuous",
    primaryAction: {
      label: "Open Job Board",
      href: "/admin/jobs",
      icon: "open_in_new",
    },
    steps: [
      {
        number: 1,
        title: "Stage 1: Waiting Assignment",
        detail: "Job is created and confirmed. Requires dispatch supervisor to allocate a staff member before scheduled slot window.",
      },
      {
        number: 2,
        title: "Stage 2: Assigned & Scheduled",
        detail: "Staff assigned. App syncs route to cleaner's device. Customer receives technician details notification.",
      },
      {
        number: 3,
        title: "Stage 3: En Route (GPS Telemetry Active)",
        detail: "Technician taps 'Start Trip'. Real-time GPS pings calculate honest ETA for customer. Flags delays if technician is running > 15m late.",
        action: { label: "Monitor Daily Route", href: "/admin/daily-cleaning" },
      },
      {
        number: 4,
        title: "Stage 4: In Progress (Cleaning Underway)",
        detail: "Technician reaches parking location and starts wash. Live timer runs on staff interface.",
      },
      {
        number: 5,
        title: "Stage 5: Proofs & Quality Review",
        detail: "Technician captures required before/after photos and shutter geotag. Photo proof enters Quality Review queue for supervisor approval.",
        action: { label: "Review Approvals", href: "/admin/approvals" },
      },
      {
        number: 6,
        title: "Stage 6: Completed & Ready for Billing",
        detail: "Proof accepted. Service marked complete. Customer rating prompt sent. Job record unlocked for invoice generation.",
      },
    ],
    commonPitfalls: [
      "If a technician cannot complete a wash (e.g. gate locked, car away), they must log a Service Exception rather than ignoring the job.",
      "Live GPS tracking automatically terminates once service reaches Completed or Cancelled status.",
    ],
  },

  {
    id: "billing_payments",
    title: "Billing, Invoicing & Payment Ledger Management",
    category: "Commercial & Finance",
    icon: "receipt_long",
    summary: "Generating GST tax invoices, reconciling online gateway payments, and recording offline cash/UPI collections in the ledger.",
    estimatedTime: "3 - 5 mins",
    primaryAction: {
      label: "Open Billing & Invoices",
      href: "/admin/billing",
      icon: "open_in_new",
    },
    steps: [
      {
        number: 1,
        title: "Inspect Completed Unbilled Services & Dues",
        detail: "In Billing & Invoices, review the Unbilled queue. For monthly DCMS subscriptions, advance monthly invoices are generated on subscription creation.",
        action: { label: "Billing & Invoices", href: "/admin/billing" },
      },
      {
        number: 2,
        title: "Generate Official GST Tax Invoice",
        detail: "Click 'Generate Invoice' for the booking. The system calculates base price, applicable CGST + SGST (or IGST), and generates an immutable sequential invoice number.",
      },
      {
        number: 3,
        title: "Reconcile Online Payments (Razorpay / Cashfree)",
        detail: "Online customer payments via UPI, Credit Card, or Netbanking are automatically reconciled via webhooks into the Payment Ledger.",
        action: { label: "Payment Ledger", href: "/admin/payments/ledger" },
      },
      {
        number: 4,
        title: "Record Offline Cash or Field UPI Collections",
        detail: "When a cleaner collects cash or field UPI: Open Payment Ledger > Click '+ Record Payment'. Select customer, enter amount collected, and payment method to clear outstanding dues.",
        tip: "Always enter the UPI transaction reference ID when recording manual UPI receipts.",
      },
    ],
    commonPitfalls: [
      "Tax invoices cannot be edited after generation — write a credit note / adjustment if price corrections are required.",
      "Ensure customer GSTIN is formatted correctly with valid 15-character structure before B2B invoice generation.",
    ],
  },
];

export interface AdminIntelligencePlaybookProps {
  initialWorkflow?: string;
  onClose?: () => void;
}

export function AdminIntelligencePlaybook({
  initialWorkflow = "branch_creation",
  onClose,
}: AdminIntelligencePlaybookProps) {
  const [activeWorkflow, setActiveWorkflow] = useState<string>(initialWorkflow);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredGuides = WORKFLOW_GUIDES.filter((guide) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      guide.title.toLowerCase().includes(q) ||
      guide.summary.toLowerCase().includes(q) ||
      guide.category.toLowerCase().includes(q) ||
      guide.steps.some((s) => s.title.toLowerCase().includes(q) || s.detail.toLowerCase().includes(q))
    );
  });

  const selectedGuide = WORKFLOW_GUIDES.find((g) => g.id === activeWorkflow) ?? WORKFLOW_GUIDES[0];

  return (
    <div className="flex flex-col h-full bg-background" data-testid="admin-intelligence-playbook">
      {/* Header with Search */}
      <div className="p-4 sm:p-5 border-b border-border/80 bg-card/60 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <MaterialSymbol name="psychology" size={22} weight={600} />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                Admin & Manager Operations Playbook
              </h2>
              <p className="text-xs text-muted-foreground">
                Step-by-step interactive intelligence guides for all core administrative operations
              </p>
            </div>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full">
              <MaterialSymbol name="close" size={18} />
            </Button>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative">
          <span className="absolute left-3 top-2.5 text-muted-foreground pointer-events-none">
            <MaterialSymbol name="search" size={16} />
          </span>
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search guides (e.g. new branch, assign cleaner, GST invoice, stages)..."
            className="pl-9 h-9 text-xs bg-background"
            data-testid="playbook-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground text-xs"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Main Container: Split View */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Column: Workflow Selector */}
        <div className="w-full md:w-72 lg:w-80 border-r border-border/70 p-3 space-y-1.5 overflow-y-auto bg-muted/20 shrink-0">
          <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase px-2 py-1">
            Core Administrative Workflows
          </p>

          {filteredGuides.map((guide) => {
            const isSelected = guide.id === selectedGuide?.id;
            return (
              <button
                key={guide.id}
                type="button"
                onClick={() => setActiveWorkflow(guide.id)}
                className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-card border-border/70 hover:border-border text-foreground hover:bg-card/80"
                }`}
                data-testid={`playbook-nav-${guide.id}`}
              >
                <span
                  className={`p-1.5 rounded-lg shrink-0 ${
                    isSelected ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
                  }`}
                >
                  <MaterialSymbol name={guide.icon} size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-medium opacity-80 uppercase tracking-wider block truncate">
                      {guide.category}
                    </span>
                    <span className="text-[10px] opacity-75 whitespace-nowrap">
                      {guide.steps.length} steps
                    </span>
                  </div>
                  <p className="text-xs font-bold truncate mt-0.5">{guide.title}</p>
                </div>
              </button>
            );
          })}

          {filteredGuides.length === 0 && (
            <div className="p-4 text-center text-xs text-muted-foreground">
              No workflows matched "{searchQuery}".
            </div>
          )}
        </div>

        {/* Right Column: Workflow Detail & Steps */}
        {selectedGuide && (
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-5" data-testid="playbook-guide-content">
            {/* Guide Header Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/70">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[11px] font-medium border-primary/30 text-primary">
                    {selectedGuide.category}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <MaterialSymbol name="schedule" size={13} />
                    <span>Est. {selectedGuide.estimatedTime}</span>
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                  {selectedGuide.title}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-2xl">
                  {selectedGuide.summary}
                </p>
              </div>

              <div className="shrink-0">
                <Button size="sm" className="gap-1.5 text-xs shadow-xs" asChild>
                  <Link href={selectedGuide.primaryAction.href}>
                    <span>{selectedGuide.primaryAction.label}</span>
                    <MaterialSymbol name={selectedGuide.primaryAction.icon} size={14} />
                  </Link>
                </Button>
              </div>
            </div>

            {/* Step-by-Step Flow */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <MaterialSymbol name="format_list_numbered" size={16} className="text-primary" />
                <span>Execution Steps ({selectedGuide.steps.length})</span>
              </h4>

              <div className="space-y-3">
                {selectedGuide.steps.map((step) => (
                  <div
                    key={step.number}
                    className="p-3.5 sm:p-4 rounded-xl border border-border/80 bg-card/60 hover:bg-card transition-colors space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <span className="flex h-6 w-6 rounded-full bg-primary/10 text-primary font-bold text-xs items-center justify-center shrink-0 mt-0.5">
                          {step.number}
                        </span>
                        <div>
                          <p className="text-xs sm:text-sm font-bold text-foreground">
                            {step.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            {step.detail}
                          </p>
                        </div>
                      </div>

                      {step.action && (
                        <Button variant="outline" size="sm" className="h-7 text-[11px] shrink-0" asChild>
                          <Link href={step.action.href}>
                            <span>{step.action.label}</span>
                            <MaterialSymbol name="arrow_forward" size={12} className="ml-1" />
                          </Link>
                        </Button>
                      )}
                    </div>

                    {step.tip && (
                      <div className="ml-8 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                        <MaterialSymbol name="lightbulb" size={14} className="shrink-0" />
                        <span><strong>Tip:</strong> {step.tip}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Common Pitfalls / Blocker Prevention */}
            {selectedGuide.commonPitfalls.length > 0 && (
              <div className="p-3.5 sm:p-4 rounded-xl border border-red-500/20 bg-red-500/5 space-y-2">
                <h5 className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                  <MaterialSymbol name="error" size={16} />
                  <span>Common Pitfalls & What Can Break The Flow</span>
                </h5>
                <ul className="space-y-1 ml-5 list-disc text-xs text-muted-foreground">
                  {selectedGuide.commonPitfalls.map((pitfall, i) => (
                    <li key={i}>{pitfall}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
