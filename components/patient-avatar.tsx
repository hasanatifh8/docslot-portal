import { cn } from "@/components/ui";

const tones: Record<string, string> = {
  female: "from-rose-300 to-rose-500",
  male: "from-sky-300 to-sky-500",
  other: "from-violet-300 to-violet-500",
};

export function PatientAvatar({
  name,
  gender,
  className,
}: {
  name: string | null;
  gender: string | null;
  className?: string;
}) {
  const initials =
    (name ?? "?")
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-semibold text-white",
        tones[gender ?? ""] ?? "from-brand-300 to-brand-500",
        className
      )}
    >
      {initials}
    </div>
  );
}
