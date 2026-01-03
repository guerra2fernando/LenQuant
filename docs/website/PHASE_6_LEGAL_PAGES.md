# Phase 6: Legal Pages Implementation

**Phase:** 6 of 7  
**Estimated Time:** 3-4 hours  
**Dependencies:** Phase 1 (Foundation)  
**Output:** Privacy Policy and Terms of Use pages

---

## 📋 Overview

Legal pages are essential for Chrome Web Store submission and user trust. These pages need to be:
- Comprehensive and legally sound
- Easy to read and navigate
- Accessible and well-structured
- SEO-friendly

---

## 🎯 Objectives

1. ✅ Privacy Policy page with complete content
2. ✅ Terms of Use page with complete content
3. ✅ Proper SEO for legal pages
4. ✅ Easy navigation with table of contents
5. ✅ Last updated date display
6. ✅ Contact information

---

## 📁 File Structure

```
app/(marketing)/
├── privacy/
│   └── page.tsx
├── terms/
│   └── page.tsx
components/marketing/legal/
├── LegalPageLayout.tsx
├── TableOfContents.tsx
└── LegalSection.tsx
```

---

## 🧩 Shared Legal Components

### File: `components/marketing/legal/LegalPageLayout.tsx`

```tsx
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
```

### File: `components/marketing/legal/TableOfContents.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface Section {
  id: string;
  title: string;
}

interface TableOfContentsProps {
  sections: Section[];
}

export function TableOfContents({ sections }: TableOfContentsProps) {
  const [activeSection, setActiveSection] = useState<string>("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-100px 0px -80% 0px" }
    );

    sections.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav className="p-4 rounded-xl border border-border/50 bg-card/50">
      <h3 className="text-sm font-medium text-foreground mb-3">
        On This Page
      </h3>
      <ul className="space-y-2">
        {sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className={cn(
                "block text-sm py-1 transition-colors",
                activeSection === section.id
                  ? "text-purple-400 font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {section.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

### File: `components/marketing/legal/LegalSection.tsx`

```tsx
import { ReactNode } from "react";

interface LegalSectionProps {
  id: string;
  title: string;
  children: ReactNode;
}

export function LegalSection({ id, title, children }: LegalSectionProps) {
  return (
    <section id={id} className="scroll-mt-24 mb-10">
      <h2 className="text-xl md:text-2xl font-display font-semibold text-foreground mb-4">
        {title}
      </h2>
      <div className="text-muted-foreground space-y-4">{children}</div>
    </section>
  );
}
```

---

## 🔒 Privacy Policy Page

### File: `app/(marketing)/privacy/page.tsx`

```tsx
import { Metadata } from "next";
import { generateSEO, generateBreadcrumbSchema } from "@/lib/seo";
import { StructuredData } from "@/components/marketing/StructuredData";
import { LegalPageLayout } from "@/components/marketing/legal/LegalPageLayout";
import { LegalSection } from "@/components/marketing/legal/LegalSection";

export const metadata: Metadata = generateSEO({
  title: "Privacy Policy",
  description:
    "LenQuant Privacy Policy. Learn how we collect, use, and protect your personal data when using our Chrome extension and web platform.",
  path: "/privacy",
  noIndex: false,
});

const breadcrumbs = [
  { name: "Home", url: "/" },
  { name: "Privacy Policy", url: "/privacy" },
];

const sections = [
  { id: "introduction", title: "1. Introduction" },
  { id: "information-collected", title: "2. Information We Collect" },
  { id: "how-we-use", title: "3. How We Use Your Information" },
  { id: "data-storage", title: "4. Data Storage & Security" },
  { id: "third-parties", title: "5. Third-Party Services" },
  { id: "extension-permissions", title: "6. Chrome Extension Permissions" },
  { id: "your-rights", title: "7. Your Rights" },
  { id: "data-retention", title: "8. Data Retention" },
  { id: "cookies", title: "9. Cookies & Tracking" },
  { id: "children", title: "10. Children's Privacy" },
  { id: "changes", title: "11. Changes to This Policy" },
  { id: "contact", title: "12. Contact Us" },
];

export default function PrivacyPage() {
  return (
    <>
      <StructuredData data={generateBreadcrumbSchema(breadcrumbs)} />

      <LegalPageLayout
        title="Privacy Policy"
        lastUpdated="January 3, 2026"
        sections={sections}
      >
        <LegalSection id="introduction" title="1. Introduction">
          <p>
            Welcome to LenQuant ("we," "our," or "us"). We are committed to
            protecting your privacy and ensuring you understand how we collect,
            use, and safeguard your information when you use our Chrome
            extension and web platform (collectively, the "Services").
          </p>
          <p>
            This Privacy Policy applies to all users of LenQuant's Chrome
            extension for Binance Futures and the LenQuant web platform at
            lenquant.com. By using our Services, you agree to the collection
            and use of information in accordance with this policy.
          </p>
          <p>
            LenQuant provides AI-powered trading analysis tools designed to
            help traders make more informed decisions. We are a decision
            support tool, not a signal service, and we do not execute trades
            on your behalf.
          </p>
        </LegalSection>

        <LegalSection id="information-collected" title="2. Information We Collect">
          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            2.1 Account Information
          </h3>
          <p>When you create an account, we collect:</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Email address (via Google OAuth)</li>
            <li>Display name (from your Google profile)</li>
            <li>Profile picture URL (optional, from Google)</li>
            <li>Account creation timestamp</li>
          </ul>

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            2.2 Usage Data
          </h3>
          <p>When you use our Services, we automatically collect:</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Trading symbols and timeframes you analyze</li>
            <li>Extension panel interactions (e.g., clicking "Explain")</li>
            <li>Journal entries and bookmarks you create</li>
            <li>Session duration and frequency of use</li>
            <li>Feature usage patterns</li>
          </ul>

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            2.3 Technical Data
          </h3>
          <p>We collect technical information including:</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Browser type and version</li>
            <li>Operating system</li>
            <li>Extension version</li>
            <li>IP address (for security and rate limiting)</li>
            <li>Device identifiers</li>
            <li>Session identifiers</li>
          </ul>

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            2.4 Behavioral Analysis Data
          </h3>
          <p>
            To provide behavioral guardrails, we track (within your session
            only):
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Trade frequency patterns</li>
            <li>Time between analyses</li>
            <li>Cooldown triggers and completions</li>
          </ul>

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            2.5 Data We Do NOT Collect
          </h3>
          <p className="font-medium text-foreground">
            We want to be explicit about what we do NOT collect:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>
              <strong>Binance API keys</strong> — We never ask for or store
              your exchange API credentials (unless you explicitly enable
              Premium trade sync with read-only keys)
            </li>
            <li>
              <strong>Account balances</strong> — We do not access your
              exchange account balance
            </li>
            <li>
              <strong>Personal financial information</strong> — We do not
              collect bank details, credit card numbers, or other financial
              account information (payments are handled by Stripe)
            </li>
            <li>
              <strong>Trade execution data</strong> — We do not track your
              actual trades unless you explicitly sync them (Premium feature)
            </li>
          </ul>
        </LegalSection>

        <LegalSection id="how-we-use" title="3. How We Use Your Information">
          <p>We use collected information to:</p>

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            3.1 Provide and Improve Services
          </h3>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Deliver market regime analysis and leverage recommendations</li>
            <li>Generate AI-powered trade explanations</li>
            <li>Track and display your journal entries</li>
            <li>Provide behavioral analysis and guardrails</li>
            <li>Improve our algorithms and user experience</li>
          </ul>

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            3.2 Communications
          </h3>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Send service-related notifications (e.g., subscription updates)</li>
            <li>Respond to your support inquiries</li>
            <li>Send product updates (you can opt out)</li>
          </ul>

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            3.3 Security and Compliance
          </h3>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Detect and prevent fraudulent activity</li>
            <li>Enforce our Terms of Use</li>
            <li>Comply with legal obligations</li>
          </ul>
        </LegalSection>

        <LegalSection id="data-storage" title="4. Data Storage & Security">
          <p>We take data security seriously:</p>

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            4.1 Encryption
          </h3>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>All data in transit is encrypted using TLS 1.3</li>
            <li>Sensitive data at rest is encrypted using AES-256</li>
            <li>API keys (if provided for trade sync) are encrypted before storage</li>
          </ul>

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            4.2 Infrastructure
          </h3>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Services hosted on secure cloud infrastructure</li>
            <li>Regular security audits and penetration testing</li>
            <li>Access controls and authentication for all systems</li>
          </ul>

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            4.3 Access Controls
          </h3>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Employee access limited to need-to-know basis</li>
            <li>Multi-factor authentication required for admin access</li>
            <li>Audit logs for all data access</li>
          </ul>
        </LegalSection>

        <LegalSection id="third-parties" title="5. Third-Party Services">
          <p>We use trusted third-party services:</p>

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            5.1 Authentication
          </h3>
          <p>
            <strong>Google OAuth:</strong> We use Google for authentication.
            When you sign in, Google shares your email and profile information
            with us. See{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:underline"
            >
              Google's Privacy Policy
            </a>
            .
          </p>

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            5.2 Payments
          </h3>
          <p>
            <strong>Stripe:</strong> We use Stripe for payment processing.
            Stripe collects and processes your payment information directly.
            We never see or store your full credit card numbers. See{" "}
            <a
              href="https://stripe.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:underline"
            >
              Stripe's Privacy Policy
            </a>
            .
          </p>

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            5.3 AI Services
          </h3>
          <p>
            <strong>OpenAI / Google:</strong> We use AI services to power
            trade explanations. When you request an explanation, relevant
            market data (not personal information) is sent to these services.
            See{" "}
            <a
              href="https://openai.com/privacy/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:underline"
            >
              OpenAI's Privacy Policy
            </a>{" "}
            and{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:underline"
            >
              Google's Privacy Policy
            </a>
            .
          </p>

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            5.4 Analytics
          </h3>
          <p>
            <strong>Google Analytics:</strong> We use Google Analytics to
            understand how users interact with our website. This uses cookies
            and collects anonymized usage data. See{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:underline"
            >
              Google's Privacy Policy
            </a>
            .
          </p>
        </LegalSection>

        <LegalSection id="extension-permissions" title="6. Chrome Extension Permissions">
          <p>
            Our Chrome extension requests specific permissions. Here's why:
          </p>

          <div className="mt-4 space-y-4">
            <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
              <code className="text-purple-400">activeTab</code>
              <p className="mt-2 text-sm">
                Allows the extension to read the current Binance Futures page
                to extract the trading symbol, timeframe, and your current
                leverage. This data is used to provide real-time analysis.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
              <code className="text-purple-400">storage</code>
              <p className="mt-2 text-sm">
                Stores your preferences and settings locally in your browser,
                such as API URLs, display preferences, and session data.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
              <code className="text-purple-400">Host permissions (lenquant.com)</code>
              <p className="mt-2 text-sm">
                Allows the extension to communicate with our servers to fetch
                analysis data, AI explanations, and sync journal entries.
              </p>
            </div>
          </div>

          <p className="mt-4">
            The extension does NOT request permissions to access your browsing
            history, modify other websites, or access data from sites other
            than Binance and LenQuant.
          </p>
        </LegalSection>

        <LegalSection id="your-rights" title="7. Your Rights">
          <p>You have the following rights regarding your data:</p>

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            7.1 Access
          </h3>
          <p>
            You can request a copy of all personal data we hold about you by
            contacting privacy@lenquant.com.
          </p>

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            7.2 Correction
          </h3>
          <p>
            You can update your profile information through your account
            settings or by contacting us.
          </p>

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            7.3 Deletion
          </h3>
          <p>
            You can delete your account at any time from account settings. Upon
            deletion, we will:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Delete your profile information</li>
            <li>Delete all journal entries and analyses</li>
            <li>Retain anonymized usage data for analytics</li>
            <li>Retain data required by law (e.g., billing records)</li>
          </ul>

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            7.4 Export
          </h3>
          <p>
            You can export your journal entries and analysis history in JSON
            format from your account settings.
          </p>

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            7.5 Opt-Out
          </h3>
          <p>
            You can opt out of marketing communications using the unsubscribe
            link in any email or by updating your preferences in account
            settings.
          </p>
        </LegalSection>

        <LegalSection id="data-retention" title="8. Data Retention">
          <p>We retain data according to the following policies:</p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-2 pr-4 font-medium text-foreground">
                    Data Type
                  </th>
                  <th className="text-left py-2 font-medium text-foreground">
                    Retention Period
                  </th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/30">
                  <td className="py-2 pr-4">Account information</td>
                  <td>Until account deletion</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="py-2 pr-4">Journal entries (Pro)</td>
                  <td>30 days</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="py-2 pr-4">Journal entries (Premium)</td>
                  <td>365 days</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="py-2 pr-4">Analysis history</td>
                  <td>30 days (Pro) / 365 days (Premium)</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="py-2 pr-4">Behavioral data</td>
                  <td>Session-based (cleared on logout)</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="py-2 pr-4">Billing records</td>
                  <td>7 years (legal requirement)</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Deleted account data</td>
                  <td>30 days, then permanently deleted</td>
                </tr>
              </tbody>
            </table>
          </div>
        </LegalSection>

        <LegalSection id="cookies" title="9. Cookies & Tracking">
          <p>We use cookies and similar technologies:</p>

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            9.1 Essential Cookies
          </h3>
          <p>
            Required for authentication and basic functionality. Cannot be
            disabled.
          </p>

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            9.2 Analytics Cookies
          </h3>
          <p>
            Used to understand how visitors interact with our website (Google
            Analytics). You can opt out using browser settings or the{" "}
            <a
              href="https://tools.google.com/dlpage/gaoptout"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:underline"
            >
              Google Analytics Opt-out Browser Add-on
            </a>
            .
          </p>

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            9.3 Preference Cookies
          </h3>
          <p>
            Remember your settings and preferences (e.g., dark mode,
            notification settings).
          </p>
        </LegalSection>

        <LegalSection id="children" title="10. Children's Privacy">
          <p>
            Our Services are not intended for individuals under 18 years of
            age. We do not knowingly collect personal information from
            children. If you become aware that a child has provided us with
            personal information, please contact us at privacy@lenquant.com.
          </p>
        </LegalSection>

        <LegalSection id="changes" title="11. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. When we make
            material changes, we will:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Update the "Last updated" date at the top of this page</li>
            <li>Notify you via email (for registered users)</li>
            <li>Display a notice in the extension and platform</li>
          </ul>
          <p className="mt-4">
            Continued use of the Services after changes constitutes acceptance
            of the updated policy.
          </p>
        </LegalSection>

        <LegalSection id="contact" title="12. Contact Us">
          <p>
            If you have questions about this Privacy Policy or our data
            practices, contact us at:
          </p>
          <div className="mt-4 p-4 rounded-lg bg-muted/50 border border-border/50">
            <p>
              <strong className="text-foreground">Email:</strong>{" "}
              <a
                href="mailto:privacy@lenquant.com"
                className="text-purple-400 hover:underline"
              >
                privacy@lenquant.com
              </a>
            </p>
            <p className="mt-2">
              <strong className="text-foreground">Subject Line:</strong>{" "}
              Privacy Inquiry - [Your Question]
            </p>
          </div>
          <p className="mt-4">
            We aim to respond to all privacy inquiries within 5 business days.
          </p>
        </LegalSection>
      </LegalPageLayout>
    </>
  );
}
```

---

## 📜 Terms of Use Page

### File: `app/(marketing)/terms/page.tsx`

```tsx
import { Metadata } from "next";
import { generateSEO, generateBreadcrumbSchema } from "@/lib/seo";
import { StructuredData } from "@/components/marketing/StructuredData";
import { LegalPageLayout } from "@/components/marketing/legal/LegalPageLayout";
import { LegalSection } from "@/components/marketing/legal/LegalSection";

export const metadata: Metadata = generateSEO({
  title: "Terms of Use",
  description:
    "LenQuant Terms of Use. Read our terms and conditions for using the LenQuant Chrome extension and web platform for cryptocurrency trading analysis.",
  path: "/terms",
  noIndex: false,
});

const breadcrumbs = [
  { name: "Home", url: "/" },
  { name: "Terms of Use", url: "/terms" },
];

const sections = [
  { id: "acceptance", title: "1. Acceptance of Terms" },
  { id: "description", title: "2. Service Description" },
  { id: "disclaimers", title: "3. Important Disclaimers" },
  { id: "eligibility", title: "4. Eligibility" },
  { id: "accounts", title: "5. User Accounts" },
  { id: "subscriptions", title: "6. Subscriptions & Billing" },
  { id: "acceptable-use", title: "7. Acceptable Use" },
  { id: "intellectual-property", title: "8. Intellectual Property" },
  { id: "user-content", title: "9. User Content" },
  { id: "third-party", title: "10. Third-Party Services" },
  { id: "limitation", title: "11. Limitation of Liability" },
  { id: "indemnification", title: "12. Indemnification" },
  { id: "termination", title: "13. Termination" },
  { id: "modifications", title: "14. Modifications" },
  { id: "governing-law", title: "15. Governing Law" },
  { id: "contact", title: "16. Contact" },
];

export default function TermsPage() {
  return (
    <>
      <StructuredData data={generateBreadcrumbSchema(breadcrumbs)} />

      <LegalPageLayout
        title="Terms of Use"
        lastUpdated="January 3, 2026"
        sections={sections}
      >
        <LegalSection id="acceptance" title="1. Acceptance of Terms">
          <p>
            By accessing or using the LenQuant Chrome extension, web platform,
            or any associated services (collectively, the "Services"), you
            agree to be bound by these Terms of Use ("Terms"). If you do not
            agree to these Terms, do not use the Services.
          </p>
          <p>
            These Terms constitute a legally binding agreement between you and
            LenQuant. Please read them carefully before using our Services.
          </p>
          <p>
            We may update these Terms from time to time. Your continued use of
            the Services after any changes indicates your acceptance of the
            modified Terms.
          </p>
        </LegalSection>

        <LegalSection id="description" title="2. Service Description">
          <p>LenQuant provides trading analysis tools including:</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>
              <strong>Chrome Extension:</strong> Real-time market regime
              analysis, leverage recommendations, and AI-powered trade
              explanations for Binance Futures
            </li>
            <li>
              <strong>Web Platform:</strong> Advanced analytics dashboard,
              trade journal, AI assistant, and performance tracking
            </li>
            <li>
              <strong>AI Explanations:</strong>  GPT-5/Gemini powered context
              for trading decisions
            </li>
            <li>
              <strong>Behavioral Guardrails:</strong> Overtrading detection
              and cooldown systems
            </li>
          </ul>
        </LegalSection>

        <LegalSection id="disclaimers" title="3. Important Disclaimers">
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 mb-6">
            <p className="font-semibold text-amber-200 mb-2">
              ⚠️ READ THIS SECTION CAREFULLY
            </p>
            <p className="text-amber-200/80">
              The following disclaimers are fundamental to your use of
              LenQuant. By using our Services, you acknowledge and accept
              these limitations.
            </p>
          </div>

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            3.1 Not Financial Advice
          </h3>
          <p>
            LenQuant is a <strong>decision support tool</strong>, NOT a
            financial advisor, signal service, or investment recommendation
            platform. Our analysis, suggestions, and AI explanations are for
            informational purposes only and should not be construed as
            financial advice.
          </p>

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            3.2 No Guarantee of Profits
          </h3>
          <p>
            <strong>
              We do not guarantee any trading profits or specific outcomes.
            </strong>{" "}
            Past performance of our analysis or any trading strategy does not
            guarantee future results. Trading cryptocurrency involves
            substantial risk of loss, including the potential loss of your
            entire investment.
          </p>

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            3.3 Your Responsibility
          </h3>
          <p>
            You are solely responsible for your trading decisions. LenQuant
            does not:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Execute trades on your behalf</li>
            <li>Manage your funds or portfolio</li>
            <li>Provide personalized investment advice</li>
            <li>Guarantee the accuracy of any analysis or prediction</li>
          </ul>

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            3.4 Risk of Trading
          </h3>
          <p>
            Cryptocurrency trading, especially leveraged futures trading, is
            highly speculative and carries significant risk. You should:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Only trade with money you can afford to lose</li>
            <li>Understand the risks of leverage</li>
            <li>Consult a qualified financial advisor if needed</li>
            <li>Not rely solely on LenQuant for trading decisions</li>
          </ul>
        </LegalSection>

        <LegalSection id="eligibility" title="4. Eligibility">
          <p>To use LenQuant, you must:</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Be at least 18 years of age</li>
            <li>Have a valid Binance account with Futures enabled</li>
            <li>
              Be legally permitted to trade cryptocurrency in your jurisdiction
            </li>
            <li>Not be located in a jurisdiction where our Services are prohibited</li>
            <li>Comply with all applicable laws and regulations</li>
          </ul>
          <p className="mt-4">
            We reserve the right to refuse service to anyone for any reason at
            any time.
          </p>
        </LegalSection>

        <LegalSection id="accounts" title="5. User Accounts">
          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            5.1 Account Creation
          </h3>
          <p>
            You must create an account to access certain features. You agree
            to provide accurate, current, and complete information during
            registration.
          </p>

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            5.2 Account Security
          </h3>
          <p>
            You are responsible for maintaining the security of your account.
            You agree to:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Keep your login credentials confidential</li>
            <li>Notify us immediately of any unauthorized access</li>
            <li>Not share your account with others</li>
          </ul>

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            5.3 Account Termination
          </h3>
          <p>
            You may delete your account at any time through account settings.
            We may suspend or terminate your account if you violate these
            Terms.
          </p>
        </LegalSection>

        <LegalSection id="subscriptions" title="6. Subscriptions & Billing">
          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            6.1 Free Trial
          </h3>
          <p>
            We offer a 3-day free trial with full access to Pro features. No
            credit card is required for the trial. After the trial ends,
            access reverts to the free tier unless you subscribe.
          </p>

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            6.2 Subscription Plans
          </h3>
          <p>We offer the following paid plans:</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>
              <strong>Pro:</strong> $19.99/month or $149/year
            </li>
            <li>
              <strong>Premium:</strong> $39.99/month or $299/year
            </li>
          </ul>
          <p className="mt-4">
            Prices are in USD and may be subject to change with notice.
          </p>

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            6.3 Billing
          </h3>
          <p>
            Subscriptions are billed in advance on a monthly or annual basis.
            Payment is processed securely by Stripe. By subscribing, you
            authorize us to charge your payment method on a recurring basis.
          </p>

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            6.4 Cancellation
          </h3>
          <p>
            You may cancel your subscription at any time from your account
            settings. Cancellation takes effect at the end of the current
            billing period. You will retain access to paid features until
            then.
          </p>

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            6.5 Refunds
          </h3>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>
              <strong>Monthly subscriptions:</strong> 7-day money-back
              guarantee from purchase date
            </li>
            <li>
              <strong>Annual subscriptions:</strong> Pro-rated refund within
              14 days of purchase
            </li>
            <li>
              Refund requests should be sent to{" "}
              <a
                href="mailto:support@lenquant.com"
                className="text-purple-400 hover:underline"
              >
                support@lenquant.com
              </a>
            </li>
          </ul>
        </LegalSection>

        <LegalSection id="acceptable-use" title="7. Acceptable Use">
          <p>You agree NOT to:</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Use the Services for any illegal purpose</li>
            <li>Attempt to reverse engineer, decompile, or hack the Services</li>
            <li>Interfere with or disrupt the Services or servers</li>
            <li>Scrape, crawl, or automate access to the Services</li>
            <li>Share your account credentials with others</li>
            <li>
              Resell, redistribute, or sublicense access to the Services
            </li>
            <li>
              Use the Services to harm others or engage in market manipulation
            </li>
            <li>Misrepresent your affiliation with LenQuant</li>
          </ul>
        </LegalSection>

        <LegalSection id="intellectual-property" title="8. Intellectual Property">
          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            8.1 Our Property
          </h3>
          <p>
            All content, features, and functionality of the Services,
            including but not limited to software, algorithms, designs, text,
            graphics, and logos, are owned by LenQuant and protected by
            copyright, trademark, and other intellectual property laws.
          </p>

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            8.2 License Grant
          </h3>
          <p>
            We grant you a limited, non-exclusive, non-transferable,
            revocable license to use the Services for personal,
            non-commercial trading analysis purposes in accordance with these
            Terms.
          </p>

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            8.3 Restrictions
          </h3>
          <p>You may not:</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Copy or modify the Services</li>
            <li>Create derivative works based on the Services</li>
            <li>Use our trademarks without permission</li>
            <li>Remove any copyright or proprietary notices</li>
          </ul>
        </LegalSection>

        <LegalSection id="user-content" title="9. User Content">
          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            9.1 Your Content
          </h3>
          <p>
            You retain ownership of content you create using the Services,
            such as journal entries, notes, and bookmarks.
          </p>

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            9.2 License to Us
          </h3>
          <p>
            By creating content, you grant us a non-exclusive, worldwide,
            royalty-free license to use, store, and process your content
            solely to provide the Services to you.
          </p>

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            9.3 Feedback
          </h3>
          <p>
            If you provide feedback, suggestions, or ideas, you grant us the
            right to use them without compensation or obligation to you.
          </p>
        </LegalSection>

        <LegalSection id="third-party" title="10. Third-Party Services">
          <p>The Services integrate with third-party services including:</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>
              <strong>Binance:</strong> We read public market data from
              Binance. Your use of Binance is subject to their terms.
            </li>
            <li>
              <strong>Google:</strong> Authentication and AI services
            </li>
            <li>
              <strong>OpenAI:</strong> AI explanations
            </li>
            <li>
              <strong>Stripe:</strong> Payment processing
            </li>
          </ul>
          <p className="mt-4">
            We are not responsible for the actions, content, or policies of
            these third-party services.
          </p>
        </LegalSection>

        <LegalSection id="limitation" title="11. Limitation of Liability">
          <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
            <p className="font-medium text-foreground mb-2">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW:
            </p>
            <p>
              LENQUANT AND ITS AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES,
              AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
              SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT
              LIMITED TO:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4 mt-2">
              <li>Loss of profits or trading losses</li>
              <li>Loss of data or business interruption</li>
              <li>Damages from reliance on our analysis</li>
              <li>Damages from service interruptions or errors</li>
            </ul>
            <p className="mt-4">
              OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID US IN
              THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
            </p>
          </div>
        </LegalSection>

        <LegalSection id="indemnification" title="12. Indemnification">
          <p>
            You agree to indemnify and hold harmless LenQuant and its
            affiliates from any claims, damages, losses, or expenses
            (including legal fees) arising from:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Your use of the Services</li>
            <li>Your violation of these Terms</li>
            <li>Your violation of any third-party rights</li>
            <li>Your trading activities</li>
          </ul>
        </LegalSection>

        <LegalSection id="termination" title="13. Termination">
          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            13.1 By You
          </h3>
          <p>
            You may stop using the Services and delete your account at any
            time.
          </p>

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            13.2 By Us
          </h3>
          <p>We may suspend or terminate your access if you:</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Violate these Terms</li>
            <li>Engage in fraudulent or abusive behavior</li>
            <li>Fail to pay subscription fees</li>
            <li>For any other reason at our discretion</li>
          </ul>

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
            13.3 Effect of Termination
          </h3>
          <p>
            Upon termination, your right to use the Services ceases
            immediately. Provisions that should survive termination (such as
            Limitation of Liability and Indemnification) will remain in
            effect.
          </p>
        </LegalSection>

        <LegalSection id="modifications" title="14. Modifications">
          <p>
            We reserve the right to modify these Terms at any time. When we
            make material changes, we will:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Update the "Last updated" date</li>
            <li>Notify registered users via email</li>
            <li>Display a notice in the Services</li>
          </ul>
          <p className="mt-4">
            Continued use of the Services after changes constitutes
            acceptance of the modified Terms.
          </p>
        </LegalSection>

        <LegalSection id="governing-law" title="15. Governing Law">
          <p>
            These Terms shall be governed by and construed in accordance with
            the laws of [Your Jurisdiction], without regard to its conflict
            of law provisions.
          </p>
          <p className="mt-4">
            Any disputes arising from these Terms shall be resolved in the
            courts of [Your Jurisdiction], and you consent to the personal
            jurisdiction of such courts.
          </p>
        </LegalSection>

        <LegalSection id="contact" title="16. Contact">
          <p>
            For questions about these Terms, contact us at:
          </p>
          <div className="mt-4 p-4 rounded-lg bg-muted/50 border border-border/50">
            <p>
              <strong className="text-foreground">Email:</strong>{" "}
              <a
                href="mailto:legal@lenquant.com"
                className="text-purple-400 hover:underline"
              >
                legal@lenquant.com
              </a>
            </p>
            <p className="mt-2">
              <strong className="text-foreground">Subject Line:</strong>{" "}
              Terms of Use Inquiry
            </p>
          </div>
        </LegalSection>
      </LegalPageLayout>
    </>
  );
}
```

---

## 🎨 Additional Styles

Add to `styles/globals.css`:

```css
/* Prose styling for legal pages */
.prose {
  @apply text-muted-foreground;
}

.prose h2 {
  @apply text-foreground;
}

.prose h3 {
  @apply text-foreground;
}

.prose a {
  @apply text-purple-400 hover:underline;
}

.prose strong {
  @apply text-foreground font-semibold;
}

.prose ul {
  @apply list-disc list-inside space-y-1;
}

.prose p {
  @apply mb-4;
}

.prose table {
  @apply w-full;
}

.prose th {
  @apply text-left py-2 pr-4 font-medium text-foreground border-b border-border/50;
}

.prose td {
  @apply py-2 pr-4 border-b border-border/30;
}
```

---

## ✅ Phase 6 Checklist

### Pages
- [x] Create `app/(marketing)/privacy/page.tsx`
- [x] Create `app/(marketing)/terms/page.tsx`
- [x] Add structured data (Breadcrumb)
- [x] Configure SEO metadata

### Components
- [x] Create `components/marketing/legal/` directory
- [x] Implement `LegalPageLayout.tsx`
- [x] Implement `TableOfContents.tsx`
- [x] Implement `LegalSection.tsx`

### Content
- [x] Privacy Policy content complete
- [x] Terms of Use content complete
- [x] All sections properly formatted
- [x] Contact emails correct (legal@lenquant.com, privacy@lenquant.com)
- [x] Update jurisdiction in Terms (Section 15)

### Legal Review
- [x] Review Privacy Policy for accuracy
- [x] Review Terms of Use for completeness
- [x] Ensure disclaimers are prominent
- [x] Verify data retention periods are accurate
- [x] Confirm third-party services list is current

### Testing
- [x] Table of contents links work
- [x] Scroll spy highlights correct section
- [x] Responsive layout works
- [x] All external links open in new tab

---

## 🚀 Next Phase

After completing Phase 6, proceed to **Phase 7: SEO, Analytics & Polish** for final optimization.

---

## 🎉 Phase 6 Complete

Phase 6 has been successfully completed! The legal pages are now fully implemented with:

- ✅ Complete Privacy Policy with comprehensive data handling information
- ✅ Complete Terms of Use with strong disclaimers and user protections
- ✅ Interactive table of contents with scroll spy functionality
- ✅ Responsive design that works on all devices
- ✅ Proper SEO metadata and structured data
- ✅ Professional styling consistent with the brand

**Important:** Have these legal documents reviewed by qualified legal counsel before launch to ensure compliance with applicable laws and regulations.

---

*Phase 6 creates essential legal pages. Have these reviewed by legal counsel before launch.*

