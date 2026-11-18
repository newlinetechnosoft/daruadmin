import { useQuery } from '@tanstack/react-query'
import { storefrontQueries } from '#/queries/storefront'
import type { StoreSettings } from '#/server/operations/types'

export const DEFAULT_PUBLIC_STORE_SETTINGS: StoreSettings = {
  storeName: 'Mezmani',
  legalName: 'Mezmani Retail Pvt. Ltd.',
  pan: '609823145',
  vat: '609823145',
  phone: '+977-9847820683',
  email: 'ops@mezmani.com.np',
  address: 'Traffic Chowk, Ward 8',
  city: 'Butwal',
  province: 'Lumbini Province',
  postalCode: '32907',
  companyRegNo: '189421/078/079',
  tagline: "Nepal's Fastest Late-Night Liquor & Food Delivery",
  supportPhone: '+977-9847820683',
  secondaryPhone: '+977-9800000000',
  websiteUrl: 'https://mezmani.com',
  operatingHours: '24/7 (Late Night Express)',
  currency: 'NPR',
  currencySymbol: 'Rs.',
  invoicePrefix: 'MEZ-INV-',
  taxRate: 13,
  lowStockThreshold: 5,
  ageGate: true,
  notifyEmail: true,
  notifySms: true,
  gateways: {
    cod: { enabled: true, merchantId: '', mode: 'live' },
    esewa: { enabled: true, merchantId: 'EPAYTEST', mode: 'sandbox' },
    khalti: { enabled: false, merchantId: '', mode: 'sandbox' },
    fonepay: { enabled: false, merchantId: '', mode: 'sandbox' },
    connectips: { enabled: false, merchantId: '', mode: 'sandbox' },
  },
  riderCodLimit: 2000000,
  deliveryFee: 15000,
  freeDeliveryThreshold: 300000,
}

export function useStoreSettings(): StoreSettings {
  const { data } = useQuery(storefrontQueries.publicSettings())
  return (data as StoreSettings | undefined) ?? DEFAULT_PUBLIC_STORE_SETTINGS
}
