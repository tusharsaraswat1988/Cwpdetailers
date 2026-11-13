/**
 * Staff Native Background Geolocation Tracking Service (TRACK-004 / Phase 18)
 *
 * Implements battery-conscious native background GPS tracking for staff in en_route state only.
 * Uses @capacitor-community/background-geolocation on Android/iOS, with browser geolocation fallback.
 * Strictly enforces tracking start only on "On My Way", and immediate shutdown on start/complete/cancel/reassign.
 */

import { Capacitor, registerPlugin } from "@capacitor/core";
import type { BackgroundGeolocationPlugin, Location } from "@capacitor-community/background-geolocation";

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");

export type ActiveTrackingJob = {
  id: string | number;
  executionId?: number;
  bookingId?: number;
  customerName?: string;
  destinationAddress?: string;
  startedAt: string;
};

export type TrackingStatus = {
  isTracking: boolean;
  activeJob: ActiveTrackingJob | null;
  lastPingAt: string | null;
  lastCoordinates: { latitude: number; longitude: number; accuracy?: number } | null;
  error: string | null;
};

type TrackingListener = (status: TrackingStatus) => void;

class StaffBackgroundLocationManager {
  private watcherId: string | null = null;
  private browserWatchId: number | null = null;
  private activeJob: ActiveTrackingJob | null = null;
  private lastPingTimeMs = 0;
  private lastPingCoords: { latitude: number; longitude: number } | null = null;
  private listeners: Set<TrackingListener> = new Set();
  private lastStatus: TrackingStatus = {
    isTracking: false,
    activeJob: null,
    lastPingAt: null,
    lastCoordinates: null,
    error: null,
  };

  constructor() {
    // Restore any active tracking job from session storage if app was suspended/resumed
    try {
      const saved = localStorage.getItem("cwp_staff_en_route_tracking");
      if (saved) {
        this.activeJob = JSON.parse(saved);
      }
    } catch {
      // Ignore storage parse error
    }
  }

  public getStatus(): TrackingStatus {
    return { ...this.lastStatus };
  }

  public subscribe(listener: TrackingListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const current = this.getStatus();
    this.listeners.forEach((listener) => {
      try {
        listener(current);
      } catch (e) {
        console.error("Tracking listener error:", e);
      }
    });
  }

  /**
   * Starts tracking staff location during the en-route phase.
   * Battery conscious: 20m distance filter, throttled pings every 15s.
   */
  public async startTracking(job: {
    id: string | number;
    executionId?: number;
    bookingId?: number;
    customerName?: string;
    destinationAddress?: string;
  }): Promise<boolean> {
    // If already tracking a different job, stop previous watcher first
    if (this.watcherId || this.browserWatchId) {
      if (this.activeJob?.id === job.id) {
        return true; // Already tracking this job
      }
      await this.stopTracking();
    }

    this.activeJob = {
      ...job,
      startedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem("cwp_staff_en_route_tracking", JSON.stringify(this.activeJob));
    } catch {
      // Non-fatal
    }

    this.lastStatus = {
      isTracking: true,
      activeJob: this.activeJob,
      lastPingAt: null,
      lastCoordinates: null,
      error: null,
    };
    this.notify();

    if (Capacitor.isNativePlatform()) {
      return this.startNativeWatcher();
    } else {
      return this.startBrowserWatcher();
    }
  }

  private async startNativeWatcher(): Promise<boolean> {
    try {
      const id = await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: "CWP Detailers is tracking your travel route to the customer.",
          backgroundTitle: "En Route to Customer",
          requestPermissions: true,
          stale: false,
          distanceFilter: 20, // Only trigger after 20m movement to conserve battery
        },
        (location?: Location, error?: Error) => {
          if (error) {
            console.warn("Background geolocation error:", error);
            this.lastStatus.error = error.message;
            this.notify();
            return;
          }
          if (location) {
            void this.handleLocationPing({
              latitude: location.latitude,
              longitude: location.longitude,
              accuracy: location.accuracy,
            });
          }
        },
      );

      this.watcherId = id;
      return true;
    } catch (err: any) {
      console.error("Failed to start native background geolocation:", err);
      this.lastStatus.error = err?.message ?? "GPS permission denied";
      this.notify();
      return false;
    }
  }

  private startBrowserWatcher(): boolean {
    if (typeof window === "undefined" || !navigator.geolocation) {
      this.lastStatus.error = "Geolocation not supported";
      this.notify();
      return false;
    }

    try {
      this.browserWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          void this.handleLocationPing({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        (err) => {
          console.warn("Browser geolocation watch error:", err);
          this.lastStatus.error = err.message;
          this.notify();
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000,
        },
      );
      return true;
    } catch (err: any) {
      this.lastStatus.error = err?.message ?? "Failed to start GPS watch";
      this.notify();
      return false;
    }
  }

  /**
   * Throttles pings and delivers telemetry to API server.
   * Auto-stops tracking if job is completed, cancelled, or reassigned (HTTP 400/403).
   */
  private async handleLocationPing(coords: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  }) {
    if (!this.activeJob) return;

    const now = Date.now();
    const elapsedMs = now - this.lastPingTimeMs;

    // Movement calculation
    let distanceMeters = 999;
    if (this.lastPingCoords) {
      distanceMeters = this.calculateDistanceMeters(
        this.lastPingCoords.latitude,
        this.lastPingCoords.longitude,
        coords.latitude,
        coords.longitude,
      );
    }

    // Battery conservation: Throttle to at most 1 ping per 15s unless moved > 50m
    if (elapsedMs < 15_000 && distanceMeters < 50) {
      return;
    }

    this.lastPingTimeMs = now;
    this.lastPingCoords = { latitude: coords.latitude, longitude: coords.longitude };
    this.lastStatus.lastPingAt = new Date().toISOString();
    this.lastStatus.lastCoordinates = coords;
    this.lastStatus.error = null;
    this.notify();

    const executionId = this.activeJob.executionId;
    const bookingId = this.activeJob.bookingId;

    try {
      const url = executionId
        ? `/api/service-executions/${executionId}/location-ping`
        : `/api/bookings/${bookingId}/en-route`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        // If the service is no longer in valid en_route state (e.g. cancelled, completed, reassigned), stop tracking immediately
        if (res.status === 400 || res.status === 403 || res.status === 404) {
          console.warn("Backend rejected location ping. Stopping tracking:", errorData);
          await this.stopTracking();
        }
      }
    } catch (netErr) {
      console.warn("Location ping network error (will retry next interval):", netErr);
    }
  }

  /**
   * Immediately terminates all active watchers and clears state.
   */
  public async stopTracking(): Promise<void> {
    if (this.watcherId) {
      try {
        await BackgroundGeolocation.removeWatcher({ id: this.watcherId });
      } catch (err) {
        console.warn("Error removing background geolocation watcher:", err);
      }
      this.watcherId = null;
    }

    if (this.browserWatchId !== null && typeof window !== "undefined" && navigator.geolocation) {
      try {
        navigator.geolocation.clearWatch(this.browserWatchId);
      } catch (err) {
        console.warn("Error clearing browser geolocation watch:", err);
      }
      this.browserWatchId = null;
    }

    this.activeJob = null;
    this.lastPingCoords = null;
    this.lastPingTimeMs = 0;

    try {
      localStorage.removeItem("cwp_staff_en_route_tracking");
    } catch {
      // Non-fatal
    }

    this.lastStatus = {
      isTracking: false,
      activeJob: null,
      lastPingAt: null,
      lastCoordinates: null,
      error: null,
    };
    this.notify();
  }

  private calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }
}

export const staffBackgroundLocation = new StaffBackgroundLocationManager();
