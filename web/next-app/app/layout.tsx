import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { GoogleAnalytics } from "@/components/marketing/GoogleAnalytics";
import "../styles/globals.css";

// Display font - distinctive, not generic
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

// Body font
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

// Monospace font for code/data
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0A" },
  ],
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://lenquant.com"),
  title: {
    default: "LenQuant — AI Trading Assistant for Binance Futures",
    template: "%s | LenQuant",
  },
  description:
    "Real-time market regime analysis, leverage recommendations, and AI-powered insights. Chrome extension + web platform for disciplined crypto trading.",
  keywords: [
    "binance futures",
    "crypto trading",
    "trading assistant",
    "leverage calculator",
    "market analysis",
    "AI trading",
    "chrome extension",
    "trading discipline",
    "regime detection",
  ],
  authors: [{ name: "LenQuant" }],
  creator: "LenQuant",
  publisher: "LenQuant",
  robots: {
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
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://lenquant.com",
    siteName: "LenQuant",
    title: "LenQuant — AI Trading Assistant for Binance Futures",
    description:
      "Real-time market analysis and behavioral guardrails for disciplined trading.",
    images: [
      {
        url: "/images/og/default.png",
        width: 1200,
        height: 630,
        alt: "LenQuant - Your Objective Trading Second Opinion",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LenQuant — AI Trading Assistant",
    description: "Your objective trading second opinion.",
    images: ["/images/og/default.png"],
    creator: "@lenquant",
  },
  icons: {
    icon: [
      { url: "/images/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/images/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/images/favicon/apple-icon-180x180.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      { rel: "mask-icon", url: "/images/favicon/safari-pinned-tab.svg", color: "#8B5CF6" },
    ],
  },
  manifest: "/images/favicon/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <GoogleAnalytics />
      </head>
      <body className="min-h-screen bg-background font-body antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
