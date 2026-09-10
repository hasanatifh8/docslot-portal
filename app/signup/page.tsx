"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signupAction, type FormState } from "@/app/actions/auth";

export default function SignupPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(signupAction, {});

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <form action={action} className="w-full max-w-sm space-y-4 rounded-xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <div>
          <h1 className="text-xl font-semibold">Start your DocSlot trial</h1>
          <p className="text-sm text-slate-500">Set up your clinic in a minute</p>
        </div>
        {state.error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
        )}
        <Field label="Clinic name" name="clinicName" placeholder="Sunrise Dental Clinic" />
        <Field label="Your name" name="name" placeholder="Dr. Mehra" />
        <Field label="Work email" name="email" type="email" autoComplete="email" />
        <Field label="Password" name="password" type="password" autoComplete="new-password" />
        <button
          disabled={pending}
          className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create account"}
        </button>
        <p className="text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-indigo-600">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      <input
        {...props}
        required
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
      />
    </label>
  );
}
