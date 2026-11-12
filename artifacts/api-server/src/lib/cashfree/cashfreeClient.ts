import { getCashfreeConfig, type CashfreeServerConfig } from "./cashfreeConfig";
import { CashfreeError } from "./cashfreeError";
import type {
  CashfreeCreateOrderPayload,
  CashfreeOrderEntity,
  CashfreePaymentEntity,
  CashfreeApiErrorBody,
} from "./types";
import { logger } from "../logger";

export interface RequestOptions {
  idempotencyKey?: string;
  timeoutMs?: number;
}

export class CashfreeClient {
  private config: CashfreeServerConfig;

  constructor(customConfig?: CashfreeServerConfig) {
    this.config = customConfig || getCashfreeConfig();
  }

  private getHeaders(idempotencyKey?: string): Record<string, string> {
    const headers: Record<string, string> = {
      "x-client-id": this.config.appId,
      "x-client-secret": this.config.secretKey,
      "x-api-version": this.config.apiVersion,
      "content-type": "application/json",
      accept: "application/json",
    };
    if (idempotencyKey) {
      headers["x-idempotency-key"] = idempotencyKey;
    }
    return headers;
  }

  private buildUrl(endpoint: string): string {
    const cleanBase = this.config.baseUrl.replace(/\/+$/, "");
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

    // Avoid double /pg if base ends in /pg and endpoint begins with /pg
    if (cleanBase.endsWith("/pg") && cleanEndpoint.startsWith("/pg/")) {
      return `${cleanBase}${cleanEndpoint.slice(3)}`;
    }
    return `${cleanBase}${cleanEndpoint}`;
  }

  private async request<T>(
    endpoint: string,
    options: {
      method: "GET" | "POST";
      body?: unknown;
      idempotencyKey?: string;
      timeoutMs?: number;
      orderId?: string;
    },
  ): Promise<T> {
    const timeoutMs = options.timeoutMs ?? this.config.timeoutMs;
    const url = this.buildUrl(endpoint);
    const headers = this.getHeaders(options.idempotencyKey);

    const startTime = Date.now();
    try {
      const response = await fetch(url, {
        method: options.method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });

      const responseTimeMs = Date.now() - startTime;
      const rawText = await response.text();
      let parsedBody: any;
      try {
        parsedBody = JSON.parse(rawText);
      } catch {
        parsedBody = { message: rawText };
      }

      if (!response.ok) {
        const errorBody: CashfreeApiErrorBody = parsedBody;
        logger.warn(
          {
            method: options.method,
            endpoint,
            status: response.status,
            code: errorBody.code,
            responseTimeMs,
          },
          "[CASHFREE_CLIENT] API request returned non-2xx status",
        );

        throw new CashfreeError({
          message: errorBody.message || `Cashfree API returned HTTP ${response.status}`,
          statusCode: response.status,
          code: errorBody.code,
          errorType: errorBody.type,
          orderId: options.orderId,
          details: parsedBody,
        });
      }

      logger.debug(
        { method: options.method, endpoint, status: response.status, responseTimeMs },
        "[CASHFREE_CLIENT] API request succeeded",
      );

      return parsedBody as T;
    } catch (err: any) {
      if (err instanceof CashfreeError) {
        throw err;
      }

      const isTimeout = err.name === "TimeoutError" || err.name === "AbortError";
      logger.error(
        {
          errName: err.name,
          errMsg: err.message,
          endpoint,
          method: options.method,
          isTimeout,
        },
        "[CASHFREE_CLIENT] Network or gateway execution failure",
      );

      throw new CashfreeError({
        message: isTimeout
          ? `Cashfree API request timed out after ${timeoutMs}ms`
          : `Cashfree gateway connection error: ${err.message}`,
        statusCode: isTimeout ? 504 : 502,
        code: isTimeout ? "GATEWAY_TIMEOUT" : "GATEWAY_CONNECTION_ERROR",
        errorType: "api_error",
        isTimeout,
        orderId: options.orderId,
        cause: err,
      });
    }
  }

  /**
   * Creates an order session on Cashfree.
   * Path: POST /orders
   */
  public async createOrder(
    payload: CashfreeCreateOrderPayload,
    options?: RequestOptions,
  ): Promise<CashfreeOrderEntity> {
    return this.request<CashfreeOrderEntity>("/orders", {
      method: "POST",
      body: payload,
      idempotencyKey: options?.idempotencyKey,
      timeoutMs: options?.timeoutMs,
      orderId: payload.order_id,
    });
  }

  /**
   * Fetches order details by orderId.
   * Path: GET /orders/{order_id}
   */
  public async getOrder(
    orderId: string,
    options?: RequestOptions,
  ): Promise<CashfreeOrderEntity> {
    return this.request<CashfreeOrderEntity>(`/orders/${encodeURIComponent(orderId)}`, {
      method: "GET",
      timeoutMs: options?.timeoutMs,
      orderId,
    });
  }

  /**
   * Fetches payment attempts for an order.
   * Path: GET /orders/{order_id}/payments
   */
  public async getOrderPayments(
    orderId: string,
    options?: RequestOptions,
  ): Promise<CashfreePaymentEntity[]> {
    return this.request<CashfreePaymentEntity[]>(`/orders/${encodeURIComponent(orderId)}/payments`, {
      method: "GET",
      timeoutMs: options?.timeoutMs,
      orderId,
    });
  }
}
