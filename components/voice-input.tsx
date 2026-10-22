"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic, MicOff } from "@/components/icons";
import { cn } from "@/components/ui";

// Minimal typing for the Web Speech API (Chrome/Edge/Safari ship it prefixed).
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

function getRecognition(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noopSubscribe = () => () => {};

/**
 * Dictation button. Speech is turned into text in the browser and appended to
 * the field; the doctor reviews it like typed text. Hidden where unsupported.
 */
export function MicButton({ onText, className, label = "Dictate" }: { onText: (text: string) => void; className?: string; label?: string }) {
  // Server render says "unsupported"; the browser answers for itself after hydration.
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => !!getRecognition(),
    () => false
  );
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const cb = useRef(onText);
  useEffect(() => {
    cb.current = onText;
  }, [onText]);
  useEffect(() => () => rec.current?.stop(), []);

  if (!supported) return null;

  const toggle = () => {
    if (listening) {
      rec.current?.stop();
      return;
    }
    const R = getRecognition();
    if (!R) return;
    const r = new R();
    r.lang = "en-IN";
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) text += e.results[i][0].transcript;
      text = text.trim();
      if (text) cb.current(text.charAt(0).toUpperCase() + text.slice(1));
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    r.start();
    setListening(true);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={listening ? "Stop dictation" : `${label} (speak — text is added here)`}
      aria-pressed={listening}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-full px-2 text-[11px] font-medium transition",
        listening ? "alert-pulse bg-rose-600 text-white" : "text-slate-500 ring-1 ring-slate-200 hover:bg-brand-50 hover:text-brand-700",
        className
      )}
    >
      {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
      {listening ? "Listening… tap to stop" : label}
    </button>
  );
}

/** Join dictated / chip text onto an existing field value. */
export function appendText(current: string, add: string, sep = ", ") {
  const c = current.trim();
  if (!c) return add;
  return /[.,;:]$/.test(c) || sep === "\n" ? `${c}${sep === ", " ? " " : sep}${add}` : `${c}${sep}${add}`;
}
