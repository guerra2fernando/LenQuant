/* eslint-disable */
// @ts-nocheck
import { SessionProvider, useSession } from "next-auth/react";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { useEffect } from "react";

import { NotificationProvider } from "@/components/NotificationCenter";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { ModeProvider } from "@/lib/mode-context";
import { Layout } from "../components/Layout";
import "../styles/globals.css";

function Auth({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isLoading = status === "loading";
  const isUnauthenticated = status === "unauthenticated";

  useEffect(() => {
    if (isUnauthenticated) {
      router.push("/login");
    }
  }, [isUnauthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (isUnauthenticated) {
    return null;
  }

  return <>{children}</>;
}

function BrowserNotificationPermission() {
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        // Request permission when app loads
        Notification.requestPermission().catch((err) => {
          console.error("Failed to request notification permission:", err);
        });
      }
    }
  }, []);

  return null;
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <SessionProvider session={pageProps.session}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="cryptotrader-theme">
        <ModeProvider>
          <NotificationProvider>
            <BrowserNotificationPermission />
            {/* @ts-ignore */}
            {Component.auth === false ? (
              <Component {...pageProps} />
            ) : (
              <Auth>
                <Layout title={pageProps.title} description={pageProps.description}>
                  <Component {...pageProps} />
                </Layout>
              </Auth>
            )}
            <Toaster />
          </NotificationProvider>
        </ModeProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}