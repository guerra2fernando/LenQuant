import { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TableOfContents } from "./TableOfContents";

interface LegalPageLayoutProps {
  title: string;
  lastUpdated: string;
  children: ReactNode;
  sections: Array<{ id: string; title: string }>;
}

export function LegalPageLayout({
  title,
  lastUpdated,
  children,
  sections,
}: LegalPageLayoutProps) {
  return (
    <div className="pt-24 lg:pt-32 pb-16 lg:pb-24">
      <div className="container-marketing">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <div className="grid lg:grid-cols-[1fr_280px] gap-12">
          {/* Main Content */}
          <div>
            <header className="mb-10">
              <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">
                {title}
              </h1>
              <p className="mt-2 text-muted-foreground">
                Last updated: {lastUpdated}
              </p>
            </header>

            <div className="prose prose-invert prose-purple max-w-none">
              {children}
            </div>
          </div>

          {/* Sidebar - Table of Contents */}
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <TableOfContents sections={sections} />

              {/* Contact Box */}
              <div className="mt-8 p-4 rounded-xl border border-border/50 bg-card/50">
                <h4 className="text-sm font-medium text-foreground mb-2">
                  Questions?
                </h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Contact us for any questions about this policy.
                </p>
                <a
                  href="mailto:legal@lenquant.com"
                  className="text-sm text-purple-400 hover:underline"
                >
                  legal@lenquant.com
                </a>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}


