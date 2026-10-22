"use client";

import { Printer } from "@/components/icons";
import { Button } from "@/components/ui";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <Button className="no-print" onClick={() => window.print()}>
      <Printer className="h-4 w-4" /> {label}
    </Button>
  );
}
