// In-memory sliding window rate limiter
// Designed for serverless and single-instance deployments, easily pluggable into Redis if needed.

export type RateLimitType =
  | "auth_login"
  | "auth_register"
  | "ai_chat"
  | "ai_ocr"
  | "ai_brief"
  | "ai_extract"
  | "ai_reword"
  | "ai_general";

interface LimitConfig {
  maxRequests: number;
  windowMs: number;
  readableLimit: string;
}

const LIMIT_CONFIGS: Record<RateLimitType, LimitConfig> = {
  auth_login: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    readableLimit: "5 attempts per 15 minutes",
  },
  auth_register: {
    maxRequests: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    readableLimit: "3 registrations per hour",
  },
  ai_chat: {
    maxRequests: 30,
    windowMs: 60 * 60 * 1000, // 1 hour
    readableLimit: "30 messages per hour",
  },
  ai_ocr: {
    maxRequests: 10,
    windowMs: 10 * 60 * 1000, // 10 minutes
    readableLimit: "10 scans per 10 minutes",
  },
  ai_brief: {
    maxRequests: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    readableLimit: "3 refreshes per hour",
  },
  ai_extract: {
    maxRequests: 15,
    windowMs: 10 * 60 * 1000, // 10 minutes
    readableLimit: "15 extractions per 10 minutes",
  },
  ai_reword: {
    maxRequests: 20,
    windowMs: 10 * 60 * 1000, // 10 minutes
    readableLimit: "20 drafts per 10 minutes",
  },
  ai_general: {
    maxRequests: 60,
    windowMs: 60 * 60 * 1000, // 1 hour
    readableLimit: "60 requests per hour",
  },
};

interface RateLimitRecord {
  timestamps: number[];
}

const store = new Map<string, RateLimitRecord>();

// Cleanup stale records periodically to avoid memory leaks
const CLEANUP_INTERVAL = 10 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupStaleEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  const maxRetention = 2 * 60 * 60 * 1000; // 2 hours
  for (const [key, record] of store.entries()) {
    record.timestamps = record.timestamps.filter((ts) => now - ts < maxRetention);
    if (record.timestamps.length === 0) {
      store.delete(key);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
  limit: number;
  readableLimit: string;
  message?: string;
}

export function checkRateLimit(identifier: string, type: RateLimitType): RateLimitResult {
  cleanupStaleEntries();

  const config = LIMIT_CONFIGS[type] || LIMIT_CONFIGS.ai_general;
  const key = `${type}:${identifier}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  let record = store.get(key);
  if (!record) {
    record = { timestamps: [] };
    store.set(key, record);
  }

  // Filter out timestamps outside current sliding window
  record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

  if (record.timestamps.length >= config.maxRequests) {
    const oldestTimestamp = record.timestamps[0];
    const resetTime = oldestTimestamp + config.windowMs;
    const resetInSeconds = Math.max(1, Math.ceil((resetTime - now) / 1000));

    return {
      allowed: false,
      remaining: 0,
      resetInSeconds,
      limit: config.maxRequests,
      readableLimit: config.readableLimit,
      message: getErrorMessage(type, resetInSeconds, config.readableLimit),
    };
  }

  // Consume a token
  record.timestamps.push(now);
  const remaining = config.maxRequests - record.timestamps.length;

  return {
    allowed: true,
    remaining,
    resetInSeconds: Math.ceil(config.windowMs / 1000),
    limit: config.maxRequests,
    readableLimit: config.readableLimit,
  };
}

export function resetRateLimit(identifier: string, type: RateLimitType): void {
  const key = `${type}:${identifier}`;
  store.delete(key);
}

function getErrorMessage(type: RateLimitType, resetInSeconds: number, readableLimit: string): string {
  const minutes = Math.floor(resetInSeconds / 60);
  const seconds = resetInSeconds % 60;
  const timeDesc = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  switch (type) {
    case "auth_login":
      return `Too many failed login attempts. For security reasons, your account is temporarily locked. Please try again in ${timeDesc}. (Limit: ${readableLimit})`;
    case "auth_register":
      return `Too many registration requests from this network. Please wait ${timeDesc} before creating another account. (Limit: ${readableLimit})`;
    case "ai_chat":
      return `AI Copilot hourly quota reached. You can send up to ${readableLimit}. Your quota will refresh in ${timeDesc}.`;
    case "ai_ocr":
      return `Document scanning limit reached. Maximum ${readableLimit}. Please wait ${timeDesc} before scanning another document.`;
    case "ai_brief":
      return `Daily brief refresh limit reached. Maximum ${readableLimit}. Cache results are preserved for the next ${timeDesc}.`;
    case "ai_extract":
      return `Document extraction limit reached (${readableLimit}). Please wait ${timeDesc} before trying again.`;
    case "ai_reword":
      return `Reminder draft limit reached (${readableLimit}). Please wait ${timeDesc} before generating another draft.`;
    default:
      return `Rate limit exceeded (${readableLimit}). Please try again in ${timeDesc}.`;
  }
}

// Extracts client IP address accurately from standard proxy headers
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ips = forwardedFor.split(",").map((ip) => ip.trim());
    if (ips[0]) return ips[0];
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}
