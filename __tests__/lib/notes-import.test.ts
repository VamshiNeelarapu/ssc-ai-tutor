import { parseAnswerKey, parseNotesDocument } from "@/lib/notes-import";

// Shaped like the pasted guide: escaped numbering, image links, a table whose rows were joined
// onto one line, a quiz copied from a web page, and a revision sheet inside the notes.
const SAMPLE = `### Prehistory and Archaeological Evidence — Complete SSC CGL Guide
History • General Awareness • Exam-oriented master notes
### 1\\. Prehistory: basic concepts
### 1.1 What is prehistory?
Prehistory is the period before written records.
* Prehistory: No decipherable written records.
* History: Interpretable written records.
![A hand axe](https://example.com/handaxe.jpg)
### 1.3 Archaeological terminology
| Term | Meaning || ------------- | ------------------ || Archaeology | Study of past societies || Artefact | An object made or modified by humans |
SSC exam tip: Do not confuse a petroglyph with a pictograph.
### 2\\. Chronological sequence
Palaeolithic Age
Old Stone Age • Hunting and gathering
Mesolithic Age
Middle Stone Age • Microliths
### 15\\. SSC CGL practice MCQs
Attempt these before checking the answer key.
### 30-question test
1/3 answered
Choose one answer per question. Submit to see your score and explanations.
1. Which tool is most strongly associated with Acheulean technology?
A. Microlith
B. Biface handaxe
C. Iron ploughshare
D. Copper axe
2. Microliths are characteristic of which phase?
A. Lower Palaeolithic
B. Mesolithic
C. Iron Age
D. Historical period only
3. Burzahom is located in which region?
A. Rajasthan
B. Kashmir
C. Maharashtra
D. Bihar
Submit answers
### 16\\. One-page rapid revision sheet
Save this section separately for last-day revision.
### Prehistory — 60-second revision
Chronology
Palaeolithic → Mesolithic → Neolithic → Chalcolithic → Iron Age
Tool associations
* Lower Palaeolithic → handaxes, cleavers
* Mesolithic → microliths
* Neolithic → polished stone tools
* Chalcolithic → copper + stone
Must-remember sites
* Bhimbetka → rock shelters and paintings
* Burzahom → pit dwellings
### 17\\. Memory tricks
Tool sequence: H–F–B–M–P–C`;

describe("parseNotesDocument: repairing the paste", () => {
  const parsed = parseNotesDocument(SAMPLE);

  it("takes the title from the first heading", () => {
    expect(parsed.title).toBe("Prehistory and Archaeological Evidence — Complete SSC CGL Guide");
  });

  it("removes escapes and gives numbered headings a clean outline", () => {
    expect(parsed.fullMarkdown).toContain("## 1. Prehistory: basic concepts");
    expect(parsed.fullMarkdown).toContain("### 1.1 What is prehistory?");
    expect(parsed.fullMarkdown).not.toContain("\\.");
  });

  it("drops image links and counts them", () => {
    expect(parsed.fullMarkdown).not.toContain("![");
    expect(parsed.stats.imagesRemoved).toBe(1);
  });

  it("rebuilds a table whose rows were joined onto one line", () => {
    expect(parsed.fullMarkdown).toContain("| Term | Meaning |");
    expect(parsed.fullMarkdown).toMatch(/\|\s*-{3,}\s*\|\s*-{3,}\s*\|/);
    expect(parsed.fullMarkdown).toContain("| Archaeology | Study of past societies |");
    expect(parsed.fullMarkdown).toContain("| Artefact | An object made or modified by humans |");
    expect(parsed.stats.tables).toBe(1);
  });

  it("keeps every line of the notes, with line breaks preserved", () => {
    expect(parsed.fullMarkdown).toContain("Palaeolithic Age  \nOld Stone Age • Hunting and gathering");
    expect(parsed.fullMarkdown).toContain("SSC exam tip: Do not confuse a petroglyph with a pictograph.");
    expect(parsed.fullMarkdown).toContain("Tool sequence: H–F–B–M–P–C");
    expect(parsed.fullMarkdown).toContain("## 17. Memory tricks");
  });
});

describe("parseNotesDocument: practice questions", () => {
  const parsed = parseNotesDocument(SAMPLE);

  it("lifts the questions out with their options", () => {
    expect(parsed.questions).toHaveLength(3);
    expect(parsed.questions[0].question).toBe("Which tool is most strongly associated with Acheulean technology?");
    expect(parsed.questions[0].options).toEqual(["Microlith", "Biface handaxe", "Iron ploughshare", "Copper axe"]);
    expect(parsed.questions[2].options[1]).toBe("Kashmir");
  });

  it("has no answers when the paste carries none", () => {
    expect(parsed.questions.every((q) => q.answerIndex === undefined)).toBe(true);
  });

  it("removes the whole quiz section and its web-page leftovers from the notes", () => {
    expect(parsed.fullMarkdown).not.toContain("Which tool is most strongly");
    expect(parsed.fullMarkdown).not.toContain("Submit answers");
    expect(parsed.fullMarkdown).not.toContain("answered");
    expect(parsed.fullMarkdown).not.toContain("practice MCQs");
  });

  it("keeps the line that introduced the questions", () => {
    expect(parsed.practiceNote).toBe("Attempt these before checking the answer key.");
  });
});

describe("parseNotesDocument: revision sheet", () => {
  it("moves a revision section out of the notes", () => {
    const parsed = parseNotesDocument(SAMPLE);
    expect(parsed.revision?.heading).toBe("One-page rapid revision sheet");
    expect(parsed.revision?.markdown).toContain("Bhimbetka → rock shelters and paintings");
    expect(parsed.revision?.markdown).toContain("### Prehistory — 60-second revision");
    expect(parsed.fullMarkdown).not.toContain("rapid revision sheet");
    expect(parsed.fullMarkdown).not.toContain("Bhimbetka → rock shelters");
    // the next section is untouched
    expect(parsed.fullMarkdown).toContain("Memory tricks");
  });

  it("leaves the revision section in the notes when asked", () => {
    const parsed = parseNotesDocument(SAMPLE, { extractRevision: false });
    expect(parsed.revision).toBeNull();
    expect(parsed.fullMarkdown).toContain("Bhimbetka → rock shelters and paintings");
  });
});

describe("parseNotesDocument: answers that come with the questions", () => {
  it("reads 'Answer:' and 'Explanation:' lines", () => {
    const doc = `# Test notes
Some real content here that is long enough to matter for the notes themselves.
## Practice questions
1. Capital of India?
A. Mumbai
B. New Delhi
Answer: B
Explanation: New Delhi is the capital.
2. Largest planet?
A. Mars
B. Venus
C. Jupiter
Answer: C`;
    const parsed = parseNotesDocument(doc);
    expect(parsed.questions).toHaveLength(2);
    expect(parsed.questions[0].answerIndex).toBe(1);
    expect(parsed.questions[0].explanation).toBe("New Delhi is the capital.");
    expect(parsed.questions[1].answerIndex).toBe(2);
    expect(parsed.fullMarkdown).not.toContain("Capital of India");
  });

  it("reads an answer key section after the questions", () => {
    const doc = `# Test notes
Some real content here that is long enough to matter for the notes themselves.
## Practice questions
1. Capital of India?
A. Mumbai
B. New Delhi
2. Largest planet?
A. Mars
B. Venus
C. Jupiter
## Answer key
1-B, 2-C
## Last section
Kept.`;
    const parsed = parseNotesDocument(doc);
    expect(parsed.questions.map((q) => q.answerIndex)).toEqual([1, 2]);
    expect(parsed.fullMarkdown).not.toContain("Answer key");
    expect(parsed.fullMarkdown).toContain("## Last section");
  });
});

describe("parseAnswerKey", () => {
  it("understands common key formats", () => {
    expect(parseAnswerKey("1-B, 2. C, 3) d", 3)).toEqual({ 1: 1, 2: 2, 3: 3 });
    expect(parseAnswerKey("Q1: A\nQ2: D\nQ3 (b)", 3)).toEqual({ 1: 0, 2: 3, 3: 1 });
  });

  it("ignores numbers beyond the question count", () => {
    expect(parseAnswerKey("1-A 9-B", 2)).toEqual({ 1: 0 });
  });

  it("understands Q-style keys", () => {
    expect(parseAnswerKey("Q1-B, Q2) C, Q3. A", 3)).toEqual({ 1: 1, 2: 2, 3: 0 });
  });
});

describe("parseNotesDocument: question numbering styles", () => {
  const body = "Some real content here that is long enough to matter for the notes themselves.";
  const options = (a: string, b: string) => `A. ${a}\nB. ${b}`;

  it("reads Q1., Q2., Q3. numbering", () => {
    const parsed = parseNotesDocument(`# Notes\n${body}\n## Practice\nQ1. First?\n${options("x", "y")}\nQ2. Second?\n${options("x", "y")}\nQ3. Third?\n${options("x", "y")}`);
    expect(parsed.questions.map((q) => q.question)).toEqual(["First?", "Second?", "Third?"]);
    expect(parsed.fullMarkdown).not.toContain("First?");
  });

  it("reads Q1), Q 2:, Question 3 - and lower-case q4 forms", () => {
    const parsed = parseNotesDocument(
      `# Notes\n${body}\n## Practice\nQ1) First?\n${options("x", "y")}\nQ 2: Second?\n${options("x", "y")}\nQuestion 3 - Third?\n${options("x", "y")}\nq4 Fourth?\n${options("x", "y")}`
    );
    expect(parsed.questions.map((q) => q.question)).toEqual(["First?", "Second?", "Third?", "Fourth?"]);
  });

  it("reads 1) numbering too", () => {
    const parsed = parseNotesDocument(`# Notes\n${body}\n## Practice\n1) First?\n${options("x", "y")}\n2) Second?\n${options("x", "y")}`);
    expect(parsed.questions).toHaveLength(2);
  });

  it("reads Q-style questions with answers and explanations", () => {
    const parsed = parseNotesDocument(
      `# Notes\n${body}\n## Practice\nQ1. First?\nA. x\nB. y\nAnswer: B\nExplanation: because.\nQ2. Second?\nA. x\nB. y\nAnswer: A`
    );
    expect(parsed.questions.map((q) => q.answerIndex)).toEqual([1, 0]);
    expect(parsed.questions[0].explanation).toBe("because.");
  });

  it("reads an answer key written with Q numbers", () => {
    const parsed = parseNotesDocument(
      `# Notes\n${body}\n## Practice\nQ1. First?\nA. x\nB. y\nQ2. Second?\nA. x\nB. y\n## Answer key\nQ1-B, Q2-A`
    );
    expect(parsed.questions.map((q) => q.answerIndex)).toEqual([1, 0]);
  });

  it("does not take a decimal or a number inside notes for a question", () => {
    const parsed = parseNotesDocument(
      `# Notes\n${body}\n1.5 km is the distance covered in the first hour of the trip.\n2024 results were announced in March.\n## Practice\nQ1. Real question?\n${options("x", "y")}\nQ2. Another?\n${options("x", "y")}`
    );
    expect(parsed.questions).toHaveLength(2);
    expect(parsed.fullMarkdown).toContain("1.5 km is the distance");
    expect(parsed.fullMarkdown).toContain("2024 results");
  });
});
