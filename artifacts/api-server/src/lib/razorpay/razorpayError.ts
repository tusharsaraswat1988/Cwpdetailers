export class RazorpayError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly rawBody?: unknown;

  constructor(message: string, code: string, statusCode = 500, rawBody?: unknown) {
    super(message);
    this.name = "RazorpayError";
    this.code = code;
    this.statusCode = statusCode;
    this.rawBody = rawBody;
  }
}
