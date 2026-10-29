import Link from "next/link";
import { BottomBar } from "./bottom-bar";
import { Sidebar } from "./sidebar";
import { AuthStatus } from "./auth-status";
import { TimerProvider } from "@/components/timer/timer-provider";
import { TimerPill } from "@/components/timer/timer-pill";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <TimerProvider>
      <div className="min-h-dvh">
        <Sidebar />
        {/* pt/pb respetan notch y barra inferior en PWA standalone */}
        <main className="mx-auto w-full max-w-3xl px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))] md:ml-64 md:w-auto md:max-w-none md:px-10 md:pb-10">
          <div className="mx-auto max-w-3xl">
            <Link href="/" className="mb-5 flex w-fit items-center gap-2 text-lg font-semibold md:hidden">
              <span aria-hidden="true" className="size-9 shrink-0 bg-[url('/icons/icon-192.png')] bg-cover bg-center" />
              GymRat
            </Link>
            <TimerPill />
            <AuthStatus />
            {children}
          </div>
        </main>
        <BottomBar />
      </div>
    </TimerProvider>
  );
}
