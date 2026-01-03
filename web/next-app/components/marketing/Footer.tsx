import Link from "next/link";
import { Twitter, MessageCircle, Github } from "lucide-react";

const footerLinks = {
  product: [
    { name: "Extension", href: "/extension" },
    { name: "Platform", href: "/platform" },
    { name: "Pricing", href: "/#pricing" },
  ],
  company: [
    { name: "Contact", href: "mailto:support@lenquant.com" },
  ],
  legal: [
    { name: "Privacy Policy", href: "/privacy" },
    { name: "Terms of Use", href: "/terms" },
  ],
  social: [
    { name: "Twitter", href: "https://twitter.com/lenquant", icon: Twitter },
    { name: "Discord", href: "https://discord.gg/lenquant", icon: MessageCircle },
    { name: "GitHub", href: "https://github.com/lenquant", icon: Github },
  ],
};

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border/50 bg-background">
      <div className="container-marketing py-12 lg:py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
          {/* Brand */}
          <div className="col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              {/* PLACEHOLDER: Replace with actual logo */}
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">L</span>
              </div>
              <span className="font-display text-xl font-bold text-foreground">
                LenQuant
              </span>
            </Link>
            <p className="mt-4 text-sm text-muted-foreground max-w-xs">
              Your objective trading second opinion. AI-powered market analysis
              for disciplined crypto trading.
            </p>
            {/* Social Links */}
            <div className="mt-6 flex gap-4">
              {footerLinks.social.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={item.name}
                >
                  <item.icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">Product</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.product.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">Company</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.company.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">Legal</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.legal.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-12 border-t border-border/50 pt-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-sm text-muted-foreground">
              © {currentYear} LenQuant. All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground max-w-xl text-center md:text-right">
              ⚠️ Disclaimer: LenQuant is a decision support tool, not a signal
              service. It does not guarantee profits or make trading decisions
              for you. Trading cryptocurrency involves substantial risk of loss.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
