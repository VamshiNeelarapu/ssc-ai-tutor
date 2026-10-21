"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { examLabel } from "@/lib/exam";

interface NoteContent {
  overview?: string;
  coreConcepts: Array<{ heading: string; body: string }>;
  keyFacts: string[];
  shortcuts: string[];
  revisionTips: string[];
  commonConfusions: string[];
  mcqs: Array<{
    question: string;
    options: string[];
    correctOptionIndex: number;
    explanation: string;
  }>;
  workedExamples: Array<{
    question: string;
    approach?: string;
    steps?: string[];
  }>;
  references: Array<{
    title: string;
    publisher?: string;
    url?: string;
    verificationStatus: string;
  }>;
}

interface NoteData {
  title: string;
  examRelevance: string[];
  content: NoteContent;
}

const PRINT_STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: white; color: #111; font-family: Georgia, 'Times New Roman', serif; font-size: 14px; line-height: 1.65; }
  .no-print { display: block; }
  @page { margin: 1.8cm 2cm; }
  @media print {
    .no-print { display: none !important; }
    body { font-size: 11pt; }
  }
  .controls {
    position: sticky; top: 0; z-index: 10;
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    background: #f3f4f6; border-bottom: 1px solid #d1d5db;
    padding: 10px 32px;
  }
  .controls-label { font-family: system-ui, sans-serif; font-size: 13px; color: #374151; flex: 1; min-width: 0; }
  .btn {
    font-family: system-ui, sans-serif; font-size: 13px; font-weight: 500;
    padding: 6px 16px; border-radius: 6px; border: 1px solid #9ca3af;
    background: white; cursor: pointer; white-space: nowrap;
  }
  .btn:hover { background: #f9fafb; }
  .btn-primary { background: #1e293b; color: white; border-color: #1e293b; }
  .btn-primary:hover { background: #0f172a; }
  .page { max-width: 780px; margin: 0 auto; padding: 40px 32px 80px; }
  .doc-header { border-bottom: 2px solid #111; padding-bottom: 16px; margin-bottom: 28px; }
  .doc-title { font-size: 2rem; font-weight: bold; line-height: 1.2; margin-bottom: 6px; }
  .doc-meta { font-family: system-ui, sans-serif; font-size: 12px; color: #6b7280; letter-spacing: 0.02em; }
  .doc-meta span + span::before { content: ' · '; }
  h2 {
    font-family: system-ui, sans-serif; font-size: 11px; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase; color: #6b7280;
    border-bottom: 1px solid #e5e7eb; padding-bottom: 6px;
    margin: 32px 0 14px;
  }
  h2:first-of-type { margin-top: 0; }
  p { margin-bottom: 12px; line-height: 1.7; }
  ul { padding-left: 0; list-style: none; }
  li { padding: 4px 0 4px 20px; position: relative; line-height: 1.6; }
  li::before { content: '–'; position: absolute; left: 0; color: #9ca3af; }
  .concept { margin-bottom: 20px; }
  .concept-heading { font-size: 15px; font-weight: bold; margin-bottom: 6px; }
  .confusion-item { padding: 8px 12px 8px 32px; background: #fffbeb; border-left: 3px solid #f59e0b; margin-bottom: 6px; position: relative; line-height: 1.5; }
  .confusion-item::before { content: '!'; position: absolute; left: 10px; top: 8px; font-weight: bold; color: #d97706; }
  .mcq { border: 1px solid #e5e7eb; border-radius: 6px; padding: 14px 16px; margin-bottom: 12px; page-break-inside: avoid; }
  .mcq-q { font-weight: bold; margin-bottom: 8px; }
  .mcq-opt { padding: 3px 0 3px 20px; font-size: 13px; position: relative; }
  .mcq-opt::before { content: attr(data-letter)'.'; position: absolute; left: 0; color: #9ca3af; font-size: 12px; }
  .mcq-correct { font-weight: bold; }
  .mcq-correct::after { content: ' ✓'; color: #16a34a; }
  .mcq-answer { margin-top: 8px; padding-top: 8px; border-top: 1px dashed #d1d5db; font-size: 12px; color: #4b5563; line-height: 1.5; }
  .example-q { border-left: 3px solid #334155; padding: 12px 16px; margin-bottom: 12px; page-break-inside: avoid; }
  .example-q-text { font-weight: bold; margin-bottom: 6px; }
  .example-approach { font-family: system-ui, sans-serif; font-size: 12px; color: #6b7280; margin-bottom: 8px; }
  .example-steps { font-family: system-ui, sans-serif; font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 4px; }
  .framework-item { padding: 2px 0 2px 24px; font-size: 12px; color: #4b5563; position: relative; }
  .framework-item::before { content: attr(data-num)'.'; position: absolute; left: 0; color: #9ca3af; }
  .facts-tag, .speed-tag {
    display: inline-block; font-family: system-ui, sans-serif; font-size: 10px;
    font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
    padding: 2px 7px; border-radius: 9999px; margin-right: 6px;
  }
  .facts-tag { background: #dbeafe; color: #1d4ed8; }
  .speed-tag { background: #e0e7ff; color: #3730a3; }
  .tip-item { padding: 5px 0 5px 20px; position: relative; line-height: 1.6; }
  .tip-item::before { content: '✓'; position: absolute; left: 0; color: #16a34a; font-size: 12px; top: 6px; }
`;

export default function PrintNotePage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const mode = (searchParams.get("mode") as "full" | "revision") || "full";
  const id = params.id;

  const [note, setNote] = useState<NoteData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/notes/${id}`)
      .then((r) => {
        if (!r.ok)
          throw new Error(
            r.status === 401 ? "Please log in to view this note." : "Note not found."
          );
        return r.json();
      })
      .then(setNote)
      .catch((e: Error) => setError(e.message));
  }, [id]);

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => window.print(), 700);
    return () => clearTimeout(t);
  }, [note]);

  if (error) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />
        <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
          <p style={{ color: "#dc2626", marginBottom: "1rem" }}>{error}</p>
          <button className="btn" onClick={() => window.close()}>Close</button>
        </div>
      </>
    );
  }

  if (!note) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />
        <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif", color: "#6b7280" }}>
          Loading note…
        </div>
      </>
    );
  }

  const { content } = note;
  const modeLabel = mode === "full" ? "Full Notes" : "Quick Revision Sheet";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />

      {/* Controls bar — hidden on print */}
      <div className="controls no-print">
        <span className="controls-label">
          <strong>{note.title}</strong> — {modeLabel}
        </span>
        <button className="btn btn-primary" onClick={() => window.print()}>
          🖨 Print / Save as PDF
        </button>
        <button className="btn" onClick={() => window.close()}>
          Close
        </button>
      </div>

      <div className="page">
        {/* Document header */}
        <div className="doc-header">
          <div className="doc-title">{note.title}</div>
          <div className="doc-meta">
            <span>SSC AI Study Notes</span>
            <span>{modeLabel}</span>
            {note.examRelevance.length > 0 && (
              <span>{note.examRelevance.map((r) => examLabel(r)).join(" · ")}</span>
            )}
          </div>
        </div>

        {mode === "full" ? (
          <>
            {content.overview && (
              <>
                <h2>Overview</h2>
                {content.overview.split("\n\n").map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </>
            )}

            {content.coreConcepts.length > 0 && (
              <>
                <h2>Core Concepts</h2>
                {content.coreConcepts.map((c, i) => (
                  <div key={i} className="concept">
                    <div className="concept-heading">{c.heading}</div>
                    {c.body.split("\n\n").map((para, j) => (
                      <p key={j}>{para}</p>
                    ))}
                  </div>
                ))}
              </>
            )}

            {content.commonConfusions.length > 0 && (
              <>
                <h2>Common Confusions</h2>
                {content.commonConfusions.map((item, i) => (
                  <div key={i} className="confusion-item">{item}</div>
                ))}
              </>
            )}

            {content.references.length > 0 && (
              <>
                <h2>References</h2>
                <ul>
                  {content.references.map((ref, i) => (
                    <li key={i}>
                      {ref.title}
                      {ref.publisher ? ` — ${ref.publisher}` : ""}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        ) : (
          <>
            {content.keyFacts.length > 0 && (
              <>
                <h2>
                  <span className="facts-tag">Facts</span>Key Facts &amp; Formulas
                </h2>
                <ul>
                  {content.keyFacts.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </>
            )}

            {content.shortcuts.length > 0 && (
              <>
                <h2>
                  <span className="speed-tag">Speed</span>Shortcuts &amp; Tricks
                </h2>
                <ul>
                  {content.shortcuts.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </>
            )}

            {content.revisionTips.length > 0 && (
              <>
                <h2>Revision Tips</h2>
                <ul>
                  {content.revisionTips.map((t, i) => (
                    <li key={i} className="tip-item">{t}</li>
                  ))}
                </ul>
              </>
            )}

            {content.mcqs.length > 0 && (
              <>
                <h2>Practice MCQs</h2>
                {content.mcqs.map((mcq, i) => (
                  <div key={i} className="mcq">
                    <div className="mcq-q">Q{i + 1}. {mcq.question}</div>
                    {mcq.options.map((opt, j) => (
                      <div
                        key={j}
                        className={`mcq-opt${j === mcq.correctOptionIndex ? " mcq-correct" : ""}`}
                        data-letter={String.fromCharCode(65 + j)}
                      >
                        {opt}
                      </div>
                    ))}
                    <div className="mcq-answer">
                      <strong>Answer: {String.fromCharCode(65 + mcq.correctOptionIndex)}</strong>
                      {" — "}{mcq.explanation}
                    </div>
                  </div>
                ))}
              </>
            )}

            {content.workedExamples.length > 0 && (
              <>
                <h2>Worked Examples</h2>
                {content.workedExamples.map((mq, i) => (
                  <div key={i} className="example-q">
                    <div className="example-q-text">Q{i + 1}. {mq.question}</div>
                    {mq.approach && (
                      <div className="example-approach">Approach: {mq.approach}</div>
                    )}
                    {mq.steps && mq.steps.length > 0 && (
                      <>
                        <div className="example-steps">Solution steps:</div>
                        {mq.steps.map((pt, j) => (
                          <div key={j} className="framework-item" data-num={j + 1}>{pt}</div>
                        ))}
                      </>
                    )}
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
