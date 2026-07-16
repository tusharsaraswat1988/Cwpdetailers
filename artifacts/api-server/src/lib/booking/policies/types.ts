import type { Logger } from "pino";
import type { BookingTraceContext } from "../correlation/BookingTraceContext";
import type { BookingContext } from "../BookingContext";

export type BookingPolicyContext = {
  trace: BookingTraceContext;
  logger?: Logger;
  bookingContext?: BookingContext;
};

export interface BookingPolicy<TInput, TResult> {
  readonly name: string;
  execute(input: TInput, ctx: BookingPolicyContext): Promise<TResult>;
}

export type PolicyResult<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, unknown>;
};
