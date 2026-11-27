import { cn } from '#/lib/utils'

/**
 * Official payment gateway logos for customer checkout.
 */

export const PAYMENT_GATEWAY_IMAGE_URLS = {
  esewa:
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQgXxABSU_LxK7mGPYG7JgqsO8eD2g_1_pJvdAjrropVw&s=10',
  khalti: 'https://nepdora.com/images/payment-gateway/khalti.png',
  fonepay:
    'https://play-lh.googleusercontent.com/9Gn2R4yJ-lkoqeoIhj4ihYYU5Mli-Wn_GOUgNoqGSv6rbySeYzSH_3xH3Ve9yergDwZ2D4UyWwCosuePwBDx0g',
  connectips:
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT6S-vkdgbJPJNIUcpYNd9anfMWns5jDpVPnJ1FyF_5oQ&s=10',
  cod: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQSXNxvOav8W4IMVntLybNA-e0x-Ad72FyK86LJkT-ShQ&s=10',
}

export function CodLogo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'size-12 sm:size-14 rounded-2xl bg-white border border-gray-100 flex items-center justify-center p-1.5 shrink-0 shadow-2xs overflow-hidden',
        className,
      )}
    >
      <img
        src={PAYMENT_GATEWAY_IMAGE_URLS.cod}
        alt="Cash on Delivery"
        className="size-full object-contain"
        loading="lazy"
      />
    </div>
  )
}

export function EsewaLogo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'size-12 sm:size-14 rounded-2xl bg-white border border-gray-100 flex items-center justify-center p-1.5 shrink-0 shadow-2xs overflow-hidden',
        className,
      )}
    >
      <img
        src={PAYMENT_GATEWAY_IMAGE_URLS.esewa}
        alt="eSewa"
        className="size-full object-contain"
        loading="lazy"
      />
    </div>
  )
}

export function KhaltiLogo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'size-12 sm:size-14 rounded-2xl bg-white border border-gray-100 flex items-center justify-center p-1.5 shrink-0 shadow-2xs overflow-hidden',
        className,
      )}
    >
      <img
        src={PAYMENT_GATEWAY_IMAGE_URLS.khalti}
        alt="Khalti"
        className="size-full object-contain"
        loading="lazy"
      />
    </div>
  )
}

export function FonepayLogo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'size-12 sm:size-14 rounded-2xl bg-white border border-gray-100 flex items-center justify-center p-1.5 shrink-0 shadow-2xs overflow-hidden',
        className,
      )}
    >
      <img
        src={PAYMENT_GATEWAY_IMAGE_URLS.fonepay}
        alt="Fonepay"
        className="size-full object-contain"
        loading="lazy"
      />
    </div>
  )
}

export function ConnectIpsLogo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'size-12 sm:size-14 rounded-2xl bg-white border border-gray-100 flex items-center justify-center p-1.5 shrink-0 shadow-2xs overflow-hidden',
        className,
      )}
    >
      <img
        src={PAYMENT_GATEWAY_IMAGE_URLS.connectips}
        alt="ConnectIPS"
        className="size-full object-contain"
        loading="lazy"
      />
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
