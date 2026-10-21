"use client";

import { useActionState, useState } from "react";
import { addStaff, resetStaffPassword, updateStaffRole, type StaffFormState } from "@/app/actions/staff";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/rbac";
import { Button, Field, FormMessage, Input, Select } from "@/components/ui";

type Doctor = { id: string; name: string; linked: boolean };

function RoleAndDoctor({
  doctors,
  role: initialRole,
  doctorId,
  compact,
}: {
  doctors: Doctor[];
  role?: string;
  doctorId?: string | null;
  compact?: boolean;
}) {
  const [role, setRole] = useState(initialRole ?? "");
  const roleSelect = (
    <Select name="role" required value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
      <option value="" disabled>
        Select…
      </option>
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABELS[r as Role]}
        </option>
      ))}
    </Select>
  );
  const doctorSelect = role === "doctor" && (
    <Select name="doctorId" required defaultValue={doctorId ?? ""} aria-label="Doctor profile">
      <option value="" disabled>
        Doctor profile…
      </option>
      {doctors.map((d) => (
        <option key={d.id} value={d.id} disabled={d.linked && d.id !== doctorId}>
          {d.name}
          {d.linked && d.id !== doctorId ? " (has login)" : ""}
        </option>
      ))}
    </Select>
  );
  if (compact) {
    return (
      <>
        <div className="w-40">{roleSelect}</div>
        {doctorSelect && <div className="w-44">{doctorSelect}</div>}
      </>
    );
  }
  return (
    <>
      <Field label="Role">{roleSelect}</Field>
      {doctorSelect ? (
        <Field label="Doctor profile" hint="Senior doctors consult only their own patients">
          {doctorSelect}
        </Field>
      ) : (
        <div className="hidden sm:block" />
      )}
    </>
  );
}

export function AddStaffForm({ doctors }: { doctors: Doctor[] }) {
  const [state, action, pending] = useActionState<StaffFormState, FormData>(addStaff, {});

  // Re-key on each successful create so the fields (and role select state) reset.
  return (
    <form key={state.savedAt ?? 0} action={action} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormMessage error={state.error} success={state.ok && "Staff account created."} className="sm:col-span-2" />
      <Field label="Name">
        <Input name="name" required placeholder="Anita Desai" />
      </Field>
      <Field label="Email" hint="Used to sign in">
        <Input name="email" type="email" required placeholder="anita@hospital.com" />
      </Field>
      <Field label="Temporary password" hint="At least 8 characters — share it securely">
        <Input name="password" type="text" required minLength={8} autoComplete="off" />
      </Field>
      <div className="hidden sm:block" />
      <RoleAndDoctor doctors={doctors} />
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Add staff member"}
        </Button>
      </div>
    </form>
  );
}

export function RoleForm({
  userId,
  role,
  doctorId,
  doctors,
}: {
  userId: string;
  role: string;
  doctorId: string | null;
  doctors: Doctor[];
}) {
  const [state, action, pending] = useActionState<StaffFormState, FormData>(updateStaffRole, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={userId} />
      <div className="flex flex-wrap items-center gap-2">
        <RoleAndDoctor doctors={doctors} role={role} doctorId={doctorId} compact />
        <Button variant="secondary" size="sm" disabled={pending}>
          Update role
        </Button>
      </div>
      <FormMessage error={state.error} success={state.ok && "Role updated."} />
    </form>
  );
}

export function ResetPasswordForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState<StaffFormState, FormData>(resetStaffPassword, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={userId} />
      <div className="flex flex-wrap items-center gap-2">
        <Input name="password" type="text" minLength={8} required placeholder="New password" autoComplete="off" className="h-8 w-44 text-xs" />
        <Button variant="secondary" size="sm" disabled={pending}>
          Reset password
        </Button>
      </div>
      <FormMessage error={state.error} success={state.ok && "Password reset."} />
    </form>
  );
}
