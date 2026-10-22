"use client";

import { useActionState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { platformLoginAction, type PlatformLoginState } from "@/app/actions/platform";
import { AuthShell, Button, Field, Input } from "@/components/ui";
import { Logo } from "@/components/brand";

export default function PlatformLoginPage() {
  const [state, action, pending] = useActionState<PlatformLoginState, FormData>(platformLoginAction, {});

  return (
    <AuthShell>
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <Logo className="h-8" />
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Platform admin</h1>
          <p className="text-sm text-slate-500">Manage hospitals on this DocSlot installation</p>
        </div>
      </div>

      <form
        action={action}
        className="shadow-care space-y-4 rounded-2xl bg-white p-7 ring-1 ring-brand-900/[0.06]"
      >
        {state.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-600/10">
            {state.error}
          </p>
        )}
        <Field label="Username" icon={ShieldCheck}>
          <Input name="username" autoComplete="username" required />
        </Field>
        <Field label="Password" icon={Lock}>
          <Input name="password" type="password" autoComplete="current-password" required placeholder="••••••••" />
        </Field>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}
