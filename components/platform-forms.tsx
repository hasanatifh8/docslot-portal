"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Pencil, X } from "lucide-react";
import {
  addHospitalUser,
  resetUserPassword,
  setUserActive,
  updateHospitalDetails,
  updateUser,
  type PlatformResult,
} from "@/app/actions/platform-hospitals";
import { Banner, Button, Field, FormMessage, Input, Select } from "@/components/ui";
import { useActionToast, useToast } from "@/components/toast";
import { ROLES, ROLE_LABELS } from "@/lib/rbac";

/** Shown once after a reset / new user — the password is never stored in clear. */
function TempPassword({ value, label, onClose }: { value: string; label: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="step-in rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-300">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-amber-900">{label}</p>
          <p className="text-xs text-amber-800">Share it securely (call or in person). It&apos;s shown only now; they must choose their own at first sign-in.</p>
        </div>
        <button type="button" onClick={onClose} className="text-amber-700 hover:text-amber-900" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <code className="tabular rounded-lg bg-white px-3 py-2 font-mono text-lg font-bold tracking-wider text-slate-900 ring-1 ring-amber-200">{value}</code>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            navigator.clipboard?.writeText(value);
            setCopied(true);
          }}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

export function HospitalDetailsForm({
  hospital,
}: {
  hospital: { id: string; name: string; code: string; phone: string | null; addressText: string | null; timezone: string; monthlyTarget: string };
}) {
  const [state, action, pending] = useActionState<PlatformResult, FormData>(updateHospitalDetails, {});
  useActionToast(state, "Hospital details saved");
  return (
    <form action={action} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormMessage error={state.error} className="sm:col-span-2" />
      <input type="hidden" name="id" value={hospital.id} />
      <Field label="Hospital name">
        <Input name="name" defaultValue={hospital.name} required />
      </Field>
      <Field label="Booking code" hint="Patients send this on WhatsApp; changing it breaks old links">
        <Input name="code" defaultValue={hospital.code} required className="font-mono" />
      </Field>
      <Field label="Reception phone">
        <Input name="phone" defaultValue={hospital.phone ?? ""} inputMode="tel" />
      </Field>
      <Field label="Timezone">
        <Input name="timezone" defaultValue={hospital.timezone} required />
      </Field>
      <Field label="Address" className="sm:col-span-2">
        <Input name="addressText" defaultValue={hospital.addressText ?? ""} />
      </Field>
      <Field label="Monthly collection target (₹)">
        <Input name="monthlyTarget" defaultValue={hospital.monthlyTarget} inputMode="decimal" className="tabular" />
      </Field>
      <div className="flex items-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save details"}
        </Button>
      </div>
    </form>
  );
}

export type PlatformUser = { id: string; name: string; email: string; role: string; active: boolean; mustChangePassword: boolean };

/** One staff row: edit, reset password, activate/deactivate. */
export function UserControls({ user }: { user: PlatformUser }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [state, action, saving] = useActionState<PlatformResult, FormData>(async (prev, fd) => {
    const res = await updateUser(prev, fd);
    if (res.ok) {
      setEditing(false);
      router.refresh();
    }
    return res;
  }, {});
  useActionToast(state, "User saved");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button variant="ghost" size="sm" onClick={() => setEditing((e) => !e)}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await resetUserPassword(user.id);
              if (res.error) return setError(res.error);
              setTemp(res.tempPassword ?? null);
              router.refresh();
            })
          }
        >
          <KeyRound className="h-3.5 w-3.5" /> Reset password
        </Button>
        <Button
          variant={user.active ? "danger" : "secondary"}
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await setUserActive(user.id, !user.active);
              if (res.error) return setError(res.error);
              toast({ tone: "success", title: res.message ?? "Updated" });
              router.refresh();
            })
          }
        >
          {user.active ? "Deactivate" : "Reactivate"}
        </Button>
      </div>
      {error && <Banner tone="danger">{error}</Banner>}
      {temp && <TempPassword value={temp} label={`New temporary password for ${user.email}`} onClose={() => setTemp(null)} />}
      {editing && (
        <form action={action} className="step-in grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_1.3fr_1fr_auto]">
          <FormMessage error={state.error} className="sm:col-span-4" />
          <input type="hidden" name="id" value={user.id} />
          <Input name="name" defaultValue={user.name} aria-label="Name" required />
          <Input name="email" type="email" defaultValue={user.email} aria-label="Email" required />
          <Select name="role" defaultValue={user.role} aria-label="Role">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
          <Button type="submit" size="md" disabled={saving}>
            Save
          </Button>
        </form>
      )}
    </div>
  );
}

export function AddUserForm({ clinicId }: { clinicId: string }) {
  const router = useRouter();
  const [temp, setTemp] = useState<{ pw: string; label: string } | null>(null);
  const [state, action, pending] = useActionState<PlatformResult, FormData>(async (prev, fd) => {
    const res = await addHospitalUser(prev, fd);
    if (res.ok && res.tempPassword) {
      setTemp({ pw: res.tempPassword, label: res.message ?? "Temporary password" });
      router.refresh();
    }
    return res;
  }, {});
  return (
    <div className="space-y-3">
      {temp && <TempPassword value={temp.pw} label={temp.label} onClose={() => setTemp(null)} />}
      <form key={state.savedAt ?? 0} action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.3fr_1fr_auto]">
        <FormMessage error={state.error} className="sm:col-span-4" />
        <input type="hidden" name="clinicId" value={clinicId} />
        <Field label="Name">
          <Input name="name" required />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" required />
        </Field>
        <Field label="Role">
          <Select name="role" defaultValue="admin">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex items-end">
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Adding…" : "Add user"}
          </Button>
        </div>
      </form>
    </div>
  );
}
