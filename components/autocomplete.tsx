"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/components/ui";

/**
 * Text input with a keyboard-driven suggestion list. Typing stays free-form;
 * suggestions only fill it in (↑/↓ to move, Enter/Tab to pick, Esc to close).
 */
export function Autocomplete<T>({
  value,
  onChange,
  onPick,
  search,
  render,
  placeholder,
  className,
  inputClassName,
  ariaLabel,
  autoFocus,
  invalid,
  icon,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (item: T) => void;
  search: (q: string) => T[];
  render: (item: T, active: boolean) => React.ReactNode;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
  invalid?: boolean;
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [rawActive, setActive] = useState(0);
  const items = useMemo(() => {
    if (!open) return [];
    const found = search(value);
    // Nothing to suggest once the field already holds the only match.
    return found.length === 1 && JSON.stringify(found[0]).toLowerCase().includes(`"${value.trim().toLowerCase()}"`) ? [] : found;
  }, [open, search, value]);
  const active = Math.min(rawActive, Math.max(0, items.length - 1));
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const pick = (item: T) => {
    onPick(item);
    setOpen(false);
  };

  return (
    <div ref={wrap} className={cn("relative", className)}>
      {icon && <div className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">{icon}</div>}
      <input
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!items.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(items.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === "Enter" || (e.key === "Tab" && open && value.length >= 2)) {
            e.preventDefault();
            pick(items[active]);
          } else if (e.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={invalid}
        role="combobox"
        aria-expanded={items.length > 0}
        aria-controls={id}
        aria-autocomplete="list"
        autoComplete="off"
        className={cn(
          "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 aria-[invalid=true]:border-red-400 aria-[invalid=true]:bg-red-50/40",
          !!icon && "pl-9",
          inputClassName
        )}
      />
      {items.length > 0 && (
        <ul id={id} role="listbox" className="dialog-in absolute z-30 mt-1 max-h-72 w-full min-w-[18rem] overflow-y-auto rounded-xl bg-white p-1 shadow-xl ring-1 shadow-brand-900/10 ring-brand-900/10">
          {items.map((item, i) => (
            <li
              key={i}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(item);
              }}
              className={cn("cursor-pointer rounded-lg px-3 py-2 text-sm", i === active ? "bg-brand-50 text-brand-900" : "text-slate-700")}
            >
              {render(item, i === active)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
