/* eslint-disable */
// @ts-nocheck
import Link from "next/link";
import { useRouter } from "next/router";
import type { ReactNode } from "react";

import { NotificationCenter } from "@/components/NotificationCenter";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
};

const NAV_ITEMS = [
  { href: "/", label: "Overview" },
  { href: "/assistant", label: "Assistant" },
  { href: "/forecasts", label: "Forecasts" },
  { href: "/trading", label: "Trading" },
  { href: "/risk", label: "Risk" },
  { href: "/models/registry", label: "Model Registry" },
  { href: "/strategies", label: "Strategies" },
  { href: "/evolution", label: "Evolution" },
  { href: "/knowledge", label: "Knowledge" },
  { href: "/insights", label: "Learning Insights" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
] as const;

export function Layout({ children }: Props) {
  const router = useRouter();
  const pathname = router.pathname;

  const isActive = (href: (typeof NAV_ITEMS)[number]["href"]) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="container flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-lg font-semibold text-foreground">
              Lenxys Trader
            </Link>
            <nav className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-md px-3 py-1.5 transition-colors hover:text-foreground",
                    isActive(item.href) && "bg-primary/10 text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <NotificationCenter />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="container py-8">{children}</main>
    </div>
  );
}

