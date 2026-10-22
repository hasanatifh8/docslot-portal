"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardPlus } from "@/components/icons";
import { Button } from "@/components/ui";
import { CheckInDrawer, CheckInPanel, type QueueDoctor } from "@/components/checkin-panel";
import type { PickedPatient } from "@/components/patient-picker";

/** "Check in" button + drawer. Opens itself for ?checkin=1 links (from the "New" menu, wizard, palette). */
export function CheckInLauncher({
  doctors,
  canCollect,
  initialPatient = null,
  label = "Check in patient",
  autoOpen = false,
  size = "md",
  className,
}: {
  doctors: QueueDoctor[];
  canCollect: boolean;
  initialPatient?: PickedPatient | null;
  label?: string;
  autoOpen?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [open, setOpen] = useState(autoOpen);
  const close = useCallback(() => {
    setOpen(false);
    if (sp.get("checkin")) router.replace(window.location.pathname);
  }, [router, sp]);

  return (
    <>
      <Button size={size} onClick={() => setOpen(true)} className={className}>
        <ClipboardPlus className="h-4 w-4" />
        {label}
      </Button>
      <CheckInDrawer open={open} onClose={close}>
        <CheckInPanel doctors={doctors} canCollect={canCollect} initialPatient={initialPatient} onClose={close} />
      </CheckInDrawer>
    </>
  );
}
