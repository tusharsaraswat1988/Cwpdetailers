const DEFAULT_DELAYS_MS = [2000, 5000, 10000] as const;

export type RetryOptions = {
  maxAttempts?: number;
  delaysMs?: readonly number[];
  signal?: AbortSignal;
};

function isRetryableError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  if (err instanceof DOMException && err.name === "AbortError") return false;
  if (err instanceof Error && /network|fetch|failed to fetch/i.test(err.message)) return true;
  return false;
}

function isRetryableResponse(res: Response): boolean {
  return res.status >= 500 || res.status === 408 || res.status === 429;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: RetryOptions = {},
): Promise<Response> {
  const maxAttempts = options.maxAttempts ?? 3;
  const delaysMs = options.delaysMs ?? DEFAULT_DELAYS_MS;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(input, init);
      if (res.ok || !isRetryableResponse(res) || attempt === maxAttempts - 1) {
        return res;
      }
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
      if (!isRetryableError(err) || attempt === maxAttempts - 1) {
        throw err;
      }
    }

    if (attempt < maxAttempts - 1) {
      await sleep(delaysMs[attempt] ?? delaysMs[delaysMs.length - 1], options.signal);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Request failed after retries");
}

export { DEFAULT_DELAYS_MS };
