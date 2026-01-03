import { Metadata } from "next";
import { generateSEO, generateProductSchema } from "@/lib/seo";
import { StructuredData } from "@/components/marketing/StructuredData";
import { ExtensionHero } from "@/components/marketing/extension/ExtensionHero";
import { ScreenshotSection } from "@/components/marketing/extension/ScreenshotSection";
import { FeaturesDeepDive } from "@/components/marketing/extension/FeaturesDeepDive";
import { InstallationGuide } from "@/components/marketing/extension/InstallationGuide";
import { TechSpecs } from "@/components/marketing/extension/TechSpecs";
import { ExtensionCTA } from "@/components/marketing/extension/ExtensionCTA";

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic';

export const metadata: Metadata = generateSEO({
  title: "Chrome Extension — Real-Time Trading Intelligence for Binance Futures",
  description:
    "Install the LenQuant Chrome extension for real-time market regime analysis, ML predictions for major coins, leverage recommendations, and AI-powered trade explanations. Works instantly on Binance Futures.",
  path: "/extension",
  image: "/images/og/extension.png",
});

const breadcrumbs = [
  { name: "Home", url: "/" },
  { name: "Extension", url: "/extension" },
];

export default function ExtensionPage() {
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbs.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `https://lenquant.com${item.url}`,
    })),
  };

  return (
    <>
      <StructuredData data={generateProductSchema()} />
      <StructuredData data={breadcrumbSchema} />

      <div className="relative">
        {/* Background effects */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-purple-500/15 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[100px]" />
        </div>

        <ExtensionHero />
        <ScreenshotSection />
        <FeaturesDeepDive />
        <InstallationGuide />
        <TechSpecs />
        <ExtensionCTA />
      </div>
    </>
  );
}
