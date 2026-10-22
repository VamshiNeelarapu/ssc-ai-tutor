import { NextRequest } from "next/server";
import { requireAuth, apiSuccess, handleApiError } from "@/lib/api-utils";

interface CreditsResponse {
  supported: boolean;
  balance?: number;
  totalCredits?: number;
  totalUsage?: number;
  keyLimit?: {
    limit: number;
    remaining: number;
    resetInterval?: string | null;
    resetsAt?: string | null;
  } | null;
}

async function orGet(path: string, key: string) {
  const res = await fetch(`https://openrouter.ai/api/v1/${path}`, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()).data;
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request as unknown as Request);

    const key = process.env.AI_API_KEY;
    if (!key || (process.env.AI_PROVIDER || "openrouter") !== "openrouter") {
      return apiSuccess({ supported: false } satisfies CreditsResponse);
    }

    const [credits, keyInfo] = await Promise.allSettled([orGet("credits", key), orGet("key", key)]);

    const out: CreditsResponse = { supported: true };

    if (credits.status === "fulfilled" && typeof credits.value?.total_credits === "number") {
      const totalCredits: number = credits.value.total_credits;
      const totalUsage: number = credits.value.total_usage ?? 0;
      out.totalCredits = totalCredits;
      out.totalUsage = totalUsage;
      out.balance = totalCredits - totalUsage;
    }

    if (keyInfo.status === "fulfilled") {
      const k = keyInfo.value;
      const budget = k?.effective_budget;
      if (typeof k?.limit_remaining === "number" && typeof k?.limit === "number") {
        out.keyLimit = {
          limit: k.limit,
          remaining: k.limit_remaining,
          resetInterval: k.limit_reset ?? null,
          resetsAt: budget?.resets_at ?? null,
        };
      } else {
        out.keyLimit = null;
      }
    }

    return apiSuccess(out);
  } catch (error) {
    return handleApiError(error);
  }
}
