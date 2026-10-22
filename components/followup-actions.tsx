"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { BellRing } from "@/components/icons";
import { closeFollowUp, sendFollowUpReminder } from "@/app/actions/followups";
import { Button } from "@/components/ui";
import { useToast } from "@/components/toast";

export function FollowUpActions({ visitId, reminded }: { visitId: string; reminded: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await sendFollowUpReminder(visitId);
            toast({ tone: res.ok ? "success" : "error", title: res.message });
            router.refresh();
          })
        }
      >
        <BellRing className="h-3.5 w-3.5" /> {reminded ? "Remind again" : "WhatsApp reminder"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        title="Patient contacted / no longer needed"
        onClick={() =>
          start(async () => {
            await closeFollowUp(visitId, "marked done from follow-up desk");
            toast({ tone: "success", title: "Follow-up closed" });
            router.refresh();
          })
        }
      >
        <CheckCheck className="h-3.5 w-3.5" /> Done
      </Button>
    </>
  );
}
