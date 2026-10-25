export interface Flashcard {
  front: string;
  back: string;
  topic?: string;
  tag?: string;
}

export const FLASHCARD_TAGS = ["formula", "fact", "rule", "definition", "trap", "shortcut"] as const;

// A topic set is one topic on its own. A chapter set holds a block of cards for every topic.
export const FLASHCARD_TARGETS = {
  topic: { min: 20, max: 30 },
  chapterPerTopic: { min: 10, max: 15 },
} as const;

// Fewer than this is treated as a failed generation
export const MIN_FLASHCARDS = 5;

const MAX_FRONT_CHARS = 300;
const MAX_BACK_CHARS = 700;

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Turns the AI's raw cards into the cards we store: trims text, drops empty or duplicate
 * cards, keeps only a topic that really is in the chapter and a tag we know, and caps the count.
 */
export function cleanFlashcards(raw: unknown[], topicNames: string[], max: number = Number.POSITIVE_INFINITY): Flashcard[] {
  const topicByKey = new Map(topicNames.map((t) => [normalize(t), t]));
  const seen = new Set<string>();
  const cards: Flashcard[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    const front = typeof c.front === "string" ? c.front.trim().slice(0, MAX_FRONT_CHARS) : "";
    const back = typeof c.back === "string" ? c.back.trim().slice(0, MAX_BACK_CHARS) : "";
    if (!front || !back) continue;

    const key = normalize(front);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const topic = typeof c.topic === "string" ? topicByKey.get(normalize(c.topic)) : undefined;
    const tagRaw = typeof c.tag === "string" ? c.tag.trim().toLowerCase() : "";
    const tag = (FLASHCARD_TAGS as readonly string[]).includes(tagRaw) ? tagRaw : undefined;

    cards.push({ front, back, ...(topic ? { topic } : {}), ...(tag ? { tag } : {}) });
    if (cards.length >= max) break;
  }
  return cards;
}

export function tagLabel(tag: string): string {
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}

/** Plain-text version of the cards, laid out the way they appear on screen (numbered, Q then A). */
export function flashcardsToText(title: string, cards: Flashcard[]): string {
  const lines: string[] = [title, `${cards.length} card${cards.length === 1 ? "" : "s"}`, ""];
  cards.forEach((card, i) => {
    const labels = [card.topic, card.tag ? tagLabel(card.tag) : ""].filter(Boolean).map((l) => `[${l}]`);
    lines.push(`${i + 1}.${labels.length ? " " + labels.join(" ") : ""}`);
    lines.push(`Q: ${card.front}`);
    lines.push(`A: ${card.back}`);
    lines.push("");
  });
  return lines.join("\n").trimEnd() + "\n";
}

/** Fisher-Yates on a copy, so the stored order is never changed. */
export function shuffled<T>(items: T[], random: () => number = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
