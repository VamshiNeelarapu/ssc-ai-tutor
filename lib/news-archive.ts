import { parseRss, type Headline } from "./news-feeds";
import { istDateString } from "./current-affairs-config";

const ARCHIVE_QUERIES = [
  "India government decision OR scheme OR cabinet",
  "India economy OR RBI OR budget OR GDP OR inflation",
  "India foreign relations OR summit OR bilateral OR UN",
  "India appointed OR appoints OR resigns OR takes charge",
  "India award OR honour OR prize OR wins",
  "India sports tournament OR championship OR medal",
  "India defence OR exercise OR ISRO OR missile OR launch",
  "India report OR index OR ranking OR survey",
  "India environment OR climate OR wildlife OR heritage",
  "India Supreme Court OR Parliament OR bill OR Constitution",
];

const PER_QUERY_KEEP = 9;
const MAX_PER_WINDOW = 85;
const CONCURRENCY = 5;

export interface DateWindow {
  start: string; // YYYY-MM-DD (IST), inclusive
  end: string; // inclusive
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Week-sized windows for a month, never extending past today. */
export function monthWindows(monthKey: string, today: string): DateWindow[] {
  const [y, m] = monthKey.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const monthEnd = `${monthKey}-${String(daysInMonth).padStart(2, "0")}`;
  const last = monthEnd < today ? monthEnd : today;
  const windows: DateWindow[] = [];
  for (let day = 1; day <= daysInMonth; day += 7) {
    const start = `${monthKey}-${String(day).padStart(2, "0")}`;
    if (start > last) break;
    const rawEnd = addDays(start, 6);
    const end = rawEnd < last ? rawEnd : last;
    windows.push({ start, end });
  }
  return windows;
}

function splitPublisher(title: string): { title: string; publisher: string } {
  const idx = title.lastIndexOf(" - ");
  if (idx > 20) return { title: title.slice(0, idx).trim(), publisher: title.slice(idx + 3).trim() };
  return { title, publisher: "News" };
}

function titleKey(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 70);
}

async function fetchQuery(query: string, window: DateWindow): Promise<Headline[]> {
  const q = `${query} after:${addDays(window.start, -1)} before:${addDays(window.end, 1)}`;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-IN&gl=IN&ceid=IN:en`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SSCStudyApp/1.0)" },
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseRss(await res.text(), "News").map((h) => {
    const { title, publisher } = splitPublisher(h.title);
    return { ...h, title, publisher, summary: "" };
  });
}

export async function fetchArchiveHeadlines(
  window: DateWindow,
  skipDates: Set<string>
): Promise<{ headlines: Headline[]; failures: string[] }> {
  const failures: string[] = [];
  const perQuery: Headline[][] = [];

  for (let i = 0; i < ARCHIVE_QUERIES.length; i += CONCURRENCY) {
    const batch = ARCHIVE_QUERIES.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(batch.map((q) => fetchQuery(q, window)));
    results.forEach((r, j) => {
      if (r.status === "fulfilled") perQuery.push(r.value);
      else failures.push(`${batch[j]}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
    });
  }

  const seenLinks = new Set<string>();
  const seenTitles = new Set<string>();
  const picked: Headline[] = [];

  // Round-robin across queries so every topic is represented
  for (let rank = 0; rank < PER_QUERY_KEEP && picked.length < MAX_PER_WINDOW; rank++) {
    for (const list of perQuery) {
      const eligible = list.filter((h) => {
        const day = istDateString(h.publishedAt);
        return day >= window.start && day <= window.end && !skipDates.has(day);
      });
      const h = eligible[rank];
      if (!h) continue;
      const key = titleKey(h.title);
      if (seenLinks.has(h.link) || seenTitles.has(key)) continue;
      seenLinks.add(h.link);
      seenTitles.add(key);
      picked.push(h);
      if (picked.length >= MAX_PER_WINDOW) break;
    }
  }

  return { headlines: picked, failures };
}
