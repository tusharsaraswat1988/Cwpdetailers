import { getRazorpayConfig, type RazorpayServerConfig } from "./razorpayConfig";
import { RazorpayError } from "./razorpayError";
import type {
  RazorpayCreateOrderPayload,
  RazorpayOrderEntity,
  RazorpayPaymentEntity,
} from "./types";
import { logger } from "../logger";

export interface RequestOptions {
  timeoutMs?: number;
  correlationId?: string;
}

export class RazorpayClient {
  private config: RazorpayServerConfig;

  constructor(customConfig?: RazorpayServerConfig) {
    this.config = customConfig || getRazorpayConfig();
  }

  private getAuthHeader(): string {
    const creds = `${this.config.keyId}:${this.config.keySecret}`;
    const encoded = Buffer.from(creds).toString("base64");
    return `Basic ${encoded}`;
  }

  private buildUrl(endpoint: string): string {
    const cleanBase = this.config.baseUrl.replace(/\/+$/, "");
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    return `${cleanBase}${cleanEndpoint}`;
  }

  private async request<T>(
    endpoint: string,
    options: {
      method: "GET" | "POST";
      body?: unknown;
      timeoutMs?: number;
      correlationId?: string;
    },
  ): Promise<T> {
    const timeoutMs = options.timeoutMs ?? this.config.timeoutMs;
    const url = this.buildUrl(endpoint);
    const correlationId = options.correlationId || "unknown";
    const headers: Record<string, string> = {
      Authorization: this.getAuthHeader(),
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const isOrderCreation = endpoint === "/orders" && options.method === "POST";
    if (isOrderCreation) {
      logger.info(
        {
          stage: "RAZORPAY_ORDER_REQUEST_SENT",
          correlationId,
          endpoint,
          method: options.method,
          amountPaise: (options.body as any)?.amount,
          currency: (options.body as any)?.currency,
          receipt: (options.body as any)?.receipt,
          paymentCapture: (options.body as any)?.payment_capture,
          keyPrefix: this.config.keyId?.slice(0, 9),
        },
        "[RAZORPAY_CLIENT] Stage 6: RAZORPAY_ORDER_REQUEST_SENT",
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: options.method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get("content-type") || "";
      let responseBody: any;
      if (contentType.includes("application/json")) {
        responseBody = await response.json();
      } else {
        responseBody = await response.text();
      }

      if (!response.ok) {
        const errObj = typeof responseBody === "object" ? responseBody?.error : null;
        const errCode = errObj?.code || `HTTP_${response.status}`;
        const errDesc =
          errObj?.description ||
          errObj?.message ||
          (typeof responseBody === "string" ? responseBody : "Razorpay API request failed");
        const errField = errObj?.field;
        const errSource = errObj?.source;
        const errStep = errObj?.step;
        const errReason = errObj?.reason;

        logger.error(
          {
            stage: isOrderCreation ? "RAZORPAY_ORDER_RESPONSE_RECEIVED" : "GATEWAY_API_ERROR",
            stageStatus: "FAILED",
            correlationId,
            status: response.status,
            endpoint,
            code: errCode,
            description: errDesc,
            field: errField,
            source: errSource,
            step: errStep,
            reason: errReason,
          },
          "[RAZORPAY_CLIENT] Gateway API error response",
        );

        throw new RazorpayError(
          `Razorpay error: ${errDesc}`,
          errCode,
          response.status,
          responseBody,
          {
            code: errCode,
            statusCode: response.status,
            description: errDesc,
            field: errField,
            source: errSource,
            step: errStep,
            reason: errReason,
            rawBody: responseBody,
            stageName: isOrderCreation ? "RAZORPAY_ORDER_RESPONSE_RECEIVED" : undefined,
            correlationId,
          },
        );
      }

      if (isOrderCreation) {
        logger.info(
          {
            stage: "RAZORPAY_ORDER_RESPONSE_RECEIVED",
            stageStatus: "SUCCESS",
            correlationId,
            orderId: responseBody?.id,
            status: responseBody?.status,
            amountPaise: responseBody?.amount,
            currency: responseBody?.currency,
          },
          "[RAZORPAY_CLIENT] Stage 7: RAZORPAY_ORDER_RESPONSE_RECEIVED",
        );
      }

      return responseBody as T;
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err instanceof RazorpayError) {
        throw err;
      }

      if (err.name === "AbortError") {
        logger.error(
          {
            stage: isOrderCreation ? "RAZORPAY_ORDER_RESPONSE_RECEIVED" : "GATEWAY_TIMEOUT",
            stageStatus: "FAILED",
            correlationId,
            endpoint,
            timeoutMs,
          },
          "[RAZORPAY_CLIENT] Request timed out",
        );
        throw new RazorpayError(
          `Razorpay request timed out after ${timeoutMs}ms`,
          "GATEWAY_TIMEOUT",
          504,
          undefined,
          {
            code: "GATEWAY_TIMEOUT",
            statusCode: 504,
            description: `Request timed out after ${timeoutMs}ms`,
            source: "gateway_network",
            step: "order_creation",
            reason: "timeout",
            stageName: isOrderCreation ? "RAZORPAY_ORDER_RESPONSE_RECEIVED" : undefined,
            correlationId,
          },
        );
      }

      logger.error(
        {
          stage: isOrderCreation ? "RAZORPAY_ORDER_RESPONSE_RECEIVED" : "NETWORK_ERROR",
          stageStatus: "FAILED",
          correlationId,
          err: err.message,
          endpoint,
        },
        "[RAZORPAY_CLIENT] Network or fetch error",
      );
      throw new RazorpayError(
        `Failed to communicate with Razorpay: ${err.message}`,
        "NETWORK_ERROR",
        502,
        undefined,
        {
          code: "NETWORK_ERROR",
          statusCode: 502,
          description: err.message,
          source: "network",
          step: "connection",
          reason: "fetch_failure",
          stageName: isOrderCreation ? "RAZORPAY_ORDER_RESPONSE_RECEIVED" : undefined,
          correlationId,
        },
      );
    }
  }

  /**
   * Creates a Razorpay payment order.
   * Amount must be provided in paise.
   */
  async createOrder(
    payload: RazorpayCreateOrderPayload,
    options?: RequestOptions,
  ): Promise<RazorpayOrderEntity> {
    return this.request<RazorpayOrderEntity>("/orders", {
      method: "POST",
      body: payload,
      timeoutMs: options?.timeoutMs,
      correlationId: options?.correlationId,
    });
  }

  /**
   * Fetches order details by Razorpay order ID.
   */
  async getOrder(orderId: string, options?: RequestOptions): Promise<RazorpayOrderEntity> {
    return this.request<RazorpayOrderEntity>(`/orders/${encodeURIComponent(orderId)}`, {
      method: "GET",
      timeoutMs: options?.timeoutMs,
      correlationId: options?.correlationId,
    });
  }

  /**
   * Fetches payment entity details by Razorpay payment ID.
   */
  async getPayment(paymentId: string, options?: RequestOptions): Promise<RazorpayPaymentEntity> {
    return this.request<RazorpayPaymentEntity>(`/payments/${encodeURIComponent(paymentId)}`, {
      method: "GET",
      timeoutMs: options?.timeoutMs,
      correlationId: options?.correlationId,
    });
  }

  /**
   * Fetches all payments associated with an order ID.
   */
  async getPaymentsForOrder(
    orderId: string,
    options?: RequestOptions,
  ): Promise<{ items: RazorpayPaymentEntity[] }> {
    return this.request<{ items: RazorpayPaymentEntity[] }>(
      `/orders/${encodeURIComponent(orderId)}/payments`,
      {
        method: "GET",
        timeoutMs: options?.timeoutMs,
        correlationId: options?.correlationId,
      },
    );
  }
}
