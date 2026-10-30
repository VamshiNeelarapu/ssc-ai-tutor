import { planReplacement, type ExistingContent } from "@/lib/notes-import";

const existing: ExistingContent = {
  markdown: "# Old title\nOld body",
  quickRevisionMarkdown: "- old revision",
  practiceNote: "Old intro.",
  practiceQuestions: [
    { question: "Capital of India?", options: ["Mumbai", "New Delhi"], correctOptionIndex: 1, explanation: "Seat of government.", answerSource: "ai" },
    { question: "Largest planet?", options: ["Mars", "Jupiter"], answerSource: "none" },
  ],
};

const NEW_TEXT = `# New notes
This is the corrected body of the notes, with the missing information added back in.
## 1. Added section
* A new point
## 2. Practice
Try these.
1. Capital of India?
A. New Delhi
B. Mumbai
2. Smallest planet?
A. Mercury
B. Jupiter
Answer: A
## 3. Quick revision sheet
- Short point one that is useful for last-day revision of the whole chapter
- Short point two that is useful for last-day revision of the whole chapter
- Short point three that is useful for last-day revision of the whole chapter`;

const all = { full: true, revision: true, mcq: true, mcqMode: "replace" as const };

describe("planReplacement: choosing parts", () => {
  it("needs at least one part chosen", () => {
    const plan = planReplacement(existing, NEW_TEXT, { ...all, full: false, revision: false, mcq: false });
    expect(plan).toEqual({ ok: false, error: "Choose at least one part to replace." });
  });

  it("replaces only the full notes and leaves the rest untouched", () => {
    const plan = planReplacement(existing, NEW_TEXT, { full: true, revision: false, mcq: false, mcqMode: "replace" });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.content.markdown).toContain("A new point");
    expect(plan.content.markdown).toContain("Quick revision sheet"); // not chosen, so it stays in the notes
    expect(plan.content.quickRevisionMarkdown).toBe("- old revision");
    expect(plan.content.practiceQuestions).toEqual(existing.practiceQuestions);
    expect(plan.lines.join(" ")).toMatch(/2 practice questions in your text were not used/);
  });

  it("replaces all three from one text", () => {
    const plan = planReplacement(existing, NEW_TEXT, all);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.content.markdown).toContain("A new point");
    expect(plan.content.markdown).not.toContain("Quick revision sheet");
    expect(plan.content.quickRevisionMarkdown).toContain("Short point two");
    expect(plan.content.practiceQuestions).toHaveLength(2);
    expect(plan.content.practiceNote).toBe("Try these.");
  });

  it("replaces any two, for example revision and questions", () => {
    const plan = planReplacement(existing, NEW_TEXT, { full: false, revision: true, mcq: true, mcqMode: "replace" });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.content.markdown).toBe(existing.markdown);
    expect(plan.content.quickRevisionMarkdown).toContain("Short point one");
    expect(plan.content.practiceQuestions?.[1].question).toBe("Smallest planet?");
  });

  it("uses the whole text as the revision when only revision is chosen", () => {
    const plan = planReplacement(existing, "Chronology\nA → B → C\n* tool one\n* tool two", {
      full: false,
      revision: true,
      mcq: false,
      mcqMode: "replace",
    });
    expect(plan.ok).toBe(true);
    if (plan.ok) expect(plan.content.quickRevisionMarkdown).toContain("tool two");
  });

  it("explains when a chosen part is not in the text", () => {
    const noRevision = planReplacement(existing, "# Notes\nBody text that is long enough.\n## Part\n* point", {
      full: true,
      revision: true,
      mcq: false,
      mcqMode: "replace",
    });
    expect(noRevision.ok).toBe(false);
    if (!noRevision.ok) expect(noRevision.error).toMatch(/No revision section/);

    const noQuestions = planReplacement(existing, "# Notes\nBody text that is long enough.", {
      full: false,
      revision: false,
      mcq: true,
      mcqMode: "replace",
    });
    expect(noQuestions.ok).toBe(false);
    if (!noQuestions.ok) expect(noQuestions.error).toMatch(/No practice questions/);
  });
});

describe("planReplacement: practice questions", () => {
  const mcqOnly = { full: false, revision: false, mcq: true } as const;

  it("replace completely: swaps the questions and keeps the earlier answer of an unchanged one", () => {
    const plan = planReplacement(existing, NEW_TEXT, { ...mcqOnly, mcqMode: "replace" });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const qs = plan.content.practiceQuestions!;
    expect(qs).toHaveLength(2);
    // "Capital of India?" came back with its options reordered: the right answer follows its text
    expect(qs[0].options[qs[0].correctOptionIndex!]).toBe("New Delhi");
    expect(qs[0].explanation).toBe("Seat of government.");
    expect(qs[0].answerSource).toBe("ai");
    // the new one carries its own pasted answer
    expect(qs[1].correctOptionIndex).toBe(0);
    expect(qs[1].answerSource).toBe("pasted");
  });

  it("add: keeps the old questions, appends new ones and skips duplicates", () => {
    const plan = planReplacement(existing, NEW_TEXT, { ...mcqOnly, mcqMode: "add" });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const qs = plan.content.practiceQuestions!;
    expect(qs.map((q) => q.question)).toEqual(["Capital of India?", "Largest planet?", "Smallest planet?"]);
    expect(qs[0]).toEqual(existing.practiceQuestions![0]);
    expect(plan.content.practiceNote).toBe("Old intro.");
    expect(plan.lines.join(" ")).toMatch(/Added 1 practice question.*after the existing 2.*1 already there/);
  });

  it("add: says so when every question is already there", () => {
    const text = "1. Capital of India?\nA. Mumbai\nB. New Delhi\n2. Largest planet?\nA. Mars\nB. Jupiter";
    const plan = planReplacement(existing, text, { ...mcqOnly, mcqMode: "add" });
    expect(plan.ok).toBe(false);
  });

  it("applies an answer key to the new questions, numbered from 1", () => {
    const text = "1. First new?\nA. x\nB. y\n2. Second new?\nA. x\nB. y";
    const plan = planReplacement(existing, text, { ...mcqOnly, mcqMode: "add", answerKey: "1-B, 2-A" });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const qs = plan.content.practiceQuestions!;
    expect(qs).toHaveLength(4);
    expect(qs[2].correctOptionIndex).toBe(1);
    expect(qs[3].correctOptionIndex).toBe(0);
  });
});
