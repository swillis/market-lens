export type ErrorCode =
  | "INVALID_TICKER"
  | "TICKER_NOT_FOUND"
  | "API_RATE_LIMITED"
  | "API_UNAVAILABLE"
  | "API_TIMEOUT"
  | "VALIDATION_FAILED"
  | "UPSTREAM_ERROR";

export class MarketLensError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly statusCode: number = 500,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = "MarketLensError";
  }
}

export function tickerNotFound(symbol: string) {
  return new MarketLensError(
    `Ticker "${symbol}" not found. Please check the symbol and try again.`,
    "TICKER_NOT_FOUND",
    404,
    false
  );
}

export function apiTimeout(provider: string, context: string) {
  return new MarketLensError(
    `${provider} request timed out while fetching ${context}. Please try again.`,
    "API_TIMEOUT",
    504,
    true
  );
}

export function apiRateLimited(provider: string) {
  return new MarketLensError(
    `${provider} rate limit reached. Please wait a moment and try again.`,
    "API_RATE_LIMITED",
    429,
    true
  );
}

export function apiUnavailable(provider: string, status: number) {
  return new MarketLensError(
    `${provider} is temporarily unavailable (status ${status}). Please try again later.`,
    "API_UNAVAILABLE",
    502,
    true
  );
}

export function validationFailed(provider: string, details: string) {
  return new MarketLensError(
    `Unexpected response from ${provider}: ${details}`,
    "VALIDATION_FAILED",
    502,
    false
  );
}
