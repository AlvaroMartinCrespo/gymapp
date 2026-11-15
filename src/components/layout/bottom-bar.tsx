"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { MoreMenu } from "./more-menu";
import { BOTTOM_BAR_ITEMS, isActive } from "./nav-items";

export function BottomBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/85 pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] backdrop-blur-xl md:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2">
        {BOTTOM_BAR_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon
                  className={cn("size-5", active && "drop-shadow-[0_0_8px_var(--primary)]")}
                />
                {label}
              </Link>
            </li>
          );
        })}
        <li className="flex-1"><MoreMenu /></li>
      </ul>
    </nav>
  );
}
