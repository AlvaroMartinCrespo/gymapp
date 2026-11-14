import Link from "next/link";
import { BottomBar } from "./bottom-bar";
import { Sidebar } from "./sidebar";
import { AuthStatus } from "./auth-status";
import { TimerProvider } from "@/components/timer/timer-provider";
import { TimerPill } from "@/components/timer/timer-pill";
import { CardioTimerPill } from "@/components/timer/cardio-timer-pill";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import { ToastProvider } from "@/components/ui/toast";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <TimerProvider>
      <ToastProvider>
      <ConfirmProvider>
        <div className="min-h-dvh">
          <Sidebar />
          {/* pt/pb respetan notch y barra inferior en PWA standalone */}
          <main className="mx-auto w-full max-w-3xl px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-0 md:ml-64 md:w-auto md:max-w-none md:px-10 md:pb-10">
            <div className="mx-auto max-w-3xl">
              <TimerPill />
              <CardioTimerPill />
              <header className="sticky top-0 z-30 -mx-4 mb-5 flex min-h-[calc(3.5rem+env(safe-area-inset-top))] items-center justify-between gap-2 border-b border-border bg-background/85 px-4 pt-[env(safe-area-inset-top)] text-sm backdrop-blur-xl md:mx-0 md:px-0">
                <Link href="/" className="flex shrink-0 items-center gap-2 text-lg font-semibold md:hidden">
                  <span aria-hidden="true" className="size-9 shrink-0 bg-[url('/icons/icon-192.png')] bg-cover bg-center" />
                  GymRat
                </Link>
                <AuthStatus />
              </header>
              {children}
            </div>
          </main>
          <BottomBar />
        </div>
      </ConfirmProvider>
      </ToastProvider>
    </TimerProvider>
  );
}
