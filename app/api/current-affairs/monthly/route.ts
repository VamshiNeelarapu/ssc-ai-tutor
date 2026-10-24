import { NextRequest } from "next/server";
import { z } from "zod";
import connectToDatabase from "@/lib/db";
import CurrentAffairsDigest from "@/models/CurrentAffairsDigest";
import { requireAuth, apiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { rebuildMonthlyNote } from "@/lib/current-affairs-service";
import { isValidDateString } from "@/lib/current-affairs-config";

const Schema = z
  .object({
    date: z.string().optional(),
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
  })
  .refine((v) => (v.date && isValidDateString(v.date)) || v.month, {
    message: "A valid date (YYYY-MM-DD) or month (YYYY-MM) is required",
  });

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request as unknown as Request);

    const validation = Schema.safeParse(await request.json().catch(() => ({})));
    if (!validation.success) return apiError(validation.error.errors[0].message, 400);

    await connectToDatabase();

    const { date, month } = validation.data;
    let monthKey: string;

    if (month) {
      // Save every saved day of the month into that month's note
      const digests = await CurrentAffairsDigest.find({ monthKey: month });
      const withItems = digests.filter((d) => d.items.length > 0);
      if (withItems.length === 0) {
        return apiError("There are no current affairs saved for that month yet.", 404);
      }
      await CurrentAffairsDigest.updateMany(
        { monthKey: month, "items.0": { $exists: true } },
        { $addToSet: { savedBy: session.userId } }
      );
      monthKey = month;
    } else {
      const digest = await CurrentAffairsDigest.findOne({ date });
      if (!digest || digest.items.length === 0) {
        return apiError("There are no current affairs saved for that day yet.", 404);
      }
      await CurrentAffairsDigest.updateOne({ date }, { $addToSet: { savedBy: session.userId } });
      monthKey = digest.monthKey;
    }

    const result = await rebuildMonthlyNote(session.userId, monthKey);
    if (!result) return apiError("Could not build the monthly note", 500);

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
