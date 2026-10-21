"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, XCircle, Trophy } from "lucide-react";
import Button from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { clsx } from "clsx";

interface MCQ {
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
}

interface QuizState {
  questions: MCQ[];
  currentIndex: number;
  answers: (number | null)[];
  revealed: boolean[];
  completed: boolean;
}

export default function QuizPage({ params }: { params: { noteId: string } }) {
  const router = useRouter();
  const [noteTitle, setNoteTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [quiz, setQuiz] = useState<QuizState | null>(null);

  useEffect(() => {
    const loadQuiz = async () => {
      try {
        const [noteRes, quizRes] = await Promise.all([
          fetch(`/api/notes/${params.noteId}`),
          fetch(`/api/notes/${params.noteId}/quiz`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ count: 5 }),
          }),
        ]);

        if (!noteRes.ok) {
          setError("Note not found");
          return;
        }

        const note = await noteRes.json();
        setNoteTitle(note.title);

        if (!quizRes.ok) {
          const data = await quizRes.json();
          setError(data.error || "Failed to generate quiz");
          return;
        }

        const quizData = await quizRes.json();
        const questions: MCQ[] = quizData.questions || [];

        if (questions.length === 0) {
          setError("No quiz questions available for this note");
          return;
        }

        setQuiz({
          questions,
          currentIndex: 0,
          answers: new Array(questions.length).fill(null),
          revealed: new Array(questions.length).fill(false),
          completed: false,
        });
      } catch {
        setError("Failed to load quiz");
      } finally {
        setLoading(false);
      }
    };

    loadQuiz();
  }, [params.noteId]);

  const handleAnswer = (optionIndex: number) => {
    if (!quiz) return;
    const { currentIndex, answers, revealed } = quiz;

    if (revealed[currentIndex]) return; // already answered

    const newAnswers = [...answers];
    newAnswers[currentIndex] = optionIndex;

    const newRevealed = [...revealed];
    newRevealed[currentIndex] = true;

    setQuiz({ ...quiz, answers: newAnswers, revealed: newRevealed });
  };

  const handleNext = () => {
    if (!quiz) return;
    if (quiz.currentIndex === quiz.questions.length - 1) {
      finishQuiz();
    } else {
      setQuiz({ ...quiz, currentIndex: quiz.currentIndex + 1 });
    }
  };

  const finishQuiz = async () => {
    if (!quiz) return;

    const score = quiz.questions.reduce((acc, q, i) => {
      return quiz.answers[i] === q.correctOptionIndex ? acc + 1 : acc;
    }, 0);

    setSaving(true);
    try {
      await fetch("/api/quiz-attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noteId: params.noteId,
          questions: quiz.questions.map((q, i) => ({
            ...q,
            userAnswerIndex: quiz.answers[i],
          })),
          score,
          totalQuestions: quiz.questions.length,
          completedAt: new Date().toISOString(),
        }),
      });
    } catch {
      // Non-critical error
    } finally {
      setSaving(false);
    }

    setQuiz({ ...quiz, completed: true });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Link
          href={`/notes/${params.noteId}`}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft size={14} />
          Back to note
        </Link>
        <ErrorState message={error} />
      </div>
    );
  }

  if (!quiz) return null;

  if (quiz.completed) {
    const score = quiz.questions.reduce((acc, q, i) => {
      return quiz.answers[i] === q.correctOptionIndex ? acc + 1 : acc;
    }, 0);
    const percentage = Math.round((score / quiz.questions.length) * 100);

    return (
      <div className="max-w-2xl mx-auto p-6">
        <ResultScreen
          score={score}
          total={quiz.questions.length}
          percentage={percentage}
          questions={quiz.questions}
          answers={quiz.answers}
          noteId={params.noteId}
          onRetry={() => {
            setQuiz({
              ...quiz,
              currentIndex: 0,
              answers: new Array(quiz.questions.length).fill(null),
              revealed: new Array(quiz.questions.length).fill(false),
              completed: false,
            });
          }}
        />
      </div>
    );
  }

  const currentQ = quiz.questions[quiz.currentIndex];
  const userAnswer = quiz.answers[quiz.currentIndex];
  const isRevealed = quiz.revealed[quiz.currentIndex];

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Header */}
      <Link
        href={`/notes/${params.noteId}`}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Back to note
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Quiz: {noteTitle}</h1>
        <p className="text-sm text-gray-500 mt-1">
          Question {quiz.currentIndex + 1} of {quiz.questions.length}
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-6" aria-hidden="true">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all"
          style={{
            width: `${((quiz.currentIndex + 1) / quiz.questions.length) * 100}%`,
          }}
        />
      </div>

      {/* Question */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
        <p className="font-medium text-gray-900 text-base leading-relaxed">
          {currentQ.question}
        </p>
      </div>

      {/* Options */}
      <div className="space-y-3 mb-6" role="group" aria-label="Answer options">
        {currentQ.options.map((option, i) => {
          const isCorrect = i === currentQ.correctOptionIndex;
          const isSelected = userAnswer === i;

          return (
            <button
              key={i}
              onClick={() => handleAnswer(i)}
              disabled={isRevealed}
              className={clsx(
                "w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all",
                !isRevealed && "hover:border-blue-400 hover:bg-blue-50",
                !isRevealed && "border-gray-200 text-gray-900",
                isRevealed && isCorrect && "border-green-500 bg-green-50 text-green-800",
                isRevealed && isSelected && !isCorrect && "border-red-500 bg-red-50 text-red-800",
                isRevealed && !isSelected && !isCorrect && "border-gray-200 text-gray-500"
              )}
              aria-pressed={isSelected}
            >
              <div className="flex items-center gap-3">
                <span
                  className={clsx(
                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                    !isRevealed && "bg-gray-100 text-gray-600",
                    isRevealed && isCorrect && "bg-green-500 text-white",
                    isRevealed && isSelected && !isCorrect && "bg-red-500 text-white",
                    isRevealed && !isSelected && !isCorrect && "bg-gray-100 text-gray-400"
                  )}
                  aria-hidden="true"
                >
                  {String.fromCharCode(65 + i)}
                </span>
                {option}
                {isRevealed && isCorrect && (
                  <CheckCircle
                    size={16}
                    className="ml-auto text-green-600 flex-shrink-0"
                    aria-label="Correct answer"
                  />
                )}
                {isRevealed && isSelected && !isCorrect && (
                  <XCircle
                    size={16}
                    className="ml-auto text-red-600 flex-shrink-0"
                    aria-label="Incorrect answer"
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Explanation */}
      {isRevealed && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <p className="text-sm font-medium text-blue-900 mb-1">Explanation</p>
          <p className="text-sm text-blue-800">{currentQ.explanation}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <div className="text-sm text-gray-500">
          {quiz.revealed.filter(Boolean).length} / {quiz.questions.length} answered
        </div>
        {isRevealed && (
          <Button onClick={handleNext}>
            {quiz.currentIndex === quiz.questions.length - 1
              ? "Finish Quiz"
              : "Next Question"}
          </Button>
        )}
      </div>
    </div>
  );
}

function ResultScreen({
  score,
  total,
  percentage,
  questions,
  answers,
  noteId,
  onRetry,
}: {
  score: number;
  total: number;
  percentage: number;
  questions: MCQ[];
  answers: (number | null)[];
  noteId: string;
  onRetry: () => void;
}) {
  const grade =
    percentage >= 80
      ? { label: "Excellent!", color: "text-green-600" }
      : percentage >= 60
      ? { label: "Good job!", color: "text-blue-600" }
      : { label: "Keep practicing!", color: "text-amber-600" };

  return (
    <div>
      <Link
        href={`/notes/${noteId}`}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Back to note
      </Link>

      {/* Result card */}
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center mb-6">
        <div className="mb-4" aria-hidden="true">
          <Trophy size={48} className="mx-auto text-yellow-500" />
        </div>
        <h2 className={`text-2xl font-bold ${grade.color} mb-2`}>
          {grade.label}
        </h2>
        <p className="text-4xl font-bold text-gray-900 mb-1">
          {score}/{total}
        </p>
        <p className="text-gray-500">{percentage}% correct</p>

        <div className="flex gap-3 justify-center mt-6">
          <Button variant="secondary" onClick={onRetry}>
            Try Again
          </Button>
          <Link href={`/notes/${noteId}`}>
            <Button>Back to Note</Button>
          </Link>
        </div>
      </div>

      {/* All answers review */}
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Review Answers</h3>
      <div className="space-y-4">
        {questions.map((q, i) => {
          const isCorrect = answers[i] === q.correctOptionIndex;
          return (
            <div
              key={i}
              className={clsx(
                "bg-white border-2 rounded-xl p-4",
                isCorrect ? "border-green-200" : "border-red-200"
              )}
            >
              <div className="flex items-start gap-2 mb-2">
                {isCorrect ? (
                  <CheckCircle
                    size={16}
                    className="text-green-600 flex-shrink-0 mt-0.5"
                    aria-label="Correct"
                  />
                ) : (
                  <XCircle
                    size={16}
                    className="text-red-600 flex-shrink-0 mt-0.5"
                    aria-label="Incorrect"
                  />
                )}
                <p className="text-sm font-medium text-gray-900">
                  Q{i + 1}: {q.question}
                </p>
              </div>

              {!isCorrect && answers[i] !== null && (
                <p className="text-xs text-red-600 mb-1 ml-6">
                  Your answer: {q.options[answers[i]!]}
                </p>
              )}
              <p className="text-xs text-green-700 mb-2 ml-6">
                Correct: {q.options[q.correctOptionIndex]}
              </p>
              <p className="text-xs text-gray-600 bg-gray-50 rounded p-2">
                {q.explanation}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
