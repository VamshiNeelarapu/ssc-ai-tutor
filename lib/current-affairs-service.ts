import CurrentAffairsDigest, {
  ICurrentAffairsDigest,
  ICurrentAffairsItem,
} from "@/models/CurrentAffairsDigest";
import StudyNote from "@/models/StudyNote";
import SyllabusNode from "@/models/SyllabusNode";
import { fetchHeadlines } from "./news-feeds";
import { generateCurrentAffairsPoints } from "./ai-digest";
import {
  CA_CATEGORIES,
  CA_DIVISION_LABELS,
  categoryById,
  dateLabel,
  monthKeyOf,
  monthLabel,
  shortDayLabel,
} from "./current-affairs-config";

const MAX_NEW_POINTS = 30;

export interface SerializedDigest {
  date: string;
  monthKey: string;
  itemCount: number;
  items: ICurrentAffairsItem[];
  inMonthly: boolean;
  aiModel?: string;
  updatedAt: string;
}

export function serializeDigest(doc: ICurrentAffairsDigest): SerializedDigest {
  return {
    date: doc.date,
    monthKey: doc.monthKey,
    itemCount: doc.items.length,
    items: doc.items.map((i) => ({
      point: i.point,
      category: i.category,
      division: i.division,
      staticLink: i.staticLink,
      sourceTitle: i.sourceTitle,
      sourceUrl: i.sourceUrl,
      sourcePublisher: i.sourcePublisher,
    })),
    inMonthly: doc.inMonthly,
    aiModel: doc.aiModel,
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export type GenerateStatus = "created" | "updated" | "cached" | "no_new";

export async function generateDigest(opts: {
  userId: string;
  date: string;
  model?: string;
  refresh?: boolean;
}): Promise<{ digest: ICurrentAffairsDigest; newCount: number; status: GenerateStatus }> {
  const { userId, date, model, refresh } = opts;

  const existing = await CurrentAffairsDigest.findOne({ userId, date });
  if (existing && !refresh) {
    return { digest: existing, newCount: 0, status: "cached" };
  }

  const { headlines } = await fetchHeadlines();

  const covered = new Set(existing?.coveredUrls ?? []);
  const fresh = headlines.filter((h) => !covered.has(h.link));
  if (existing && fresh.length === 0) {
    return { digest: existing, newCount: 0, status: "no_new" };
  }

  const points = await generateCurrentAffairsPoints(fresh, dateLabel(date), model);

  const items: ICurrentAffairsItem[] = points.slice(0, MAX_NEW_POINTS).map((p) => {
    const source = p.src ? fresh[p.src - 1] : undefined;
    return {
      point: p.point,
      category: p.category,
      division: categoryById(p.category).division,
      staticLink: p.staticLink,
      sourceTitle: source?.title,
      sourceUrl: source?.link,
      sourcePublisher: source?.publisher,
    };
  });
  const freshLinks = fresh.map((h) => h.link);

  let digest: ICurrentAffairsDigest;
  if (existing) {
    existing.items.push(...items);
    existing.coveredUrls.push(...freshLinks);
    existing.aiModel = model;
    await existing.save();
    digest = existing;
  } else {
    try {
      digest = await CurrentAffairsDigest.create({
        userId,
        date,
        monthKey: monthKeyOf(date),
        items,
        coveredUrls: freshLinks,
        inMonthly: false,
        aiModel: model,
      });
    } catch (err) {
      // A parallel request created today's digest first; use it.
      if ((err as { code?: number })?.code === 11000) {
        const winner = await CurrentAffairsDigest.findOne({ userId, date });
        if (winner) return { digest: winner, newCount: 0, status: "cached" };
      }
      throw err;
    }
  }

  if (digest.inMonthly) {
    await rebuildMonthlyNote(userId, digest.monthKey);
  }

  return { digest, newCount: items.length, status: existing ? "updated" : "created" };
}

export interface MonthlyNoteResult {
  noteId: string;
  title: string;
  monthKey: string;
  days: number;
  items: number;
  created: boolean;
}

export async function getMonthlyNoteSummary(
  userId: string,
  monthKey: string
): Promise<{ noteId: string; title: string; days: number; items: number } | null> {
  const note = await StudyNote.findOne({ userId, kind: "current_affairs_month", monthKey }).select("title");
  if (!note) return null;
  const digests = await CurrentAffairsDigest.find({ userId, monthKey, inMonthly: true }).select("items");
  return {
    noteId: note._id.toString(),
    title: note.title,
    days: digests.length,
    items: digests.reduce((sum, d) => sum + d.items.length, 0),
  };
}

export async function rebuildMonthlyNote(
  userId: string,
  monthKey: string
): Promise<MonthlyNoteResult | null> {
  const digests = await CurrentAffairsDigest.find({ userId, monthKey, inMonthly: true }).sort({
    date: 1,
  });
  if (digests.length === 0) return null;

  const linesByCategory = new Map<string, string[]>();
  const staticLinks: string[] = [];
  const seenStatic = new Set<string>();
  const references: Array<{ title: string; url: string; publisher?: string; verificationStatus: "verified" }> = [];
  const seenUrls = new Set<string>();
  let itemCount = 0;

  for (const d of digests) {
    for (const item of d.items) {
      itemCount++;
      const lines = linesByCategory.get(item.category) ?? [];
      lines.push(`• ${shortDayLabel(d.date)} — ${item.point}`);
      linesByCategory.set(item.category, lines);

      if (item.staticLink) {
        const key = item.staticLink.toLowerCase();
        if (!seenStatic.has(key)) {
          seenStatic.add(key);
          staticLinks.push(item.staticLink);
        }
      }
      if (item.sourceUrl && !seenUrls.has(item.sourceUrl)) {
        seenUrls.add(item.sourceUrl);
        references.push({
          title: item.sourceTitle || item.sourceUrl,
          url: item.sourceUrl,
          publisher: item.sourcePublisher,
          verificationStatus: "verified",
        });
      }
    }
  }

  const coreConcepts = CA_CATEGORIES.filter((c) => linesByCategory.has(c.id)).map((c) => {
    const lines = linesByCategory.get(c.id)!;
    return {
      heading: `${CA_DIVISION_LABELS[c.division]} · ${c.label} (${lines.length})`,
      body: lines.join("\n"),
    };
  });

  const title = `Current Affairs — ${monthLabel(monthKey)}`;
  const content = {
    overview: `Current affairs for ${monthLabel(monthKey)}, updated daily. Covers ${digests.length} day${digests.length === 1 ? "" : "s"} and ${itemCount} points, grouped by GS topic and Static GK. Points are summarised from newspaper headlines (see References); verify important facts from official sources before relying on them.`,
    coreConcepts,
    keyFacts: staticLinks.slice(0, 150),
    shortcuts: [] as string[],
    revisionTips: [
      "Revise one category at a time and link each point to its static GK topic. The Quick Revision view lists the static GK links for the whole month.",
    ],
    commonConfusions: [] as string[],
    mcqs: [] as never[],
    workedExamples: [] as never[],
    references: references.slice(0, 150),
  };

  const subject = await SyllabusNode.findOne({ slug: "general-awareness" }).select("_id");

  const filter = { userId, kind: "current_affairs_month" as const, monthKey };
  const existed = await StudyNote.exists(filter);

  const note = await StudyNote.findOneAndUpdate(
    filter,
    {
      $set: {
        title,
        subjectId: subject?._id.toString(),
        examRelevance: ["tier1", "tier2"],
        content,
      },
      $unset: { sectionId: 1 },
    },
    { upsert: true, new: true }
  );

  return {
    noteId: note._id.toString(),
    title,
    monthKey,
    days: digests.length,
    items: itemCount,
    created: !existed,
  };
}
