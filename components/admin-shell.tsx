import Link from "next/link";
import { LogOut } from "@/components/icons";
import { platformLogoutAction } from "@/app/actions/platform";
import { Badge, Button } from "@/components/ui";
import { Logo } from "@/components/brand";
import { ToastProvider } from "@/components/toast";

/** Frame for the platform console (/admin): header, backdrop, toasts. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="flex flex-1 flex-col">
        <div aria-hidden className="app-backdrop" />
        <header className="glass sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-white/70 px-4 sm:px-8">
          <Link href="/admin" className="flex items-center gap-3">
            <Logo />
            <Badge tone="brand">Platform console</Badge>
          </Link>
          <form action={platformLogoutAction}>
            <Button variant="secondary" size="sm">
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </form>
        </header>
        <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </ToastProvider>
  );
}
