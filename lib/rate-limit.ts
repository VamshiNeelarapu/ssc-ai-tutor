interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}, 60 * 1000); // every minute

export interface RateLimitConfig {
  windowMs: number; // window in milliseconds
  max: number; // max requests per window
}

export function rateLimit(
  identifier: string,
  config: RateLimitConfig
): { success: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const key = `rl:${identifier}`;

  let entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + config.windowMs,
    };
    store.set(key, entry);
  }

  entry.count += 1;

  const remaining = Math.max(0, config.max - entry.count);
  const success = entry.count <= config.max;

  return { success, remaining, resetAt: entry.resetAt };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") || "unknown";
}

// Pre-configured limiters
export const authRateLimit = (ip: string) =>
  rateLimit(`auth:${ip}`, { windowMs: 15 * 60 * 1000, max: 10 }); // 10 per 15 min

export const aiRateLimit = (userId: string) =>
  rateLimit(`ai:${userId}`, { windowMs: 60 * 1000, max: 20 }); // 20 per minute
