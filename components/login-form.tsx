"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Eye, EyeOff, Loader2, LockKeyhole, Mail } from "lucide-react";
import { Info } from "@/components/icons";
import { loginAction, type FormState } from "@/app/actions/auth";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white/90 py-3 pl-10 text-sm font-medium text-slate-800 shadow-sm transition-all placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-500/30 focus:outline-none";

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, {});
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-red-600/10 ring-inset">
          {state.error}
        </p>
      )}

      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-xs font-semibold tracking-wide text-slate-700">
          Work email
        </label>
        <div className="group relative">
          <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-[18px] w-[18px] -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-teal-600" />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="name@hospital.com"
            className={`${inputClass} pr-4`}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="block text-xs font-semibold tracking-wide text-slate-700">
            Password
          </label>
          <button
            type="button"
            onClick={() => setShowForgot((v) => !v)}
            className="text-xs font-medium text-teal-600 transition-colors hover:text-teal-800"
          >
            Forgot?
          </button>
        </div>
        <div className="group relative">
          <LockKeyhole className="pointer-events-none absolute top-1/2 left-3.5 h-[18px] w-[18px] -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-teal-600" />
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="••••••••••••"
            className={`${inputClass} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 transition-colors hover:text-slate-600"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-[18px] w-[18px] text-teal-600" /> : <Eye className="h-[18px] w-[18px]" />}
          </button>
        </div>
        {showForgot && (
          <p className="flex items-start gap-2 rounded-xl bg-teal-50 px-3 py-2 text-xs text-teal-800 ring-1 ring-teal-600/10 ring-inset">
            <Info className="mt-px h-3.5 w-3.5 shrink-0" />
            Ask your hospital administrator to reset it from the Staff page.
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600 px-4 py-3.5 text-sm font-bold tracking-wide text-white shadow-lg shadow-teal-700/25 transition-all hover:from-teal-800 hover:via-teal-700 hover:to-emerald-700 active:scale-[0.98] disabled:opacity-80"
      >
        {pending ? (
          <>
            Signing in…
            <Loader2 className="h-4 w-4 animate-spin" />
          </>
        ) : (
          <>
            Sign in to your workspace
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </form>
  );
}
