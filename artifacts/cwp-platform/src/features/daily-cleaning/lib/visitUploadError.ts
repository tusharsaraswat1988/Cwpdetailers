/** User-facing message for failed visit photo upload. */
export function visitUploadErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  if (typeof err === "string" && err.trim()) return err;
  return "Unknown error — please try again";
}
