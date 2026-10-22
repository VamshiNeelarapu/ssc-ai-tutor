"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useErrorPopup } from "@/components/ErrorPopup";
import type { AppError } from "@/lib/client-errors";

export type VoiceLang = "en-IN" | "hi-IN";

const LANG_STORAGE_KEY = "ssc_voice_lang";
const DEFAULT_LANG: VoiceLang = "en-IN";

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionErrorEventLike {
  readonly error: string;
  readonly message?: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function readStoredLang(): VoiceLang {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    return stored === "hi-IN" ? "hi-IN" : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

function storeLang(lang: VoiceLang): void {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {}
}

export function voiceErrorToAppError(code: string, raw?: string): AppError | null {
  switch (code) {
    case "aborted":
      return null;
    case "not-allowed":
    case "service-not-allowed":
      return {
        message: "Microphone access was blocked.",
        code: "VOICE_DENIED",
        suggestion:
          "Allow the microphone for this site: click the lock icon in the address bar, open Site settings, set Microphone to Allow, then try again. A company policy can also block microphone access.",
        detail: `Speech recognition error: ${code}`,
      };
    case "network":
      return {
        message: "The browser's speech service could not be reached.",
        code: "VOICE_NETWORK",
        suggestion:
          "Chrome and Edge send your audio to an online speech service, so they need internet access. A firewall or VPN may be blocking it.",
        detail: `Speech recognition error: ${code}`,
      };
    case "no-speech":
      return {
        message: "No speech was detected.",
        code: "VOICE_NO_SPEECH",
        suggestion: "Speak closer to the microphone and check that the right microphone is selected.",
      };
    case "audio-capture":
      return {
        message: "No microphone was found.",
        code: "VOICE_ERROR",
        suggestion: "Connect a microphone and make sure it is enabled in your system sound settings.",
        detail: `Speech recognition error: ${code}`,
      };
    case "language-not-supported":
      return {
        message: "This browser does not support the selected voice language.",
        code: "VOICE_ERROR",
        suggestion: "Switch the voice language (EN / हिं) next to the microphone and try again.",
        detail: `Speech recognition error: ${code}`,
      };
    case "unsupported":
      return {
        message: "This browser does not support voice input.",
        code: "VOICE_UNSUPPORTED",
        suggestion:
          "Use Google Chrome or Microsoft Edge. Firefox does not support the speech recognition feature.",
      };
    default:
      return {
        message: "Voice input stopped because of an error.",
        code: "VOICE_ERROR",
        suggestion: "Try again. If it keeps failing, type your question instead.",
        detail: `Speech recognition error: ${code}${raw ? ` (${raw})` : ""}`,
      };
  }
}

interface SpeechToTextOptions {
  onText: (fullText: string) => void;
  onError: (error: AppError) => void;
  onEnd?: () => void;
}

export function useSpeechToText(options: SpeechToTextOptions) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [lang, setLangState] = useState<VoiceLang>(DEFAULT_LANG);

  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
    setLangState(readStoredLang());
  }, []);

  const setLang = useCallback((next: VoiceLang) => {
    setLangState(next);
    storeLang(next);
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.abort();
      } catch {}
    }
    setListening(false);
  }, []);

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {}
  }, []);

  const start = useCallback(
    (baseText: string) => {
      if (recognitionRef.current) return;

      const Ctor = getRecognitionCtor();
      if (!Ctor) {
        const err = voiceErrorToAppError("unsupported");
        if (err) optionsRef.current.onError(err);
        return;
      }

      const prefix = baseText && !/\s$/.test(baseText) ? `${baseText} ` : baseText;
      const rec = new Ctor();
      rec.lang = lang;
      rec.continuous = true;
      rec.interimResults = true;
      cancelledRef.current = false;

      rec.onresult = (event) => {
        if (cancelledRef.current) return;
        const parts: string[] = [];
        for (let i = 0; i < event.results.length; i++) {
          const transcript = event.results[i][0]?.transcript?.trim();
          if (transcript) parts.push(transcript);
        }
        optionsRef.current.onText(prefix + parts.join(" "));
      };

      rec.onerror = (event) => {
        const err = voiceErrorToAppError(event.error, event.message);
        if (err) optionsRef.current.onError(err);
      };

      // Chrome also ends the session by itself after a stretch of silence; keep the text as is.
      rec.onend = () => {
        recognitionRef.current = null;
        setListening(false);
        if (!cancelledRef.current) optionsRef.current.onEnd?.();
      };

      try {
        rec.start();
        recognitionRef.current = rec;
        setListening(true);
      } catch (e) {
        recognitionRef.current = null;
        const err = voiceErrorToAppError("start-failed", e instanceof Error ? e.message : undefined);
        if (err) optionsRef.current.onError(err);
      }
    },
    [lang]
  );

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      if (rec) {
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        try {
          rec.abort();
        } catch {}
      }
    };
  }, []);

  return { supported, listening, lang, setLang, start, stop, cancel };
}

interface VoiceInputOptions {
  setText: (text: string) => void;
  onEnd?: () => void;
}

export function useVoiceInput({ setText, onEnd }: VoiceInputOptions) {
  const { showError } = useErrorPopup();
  return useSpeechToText({ onText: setText, onError: showError, onEnd });
}
