"use client";

import { useActionState } from "react";
import { Lock, Mail } from "lucide-react";
import { loginAction, type FormState } from "@/app/actions/auth";
import { AuthShell, Button, Field, Input } from "@/components/ui";
import { Logo } from "@/components/brand";
import { AuthHero } from "@/components/auth-hero";

export default function LoginPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, {});

  return (
    <AuthShell hero={<AuthHero />}>
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <Logo className="h-8" />
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Welcome back</h1>
          <p className="text-sm text-slate-500">Sign in to your hospital dashboard</p>
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
        <Field label="Email" icon={Mail}>
          <Input name="email" type="email" autoComplete="email" required placeholder="you@clinic.com" />
        </Field>
        <Field label="Password" icon={Lock}>
          <Input name="password" type="password" autoComplete="current-password" required placeholder="••••••••" />
        </Field>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500">
        Need an account? Ask your hospital administrator.
      </p>
    </AuthShell>
  );
}
