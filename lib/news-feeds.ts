export interface FeedConfig {
  name: string;
  url: string;
}

export interface Headline {
  title: string;
  link: string;
  publisher: string;
  publishedAt: Date;
  summary: string;
}

export const DEFAULT_FEEDS: FeedConfig[] = [
  { name: "The Hindu", url: "https://www.thehindu.com/news/national/feeder/default.rss" },
  { name: "The Hindu", url: "https://www.thehindu.com/news/international/feeder/default.rss" },
  { name: "The Hindu", url: "https://www.thehindu.com/business/Economy/feeder/default.rss" },
  { name: "The Hindu", url: "https://www.thehindu.com/sci-tech/feeder/default.rss" },
  { name: "The Hindu", url: "https://www.thehindu.com/sport/feeder/default.rss" },
  { name: "Indian Express", url: "https://indianexpress.com/section/india/feed/" },
  { name: "Indian Express", url: "https://indianexpress.com/section/explained/feed/" },
  { name: "Indian Express", url: "https://indianexpress.com/section/business/feed/" },
  { name: "Times of India", url: "https://timesofindia.indiatimes.com/rssfeedstopstories.cms" },
];

export class NewsFetchError extends Error {
  constructor(public failures: string[]) {
    super("Could not fetch any news headlines.");
    this.name = "NewsFetchError";
  }
}

const FETCH_TIMEOUT_MS = 8000;
const MAX_PER_FEED = 25;
const MAX_TOTAL = 90;

export function getConfiguredFeeds(): FeedConfig[] {
  const raw = process.env.CURRENT_AFFAIRS_FEEDS;
  if (!raw) return DEFAULT_FEEDS;
  try {
    const parsed = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.every((f) => typeof f?.name === "string" && typeof f?.url === "string")
    ) {
      return parsed;
    }
  } catch {
    // fall through to defaults
  }
  return DEFAULT_FEEDS;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function cleanText(raw: string): string {
  const unwrapped = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  // decode first so entity-encoded markup is also stripped
  const decoded = decodeEntities(unwrapped);
  return decodeEntities(decoded.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function getTag(xml: string, tag: string): string {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i").exec(xml);
  return match ? match[1] : "";
}

export function parseRss(xml: string, publisher: string): Headline[] {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  const headlines: Headline[] = [];

  for (const item of items) {
    const title = cleanText(getTag(item, "title"));
    const link = cleanText(getTag(item, "link")) || cleanText(getTag(item, "guid"));
    const pub = cleanText(getTag(item, "pubDate")) || cleanText(getTag(item, "dc:date"));
    const publishedAt = pub ? new Date(pub) : null;
    if (!title || !/^https?:\/\//i.test(link) || !publishedAt || Number.isNaN(publishedAt.getTime())) {
      continue;
    }
    const summary = cleanText(getTag(item, "description")).slice(0, 220);
    headlines.push({ title, link, publisher, publishedAt, summary });
  }

  return headlines;
}

async function fetchFeed(feed: FeedConfig): Promise<Headline[]> {
  const res = await fetch(feed.url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; SSCStudyApp/1.0)",
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseRss(await res.text(), feed.name).slice(0, MAX_PER_FEED);
}

function titleKey(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 70);
}

export async function fetchHeadlines(
  maxAgeHours = 30
): Promise<{ headlines: Headline[]; failures: string[] }> {
  const feeds = getConfiguredFeeds();
  const results = await Promise.allSettled(feeds.map(fetchFeed));
  const failures: string[] = [];
  const all: Headline[] = [];

  results.forEach((r, i) => {
    if (r.status === "fulfilled") all.push(...r.value);
    else {
      const reason = r.reason instanceof Error ? (r.reason.cause as { code?: string } | undefined)?.code || r.reason.message : String(r.reason);
      failures.push(`${feeds[i].name} (${feeds[i].url}): ${reason}`);
    }
  });

  const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;
  const seenLinks = new Set<string>();
  const seenTitles = new Set<string>();
  const fresh = all
    .filter((h) => h.publishedAt.getTime() >= cutoff)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .filter((h) => {
      const key = titleKey(h.title);
      if (seenLinks.has(h.link) || seenTitles.has(key)) return false;
      seenLinks.add(h.link);
      seenTitles.add(key);
      return true;
    })
    .slice(0, MAX_TOTAL);

  if (fresh.length === 0) {
    throw new NewsFetchError(
      failures.length > 0 ? failures : [`No stories were published in the last ${maxAgeHours} hours.`]
    );
  }

  return { headlines: fresh, failures };
}
