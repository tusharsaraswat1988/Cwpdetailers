export const MODULE_ERROR_MESSAGES = {
  bookings: {
    load: "Unable to load bookings.",
    save: "Unable to save booking. Retry.",
  },
  billing: {
    load: "Unable to load billing data.",
    save: "Invoice generation failed. Retry.",
  },
  customers: {
    load: "Unable to load customer data.",
    save: "Unable to save customer. Retry.",
  },
  inventory: {
    load: "Unable to load inventory.",
    save: "Unable to sync stock. Retry.",
  },
  expenses: {
    load: "Unable to load expenses.",
    save: "Unable to record expense. Retry.",
  },
  invoices: {
    load: "Unable to load invoices.",
    save: "Unable to save invoice. Retry.",
  },
  leads: {
    load: "Unable to load leads.",
    save: "Unable to save lead. Retry.",
  },
} as const;

export type ModuleKey = keyof typeof MODULE_ERROR_MESSAGES;

export function moduleError(module: ModuleKey, action: "load" | "save"): string {
  return MODULE_ERROR_MESSAGES[module][action];
}

export function queuedSuccessMessage(label: string): string {
  return `${label} saved offline. It will sync automatically when connection returns.`;
}

export const SERVER_CONFIRMATION_REQUIRED =
  "This action requires confirmed server connection. Complete it when you're back online.";
