"use client";

import { useAtom } from "jotai";
import { BarChart3, LayoutDashboard, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { activeStrategyIdsAtom } from "@/store";

const tabs = [
  { label: "Overview", icon: LayoutDashboard, href: "/" },
  { label: "Strategies", icon: BarChart3, href: "/strategy" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

export function BottomTabBar() {
  const pathname = usePathname();
  const [activeStrategyIds] = useAtom(activeStrategyIdsAtom);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-lg supports-[backdrop-filter]:bg-background/80 md:hidden">
      <div className="flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          const stratHref =
            tab.href === "/strategy" && activeStrategyIds.length > 0
              ? `/strategy/${activeStrategyIds[0]}`
              : tab.href === "/strategy"
                ? "/"
                : tab.href;

          return (
            <Link
              key={tab.href}
              href={stratHref}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <div className="relative">
                <tab.icon className="size-5" />
                {tab.href === "/strategy" && activeStrategyIds.length > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-emerald-500 text-[8px] font-bold text-white">
                    {activeStrategyIds.length}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
