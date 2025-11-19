/* eslint-disable */
// @ts-nocheck
import Link from "next/link";
import { useRouter } from "next/router";
import type { ReactNode } from "react";

import { NotificationCenter } from "@/components/NotificationCenter";
import { ModeToggle } from "@/components/ModeToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useMode } from "@/lib/mode-context";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
};

const EASY_MODE_NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/trading", label: "Trading" },
  { href: "/insights", label: "Insights" },
  { href: "/assistant", label: "Assistant" },
  { href: "/settings", label: "Settings" },
] as const;

const ADVANCED_MODE_NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/trading", label: "Trading" },
  { href: "/analytics", label: "Analytics" },
  { href: "/assistant", label: "Assistant" },
  { href: "/knowledge", label: "Knowledge" },
  { href: "/settings", label: "Settings" },
] as const;

export function Layout({ children }: Props) {
  const router = useRouter();
  const pathname = router.pathname;
  const { isEasyMode } = useMode();

  const navItems = isEasyMode ? EASY_MODE_NAV_ITEMS : ADVANCED_MODE_NAV_ITEMS;

  const isActive = (href: (typeof navItems)[number]["href"]) => {
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
              LenQuant
            </Link>
            <nav className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              {navItems.map((item) => (
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
            <ModeToggle />
            <NotificationCenter />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="container py-8">{children}</main>
    </div>
  );
}

