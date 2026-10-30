"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export type ImportedPrintMode = "full" | "revision" | "practice";

interface Question {
  question: string;
  options: string[];
  correctOptionIndex?: number;
  explanation?: string;
  answerSource?: "pasted" | "ai" | "none";
}

export interface ImportedNote {
  title: string;
  content: {
    markdown?: string;
    quickRevisionMarkdown?: string;
    practiceNote?: string;
    practiceQuestions?: Question[];
  };
}

const STYLES = `
  .md h1 { font-size: 1.6rem; margin: 0 0 12px; }
  .md h2 { font-family: Georgia, serif; font-size: 1.25rem; font-weight: bold; text-transform: none; letter-spacing: 0; color: #111; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; margin: 28px 0 12px; }
  .md h3 { font-size: 1.05rem; font-weight: bold; margin: 20px 0 8px; font-family: Georgia, serif; text-transform: none; letter-spacing: 0; color: #111; border: 0; padding: 0; }
  .md h4, .md h5, .md h6 { font-size: 0.95rem; font-weight: bold; margin: 14px 0 6px; }
  .md p { margin-bottom: 10px; }
  .md ul { list-style: disc; padding-left: 22px; margin-bottom: 10px; }
  .md ol { list-style: decimal; padding-left: 22px; margin-bottom: 10px; }
  .md li { padding: 2px 0; }
  .md li::before { content: none; }
  .md table { width: 100%; border-collapse: collapse; margin: 12px 0 16px; font-size: 0.9em; page-break-inside: auto; }
  .md th, .md td { border: 1px solid #9ca3af; padding: 5px 8px; text-align: left; vertical-align: top; }
  .md th { background: #e5e7eb; }
  .md tr { page-break-inside: avoid; }
  .md strong { font-weight: bold; }
  .q { border: 1px solid #d1d5db; border-radius: 6px; padding: 12px 14px; margin-bottom: 10px; page-break-inside: avoid; }
  .q-text { font-weight: bold; margin-bottom: 6px; }
  .q-opt { padding: 2px 0 2px 22px; position: relative; }
  .q-opt b { position: absolute; left: 0; font-weight: normal; color: #6b7280; }
  .solutions { page-break-before: always; }
  .sol-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px 14px; margin: 8px 0 18px; font-family: system-ui, sans-serif; font-size: 14px; }
  .sol-grid div { border: 1px solid #d1d5db; border-radius: 4px; padding: 5px 8px; }
  .sol-grid b { margin-left: 4px; }
  .sol-expl { font-size: 12px; color: #374151; margin: 0 0 8px; padding-left: 4px; page-break-inside: avoid; }
  .sol-note { font-family: system-ui, sans-serif; font-size: 12px; color: #6b7280; margin-top: 6px; }
`;

const letter = (i: number) => String.fromCharCode(65 + i);

export function ImportedPrint({ note, mode }: { note: ImportedNote; mode: ImportedPrintMode }) {
  const { content } = note;
  // The page header already shows the title, so drop the notes' own first heading
  const withoutTitle = (md?: string) => (md ?? "").replace(/^# .*\n+/, "");

  if (mode === "practice") {
    const questions = content.practiceQuestions ?? [];
    const noAnswer = questions.filter((q) => q.correctOptionIndex === undefined).length;
    const aiAnswers = questions.some((q) => q.answerSource === "ai");
    const explained = questions.map((q, i) => ({ q, n: i + 1 })).filter(({ q }) => q.explanation && q.correctOptionIndex !== undefined);

    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: STYLES }} />
        {content.practiceNote && <p>{content.practiceNote}</p>}
        {questions.length === 0 && <p>This note has no practice questions.</p>}
        {questions.map((q, i) => (
          <div key={i} className="q">
            <div className="q-text">
              {i + 1}. {q.question}
            </div>
            {q.options.map((o, j) => (
              <div key={j} className="q-opt">
                <b>{letter(j)}.</b>
                {o}
              </div>
            ))}
          </div>
        ))}

        {questions.length > 0 && (
          <div className="solutions">
            <h2>Solutions</h2>
            <div className="sol-grid">
              {questions.map((q, i) => (
                <div key={i}>
                  {i + 1}.<b>{q.correctOptionIndex !== undefined ? letter(q.correctOptionIndex) : "—"}</b>
                </div>
              ))}
            </div>
            {noAnswer > 0 && (
              <p className="sol-note">
                {noAnswer} question{noAnswer === 1 ? " has" : "s have"} no answer yet (shown as —).
              </p>
            )}
            {aiAnswers && <p className="sol-note">Some answers were worked out by AI from your notes. Please check them.</p>}

            {explained.length > 0 && (
              <>
                <h2>Explanations</h2>
                {explained.map(({ q, n }) => (
                  <p key={n} className="sol-expl">
                    <strong>
                      {n}. {letter(q.correctOptionIndex as number)}
                    </strong>{" "}
                    {q.explanation}
                  </p>
                ))}
              </>
            )}
          </div>
        )}
      </>
    );
  }

  const markdown = mode === "revision" ? content.quickRevisionMarkdown : withoutTitle(content.markdown);
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <div className="md">
        {markdown ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        ) : (
          <p>There is no quick revision for this note yet. Make one from the note page first.</p>
        )}
      </div>
    </>
  );
}
