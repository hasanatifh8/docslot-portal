"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button, Card } from "@/components/ui";

/** Friendly fallback when a page or action fails unexpectedly — nothing typed is lost on retry. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <Card className="mx-auto mt-10 max-w-lg p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
        <TriangleAlert className="h-6 w-6" />
      </div>
      <h1 className="text-lg font-semibold text-slate-900">Something went wrong</h1>
      <p className="mt-1 text-sm text-slate-500">
        The last action didn&apos;t complete. Please try again — if it keeps happening, note the time and tell your administrator.
      </p>
      {error.digest && <p className="mt-2 font-mono text-[11px] text-slate-400">Ref {error.digest}</p>}
      <Button className="mt-5" onClick={reset}>
        <RotateCcw className="h-4 w-4" /> Try again
      </Button>
    </Card>
  );
}
