"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff } from "lucide-react";
import { changePassword, type PasswordState } from "@/app/actions/auth";
import { Button, Field, FormMessage, Input, cn } from "@/components/ui";
import { useActionToast } from "@/components/toast";

/** Live password rules: shown as a checklist so mistakes are caught while typing. */
export function PasswordForm({ forced = false }: { forced?: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<PasswordState, FormData>(async (prev, fd) => {
    const res = await changePassword(prev, fd);
    if (res.ok && forced) router.refresh();
    return res;
  }, {});
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  useActionToast(state, "Password changed");

  const rules = [
    { ok: next.length >= 8, label: "At least 8 characters" },
    { ok: /[A-Za-z]/.test(next) && /\d/.test(next), label: "Letters and numbers" },
    { ok: next.length > 0 && next === confirm, label: "Both new passwords match" },
  ];

  return (
    <form action={action} key={state.ok ? "done" : "form"} className="max-w-md space-y-4">
      <FormMessage error={state.error} success={state.ok && "Your password has been changed."} />
      <Field label="Current password" hint={forced ? "The temporary password you were given" : undefined}>
        <Input name="current" type="password" autoComplete="current-password" required />
      </Field>
      <Field label="New password">
        <div className="relative">
          <Input
            name="next"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            required
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-600"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </Field>
      <Field label="Confirm new password">
        <Input
          name="confirm"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          aria-invalid={confirm.length > 0 && confirm !== next}
        />
      </Field>
      <ul className="space-y-1 text-xs">
        {rules.map((r) => (
          <li key={r.label} className={cn("flex items-center gap-2", r.ok ? "text-emerald-700" : "text-slate-400")}>
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-full ring-1",
                r.ok ? "bg-emerald-500 text-white ring-emerald-500" : "ring-slate-300"
              )}
            >
              {r.ok && <Check className="h-3 w-3" />}
            </span>
            {r.label}
          </li>
        ))}
      </ul>
      <Button type="submit" disabled={pending || !rules.every((r) => r.ok)}>
        {pending ? "Saving…" : forced ? "Set my password & continue" : "Change password"}
      </Button>
    </form>
  );
}
