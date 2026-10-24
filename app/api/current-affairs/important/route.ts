import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { z } from "zod";
import connectToDatabase from "@/lib/db";
import ImportantPoint, { IImportantPoint } from "@/models/ImportantPoint";
import CurrentAffairsExplanation from "@/models/CurrentAffairsExplanation";
import { requireAuth, apiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { CA_CATEGORY_IDS, isValidDateString, monthKeyOf } from "@/lib/current-affairs-config";

const MarkSchema = z.object({
  date: z.string().refine(isValidDateString, "Invalid date"),
  point: z.string().trim().min(10).max(600),
  category: z.string().refine((c) => CA_CATEGORY_IDS.includes(c), "Invalid category"),
  division: z.enum(["gs", "static"]),
  staticLink: z.string().max(200).optional(),
  sourceTitle: z.string().max(400).optional(),
  sourceUrl: z.string().max(1000).optional(),
  sourcePublisher: z.string().max(100).optional(),
});

function serialize(p: IImportantPoint) {
  return {
    id: p._id.toString(),
    date: p.date,
    point: p.point,
    category: p.category,
    division: p.division,
    staticLink: p.staticLink,
    sourceTitle: p.sourceTitle,
    sourceUrl: p.sourceUrl,
    sourcePublisher: p.sourcePublisher,
    background: p.background,
    createdAt: p.createdAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request as unknown as Request);
    await connectToDatabase();
    const points = await ImportantPoint.find({ userId: session.userId })
      .sort({ date: -1, createdAt: -1 })
      .limit(1000);
    return apiSuccess({ points: points.map(serialize) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request as unknown as Request);
    const validation = MarkSchema.safeParse(await request.json().catch(() => ({})));
    if (!validation.success) return apiError(validation.error.errors[0].message, 400);

    const data = validation.data;
    const key = createHash("sha1").update(data.point.toLowerCase()).digest("hex");

    await connectToDatabase();

    // Keep a background you already generated for this point
    const explanation = await CurrentAffairsExplanation.findOne({ key });

    const saved = await ImportantPoint.findOneAndUpdate(
      { userId: session.userId, key },
      {
        $setOnInsert: {
          ...data,
          monthKey: monthKeyOf(data.date),
          ...(explanation ? { background: explanation.content } : {}),
        },
      },
      { upsert: true, new: true }
    );

    return apiSuccess(serialize(saved), 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAuth(request as unknown as Request);
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return apiError("id is required", 400);

    await connectToDatabase();
    await ImportantPoint.deleteOne({ _id: id, userId: session.userId });
    return apiSuccess({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
