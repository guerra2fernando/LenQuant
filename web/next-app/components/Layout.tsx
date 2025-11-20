/* eslint-disable */
// @ts-nocheck
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import type { ReactNode } from "react";
import { LogOut, User } from "lucide-react";

import { NotificationCenter } from "@/components/NotificationCenter";
import { ModeToggle } from "@/components/ModeToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SEO } from "@/components/SEO";
import { useMode } from "@/lib/mode-context";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  title?: string;
  description?: string;
};

const EASY_MODE_NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/terminal", label: "Terminal" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/trading", label: "Trading" },
  { href: "/insights", label: "Insights" },
  { href: "/assistant", label: "Assistant" },
  { href: "/settings", label: "Settings" },
] as const;

const ADVANCED_MODE_NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/terminal", label: "Terminal" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/trading", label: "Trading" },
  { href: "/analytics", label: "Analytics" },
  { href: "/assistant", label: "Assistant" },
  { href: "/knowledge", label: "Knowledge" },
  { href: "/settings", label: "Settings" },
] as const;

export function Layout({ children, title, description }: Props) {
  const router = useRouter();
  const pathname = router.pathname;
  const { isEasyMode } = useMode();
  const { data: session } = useSession();

  const navItems = isEasyMode ? EASY_MODE_NAV_ITEMS : ADVANCED_MODE_NAV_ITEMS;

  const isActive = (href: (typeof navItems)[number]["href"]) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push("/login");
  };

  return (
    <>
      <SEO title={title} description={description} />
      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b bg-card">
        <div className="container flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Image
                src="/images/logo.png"
                alt="LenQuant Logo"
                width={32}
                height={32}
                className="object-contain"
              />
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
            
            {/* User Menu */}
            {session?.user && (
              <div className="flex items-center gap-3 pl-3 border-l border-border">
                <div className="flex items-center gap-2">
                  {session.user.picture ? (
                    <img
                      src={session.user.picture}
                      alt={session.user.name}
                      className="h-8 w-8 rounded-full"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">
                      {session.user.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {session.user.email}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-md hover:bg-accent transition-colors"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
        </header>
        <main className="container py-8">{children}</main>
      </div>
    </>
  );
}

