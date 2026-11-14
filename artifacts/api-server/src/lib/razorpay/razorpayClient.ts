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
    },
  ): Promise<T> {
    const timeoutMs = options.timeoutMs ?? this.config.timeoutMs;
    const url = this.buildUrl(endpoint);
    const headers: Record<string, string> = {
      Authorization: this.getAuthHeader(),
      "Content-Type": "application/json",
      Accept: "application/json",
    };

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
        const errorDetail =
          typeof responseBody === "object" && responseBody?.error
            ? responseBody.error.description || responseBody.error.message || JSON.stringify(responseBody.error)
            : typeof responseBody === "string"
              ? responseBody
              : "Razorpay API request failed";

        logger.warn(
          {
            status: response.status,
            endpoint,
            errorDetail,
          },
          "[RAZORPAY_CLIENT] Gateway API error response",
        );

        throw new RazorpayError(
          `Razorpay error: ${errorDetail}`,
          responseBody?.error?.code || `HTTP_${response.status}`,
          response.status,
          responseBody,
        );
      }

      return responseBody as T;
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err instanceof RazorpayError) {
        throw err;
      }

      if (err.name === "AbortError") {
        logger.error({ endpoint, timeoutMs }, "[RAZORPAY_CLIENT] Request timed out");
        throw new RazorpayError(
          `Razorpay request timed out after ${timeoutMs}ms`,
          "GATEWAY_TIMEOUT",
          504,
        );
      }

      logger.error({ err: err.message, endpoint }, "[RAZORPAY_CLIENT] Network or fetch error");
      throw new RazorpayError(
        `Failed to communicate with Razorpay: ${err.message}`,
        "NETWORK_ERROR",
        502,
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
    });
  }

  /**
   * Fetches order details by Razorpay order ID.
   */
  async getOrder(orderId: string, options?: RequestOptions): Promise<RazorpayOrderEntity> {
    return this.request<RazorpayOrderEntity>(`/orders/${encodeURIComponent(orderId)}`, {
      method: "GET",
      timeoutMs: options?.timeoutMs,
    });
  }

  /**
   * Fetches payment entity details by Razorpay payment ID.
   */
  async getPayment(paymentId: string, options?: RequestOptions): Promise<RazorpayPaymentEntity> {
    return this.request<RazorpayPaymentEntity>(`/payments/${encodeURIComponent(paymentId)}`, {
      method: "GET",
      timeoutMs: options?.timeoutMs,
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
      },
    );
  }
}
