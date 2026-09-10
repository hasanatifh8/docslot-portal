"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type FormState } from "@/app/actions/auth";
import { Button, Field, Input } from "@/components/ui";
import { Logo } from "@/components/brand";

export default function LoginPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, {});

  return (
    <div className="flex flex-1 items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo />
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Welcome back</h1>
            <p className="text-sm text-slate-500">Sign in to your clinic dashboard</p>
          </div>
        </div>

        <form
          action={action}
          className="space-y-4 rounded-2xl bg-white p-7 shadow-sm ring-1 ring-slate-200/70"
        >
          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-600/10">
              {state.error}
            </p>
          )}
          <Field label="Email">
            <Input name="email" type="email" autoComplete="email" required placeholder="you@clinic.com" />
          </Field>
          <Field label="Password">
            <Input name="password" type="password" autoComplete="current-password" required placeholder="••••••••" />
          </Field>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          New clinic?{" "}
          <Link href="/signup" className="font-medium text-brand-600 hover:text-brand-700">
            Start a free trial
          </Link>
        </p>
      </div>
    </div>
  );
}
