"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Chip, cn } from "@/components/ui";

/**
 * Pick-from-common + type-your-own list, stored as a comma-joined string
 * (allergies, chronic conditions). Enter or comma adds the typed value.
 */
export function ChipInput({
  value,
  onChange,
  suggestions,
  placeholder = "Type and press Enter",
  tone = "brand",
  noneLabel,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  suggestions: string[];
  placeholder?: string;
  tone?: "brand" | "rose" | "amber";
  /** e.g. "No known allergies" — clears the list */
  noneLabel?: string;
}) {
  const [draft, setDraft] = useState("");
  const has = (s: string) => value.some((v) => v.toLowerCase() === s.toLowerCase());
  const toggle = (s: string) => onChange(has(s) ? value.filter((v) => v.toLowerCase() !== s.toLowerCase()) : [...value, s]);
  const add = () => {
    const parts = draft
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !has(s));
    if (parts.length) onChange([...value, ...parts]);
    setDraft("");
  };
  const custom = value.filter((v) => !suggestions.some((s) => s.toLowerCase() === v.toLowerCase()));

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-1.5">
        {noneLabel && (
          <Chip active={value.length === 0} onClick={() => onChange([])}>
            {noneLabel}
          </Chip>
        )}
        {suggestions.map((s) => (
          <Chip key={s} active={has(s)} tone={tone} onClick={() => toggle(s)}>
            {s}
          </Chip>
        ))}
        {custom.map((s) => (
          <Chip key={s} active tone={tone} onClick={() => toggle(s)}>
            {s}
            <X className="h-3 w-3" />
          </Chip>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className={cn(
            "h-9 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          )}
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="flex h-9 items-center gap-1 rounded-lg px-3 text-xs font-medium text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50 disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>
    </div>
  );
}
