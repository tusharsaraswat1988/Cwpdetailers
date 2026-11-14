export interface RazorpayCreateOrderPayload {
  amount: number; // in paise
  currency: string;
  receipt?: string;
  notes?: Record<string, string>;
  payment_capture?: 0 | 1;
}

export interface RazorpayOrderEntity {
  id: string;
  entity: "order";
  amount: number; // in paise
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt?: string;
  status: "created" | "attempted" | "paid";
  attempts: number;
  notes?: Record<string, string>;
  created_at: number;
}

export interface RazorpayPaymentEntity {
  id: string;
  entity: "payment";
  amount: number; // in paise
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  order_id: string;
  method?: string; // card, netbanking, wallet, upi
  captured?: boolean;
  description?: string;
  card_id?: string;
  bank?: string;
  wallet?: string;
  vpa?: string;
  email?: string;
  contact?: string;
  fee?: number;
  tax?: number;
  error_code?: string;
  error_description?: string;
  created_at: number;
}

export interface RazorpayWebhookPayload {
  entity: "event";
  account_id: string;
  event:
    | "payment.authorized"
    | "payment.captured"
    | "payment.failed"
    | "order.paid";
  contains: string[];
  payload: {
    payment?: {
      entity: RazorpayPaymentEntity;
    };
    order?: {
      entity: RazorpayOrderEntity;
    };
  };
  created_at: number;
}
