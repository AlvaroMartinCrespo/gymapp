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
