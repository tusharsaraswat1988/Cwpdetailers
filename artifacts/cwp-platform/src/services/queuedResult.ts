export function isOfflineQueued(result: unknown): result is { queued: true } {
  return Boolean(
    result
    && typeof result === "object"
    && "queued" in result
    && (result as { queued: unknown }).queued === true,
  );
}

export function queuedSavedMessage(kind: "punch" | "visit" | "job" | "photo"): string {
  switch (kind) {
    case "punch":
      return "Check-in phone pe save ho gaya. Network aate hi server par jayega.";
    case "visit":
      return "Visit phone pe save ho gaya. Network aate hi upload hoga.";
    case "job":
      return "Job action phone pe save ho gaya. Network aate hi sync hoga.";
    case "photo":
      return "Photo phone pe save ho gayi. Network aate hi upload hogi.";
  }
}
