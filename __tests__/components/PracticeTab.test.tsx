import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// react-markdown is ESM-only; the practice tab does not use it
jest.mock("react-markdown", () => ({ __esModule: true, default: () => null }));
jest.mock("remark-gfm", () => ({ __esModule: true, default: () => null }));

import { PracticeTab } from "@/components/ImportedNoteViewer";

const questions = [
  { question: "Capital of India?", options: ["Mumbai", "New Delhi", "Pune", "Agra"], correctOptionIndex: 1, explanation: "Seat of government.", answerSource: "pasted" as const },
  { question: "Largest planet?", options: ["Mars", "Jupiter"], correctOptionIndex: 1, answerSource: "pasted" as const },
  { question: "Smallest planet?", options: ["Mercury", "Venus"], correctOptionIndex: 0, answerSource: "pasted" as const },
  { question: "Red planet?", options: ["Mars", "Earth"], correctOptionIndex: 0, answerSource: "pasted" as const },
];

const setup = () =>
  render(<PracticeTab noteId="n1" questions={questions} onAnswerKey={async () => true} onAI={async () => true} />);

const questionBox = (n: number) => screen.getByRole("radiogroup", { name: `Question ${n}` }).closest("li") as HTMLElement;
const pick = async (n: number, text: string) =>
  userEvent.click(within(screen.getByRole("radiogroup", { name: `Question ${n}` })).getByRole("radio", { name: new RegExp(text) }));

describe("Check answers", () => {
  it("offers 'Check answered' and 'Check all'", async () => {
    setup();
    await pick(1, "New Delhi");
    await userEvent.click(screen.getByRole("button", { name: /Check answers/ }));
    expect(screen.getByRole("menuitem", { name: /Check answered/ })).toBeEnabled();
    expect(screen.getByRole("menuitem", { name: /Check all/ })).toBeEnabled();
  });

  it("'Check answered' marks only what was answered and adds Show answer under the others", async () => {
    setup();
    await pick(1, "New Delhi"); // right
    await pick(2, "Mars"); // wrong
    await userEvent.click(screen.getByRole("button", { name: /Check answers/ }));
    await userEvent.click(screen.getByRole("menuitem", { name: /Check answered/ }));

    // the two answered questions are marked
    expect(within(questionBox(1)).getByText(/Answer: B/)).toBeInTheDocument();
    expect(within(questionBox(1)).getByText("Seat of government.")).toBeInTheDocument();
    expect(within(questionBox(2)).getByText(/Answer: B/)).toBeInTheDocument();
    expect(screen.getByText("Score: 1 correct, 1 wrong")).toBeInTheDocument();
    expect(screen.getByText(/2 not attempted/)).toBeInTheDocument();

    // answered questions have no Show answer button, unattempted ones do, and show no answer yet
    expect(within(questionBox(1)).queryByRole("button", { name: /Show answer/ })).toBeNull();
    expect(within(questionBox(3)).getByRole("button", { name: /Show answer/ })).toBeInTheDocument();
    expect(within(questionBox(4)).getByRole("button", { name: /Show answer/ })).toBeInTheDocument();
    expect(within(questionBox(3)).queryByText(/Answer:/)).toBeNull();
  });

  it("'Show answer' reveals one unattempted question without scoring it", async () => {
    setup();
    await pick(1, "New Delhi");
    await userEvent.click(screen.getByRole("button", { name: /Check answers/ }));
    await userEvent.click(screen.getByRole("menuitem", { name: /Check answered/ }));
    await userEvent.click(within(questionBox(3)).getByRole("button", { name: /Show answer/ }));

    expect(within(questionBox(3)).getByText(/Answer: A/)).toBeInTheDocument();
    expect(within(questionBox(3)).getByText("Not attempted")).toBeInTheDocument();
    expect(within(questionBox(3)).queryByRole("button", { name: /Show answer/ })).toBeNull();
    // still the other unattempted question has its own button, and the score is unchanged
    expect(within(questionBox(4)).getByRole("button", { name: /Show answer/ })).toBeInTheDocument();
    expect(screen.getByText("Score: 1 correct, 0 wrong")).toBeInTheDocument();
  });

  it("an unattempted question can still be answered and checked afterwards", async () => {
    setup();
    await pick(1, "New Delhi");
    await userEvent.click(screen.getByRole("button", { name: /Check answers/ }));
    await userEvent.click(screen.getByRole("menuitem", { name: /Check answered/ }));
    await pick(3, "Venus");
    await userEvent.click(screen.getByRole("button", { name: /Check answers/ }));
    await userEvent.click(screen.getByRole("menuitem", { name: /Check answered/ }));
    expect(screen.getByText("Score: 1 correct, 1 wrong")).toBeInTheDocument();
  });

  it("'Check all' shows every answer and counts unattempted ones as not attempted", async () => {
    setup();
    await pick(1, "New Delhi");
    await userEvent.click(screen.getByRole("button", { name: /Check answers/ }));
    await userEvent.click(screen.getByRole("menuitem", { name: /Check all/ }));

    for (const n of [1, 2, 3, 4]) expect(within(questionBox(n)).getByText(/Answer: /)).toBeInTheDocument();
    expect(within(questionBox(2)).getByText("Not attempted")).toBeInTheDocument();
    expect(screen.getByText("Score: 1 correct, 0 wrong")).toBeInTheDocument();
    expect(screen.getByText(/3 not attempted/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Show answer/ })).toBeNull();
  });

  it("'Check answered' is unavailable until something is answered", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: /Check answers/ }));
    expect(screen.getByRole("menuitem", { name: /Check answered/ })).toBeDisabled();
  });

  it("Clear starts over", async () => {
    setup();
    await pick(1, "New Delhi");
    await userEvent.click(screen.getByRole("button", { name: /Check answers/ }));
    await userEvent.click(screen.getByRole("menuitem", { name: /Check all/ }));
    await userEvent.click(screen.getByRole("button", { name: /Clear/ }));
    expect(screen.queryByText(/Score:/)).toBeNull();
    expect(screen.queryByText(/Answer: /)).toBeNull();
  });
});
