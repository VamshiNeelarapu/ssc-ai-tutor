import { cleanFlashcards, flashcardsToText, shuffled } from "@/lib/flashcards";

describe("cleanFlashcards", () => {
  const topics = ["Successive percentage change", "Population"];

  it("keeps good cards and trims text", () => {
    const cards = cleanFlashcards(
      [{ front: "  Formula?  ", back: " a + b + ab/100 ", topic: "successive percentage change", tag: "Formula" }],
      topics
    );
    expect(cards).toEqual([
      { front: "Formula?", back: "a + b + ab/100", topic: "Successive percentage change", tag: "formula" },
    ]);
  });

  it("drops empty, malformed and duplicate cards", () => {
    const cards = cleanFlashcards(
      [
        { front: "Q1?", back: "A1" },
        { front: "q1", back: "again" },
        { front: "", back: "no question" },
        { front: "No answer?", back: "  " },
        null,
        "text",
        { front: "Q2?", back: "A2" },
      ],
      topics
    );
    expect(cards.map((c) => c.front)).toEqual(["Q1?", "Q2?"]);
  });

  it("ignores an unknown topic or tag", () => {
    const [card] = cleanFlashcards([{ front: "Q?", back: "A", topic: "Made up", tag: "weird" }], topics);
    expect(card.topic).toBeUndefined();
    expect(card.tag).toBeUndefined();
  });

  it("caps the number of cards", () => {
    const raw = Array.from({ length: 50 }, (_, i) => ({ front: `Q${i}`, back: "A" }));
    expect(cleanFlashcards(raw, topics, 30)).toHaveLength(30);
    expect(cleanFlashcards(raw, topics)).toHaveLength(50);
  });
});

describe("flashcardsToText", () => {
  it("lays cards out numbered with Q and A lines", () => {
    const text = flashcardsToText("Percentage - Recall & Flashcards", [
      { front: "Formula?", back: "a + b + ab/100", topic: "Successive change", tag: "formula" },
      { front: "Second?", back: "Yes" },
    ]);
    expect(text).toBe(
      [
        "Percentage - Recall & Flashcards",
        "2 cards",
        "",
        "1. [Successive change] [Formula]",
        "Q: Formula?",
        "A: a + b + ab/100",
        "",
        "2.",
        "Q: Second?",
        "A: Yes",
        "",
      ].join("\n")
    );
  });
});

describe("shuffled", () => {
  it("returns the same items without changing the input", () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffled(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
