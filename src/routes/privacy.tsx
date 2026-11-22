import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Header } from '#/components/store/header'
import { Footer } from '#/components/store/footer'
import {
  ShieldCheck,
  Lock,
  Eye,
  FileText,
  MapPin,
  Sparkles,
  Smartphone,
  CreditCard,
  UserCheck,
  Scale,
  Mail,
  Phone,
  AlertTriangle,
  ChevronRight,
  Database,
  ExternalLink,
  Search,
} from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import { Input } from '#/components/ui/input'

export const Route = createFileRoute('/privacy')({
  component: PrivacyPolicyPage,
  head: () => ({
    meta: [
      {
        title: 'Privacy Policy & Google Compliance Standards | Mezmani Nepal',
      },
      {
        name: 'description',
        content:
          'Official Privacy Policy for Mezmani.com. Details our user data protection practices, Google Ads and Analytics compliance, 18+ age verification for liquor delivery, and consumer privacy rights.',
      },
    ],
  }),
})

interface SectionItem {
  id: string
  title: string
  icon: typeof ShieldCheck
  badge?: string
}

const SECTIONS: SectionItem[] = [
  { id: 'google-compliance', title: 'Google Criteria & Third-Party Services', icon: Sparkles, badge: 'Google Compliant' },
  { id: 'data-collected', title: 'Categories of Personal Data Collected', icon: Database },
  { id: 'age-verification', title: 'Age Verification & 18+ Alcohol Policy', icon: AlertTriangle, badge: 'Legal 18+' },
  { id: 'how-we-use-data', title: 'How We Use Your Information', icon: Eye },
  { id: 'payments', title: 'Financial Information & Payment Security', icon: CreditCard },
  { id: 'location-tracking', title: 'GPS Geolocation & Delivery Zoning', icon: MapPin },
  { id: 'data-sharing', title: 'Third-Party Disclosures & Riders', icon: UserCheck },
  { id: 'cookies', title: 'Cookies & Analytics Disclosure', icon: Smartphone },
  { id: 'security', title: 'Data Storage & Security Measures', icon: Lock },
  { id: 'user-rights', title: 'Your Rights & Data Deletion Requests', icon: Scale },
  { id: 'contact-dpo', title: 'Contact Our Data Protection Officer', icon: Mail },
]

function PrivacyPolicyPage() {
  const [activeSection, setActiveSection] = useState('google-compliance')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredSections = SECTIONS.filter(
    (sec) =>
      sec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sec.id.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const scrollToSection = (id: string) => {
    setActiveSection(id)
    const element = document.getElementById(id)
    if (element) {
      const yOffset = -90
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset
      window.scrollTo({ top: y, behavior: 'smooth' })
    }
  }

  return (
    <div className="storefront min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-300 w-full overflow-x-hidden">
      <Header />

      {/* Hero Header */}
      <section className="relative border-b border-border/60 bg-gradient-to-b from-amber-500/10 via-primary/5 to-transparent pt-10 pb-12 sm:pt-16 sm:pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto space-y-4 text-center sm:text-left">
          {/* Breadcrumb Navigation */}
          <nav aria-label="Breadcrumb" className="flex items-center justify-center sm:justify-start space-x-2 text-xs text-muted-foreground mb-2">
            <Link to="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="font-semibold text-foreground">Privacy Policy</span>
          </nav>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary font-bold text-xs px-3 py-1 gap-1.5 shadow-sm">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Official Legal Policy</span>
            </Badge>
            <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-xs px-3 py-1">
              Google Verified Standards
            </Badge>
            <span className="text-xs text-muted-foreground">
              Effective Date: January 1, 2026 | Last Updated: November 2026
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
            Privacy Policy & Consumer Protection
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-3xl leading-relaxed">
            Mezmani Retail Pvt. Ltd. (<strong className="text-foreground">"Mezmani"</strong>, <strong className="text-foreground">"we"</strong>, <strong className="text-foreground">"us"</strong>, or <strong className="text-foreground">"our"</strong>) operates <a href="https://mezmani.com" className="text-primary hover:underline">mezmani.com</a> and its associated mobile ordering systems. This policy discloses our complete data handling practices, compliance with Google developer policies, Nepal Individual Privacy Act (2075), and consumer protection standards.
          </p>
        </div>
      </section>

      {/* Main Content Layout */}
      <div className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 pb-28 md:pb-16 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 items-start">
        {/* Sticky Table of Contents Sidebar (Desktop) */}
        <aside className="hidden lg:block sticky top-24 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Filter topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-9 rounded-xl border-border bg-card shadow-xs"
            />
          </div>

          <div className="rounded-2xl border border-border/80 bg-card p-3 shadow-md space-y-1 max-h-[calc(100vh-180px)] overflow-y-auto">
            <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Document Contents
            </p>
            {filteredSections.map((sec) => {
              const Icon = sec.icon
              const isActive = activeSection === sec.id

              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => scrollToSection(sec.id)}
                  className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-primary/15 text-primary shadow-xs'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{sec.title}</span>
                  </div>
                  {sec.badge && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-primary/20 text-primary font-mono shrink-0 ml-1">
                      {sec.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <Card className="p-4 rounded-2xl border-border/80 bg-muted/40 text-xs space-y-2">
            <p className="font-bold text-foreground flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-primary" />
              <span>Need Data Assistance?</span>
            </p>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Contact our designated Data Protection Officer (DPO) at <strong className="text-foreground">ops@mezmani.com.np</strong> for any privacy inquiries or account erasure requests.
            </p>
          </Card>
        </aside>

        {/* Policy Body */}
        <main className="space-y-10 min-w-0">
          {/* Quick Notice Card */}
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:p-5 flex items-start gap-3.5 shadow-sm">
            <div className="h-9 w-9 rounded-xl bg-primary/15 text-primary border border-primary/30 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="space-y-1 text-xs">
              <h3 className="font-bold text-foreground text-sm">
                Commitment to Transparency & Responsible Delivery
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Mezmani is fully committed to user privacy and ethical eCommerce. We never sell your personal information to data brokers or advertising exchanges. Information collected is used strictly for immediate order fulfillment, rider dispatch, verified age governance, and account protection.
              </p>
            </div>
          </div>

          {/* Section 1: Google Criteria & Third-Party Service Disclosure */}
          <section id="google-compliance" className="scroll-mt-24 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shadow-inner">
                <Sparkles className="h-4 w-4" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                1. Google Criteria & Third-Party Platform Disclosures
              </h2>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              To guarantee full compliance with <strong className="text-foreground">Google Ads Policies</strong>, <strong className="text-foreground">Google Merchant Center Guidelines</strong>, and <strong className="text-foreground">Google OAuth User Data Policies</strong>, Mezmani publishes the following explicit criteria:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* Google Analytics 4 */}
              <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-foreground">
                    Google Analytics 4 (GA4)
                  </h4>
                  <Badge variant="outline" className="text-[10px] text-blue-600 dark:text-blue-400 border-blue-500/30 bg-blue-500/10">
                    Analytics
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  We utilize Google Analytics to understand aggregate platform usage, identify site performance bottlenecks, and improve customer experience. GA4 collects anonymized IP addresses, browser types, interaction events, and session lengths. IP masking is enabled by default.
                </p>
                <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                  <span>Opt-out available via the </span>
                  <a
                    href="https://tools.google.com/dlpage/gaoptout"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    <span>Google Analytics Opt-out Browser Add-on</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>.
                </div>
              </div>

              {/* Google OAuth & Sign-In */}
              <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-foreground">
                    Google Sign-In / OAuth 2.0
                  </h4>
                  <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                    Authentication
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  When you authenticate via Google Sign-In, Mezmani receives your verified Google email address, display name, and avatar image. We use this information solely to create and authenticate your account. We never access your Google Drive, Contacts, Gmail, or private Google files.
                </p>
                <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                  Google user data is never transferred to external data brokers.
                </div>
              </div>

              {/* Google Maps & Geocoding */}
              <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-foreground">
                    Google Maps Platform APIs
                  </h4>
                  <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10">
                    Routing & Zones
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  We use Google Maps API to validate delivery pinpoints across Butwal and Tilottama, compute distance from the assigned dispatch dealer, and estimate real-time delivery arrival times. Your location is queried strictly upon active checkout or address selection.
                </p>
              </div>

              {/* Google Advertising Standards */}
              <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-foreground">
                    Google Ads & Remarketing
                  </h4>
                  <Badge variant="outline" className="text-[10px] text-purple-600 dark:text-purple-400 border-purple-500/30 bg-purple-500/10">
                    Advertising
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Mezmani strictly complies with Google's Personalized Advertising Policies. We do not use sensitive personal categories, financial records, or minor demographic data for ad targeting. Users can adjust ad preferences anytime via <a href="https://myadcenter.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google My Ad Center</a>.
                </p>
              </div>
            </div>
          </section>

          {/* Section 2: Categories of Personal Data Collected */}
          <section id="data-collected" className="scroll-mt-24 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shadow-inner">
                <Database className="h-4 w-4" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                2. Categories of Personal Data Collected
              </h2>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              We collect information that you directly provide to us, as well as automatic device data generated when you interact with the service:
            </p>

            <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b border-border/60 text-muted-foreground font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3 sm:p-4">Category</th>
                    <th className="p-3 sm:p-4">Data Elements Collected</th>
                    <th className="p-3 sm:p-4">Primary Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  <tr className="hover:bg-muted/30">
                    <td className="p-3 sm:p-4 font-bold text-foreground">Identity & Account</td>
                    <td className="p-3 sm:p-4 text-muted-foreground">Name, email address, password hash, profile avatar, account ID</td>
                    <td className="p-3 sm:p-4 text-muted-foreground">Account authentication, profile management, and account recovery</td>
                  </tr>
                  <tr className="hover:bg-muted/30">
                    <td className="p-3 sm:p-4 font-bold text-foreground">Contact & Verification</td>
                    <td className="p-3 sm:p-4 text-muted-foreground">Nepali mobile number (+977), One-Time Password (OTP) verification records</td>
                    <td className="p-3 sm:p-4 text-muted-foreground">Identity validation, delivery rider calls, and SMS notification alerts</td>
                  </tr>
                  <tr className="hover:bg-muted/30">
                    <td className="p-3 sm:p-4 font-bold text-foreground">Delivery & Location</td>
                    <td className="p-3 sm:p-4 text-muted-foreground">GPS coordinates, street address, tole/chowk landmark, municipality</td>
                    <td className="p-3 sm:p-4 text-muted-foreground">Delivery routing, zone validation, and driver navigation</td>
                  </tr>
                  <tr className="hover:bg-muted/30">
                    <td className="p-3 sm:p-4 font-bold text-foreground">Transactions & Orders</td>
                    <td className="p-3 sm:p-4 text-muted-foreground">Items purchased, quantity, total price, invoice IDs, payment reference IDs</td>
                    <td className="p-3 sm:p-4 text-muted-foreground">Order packing, accounting audit, and tax compliance (Nepal IRD)</td>
                  </tr>
                  <tr className="hover:bg-muted/30">
                    <td className="p-3 sm:p-4 font-bold text-foreground">Technical & Usage</td>
                    <td className="p-3 sm:p-4 text-muted-foreground">IP address, browser type, operating system, page views, cookie identifiers</td>
                    <td className="p-3 sm:p-4 text-muted-foreground">Security protection, fraud prevention, and performance telemetry</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 3: Age Verification & Alcohol Governance */}
          <section id="age-verification" className="scroll-mt-24 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center shadow-inner">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                3. Age Verification & 18+ Alcohol Compliance
              </h2>
            </div>

            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-6 space-y-3">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-sm">
                <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-extrabold text-xs">
                  STRICT COMPLIANCE NOTICE
                </Badge>
                <span>Nepal National Liquor Regulation & Google Restricted Goods Policy</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Under the laws of Nepal and Google's Advertising Policies for Alcoholic Beverages, it is strictly unlawful to sell or deliver alcoholic beverages to persons under the age of <strong className="text-foreground">18 years</strong>.
              </p>
              <ul className="text-xs text-muted-foreground space-y-2 list-disc list-inside">
                <li>
                  <strong className="text-foreground">Digital Age Gate:</strong> Visitors are required to verify that they are 18 years of age or older before browsing our alcoholic beverage catalog.
                </li>
                <li>
                  <strong className="text-foreground">Mandatory Physical ID Verification:</strong> Upon delivery, our authorized riders reserve the legal right and responsibility to request government-issued photo identification (Nagrikta, Driving License, or Passport).
                </li>
                <li>
                  <strong className="text-foreground">Refusal of Delivery:</strong> Delivery will be refused without refund of shipping fees if the recipient is underage or unable to produce valid identification.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 4: How We Use Your Information */}
          <section id="how-we-use-data" className="scroll-mt-24 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shadow-inner">
                <Eye className="h-4 w-4" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                4. How We Use Your Information
              </h2>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              We process personal information only when there is a legitimate business need or statutory requirement:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div className="rounded-xl border border-border/70 bg-card p-3.5 space-y-1">
                <p className="font-bold text-foreground">Order Dispatch & Delivery</p>
                <p className="text-muted-foreground">Assigning orders to licensed regional dealers and delivery riders to deliver quickly across Butwal and Tilottama.</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card p-3.5 space-y-1">
                <p className="font-bold text-foreground">SMS & OTP Verification</p>
                <p className="text-muted-foreground">Verifying customer mobile numbers, sending order confirmations, and providing dispatch status alerts.</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card p-3.5 space-y-1">
                <p className="font-bold text-foreground">Customer Support</p>
                <p className="text-muted-foreground">Investigating order delays, resolving complaints, processing item replacements, and issuing transaction refunds.</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card p-3.5 space-y-1">
                <p className="font-bold text-foreground">Tax & Legal Compliance</p>
                <p className="text-muted-foreground">Maintaining financial ledgers, issuing VAT invoices, and satisfying requirements mandated by the Nepal Inland Revenue Department (IRD).</p>
              </div>
            </div>
          </section>

          {/* Section 5: Financial Information & Payment Security */}
          <section id="payments" className="scroll-mt-24 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shadow-inner">
                <CreditCard className="h-4 w-4" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                5. Financial Information & Payment Security
              </h2>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              Mezmani partners exclusively with Nepal Rastra Bank (NRB) licensed Payment Service Providers (PSPs):
            </p>

            <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-3 text-xs shadow-xs">
              <div className="flex flex-wrap items-center gap-3 font-semibold text-foreground border-b border-border/60 pb-3">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">eSewa</span>
                <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">Khalti</span>
                <span className="px-2.5 py-1 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">Fonepay / QR</span>
                <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">ConnectIPS</span>
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">Cash on Delivery</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Zero Sensitive Card/PIN Storage:</strong> Mezmani servers do NOT store your bank account passwords, debit/credit card CVVs, or wallet PINs. All electronic transactions occur directly on the secure, encrypted gateways of the payment processor. Mezmani only receives a confirmation token and transaction reference ID for order validation.
              </p>
            </div>
          </section>

          {/* Section 6: Geolocation & Delivery Zoning */}
          <section id="location-tracking" className="scroll-mt-24 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shadow-inner">
                <MapPin className="h-4 w-4" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                6. GPS Geolocation & Delivery Zoning
              </h2>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              When placing an order, you may grant permission for our app to access your device's precise location. We use this GPS coordinate data solely to:
            </p>
            <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
              <li>Confirm your address is within our active delivery service zones in Butwal, Tilottama, or surrounding hubs.</li>
              <li>Assign the closest licensed dealer hub to pack and prepare your order.</li>
              <li>Provide accurate turn-by-turn navigation for the assigned delivery rider.</li>
            </ul>
            <p className="text-xs text-muted-foreground leading-relaxed">
              We do not track your location in the background when the application is closed. You can disable location permissions in your browser or device settings at any time; however, manual street address entry will be required.
            </p>
          </section>

          {/* Section 7: Third-Party Disclosures & Delivery Riders */}
          <section id="data-sharing" className="scroll-mt-24 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shadow-inner">
                <UserCheck className="h-4 w-4" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                7. Third-Party Disclosures & Delivery Riders
              </h2>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              We strictly limit the sharing of your personal data to authorized parties required to fulfill your order:
            </p>

            <div className="space-y-2.5 text-xs">
              <div className="rounded-xl border border-border/80 bg-card p-3.5 space-y-1">
                <p className="font-bold text-foreground">Assigned Delivery Riders</p>
                <p className="text-muted-foreground">Riders are provided only your first name, delivery address landmark, and mobile phone number to execute the delivery call. Riders are contractually prohibited from retaining or using customer phone numbers for personal contact.</p>
              </div>
              <div className="rounded-xl border border-border/80 bg-card p-3.5 space-y-1">
                <p className="font-bold text-foreground">SMS Gateway Provider</p>
                <p className="text-muted-foreground">Phone numbers are passed securely to our licensed Nepali telecom SMS aggregator for instantaneous OTP dispatch and delivery status text messages.</p>
              </div>
              <div className="rounded-xl border border-border/80 bg-card p-3.5 space-y-1">
                <p className="font-bold text-foreground">Law Enforcement & Court Orders</p>
                <p className="text-muted-foreground">We may disclose user data if required by formal court order, search warrant, or binding statutory directive from law enforcement agencies under the laws of Nepal.</p>
              </div>
            </div>
          </section>

          {/* Section 8: Cookies & Analytics Disclosure */}
          <section id="cookies" className="scroll-mt-24 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shadow-inner">
                <Smartphone className="h-4 w-4" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                8. Cookies & Local Storage Disclosure
              </h2>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              Our website uses cookies, local storage, and session tokens to deliver a seamless shopping experience:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="rounded-xl border border-border/80 bg-card p-3 space-y-1">
                <p className="font-bold text-foreground">Essential Cookies</p>
                <p className="text-muted-foreground text-[11px]">Necessary for user authentication, maintaining shopping cart items, and age gate status verification.</p>
              </div>
              <div className="rounded-xl border border-border/80 bg-card p-3 space-y-1">
                <p className="font-bold text-foreground">Preference Cookies</p>
                <p className="text-muted-foreground text-[11px]">Remembers your visual theme (Dark vs. Light mode) and preferred delivery location shortcuts.</p>
              </div>
              <div className="rounded-xl border border-border/80 bg-card p-3 space-y-1">
                <p className="font-bold text-foreground">Analytics Cookies</p>
                <p className="text-muted-foreground text-[11px]">Google Analytics cookies used to analyze traffic and improve user interface performance.</p>
              </div>
            </div>
          </section>

          {/* Section 9: Security Safeguards */}
          <section id="security" className="scroll-mt-24 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shadow-inner">
                <Lock className="h-4 w-4" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                9. Data Storage & Technical Security Safeguards
              </h2>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              We employ industry-standard technical and organizational security controls to protect your data against unauthorized access, loss, or alteration:
            </p>

            <ul className="text-xs text-muted-foreground space-y-2 list-disc list-inside">
              <li><strong className="text-foreground">Transport Encryption:</strong> All communications between your browser and Mezmani servers are encrypted using modern Transport Layer Security (TLS 1.3 / HTTPS).</li>
              <li><strong className="text-foreground">Password Hashing:</strong> User passwords are cryptographically hashed using salted, slow-hash algorithms (Bcrypt/Argon2). We cannot read your raw password.</li>
              <li><strong className="text-foreground">Role-Based Access Control (RBAC):</strong> Employee access to customer records is restricted by least-privilege administrative roles and audited.</li>
              <li><strong className="text-foreground">Database Security:</strong> Production databases are protected by firewall boundaries, continuous automated backups, and encrypted storage volumes.</li>
            </ul>
          </section>

          {/* Section 10: User Rights & Data Deletion */}
          <section id="user-rights" className="scroll-mt-24 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shadow-inner">
                <Scale className="h-4 w-4" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                10. Your Rights & Data Deletion Requests
              </h2>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              Under Nepal's Individual Privacy Act (2075) and international privacy frameworks, you have full ownership and control over your personal data:
            </p>

            <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-4 text-xs shadow-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="font-bold text-foreground">Right of Access & Portability</p>
                  <p className="text-muted-foreground text-[11px]">View your account records, verified phone numbers, and full order history anytime in your profile dashboard.</p>
                </div>
                <div>
                  <p className="font-bold text-foreground">Right to Rectification</p>
                  <p className="text-muted-foreground text-[11px]">Update your mobile number via OTP, modify your profile photo, or change your password directly in <Link to="/profile" className="text-primary hover:underline font-semibold">My Profile</Link>.</p>
                </div>
                <div>
                  <p className="font-bold text-foreground">Right to Erasure (Account Deletion)</p>
                  <p className="text-muted-foreground text-[11px]">Request complete deletion of your account and personal identifiers from our production systems.</p>
                </div>
                <div>
                  <p className="font-bold text-foreground">Right to Revoke Consent</p>
                  <p className="text-muted-foreground text-[11px]">Opt-out of non-essential promotional communications and adjust cookie preferences at any time.</p>
                </div>
              </div>

              <div className="pt-3 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-[11px] text-muted-foreground">
                  To request complete account erasure or export your data dossier:
                </span>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-xs font-semibold gap-1.5 shadow-xs"
                >
                  <a href="mailto:ops@mezmani.com.np?subject=Data%20Deletion%20Request%20-%20Mezmani">
                    <Mail className="h-3.5 w-3.5 text-primary" />
                    <span>Submit Data Deletion Request</span>
                  </a>
                </Button>
              </div>
            </div>
          </section>

          {/* Section 11: Contact DPO */}
          <section id="contact-dpo" className="scroll-mt-24 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shadow-inner">
                <FileText className="h-4 w-4" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                11. Contact Our Data Protection Officer (DPO)
              </h2>
            </div>

            <Card className="rounded-2xl border-border/80 bg-card p-5 sm:p-6 shadow-sm space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                If you have questions regarding this Privacy Policy, wish to exercise your legal consumer rights, or have security concerns, please contact our appointed Data Protection team:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-1">
                <div className="space-y-1">
                  <p className="font-bold text-foreground flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Registered Office</span>
                  </p>
                  <p className="text-muted-foreground text-[11px]">
                    Mezmani Retail Pvt. Ltd.<br />
                    Traffic Chowk, Ward 6<br />
                    Butwal, Rupandehi, Nepal
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="font-bold text-foreground flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Email Inquiries</span>
                  </p>
                  <p className="text-muted-foreground text-[11px]">
                    <a href="mailto:ops@mezmani.com.np" className="text-primary hover:underline font-mono">
                      ops@mezmani.com.np
                    </a>
                    <br />
                    <span className="text-[10px] text-muted-foreground/80">Mon - Sun (Response within 24h)</span>
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="font-bold text-foreground flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Customer Support</span>
                  </p>
                  <p className="text-muted-foreground text-[11px]">
                    <a href="tel:+9779800000000" className="text-primary hover:underline font-mono">
                      +977-9800000000
                    </a>
                    <br />
                    <span className="text-[10px] text-muted-foreground/80">Support Hotline: 10:00 AM - 12:00 AM</span>
                  </p>
                </div>
              </div>
            </Card>
          </section>
        </main>
      </div>

      <Footer />
    </div>
  )
}
