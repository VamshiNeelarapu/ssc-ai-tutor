import { NextRequest } from "next/server";
import { z } from "zod";
import connectToDatabase from "@/lib/db";
import { requireAuth, apiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { aiNotConfiguredResponse, aiRateLimitResponse } from "@/lib/ai-errors";
import { aiRateLimit } from "@/lib/rate-limit";
import { getBackfillJob, startBackfill } from "@/lib/current-affairs-backfill";
import { istDateString, monthKeyOf } from "@/lib/current-affairs-config";

const MonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const StartSchema = z.object({ month: MonthSchema, model: z.string().max(100).optional() });

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request as unknown as Request);

    const validation = StartSchema.safeParse(await request.json().catch(() => ({})));
    if (!validation.success) return apiError("A valid month (YYYY-MM) is required", 400);

    const { month, model } = validation.data;
    if (month > monthKeyOf(istDateString())) {
      return apiError("That month hasn't happened yet.", 400);
    }

    const limit = aiRateLimit(session.userId);
    if (!limit.success) return aiRateLimitResponse();
    if (!process.env.AI_API_KEY) return aiNotConfiguredResponse();

    await connectToDatabase();
    return apiSuccess({ job: startBackfill(session.userId, month, model) }, 202);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request as unknown as Request);
    const month = request.nextUrl.searchParams.get("month") ?? "";
    if (!MonthSchema.safeParse(month).success) return apiError("Invalid month", 400);
    return apiSuccess({ job: getBackfillJob(session.userId, month) });
  } catch (error) {
    return handleApiError(error);
  }
}
