import { NextRequest } from "next/server";
import { z } from "zod";
import connectToDatabase from "@/lib/db";
import CurrentAffairsDigest from "@/models/CurrentAffairsDigest";
import { requireAuth, apiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { aiRateLimit } from "@/lib/rate-limit";
import {
  aiErrorResponse,
  aiNotConfiguredResponse,
  aiRateLimitResponse,
} from "@/lib/ai-errors";
import {
  generateDigest,
  getMonthlyNoteSummary,
  serializeDigest,
} from "@/lib/current-affairs-service";
import {
  isValidDateString,
  istDateString,
  monthKeyOf,
  monthLabel,
} from "@/lib/current-affairs-config";

const GenerateSchema = z.object({
  date: z.string().optional(),
  refresh: z.boolean().optional(),
  model: z.string().max(100).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request as unknown as Request);

    const today = istDateString();
    const requested = request.nextUrl.searchParams.get("date") || today;
    if (!isValidDateString(requested)) return apiError("Invalid date", 400);

    await connectToDatabase();

    const monthKey = monthKeyOf(requested);
    const [digest, history, monthly] = await Promise.all([
      CurrentAffairsDigest.findOne({ date: requested }),
      CurrentAffairsDigest.find({})
        .sort({ date: -1 })
        .limit(45)
        .select("date savedBy items.point"),
      getMonthlyNoteSummary(session.userId, monthKey),
    ]);

    return apiSuccess({
      today,
      date: requested,
      digest: digest ? serializeDigest(digest, session.userId) : null,
      monthKey,
      monthLabel: monthLabel(monthKey),
      monthly,
      history: history.map((h) => ({
        date: h.date,
        count: h.items.length,
        inMonthly: (h.savedBy ?? []).includes(session.userId),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request as unknown as Request);

    const limit = aiRateLimit(session.userId);
    if (!limit.success) return aiRateLimitResponse();

    const validation = GenerateSchema.safeParse(await request.json().catch(() => ({})));
    if (!validation.success) return apiError(validation.error.errors[0].message, 400);

    const { refresh, model } = validation.data;
    const today = istDateString();
    const date = validation.data.date || today;

    if (!isValidDateString(date)) return apiError("Invalid date", 400);
    if (date !== today) {
      return apiError(
        "Current affairs can only be generated for today, because they are built from today's news. Earlier days show what you already saved.",
        400
      );
    }

    if (!process.env.AI_API_KEY) return aiNotConfiguredResponse();

    await connectToDatabase();

    try {
      const { digest, newCount, status } = await generateDigest({
        userId: session.userId,
        date,
        model,
        refresh,
      });
      const monthly = await getMonthlyNoteSummary(session.userId, digest.monthKey);
      return apiSuccess({ digest: serializeDigest(digest, session.userId), newCount, status, monthly });
    } catch (err) {
      console.error("Current affairs generation error:", err);
      return aiErrorResponse(err, model);
    }
  } catch (error) {
    return handleApiError(error);
  }
}
