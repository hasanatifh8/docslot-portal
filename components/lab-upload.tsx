"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, UploadCloud } from "lucide-react";
import { Banner, cn } from "@/components/ui";
import { useToast } from "@/components/toast";

type Item = { name: string; size: number; progress: number; state: "uploading" | "done" | "error"; error?: string };

/** Drag-and-drop / camera upload of lab & diagnostic reports, with progress. */
export function LabUpload({ patientId, compact = false }: { patientId: string; compact?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [items, setItems] = useState<Item[]>([]);

  const upload = (files: File[]) => {
    if (!files.length) return;
    const batch: Item[] = files.map((f) => ({ name: f.name, size: f.size, progress: 0, state: "uploading" }));
    setItems((it) => [...batch, ...it].slice(0, 8));
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/patients/${patientId}/lab-reports`);
    const update = (patch: Partial<Item>) => setItems((it) => it.map((x) => (batch.some((b) => b.name === x.name && x.state === "uploading") ? { ...x, ...patch } : x)));
    xhr.upload.onprogress = (e) => e.lengthComputable && update({ progress: Math.round((e.loaded / e.total) * 100) });
    xhr.onload = () => {
      if (xhr.status === 413) return update({ state: "error", error: "Too large for the server — compress the PDF or upload pages as photos." });
      let body: { created?: { fileName: string }[]; rejected?: { fileName: string; reason: string }[]; error?: string } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON error page */
      }
      if (xhr.status >= 400) return update({ state: "error", error: body.error ?? `Upload failed (${xhr.status})` });
      setItems((it) =>
        it.map((x) => {
          const rej = body.rejected?.find((r) => r.fileName === x.name);
          return batch.some((b) => b.name === x.name) && x.state === "uploading" ? { ...x, progress: 100, state: rej ? "error" : "done", error: rej?.reason } : x;
        })
      );
      if (body.created?.length) {
        toast({ tone: "success", title: `${body.created.length} report${body.created.length > 1 ? "s" : ""} uploaded`, body: "The AI reader is working on it — results appear in a minute." });
        router.refresh();
      }
    };
    xhr.onerror = () => update({ state: "error", error: "Network error — check the connection and try again." });
    xhr.send(fd);
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          upload([...e.dataTransfer.files]);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-center transition",
          compact ? "px-4 py-5" : "px-6 py-8",
          over ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-white/60 hover:border-brand-300"
        )}
      >
        <UploadCloud className={cn("text-brand-500", compact ? "h-7 w-7" : "h-9 w-9")} />
        <p className="text-sm font-medium text-slate-800">Drop lab reports here</p>
        <p className="text-xs text-slate-500">PDF or photos · up to 10 files · the AI reader sorts results by test and flags what&apos;s abnormal</p>
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => input.current?.click()} className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
            Choose files
          </button>
          <button type="button" onClick={() => camera.current?.click()} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50 sm:hidden">
            <Camera className="h-3.5 w-3.5" /> Take photo
          </button>
        </div>
        <input ref={input} type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => (upload([...(e.target.files ?? [])]), (e.target.value = ""))} />
        <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => (upload([...(e.target.files ?? [])]), (e.target.value = ""))} />
      </div>
      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={`${it.name}-${i}`} className="rounded-xl bg-white/80 px-3 py-2 text-xs ring-1 ring-slate-200">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium text-slate-700">{it.name}</span>
                <span className={cn("shrink-0", it.state === "error" ? "text-rose-600" : it.state === "done" ? "text-emerald-600" : "text-slate-400")}>
                  {it.state === "uploading" ? `${it.progress}%` : it.state === "done" ? "Uploaded" : "Failed"}
                </span>
              </div>
              {it.state === "uploading" && (
                <div className="mt-1 h-1 rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${it.progress}%` }} />
                </div>
              )}
              {it.error && <p className="mt-0.5 text-rose-600">{it.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** While any report is still being read, refresh the page every few seconds. */
export function LabProcessingWatcher({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [active, router]);
  return active ? (
    <Banner tone="info" className="text-xs">
      <span className="inline-flex items-center gap-2">
        <span className="h-2 w-2 animate-pulse rounded-full bg-sky-500" /> Reading report… this page updates by itself.
      </span>
    </Banner>
  ) : null;
}
