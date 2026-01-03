// Google Analytics 4 Event Tracking Utilities
// Measurement ID should be set in environment variable

type GAEvent = {
  action: string;
  category: string;
  label?: string;
  value?: number;
};

type GAEventParams = Record<string, string | number | boolean | undefined>;

// Check if GA is loaded
const isGALoaded = (): boolean => {
  return typeof window !== "undefined" && typeof window.gtag === "function";
};

// Track custom events
export const trackEvent = ({ action, category, label, value }: GAEvent): void => {
  if (!isGALoaded()) {
    if (process.env.NODE_ENV === "development") {
      console.log("[GA Debug]", { action, category, label, value });
    }
    return;
  }

  window.gtag("event", action, {
    event_category: category,
    event_label: label,
    value: value,
  });
};

// Track custom event with custom parameters
export const trackCustomEvent = (
  eventName: string,
  params: GAEventParams
): void => {
  if (!isGALoaded()) {
    if (process.env.NODE_ENV === "development") {
      console.log("[GA Debug]", eventName, params);
    }
    return;
  }

  window.gtag("event", eventName, params);
};

// Set user properties
export const setUserProperties = (properties: GAEventParams): void => {
  if (!isGALoaded()) return;

  window.gtag("set", "user_properties", properties);
};

// Pre-defined events for LenQuant
export const analytics = {
  // ============================================
  // CTA CLICKS
  // ============================================

  clickInstallExtension: (location: string) => {
    trackCustomEvent("click_install_extension", {
      location, // "hero", "header", "footer_cta", "pricing", etc.
      page_path: typeof window !== "undefined" ? window.location.pathname : "",
    });
  },

  clickStartTrial: (tier: string) => {
    trackCustomEvent("click_start_trial", {
      tier, // "pro", "premium"
      page_path: typeof window !== "undefined" ? window.location.pathname : "",
    });
  },

  clickGetPlan: (tier: string, billing: "monthly" | "yearly") => {
    trackCustomEvent("click_get_plan", {
      tier,
      billing,
    });
  },

  clickLogin: (location: string = "header") => {
    trackCustomEvent("click_login", {
      location,
    });
  },

  clickAccessPlatform: (location: string) => {
    trackCustomEvent("click_access_platform", {
      location,
    });
  },

  // ============================================
  // NAVIGATION
  // ============================================

  viewPage: (pageName: string, pageTitle: string) => {
    trackCustomEvent("page_view_custom", {
      page_name: pageName,
      page_title: pageTitle,
      page_path: typeof window !== "undefined" ? window.location.pathname : "",
    });
  },

  clickNavLink: (linkName: string, destination: string = "") => {
    trackCustomEvent("click_nav_link", {
      link_name: linkName,
      destination,
    });
  },

  clickFooterLink: (linkName: string) => {
    trackCustomEvent("click_footer_link", {
      link_name: linkName,
    });
  },

  // ============================================
  // ENGAGEMENT
  // ============================================

  watchVideo: (videoName: string, action: "play" | "pause" | "complete", percentWatched?: number) => {
    trackCustomEvent("video_engagement", {
      video_name: videoName,
      action,
      percent_watched: percentWatched,
    });
  },

  expandFAQ: (question: string, index: number) => {
    trackCustomEvent("expand_faq", {
      question: question.substring(0, 100), // Limit length
      faq_index: index,
    });
  },

  viewScreenshot: (screenshotId: string, screenshotName: string) => {
    trackCustomEvent("view_screenshot", {
      screenshot_id: screenshotId,
      screenshot_name: screenshotName,
    });
  },

  scrollDepth: (percentage: number, pageName: string) => {
    trackCustomEvent("scroll_depth", {
      percent: percentage,
      page_name: pageName,
    });
  },

  timeOnPage: (seconds: number, pageName: string) => {
    trackCustomEvent("time_on_page", {
      seconds,
      page_name: pageName,
    });
  },

  clickFeature: (featureName: string) => {
    trackCustomEvent("click_feature", {
      feature_name: featureName,
    });
  },

  switchPricingBilling: (billing: "monthly" | "yearly") => {
    trackCustomEvent("switch_pricing_billing", {
      billing,
    });
  },

  // ============================================
  // CONVERSIONS
  // ============================================

  signUp: (method: string) => {
    trackCustomEvent("sign_up", {
      method, // "google", "email"
    });
  },

  login: (method: string) => {
    trackCustomEvent("login", {
      method,
    });
  },

  beginCheckout: (tier: string, price: number, billing: string) => {
    trackCustomEvent("begin_checkout", {
      tier,
      price,
      billing,
      currency: "USD",
    });
  },

  purchase: (tier: string, price: number, billing: string, transactionId: string) => {
    trackCustomEvent("purchase", {
      tier,
      value: price,
      billing,
      currency: "USD",
      transaction_id: transactionId,
    });
  },

  extensionInstalled: (source: string) => {
    trackCustomEvent("extension_installed", {
      source,
    });
  },

  trialStarted: (tier: string) => {
    trackCustomEvent("trial_started", {
      tier,
    });
  },

  trialEnded: (tier: string, converted: boolean) => {
    trackCustomEvent("trial_ended", {
      tier,
      converted,
    });
  },

  // ============================================
  // ERRORS
  // ============================================

  error: (errorType: string, errorMessage: string, location: string) => {
    trackCustomEvent("error", {
      error_type: errorType,
      error_message: errorMessage.substring(0, 200),
      location,
    });
  },

  // ============================================
  // SOCIAL
  // ============================================

  clickSocialLink: (platform: string) => {
    trackCustomEvent("click_social_link", {
      platform, // "twitter", "discord", "github"
    });
  },

  share: (contentType: string, method: string) => {
    trackCustomEvent("share", {
      content_type: contentType,
      method,
    });
  },
};

// Scroll depth tracking hook
export function useScrollDepthTracking(pageName: string) {
  if (typeof window === "undefined") return;

  const thresholds = [25, 50, 75, 90, 100];
  const reached = new Set<number>();

  const handleScroll = () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = Math.round((scrollTop / docHeight) * 100);

    thresholds.forEach((threshold) => {
      if (scrollPercent >= threshold && !reached.has(threshold)) {
        reached.add(threshold);
        analytics.scrollDepth(threshold, pageName);
      }
    });
  };

  window.addEventListener("scroll", handleScroll, { passive: true });

  return () => window.removeEventListener("scroll", handleScroll);
}

// Time on page tracking
export function useTimeOnPageTracking(pageName: string) {
  if (typeof window === "undefined") return;

  const startTime = Date.now();
  const intervals = [30, 60, 120, 300]; // seconds
  const reported = new Set<number>();

  const checkTime = () => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);

    intervals.forEach((interval) => {
      if (elapsed >= interval && !reported.has(interval)) {
        reported.add(interval);
        analytics.timeOnPage(interval, pageName);
      }
    });
  };

  const intervalId = setInterval(checkTime, 10000); // Check every 10 seconds

  return () => clearInterval(intervalId);
}

// TypeScript declaration for window.gtag
declare global {
  interface Window {
    gtag: (
      command: "event" | "config" | "js" | "set",
      targetId: string | Date,
      config?: Record<string, unknown>
    ) => void;
    dataLayer: unknown[];
  }
}
