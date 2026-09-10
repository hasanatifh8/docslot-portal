import { CalendarCheck } from "lucide-react";
import { cn } from "@/components/ui";

export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
        <CalendarCheck className="h-[18px] w-[18px]" />
      </span>
      {showText && (
        <span className="text-[15px] font-semibold tracking-tight text-slate-900">
          DocSlot
        </span>
      )}
    </span>
  );
}
