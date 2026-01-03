import type { Metadata } from "next";

interface SEOParams {
  title: string;
  description: string;
  path: string;
  image?: string;
  noIndex?: boolean;
  keywords?: string[];
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
}

// Default keywords for the entire site
const defaultKeywords = [
  "binance futures",
  "crypto trading",
  "trading assistant",
  "leverage calculator",
  "market analysis",
  "AI trading",
  "chrome extension",
  "trading discipline",
  "regime detection",
  "cryptocurrency",
  "trading tools",
  "risk management",
];

const baseUrl = "https://lenquant.com";
const siteName = "LenQuant";
const twitterHandle = "@lenquant";

export function generateSEO({
  title,
  description,
  path,
  image = "/images/og/default.png",
  noIndex = false,
  keywords = [],
  type = "website",
  publishedTime,
  modifiedTime,
}: SEOParams): Metadata {
  const url = `${baseUrl}${path}`;
  const fullImageUrl = image.startsWith("http") ? image : `${baseUrl}${image}`;
  const allKeywords = Array.from(new Set([...defaultKeywords, ...keywords]));

  return {
    title,
    description,
    keywords: allKeywords,
    robots: noIndex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-video-preview": -1,
            "max-image-preview": "large",
            "max-snippet": -1,
          },
        },
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName,
      images: [
        {
          url: fullImageUrl,
          width: 1200,
          height: 630,
          alt: title,
          type: "image/png",
        },
      ],
      type,
      ...(publishedTime && { publishedTime }),
      ...(modifiedTime && { modifiedTime }),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [fullImageUrl],
      site: twitterHandle,
      creator: twitterHandle,
    },
    other: {
      "apple-mobile-web-app-capable": "yes",
      "apple-mobile-web-app-status-bar-style": "black-translucent",
      "format-detection": "telephone=no",
    },
  };
}

// JSON-LD Structured Data Generators
export function generateOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "LenQuant",
    url: baseUrl,
    logo: `${baseUrl}/images/logo.png`,
    description:
      "AI-powered trading assistant for Binance Futures with real-time market analysis and behavioral guardrails.",
    sameAs: [
      "https://twitter.com/lenquant",
      "https://discord.gg/lenquant",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      email: "support@lenquant.com",
      contactType: "customer service",
    },
  };
}

export function generateProductSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "LenQuant Chrome Extension",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Chrome",
    browserRequirements: "Chrome 88+",
    offers: [
      {
        "@type": "Offer",
        name: "Free Trial",
        price: "0",
        priceCurrency: "USD",
        description: "3-day full access trial",
        availability: "https://schema.org/InStock",
      },
      {
        "@type": "Offer",
        name: "Pro Monthly",
        price: "19.99",
        priceCurrency: "USD",
        priceValidUntil: "2027-12-31",
        description: "Monthly subscription with full features",
        availability: "https://schema.org/InStock",
      },
      {
        "@type": "Offer",
        name: "Pro Yearly",
        price: "149",
        priceCurrency: "USD",
        priceValidUntil: "2027-12-31",
        description: "Annual subscription (save 38%)",
        availability: "https://schema.org/InStock",
      },
      {
        "@type": "Offer",
        name: "Premium Monthly",
        price: "39.99",
        priceCurrency: "USD",
        priceValidUntil: "2027-12-31",
        description: "Monthly subscription with extended features",
        availability: "https://schema.org/InStock",
      },
      {
        "@type": "Offer",
        name: "Premium Yearly",
        price: "299",
        priceCurrency: "USD",
        priceValidUntil: "2027-12-31",
        description: "Annual subscription (save 38%)",
        availability: "https://schema.org/InStock",
      },
    ],
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      ratingCount: "50",
      bestRating: "5",
      worstRating: "1",
    },
    description:
      "Real-time market regime analysis for Binance Futures with leverage recommendations and AI-powered trade explanations.",
    screenshot: `${baseUrl}/images/extension/panel-main.png`,
    softwareVersion: "1.0.0",
    author: {
      "@type": "Organization",
      name: "LenQuant",
    },
    featureList: [
      "Real-time market regime analysis",
      "Leverage recommendations",
      "AI-powered trade explanations",
      "Behavioral guardrails",
      "Trade journal with cloud sync",
      "Works for any Binance Futures symbol",
    ],
  };
}

export function generateFAQSchema(
  faqs: Array<{ question: string; answer: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

// Page-specific SEO configurations
export const pagesSEO = {
  home: {
    title: "LenQuant — AI Trading Assistant for Binance Futures",
    description:
      "Real-time market regime analysis, leverage recommendations, and AI-powered insights. Chrome extension + web platform for disciplined crypto trading.",
    path: "/",
    image: "/images/og/homepage.png",
    keywords: ["trading assistant", "binance futures chrome extension"],
  },
  extension: {
    title: "Chrome Extension — Real-Time Trading Intelligence for Binance Futures",
    description:
      "Install the LenQuant Chrome extension for real-time market regime analysis, leverage recommendations, and AI-powered trade explanations on Binance Futures.",
    path: "/extension",
    image: "/images/og/extension.png",
    keywords: [
      "chrome extension",
      "binance extension",
      "trading chrome extension",
    ],
  },
  platform: {
    title: "Trading Platform — Advanced AI-Powered Dashboard",
    description:
      "Advanced AI-powered trading dashboard with analytics, portfolio tracking, AI assistant, and comprehensive performance insights for cryptocurrency traders.",
    path: "/platform",
    image: "/images/og/platform.png",
    keywords: ["trading dashboard", "crypto analytics", "AI trading platform"],
  },
  privacy: {
    title: "Privacy Policy — LenQuant",
    description:
      "LenQuant Privacy Policy. Learn how we collect, use, and protect your personal data when using our Chrome extension and web platform.",
    path: "/privacy",
  },
  terms: {
    title: "Terms of Use — LenQuant",
    description:
      "LenQuant Terms of Use. Read our terms and conditions for using the LenQuant Chrome extension and web platform.",
    path: "/terms",
  },
} as const;

export function generateBreadcrumbSchema(
  items: Array<{ name: string; url: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${baseUrl}${item.url}`,
    })),
  };
}

export function generateWebPageSchema(title: string, description: string, url: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    url: url.startsWith("http") ? url : `${baseUrl}${url}`,
    isPartOf: {
      "@type": "WebSite",
      name: siteName,
      url: baseUrl,
    },
    publisher: {
      "@type": "Organization",
      name: siteName,
      logo: {
        "@type": "ImageObject",
        url: `${baseUrl}/images/logo.png`,
      },
    },
  };
}

// Page-specific SEO metadata (keeping existing for backward compatibility)
export const PAGE_SEO = {
  home: {
    title: "LenQuant - AI-Powered Crypto Trading Platform",
    description: "Advanced AI-assisted cryptocurrency trading platform with predictive analytics, automated strategies, and real-time market insights.",
  },
  trading: {
    title: "Trading Dashboard - LenQuant",
    description: "Execute cryptocurrency trades with AI-powered insights. Monitor positions, manage orders, and optimize your trading strategy in real-time.",
  },
  insights: {
    title: "Market Insights - LenQuant",
    description: "View AI-generated forecasts, market analysis, and strategy recommendations powered by machine learning models.",
  },
  analytics: {
    title: "Analytics Dashboard - LenQuant",
    description: "Deep dive into market analytics, performance metrics, and trading data with advanced visualization tools.",
  },
  assistant: {
    title: "AI Assistant - LenQuant",
    description: "Chat with your AI trading assistant for market insights, strategy advice, and personalized trading recommendations.",
  },
  knowledge: {
    title: "Knowledge Base - LenQuant",
    description: "Access trading knowledge, market research, and AI-generated insights to enhance your trading decisions.",
  },
  settings: {
    title: "Settings - LenQuant",
    description: "Configure your trading preferences, system settings, and platform options for an optimized experience.",
  },
  login: {
    title: "Login - LenQuant",
    description: "Sign in to your LenQuant account to access AI-powered cryptocurrency trading tools and insights.",
  },
  privacy: {
    title: "Privacy Policy - LenQuant",
    description: "Learn how LenQuant collects, uses, and protects your personal information and trading data.",
  },
  terms: {
    title: "Terms of Service - LenQuant",
    description: "Review the terms and conditions for using the LenQuant AI-powered cryptocurrency trading platform.",
  },
} as const;

