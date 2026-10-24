import CurrentAffairsDigest, { ICurrentAffairsItem } from "@/models/CurrentAffairsDigest";
import { generateCurrentAffairsPoints } from "./ai-digest";
import { classifyAIError, type AIErrorPayload } from "./ai-errors";
import { fetchArchiveHeadlines, monthWindows, type DateWindow } from "./news-archive";
import { categoryById, dateLabel, istDateString, monthKeyOf } from "./current-affairs-config";
import { NewsFetchError } from "./news-feeds";

export interface BackfillJob {
  state: "running" | "done" | "error";
  step: number;
  totalSteps: number;
  itemsAdded: number;
  daysTouched: number;
  failedWeeks: number;
  startedAt: number;
  finishedAt?: number;
  error?: Omit<AIErrorPayload, "status">;
}

const WINDOW_CONCURRENCY = 2;
const WINDOW_ATTEMPTS = 2;

const globalStore = globalThis as unknown as { __caBackfillJobs?: Map<string, BackfillJob> };
const jobs: Map<string, BackfillJob> = globalStore.__caBackfillJobs ?? new Map();
globalStore.__caBackfillJobs = jobs;

// One backfill per month for everyone: the result is shared, so nobody should pay twice.
const jobKey = (userId: string, month: string) => {
  void userId;
  return month;
};

function publicError(err: unknown, model?: string): Omit<AIErrorPayload, "status"> {
  const { status, ...payload } = classifyAIError(err, model);
  void status;
  return payload;
}

export function getBackfillJob(userId: string, month: string): BackfillJob | null {
  const job = jobs.get(jobKey(userId, month));
  if (!job) return null;
  if (job.finishedAt && Date.now() - job.finishedAt > 30 * 60 * 1000) {
    jobs.delete(jobKey(userId, month));
    return null;
  }
  return job;
}

export function startBackfill(userId: string, month: string, model?: string): BackfillJob {
  const existing = getBackfillJob(userId, month);
  if (existing?.state === "running") return existing;

  const windows = monthWindows(month, istDateString());
  const job: BackfillJob = {
    state: "running",
    step: 0,
    totalSteps: Math.max(windows.length, 1),
    itemsAdded: 0,
    daysTouched: 0,
    failedWeeks: 0,
    startedAt: Date.now(),
  };
  jobs.set(jobKey(userId, month), job);

  void runBackfill(userId, month, model, job, windows).catch((err) => {
    console.error("Backfill crashed:", err);
    job.state = "error";
    job.error = publicError(err, model);
    job.finishedAt = Date.now();
  });

  return job;
}

async function processWindow(
  userId: string,
  month: string,
  model: string | undefined,
  window: DateWindow,
  job: BackfillJob,
  touched: Set<string>
): Promise<{ hadHeadlines: boolean; failures: string[] }> {
  // Days that already have a saved digest are kept exactly as they are
  const saved = await CurrentAffairsDigest.find({
    monthKey: month,
    date: { $gte: window.start, $lte: window.end },
    "items.0": { $exists: true },
  }).select("date");
  const skipDates = new Set(saved.map((d) => d.date));

  const { headlines, failures } = await fetchArchiveHeadlines(window, skipDates);
  if (headlines.length === 0) return { hadHeadlines: false, failures };

  const points = await generateCurrentAffairsPoints(
    headlines,
    `${dateLabel(window.start, false)} to ${dateLabel(window.end, false)}`,
    model
  );

  const byDate = new Map<string, ICurrentAffairsItem[]>();
  const linksByDate = new Map<string, string[]>();
  for (const h of headlines) {
    const day = istDateString(h.publishedAt);
    linksByDate.set(day, [...(linksByDate.get(day) ?? []), h.link]);
  }
  for (const p of points) {
    const source = p.src ? headlines[p.src - 1] : undefined;
    if (!source) continue;
    const day = istDateString(source.publishedAt);
    if (monthKeyOf(day) !== month) continue;
    const list = byDate.get(day) ?? [];
    list.push({
      point: p.point,
      category: p.category,
      division: categoryById(p.category).division,
      staticLink: p.staticLink,
      sourceTitle: source.title,
      sourceUrl: source.link,
      sourcePublisher: source.publisher,
    });
    byDate.set(day, list);
  }

  for (const [day, items] of byDate) {
    const covered = linksByDate.get(day) ?? [];
    try {
      const doc = await CurrentAffairsDigest.findOne({ date: day });
      if (doc) {
        doc.items.push(...items);
        doc.coveredUrls.push(...covered);
        await doc.save();
      } else {
        await CurrentAffairsDigest.create({
          date: day,
          monthKey: month,
          items,
          coveredUrls: covered,
          savedBy: [],
          generatedBy: userId,
          aiModel: model,
          lastCheckedAt: new Date(),
        });
      }
    } catch (err) {
      if ((err as { code?: number })?.code !== 11000) throw err;
    }
    touched.add(day);
    job.itemsAdded += items.length;
    job.daysTouched = touched.size;
  }

  return { hadHeadlines: true, failures };
}

async function runBackfill(
  userId: string,
  month: string,
  model: string | undefined,
  job: BackfillJob,
  windows: DateWindow[]
) {
  const touched = new Set<string>();
  const queue = [...windows];
  const allFailures: string[] = [];
  let anyHeadlines = false;
  let lastError: unknown;

  const worker = async () => {
    for (let window = queue.shift(); window; window = queue.shift()) {
      let succeeded = false;
      for (let attempt = 1; attempt <= WINDOW_ATTEMPTS && !succeeded; attempt++) {
        try {
          const result = await processWindow(userId, month, model, window, job, touched);
          anyHeadlines = anyHeadlines || result.hadHeadlines;
          allFailures.push(...result.failures);
          succeeded = true;
        } catch (err) {
          lastError = err;
          console.error(`Backfill week ${window.start} attempt ${attempt} failed:`, err);
        }
      }
      if (!succeeded) job.failedWeeks += 1;
      job.step += 1;
    }
  };

  await Promise.all(Array.from({ length: WINDOW_CONCURRENCY }, worker));

  // Every week failed: report the real cause instead of an empty success
  if (job.failedWeeks >= windows.length && lastError) {
    job.state = "error";
    job.error = publicError(lastError, model);
    job.finishedAt = Date.now();
    return;
  }

  if (!anyHeadlines && touched.size === 0) {
    const savedAny = await CurrentAffairsDigest.exists({ monthKey: month });
    if (!savedAny) {
      job.state = "error";
      job.error = publicError(
        new NewsFetchError(allFailures.length ? allFailures : ["No headlines found for that month."]),
        model
      );
      job.finishedAt = Date.now();
      return;
    }
  }

  job.state = "done";
  job.finishedAt = Date.now();
}
