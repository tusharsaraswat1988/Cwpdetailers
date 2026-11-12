import express, { type Express, type Request, type Response } from "express";
import http from "node:http";
import { generateCashfreeWebhookHeaders } from "./signatureHelper";

export interface MockPaymentAttempt {
  cf_payment_id: number;
  order_id: string;
  entity: "payment";
  payment_currency: string;
  payment_amount: number;
  order_amount: number;
  payment_time: string;
  payment_completion_time?: string;
  payment_status: "SUCCESS" | "FAILED" | "PENDING" | "USER_DROPPED" | "CANCELLED";
  payment_message: string;
  bank_reference?: string | null;
  auth_id?: string | null;
  is_captured: boolean;
  payment_group: string;
  payment_method: any;
  error_details?: {
    error_code: string;
    error_description: string;
    error_reason: string;
    error_source: string;
  } | null;
}

export interface MockOrder {
  cf_order_id: number;
  order_id: string;
  entity: "order";
  order_currency: string;
  order_amount: number;
  order_status: "ACTIVE" | "PAID" | "EXPIRED" | "TERMINATED";
  payment_session_id: string;
  order_expiry_time: string;
  order_note?: string;
  created_at: string;
  order_meta?: {
    return_url?: string;
    notify_url?: string;
    payment_methods?: string | null;
  };
  customer_details: {
    customer_id: string;
    customer_phone: string;
    customer_name?: string;
    customer_email?: string;
  };
  order_tags?: Record<string, string>;
  payments: MockPaymentAttempt[];
}

export interface RecordedRequest {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body: any;
  timestamp: number;
}

export interface SimulationRule {
  endpoint?: string | RegExp;
  method?: "GET" | "POST" | "ALL";
  delayMs?: number;
  status?: number;
  responseBody?: any;
  hang?: boolean;
  times?: number;
}

export class MockCashfreeGateway {
  private app: Express;
  private server: http.Server | null = null;
  private port = 0;
  private orders: Map<string, MockOrder> = new Map();
  private recordedRequests: RecordedRequest[] = [];
  private simulationRules: SimulationRule[] = [];
  private orderCounter = 2000000000;
  private paymentCounter = 5000000000;
  public secretKey = "mock_secret_key_testing_123456789";
  public clientId = "mock_client_id_test";

  constructor() {
    this.app = express();
    this.app.use(express.json());
    this.setupRoutes();
  }

  private setupRoutes() {
    // Interceptor for recording & simulation rules
    this.app.use((req: Request, res: Response, next) => {
      this.recordedRequests.push({
        method: req.method,
        path: req.path,
        headers: req.headers,
        body: req.body,
        timestamp: Date.now(),
      });

      // Match simulation rules
      const ruleIdx = this.simulationRules.findIndex((r) => {
        const methodMatch = !r.method || r.method === "ALL" || r.method === req.method;
        const endpointMatch =
          !r.endpoint ||
          (typeof r.endpoint === "string" ? req.path.includes(r.endpoint) : r.endpoint.test(req.path));
        return methodMatch && endpointMatch;
      });

      if (ruleIdx >= 0) {
        const rule = this.simulationRules[ruleIdx];
        if (rule.times !== undefined) {
          rule.times--;
          if (rule.times <= 0) {
            this.simulationRules.splice(ruleIdx, 1);
          }
        }

        if (rule.hang) {
          // Socket hang - do not write or end response
          return;
        }

        const executeResponse = () => {
          if (rule.status) {
            return res.status(rule.status).json(
              rule.responseBody || {
                message: "Simulated gateway error",
                code: "gateway_error",
                type: "api_error",
              }
            );
          }
          next();
        };

        if (rule.delayMs) {
          setTimeout(executeResponse, rule.delayMs);
          return;
        }
        return executeResponse();
      }

      next();
    });

    // Dual-route support: /orders and /pg/orders
    const orderRoutes = ["/orders", "/pg/orders"];
    const singleOrderRoutes = ["/orders/:orderId", "/pg/orders/:orderId"];
    const paymentRoutes = ["/orders/:orderId/payments", "/pg/orders/:orderId/payments"];

    const validateAuthAndVersion = (req: Request, res: Response): boolean => {
      const clientId = req.headers["x-client-id"];
      const clientSecret = req.headers["x-client-secret"];
      const apiVersion = req.headers["x-api-version"];

      if (clientId !== this.clientId || clientSecret !== this.secretKey) {
        res.status(401).json({
          message: "Invalid client credentials",
          code: "authentication_failed",
          type: "authentication_error",
        });
        return false;
      }

      if (!apiVersion || apiVersion !== "2023-08-01") {
        res.status(400).json({
          message: "x-api-version header is required and must be 2023-08-01",
          code: "api_version_missing",
          type: "invalid_request_error",
        });
        return false;
      }

      return true;
    };

    // 1. Create Order
    this.app.post(orderRoutes, (req: Request, res: Response) => {
      if (!validateAuthAndVersion(req, res)) return;

      const { order_id, order_amount, order_currency, customer_details, order_meta, order_note, order_tags } = req.body;

      if (!order_amount || typeof order_amount !== "number" || order_amount < 1.0) {
        return res.status(400).json({
          message: "order_amount is required and must be at least 1.00 INR",
          code: "invalid_order_amount",
          type: "invalid_request_error",
        });
      }

      if (!order_currency || order_currency !== "INR") {
        return res.status(400).json({
          message: "order_currency must be INR",
          code: "invalid_order_currency",
          type: "invalid_request_error",
        });
      }

      if (!customer_details?.customer_id || !customer_details?.customer_phone) {
        return res.status(400).json({
          message: "customer_details.customer_id and customer_phone are required",
          code: "invalid_customer_details",
          type: "invalid_request_error",
        });
      }

      const orderId = order_id || `cf_auto_ord_${Date.now()}`;
      if (this.orders.has(orderId)) {
        const existing = this.orders.get(orderId)!;
        if (existing.order_amount !== order_amount) {
          return res.status(409).json({
            message: "order_id already exists with different amount",
            code: "order_already_exists",
            type: "invalid_request_error",
          });
        }
        return res.status(200).json(existing);
      }

      const cfOrderId = ++this.orderCounter;
      const paymentSessionId = `session_mock_${Math.random().toString(36).substring(2)}${Date.now()}`;

      const order: MockOrder = {
        cf_order_id: cfOrderId,
        order_id: orderId,
        entity: "order",
        order_currency: "INR",
        order_amount,
        order_status: "ACTIVE",
        payment_session_id: paymentSessionId,
        order_expiry_time: new Date(Date.now() + 30 * 86400000).toISOString(),
        order_note,
        created_at: new Date().toISOString(),
        order_meta,
        customer_details,
        order_tags,
        payments: [],
      };

      this.orders.set(orderId, order);
      return res.status(200).json(order);
    });

    // 2. Get Order Details
    this.app.get(singleOrderRoutes, (req: Request, res: Response) => {
      if (!validateAuthAndVersion(req, res)) return;

      const orderId = req.params.orderId;
      const order = this.orders.get(orderId);
      if (!order) {
        return res.status(404).json({
          message: "order does not exist",
          code: "order_not_found",
          type: "invalid_request_error",
        });
      }
      return res.status(200).json(order);
    });

    // 3. Get Order Payments
    this.app.get(paymentRoutes, (req: Request, res: Response) => {
      if (!validateAuthAndVersion(req, res)) return;

      const orderId = req.params.orderId;
      const order = this.orders.get(orderId);
      if (!order) {
        return res.status(404).json({
          message: "order does not exist",
          code: "order_not_found",
          type: "invalid_request_error",
        });
      }
      return res.status(200).json(order.payments);
    });
  }

  // Lifecycle
  public async start(port = 0): Promise<{ port: number; baseUrl: string }> {
    return new Promise((resolve) => {
      this.server = this.app.listen(port, "127.0.0.1", () => {
        const address = this.server!.address() as any;
        this.port = address.port;
        resolve({
          port: this.port,
          baseUrl: `http://127.0.0.1:${this.port}`,
        });
      });
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) return resolve();
      this.server.close((err) => (err ? reject(err) : resolve()));
    });
  }

  public reset(): void {
    this.orders.clear();
    this.recordedRequests = [];
    this.simulationRules = [];
  }

  public getBaseUrl(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  public getAuthHeaders(): Record<string, string> {
    return {
      "x-client-id": this.clientId,
      "x-client-secret": this.secretKey,
      "x-api-version": "2023-08-01",
      "content-type": "application/json",
      accept: "application/json",
    };
  }

  public getRecordedRequests(): RecordedRequest[] {
    return [...this.recordedRequests];
  }

  public getLastRequest(): RecordedRequest | undefined {
    return this.recordedRequests[this.recordedRequests.length - 1];
  }

  public getOrder(orderId: string): MockOrder | undefined {
    return this.orders.get(orderId);
  }

  // Simulation Controls
  public addSimulationRule(rule: SimulationRule): void {
    this.simulationRules.push(rule);
  }

  public simulateTimeout(options?: { delayMs?: number; endpoint?: string }): void {
    this.addSimulationRule({
      endpoint: options?.endpoint,
      delayMs: options?.delayMs ?? 10000,
    });
  }

  public simulateSocketHang(options?: { endpoint?: string }): void {
    this.addSimulationRule({
      endpoint: options?.endpoint,
      hang: true,
    });
  }

  public simulateInternalError(status = 500, options?: { endpoint?: string; times?: number }): void {
    this.addSimulationRule({
      status,
      endpoint: options?.endpoint,
      times: options?.times,
      responseBody: {
        message: "Internal Gateway Failure",
        code: "internal_error",
        type: "api_error",
      },
    });
  }

  public simulateOrderExpiry(orderId: string): MockOrder {
    const order = this.orders.get(orderId);
    if (!order) throw new Error(`Order ${orderId} not found in mock server`);
    order.order_status = "EXPIRED";
    return order;
  }

  /**
   * Simulates successful payment capture on an order
   */
  public simulatePaymentSuccess(
    orderId: string,
    options?: {
      paymentAmount?: number;
      paymentMethod?: any;
      bankReference?: string;
    }
  ): MockPaymentAttempt {
    let order = this.orders.get(orderId);
    if (!order) {
      // Auto-provision if order was created outside mock order list
      order = {
        cf_order_id: ++this.orderCounter,
        order_id: orderId,
        entity: "order",
        order_currency: "INR",
        order_amount: options?.paymentAmount ?? 1300.0,
        order_status: "ACTIVE",
        payment_session_id: `session_mock_${Date.now()}`,
        order_expiry_time: new Date(Date.now() + 86400000).toISOString(),
        created_at: new Date().toISOString(),
        customer_details: {
          customer_id: "cust_test",
          customer_phone: "9999999999",
        },
        payments: [],
      };
      this.orders.set(orderId, order);
    }

    order.order_status = "PAID";
    const paymentId = ++this.paymentCounter;

    const payment: MockPaymentAttempt = {
      cf_payment_id: paymentId,
      order_id: orderId,
      entity: "payment",
      payment_currency: "INR",
      payment_amount: options?.paymentAmount ?? order.order_amount,
      order_amount: order.order_amount,
      payment_time: new Date().toISOString(),
      payment_completion_time: new Date().toISOString(),
      payment_status: "SUCCESS",
      payment_message: "Transaction successful",
      bank_reference: options?.bankReference ?? `SBI${Math.floor(100000000 + Math.random() * 900000000)}`,
      auth_id: null,
      is_captured: true,
      payment_group: "upi",
      payment_method: options?.paymentMethod ?? {
        upi: { channel: "collect", upi_id: "testsuccess@gocash" },
      },
      error_details: null,
    };

    order.payments.push(payment);
    return payment;
  }

  /**
   * Simulates bank decline or validation failure
   */
  public simulatePaymentFailure(
    orderId: string,
    options?: {
      errorCode?: string;
      errorMessage?: string;
      reason?: string;
    }
  ): MockPaymentAttempt {
    let order = this.orders.get(orderId);
    if (!order) {
      order = {
        cf_order_id: ++this.orderCounter,
        order_id: orderId,
        entity: "order",
        order_currency: "INR",
        order_amount: 1300.0,
        order_status: "ACTIVE",
        payment_session_id: `session_mock_${Date.now()}`,
        order_expiry_time: new Date(Date.now() + 86400000).toISOString(),
        created_at: new Date().toISOString(),
        customer_details: {
          customer_id: "cust_test",
          customer_phone: "9999999999",
        },
        payments: [],
      };
      this.orders.set(orderId, order);
    }

    const paymentId = ++this.paymentCounter;
    const payment: MockPaymentAttempt = {
      cf_payment_id: paymentId,
      order_id: orderId,
      entity: "payment",
      payment_currency: "INR",
      payment_amount: order.order_amount,
      order_amount: order.order_amount,
      payment_time: new Date().toISOString(),
      payment_status: "FAILED",
      payment_message: options?.errorMessage ?? "Transaction declined by issuing bank",
      bank_reference: null,
      auth_id: null,
      is_captured: false,
      payment_group: "card",
      payment_method: { card: { card_number: "401200XXXXXX1113", card_network: "visa" } },
      error_details: {
        error_code: options?.errorCode ?? "BANK_DECLINED",
        error_description: options?.errorMessage ?? "Transaction declined by issuing bank",
        error_reason: options?.reason ?? "bank_declined",
        error_source: "issuing_bank",
      },
    };

    order.payments.push(payment);
    return payment;
  }

  /**
   * Simulates customer closing checkout window / dropping out
   */
  public simulateUserDropped(orderId: string): MockPaymentAttempt {
    let order = this.orders.get(orderId);
    if (!order) {
      order = {
        cf_order_id: ++this.orderCounter,
        order_id: orderId,
        entity: "order",
        order_currency: "INR",
        order_amount: 1300.0,
        order_status: "ACTIVE",
        payment_session_id: `session_mock_${Date.now()}`,
        order_expiry_time: new Date(Date.now() + 86400000).toISOString(),
        created_at: new Date().toISOString(),
        customer_details: {
          customer_id: "cust_test",
          customer_phone: "9999999999",
        },
        payments: [],
      };
      this.orders.set(orderId, order);
    }

    const paymentId = ++this.paymentCounter;
    const payment: MockPaymentAttempt = {
      cf_payment_id: paymentId,
      order_id: orderId,
      entity: "payment",
      payment_currency: "INR",
      payment_amount: order.order_amount,
      order_amount: order.order_amount,
      payment_time: new Date().toISOString(),
      payment_status: "USER_DROPPED",
      payment_message: "Customer dropped the payment transaction",
      bank_reference: null,
      auth_id: null,
      is_captured: false,
      payment_group: "upi",
      payment_method: null,
      error_details: {
        error_code: "CUSTOMER_DROPPED",
        error_description: "Customer closed checkout window",
        error_reason: "user_dropped",
        error_source: "customer",
      },
    };

    order.payments.push(payment);
    return payment;
  }

  /**
   * Constructs official webhook payload and signature headers for programmatic testing
   */
  public buildWebhook(
    eventType: "PAYMENT_SUCCESS_WEBHOOK" | "PAYMENT_FAILED_WEBHOOK" | "PAYMENT_USER_DROPPED_WEBHOOK",
    orderId: string,
    options?: {
      tamperSignature?: boolean;
      tamperTimestamp?: boolean;
      futureTimestamp?: boolean;
      customTimestamp?: string | number;
      paymentAmount?: number;
      bankReference?: string;
      customPayload?: any;
    }
  ) {
    let order = this.orders.get(orderId);
    if (!order) {
      order = {
        cf_order_id: ++this.orderCounter,
        order_id: orderId,
        entity: "order",
        order_currency: "INR",
        order_amount: options?.paymentAmount ?? 1300.0,
        order_status: eventType === "PAYMENT_SUCCESS_WEBHOOK" ? "PAID" : "ACTIVE",
        payment_session_id: `session_mock_${Date.now()}`,
        order_expiry_time: new Date(Date.now() + 86400000).toISOString(),
        created_at: new Date().toISOString(),
        customer_details: {
          customer_id: "cust_test",
          customer_phone: "9999999999",
        },
        payments: [],
      };
      this.orders.set(orderId, order);
    }

    let payment = order.payments[order.payments.length - 1];
    if (!payment) {
      if (eventType === "PAYMENT_SUCCESS_WEBHOOK") {
        payment = this.simulatePaymentSuccess(orderId, {
          paymentAmount: options?.paymentAmount,
          bankReference: options?.bankReference,
        });
      } else if (eventType === "PAYMENT_FAILED_WEBHOOK") {
        payment = this.simulatePaymentFailure(orderId);
      } else {
        payment = this.simulateUserDropped(orderId);
      }
    }

    const payload = options?.customPayload ?? {
      type: eventType,
      event_time: new Date().toISOString(),
      data: {
        order: {
          order_id: order.order_id,
          order_amount: order.order_amount,
          order_currency: order.order_currency,
          order_tags: order.order_tags,
        },
        payment,
        customer_details: order.customer_details,
      },
    };

    const headerResult = generateCashfreeWebhookHeaders(payload, this.secretKey, {
      tamperSignature: options?.tamperSignature,
      tamperTimestamp: options?.tamperTimestamp,
      futureTimestamp: options?.futureTimestamp,
      timestamp: options?.customTimestamp,
    });

    return {
      payload,
      rawBody: headerResult.rawBody,
      headers: {
        "x-webhook-signature": headerResult["x-webhook-signature"],
        "x-webhook-timestamp": headerResult["x-webhook-timestamp"],
        "content-type": "application/json",
      },
    };
  }

  /**
   * Dispatches webhook directly via HTTP POST to an external target (e.g., local api-server)
   */
  public async dispatchWebhook(
    targetUrl: string,
    eventType: "PAYMENT_SUCCESS_WEBHOOK" | "PAYMENT_FAILED_WEBHOOK" | "PAYMENT_USER_DROPPED_WEBHOOK",
    orderId: string,
    options?: {
      tamperSignature?: boolean;
      tamperTimestamp?: boolean;
      futureTimestamp?: boolean;
      duplicateCount?: number;
      paymentAmount?: number;
      bankReference?: string;
      customPayload?: any;
    }
  ): Promise<globalThis.Response[]> {
    const { rawBody, headers } = this.buildWebhook(eventType, orderId, options);
    const count = options?.duplicateCount ?? 1;
    const promises: Promise<globalThis.Response>[] = [];

    for (let i = 0; i < count; i++) {
      promises.push(
        fetch(targetUrl, {
          method: "POST",
          headers,
          body: rawBody,
        })
      );
    }

    return Promise.all(promises);
  }
}
