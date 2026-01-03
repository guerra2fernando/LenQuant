import { Metadata } from "next";
import { generateSEO } from "@/lib/seo";
import { StructuredData } from "@/components/marketing/StructuredData";
import { LegalPageLayout } from "@/components/marketing/legal/LegalPageLayout";
import { LegalSection } from "@/components/marketing/legal/LegalSection";

// Force dynamic rendering to avoid static generation timeout
export const dynamic = 'force-dynamic';

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
