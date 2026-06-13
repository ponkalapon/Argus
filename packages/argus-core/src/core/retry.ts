export interface RetryOptions {
  maxRetries: number;        // default 90
  baseDelayMs: number;       // default 1000
  maxDelayMs: number;        // default 60000
  timeoutMs: number;         // default 30000
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT: RetryOptions = {
  maxRetries: 90,
  baseDelayMs: 1000,
  maxDelayMs: 60000,
  timeoutMs: 30000,
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Wraps any async function with retry + per-attempt AbortSignal timeout.
 * After maxRetries the last error is re-thrown with attempt count in the message.
 */
export async function withRetry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  opts: Partial<RetryOptions> = {},
): Promise<T> {
  const o = { ...DEFAULT, ...opts };
  let lastError!: Error;

  for (let attempt = 1; attempt <= o.maxRetries; attempt++) {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), o.timeoutMs);
    try {
      const result = await fn(controller.signal);
      clearTimeout(tid);
      return result;
    } catch (err) {
      clearTimeout(tid);
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === o.maxRetries) break;
      o.onRetry?.(attempt, lastError);
      const delay = Math.min(o.baseDelayMs * 2 ** (attempt - 1), o.maxDelayMs);
      await sleep(delay + Math.random() * 1000);
    }
  }
  throw new Error(`Failed after ${o.maxRetries} attempts. Last: ${lastError.message}`);
}
