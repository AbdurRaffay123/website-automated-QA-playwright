/**
 * Retry strategy: distinguish real failures from transient network/timeout issues.
 */

const TRANSIENT_PATTERNS = [
  /ECONNRESET/i,
  /ECONNREFUSED/i,
  /ETIMEDOUT/i,
  /timeout/i,
  /network/i,
  /503/,
  /502/,
  /504/,
  /socket hang up/i,
  /NS_ERROR/i,
];

export function isTransientError(error) {
  const message = error?.message || String(error);
  return TRANSIENT_PATTERNS.some((pattern) => pattern.test(message));
}

export function classifyFailure(error, response) {
  if (response?.status() >= 500) return 'server-error';
  if (response?.status() === 401 || response?.status() === 403) return 'auth-error';
  if (isTransientError(error)) return 'transient';
  if (/timeout/i.test(error?.message || '')) return 'timeout';
  return 'real-failure';
}

export async function withRetry(fn, options = {}) {
  const { maxRetries = 2, delayMs = 1000, shouldRetry = isTransientError } = options;
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries && shouldRetry(error)) {
        await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}

export function getRetryConfig(config) {
  return {
    maxRetries: config.retry?.maxRetries ?? config.retries ?? 0,
    delayMs: config.retry?.delayMs ?? 1000,
    retryTransientOnly: config.retry?.transientOnly ?? true,
  };
}
