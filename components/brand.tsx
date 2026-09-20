import Image from "next/image";
import { cn } from "@/components/ui";

export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/docslot-logo.png"
      alt="DocSlot"
      width={821}
      height={248}
      priority
      className={cn("h-7 w-auto", className)}
    />
  );
}
