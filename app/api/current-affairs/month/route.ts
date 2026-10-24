import { NextRequest } from "next/server";
import connectToDatabase from "@/lib/db";
import CurrentAffairsDigest from "@/models/CurrentAffairsDigest";
import { requireAuth, apiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { getMonthlyNoteSummary } from "@/lib/current-affairs-service";
import { istDateString, monthKeyOf, monthLabel } from "@/lib/current-affairs-config";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request as unknown as Request);

    const month = request.nextUrl.searchParams.get("month") || monthKeyOf(istDateString());
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return apiError("Invalid month", 400);

    await connectToDatabase();

    const [digests, monthly, allMonths] = await Promise.all([
      CurrentAffairsDigest.find({ monthKey: month }).sort({ date: 1 }),
      getMonthlyNoteSummary(session.userId, month),
      CurrentAffairsDigest.aggregate<{ _id: string; days: number }>([
        { $group: { _id: "$monthKey", days: { $sum: 1 } } },
        { $sort: { _id: -1 } },
        { $limit: 24 },
      ]),
    ]);

    const items = digests.flatMap((d) =>
      d.items.map((i) => ({
        date: d.date,
        point: i.point,
        category: i.category,
        division: i.division,
        staticLink: i.staticLink,
        sourceTitle: i.sourceTitle,
        sourceUrl: i.sourceUrl,
        sourcePublisher: i.sourcePublisher,
      }))
    );

    return apiSuccess({
      month,
      monthLabel: monthLabel(month),
      days: digests.map((d) => ({ date: d.date, count: d.items.length, inMonthly: (d.savedBy ?? []).includes(session.userId) })),
      items,
      monthly,
      availableMonths: allMonths.map((m) => ({ month: m._id, label: monthLabel(m._id), days: m.days })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
