export type CashfreeOrderStatus =
  | "ACTIVE"
  | "PAID"
  | "EXPIRED"
  | "TERMINATED"
  | "TERMINATION_REQUESTED";

export type CashfreePaymentStatus =
  | "SUCCESS"
  | "FAILED"
  | "PENDING"
  | "USER_DROPPED"
  | "CANCELLED";

export interface CashfreeCustomerDetails {
  customer_id: string; // 3 to 45 alphanumeric characters (_ and - allowed)
  customer_phone: string; // 10 digits
  customer_name?: string;
  customer_email?: string;
  customer_uid?: string;
}

export interface CashfreeOrderMeta {
  return_url: string; // Must contain {order_id} placeholder
  notify_url?: string;
  payment_methods?: string | null;
}

export interface CashfreeCreateOrderPayload {
  order_id: string;
  order_amount: number;
  order_currency: "INR";
  customer_details: CashfreeCustomerDetails;
  order_meta?: CashfreeOrderMeta;
  order_note?: string;
  order_tags?: Record<string, string>;
}

export interface CashfreeOrderEntity {
  cf_order_id: string | number;
  order_id: string;
  entity: "order";
  order_currency: "INR";
  order_amount: number;
  order_status: CashfreeOrderStatus;
  payment_session_id: string;
  order_expiry_time?: string;
  order_note?: string;
  created_at?: string;
  order_meta?: CashfreeOrderMeta;
  customer_details: CashfreeCustomerDetails;
  order_tags?: Record<string, string>;
}

export interface CashfreePaymentEntity {
  cf_payment_id: string | number;
  order_id: string;
  entity: "payment";
  payment_currency: string;
  payment_amount: number;
  order_amount: number;
  payment_time: string;
  payment_completion_time?: string;
  payment_status: CashfreePaymentStatus;
  payment_message: string;
  bank_reference?: string | null;
  auth_id?: string | null;
  is_captured: boolean;
  payment_group: string; // "upi", "card", "netbanking", "wallet"
  payment_method: Record<string, unknown> | null;
  error_details?: {
    error_code: string;
    error_description: string;
    error_reason: string;
    error_source: string;
  } | null;
}

export interface CashfreeApiErrorBody {
  message?: string;
  code?: string;
  type?: string;
}

export type CashfreeRefundStatus = "SUCCESS" | "PENDING" | "CANCELLED" | "FAILED";

export interface CashfreeCreateRefundPayload {
  refund_amount: number;
  refund_id: string;
  refund_note?: string;
  refund_speed?: "STANDARD" | "INSTANT";
}

export interface CashfreeRefundEntity {
  cf_refund_id: string | number;
  refund_id: string;
  order_id: string;
  entity: "refund";
  refund_amount: number;
  refund_currency: string;
  refund_note?: string;
  refund_status: CashfreeRefundStatus;
  refund_arn?: string;
  status_description?: string;
  created_at?: string;
  processed_at?: string;
}

export interface CashfreeSettlementEntity {
  cf_settlement_id?: string | number;
  settlement_id?: string;
  order_id?: string;
  entity?: "settlement";
  order_amount?: number;
  settlement_amount?: number;
  service_charge?: number;
  service_tax?: number;
  settlement_status?: string;
  settlement_time?: string;
}

