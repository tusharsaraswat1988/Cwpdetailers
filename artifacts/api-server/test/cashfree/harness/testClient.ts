import app from "../../../src/app";
import type { Server } from "node:http";

export interface ApiResponse<T = any> {
  status: number;
  headers: Headers;
  data: T;
  rawText: string;
}

export class TestClient {
  private server?: Server;
  private baseUrl = "";

  async start(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.server = app.listen(0, "127.0.0.1", () => {
        const addr = this.server?.address();
        if (typeof addr === "object" && addr) {
          this.baseUrl = `http://127.0.0.1:${addr.port}`;
          resolve(this.baseUrl);
        } else {
          reject(new Error("Failed to obtain ephemeral port for TestClient"));
        }
      });
      this.server.on("error", reject);
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) return resolve();
      this.server.close(() => resolve());
    });
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  async request<T = any>(
    path: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: any;
      rawBody?: string | Buffer;
    } = {}
  ): Promise<ApiResponse<T>> {
    if (!this.baseUrl) {
      throw new Error("TestClient not started. Call await client.start() before making requests.");
    }

    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const headers: Record<string, string> = { ...options.headers };

    let payload: string | Buffer | undefined = undefined;
    if (options.rawBody !== undefined) {
      payload = options.rawBody;
    } else if (options.body !== undefined) {
      payload = JSON.stringify(options.body);
      if (!headers["content-type"]) {
        headers["content-type"] = "application/json";
      }
    }

    const res = await fetch(url, {
      method: options.method || "GET",
      headers,
      body: payload,
    });

    const rawText = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = rawText;
    }

    return {
      status: res.status,
      headers: res.headers,
      data,
      rawText,
    };
  }

  get<T = any>(path: string, headers?: Record<string, string>) {
    return this.request<T>(path, { method: "GET", headers });
  }

  post<T = any>(path: string, body?: any, headers?: Record<string, string>) {
    return this.request<T>(path, { method: "POST", body, headers });
  }

  postRaw<T = any>(path: string, rawBody: string | Buffer, headers?: Record<string, string>) {
    return this.request<T>(path, { method: "POST", rawBody, headers });
  }
}
