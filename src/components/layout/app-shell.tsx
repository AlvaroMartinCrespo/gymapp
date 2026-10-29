import { BottomBar } from "./bottom-bar";
import { Sidebar } from "./sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <Sidebar />
      {/* pt/pb respetan notch y barra inferior en PWA standalone */}
      <main className="mx-auto w-full max-w-3xl px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))] md:ml-64 md:max-w-none md:px-10 md:pb-10">
        <div className="mx-auto max-w-3xl">{children}</div>
      </main>
      <BottomBar />
    </div>
  );
}
