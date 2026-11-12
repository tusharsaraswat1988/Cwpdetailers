export class CashfreeError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly errorType: string;
  public readonly isGatewayError: boolean;
  public readonly isTimeout: boolean;
  public readonly orderId?: string;
  public readonly details?: unknown;

  constructor(params: {
    message: string;
    statusCode: number;
    code?: string;
    errorType?: string;
    isTimeout?: boolean;
    orderId?: string;
    details?: unknown;
    cause?: unknown;
  }) {
    super(params.message);
    this.name = "CashfreeError";
    this.statusCode = params.statusCode;
    this.code = params.code || (params.statusCode >= 500 ? "GATEWAY_ERROR" : "REQUEST_FAILED");
    this.errorType = params.errorType || (params.statusCode >= 500 ? "api_error" : "invalid_request_error");
    this.isGatewayError = params.statusCode >= 500;
    this.isTimeout = Boolean(params.isTimeout);
    this.orderId = params.orderId;
    this.details = params.details;
    if (params.cause) {
      this.cause = params.cause;
    }
  }

  get status(): number {
    return this.statusCode;
  }
}
