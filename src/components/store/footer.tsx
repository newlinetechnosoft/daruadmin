import { Link } from '@tanstack/react-router'
import { Zap, ShieldCheck, Headphones } from 'lucide-react'

export function Footer() {
  return (
    <div>
      {/* Services Strip */}
      <section className="border-t border-b border-border py-10 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 shrink-0 grid place-items-center rounded-lg border border-border bg-background text-foreground">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-foreground">
                On-demand 40-minute delivery
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Rapid doorstep service across Kathmandu Valley.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="h-10 w-10 shrink-0 grid place-items-center rounded-lg border border-border bg-background text-foreground">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-foreground">
                Secure cashless payments
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Fonepay, eSewa, Khalti, ConnectIPS and Cash on Delivery.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="h-10 w-10 shrink-0 grid place-items-center rounded-lg border border-border bg-background text-foreground">
              <Headphones className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-foreground">
                Customer support
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Direct phone and WhatsApp helpline for deliveries.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Footer */}
      <footer className="pt-14 pb-8 bg-background border-t border-border text-foreground">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-[2fr_1fr_1fr_1fr] gap-10 pb-12">
            {/* Brand */}
            <div className="space-y-3">
              <Link
                to="/"
                className="text-base font-bold tracking-tight text-foreground inline-block"
              >
                MEZMANI
              </Link>
              <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
                Licensed food and beverage delivery platform. Genuine spirits, cold beer, wine, and groceries delivered straight to your door across Kathmandu Valley.
              </p>
            </div>

            {/* Catalog */}
            <div className="flex flex-col gap-2.5 text-xs">
              <h4 className="font-semibold text-foreground mb-1">
                Catalog
              </h4>
              <Link
                to="/drinks"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Liquor &amp; Spirits
              </Link>
              <Link
                to="/drinks"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Craft Beer &amp; Wine
              </Link>
              <Link
                to="/grocery"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Snacks &amp; Munchies
              </Link>
              <a
                href="/#reviews"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Customer Reviews
              </a>
            </div>

            {/* About */}
            <div className="flex flex-col gap-2.5 text-xs">
              <h4 className="font-semibold text-foreground mb-1">
                Company
              </h4>
              <a
                href="/#about"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                About Mezmani
              </a>
              <a
                href="/#about"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Delivery Areas
              </a>
              <a
                href="tel:+9779802088800"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Help (+977-9802088800)
              </a>
            </div>

            {/* Connect */}
            <div className="flex flex-col gap-2.5 text-xs">
              <h4 className="font-semibold text-foreground mb-1">
                Connect
              </h4>
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Facebook
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Instagram
              </a>
              <a
                href="https://tiktok.com"
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                TikTok
              </a>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4 border-t border-border text-[11px] text-muted-foreground">
            <span>© 2026 Mezmani Retail Pvt. Ltd. All rights reserved.</span>

            <div className="flex gap-2">
              <span className="px-2 py-0.5 rounded border border-border text-[10px] font-mono">
                eSewa
              </span>
              <span className="px-2 py-0.5 rounded border border-border text-[10px] font-mono">
                Khalti
              </span>
              <span className="px-2 py-0.5 rounded border border-border text-[10px] font-mono">
                Fonepay
              </span>
              <span className="px-2 py-0.5 rounded border border-border text-[10px] font-mono">
                COD
              </span>
            </div>
          </div>

          <p className="pt-2 text-[10px] text-muted-foreground/80">
            Please drink responsibly. 18+ verification enforced upon delivery.
          </p>
        </div>
      </footer>
    </div>
  )
}
