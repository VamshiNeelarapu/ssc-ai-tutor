/** @jest-environment node */
import { renderToStaticMarkup } from "react-dom/server";

// react-markdown is ESM-only; the practice view does not use it
jest.mock("react-markdown", () => ({ __esModule: true, default: () => null }));
jest.mock("remark-gfm", () => ({ __esModule: true, default: () => null }));

import { ImportedPrint, type ImportedNote } from "@/app/(print)/notes/[id]/print/ImportedPrint";

type Questions = NonNullable<ImportedNote["content"]["practiceQuestions"]>;
const note = (questions: Questions): ImportedNote => ({
  title: "Prehistory",
  content: { markdown: "# Prehistory\nBody", practiceQuestions: questions },
});

describe("practice questions PDF", () => {
  const html = renderToStaticMarkup(
    <ImportedPrint
      mode="practice"
      note={note([
        { question: "First?", options: ["a", "b", "c", "d"], correctOptionIndex: 1, answerSource: "pasted" },
        { question: "Second?", options: ["a", "b"], correctOptionIndex: 0, explanation: "Because.", answerSource: "ai" },
        { question: "Third?", options: ["a", "b"], answerSource: "none" },
      ])}
    />
  );

  it("lists every question with lettered options and no answers marked", () => {
    expect(html).toContain("1. First?");
    expect(html).toContain("3. Third?");
    expect(html).not.toContain("✓");
  });

  it("ends with a Solutions section giving the option for each question number", () => {
    const solutions = html.slice(html.indexOf('class="solutions"'));
    expect(html.indexOf("Third?")).toBeLessThan(html.indexOf("Solutions"));
    expect(solutions).toContain("<h2>Solutions</h2>");
    expect(solutions).toMatch(/1\.<b>B<\/b>/);
    expect(solutions).toMatch(/2\.<b>A<\/b>/);
    expect(solutions).toMatch(/3\.<b>—<\/b>/);
  });

  it("flags missing and AI-made answers and adds explanations", () => {
    expect(html).toContain("1 question has no answer yet");
    expect(html).toContain("worked out by AI");
    expect(html).toContain("Explanations");
    expect(html).toContain("Because.");
  });

  it("starts the solutions on a new page", () => {
    expect(html).toContain("page-break-before: always");
  });
});
