"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { analytics, useScrollDepthTracking, useTimeOnPageTracking } from "@/lib/analytics";

interface AnalyticsProviderProps {
  children: React.ReactNode;
}

export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Track page views
  useEffect(() => {
    const url = pathname + (searchParams?.toString() ? `?${searchParams}` : "");
    const pageTitle = document.title || "LenQuant";

    analytics.viewPage(pathname || "/", pageTitle);
  }, [pathname, searchParams]);

  // Track scroll depth
  useEffect(() => {
    const pageName = (pathname || "/").replace(/\//g, "_") || "home";
    const cleanupScroll = useScrollDepthTracking(pageName);
    const cleanupTime = useTimeOnPageTracking(pageName);

    return () => {
      cleanupScroll?.();
      cleanupTime?.();
    };
  }, [pathname]);

  return <>{children}</>;
}
