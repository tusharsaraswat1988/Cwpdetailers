/** User-facing message for failed visit photo upload. */
export function visitUploadErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim()) {
    const status = (err as Error & { status?: number }).status;
    return status ? `${err.message} (HTTP ${status})` : err.message;
  }
  if (typeof err === "string" && err.trim()) return err;
  if (typeof err === "object" && err !== null) {
    try {
      return JSON.stringify(err).slice(0, 200);
    } catch {
      /* fall through */
    }
  }
  return "Upload failed — please try again";
}
