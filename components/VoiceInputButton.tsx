"use client";

import { Mic, Square } from "lucide-react";
import { clsx } from "clsx";
import type { VoiceLang } from "@/hooks/useSpeechToText";

interface VoiceInputButtonProps {
  listening: boolean;
  lang: VoiceLang;
  onToggle: () => void;
  onLangChange: (lang: VoiceLang) => void;
  disabled?: boolean;
}

export function VoiceInputButton({
  listening,
  lang,
  onToggle,
  onLangChange,
  disabled = false,
}: VoiceInputButtonProps) {
  const isHindi = lang === "hi-IN";
  const nextLang: VoiceLang = isHindi ? "en-IN" : "hi-IN";

  return (
    <div className="flex items-end gap-1">
      <button
        type="button"
        onClick={() => onLangChange(nextLang)}
        disabled={disabled || listening}
        className="h-10 px-2 rounded-md text-xs font-semibold text-[#44506a] bg-[#e1e8f4] hover:bg-[#d6dfee] transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#93a3c2]"
        aria-label={`Voice language: ${isHindi ? "Hindi" : "English (India)"}. Switch to ${isHindi ? "English" : "Hindi"}`}
        title={`Voice language: ${isHindi ? "Hindi" : "English (India)"} — click to switch`}
      >
        {isHindi ? "हिं" : "EN"}
      </button>

      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className={clsx(
          "relative inline-flex items-center justify-center h-10 w-10 rounded-md transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
          "disabled:pointer-events-none disabled:opacity-50",
          listening
            ? "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500"
            : "bg-[#e1e8f4] text-[#1f4e9c] hover:bg-[#d6dfee] focus-visible:ring-[#93a3c2]"
        )}
        aria-label={listening ? "Stop voice input" : "Start voice input"}
        aria-pressed={listening}
        title={listening ? "Stop voice input" : "Start voice input"}
      >
        {listening && (
          <span
            className="absolute inset-0 rounded-md bg-red-400 opacity-50 animate-ping"
            aria-hidden="true"
          />
        )}
        {listening ? (
          <Square size={14} fill="currentColor" className="relative animate-pulse" aria-hidden="true" />
        ) : (
          <Mic size={16} className="relative" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

export default VoiceInputButton;
