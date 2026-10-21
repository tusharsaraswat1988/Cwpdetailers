/**
 * In-memory operational metrics collector for authentication events.
 * Provides Prometheus-compatible telemetry snapshots, error rate tracking,
 * and automated alert threshold evaluation without external dependencies.
 *
 * ARCHITECTURAL SCOPE & PRODUCTION NOTE:
 * - This registry operates in-process (per Node.js instance).
 * - Counters reflect the current process lifecycle and reset upon restart.
 * - In multi-instance or horizontally scaled cluster deployments, metrics
 *   represent instance-local telemetry. For cluster-wide aggregation, scrape
 *   each instance's `/api/auth/metrics` endpoint via Prometheus/Datadog or wire
 *   a shared Redis/OpenTelemetry backend.
 */

export type AuthMethod = "otp_send" | "otp_verify" | "password" | "google" | "logout" | "reset_password";
export type AuthOutcome = "success" | "failure" | "rate_limited" | "provider_error" | "mismatch";

export interface AuthMetricsSnapshot {
  timestamp: string;
  uptimeSeconds: number;
  totalAttempts: number;
  totalSuccesses: number;
  totalFailures: number;
  totalRateLimited: number;
  totalProviderErrors: number;
  byMethod: Record<AuthMethod, {
    attempts: number;
    successes: number;
    failures: number;
    rateLimited: number;
    avgLatencyMs: number;
  }>;
  byErrorCode: Record<string, number>;
  activeAlerts: Array<{
    severity: "warning" | "critical";
    code: string;
    message: string;
  }>;
  healthStatus: "healthy" | "degraded" | "critical";
}

class AuthMetricsRegistry {
  private startTime = Date.now();
  private totalAttempts = 0;
  private totalSuccesses = 0;
  private totalFailures = 0;
  private totalRateLimited = 0;
  private totalProviderErrors = 0;

  private methodStats: Record<AuthMethod, {
    attempts: number;
    successes: number;
    failures: number;
    rateLimited: number;
    totalLatencyMs: number;
  }> = {
    otp_send: { attempts: 0, successes: 0, failures: 0, rateLimited: 0, totalLatencyMs: 0 },
    otp_verify: { attempts: 0, successes: 0, failures: 0, rateLimited: 0, totalLatencyMs: 0 },
    password: { attempts: 0, successes: 0, failures: 0, rateLimited: 0, totalLatencyMs: 0 },
    google: { attempts: 0, successes: 0, failures: 0, rateLimited: 0, totalLatencyMs: 0 },
    logout: { attempts: 0, successes: 0, failures: 0, rateLimited: 0, totalLatencyMs: 0 },
    reset_password: { attempts: 0, successes: 0, failures: 0, rateLimited: 0, totalLatencyMs: 0 },
  };

  private errorCodes: Record<string, number> = {};

  // Rolling provider failure counter for circuit/alert monitoring
  private recentProviderFailures = 0;

  public recordAttempt(method: AuthMethod): void {
    this.totalAttempts++;
    if (this.methodStats[method]) {
      this.methodStats[method].attempts++;
    }
  }

  public recordOutcome(
    method: AuthMethod,
    outcome: AuthOutcome,
    options?: {
      durationMs?: number;
      errorCode?: string;
      isProviderError?: boolean;
    },
  ): void {
    const duration = options?.durationMs ?? 0;
    const errorCode = options?.errorCode;
    const isProvider = options?.isProviderError ?? outcome === "provider_error";

    const stats = this.methodStats[method];
    if (stats && duration > 0) {
      stats.totalLatencyMs += duration;
    }

    if (outcome === "success") {
      this.totalSuccesses++;
      if (stats) stats.successes++;
      // Decay recent provider failures on success
      if (this.recentProviderFailures > 0) {
        this.recentProviderFailures = Math.max(0, this.recentProviderFailures - 1);
      }
    } else if (outcome === "rate_limited") {
      this.totalRateLimited++;
      if (stats) stats.rateLimited++;
    } else {
      this.totalFailures++;
      if (stats) stats.failures++;
      if (isProvider) {
        this.totalProviderErrors++;
        this.recentProviderFailures++;
      }
    }

    if (errorCode) {
      this.errorCodes[errorCode] = (this.errorCodes[errorCode] ?? 0) + 1;
    }
  }

  public getSnapshot(): AuthMetricsSnapshot {
    const alerts: AuthMetricsSnapshot["activeAlerts"] = [];

    // Alert 1: Elevated Provider Outage
    if (this.recentProviderFailures >= 3) {
      alerts.push({
        severity: "critical",
        code: "SMS_PROVIDER_DOWN",
        message: `High external provider failure count (${this.recentProviderFailures} recent failures).`,
      });
    }

    // Alert 2: High OTP Failure Rate (when > 10 attempts have been made)
    const otpAttempts = this.methodStats.otp_send.attempts;
    if (otpAttempts >= 10) {
      const otpFailureRate = (this.methodStats.otp_send.failures / otpAttempts) * 100;
      if (otpFailureRate > 40) {
        alerts.push({
          severity: "warning",
          code: "ELEVATED_OTP_FAILURE_RATE",
          message: `OTP Send failure rate is ${otpFailureRate.toFixed(1)}% (threshold: 40%).`,
        });
      }
    }

    // Alert 3: Elevated Rate Limiting (Brute Force / Abuse spike)
    if (this.totalRateLimited >= 20) {
      alerts.push({
        severity: "warning",
        code: "AUTH_RATE_LIMIT_SPIKE",
        message: `High volume of rate-limited auth attempts (${this.totalRateLimited} events).`,
      });
    }

    let healthStatus: AuthMetricsSnapshot["healthStatus"] = "healthy";
    if (alerts.some(a => a.severity === "critical")) {
      healthStatus = "critical";
    } else if (alerts.length > 0) {
      healthStatus = "degraded";
    }

    const byMethod: AuthMetricsSnapshot["byMethod"] = {
      otp_send: {
        attempts: this.methodStats.otp_send.attempts,
        successes: this.methodStats.otp_send.successes,
        failures: this.methodStats.otp_send.failures,
        rateLimited: this.methodStats.otp_send.rateLimited,
        avgLatencyMs: this.methodStats.otp_send.attempts > 0
          ? Math.round(this.methodStats.otp_send.totalLatencyMs / this.methodStats.otp_send.attempts)
          : 0,
      },
      otp_verify: {
        attempts: this.methodStats.otp_verify.attempts,
        successes: this.methodStats.otp_verify.successes,
        failures: this.methodStats.otp_verify.failures,
        rateLimited: this.methodStats.otp_verify.rateLimited,
        avgLatencyMs: this.methodStats.otp_verify.attempts > 0
          ? Math.round(this.methodStats.otp_verify.totalLatencyMs / this.methodStats.otp_verify.attempts)
          : 0,
      },
      password: {
        attempts: this.methodStats.password.attempts,
        successes: this.methodStats.password.successes,
        failures: this.methodStats.password.failures,
        rateLimited: this.methodStats.password.rateLimited,
        avgLatencyMs: this.methodStats.password.attempts > 0
          ? Math.round(this.methodStats.password.totalLatencyMs / this.methodStats.password.attempts)
          : 0,
      },
      google: {
        attempts: this.methodStats.google.attempts,
        successes: this.methodStats.google.successes,
        failures: this.methodStats.google.failures,
        rateLimited: this.methodStats.google.rateLimited,
        avgLatencyMs: this.methodStats.google.attempts > 0
          ? Math.round(this.methodStats.google.totalLatencyMs / this.methodStats.google.attempts)
          : 0,
      },
      logout: {
        attempts: this.methodStats.logout.attempts,
        successes: this.methodStats.logout.successes,
        failures: this.methodStats.logout.failures,
        rateLimited: this.methodStats.logout.rateLimited,
        avgLatencyMs: this.methodStats.logout.attempts > 0
          ? Math.round(this.methodStats.logout.totalLatencyMs / this.methodStats.logout.attempts)
          : 0,
      },
      reset_password: {
        attempts: this.methodStats.reset_password.attempts,
        successes: this.methodStats.reset_password.successes,
        failures: this.methodStats.reset_password.failures,
        rateLimited: this.methodStats.reset_password.rateLimited,
        avgLatencyMs: this.methodStats.reset_password.attempts > 0
          ? Math.round(this.methodStats.reset_password.totalLatencyMs / this.methodStats.reset_password.attempts)
          : 0,
      },
    };

    return {
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      totalAttempts: this.totalAttempts,
      totalSuccesses: this.totalSuccesses,
      totalFailures: this.totalFailures,
      totalRateLimited: this.totalRateLimited,
      totalProviderErrors: this.totalProviderErrors,
      byMethod,
      byErrorCode: { ...this.errorCodes },
      activeAlerts: alerts,
      healthStatus,
    };
  }

  public reset(): void {
    this.startTime = Date.now();
    this.totalAttempts = 0;
    this.totalSuccesses = 0;
    this.totalFailures = 0;
    this.totalRateLimited = 0;
    this.totalProviderErrors = 0;
    this.recentProviderFailures = 0;
    for (const key of Object.keys(this.methodStats) as AuthMethod[]) {
      this.methodStats[key] = {
        attempts: 0,
        successes: 0,
        failures: 0,
        rateLimited: 0,
        totalLatencyMs: 0,
      };
    }
    this.errorCodes = {};
  }
}

export const authMetrics = new AuthMetricsRegistry();
