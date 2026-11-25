/**
 * SVC-002: Service Workflow State Machine & Operational Definition Engine
 * Differentiates Daily Cleaning (quick daily pass, society bay) from Detailing/Washing (time slot, water/electricity requirement).
 * Separates DCMS daily route from one-off detailing and studio workflows.
 */

export type ServiceBookingMode = "recurring_subscription" | "slot_appointment" | "full_day_bay";

export type ServiceExecutionModel = "batch_route" | "dedicated_job" | "multi_stage_studio";

export type BayRequirement =
  | "parking_bay_basement"
  | "customer_driveway"
  | "dedicated_wash_bay"
  | "rooftop_terrace"
  | "detailing_studio";

export type WaterRequirement = "none_waterless" | "customer_tap" | "tanker_ro" | "studio_plumbing";

export type PowerRequirement = "none_battery" | "customer_socket_220v" | "generator_van" | "studio_heavy";

export type ServiceWorkflowChecklistItem = {
  label: string;
  isRequired: boolean;
  order: number;
};

export type ServiceWorkflowDefinition = {
  serviceType: string;
  category: string;
  displayName: string;
  description: string;
  bookingMode: ServiceBookingMode;
  executionModel: ServiceExecutionModel;
  resourceRequirements: {
    waterSource: WaterRequirement;
    powerSource: PowerRequirement;
    bayType: BayRequirement;
    equipment: string[];
    waterRequired: boolean;
    electricityRequired: boolean;
  };
  timingConstraints: {
    estimatedDurationMinutes: number;
    timeSlotRequired: boolean;
    allowedOperatingWindows: { start: string; end: string };
    leadTimeHours: number;
  };
  photoRequirements: {
    minPhotos: number;
    maxPhotos: number;
    requireBeforePhoto: boolean;
    requireAfterPhoto: boolean;
    requiredAngles: string[];
  };
  checklist: ServiceWorkflowChecklistItem[];
  allowedTransitions: Record<string, string[]>;
};

// ─── Authoritative Workflow Definitions ──────────────────────────────────────

export const DAILY_CLEANING_WORKFLOW: ServiceWorkflowDefinition = {
  serviceType: "daily_cleaning",
  category: "daily_cleaning",
  displayName: "Daily Car Cleaning",
  description:
    "High-throughput society cluster morning pass. Cleaners execute rapid exterior & glass cleans in residential parking bays without water/electricity hookup.",
  bookingMode: "recurring_subscription",
  executionModel: "batch_route",
  resourceRequirements: {
    waterSource: "none_waterless",
    powerSource: "none_battery",
    bayType: "parking_bay_basement",
    equipment: [
      "Color-coded microfiber towels (body vs wheel)",
      "Eco waterless cleaning solution spray",
      "Tire dressing applicator",
      "Duster & glass cleaner",
    ],
    waterRequired: false,
    electricityRequired: false,
  },
  timingConstraints: {
    estimatedDurationMinutes: 10,
    timeSlotRequired: false,
    allowedOperatingWindows: { start: "06:00", end: "10:30" },
    leadTimeHours: 0,
  },
  photoRequirements: {
    minPhotos: 1,
    maxPhotos: 2,
    requireBeforePhoto: false,
    requireAfterPhoto: true,
    requiredAngles: ["rear_with_number_plate", "front_angle"],
  },
  checklist: [
    { label: "Verify vehicle registration number & assigned parking bay", isRequired: true, order: 1 },
    { label: "Dry dusting & debris removal with California duster", isRequired: true, order: 2 },
    { label: "Waterless spray wipe on body panels with clean microfiber", isRequired: true, order: 3 },
    { label: "Glass & windshield cleaning inside/outside wipe", isRequired: true, order: 4 },
    { label: "Tire sidewall cleaning & dressing application", isRequired: false, order: 5 },
    { label: "Capture completion photo showing clean car & visible plate", isRequired: true, order: 6 },
  ],
  allowedTransitions: {
    scheduled: ["in_progress", "en_route", "car_not_available", "cancelled"],
    en_route: ["in_progress", "car_not_available", "cancelled"],
    in_progress: ["completed", "car_not_available", "cancelled"],
    paused: ["in_progress", "cancelled"],
    car_not_available: [],
    completed: [],
    cancelled: [],
  },
};

export const CAR_WASH_WORKFLOW: ServiceWorkflowDefinition = {
  serviceType: "car_wash",
  category: "car_wash",
  displayName: "Doorstep Full Car Wash",
  description:
    "Scheduled time-slot appointment. Dedicated washer utilizes high-pressure washer, snow foam, wheel cleaning, and microfiber dry at customer premises.",
  bookingMode: "slot_appointment",
  executionModel: "dedicated_job",
  resourceRequirements: {
    waterSource: "customer_tap",
    powerSource: "customer_socket_220v",
    bayType: "customer_driveway",
    equipment: [
      "Portable high-pressure washer",
      "Snow foam cannon & pH neutral shampoo",
      "Wheel & arch brushes",
      "Plush drying microfibers",
      "Extension cord & garden hose connector",
    ],
    waterRequired: true,
    electricityRequired: true,
  },
  timingConstraints: {
    estimatedDurationMinutes: 45,
    timeSlotRequired: true,
    allowedOperatingWindows: { start: "08:00", end: "18:00" },
    leadTimeHours: 4,
  },
  photoRequirements: {
    minPhotos: 2,
    maxPhotos: 4,
    requireBeforePhoto: true,
    requireAfterPhoto: true,
    requiredAngles: ["front_exterior", "rear_exterior", "wheel_close_up"],
  },
  checklist: [
    { label: "Check in with customer & inspect water tap / power connection", isRequired: true, order: 1 },
    { label: "Pre-wash inspection & initial condition photos", isRequired: true, order: 2 },
    { label: "Pressure pre-rinse to dislodge loose grit", isRequired: true, order: 3 },
    { label: "Snow foam soak & contact wash with two-bucket method", isRequired: true, order: 4 },
    { label: "Wheel, rim & tire degreasing and scrub", isRequired: true, order: 5 },
    { label: "Final spot-free rinse & plush towel dry", isRequired: true, order: 6 },
    { label: "Tire shine & exterior plastic trim conditioning", isRequired: true, order: 7 },
    { label: "Customer handover & completion photo capture", isRequired: true, order: 8 },
  ],
  allowedTransitions: {
    scheduled: ["en_route", "cancelled"],
    en_route: ["in_progress", "cancelled"],
    in_progress: ["paused", "completed", "cancelled"],
    paused: ["in_progress", "cancelled"],
    completed: [],
    cancelled: [],
  },
};

export const INTERIOR_DETAILING_WORKFLOW: ServiceWorkflowDefinition = {
  serviceType: "interior_detailing",
  category: "detailing",
  displayName: "Deep Interior Detailing",
  description:
    "Multi-hour intensive appointment (2-3 hours). Deep steam extraction, leather conditioning, ozone sanitization, and upholstery shampoo in shaded area.",
  bookingMode: "slot_appointment",
  executionModel: "dedicated_job",
  resourceRequirements: {
    waterSource: "customer_tap",
    powerSource: "customer_socket_220v",
    bayType: "customer_driveway",
    equipment: [
      "Commercial wet/dry vacuum & upholstery extractor",
      "High-temperature steam sanitizing machine",
      "Interior detailing brushes & boars hair tools",
      "Leather cleaner & matte UV conditioner",
      "Ozone air purification generator",
    ],
    waterRequired: true,
    electricityRequired: true,
  },
  timingConstraints: {
    estimatedDurationMinutes: 150,
    timeSlotRequired: true,
    allowedOperatingWindows: { start: "09:00", end: "17:00" },
    leadTimeHours: 12,
  },
  photoRequirements: {
    minPhotos: 4,
    maxPhotos: 8,
    requireBeforePhoto: true,
    requireAfterPhoto: true,
    requiredAngles: [
      "seats_before",
      "seats_after",
      "dashboard_console",
      "door_pads",
      "boot_compartment",
    ],
  },
  checklist: [
    { label: "Customer greeting & personal belongings inventory check", isRequired: true, order: 1 },
    { label: "Capture pre-service interior condition photos", isRequired: true, order: 2 },
    { label: "High-power vacuuming of carpets, seats, and crevices", isRequired: true, order: 3 },
    { label: "Steam sanitization of AC vents, door trims & dashboard", isRequired: true, order: 4 },
    { label: "Shampoo & extraction of fabric seats / leather conditioning", isRequired: true, order: 5 },
    { label: "Roof liner gentle dry foaming & stain treatment", isRequired: true, order: 6 },
    { label: "UV matte dressing on dashboard & center console", isRequired: true, order: 7 },
    { label: "Ozone deodorization cycle (15 minutes)", isRequired: false, order: 8 },
    { label: "Capture post-service photos & customer sign-off", isRequired: true, order: 9 },
  ],
  allowedTransitions: {
    scheduled: ["en_route", "cancelled"],
    en_route: ["in_progress", "cancelled"],
    in_progress: ["paused", "quality_review", "completed", "cancelled"],
    paused: ["in_progress", "cancelled"],
    quality_review: ["completed", "in_progress"],
    completed: [],
    cancelled: [],
  },
};

export const CERAMIC_COATING_WORKFLOW: ServiceWorkflowDefinition = {
  serviceType: "ceramic_coating",
  category: "detailing",
  displayName: "Ceramic Coating & Paint Correction",
  description:
    "Multi-stage precision studio workflow (6-8 hours). Paint depth measurement, multi-stage rotary correction, prep wipe, 9H ceramic application, and infrared curing.",
  bookingMode: "full_day_bay",
  executionModel: "multi_stage_studio",
  resourceRequirements: {
    waterSource: "studio_plumbing",
    powerSource: "studio_heavy",
    bayType: "detailing_studio",
    equipment: [
      "Digital paint thickness gauge",
      "Dual-action & rotary polishers with wool/foam pads",
      "Compounds & ultra-fine finishing polishes",
      "Clay bars & iron fallout remover",
      "Isopropyl alcohol (IPA) surface prep wipe",
      "9H / 10H ceramic coating liquid & suede applicators",
      "Infrared curing lamps & inspection LED lights",
    ],
    waterRequired: true,
    electricityRequired: true,
  },
  timingConstraints: {
    estimatedDurationMinutes: 420,
    timeSlotRequired: true,
    allowedOperatingWindows: { start: "08:30", end: "19:00" },
    leadTimeHours: 24,
  },
  photoRequirements: {
    minPhotos: 6,
    maxPhotos: 12,
    requireBeforePhoto: true,
    requireAfterPhoto: true,
    requiredAngles: [
      "swirl_inspection_lighting_before",
      "paint_depth_gauge_readings",
      "50_50_correction_comparison",
      "post_coating_gloss_meter",
      "hood_reflection",
      "full_car_profile_final",
    ],
  },
  checklist: [
    { label: "Decontamination wash & iron fallout chemical bath", isRequired: true, order: 1 },
    { label: "Mechanical clay bar treatment over all painted surfaces", isRequired: true, order: 2 },
    { label: "Digital paint depth measurement & masking rubber/trim", isRequired: true, order: 3 },
    { label: "Stage 1 Heavy cutting compound for scratch/swirl removal", isRequired: true, order: 4 },
    { label: "Stage 2 Ultra-fine polishing for mirror-finish clarity", isRequired: true, order: 5 },
    { label: "Isopropyl alcohol (IPA) wipe to eliminate polishing oils", isRequired: true, order: 6 },
    { label: "Ceramic coating panel-by-panel application & cross-hatch leveling", isRequired: true, order: 7 },
    { label: "Inspection under dual-spectrum lighting for high spots", isRequired: true, order: 8 },
    { label: "Infrared curing lamp bake cycle (minimum 4 hours cure)", isRequired: true, order: 9 },
    { label: "Final quality audit, warranty certificate & photo evidence", isRequired: true, order: 10 },
  ],
  allowedTransitions: {
    scheduled: ["in_progress", "cancelled"],
    in_progress: ["paused", "curing", "quality_review", "cancelled"],
    paused: ["in_progress", "cancelled"],
    curing: ["quality_review", "in_progress"],
    quality_review: ["completed", "in_progress"],
    completed: [],
    cancelled: [],
  },
};

export const SOLAR_CLEANING_WORKFLOW: ServiceWorkflowDefinition = {
  serviceType: "solar_cleaning",
  category: "solar_care",
  displayName: "Solar Rooftop Panel Cleaning",
  description:
    "Rooftop specialized maintenance pass. Technicians utilize safety harnesses, telescopic water-fed brushes, and demineralized water to maximize solar generation efficiency.",
  bookingMode: "slot_appointment",
  executionModel: "dedicated_job",
  resourceRequirements: {
    waterSource: "customer_tap",
    powerSource: "none_battery",
    bayType: "rooftop_terrace",
    equipment: [
      "Telescopic carbon-fiber water-fed pole with soft nylon brush",
      "Safety fall-protection harness & lifeline",
      "Demineralized filtration cartridge / nozzle",
      "Non-abrasive solar cleaning solution",
      "Inverter generation output meter",
    ],
    waterRequired: true,
    electricityRequired: false,
  },
  timingConstraints: {
    estimatedDurationMinutes: 60,
    timeSlotRequired: true,
    allowedOperatingWindows: { start: "07:00", end: "11:00" }, // Avoid hot midday sun to prevent thermal shock to glass
    leadTimeHours: 12,
  },
  photoRequirements: {
    minPhotos: 2,
    maxPhotos: 6,
    requireBeforePhoto: true,
    requireAfterPhoto: true,
    requiredAngles: ["rooftop_overview_before", "panel_close_up_soiled", "rooftop_overview_after", "inverter_kwh_reading"],
  },
  checklist: [
    { label: "Rooftop safety perimeter check & fall-arrest harness anchor", isRequired: true, order: 1 },
    { label: "Inspect panel glass condition & record inverter current kWh", isRequired: true, order: 2 },
    { label: "Capture pre-cleaning rooftop soiled panel photos", isRequired: true, order: 3 },
    { label: "Debris & dry dust clearing using soft bristle head", isRequired: true, order: 4 },
    { label: "Demineralized water rinse & gentle scrub (zero abrasive chemicals)", isRequired: true, order: 5 },
    { label: "Frame drain hole inspection & clearing of trapped sediment", isRequired: true, order: 6 },
    { label: "Check post-clean generation increase on inverter display", isRequired: false, order: 7 },
    { label: "Capture post-cleaning sparkling panel photos & customer completion", isRequired: true, order: 8 },
  ],
  allowedTransitions: {
    scheduled: ["en_route", "cancelled"],
    en_route: ["in_progress", "cancelled"],
    in_progress: ["paused", "completed", "cancelled"],
    paused: ["in_progress", "cancelled"],
    completed: [],
    cancelled: [],
  },
};

// ─── Workflow Registry & Engine Helpers ─────────────────────────────────────

const WORKFLOW_REGISTRY: Record<string, ServiceWorkflowDefinition> = {
  daily_cleaning: DAILY_CLEANING_WORKFLOW,
  dcms: DAILY_CLEANING_WORKFLOW,
  car_wash: CAR_WASH_WORKFLOW,
  wash: CAR_WASH_WORKFLOW,
  interior_detailing: INTERIOR_DETAILING_WORKFLOW,
  detailing: INTERIOR_DETAILING_WORKFLOW,
  ceramic_coating: CERAMIC_COATING_WORKFLOW,
  paint_protection: CERAMIC_COATING_WORKFLOW,
  solar_cleaning: SOLAR_CLEANING_WORKFLOW,
  solar_care: SOLAR_CLEANING_WORKFLOW,
};

/**
 * Returns the authoritative workflow specification for a given service type or slug.
 */
export function getServiceWorkflowDefinition(serviceTypeOrSlug: string): ServiceWorkflowDefinition {
  const normalized = serviceTypeOrSlug.toLowerCase().replace(/[-\s]/g, "_");
  const found = WORKFLOW_REGISTRY[normalized];
  if (found) return found;

  // Fallback to generalized wash workflow
  return {
    ...CAR_WASH_WORKFLOW,
    serviceType: serviceTypeOrSlug,
    displayName: serviceTypeOrSlug.replace(/_/g, " "),
  };
}

/**
 * Lists all registered distinct service workflows.
 */
export function listAllServiceWorkflowDefinitions(): ServiceWorkflowDefinition[] {
  return [
    DAILY_CLEANING_WORKFLOW,
    CAR_WASH_WORKFLOW,
    INTERIOR_DETAILING_WORKFLOW,
    CERAMIC_COATING_WORKFLOW,
    SOLAR_CLEANING_WORKFLOW,
  ];
}

/**
 * Generates initial ordered checklist items for a service execution.
 */
export function generateExecutionChecklist(
  serviceType: string,
): { label: string; isRequired: boolean; order: number }[] {
  const workflow = getServiceWorkflowDefinition(serviceType);
  return workflow.checklist;
}

/**
 * Validates whether an execution state transition is permitted for the given service type.
 */
export function validateServiceExecutionTransition(input: {
  serviceType: string;
  currentStatus: string;
  targetStatus: string;
  payload?: {
    photosCount?: number;
    hasCustomerSignature?: boolean;
    parkingBayVerified?: boolean;
  };
}): { allowed: boolean; reason?: string } {
  const { serviceType, currentStatus, targetStatus, payload } = input;
  const workflow = getServiceWorkflowDefinition(serviceType);

  const allowedNext = workflow.allowedTransitions[currentStatus];
  if (!allowedNext || !allowedNext.includes(targetStatus)) {
    return {
      allowed: false,
      reason: `Transition from "${currentStatus}" to "${targetStatus}" is not permitted for ${workflow.displayName}. Allowed targets: [${(allowedNext || []).join(", ")}]`,
    };
  }

  // Target-specific business validations
  if (targetStatus === "completed") {
    const minPhotos = workflow.photoRequirements.minPhotos;
    const providedPhotos = payload?.photosCount ?? 0;
    if (providedPhotos < minPhotos) {
      return {
        allowed: false,
        reason: `${workflow.displayName} requires at least ${minPhotos} completion photo(s). Provided: ${providedPhotos}.`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Identifies the execution model for a service:
 * - 'batch_route': Daily cleaning multi-vehicle society loop
 * - 'dedicated_job': Single-time-slot appointment
 * - 'multi_stage_studio': Multi-hour or multi-day detailing/coating
 */
export function getExecutionModelForService(serviceType: string): ServiceExecutionModel {
  return getServiceWorkflowDefinition(serviceType).executionModel;
}
