import { Metadata } from "next";
import { generateSEO, generateProductSchema } from "@/lib/seo";
import { StructuredData } from "@/components/marketing/StructuredData";
import { HeroSection } from "@/components/marketing/sections/HeroSection";
import { FeaturesSection } from "@/components/marketing/sections/FeaturesSection";
import { HowItWorksSection } from "@/components/marketing/sections/HowItWorksSection";
import { DemoSection } from "@/components/marketing/sections/DemoSection";
import { PlatformSection } from "@/components/marketing/sections/PlatformSection";
import { PricingSection } from "@/components/marketing/sections/PricingSection";
import { TestimonialsSection } from "@/components/marketing/sections/TestimonialsSection";
import { FAQSection } from "@/components/marketing/sections/FAQSection";
import { faqItems } from "@/components/marketing/sections/faq-data";
import { CTASection } from "@/components/marketing/sections/CTASection";

// Client component to handle FAQ schema generation
function FAQStructuredData() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return <StructuredData data={faqSchema} />;
}

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic';

export const metadata: Metadata = generateSEO({
  title: "LenQuant — AI Trading Assistant for Binance Futures",
  description:
    "Real-time market regime analysis, leverage recommendations, and AI-powered insights. Chrome extension + web platform for disciplined crypto trading.",
  path: "/",
  image: "/images/og/homepage.png",
});

export default function HomePage() {
  return (
    <>
      <StructuredData data={generateProductSchema()} />
      <FAQStructuredData />

      <div className="relative">
        {/* Background gradients */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-purple-500/30 rounded-full blur-[150px]" />
          <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-indigo-500/25 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 left-1/3 w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[140px]" />
        </div>

        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <DemoSection />
        <PlatformSection />
        <PricingSection />
        <TestimonialsSection />
        <FAQSection />
        <CTASection />
      </div>
    </>
  );
}
