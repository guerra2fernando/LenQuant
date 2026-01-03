import { Metadata } from "next";
import { generateSEO } from "@/lib/seo";
import { StructuredData } from "@/components/marketing/StructuredData";
import { LegalPageLayout } from "@/components/marketing/legal/LegalPageLayout";
import { LegalSection } from "@/components/marketing/legal/LegalSection";

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic';

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
