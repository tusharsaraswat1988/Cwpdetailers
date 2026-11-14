export interface RazorpayErrorOptions {
  code: string;
  statusCode?: number;
  description?: string;
  field?: string;
  source?: string;
  step?: string;
  reason?: string;
  rawBody?: unknown;
  stageName?: string;
  correlationId?: string;
}

export class RazorpayError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly description?: string;
  public readonly field?: string;
  public readonly source?: string;
  public readonly step?: string;
  public readonly reason?: string;
  public readonly rawBody?: unknown;
  public readonly stageName?: string;
  public readonly correlationId?: string;

  constructor(message: string, code: string, statusCode = 500, rawBody?: unknown, options?: Partial<RazorpayErrorOptions>) {
    super(message);
    this.name = "RazorpayError";
    this.code = options?.code || code;
    this.statusCode = options?.statusCode ?? statusCode;
    this.rawBody = options?.rawBody ?? rawBody;
    this.description = options?.description;
    this.field = options?.field;
    this.source = options?.source;
    this.step = options?.step;
    this.reason = options?.reason;
    this.stageName = options?.stageName;
    this.correlationId = options?.correlationId;
  }
}
