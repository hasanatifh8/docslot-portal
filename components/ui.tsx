import * as React from "react";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

// Utility groups where a caller's class must replace the component default
// (CSS order, not class order, decides otherwise — e.g. w-full beats w-28).
const GROUPS: [string, RegExp][] = [
  ["w", /^w-/],
  ["h", /^h-/],
  ["px", /^px-/],
  ["pl", /^pl-/],
  ["pr", /^pr-/],
  ["py", /^py-/],
  ["size", /^text-(xs|sm|base|lg|\d?xl|\[)/],
  ["color", /^text-(?!xs|sm|base|lg|\d?xl|\[|left|right|center)/],
  ["bg", /^bg-(?!gradient|clip)/],
  ["font", /^font-(normal|medium|semibold|bold|extrabold)/],
  ["rounded", /^rounded(-|$)/],
  ["gap", /^gap-/],
  ["display", /^(hidden|block|inline|inline-block|flex|inline-flex|grid|inline-grid)$/],
];

function groupOf(cls: string) {
  const at = cls.lastIndexOf(":");
  const variant = at < 0 ? "" : cls.slice(0, at + 1);
  const util = cls.slice(at + 1);
  const g = GROUPS.find(([, re]) => re.test(util));
  return g ? variant + g[0] : null;
}

/** Base classes with any conflicting utility (same variant + group) overridden by `extra`. */
export function tw(base: string, extra?: string | false | null) {
  if (!extra) return base;
  const mine = extra.split(/\s+/).filter(Boolean);
  const taken = new Set(mine.map(groupOf).filter(Boolean));
  const kept = base.split(/\s+/).filter((c) => c && !taken.has(groupOf(c)));
  return [...kept, ...mine].join(" ");
}

// ─── Button ────────────────────────────────────────────────────────────────

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-900/10",
  secondary: "bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-brand-50 hover:text-brand-800 hover:ring-brand-200",
  ghost: "text-slate-600 hover:bg-brand-50 hover:text-brand-700",
  danger: "bg-white text-red-600 ring-1 ring-inset ring-red-200 hover:bg-red-50",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-900/10",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-sm font-semibold",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return tw(cn(base, variants[variant], sizes[size]), extra);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

// ─── Card ──────────────────────────────────────────────────────────────────

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "shadow-care rounded-2xl bg-white/[0.93] ring-1 ring-white/70 backdrop-blur-sm [box-shadow:0_1px_2px_rgb(15_63_60/0.05),0_10px_30px_-12px_rgb(15_63_60/0.14),inset_0_0_0_1px_rgb(15_63_60/0.04)]",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-b border-slate-100 px-5 py-4", className)} {...props} />;
}

export function CardTitle({
  className,
  icon: Icon,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & { icon?: IconType }) {
  return (
    <h3 className={cn("flex items-center gap-2 text-sm font-semibold text-slate-900", className)} {...props}>
      {Icon && <Icon className="h-4 w-4 text-brand-600" />}
      {children}
    </h3>
  );
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-0.5 text-xs text-slate-500", className)} {...props} />;
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

// ─── Form controls ─────────────────────────────────────────────────────────

const controlBase =
  "w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 aria-[invalid=true]:border-red-400 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-red-500/15 disabled:bg-slate-50 disabled:text-slate-500";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={tw(cn(controlBase, "h-10"), className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={tw(cn(controlBase, "py-2"), className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={tw(cn(controlBase, "h-10"), className)} {...props} />;
}

export function Field({
  label,
  hint,
  icon: Icon,
  children,
  className,
}: {
  label: string;
  hint?: string;
  icon?: IconType;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-700">
        {Icon && <Icon className="h-3.5 w-3.5 text-brand-500" />}
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

// ─── Badge ─────────────────────────────────────────────────────────────────

const badgeTones: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/10",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  slate: "bg-slate-100 text-slate-600 ring-slate-500/20",
  brand: "bg-brand-50 text-brand-700 ring-brand-600/20",
};

export function Badge({
  tone = "slate",
  className,
  children,
}: {
  tone?: keyof typeof badgeTones;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset",
        badgeTones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function statusTone(status: string): keyof typeof badgeTones {
  return (
    {
      booked: "green",
      cancelled: "red",
      completed: "slate",
      no_show: "amber",
    } as const
  )[status] ?? "slate";
}

// ─── Form feedback ─────────────────────────────────────────────────────────

export function FormMessage({
  error,
  success,
  className,
}: {
  error?: string;
  success?: string | false;
  className?: string;
}) {
  if (error) {
    return (
      <p className={cn("rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-600/10", className)}>
        {error}
      </p>
    );
  }
  if (success) {
    return (
      <p
        className={cn(
          "rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-600/10",
          className
        )}
      >
        {success}
      </p>
    );
  }
  return null;
}

// ─── Layout helpers ────────────────────────────────────────────────────────

export type IconType = React.ComponentType<{ className?: string }>;

export function PageHeader({
  title,
  description,
  actions,
  icon: Icon,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  icon?: IconType;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 via-brand-600 to-brand-800 text-white shadow-lg ring-1 shadow-brand-700/25 ring-white/20">
            <div aria-hidden className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/25 to-transparent" />
            <Icon className="relative h-6 w-6" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      {actions}
    </div>
  );
}

/** Rounded tinted icon tile. */
export function IconChip({
  icon: Icon,
  tone = "brand",
  className,
}: {
  icon: IconType;
  tone?: "brand" | "rose" | "amber" | "sky" | "emerald" | "violet" | "slate" | "accent";
  className?: string;
}) {
  const tones = {
    brand: "bg-brand-50 text-brand-600",
    rose: "bg-rose-50 text-rose-500",
    amber: "bg-amber-50 text-amber-600",
    sky: "bg-sky-50 text-sky-600",
    emerald: "bg-emerald-50 text-emerald-600",
    violet: "bg-violet-50 text-violet-600",
    slate: "bg-slate-100 text-slate-500",
    accent: "bg-accent-50 text-accent-600",
  };
  return (
    <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", tones[tone], className)}>
      <Icon className="h-[18px] w-[18px]" />
    </div>
  );
}

/** Heartbeat trace — the app's signature motif. */
export function EcgLine({ className, animated = false }: { className?: string; animated?: boolean }) {
  return (
    <svg viewBox="0 0 300 40" fill="none" preserveAspectRatio="none" aria-hidden className={className}>
      <path
        className={animated ? "ecg-line" : undefined}
        d="M0 22h70l8-10 8 10h20l6 8 8-28 10 38 7-18h14l10-6 10 6h129"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function AuthShell({ children, hero }: { children: React.ReactNode; hero?: React.ReactNode }) {
  return (
    <div className="flex flex-1">
      {hero && (
        <aside className="bg-crosses relative hidden w-[46%] max-w-xl flex-col justify-between overflow-hidden bg-brand-800 bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 p-10 text-white lg:flex">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-brand-400/25 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-accent-500/20 blur-3xl"
          />
          {hero}
        </aside>
      )}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-canvas p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 right-0 h-96 w-96 rounded-full bg-brand-200/40 blur-3xl"
        />
        <div className="relative w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {Icon && (
        <div className="relative mb-4 flex h-20 w-20 items-center justify-center">
          <div aria-hidden className="absolute inset-0 rounded-full bg-gradient-to-br from-brand-100 to-brand-50" />
          <div aria-hidden className="absolute inset-3 rounded-full bg-white shadow-sm ring-1 ring-brand-100" />
          <Icon className="relative h-8 w-8 text-brand-500" />
        </div>
      )}
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description && <p className="mt-1 max-w-xs text-xs text-slate-500">{description}</p>}
    </div>
  );
}

// ─── Chips, keys, banners ──────────────────────────────────────────────────

/** Pill styling for links used as filters (a <Chip> must not sit inside an <a>). */
export function chipClass(active?: boolean, extra?: string) {
  return cn(
    "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium ring-1 transition-all ring-inset select-none",
    active ? "bg-brand-600 text-white ring-brand-600 shadow-sm shadow-brand-700/20" : "bg-white text-slate-600 ring-slate-200 hover:bg-brand-50 hover:text-brand-800 hover:ring-brand-200",
    extra
  );
}

/** Toggleable pill — one-tap picks instead of typing. */
export function Chip({
  active,
  tone = "brand",
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; tone?: "brand" | "rose" | "amber" }) {
  const on = {
    brand: "bg-brand-600 text-white ring-brand-600 shadow-sm shadow-brand-700/20",
    rose: "bg-rose-600 text-white ring-rose-600 shadow-sm shadow-rose-700/20",
    amber: "bg-amber-500 text-white ring-amber-500 shadow-sm shadow-amber-700/20",
  }[tone];
  return (
    <button
      type="button"
      aria-pressed={active}
      className={tw(
        cn(
          "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium ring-1 transition-all ring-inset select-none active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
          active ? on : "bg-white text-slate-600 ring-slate-200 hover:bg-brand-50 hover:text-brand-800 hover:ring-brand-200"
        ),
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-slate-200 bg-slate-50 px-1 font-sans text-[10px] font-medium text-slate-500",
        className
      )}
    >
      {children}
    </kbd>
  );
}

const bannerTones = {
  info: "bg-sky-50 text-sky-900 ring-sky-600/15",
  warn: "bg-amber-50 text-amber-900 ring-amber-600/20",
  danger: "bg-rose-50 text-rose-900 ring-rose-600/15",
  success: "bg-emerald-50 text-emerald-900 ring-emerald-600/15",
};

export function Banner({
  tone = "info",
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  tone?: keyof typeof bannerTones;
  icon?: IconType;
  title?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div role={tone === "danger" ? "alert" : undefined} className={cn("flex items-start gap-3 rounded-2xl px-4 py-3 text-sm ring-1 ring-inset", bannerTones[tone], className)}>
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0" />}
      <div className="min-w-0 flex-1">
        {title && <div className="font-semibold">{title}</div>}
        {children && <div className={cn(!!title && "mt-0.5", "text-[13px] opacity-90")}>{children}</div>}
      </div>
      {action}
    </div>
  );
}

/** Small labelled value used in summaries and receipts. */
export function KeyValue({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{value ?? <span className="text-slate-400">—</span>}</dd>
    </div>
  );
}
