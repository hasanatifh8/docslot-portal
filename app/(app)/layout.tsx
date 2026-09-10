import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";

const nav = [
  { href: "/dashboard", label: "Today" },
  { href: "/appointments", label: "Appointments" },
  { href: "/doctors", label: "Doctors & hours" },
  { href: "/settings", label: "Settings" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex flex-1">
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="text-sm font-semibold">DocSlot</div>
          <div className="truncate text-xs text-slate-500">{user.clinic.name}</div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <form action={logoutAction} className="border-t border-slate-200 p-3">
          <div className="mb-2 truncate px-3 text-xs text-slate-500">{user.email}</div>
          <button className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100">
            Sign out
          </button>
        </form>
      </aside>
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
