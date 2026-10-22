import { z } from "zod";
import { createAIClient, chat, AI_MODEL, SSC_SYSTEM_PROMPT, repairTruncatedJson } from "./ai";
import { AI_MODELS } from "./models";
import { CA_CATEGORIES, CA_CATEGORY_IDS, CA_FALLBACK_CATEGORY } from "./current-affairs-config";
import type { Headline } from "./news-feeds";

export class DigestGenerationError extends Error {
  constructor(
    public reason: string,
    public modelsTried: number
  ) {
    super(`The AI could not turn the headlines into a usable list after trying ${modelsTried} model(s) (${reason}).`);
    this.name = "DigestGenerationError";
  }
}

export interface DigestPoint {
  point: string;
  category: string;
  staticLink?: string;
  src?: number;
}

function normalizeCategory(value: string): string {
  const id = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  if (CA_CATEGORY_IDS.includes(id)) return id;
  const byLabel = CA_CATEGORIES.find(
    (c) => c.label.toLowerCase() === value.toLowerCase().trim()
  );
  return byLabel?.id ?? CA_FALLBACK_CATEGORY;
}

const PointSchema = z.object({
  point: z.string().trim().min(10),
  category: z.string().default(CA_FALLBACK_CATEGORY).transform(normalizeCategory),
  staticLink: z
    .string()
    .nullish()
    .transform((v) => (v && v.trim().length > 2 ? v.trim() : undefined)),
  src: z
    .union([z.number(), z.string()])
    .nullish()
    .transform((v) => {
      if (v === null || v === undefined) return undefined;
      const n = Number(String(v).replace(/[^0-9]/g, ""));
      return Number.isFinite(n) && n > 0 ? n : undefined;
    }),
});

function parsePoints(raw: string): DigestPoint[] | null {
  let content = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

  const firstBrace = content.indexOf("{");
  const firstBracket = content.indexOf("[");
  const objectFirst = firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket);
  const open = objectFirst ? "{" : "[";
  const close = objectFirst ? "}" : "]";
  const start = content.indexOf(open);
  const end = content.lastIndexOf(close);
  if (start !== -1 && end > start) content = content.slice(start, end + 1);

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    const repaired = repairTruncatedJson(content);
    if (!repaired) return null;
    try {
      parsed = JSON.parse(repaired);
    } catch {
      return null;
    }
  }

  const list = Array.isArray(parsed)
    ? parsed
    : (parsed as { points?: unknown; items?: unknown })?.points ??
      (parsed as { items?: unknown })?.items;
  if (!Array.isArray(list)) return null;

  const points: DigestPoint[] = [];
  for (const entry of list) {
    const result = PointSchema.safeParse(entry);
    if (result.success) points.push(result.data);
  }
  return points.length > 0 ? points : null;
}

function buildSystemPrompt(): string {
  const gs = CA_CATEGORIES.filter((c) => c.division === "gs")
    .map((c) => `  - ${c.id}: ${c.label}`)
    .join("\n");
  const stat = CA_CATEGORIES.filter((c) => c.division === "static")
    .map((c) => `  - ${c.id}: ${c.label}`)
    .join("\n");

  return `${SSC_SYSTEM_PROMPT}

## Current Affairs Digest Task
You will receive numbered news headlines (with short summaries) from today's newspapers. Turn them into a list of current-affairs points for SSC CGL General Awareness.

Rules:
1. Use ONLY facts stated in the headline or summary given. Do NOT add outside facts, figures, names or dates. If a headline does not contain enough information for a clear factual point, skip it.
2. Select only exam-relevant stories: government decisions, schemes, policy, economy and banking, international relations and summits, appointments, awards, sports results, reports and indices, science and defence developments, important days, books, notable places and persons. SKIP crime, celebrity or entertainment gossip, opinion pieces, local civic issues, stock-price movements and routine political rhetoric.
3. Merge stories about the same event into one point. Write each point as ONE clear sentence (max about 35 words) in English, even if the source is not.
4. Put each point in exactly one category, using the category id.
   GS topics:
${gs}
   Static GK:
${stat}
5. "staticLink": a short phrase (max 12 words) naming the stable static-GK topic a student should revise alongside this point (for example "BRICS: members, headquarters, New Development Bank"). Use well-established background only. Omit it if there is no natural link.
6. "src": the number of the headline the point is mainly based on.
7. Aim for 10 to 25 points, most exam-relevant first.

Return ONLY a valid JSON object, no markdown and no commentary:
{"points":[{"point":"string","category":"category id","staticLink":"string (optional)","src":12}]}`;
}

export async function generateCurrentAffairsPoints(
  headlines: Headline[],
  dateText: string,
  model?: string
): Promise<DigestPoint[]> {
  const client = createAIClient();

  const lines = headlines
    .map((h, i) => `[${i + 1}] ${h.publisher} — ${h.title}${h.summary ? ` — ${h.summary}` : ""}`)
    .join("\n");

  const requestMessages = [
    { role: "system" as const, content: buildSystemPrompt() },
    {
      role: "user" as const,
      content: `Date: ${dateText}\n\nHeadlines:\n${lines}\n\nReturn the JSON object now.`,
    },
  ];

  const primary = model || AI_MODEL;
  const modelsToTry = [primary, ...AI_MODELS.filter((m) => !m.paid).map((m) => m.id).filter((id) => id !== primary)];

  let lastReason = "no model produced a response";
  for (let i = 0; i < modelsToTry.length; i++) {
    const isLast = i === modelsToTry.length - 1;
    let response;

    try {
      response = await client.chat.completions.create(
        {
          model: modelsToTry[i],
          messages: requestMessages,
          max_tokens: 8192,
        },
        { timeout: 240000, maxRetries: 1 }
      );
    } catch (err: unknown) {
      if ((err as { status?: number })?.status === 429 && !isLast) {
        lastReason = `${modelsToTry[i]} was rate limited`;
        continue;
      }
      throw err;
    }

    const raw = response.choices[0]?.message?.content || "";
    const points = raw.trim() ? parsePoints(raw) : null;
    if (points) return points;

    lastReason = raw.trim()
      ? `${modelsToTry[i]} returned text that was not valid JSON`
      : `${modelsToTry[i]} returned an empty response`;
  }

  throw new DigestGenerationError(lastReason, modelsToTry.length);
}

export async function explainCurrentAffairsPoint(
  point: string,
  staticLink?: string,
  model?: string
): Promise<string> {
  const system = `${SSC_SYSTEM_PROMPT}

## Background Explanation Task
The student tapped a current-affairs point and wants the information and past details behind it. Write a compact study explanation in markdown with exactly these headings:

### What happened
Two or three simple sentences restating the point in plain language.

### Background and past details
Bullet points covering the history behind it: earlier related events, how the topic developed, and key dates, names or numbers ONLY where you are confident they are correct. If you are not sure about something, say so instead of guessing.

### Static GK to revise
Bullet points of stable facts linked to this point (full forms, headquarters, years founded, members, article numbers, and similar). ${staticLink ? `A suggested link: ${staticLink}.` : ""}

### Possible SSC questions
Two or three one-line question angles SSC could ask from this.

Rules: stay under about 350 words; do not invent facts, figures or dates; you do not have access to today's news, so treat the point text as the only source for the new development and note that background comes from general knowledge and should be checked.`;

  return chat(
    [
      { role: "system", content: system },
      { role: "user", content: `Current affairs point: "${point}"` },
    ],
    { maxTokens: 2000, model }
  );
}
