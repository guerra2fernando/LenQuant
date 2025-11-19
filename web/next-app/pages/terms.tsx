/* eslint-disable */
// @ts-nocheck
import Image from "next/image";
import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container max-w-4xl py-12 px-4">
        <div className="mb-8 text-center">
          <Link href="/login" className="inline-flex items-center gap-2 mb-6">
            <Image
              src="/logo.png"
              alt="LenQuant Logo"
              width={48}
              height={48}
              className="object-contain"
            />
            <span className="text-2xl font-bold">LenQuant</span>
          </Link>
          <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
          <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
        </div>

        <div className="prose prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing and using LenQuant ("the Platform", "the Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              LenQuant is an autonomous cryptocurrency trading platform that uses machine learning to predict market movements, automatically execute trades, and continuously improve its strategies. The platform supports:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Paper trading (simulated trading with virtual money)</li>
              <li>Testnet trading (real exchange testnet environments)</li>
              <li>Live trading (real money trading with comprehensive safety guards)</li>
              <li>Multiple automation levels (Manual, Semi-Automatic, Automatic)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Risk Disclaimer</h2>
            <p className="text-muted-foreground leading-relaxed font-semibold">
              <strong className="text-foreground">TRADING CRYPTOCURRENCIES INVOLVES SUBSTANTIAL RISK OF LOSS.</strong> The Platform is provided for educational and research purposes. Past performance does not guarantee future results.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              You acknowledge and agree that:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Cryptocurrency trading carries significant financial risk</li>
              <li>You may lose all or more than your initial investment</li>
              <li>Automated trading can amplify losses</li>
              <li>Market predictions are not guaranteed to be accurate</li>
              <li>You should never risk more than you can afford to lose</li>
              <li>You are solely responsible for all trading decisions and their consequences</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. User Responsibilities</h2>
            <p className="text-muted-foreground leading-relaxed">
              You are responsible for:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Maintaining the security of your account credentials and API keys</li>
              <li>Configuring appropriate risk management settings (stop-losses, position sizing, daily loss limits)</li>
              <li>Monitoring your account and trading activity</li>
              <li>Complying with all applicable laws and regulations in your jurisdiction</li>
              <li>Ensuring you have the legal right to trade cryptocurrencies in your location</li>
              <li>Using the Service in a lawful manner</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. API Keys and Exchange Accounts</h2>
            <p className="text-muted-foreground leading-relaxed">
              When connecting to cryptocurrency exchanges:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>You are responsible for the security of your exchange API keys</li>
              <li>API keys are stored securely but you should use minimal required permissions</li>
              <li>The Platform is not responsible for unauthorized access to your exchange accounts</li>
              <li>You should enable 2FA on your exchange accounts</li>
              <li>You should regularly review and rotate your API keys</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. No Financial Advice</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Platform provides trading tools and predictions, but does not constitute financial, investment, or trading advice. All trading decisions are your own. You should consult with qualified financial advisors before making investment decisions.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Service Availability</h2>
            <p className="text-muted-foreground leading-relaxed">
              While we strive to maintain 24/7 availability, the Service is provided "as-is" without warranties of any kind. We do not guarantee:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Uninterrupted or error-free operation</li>
              <li>Accuracy of predictions or forecasts</li>
              <li>Availability of exchange connections</li>
              <li>Prevention of data loss or corruption</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              To the maximum extent permitted by law, LenQuant and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses resulting from your use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Indemnification</h2>
            <p className="text-muted-foreground leading-relaxed">
              You agree to indemnify and hold harmless LenQuant, its operators, and affiliates from any claims, damages, losses, liabilities, and expenses (including legal fees) arising from your use of the Service, violation of these Terms, or infringement of any rights of another.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Modifications to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to modify these Terms at any time. Continued use of the Service after changes constitutes acceptance of the modified Terms. We will notify users of material changes via the Platform or email.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to terminate or suspend your access to the Service at any time, with or without cause or notice, for any reason including violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms shall be governed by and construed in accordance with applicable laws. Any disputes arising from these Terms or your use of the Service shall be resolved in the appropriate courts.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">13. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions about these Terms, please contact us through the Platform or refer to the documentation in the <code className="bg-muted px-1 rounded">docs/</code> directory.
            </p>
          </section>
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/login"
            className="text-primary hover:underline"
          >
            ← Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}

// This page is public
TermsPage.auth = false;

