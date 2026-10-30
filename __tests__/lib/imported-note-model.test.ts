/** @jest-environment node */
import StudyNote from "@/models/StudyNote";
import { parseNotesDocument } from "@/lib/notes-import";

describe("a note made from pasted content", () => {
  const parsed = parseNotesDocument(`# Sample notes
Some content that is long enough to count as the real body of the notes.
## 1. Part one
* A point
## 2. Practice
1. First question?
A. One
B. Two
Answer: B
2. Second question?
A. Red
B. Blue`);

  it("fits the StudyNote schema and keeps every field", () => {
    const doc = new StudyNote({
      userId: "u1",
      title: parsed.title,
      content: {
        markdown: parsed.fullMarkdown,
        quickRevisionMarkdown: "- a short point",
        practiceNote: "Try these first.",
        practiceQuestions: parsed.questions.map((q) => ({
          question: q.question,
          options: q.options,
          ...(q.answerIndex !== undefined ? { correctOptionIndex: q.answerIndex } : {}),
          answerSource: q.answerIndex !== undefined ? "pasted" : "none",
        })),
      },
    });

    expect(doc.validateSync()).toBeUndefined();
    const content = doc.toObject().content as { markdown?: string; quickRevisionMarkdown?: string; practiceQuestions: Array<{ correctOptionIndex?: number; answerSource: string }> };
    expect(content.markdown).toContain("A point");
    expect(content.quickRevisionMarkdown).toBe("- a short point");
    expect(content.practiceQuestions).toHaveLength(2);
    expect(content.practiceQuestions[0].correctOptionIndex).toBe(1);
    expect(content.practiceQuestions[1].correctOptionIndex).toBeUndefined();
    expect(content.practiceQuestions[1].answerSource).toBe("none");
  });

  it("rejects a bad answer source", () => {
    const doc = new StudyNote({
      userId: "u1",
      title: "x",
      content: { practiceQuestions: [{ question: "q", options: ["a", "b"], answerSource: "guess" }] },
    });
    expect(doc.validateSync()?.message).toMatch(/answerSource/);
  });
});
