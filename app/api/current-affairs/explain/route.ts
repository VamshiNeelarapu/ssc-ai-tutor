import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { z } from "zod";
import connectToDatabase from "@/lib/db";
import CurrentAffairsExplanation from "@/models/CurrentAffairsExplanation";
import ImportantPoint from "@/models/ImportantPoint";
import { requireAuth, apiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { aiRateLimit } from "@/lib/rate-limit";
import { aiErrorResponse, aiNotConfiguredResponse, aiRateLimitResponse } from "@/lib/ai-errors";
import { explainCurrentAffairsPoint } from "@/lib/ai-digest";

const Schema = z.object({
  point: z.string().trim().min(10).max(600),
  staticLink: z.string().max(200).optional(),
  regenerate: z.boolean().optional(),
  model: z.string().max(100).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request as unknown as Request);

    const validation = Schema.safeParse(await request.json().catch(() => ({})));
    if (!validation.success) return apiError(validation.error.errors[0].message, 400);

    const { point, staticLink, regenerate, model } = validation.data;
    const key = createHash("sha1").update(point.toLowerCase()).digest("hex");

    await connectToDatabase();

    if (!regenerate) {
      const cached = await CurrentAffairsExplanation.findOne({ key });
      if (cached) return apiSuccess({ content: cached.content, cached: true });
    }

    const limit = aiRateLimit(session.userId);
    if (!limit.success) return aiRateLimitResponse();
    if (!process.env.AI_API_KEY) return aiNotConfiguredResponse();

    try {
      const content = await explainCurrentAffairsPoint(point, staticLink, model);
      await CurrentAffairsExplanation.findOneAndUpdate(
        { key },
        { $set: { point, content, aiModel: model }, $setOnInsert: { generatedBy: session.userId } },
        { upsert: true }
      );
      await ImportantPoint.updateMany({ key }, { $set: { background: content } });
      return apiSuccess({ content, cached: false });
    } catch (err) {
      console.error("Current affairs explain error:", err);
      return aiErrorResponse(err, model);
    }
  } catch (error) {
    return handleApiError(error);
  }
}
