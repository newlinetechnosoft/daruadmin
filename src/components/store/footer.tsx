import { Link } from '@tanstack/react-router'
import { Facebook, Instagram } from 'lucide-react'

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M19.6 7.2a5.8 5.8 0 0 1-3.9-1.5v8.1a6.2 6.2 0 1 1-5.3-6.1v3.4a2.8 2.8 0 1 0 1.9 2.7V2.5h3.4c.2 2.2 1.8 4 3.9 4.3v.4Z" />
    </svg>
  )
}

export function Footer() {
  return (
    <footer
      id="about"
      className="scroll-mt-24 border-t border-sidebar-border bg-sidebar text-sidebar-foreground"
    >
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">

        <div className="grid grid-cols-2 gap-10 pb-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">

          {/* Brand */}
          <div className="col-span-2 space-y-3 lg:col-span-1">
            <Link to="/" className="inline-block">
              <img
                src="/mezmani_logo_bg.svg"
                alt="Mezmani"
                width="150"
                height="60"
                loading="lazy"
                className="h-auto w-36"
              />
            </Link>

            <p className="max-w-xs text-sm leading-relaxed text-sidebar-foreground/70">
              Good food, great drinks, delivered to your doorstep.
              Serving Butwal and Tilottama.
            </p>

            <div className="flex items-center gap-4 pt-2">
              <a
                href="https://www.facebook.com/profile.php?id=61596202793413"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="text-sidebar-foreground/60 transition-colors hover:text-[#1877F2]"
              >
                <Facebook className="h-5 w-5" />
              </a>

              <a
                href="https://www.instagram.com/mezmani_/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="text-sidebar-foreground/60 transition-colors hover:text-[#E4405F]"
              >
                <Instagram className="h-5 w-5" />
              </a>

              <a
                href="https://www.tiktok.com/@mezmani1"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TikTok"
                className="text-sidebar-foreground/60 transition-colors hover:text-white"
              >
                <TikTokIcon className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Explore */}
          <div className="flex flex-col gap-3 text-sm">
            <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              Explore
            </h4>

            <Link to="/drinks" className="text-sidebar-foreground/75 transition-colors hover:text-sidebar-primary">
              Drinks
            </Link>
            <Link to="/food" className="text-sidebar-foreground/75 transition-colors hover:text-sidebar-primary">
              Food
            </Link>
            <a href="/#reviews" className="text-sidebar-foreground/75 transition-colors hover:text-sidebar-primary">
              Reviews
            </a>
          </div>

          {/* Company */}
          <div className="flex flex-col gap-3 text-sm">
            <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              Company
            </h4>

            <a href="/#about" className="text-sidebar-foreground/75 transition-colors hover:text-sidebar-primary">
              About us
            </a>
            <a href="/#about" className="text-sidebar-foreground/75 transition-colors hover:text-sidebar-primary">
              Delivery areas
            </a>
            <a href="tel:+9779802088800" className="text-sidebar-foreground/75 transition-colors hover:text-sidebar-primary">
              Contact us
            </a>
          </div>

          {/* Support */}
          <div className="flex flex-col gap-3 text-sm">
            <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              Support
            </h4>

            <p className="max-w-xs text-sidebar-foreground/65">
              Need help with an order? We're happy to help.
            </p>
            <a
              href="tel:+9779802088800"
              className="font-medium text-sidebar-primary transition-opacity hover:opacity-80"
            >
              +977 9802088800
            </a>
          </div>
        </div>

        {/* Bottom */}
        <div className="flex flex-col gap-5 border-t border-sidebar-border pt-6 text-xs text-sidebar-foreground/60 sm:flex-row sm:items-center sm:justify-between">

          <p>
            © 2026 Mezmani Retail Pvt. Ltd. All rights reserved.
          </p>

          {/* Payment methods */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-semibold text-sidebar-foreground/80">
            <span>eSewa</span>
            <span>Khalti</span>
            <span>fonepay</span>
            <span>IME Pay</span>
          </div>
        </div>

        <p className="mt-5 text-xs text-sidebar-foreground/50">
          Please drink responsibly. 18+ verification required.
        </p>
      </div>
    </footer>
  )
}
