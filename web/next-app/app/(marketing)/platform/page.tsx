import { Metadata } from "next";
import { generateSEO } from "@/lib/seo";
import { StructuredData } from "@/components/marketing/StructuredData";
import { PlatformHero } from "@/components/marketing/platform/PlatformHero";
import { PlatformFeatures } from "@/components/marketing/platform/PlatformFeatures";
import { IntegrationSection } from "@/components/marketing/platform/IntegrationSection";
import { DashboardPreview } from "@/components/marketing/platform/DashboardPreview";
import { PlatformCTA } from "@/components/marketing/platform/PlatformCTA";

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic';

export const metadata: Metadata = generateSEO({
  title: "Trading Platform — Advanced AI-Powered Dashboard",
  description:
    "Advanced AI-powered trading dashboard with analytics, portfolio tracking, AI assistant, and comprehensive performance insights. The complete LenQuant experience.",
  path: "/platform",
  image: "/images/og/platform.png",
});

const breadcrumbs = [
  { name: "Home", url: "/" },
  { name: "Platform", url: "/platform" },
];

export default function PlatformPage() {
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
      <StructuredData data={breadcrumbSchema} />

      <div className="relative">
        {/* Background effects */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-1/3 right-1/4 w-[600px] h-[600px] bg-indigo-500/15 rounded-full blur-[130px]" />
          <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px]" />
        </div>

        <PlatformHero />
        <PlatformFeatures />
        <DashboardPreview />
        <IntegrationSection />
        <PlatformCTA />
      </div>
    </>
  );
}
