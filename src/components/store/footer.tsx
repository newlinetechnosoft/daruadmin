import { Link } from '@tanstack/react-router'

export function Footer() {
  return (
    <div>
      {/* =========================================================
           SERVICES STRIP (from drinks.html)
      ========================================================= */}
      <section className="border-t border-b border-[#dedbd4] py-11 bg-white">
        <div className="w-[min(1220px,calc(100%-50px))] max-sm:w-[calc(100%-30px)] mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 shrink-0 grid place-items-center border border-[#dedbd4] rounded-full text-lg select-none">
              ⚡
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#181818]">
                On demand 40 minutes delivery
              </h3>
              <p className="mt-0.5 text-[10px] text-[#888]">
                Fast delivery to your doorstep.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 shrink-0 grid place-items-center border border-[#dedbd4] rounded-full text-lg select-none">
              🔒
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#181818]">
                Secure payments
              </h3>
              <p className="mt-0.5 text-[10px] text-[#888]">
                Safe and reliable payment options.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 shrink-0 grid place-items-center border border-[#dedbd4] rounded-full text-lg select-none">
              ◉
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#181818]">
                24/7 customer service
              </h3>
              <p className="mt-0.5 text-[10px] text-[#888]">
                We&apos;re always available to help.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
           FOOTER (from drinks.html)
      ========================================================= */}
      <footer className="pt-[70px] bg-[#111] text-white">
        <div className="w-[min(1220px,calc(100%-50px))] max-sm:w-[calc(100%-30px)] mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-[2fr_1fr_1fr_1fr] gap-12 pb-16">
            {/* BRAND */}
            <div className="space-y-4">
              <Link
                to="/"
                className="text-[21px] font-black tracking-[-0.07em] text-white uppercase inline-block"
              >
                MEZMANI
              </Link>
              <p className="max-w-[260px] text-[11px] leading-[1.8] text-[#777]">
                Food &amp; drinks delivery. Premium beverages and food delivered
                straight to your doorstep across Kathmandu Valley.
              </p>
            </div>

            {/* EXTRAS */}
            <div className="flex flex-col gap-2.5">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.13em] text-white mb-1.5">
                Extras
              </h4>
              <Link
                to="/drinks"
                className="text-[11px] text-[#777] hover:text-white transition-colors"
              >
                Cocktail Recipes
              </Link>
              <Link
                to="/drinks"
                className="text-[11px] text-[#777] hover:text-white transition-colors"
              >
                Give a Gift
              </Link>
              <a
                href="/#reviews"
                className="text-[11px] text-[#777] hover:text-white transition-colors"
              >
                Reviews
              </a>
              <Link
                to="/drinks"
                className="text-[11px] text-[#777] hover:text-white transition-colors"
              >
                Share &amp; Save 20%
              </Link>
            </div>

            {/* ABOUT */}
            <div className="flex flex-col gap-2.5">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.13em] text-white mb-1.5">
                About
              </h4>
              <a
                href="/#about"
                className="text-[11px] text-[#777] hover:text-white transition-colors"
              >
                About Us
              </a>
              <a
                href="/#about"
                className="text-[11px] text-[#777] hover:text-white transition-colors"
              >
                Find Us
              </a>
              <a
                href="tel:+9779802088800"
                className="text-[11px] text-[#777] hover:text-white transition-colors"
              >
                Contact (+977-9802088800)
              </a>
              <a
                href="/#about"
                className="text-[11px] text-[#777] hover:text-white transition-colors"
              >
                Help &amp; Support
              </a>
            </div>

            {/* CONNECT */}
            <div className="flex flex-col gap-2.5">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.13em] text-white mb-1.5">
                Connect
              </h4>
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-[#777] hover:text-white transition-colors"
              >
                Facebook
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-[#777] hover:text-white transition-colors"
              >
                Instagram
              </a>
              <a
                href="https://tiktok.com"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-[#777] hover:text-white transition-colors"
              >
                TikTok
              </a>
            </div>
          </div>

          {/* BOTTOM ROW */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-5 border-t border-[#292929] text-[9px] text-[#555]">
            <span>© 2026 Mezmani Pvt. Ltd. All Rights Reserved.</span>

            <div className="flex gap-2">
              <span className="px-2 py-1 border border-[#292929] text-[#777] uppercase font-semibold">
                eSewa
              </span>
              <span className="px-2 py-1 border border-[#292929] text-[#777] uppercase font-semibold">
                Khalti
              </span>
              <span className="px-2 py-1 border border-[#292929] text-[#777] uppercase font-semibold">
                Fonepay
              </span>
              <span className="px-2 py-1 border border-[#292929] text-[#777] uppercase font-semibold">
                IME Pay
              </span>
            </div>
          </div>

          <p className="pb-5 text-[9px] text-[#444]">
            Please drink responsibly. 18+ only.
          </p>
        </div>
      </footer>
    </div>
  )
}
