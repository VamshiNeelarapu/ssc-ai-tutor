import { generateFlashcards, type ChapterTopicNotes } from "@/lib/ai";
import { cleanFlashcards, FLASHCARD_TARGETS, type Flashcard } from "@/lib/flashcards";

const CHAPTER_CONCURRENCY = 3;

interface Range {
  min: number;
  max: number;
}

/** Cards for one topic. Asks a second time when the first answer is short of the minimum. */
async function buildTopicCards(
  entry: ChapterTopicNotes,
  parent: string | undefined,
  range: Range,
  model?: string
): Promise<Flashcard[]> {
  const tagTopic = (raw: unknown[]) =>
    raw.map((c) => (c && typeof c === "object" ? { ...(c as object), topic: entry.topic } : c));

  const first = await generateFlashcards({ entry, parent, ...range, model });
  let cards = cleanFlashcards(tagTopic(first), [entry.topic], range.max);

  if (cards.length < range.min) {
    try {
      const second = await generateFlashcards({ entry, parent, ...range, model });
      cards = cleanFlashcards(tagTopic([...first, ...second]), [entry.topic], range.max);
    } catch (err) {
      console.warn(`Flashcards: second attempt for "${entry.topic}" failed, keeping ${cards.length} cards`, err);
    }
  }
  return cards;
}

export interface BuiltFlashcards {
  cards: Flashcard[];
  // Topics whose notes did not give enough distinct points to reach the minimum
  shortTopics: string[];
}

/** One set for a single topic: 20 to 30 cards. */
export async function buildTopicFlashcards(
  entry: ChapterTopicNotes,
  parent: string | undefined,
  model?: string
): Promise<BuiltFlashcards> {
  const range = FLASHCARD_TARGETS.topic;
  const cards = await buildTopicCards(entry, parent, range, model);
  return { cards, shortTopics: cards.length < range.min ? [entry.topic] : [] };
}

/** One set for a chapter: a block of 10 to 15 cards for EVERY topic, in syllabus order. */
export async function buildChapterFlashcards(
  entries: ChapterTopicNotes[],
  parent: string | undefined,
  model?: string
): Promise<BuiltFlashcards> {
  const range = FLASHCARD_TARGETS.chapterPerTopic;
  const results: Flashcard[][] = new Array(entries.length);

  // A few topics at a time: faster than one by one, without flooding the provider
  let next = 0;
  const worker = async () => {
    while (next < entries.length) {
      const i = next++;
      results[i] = await buildTopicCards(entries[i], parent, range, model);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CHAPTER_CONCURRENCY, entries.length) }, worker));

  const shortTopics = entries.filter((_, i) => results[i].length < range.min).map((e) => e.topic);
  // A final pass drops a card whose question repeats one from another topic
  const cards = cleanFlashcards(results.flat(), entries.map((e) => e.topic));
  return { cards, shortTopics };
}
