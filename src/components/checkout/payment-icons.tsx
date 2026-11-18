import { cn } from '#/lib/utils'

/**
 * High-fidelity, brand-accurate SVG payment gateway logos
 * for the customer checkout payment method selector.
 */

export function CodLogo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'size-14 sm:size-16 rounded-2xl bg-[#E8F8EE] dark:bg-emerald-950/60 flex items-center justify-center p-2.5 shrink-0 border border-emerald-100/80 dark:border-emerald-900/40 shadow-xs',
        className,
      )}
    >
      <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {/* Shadow under banknote */}
        <ellipse cx="36" cy="38" rx="20" ry="4" fill="#000000" fillOpacity="0.06" />

        {/* Tilted back banknote */}
        <rect
          x="19"
          y="15"
          width="32"
          height="19"
          rx="3"
          transform="rotate(-7 19 15)"
          fill="#34D399"
        />
        <circle
          cx="34"
          cy="22"
          r="3.5"
          transform="rotate(-7 34 22)"
          fill="#10B981"
        />

        {/* Main crisp green banknote */}
        <rect
          x="15"
          y="18"
          width="35"
          height="21"
          rx="3.5"
          fill="#10B981"
        />
        {/* Banknote inner dash line */}
        <rect
          x="17.5"
          y="20.5"
          width="30"
          height="16"
          rx="2"
          stroke="#A7F3D0"
          strokeWidth="1.2"
          strokeDasharray="2.5 2"
          fill="none"
        />
        {/* Central emblem */}
        <circle cx="32.5" cy="28.5" r="5" fill="#059669" />
        <circle cx="32.5" cy="28.5" r="3" fill="#6EE7B7" />

        {/* Cuff & sleeve from bottom-left */}
        <path
          d="M7 57L17 41L24 45L14 61H7V57Z"
          fill="#273240"
        />
        <path
          d="M16 42.5L19.5 37.5L25.5 41.5L22 46.5L16 42.5Z"
          fill="#F8FAFC"
        />

        {/* Human hand holding banknote */}
        <path
          d="M19 38C22 33 29 33 36 35.5C39 36.5 44 39.5 43 43.5C41.5 46.5 36.5 47.5 32 47.5C26 47.5 21.5 45 19.5 42L19 38Z"
          fill="#F7B08B"
        />
        {/* Curled thumb over banknote */}
        <path
          d="M26 34C27 30 31.5 29 34.5 31C36.5 32.5 36.5 35 33 36.5C30 37.5 27 36.5 26 34Z"
          fill="#F39C78"
        />
        {/* Finger crease detail */}
        <path
          d="M31 41.5C33.5 41.5 36 42.5 37 44.5C36 46 32.5 46 30.5 45L31 41.5Z"
          fill="#EA7A53"
        />
      </svg>
    </div>
  )
}

export function EsewaLogo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'size-14 sm:size-16 rounded-2xl flex items-center justify-center shrink-0 shadow-xs',
        className,
      )}
    >
      <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="size-12 sm:size-14"
      >
        {/* Official eSewa Green Circle */}
        <circle cx="32" cy="32" r="30" fill="#60BB46" />
        {/* eSewa Stylized 'e' */}
        <path
          d="M33 18C23.8 18 17.5 24.2 17.5 33C17.5 41.8 23.8 47 33 47C39.2 47 44.2 43.8 46.8 39.5L40.8 36C39.2 38.5 36.5 40 33 40C28 40 24.6 36.8 24.2 32.2H48C48.2 31.3 48.3 30.4 48.3 29.5C48.3 22.5 42.5 18 33 18ZM24.2 27.8C25 23.8 28.5 21.6 33 21.6C37.5 21.6 41 23.8 41.8 27.8H24.2Z"
          fill="white"
        />
      </svg>
    </div>
  )
}

export function KhaltiLogo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'size-14 sm:size-16 rounded-2xl flex items-center justify-center shrink-0 shadow-xs',
        className,
      )}
    >
      <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="size-12 sm:size-14"
      >
        {/* Official Khalti Purple Shield */}
        <path
          d="M13 14C13 11.8 14.8 10 17 10H47C49.2 10 51 11.8 51 14V34C51 46.5 40.5 54.5 32 58C23.5 54.5 13 46.5 13 34V14Z"
          fill="#5C2D91"
        />
        {/* Khalti Bold 'K' Monogram */}
        <path
          d="M23.5 20.5H29V30.5L37.5 20.5H44.5L35 31.5L45 44.5H38L30.5 34V44.5H23.5V20.5Z"
          fill="white"
        />
      </svg>
    </div>
  )
}

export function FonepayLogo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'size-14 sm:size-16 rounded-2xl flex items-center justify-center shrink-0 shadow-xs',
        className,
      )}
    >
      <svg
        viewBox="0 0 76 50"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-13 sm:w-15 h-auto"
      >
        {/* Official Fonepay Red Card */}
        <rect width="76" height="50" rx="9" fill="#ED1C24" />
        {/* Signature 3 dots above 'n' */}
        <circle cx="32" cy="13.5" r="1.8" fill="white" />
        <circle cx="36.5" cy="11.5" r="1.8" fill="white" />
        <circle cx="41" cy="13.5" r="1.8" fill="white" />
        {/* fonepay typography */}
        <text
          x="38"
          y="33"
          textAnchor="middle"
          fill="white"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize="17"
          fontWeight="800"
          letterSpacing="-0.6"
        >
          fone<tspan fontWeight="400">pay</tspan>
        </text>
      </svg>
    </div>
  )
}

export function ConnectIpsLogo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'size-14 sm:size-16 rounded-2xl bg-[#F0F6FF] dark:bg-sky-950/60 border border-sky-100 dark:border-sky-900/40 flex items-center justify-center p-1.5 shrink-0 shadow-xs',
        className,
      )}
    >
      <svg
        viewBox="0 0 86 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {/* ConnectIPS geometric flower spiral */}
        <g transform="translate(43, 22) scale(0.68)">
          <circle cx="0" cy="-14" r="5" stroke="#E31E24" strokeWidth="2.4" fill="none" />
          <circle cx="10" cy="-10" r="5" stroke="#E31E24" strokeWidth="2.4" fill="none" />
          <circle cx="14" cy="0" r="5" stroke="#E31E24" strokeWidth="2.4" fill="none" />
          <circle cx="10" cy="10" r="5" stroke="#E31E24" strokeWidth="2.4" fill="none" />
          <circle cx="0" cy="14" r="5" stroke="#E31E24" strokeWidth="2.4" fill="none" />
          <circle cx="-10" cy="10" r="5" stroke="#E31E24" strokeWidth="2.4" fill="none" />
          <circle cx="-14" cy="0" r="5" stroke="#E31E24" strokeWidth="2.4" fill="none" />
          <circle cx="-10" cy="-10" r="5" stroke="#E31E24" strokeWidth="2.4" fill="none" />
          <circle cx="0" cy="0" r="3" fill="#E31E24" />
        </g>
        {/* connectIPS text */}
        <text
          x="43"
          y="52"
          textAnchor="middle"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
          fontSize="12.5"
          fontWeight="600"
          fill="#0B3C68"
        >
          connect<tspan fontWeight="800" fill="#0B3C68">IPS</tspan>
        </text>
      </svg>
    </div>
  )
}

export function getPaymentGatewayLogo(id: string) {
  switch (id) {
    case 'cod':
      return <CodLogo />
    case 'esewa':
      return <EsewaLogo />
    case 'khalti':
      return <KhaltiLogo />
    case 'fonepay':
      return <FonepayLogo />
    case 'connectips':
      return <ConnectIpsLogo />
    default:
      return <CodLogo />
  }
}
