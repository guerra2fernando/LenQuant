import { Suspense } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { Header } from "@/components/marketing/Header";
import { Footer } from "@/components/marketing/Footer";
import { StructuredData } from "@/components/marketing/StructuredData";
import { AnalyticsProvider } from "@/components/marketing/AnalyticsProvider";
import { SkipLink } from "@/components/marketing/SkipLink";
import { generateOrganizationSchema } from "@/lib/seo";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <StructuredData data={generateOrganizationSchema()} />
      <SkipLink />
      <Header />
      <main id="main-content" className="flex-1">
        <Suspense fallback={null}>
          <AnalyticsProvider>{children}</AnalyticsProvider>
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
