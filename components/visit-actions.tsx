"use client";

import { useActionState, useState, useTransition } from "react";
import { MessageCircle, NotebookPen } from "lucide-react";
import { addAddendum, sendPrescription, type OpdFormState } from "@/app/actions/opd";
import { Button, FormMessage, Textarea } from "@/components/ui";
import { useActionToast, useToast } from "@/components/toast";
import { MicButton, appendText } from "@/components/voice-input";

export function SendRxButton({ visitId, sentAt }: { visitId: string; sentAt: string | null }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="success"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await sendPrescription(visitId);
          toast({ tone: res.ok ? "success" : "error", title: res.message });
        })
      }
      title={sentAt ? `Last sent ${sentAt}` : undefined}
    >
      <MessageCircle className="h-3.5 w-3.5" />
      {pending ? "Sending…" : sentAt ? "Send again" : "Send on WhatsApp"}
    </Button>
  );
}

export function AddendumForm({ visitId }: { visitId: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [state, action, pending] = useActionState<OpdFormState, FormData>(async (prev, fd) => {
    const res = await addAddendum(prev, fd);
    if (res.ok) {
      setText("");
      setOpen(false);
    }
    return res;
  }, {});
  useActionToast(state, "Addendum added");

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <NotebookPen className="h-3.5 w-3.5" /> Add addendum / correction
      </Button>
    );
  }
  return (
    <form action={action} className="space-y-2 rounded-xl bg-amber-50/50 p-3 ring-1 ring-amber-200">
      <FormMessage error={state.error} />
      <input type="hidden" name="visitId" value={visitId} />
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-amber-900">The original prescription stays unchanged; this note is added with your name and time.</span>
        <MicButton onText={(t) => setText((s) => appendText(s, t, ". "))} />
      </div>
      <Textarea name="text" rows={3} value={text} onChange={(e) => setText(e.target.value)} autoFocus placeholder="e.g. Correction: Amoxicillin dose should read 250 mg." />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Add addendum"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
