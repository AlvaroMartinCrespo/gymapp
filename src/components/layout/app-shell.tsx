import { BottomBar } from "./bottom-bar";
import { Sidebar } from "./sidebar";
import { AppHeader } from "./app-header";
import { HeaderSlotProvider } from "./header-slot";
import { TimerProvider } from "@/components/timer/timer-provider";
import { TimerPill } from "@/components/timer/timer-pill";
import { TimerSheet } from "@/components/timer/timer-sheet";
import { CardioTimerPill } from "@/components/timer/cardio-timer-pill";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import { ToastProvider } from "@/components/ui/toast";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <TimerProvider>
      <ToastProvider>
      <ConfirmProvider>
        <HeaderSlotProvider>
        <div className="min-h-dvh">
          <Sidebar />
          {/* pt/pb respetan notch y barra inferior en PWA standalone */}
          <main className="mx-auto w-full max-w-3xl pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-0 md:ml-64 md:w-auto md:max-w-none md:px-10 md:pb-10">
            <div className="mx-auto max-w-3xl">
              <TimerPill />
              <CardioTimerPill />
              <AppHeader />
              {children}
            </div>
          </main>
          <BottomBar />
          <TimerSheet />
        </div>
        </HeaderSlotProvider>
      </ConfirmProvider>
      </ToastProvider>
    </TimerProvider>
  );
}
