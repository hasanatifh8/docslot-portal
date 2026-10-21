"use client";

import { useActionState } from "react";
import { Hospital, Lock, Mail, UserRound } from "lucide-react";
import Link from "next/link";
import { signupAction, type FormState } from "@/app/actions/auth";
import { AuthShell, Button, Field, Input } from "@/components/ui";
import { Logo } from "@/components/brand";
import { AuthHero } from "@/components/auth-hero";

export default function SignupPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(signupAction, {});

  return (
    <AuthShell hero={<AuthHero />}>
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <Logo className="h-8" />
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Start your DocSlot HMS trial</h1>
          <p className="text-sm text-slate-500">Set up your hospital in under a minute</p>
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
        <Field label="Hospital name" icon={Hospital}>
          <Input name="clinicName" required placeholder="Sunrise Multispeciality Hospital" />
        </Field>
        <Field label="Your name" icon={UserRound}>
          <Input name="name" required placeholder="Dr. Mehra" />
        </Field>
        <Field label="Work email" icon={Mail}>
          <Input name="email" type="email" autoComplete="email" required placeholder="you@clinic.com" />
        </Field>
        <Field label="Password" icon={Lock} hint="At least 8 characters">
          <Input name="password" type="password" autoComplete="new-password" required placeholder="••••••••" />
        </Field>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Creating…" : "Create account"}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
