/* eslint-disable */
// @ts-nocheck
import Image from "next/image";
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container max-w-4xl py-12 px-4">
        <div className="mb-8 text-center">
          <Link href="/login" className="inline-flex items-center gap-2 mb-6">
            <Image
              src="/images/logo.png"
              alt="LenQuant Logo"
              width={48}
              height={48}
              className="object-contain"
            />
            <span className="text-2xl font-bold">LenQuant</span>
          </Link>
          <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
        </div>

        <div className="prose prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              LenQuant ("we", "our", "the Platform") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our autonomous cryptocurrency trading platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-4">2.1 Authentication Information</h3>
            <p className="text-muted-foreground leading-relaxed">
              When you sign in using Google OAuth, we collect:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Your Google account email address</li>
              <li>Your name (as provided by Google)</li>
              <li>Your profile picture (if available)</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-4">2.2 Trading Configuration</h3>
            <p className="text-muted-foreground leading-relaxed">
              We store your trading preferences and settings:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Trading mode preferences (paper, testnet, live)</li>
              <li>Risk management settings (loss limits, position sizes)</li>
              <li>Automation level preferences</li>
              <li>UI mode preferences (Easy/Advanced)</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-4">2.3 Exchange API Credentials</h3>
            <p className="text-muted-foreground leading-relaxed">
              When you connect exchange accounts:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Exchange API keys are encrypted and stored securely</li>
              <li>API secrets are encrypted at rest</li>
              <li>We never store your exchange account passwords</li>
              <li>API keys are only used to execute trades and fetch market data as configured</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-4">2.4 Trading Activity</h3>
            <p className="text-muted-foreground leading-relaxed">
              We log and store:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Trade history and execution records</li>
              <li>Order placements and fills</li>
              <li>Position data</li>
              <li>Model predictions and forecasts</li>
              <li>Strategy performance metrics</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-4">2.5 Usage Data</h3>
            <p className="text-muted-foreground leading-relaxed">
              We may collect information about how you use the Platform:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Pages visited and features used</li>
              <li>Time spent on different sections</li>
              <li>Error logs and debugging information</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use the collected information to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Provide and maintain the Service</li>
              <li>Execute trades according to your configuration</li>
              <li>Improve model accuracy and trading strategies</li>
              <li>Send notifications and alerts</li>
              <li>Generate reports and analytics</li>
              <li>Ensure security and prevent fraud</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Data Storage and Security</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-4">4.1 Storage Location</h3>
            <p className="text-muted-foreground leading-relaxed">
              Your data is stored in MongoDB (local or cloud-based, depending on your configuration). You control where your data is stored.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-4">4.2 Security Measures</h3>
            <p className="text-muted-foreground leading-relaxed">
              We implement security measures including:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Encryption of sensitive data (API keys, secrets) at rest</li>
              <li>Encryption of data in transit (HTTPS/TLS)</li>
              <li>Secure authentication via OAuth 2.0</li>
              <li>Access controls and audit logging</li>
              <li>Regular security reviews</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-4">4.3 Your Responsibility</h3>
            <p className="text-muted-foreground leading-relaxed">
              You are responsible for:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Keeping your account credentials secure</li>
              <li>Using strong, unique passwords</li>
              <li>Enabling 2FA on exchange accounts</li>
              <li>Regularly reviewing your API key permissions</li>
              <li>Securing your local MongoDB instance if self-hosting</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Data Sharing and Disclosure</h2>
            <p className="text-muted-foreground leading-relaxed">
              We do not sell, trade, or rent your personal information to third parties. We may share information only in the following circumstances:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong>With your consent:</strong> When you explicitly authorize sharing</li>
              <li><strong>Service providers:</strong> With trusted third-party services that help operate the Platform (e.g., cloud hosting, analytics)</li>
              <li><strong>Legal requirements:</strong> When required by law, court order, or government regulation</li>
              <li><strong>Protection of rights:</strong> To protect our rights, privacy, safety, or property</li>
              <li><strong>Business transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Third-Party Services</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Platform integrates with:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong>Google OAuth:</strong> For authentication (subject to Google's Privacy Policy)</li>
              <li><strong>Cryptocurrency Exchanges:</strong> Via ccxt library (subject to each exchange's privacy policy)</li>
              <li><strong>LLM Providers:</strong> OpenAI/Anthropic (if enabled, for AI assistant features)</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              We are not responsible for the privacy practices of these third-party services. Please review their privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Your Rights and Choices</h2>
            <p className="text-muted-foreground leading-relaxed">
              You have the right to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong>Access:</strong> Request access to your personal data</li>
              <li><strong>Correction:</strong> Request correction of inaccurate data</li>
              <li><strong>Deletion:</strong> Request deletion of your account and data</li>
              <li><strong>Portability:</strong> Request export of your data</li>
              <li><strong>Opt-out:</strong> Disable certain features or data collection</li>
              <li><strong>Withdraw consent:</strong> Revoke permissions at any time</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              To exercise these rights, contact us through the Platform or delete your account in Settings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your information for as long as your account is active or as needed to provide the Service. Trading records and audit logs may be retained longer for compliance and legal purposes. When you delete your account, we will delete or anonymize your personal information, subject to legal retention requirements.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Children's Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Platform is not intended for users under the age of 18. We do not knowingly collect personal information from children. If you believe we have collected information from a child, please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. International Data Transfers</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your information may be transferred to and processed in countries other than your country of residence. These countries may have different data protection laws. By using the Service, you consent to the transfer of your information to these countries.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Changes to This Privacy Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new Privacy Policy on this page and updating the "Last updated" date. You are advised to review this Privacy Policy periodically for any changes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions about this Privacy Policy or our data practices, please contact us through the Platform or refer to the documentation in the <code className="bg-muted px-1 rounded">docs/</code> directory.
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
PrivacyPage.auth = false;

