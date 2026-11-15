import { useState, useMemo, useRef, useEffect } from 'react'
import { useSuspenseQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { cn } from '#/lib/utils'
import { adminQueries, storeQueries } from '#/queries/admin'
import {
  exportSuperAdminDataFn,
  bulkImportSuperAdminDataFn,
  saveAdminPanelNoticeFn,
  toggleAdminPanelNoticeFn,
  deleteAdminPanelNoticeFn,
  saveSuperAdminSupportSettingsFn,
  saveSuperAdminSystemSettingsFn,
  saveSuperAdminWebsiteSettingsFn,
  saveSuperAdminFeatureFlagsFn,
  saveSuperAdminPricingRulesFn,
  exportSuperAdminAuditLogsFn,
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_PRICING_RULES,
  DEFAULT_SYSTEM_SETTINGS,
  DEFAULT_WEEKLY_SCHEDULE,
  calculateSystemStatus,
} from '#/server/superadmin/superadmin.functions'
import type {
  SupportSettings,
  SystemSettings,
  WebsiteSettings,
  FeatureFlagsSettings,
  PricingRulesSettings,
  WeekdayKey,
  DaySchedule,
} from '#/server/superadmin/superadmin.functions'
import {
  updateUserRoleFn,
  updateUserStatusFn,
} from '#/server/catalog/catalog.functions'
import { downloadCsvFile, parseCsvText, generateCsvString } from '#/lib/csv-helper'
import type { ParsedCsvResult } from '#/lib/csv-helper'
import { PageHeader } from '#/components/shared/page-header'
import { DataSection } from '#/components/shared/data-section'
import { KpiCard } from '#/components/shared/kpi-card'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '#/components/ui/card'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '#/components/ui/tabs'
import { Input } from '#/components/ui/input'
import { Textarea } from '#/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '#/components/ui/radio-group'
import { Label } from '#/components/ui/label'
import { Switch } from '#/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import {
  Terminal,
  Power,
  Clock,
  Calendar,
  CalendarDays,
  Sun,
  Users,
  Store,
  Bike,
  Package,
  Layers,
  Wine,
  Tags,
  Award,
  Download,
  Upload,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  HelpCircle,
  FileCheck,
  Sparkles,
  KeyRound,
  Globe,
  Cpu,
  Megaphone,
  CreditCard,
  Building2,
  Trash2,
  Bell,
  Phone,
  Sliders,
  DollarSign,
  Activity,
  Search,
  Shield,
  ShieldAlert,
  UserX,
  UserCheck,
} from 'lucide-react'
import { toast } from 'sonner'

export type SuperAdminTabKey =
  | 'customers'
  | 'items'
  | 'dealers'
  | 'riders'
  | 'categories'
  | 'brands'
  | 'features'
  | 'pricing'
  | 'admin-panel'
  | 'system'
  | 'website'
  | 'users'
  | 'audit'
  | 'console'

export type BulkEntityKey = 'customers' | 'items' | 'dealers' | 'riders' | 'categories' | 'brands'

interface ColumnSpec {
  name: string
  required: boolean
  type: string
  desc: string
  sample: string
}

interface EntityConfig {
  key: BulkEntityKey
  label: string
  singularLabel: string
  description: string
  primaryKeyDesc: string
  icon: any
  columns: ColumnSpec[]
  templateFilename: string
  sampleCsv: string
}

const ENTITY_CONFIGS: Record<BulkEntityKey, EntityConfig> = {
  customers: {
    key: 'customers',
    label: 'Customers Management',
    singularLabel: 'Customer',
    description:
      'Manage user accounts with the customer role. Ideal for migrating retail customer records, web accounts, and phone databases.',
    primaryKeyDesc: 'Upsert matches on email. If missing, creates a new usr_ account.',
    icon: Users,
    columns: [
      { name: 'name', required: true, type: 'string', desc: 'Customer full name', sample: 'Aarav Sharma' },
      { name: 'email', required: true, type: 'email', desc: 'Unique account email', sample: 'aarav.sharma@example.com' },
      { name: 'phone', required: false, type: 'string', desc: '10-digit mobile number', sample: '9841234567' },
      { name: 'isActive', required: false, type: 'boolean', desc: 'Account active flag (true/false)', sample: 'true' },
      { name: 'emailVerified', required: false, type: 'boolean', desc: 'Email verified status', sample: 'true' },
      { name: 'phoneVerified', required: false, type: 'boolean', desc: 'Phone OTP verified status', sample: 'true' },
    ],
    templateFilename: 'customers-bulk-template.csv',
    sampleCsv: `name,email,phone,isActive,emailVerified,phoneVerified
Aarav Sharma,aarav.sharma@example.com,9841234567,true,true,true
Pooja Shrestha,pooja.shrestha@example.com,9801987654,true,true,false
Bikash KC,bikash.kc@example.com,9851122334,true,false,false
Sunita Gurung,sunita.gurung@example.com,9849988776,true,true,true`,
  },
  items: {
    key: 'items',
    label: 'Catalog Items Management',
    singularLabel: 'Catalog Item',
    description:
      'Manage products and variants across Liquor, Grocery, Food, and DDC inventories with SKU tracking and pricing in Nepalese Rupees.',
    primaryKeyDesc: 'Upsert matches on sku. Creates product and category if they do not exist.',
    icon: Wine,
    columns: [
      { name: 'catalogType', required: false, type: 'liquor | grocery', desc: 'Inventory segment (default: liquor)', sample: 'liquor' },
      { name: 'name', required: true, type: 'string', desc: 'Product display name', sample: 'Khukri XXX Rum' },
      { name: 'slug', required: false, type: 'string', desc: 'URL slug (auto-generated if blank)', sample: 'khukri-xxx-rum' },
      { name: 'categorySlug', required: false, type: 'string', desc: 'Category slug (auto-created if missing)', sample: 'rum' },
      { name: 'brandSlug', required: false, type: 'string', desc: 'Brand slug identifier', sample: 'khukri' },
      { name: 'variantName', required: false, type: 'string', desc: 'Variant packaging label', sample: '750ml Bottle' },
      { name: 'volumeMl', required: false, type: 'number', desc: 'Volume in milliliters (for liquor)', sample: '750' },
      { name: 'abv', required: false, type: 'decimal', desc: 'Alcohol by Volume % (e.g. 40.0, 42.8, 5.0)', sample: '40.0' },
      { name: 'sku', required: true, type: 'string', desc: 'Unique inventory SKU code', sample: 'KHU-XXX-750' },
      { name: 'priceNPR', required: true, type: 'decimal', desc: 'Selling price in NPR Rupees', sample: '1650.00' },
      { name: 'mrpNPR', required: false, type: 'decimal', desc: 'Maximum Retail Price in NPR', sample: '1750.00' },
      { name: 'stock', required: false, type: 'integer', desc: 'Current available stock quantity', sample: '45' },
      { name: 'description', required: false, type: 'string', desc: 'Product tasting notes or details', sample: 'Traditional oak aged Nepalese rum' },
      { name: 'isFeatured', required: false, type: 'boolean', desc: 'Highlight on storefront (true/false)', sample: 'true' },
      { name: 'isActive', required: false, type: 'boolean', desc: 'Product active flag (true/false)', sample: 'true' },
    ],
    templateFilename: 'catalog-items-bulk-template.csv',
    sampleCsv: `catalogType,name,slug,categorySlug,brandSlug,variantName,volumeMl,abv,sku,priceNPR,mrpNPR,stock,description,isFeatured,isActive
liquor,Khukri XXX Rum,khukri-xxx-rum,rum,khukri,750ml Bottle,750,42.8,KHU-XXX-750,1650.00,1750.00,45,Traditional Nepalese dark oak-aged rum,true,true
liquor,Khukri XXX Rum,khukri-xxx-rum,rum,khukri,375ml Half,375,42.8,KHU-XXX-375,850.00,900.00,60,Traditional Nepalese dark oak-aged rum,false,true
liquor,Old Durbar Black Chimney,old-durbar-black-chimney,whiskey,old-durbar,750ml Bottle,750,42.8,ODB-BLK-750,3350.00,3500.00,30,Peated blended malt scotch and grain spirit,true,true
grocery,Wai Wai Quick Noodles,wai-wai-quick,instant-noodles,wai-wai,75g Pack,0,,WW-QCK-75G,25.00,30.00,150,Ready-to-eat spiced Nepali instant noodles,false,true
grocery,Red Bull Energy Drink,red-bull-can,energy-drinks,red-bull,250ml Can,250,,RB-CAN-250,180.00,200.00,80,Vitalizes body and mind premium energy drink,true,true`,
  },
  dealers: {
    key: 'dealers',
    label: 'Dealers & Suppliers',
    singularLabel: 'Dealer',
    description:
      'Manage wholesale suppliers, distributors, and liquor merchants ("diller") with credit limits, VAT credentials, and ledger balances.',
    primaryKeyDesc: 'Upsert matches on name or contact phone.',
    icon: Store,
    columns: [
      { name: 'name', required: true, type: 'string', desc: 'Dealer / Firm business name', sample: 'Himalayan Spirits Wholesale' },
      { name: 'contact', required: true, type: 'string', desc: 'Primary contact phone number', sample: '9801234567' },
      { name: 'whatsappNumber', required: false, type: 'string', desc: 'WhatsApp ordering number', sample: '9801234567' },
      { name: 'pan', required: false, type: 'string', desc: 'PAN registration number', sample: '301234567' },
      { name: 'vatNumber', required: false, type: 'string', desc: 'VAT registration number', sample: '100234567' },
      { name: 'providesVatBill', required: false, type: 'boolean', desc: 'Issues official VAT invoice (true/false)', sample: 'true' },
      { name: 'creditLimitNPR', required: false, type: 'decimal', desc: 'Credit line limit in NPR Rupees', sample: '500000.00' },
      { name: 'paymentTermsDays', required: false, type: 'integer', desc: 'Payment window in days', sample: '30' },
      { name: 'openingBalanceNPR', required: false, type: 'decimal', desc: 'Initial ledger balance in NPR', sample: '0.00' },
      { name: 'address', required: false, type: 'string', desc: 'Business street address', sample: 'Tripureshwor Ward 11' },
      { name: 'city', required: false, type: 'string', desc: 'Operating city', sample: 'Kathmandu' },
      { name: 'isActive', required: false, type: 'boolean', desc: 'Supplier status (true/false)', sample: 'true' },
    ],
    templateFilename: 'dealers-bulk-template.csv',
    sampleCsv: `name,contact,whatsappNumber,pan,vatNumber,providesVatBill,creditLimitNPR,paymentTermsDays,openingBalanceNPR,address,city,isActive
Himalayan Beverage Distributors,9801234567,9801234567,301234567,100234567,true,500000.00,30,0.00,Tripureshwor Ward 11,Kathmandu,true
Valley Spirits Wholesale,9851098765,9851098765,302345678,100345678,true,750000.00,45,15000.00,Pulchowk Lalitpur,Patan,true
Bagmati Grocery Suppliers,9841334455,9841334455,303456789,100456789,false,250000.00,15,0.00,New Road,Pokhara,true`,
  },
  riders: {
    key: 'riders',
    label: 'Delivery Riders',
    singularLabel: 'Rider',
    description:
      'Manage delivery fleet personnel, vehicle registration, zone assignments, commission percentages, and base salaries.',
    primaryKeyDesc: 'Upsert matches on email or phone. Automatically links/creates user account with rider role.',
    icon: Bike,
    columns: [
      { name: 'name', required: true, type: 'string', desc: 'Rider full legal name', sample: 'Bikash Thapa' },
      { name: 'email', required: true, type: 'email', desc: 'Rider email address', sample: 'bikash.rider@example.com' },
      { name: 'phone', required: true, type: 'string', desc: 'Rider mobile number', sample: '9812345678' },
      { name: 'vehicle', required: false, type: 'bike | scooter | car', desc: 'Transport vehicle type', sample: 'bike' },
      { name: 'licenseNo', required: false, type: 'string', desc: 'Driving license registration number', sample: '01-02-123456' },
      { name: 'zone', required: false, type: 'string', desc: 'Operating delivery cluster / zone', sample: 'Kathmandu Central' },
      { name: 'commissionRatePercent', required: false, type: 'number', desc: 'Commission rate percentage (e.g. 15)', sample: '15' },
      { name: 'baseSalaryNPR', required: false, type: 'decimal', desc: 'Monthly base salary in NPR', sample: '22000.00' },
      { name: 'status', required: false, type: 'active | offline | busy', desc: 'Current fleet status', sample: 'active' },
      { name: 'verified', required: false, type: 'boolean', desc: 'Document verification flag', sample: 'true' },
      { name: 'available', required: false, type: 'boolean', desc: 'Available for order dispatch', sample: 'true' },
    ],
    templateFilename: 'riders-bulk-template.csv',
    sampleCsv: `name,email,phone,vehicle,licenseNo,zone,commissionRatePercent,baseSalaryNPR,status,verified,available
Bikash Thapa,bikash.rider@example.com,9812345678,bike,01-02-123456,Kathmandu Central,15,22000.00,active,true,true
Santosh Tamang,santosh.rider@example.com,9823456789,scooter,01-05-654321,Lalitpur Ring Road,12,20000.00,active,true,true
Ramesh Adhikari,ramesh.rider@example.com,9834567890,bike,02-01-778899,Bhaktapur East,10,18000.00,active,true,false`,
  },
  categories: {
    key: 'categories',
    label: 'Categories Management',
    singularLabel: 'Category',
    description:
      'Manage taxonomy hierarchy for Liquor and Grocery branches. Used to organize storefront navigation and filtering.',
    primaryKeyDesc: 'Upsert matches on slug.',
    icon: Tags,
    columns: [
      { name: 'catalogType', required: false, type: 'liquor | grocery', desc: 'Branch category (default: liquor)', sample: 'liquor' },
      { name: 'name', required: true, type: 'string', desc: 'Category display title', sample: 'Single Malt Whiskey' },
      { name: 'slug', required: false, type: 'string', desc: 'Unique URL slug (auto-generated if empty)', sample: 'single-malt-whiskey' },
      { name: 'description', required: false, type: 'string', desc: 'Category description', sample: 'Premium oak-matured scotch malts' },
      { name: 'isActive', required: false, type: 'boolean', desc: 'Visibility status (true/false)', sample: 'true' },
    ],
    templateFilename: 'categories-bulk-template.csv',
    sampleCsv: `catalogType,name,slug,description,isActive
liquor,Single Malt Whiskey,single-malt-whiskey,Premium oak-matured scotch and single malts,true
liquor,Dark & Spiced Rum,rum,Traditional domestic and Caribbean dark rums,true
grocery,Instant Noodles & Snacks,instant-noodles,Quick ready meals and crisps,true
grocery,Beverages & Energy Drinks,energy-drinks,Soft drinks fruit juices and functional beverages,true`,
  },
  brands: {
    key: 'brands',
    label: 'Brands Management',
    singularLabel: 'Brand',
    description:
      'Manage manufacturer, distillery, and FMCG brands with country of origin and brand stories.',
    primaryKeyDesc: 'Upsert matches on slug.',
    icon: Award,
    columns: [
      { name: 'catalogType', required: false, type: 'liquor | grocery', desc: 'Brand catalog category', sample: 'liquor' },
      { name: 'name', required: true, type: 'string', desc: 'Brand name', sample: 'Khukri' },
      { name: 'slug', required: false, type: 'string', desc: 'Brand URL slug', sample: 'khukri' },
      { name: 'origin', required: false, type: 'string', desc: 'Country or region of origin', sample: 'Nepal' },
      { name: 'description', required: false, type: 'string', desc: 'Brand background story', sample: 'Nepal Distilleries iconic rum brand established 1959' },
      { name: 'isActive', required: false, type: 'boolean', desc: 'Brand active flag (true/false)', sample: 'true' },
    ],
    templateFilename: 'brands-bulk-template.csv',
    sampleCsv: `catalogType,name,slug,origin,description,isActive
liquor,Khukri,khukri,Nepal,Nepal Distilleries iconic rum brand established 1959,true
liquor,Old Durbar,old-durbar,Nepal,Award winning blended whiskey aged in charred oak,true
grocery,Wai Wai,wai-wai,Nepal,Chaudhary Group international noodle brand,true
grocery,Red Bull,red-bull,Austria,Global premier taurine energy beverage,true`,
  },
}

export function SuperAdminPanel() {
  const queryClient = useQueryClient()
  const routerState = useRouterState()
  const navigate = useNavigate()

  const currentTab =
    ((routerState.location.search as any)?.tab as SuperAdminTabKey) || 'customers'

  const { data: overview, isFetching } = useSuspenseQuery(adminQueries.superAdminOverview())
  const { data: noticesData, refetch: refetchNotices } = useQuery(adminQueries.adminPanelNotices())
  const { data: supportData, refetch: refetchSupport } = useQuery(adminQueries.superAdminSupport())
  const { data: systemData, refetch: refetchSystem } = useQuery(adminQueries.superAdminSystem())
  const { data: websiteData, refetch: refetchWebsite } = useQuery(adminQueries.superAdminWebsite())
  const { data: featureFlagsData, refetch: refetchFeatureFlags } = useQuery(adminQueries.superAdminFeatureFlags())
  const { data: pricingData, refetch: refetchPricing } = useQuery(adminQueries.superAdminPricingRules())
  const { data: usersData, refetch: refetchUsers } = useQuery(adminQueries.users())
  const { data: auditLogsData, refetch: refetchAuditLogs } = useQuery(adminQueries.superAdminAuditLogs(100))
  const { data: telemetryData, refetch: refetchTelemetry } = useQuery(adminQueries.superAdminTelemetry())

  // Navigation tab switcher
  const handleSelectTab = (tab: SuperAdminTabKey) => {
    navigate({
      search: { tab } as any,
    })
    handleClear()
  }

  // Bulk Entity state (for data tabs)
  const isDataEntityTab =
    currentTab === 'customers' ||
    currentTab === 'items' ||
    currentTab === 'dealers' ||
    currentTab === 'riders' ||
    currentTab === 'categories' ||
    currentTab === 'brands'

  const selectedEntity: BulkEntityKey = isDataEntityTab ? (currentTab as BulkEntityKey) : 'customers'
  const currentConfig = ENTITY_CONFIGS[selectedEntity]

  const [importMode, setImportMode] = useState<'upsert' | 'skip'>('upsert')
  const [inputTab, setInputTab] = useState<'upload' | 'paste'>('upload')
  const [pastedCsv, setPastedCsv] = useState('')
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)
  const [parsedData, setParsedData] = useState<ParsedCsvResult | null>(null)

  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importReport, setImportReport] = useState<{
    total: number
    inserted: number
    updated: number
    skipped: number
    errors: string[]
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // -------------------------------------------------------------
  // ADMIN PANEL NOTICES STATE
  // -------------------------------------------------------------
  const [noticeForm, setNoticeForm] = useState<{
    id?: string
    title: string
    message: string
    type: 'warning' | 'info' | 'destructive' | 'success'
    actionLabel: string
    actionUrl: string
    active: boolean
    dismissible: boolean
    targetRoles: string
  }>({
    title: '',
    message: '',
    type: 'warning',
    actionLabel: 'Make Payment',
    actionUrl: '/superadmin?tab=admin-panel',
    active: true,
    dismissible: true,
    targetRoles: 'all',
  })
  const [isSavingNotice, setIsSavingNotice] = useState(false)

  // Quick Preset Notice Handlers
  const handleApplyNoticePreset = (preset: 'payment' | 'support' | 'maintenance') => {
    if (preset === 'payment') {
      setNoticeForm({
        title: 'Payment Required: Monthly Infrastructure & DB Invoice',
        message: 'Dear Administrators, the monthly server hosting, database, and SMS gateway maintenance invoice of NPR 18,500 is due. Please process payment via bank transfer.',
        type: 'warning',
        actionLabel: 'View Payment Info',
        actionUrl: '/superadmin?tab=admin-panel',
        active: true,
        dismissible: false,
        targetRoles: 'all',
      })
      toast.info('Applied "Monthly Payment Reminder" notice template')
    } else if (preset === 'support') {
      setNoticeForm({
        title: 'Developer Support Available',
        message: 'Newline Developer Team hotline is online: Call +977 9801234567 or message via WhatsApp for technical support and bug resolutions.',
        type: 'info',
        actionLabel: 'Contact Support',
        actionUrl: '/superadmin?tab=admin-panel',
        active: true,
        dismissible: true,
        targetRoles: 'all',
      })
      toast.info('Applied "Developer Support" notice template')
    } else {
      setNoticeForm({
        title: 'Scheduled System Maintenance Alert',
        message: 'The central order and database server will undergo performance upgrades on Saturday from 2:00 AM to 3:30 AM. Operations will resume immediately.',
        type: 'destructive',
        actionLabel: 'System Details',
        actionUrl: '/superadmin?tab=system',
        active: true,
        dismissible: true,
        targetRoles: 'all',
      })
      toast.info('Applied "System Maintenance" notice template')
    }
  }

  const handleSaveNotice = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!noticeForm.title.trim() || !noticeForm.message.trim()) {
      toast.error('Notice requires both a title and message')
      return
    }

    try {
      setIsSavingNotice(true)
      const targetRoles =
        noticeForm.targetRoles === 'all'
          ? ['all']
          : [noticeForm.targetRoles]

      await saveAdminPanelNoticeFn({
        data: {
          id: noticeForm.id,
          title: noticeForm.title,
          message: noticeForm.message,
          type: noticeForm.type,
          actionLabel: noticeForm.actionLabel || undefined,
          actionUrl: noticeForm.actionUrl || undefined,
          active: noticeForm.active,
          dismissible: noticeForm.dismissible,
          targetRoles,
        },
      })
      toast.success('Admin broadcast notice published!')
      setNoticeForm({
        title: '',
        message: '',
        type: 'warning',
        actionLabel: 'Make Payment',
        actionUrl: '/superadmin?tab=admin-panel',
        active: true,
        dismissible: true,
        targetRoles: 'all',
      })
      await refetchNotices()
      await queryClient.invalidateQueries({
        queryKey: adminQueries.adminPanelNotices().queryKey,
      })
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save admin notice')
    } finally {
      setIsSavingNotice(false)
    }
  }

  const handleToggleNotice = async (id: string, active: boolean) => {
    try {
      await toggleAdminPanelNoticeFn({ data: { id, active } })
      toast.success(`Notice is now ${active ? 'Active' : 'Paused'}`)
      await refetchNotices()
      await queryClient.invalidateQueries({
        queryKey: adminQueries.adminPanelNotices().queryKey,
      })
    } catch (err: any) {
      toast.error(err?.message || 'Failed to toggle notice')
    }
  }

  const handleDeleteNotice = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this broadcast notice?')) return
    try {
      await deleteAdminPanelNoticeFn({ data: { id } })
      toast.success('Notice removed')
      await refetchNotices()
      await queryClient.invalidateQueries({
        queryKey: adminQueries.adminPanelNotices().queryKey,
      })
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete notice')
    }
  }

  // -------------------------------------------------------------
  // SUPPORT & PAYMENT CREDENTIALS STATE
  // -------------------------------------------------------------
  const [supportForm, setSupportForm] = useState<SupportSettings>({
    developerTeamName: 'Newline Developer Team',
    contactPhone: '+977 9801234567',
    supportEmail: 'admin@newline.com',
    whatsappNumber: '+977 9801234567',
    officeHours: '24/7 Priority Emergency Support',
    paymentDetails: {
      bankName: 'Nabil Bank Limited',
      accountName: 'Newline Technology Pvt. Ltd.',
      accountNumber: '01201017500123',
      branch: 'Kathmandu Main Branch',
      paymentInstructions: 'Please include Store Identifier (Mezmani) in deposit remarks and email proof to admin@newline.com.',
    },
  })
  const [isSavingSupport, setIsSavingSupport] = useState(false)

  useEffect(() => {
    if (supportData) {
      setSupportForm(supportData)
    }
  }, [supportData])

  const handleSaveSupport = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setIsSavingSupport(true)
      await saveSuperAdminSupportSettingsFn({ data: supportForm })
      toast.success('Developer support details and bank payment information updated!')
      await refetchSupport()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update support settings')
    } finally {
      setIsSavingSupport(false)
    }
  }

    // -------------------------------------------------------------
  // SYSTEM MANAGEMENT & OPERATING HOURS STATE
  // -------------------------------------------------------------
  const [systemForm, setSystemForm] = useState<SystemSettings>(DEFAULT_SYSTEM_SETTINGS)
  const [isSavingSystem, setIsSavingSystem] = useState(false)

  useEffect(() => {
    if (systemData) {
      setSystemForm({
        ...DEFAULT_SYSTEM_SETTINGS,
        ...systemData,
        weeklySchedule: {
          ...DEFAULT_WEEKLY_SCHEDULE,
          ...(systemData.weeklySchedule || {}),
        },
      })
    }
  }, [systemData])

  const systemEvaluation = useMemo(() => {
    try {
      return calculateSystemStatus(systemForm)
    } catch {
      return null
    }
  }, [systemForm])

  const handleSaveSystem = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setIsSavingSystem(true)
      await saveSuperAdminSystemSettingsFn({ data: systemForm })
      toast.success('System operational flags and operating schedule updated!')
      await Promise.all([
        refetchSystem(),
        queryClient.invalidateQueries(storeQueries.operatingStatus()),
        queryClient.invalidateQueries(adminQueries.superAdminSystem()),
      ])
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update system flags')
    } finally {
      setIsSavingSystem(false)
    }
  }

  const applyPreset247 = () => {
    const updated: Record<WeekdayKey, DaySchedule> = { ...DEFAULT_WEEKLY_SCHEDULE }
    const keys: WeekdayKey[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    keys.forEach((k) => {
      updated[k] = { isOpen: true, openTime: '00:00', closeTime: '23:59' }
    })
    setSystemForm((p) => ({
      ...p,
      scheduleEnabled: true,
      weekendOff: false,
      weeklySchedule: updated,
    }))
    toast.info('Applied preset: 24/7 Always Open')
  }

  const applyPresetStandard = () => {
    const updated: Record<WeekdayKey, DaySchedule> = { ...DEFAULT_WEEKLY_SCHEDULE }
    const keys: WeekdayKey[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    keys.forEach((k) => {
      updated[k] = {
        isOpen: k !== 'saturday',
        openTime: '10:00',
        closeTime: '23:00',
      }
    })
    setSystemForm((p) => ({
      ...p,
      scheduleEnabled: true,
      weekendOff: true,
      weekendDays: ['saturday'],
      weeklySchedule: updated,
    }))
    toast.info('Applied preset: Standard 10:00–23:00 (Nepal Saturday Off)')
  }

  const applyPresetEveryday = () => {
    const updated: Record<WeekdayKey, DaySchedule> = { ...DEFAULT_WEEKLY_SCHEDULE }
    const keys: WeekdayKey[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    keys.forEach((k) => {
      updated[k] = {
        isOpen: true,
        openTime: '10:00',
        closeTime: '23:00',
      }
    })
    setSystemForm((p) => ({
      ...p,
      scheduleEnabled: true,
      weekendOff: false,
      weeklySchedule: updated,
    }))
    toast.info('Applied preset: Everyday 10:00–23:00 (7 Days Open)')
  }

  const handleDayToggle = (dayKey: WeekdayKey, isOpen: boolean) => {
    setSystemForm((p) => ({
      ...p,
      weeklySchedule: {
        ...p.weeklySchedule,
        [dayKey]: {
          ...(p.weeklySchedule[dayKey] || { openTime: '10:00', closeTime: '23:00' }),
          isOpen,
        },
      },
    }))
  }

  const handleDayTimeChange = (
    dayKey: WeekdayKey,
    field: 'openTime' | 'closeTime',
    val: string,
  ) => {
    setSystemForm((p) => ({
      ...p,
      weeklySchedule: {
        ...p.weeklySchedule,
        [dayKey]: {
          ...(p.weeklySchedule[dayKey] || { isOpen: true, openTime: '10:00', closeTime: '23:00' }),
          [field]: val,
        },
      },
    }))
  }

  // -------------------------------------------------------------
  // WEBSITE MANAGEMENT STATE
  // -------------------------------------------------------------
  const [websiteForm, setWebsiteForm] = useState<WebsiteSettings>({
    storefrontNotice: 'Welcome to Mezmani! Order premier beverages and groceries directly to your doorstep.',
    storefrontNoticeActive: true,
    supportPhone: '+977 9801234567',
    supportEmail: 'support@mezmani.com',
    operatingHours: '10:00 AM - 11:00 PM (Everyday)',
    deliveryPromiseText: 'Guaranteed rapid 45-minute delivery across coverage zones.',
  })
  const [isSavingWebsite, setIsSavingWebsite] = useState(false)

  useEffect(() => {
    if (websiteData) {
      setWebsiteForm(websiteData)
    }
  }, [websiteData])

  const handleSaveWebsite = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setIsSavingWebsite(true)
      await saveSuperAdminWebsiteSettingsFn({ data: websiteForm })
      toast.success('Website storefront announcements and public contacts updated!')
      await refetchWebsite()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update website settings')
    } finally {
      setIsSavingWebsite(false)
    }
  }

  // -------------------------------------------------------------
  // FEATURE FLAGS STATE & HANDLERS
  // -------------------------------------------------------------
  const [featureFlagsForm, setFeatureFlagsForm] = useState<FeatureFlagsSettings>(DEFAULT_FEATURE_FLAGS)
  const [isSavingFlags, setIsSavingFlags] = useState(false)

  useEffect(() => {
    if (featureFlagsData) {
      setFeatureFlagsForm(featureFlagsData)
    }
  }, [featureFlagsData])

  const handleSaveFeatureFlags = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingFlags(true)
    try {
      await saveSuperAdminFeatureFlagsFn({ data: featureFlagsForm })
      await queryClient.invalidateQueries({ queryKey: adminQueries.superAdminFeatureFlags().queryKey })
      toast.success('Runtime Feature Flags saved dynamically')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save feature flags')
    } finally {
      setIsSavingFlags(false)
    }
  }

  // -------------------------------------------------------------
  // PRICING RULES STATE & HANDLERS
  // -------------------------------------------------------------
  const [pricingForm, setPricingForm] = useState<PricingRulesSettings>(DEFAULT_PRICING_RULES)
  const [isSavingPricing, setIsSavingPricing] = useState(false)

  useEffect(() => {
    if (pricingData) {
      setPricingForm(pricingData)
    }
  }, [pricingData])

  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingPricing(true)
    try {
      await saveSuperAdminPricingRulesFn({ data: pricingForm })
      await queryClient.invalidateQueries({ queryKey: adminQueries.superAdminPricingRules().queryKey })
      toast.success('Dynamic Pricing & Delivery Rules saved')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save pricing rules')
    } finally {
      setIsSavingPricing(false)
    }
  }

  // -------------------------------------------------------------
  // USERS & ROLE ENGINE STATE & HANDLERS
  // -------------------------------------------------------------
  const [userSearch, setUserSearch] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState('all')
  const [banDialogOpen, setBanDialogOpen] = useState(false)
  const [targetUser, setTargetUser] = useState<any>(null)
  const [banReasonInput, setBanReasonInput] = useState('')
  const [isUpdatingUser, setIsUpdatingUser] = useState(false)

  const filteredUsers = useMemo(() => {
    if (!usersData) return []
    return usersData.filter((u) => {
      const matchRole = userRoleFilter === 'all' || u.role === userRoleFilter
      const query = userSearch.toLowerCase().trim()
      const matchSearch =
        !query ||
        u.name?.toLowerCase().includes(query) ||
        u.email?.toLowerCase().includes(query) ||
        u.phone?.toLowerCase().includes(query)
      return matchRole && matchSearch
    })
  }, [usersData, userSearch, userRoleFilter])

  const handleExportUsers = () => {
    if (!usersData || usersData.length === 0) {
      toast.error('No users available to export')
      return
    }
    const csv = generateCsvString(
      [
        { header: 'id', key: 'id' },
        { header: 'name', key: 'name' },
        { header: 'email', key: 'email' },
        { header: 'phone', key: 'phone' },
        { header: 'role', key: 'role' },
        { header: 'isActive', key: 'isActive' },
        { header: 'banned', key: 'banned' },
        { header: 'banReason', key: 'banReason' },
      ],
      usersData,
    )
    downloadCsvFile(`users-export-${new Date().toISOString().split('T')[0]}.csv`, csv)
    toast.success(`Exported ${usersData.length} user records`)
  }

  const handleChangeUserRole = async (userId: string, newRole: string) => {
    setIsUpdatingUser(true)
    try {
      await updateUserRoleFn({ data: { userId, role: newRole } })
      await queryClient.invalidateQueries({ queryKey: adminQueries.users().queryKey })
      toast.success(`User role updated to ${newRole}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update user role')
    } finally {
      setIsUpdatingUser(false)
    }
  }

  const handleToggleUserActive = async (userId: string, currentActive: boolean) => {
    setIsUpdatingUser(true)
    try {
      await updateUserStatusFn({ data: { userId, isActive: !currentActive } })
      await queryClient.invalidateQueries({ queryKey: adminQueries.users().queryKey })
      toast.success(`User status changed to ${!currentActive ? 'active' : 'inactive'}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update user status')
    } finally {
      setIsUpdatingUser(false)
    }
  }

  const handleOpenBanDialog = (u: any) => {
    setTargetUser(u)
    setBanReasonInput(u.banReason || 'Terms of service violation / Fraud prevention')
    setBanDialogOpen(true)
  }

  const handleConfirmBan = async () => {
    if (!targetUser) return
    setIsUpdatingUser(true)
    try {
      await updateUserStatusFn({
        data: {
          userId: targetUser.id,
          banned: true,
          banReason: banReasonInput,
        },
      })
      await queryClient.invalidateQueries({ queryKey: adminQueries.users().queryKey })
      toast.success(`User ${targetUser.name || targetUser.email} has been suspended`)
      setBanDialogOpen(false)
      setTargetUser(null)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to suspend user')
    } finally {
      setIsUpdatingUser(false)
    }
  }

  const handleLiftBan = async (u: any) => {
    setIsUpdatingUser(true)
    try {
      await updateUserStatusFn({
        data: {
          userId: u.id,
          banned: false,
          banReason: null,
        },
      })
      await queryClient.invalidateQueries({ queryKey: adminQueries.users().queryKey })
      toast.success(`Suspension lifted for ${u.name || u.email}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to lift suspension')
    } finally {
      setIsUpdatingUser(false)
    }
  }

  // -------------------------------------------------------------
  // AUDIT LOGS STATE & HANDLERS
  // -------------------------------------------------------------
  const [auditModuleFilter, setAuditModuleFilter] = useState('all')
  const [auditSearch, setAuditSearch] = useState('')
  const [isExportingAudit, setIsExportingAudit] = useState(false)

  const filteredAuditLogs = useMemo(() => {
    if (!auditLogsData) return []
    return auditLogsData.filter((log) => {
      const matchModule = auditModuleFilter === 'all' || log.module === auditModuleFilter
      const query = auditSearch.toLowerCase().trim()
      const matchSearch =
        !query ||
        log.actor.toLowerCase().includes(query) ||
        log.action.toLowerCase().includes(query) ||
        log.detail.toLowerCase().includes(query)
      return matchModule && matchSearch
    })
  }, [auditLogsData, auditModuleFilter, auditSearch])

  const handleExportAuditLogs = async () => {
    setIsExportingAudit(true)
    try {
      const res = await exportSuperAdminAuditLogsFn()
      downloadCsvFile(res.filename, res.csv)
      toast.success(`Exported ${res.count} audit log records`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to export audit logs')
    } finally {
      setIsExportingAudit(false)
    }
  }

  // -------------------------------------------------------------
  // BULK IMPORT & EXPORT HANDLERS
  // -------------------------------------------------------------
  const handleDownloadTemplate = () => {
    downloadCsvFile(currentConfig.templateFilename, currentConfig.sampleCsv)
    toast.success(`Downloaded ${currentConfig.label} template CSV`, {
      description: `Filename: ${currentConfig.templateFilename}`,
    })
  }

  const handleExportData = async () => {
    try {
      setIsExporting(true)
      const res = await exportSuperAdminDataFn({
        data: { entity: selectedEntity },
      })
      downloadCsvFile(res.filename, res.csv)
      toast.success(`Exported ${res.count} ${currentConfig.label}`, {
        description: `Saved as ${res.filename} with UTF-8 BOM`,
      })
    } catch (err: any) {
      toast.error(err?.message || 'Failed to export live data')
    } finally {
      setIsExporting(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSelectedFileName(file.name)
    setImportReport(null)

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      if (!text) {
        toast.error('The selected file appears to be empty')
        return
      }
      const result = parseCsvText(text)
      setParsedData(result)
      if (result.errors.length > 0) {
        toast.warning(`Parsed with warnings: ${result.errors[0]}`)
      } else {
        toast.success(`Parsed ${result.rows.length} rows successfully`)
      }
    }
    reader.onerror = () => {
      toast.error('Failed to read CSV file')
    }
    reader.readAsText(file)
  }

  const handleParsePastedText = () => {
    if (!pastedCsv.trim()) {
      toast.error('Please paste CSV text to preview')
      return
    }
    setImportReport(null)
    const result = parseCsvText(pastedCsv)
    setParsedData(result)
    setSelectedFileName('Pasted CSV text')
    if (result.errors.length > 0) {
      toast.warning(`Parsed with warnings: ${result.errors[0]}`)
    } else {
      toast.success(`Parsed ${result.rows.length} rows successfully`)
    }
  }

  const handleClear = () => {
    setParsedData(null)
    setPastedCsv('')
    setSelectedFileName(null)
    setImportReport(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleExecuteImport = async () => {
    if (!parsedData || parsedData.rows.length === 0) {
      toast.error('No rows ready to import')
      return
    }

    try {
      setIsImporting(true)
      const res = await bulkImportSuperAdminDataFn({
        data: {
          entity: selectedEntity,
          mode: importMode,
          rows: parsedData.rows,
        },
      })

      setImportReport(res)
      await queryClient.invalidateQueries({
        queryKey: adminQueries.superAdminOverview().queryKey,
      })

      if (res.errors.length > 0) {
        toast.warning(
          `Import finished with notices: ${res.inserted} inserted, ${res.updated} updated, ${res.errors.length} errors`,
        )
      } else {
        toast.success(
          `Import complete! ${res.inserted} inserted, ${res.updated} updated, ${res.skipped} skipped.`,
        )
      }
    } catch (err: any) {
      toast.error(err?.message || 'Bulk import failed')
    } finally {
      setIsImporting(false)
    }
  }

  // Pre-validate parsed rows for missing required columns
  const validationSummary = useMemo(() => {
    if (!parsedData || parsedData.rows.length === 0) return null

    const requiredCols = currentConfig.columns.filter((c) => c.required).map((c) => c.name)
    const headers = parsedData.headers.map((h) => h.toLowerCase())

    const missingRequiredHeaders = requiredCols.filter(
      (req) => !headers.includes(req.toLowerCase()),
    )

    let rowsWithMissingFields = 0
    parsedData.rows.forEach((r) => {
      const isMissing = requiredCols.some((reqCol) => {
        const val = r[reqCol] || r[reqCol.toLowerCase()]
        return !val || val.trim() === ''
      })
      if (isMissing) rowsWithMissingFields++
    })

    return {
      totalRows: parsedData.rows.length,
      missingRequiredHeaders,
      rowsWithMissingFields,
      isValid: missingRequiredHeaders.length === 0 && rowsWithMissingFields === 0,
    }
  }, [parsedData, currentConfig])

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <PageHeader
        kicker="Developer Operations"
        title="Super Admin Panel"
        description="Root developer console: granular entity bulk mobility, live notices broadcast, dynamic payment & support governance."
        count="Developer Root Active"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-9 gap-1.5 text-xs"
              onClick={() => handleSelectTab('users')}
            >
              <Users className="h-4 w-4" />
              <span>User & Role Engine</span>
            </Button>
            <Button asChild size="sm" variant="outline" className="h-9 gap-1.5 text-xs">
              <Link to="/admin/staff">
                <KeyRound className="h-4 w-4" />
                <span>RBAC Staff Matrix</span>
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 gap-1.5 text-xs"
              onClick={() => {
                queryClient.invalidateQueries({
                  queryKey: adminQueries.superAdminOverview().queryKey,
                })
                refetchNotices()
                refetchSupport()
                refetchSystem()
                refetchWebsite()
                refetchFeatureFlags()
                refetchPricing()
                refetchUsers()
                refetchAuditLogs()
                refetchTelemetry()
                toast.success('Refreshed superadmin statistics and configurations')
              }}
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              <span>Refresh All</span>
            </Button>
          </div>
        }
      />

      {/* Developer Root Status Alert */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl border border-primary/25 bg-primary/5 text-foreground">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
            <Terminal className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-sm">Root Developer Access</span>
              <Badge variant="default" className="text-[11px] px-2 py-0.5">
                admin@newline.com
              </Badge>
              <Badge variant="outline" className="text-[11px] px-2 py-0.5 border-primary/40 text-primary font-mono">
                Full DB & Broadcast Authority
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Super Admin bypasses all checks, controls customer/catalog/fleet bulk data, and can broadcast dynamic payment & support alerts across the admin console.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs px-3 py-1 font-mono shrink-0">
            Active Tab: {currentTab}
          </Badge>
        </div>
      </div>

      {/* Live System Overview KPIs */}
      <DataSection isRefreshing={isFetching}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KpiCard
            label="Total Customers"
            value={overview?.totalCustomers ?? 0}
            note="Active retail accounts"
            icon={Users}
            tone="default"
          />
          <KpiCard
            label="Total Dealers"
            value={overview?.totalDealers ?? 0}
            note="Vendors & wholesale"
            icon={Store}
            tone="default"
          />
          <KpiCard
            label="Delivery Fleet"
            value={overview?.totalRiders ?? 0}
            note="Couriers & riders"
            icon={Bike}
            tone="default"
          />
          <KpiCard
            label="Catalog Products"
            value={overview?.totalProducts ?? 0}
            note="Liquor & Grocery"
            icon={Package}
            tone="default"
          />
          <KpiCard
            label="Variant SKUs"
            value={overview?.totalVariants ?? 0}
            note="Active price points"
            icon={Layers}
            tone="default"
          />
        </div>
      </DataSection>

      {/* ============================================================== */}
      {/* 1-6: BULK DATA & ENTITY MANAGEMENT TABS */}
      {/* ============================================================== */}
      {isDataEntityTab && (
        <Card className="rounded-xl border border-border bg-card shadow-xs">
          <CardHeader className="border-b border-border/60 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                    <currentConfig.icon className="h-5 w-5 text-primary" />
                    <span>{currentConfig.label}</span>
                  </CardTitle>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {selectedEntity}
                  </Badge>
                </div>
                <CardDescription className="text-xs text-muted-foreground max-w-2xl">
                  {currentConfig.description}
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTemplate}
                  className="h-9 gap-2 text-xs font-medium"
                >
                  <Download className="h-4 w-4 text-primary" />
                  <span>Download Sample Template</span>
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleExportData}
                  disabled={isExporting}
                  className="h-9 gap-2 text-xs font-medium"
                >
                  {isExporting ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4" />
                  )}
                  <span>Export Live Data (CSV)</span>
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-6 space-y-6">
            {/* Column Specification Guide */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  <span>Column Schema & Field Requirements</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {currentConfig.primaryKeyDesc}
                </p>
              </div>

              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="text-xs font-bold py-2 w-[160px]">Column Header</TableHead>
                      <TableHead className="text-xs font-bold py-2 w-[100px]">Requirement</TableHead>
                      <TableHead className="text-xs font-bold py-2 w-[110px]">Type</TableHead>
                      <TableHead className="text-xs font-bold py-2">Description</TableHead>
                      <TableHead className="text-xs font-bold py-2 w-[220px]">Sample Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentConfig.columns.map((col) => (
                      <TableRow key={col.name} className="hover:bg-muted/20">
                        <TableCell className="font-mono text-xs font-bold text-foreground py-2">
                          {col.name}
                        </TableCell>
                        <TableCell className="py-2">
                          {col.required ? (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 font-semibold">
                              Required
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                              Optional
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-[11px] text-muted-foreground py-2">
                          {col.type}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground py-2">
                          {col.desc}
                        </TableCell>
                        <TableCell className="font-mono text-[11px] text-foreground/80 py-2 truncate max-w-[220px]">
                          {col.sample}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Import Configuration & Dropzone */}
            <div className="space-y-4 pt-2 border-t border-border/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
                    <Upload className="h-4 w-4 text-primary" />
                    <span>Bulk Import Data</span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Upload a formatted CSV file or paste raw CSV text directly from your spreadsheet.
                  </p>
                </div>

                {/* Conflict Mode Selection */}
                <div className="flex items-center gap-3 bg-muted/40 p-2 rounded-lg border border-border">
                  <span className="text-xs font-medium text-foreground">Conflict Policy:</span>
                  <RadioGroup
                    value={importMode}
                    onValueChange={(val: any) => setImportMode(val)}
                    className="flex items-center gap-3 text-xs"
                  >
                    <div className="flex items-center space-x-1.5">
                      <RadioGroupItem value="upsert" id="mode-upsert" />
                      <Label htmlFor="mode-upsert" className="text-xs font-medium cursor-pointer">
                        Upsert (Insert & Update)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <RadioGroupItem value="skip" id="mode-skip" />
                      <Label htmlFor="mode-skip" className="text-xs font-medium cursor-pointer">
                        Skip Duplicates
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              <Tabs value={inputTab} onValueChange={(val: any) => setInputTab(val)} className="w-full">
                <TabsList className="grid grid-cols-2 max-w-xs h-9">
                  <TabsTrigger value="upload" className="text-xs gap-1.5">
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    <span>Upload .CSV File</span>
                  </TabsTrigger>
                  <TabsTrigger value="paste" className="text-xs gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    <span>Paste Raw CSV</span>
                  </TabsTrigger>
                </TabsList>

                {/* Tab 1: File Dropzone */}
                <TabsContent value="upload" className="mt-3">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="cursor-pointer border-2 border-dashed border-border hover:border-primary/60 rounded-xl p-8 text-center transition-colors bg-muted/10 hover:bg-muted/20"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="h-12 w-12 rounded-full bg-primary/10 text-primary grid place-items-center">
                        <FileSpreadsheet className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {selectedFileName ? selectedFileName : 'Click to browse or drop your CSV file here'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Supports UTF-8 CSV exports with multi-line fields and Excel quotes
                        </p>
                      </div>
                      {selectedFileName && (
                        <Badge variant="outline" className="mt-2 text-xs font-mono">
                          {selectedFileName}
                        </Badge>
                      )}
                    </div>
                  </div>
                </TabsContent>

                {/* Tab 2: Raw Paste */}
                <TabsContent value="paste" className="mt-3 space-y-3">
                  <Textarea
                    rows={6}
                    placeholder={`Paste your CSV lines here, e.g.:\n${currentConfig.sampleCsv}`}
                    value={pastedCsv}
                    onChange={(e) => setPastedCsv(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPastedCsv('')}
                      disabled={!pastedCsv}
                      className="text-xs h-8"
                    >
                      Clear Text
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleParsePastedText}
                      disabled={!pastedCsv.trim()}
                      className="text-xs h-8 gap-1.5"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Parse & Preview CSV</span>
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Validation & Preview Section */}
            {parsedData && (
              <div className="space-y-4 pt-4 border-t border-border/60">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 grid place-items-center">
                      <FileCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">
                        Parsed Data Diagnostics
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Found <span className="font-semibold text-foreground">{parsedData.rows.length}</span> data rows and <span className="font-semibold text-foreground">{parsedData.headers.length}</span> columns.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClear}
                      className="h-8 text-xs"
                    >
                      Discard
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleExecuteImport}
                      disabled={isImporting || parsedData.rows.length === 0}
                      className="h-8 text-xs gap-1.5 bg-primary font-semibold"
                    >
                      {isImporting ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      <span>
                        {isImporting
                          ? 'Executing Import...'
                          : `Import ${parsedData.rows.length} ${currentConfig.label}`}
                      </span>
                    </Button>
                  </div>
                </div>

                {/* Validation Summary Warning */}
                {validationSummary && !validationSummary.isValid && (
                  <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-foreground flex items-start gap-2.5 text-xs">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-semibold">Validation Notice</p>
                      {validationSummary.missingRequiredHeaders.length > 0 && (
                        <p>
                          Missing required column headers:{' '}
                          <span className="font-mono font-bold text-amber-700 dark:text-amber-300">
                            {validationSummary.missingRequiredHeaders.join(', ')}
                          </span>
                        </p>
                      )}
                      {validationSummary.rowsWithMissingFields > 0 && (
                        <p>
                          {validationSummary.rowsWithMissingFields} row(s) contain empty values for mandatory columns. Missing records will be skipped during server execution.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Data Preview Table */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Showing preview of first {Math.min(parsedData.rows.length, 8)} rows:</span>
                    <span className="font-mono text-[11px]">Total: {parsedData.rows.length} records</span>
                  </div>
                  <div className="rounded-lg border border-border overflow-x-auto max-h-[300px]">
                    <Table>
                      <TableHeader className="bg-muted/40 sticky top-0">
                        <TableRow>
                          <TableHead className="text-xs font-bold py-2 w-12 text-center">#</TableHead>
                          {parsedData.headers.map((h) => (
                            <TableHead key={h} className="text-xs font-bold py-2 font-mono whitespace-nowrap">
                              {h}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedData.rows.slice(0, 8).map((row, idx) => (
                          <TableRow key={idx} className="hover:bg-muted/20">
                            <TableCell className="text-xs text-muted-foreground text-center py-2 font-mono">
                              {idx + 1}
                            </TableCell>
                            {parsedData.headers.map((h) => (
                              <TableCell key={h} className="text-xs py-2 font-mono max-w-[200px] truncate">
                                {row[h] || <span className="text-muted-foreground italic">—</span>}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}

            {/* Execution Report Card */}
            {importReport && (
              <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-3 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    <h4 className="text-sm font-bold text-foreground">
                      Import Execution Summary
                    </h4>
                  </div>
                  <Badge variant="outline" className="text-xs font-mono">
                    Mode: {importMode.toUpperCase()}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-3 rounded-lg border border-border bg-muted/20">
                    <p className="text-muted-foreground font-medium">Inserted</p>
                    <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {importReport.inserted}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-muted/20">
                    <p className="text-muted-foreground font-medium">Updated</p>
                    <p className="text-xl font-bold text-primary tabular-nums">
                      {importReport.updated}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-muted/20">
                    <p className="text-muted-foreground font-medium">Skipped</p>
                    <p className="text-xl font-bold text-muted-foreground tabular-nums">
                      {importReport.skipped}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-muted/20">
                    <p className="text-muted-foreground font-medium">Errors</p>
                    <p className={`text-xl font-bold tabular-nums ${importReport.errors.length > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {importReport.errors.length}
                    </p>
                  </div>
                </div>

                {/* Detailed Error List if any */}
                {importReport.errors.length > 0 && (
                  <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                      <XCircle className="h-4 w-4" />
                      <span>Row Validation Diagnostics ({importReport.errors.length})</span>
                    </div>
                    <ul className="text-xs text-muted-foreground space-y-1 max-h-40 overflow-y-auto pl-5 list-disc">
                      {importReport.errors.map((err, i) => (
                        <li key={i} className="font-mono text-[11px]">
                          {err}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ============================================================== */}
      {/* 7: WEBSITE MANAGEMENT TAB */}
      {/* ============================================================== */}
      {currentTab === 'website' && (
        <div className="space-y-6">
          <Card className="rounded-xl border border-border bg-card shadow-xs">
            <CardHeader className="border-b border-border/60 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Globe className="h-5 w-5 text-primary" />
                    <span>Website & Storefront Management</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Control public announcement banners, customer support contact channels, operating hours, and delivery promises displayed on the storefront.
                  </CardDescription>
                </div>
                <Button asChild size="sm" variant="outline" className="h-8 text-xs gap-1.5">
                  <Link to="/admin/banners">
                    <Megaphone className="h-3.5 w-3.5" />
                    <span>Banner Manager</span>
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <form onSubmit={handleSaveWebsite} className="space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs font-semibold text-foreground">
                        Storefront Announcement Bar
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Shown at the top of the customer-facing storefront on mobile and desktop.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">Active</span>
                      <Switch
                        checked={websiteForm.storefrontNoticeActive}
                        onCheckedChange={(checked) =>
                          setWebsiteForm((p) => ({ ...p, storefrontNoticeActive: checked }))
                        }
                      />
                    </div>
                  </div>
                  <Textarea
                    rows={2}
                    value={websiteForm.storefrontNotice}
                    onChange={(e) =>
                      setWebsiteForm((p) => ({ ...p, storefrontNotice: e.target.value }))
                    }
                    placeholder="Enter announcement text for customers..."
                    className="text-xs font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/60">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Storefront Support Phone</Label>
                    <Input
                      value={websiteForm.supportPhone}
                      onChange={(e) =>
                        setWebsiteForm((p) => ({ ...p, supportPhone: e.target.value }))
                      }
                      className="text-xs h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Storefront Support Email</Label>
                    <Input
                      value={websiteForm.supportEmail}
                      onChange={(e) =>
                        setWebsiteForm((p) => ({ ...p, supportEmail: e.target.value }))
                      }
                      className="text-xs h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Operating Hours</Label>
                    <Input
                      value={websiteForm.operatingHours}
                      onChange={(e) =>
                        setWebsiteForm((p) => ({ ...p, operatingHours: e.target.value }))
                      }
                      className="text-xs h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Delivery Promise Label</Label>
                    <Input
                      value={websiteForm.deliveryPromiseText}
                      onChange={(e) =>
                        setWebsiteForm((p) => ({ ...p, deliveryPromiseText: e.target.value }))
                      }
                      className="text-xs h-9"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-3 border-t border-border/60">
                  <Button
                    type="submit"
                    disabled={isSavingWebsite}
                    size="sm"
                    className="h-9 text-xs gap-1.5 bg-primary font-semibold"
                  >
                    {isSavingWebsite ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    <span>Save Website Settings</span>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ============================================================== */}
      {/* 8: SYSTEM MANAGEMENT & DYNAMIC OPERATING SCHEDULE TAB */}
      {/* ============================================================== */}
      {currentTab === 'system' && (
        <form onSubmit={handleSaveSystem} className="space-y-6">
          {/* Card 1: Master Store Activation Switch */}
          <Card
            className={cn(
              'rounded-xl border shadow-sm transition-colors',
              systemForm.systemActive
                ? 'border-emerald-500/40 bg-emerald-500/5'
                : 'border-destructive/40 bg-destructive/5',
            )}
          >
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'p-2.5 rounded-xl border',
                      systemForm.systemActive
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                        : 'bg-destructive/20 text-destructive border-destructive/30',
                    )}
                  >
                    <Power className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-lg font-bold text-foreground">
                        Master Storefront Activation
                      </CardTitle>
                      <Badge
                        variant={systemForm.systemActive ? 'default' : 'destructive'}
                        className={cn(
                          'text-xs font-mono font-bold tracking-wide uppercase px-2 py-0.5',
                          systemForm.systemActive && 'bg-emerald-600 hover:bg-emerald-700 text-white',
                        )}
                      >
                        {systemForm.systemActive ? '● System Online' : '■ System Deactivated'}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Main power kill-switch. When deactivated, the storefront immediate ordering engine is suspended.
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  <span className="text-xs font-semibold text-muted-foreground font-mono">
                    {systemForm.systemActive ? 'ACTIVE / OPEN' : 'INACTIVE / OFF'}
                  </span>
                  <Switch
                    checked={systemForm.systemActive}
                    onCheckedChange={(checked) =>
                      setSystemForm((p) => ({ ...p, systemActive: checked }))
                    }
                    className="data-[state=checked]:bg-emerald-600"
                  />
                </div>
              </div>
            </CardHeader>

            {!systemForm.systemActive && (
              <CardContent className="pt-0 pb-4">
                <div className="rounded-lg border border-destructive/30 bg-background/80 p-3.5 space-y-2">
                  <Label htmlFor="deactivationReason" className="text-xs font-bold text-destructive flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Deactivation Reason / Broadcast Explanation (shown to customers)
                  </Label>
                  <Input
                    id="deactivationReason"
                    value={systemForm.deactivationReason}
                    onChange={(e) =>
                      setSystemForm((p) => ({ ...p, deactivationReason: e.target.value }))
                    }
                    className="text-xs h-9"
                    placeholder="e.g., Mezmani is temporarily closed for warehouse inventory stock-taking. Ordering will resume shortly."
                  />
                </div>
              </CardContent>
            )}
          </Card>

          {/* Card 2: Live Real-time Status Evaluation */}
          {systemEvaluation && (
            <Card className="rounded-xl border border-border bg-card shadow-xs">
              <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm font-bold text-foreground">
                      Live Operational Evaluation (Asia/Kathmandu UTC+5:45)
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                    <span>Local Time:</span>
                    <Badge variant="outline" className="font-mono text-xs font-bold">
                      {systemEvaluation.currentDayKey.toUpperCase()} {systemEvaluation.currentTimeStr}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1">
                  <span className="text-muted-foreground font-medium block">Current Store State</span>
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant={systemEvaluation.isOpen ? 'default' : 'secondary'}
                      className={cn(
                        'text-xs font-bold',
                        systemEvaluation.isOpen
                          ? 'bg-emerald-600 text-white'
                          : 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30',
                      )}
                    >
                      {systemEvaluation.isOpen ? 'OPEN NOW' : 'CLOSED NOW'}
                    </Badge>
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1">
                  <span className="text-muted-foreground font-medium block">Next Reopening Window</span>
                  <p className="font-semibold text-foreground font-mono">
                    {systemEvaluation.isOpen
                      ? 'Currently Operating'
                      : systemEvaluation.nextOpeningFormatted || 'Awaiting Admin Activation'}
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1">
                  <span className="text-muted-foreground font-medium block">Offline Ordering Policy</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[11px] font-semibold',
                      systemEvaluation.allowAdvanceOrders
                        ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                        : 'border-muted-foreground/30 text-muted-foreground',
                    )}
                  >
                    {systemEvaluation.allowAdvanceOrders
                      ? 'Advance Scheduled Orders Allowed'
                      : 'Ordering Locked When Closed'}
                  </Badge>
                </div>

                <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1">
                  <span className="text-muted-foreground font-medium block">Customer Notice Banner</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[11px] font-semibold',
                      systemEvaluation.showNotice
                        ? 'border-primary/40 text-primary bg-primary/10'
                        : 'text-muted-foreground',
                    )}
                  >
                    {systemEvaluation.showNotice ? 'Notice Visible On Store' : 'Notice Hidden'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Card 3: Dynamic Operating Schedule Engine */}
          <Card className="rounded-xl border border-border bg-card shadow-xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Clock className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-base font-bold text-foreground">
                      Dynamic Operating Schedule Engine
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Configure individual day-by-day opening and closing hours. When offline, customers can still view and add items to cart.
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {systemForm.scheduleEnabled ? 'Schedule Enabled' : 'Schedule Disabled'}
                  </span>
                  <Switch
                    checked={systemForm.scheduleEnabled}
                    onCheckedChange={(checked) =>
                      setSystemForm((p) => ({ ...p, scheduleEnabled: checked }))
                    }
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 space-y-5">
              {/* One-click Presets & Weekend Off Switch */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Weekend System Off Quick Toggle */}
                <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        Weekend System Off
                      </span>
                      <p className="text-xs text-muted-foreground">
                        Automatically close store operations on weekend days (e.g. Saturday in Nepal).
                      </p>
                    </div>
                    <Switch
                      checked={systemForm.weekendOff}
                      onCheckedChange={(checked) =>
                        setSystemForm((p) => ({ ...p, weekendOff: checked }))
                      }
                    />
                  </div>

                  {systemForm.weekendOff && (
                    <div className="pt-2 border-t border-border/50 flex items-center gap-3">
                      <span className="text-xs font-medium text-muted-foreground">Weekend Days:</span>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={systemForm.weekendDays.includes('saturday') ? 'default' : 'outline'}
                          onClick={() => {
                            const hasSat = systemForm.weekendDays.includes('saturday')
                            setSystemForm((p) => ({
                              ...p,
                              weekendDays: hasSat
                                ? p.weekendDays.filter((d) => d !== 'saturday')
                                : [...p.weekendDays, 'saturday'],
                            }))
                          }}
                          className="h-7 text-xs px-2.5 font-mono"
                        >
                          Saturday (Nepal)
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={systemForm.weekendDays.includes('sunday') ? 'default' : 'outline'}
                          onClick={() => {
                            const hasSun = systemForm.weekendDays.includes('sunday')
                            setSystemForm((p) => ({
                              ...p,
                              weekendDays: hasSun
                                ? p.weekendDays.filter((d) => d !== 'sunday')
                                : [...p.weekendDays, 'sunday'],
                            }))
                          }}
                          className="h-7 text-xs px-2.5 font-mono"
                        >
                          Sunday
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick Presets */}
                <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                    Quick Operational Presets
                  </span>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={applyPreset247}
                      className="h-8 text-xs font-medium gap-1.5 hover:border-primary/50"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      24/7 Always Open
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={applyPresetStandard}
                      className="h-8 text-xs font-medium gap-1.5 hover:border-primary/50"
                    >
                      <Sun className="h-3.5 w-3.5 text-amber-500" />
                      Standard 10:00–23:00 (Sat Off)
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={applyPresetEveryday}
                      className="h-8 text-xs font-medium gap-1.5 hover:border-primary/50"
                    >
                      <Globe className="h-3.5 w-3.5 text-blue-500" />
                      7 Days Open 10:00–23:00
                    </Button>
                  </div>
                </div>
              </div>

              {/* Day-by-Day Table */}
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="w-[180px] text-xs font-bold">Weekday</TableHead>
                      <TableHead className="w-[140px] text-xs font-bold text-center">Operation Status</TableHead>
                      <TableHead className="w-[180px] text-xs font-bold">Opening Time</TableHead>
                      <TableHead className="w-[180px] text-xs font-bold">Closing Time</TableHead>
                      <TableHead className="text-xs font-bold">Daily Schedule Summary</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {([
                      { key: 'sunday' as WeekdayKey, label: 'Sunday' },
                      { key: 'monday' as WeekdayKey, label: 'Monday' },
                      { key: 'tuesday' as WeekdayKey, label: 'Tuesday' },
                      { key: 'wednesday' as WeekdayKey, label: 'Wednesday' },
                      { key: 'thursday' as WeekdayKey, label: 'Thursday' },
                      { key: 'friday' as WeekdayKey, label: 'Friday' },
                      { key: 'saturday' as WeekdayKey, label: 'Saturday (Nepal Weekend)', isWeekend: true },
                    ]).map((day) => {
                      const daySched = systemForm.weeklySchedule[day.key] || {
                        isOpen: true,
                        openTime: '10:00',
                        closeTime: '23:00',
                      }
                      const isWeekendDay =
                        systemForm.weekendOff && systemForm.weekendDays.includes(day.key)

                      return (
                        <TableRow key={day.key} className={day.isWeekend ? 'bg-muted/10' : ''}>
                          <TableCell className="font-medium text-xs">
                            <div className="flex items-center gap-1.5">
                              <span>{day.label}</span>
                              {day.isWeekend && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/40 text-amber-600 dark:text-amber-400">
                                  Weekend
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Switch
                                checked={daySched.isOpen}
                                onCheckedChange={(checked) => handleDayToggle(day.key, checked)}
                              />
                              <span
                                className={cn(
                                  'text-xs font-mono font-semibold',
                                  daySched.isOpen ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
                                )}
                              >
                                {daySched.isOpen ? 'OPEN' : 'CLOSED'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="time"
                              value={daySched.openTime}
                              disabled={!daySched.isOpen}
                              onChange={(e) => handleDayTimeChange(day.key, 'openTime', e.target.value)}
                              className="h-8 text-xs font-mono max-w-[140px]"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="time"
                              value={daySched.closeTime}
                              disabled={!daySched.isOpen}
                              onChange={(e) => handleDayTimeChange(day.key, 'closeTime', e.target.value)}
                              className="h-8 text-xs font-mono max-w-[140px]"
                            />
                          </TableCell>
                          <TableCell className="text-xs">
                            {isWeekendDay ? (
                              <span className="text-amber-600 dark:text-amber-400 font-medium">
                                Closed by Weekend Engine
                              </span>
                            ) : daySched.isOpen ? (
                              <span className="font-mono text-foreground font-semibold">
                                {daySched.openTime} – {daySched.closeTime}
                              </span>
                            ) : (
                              <span className="text-muted-foreground font-mono">Closed All Day</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Scheduled Custom Date Closure (Festivals / Maintenance) */}
          <Card className="rounded-xl border border-border bg-card shadow-xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Calendar className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-base font-bold text-foreground">
                      Custom Scheduled Closure & Reopening Window
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Schedule a temporary holiday or inventory recess (e.g. Dashain, Tihar, New Year). The system will automatically turn back on when the window ends.
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {systemForm.customClosureEnabled ? 'Scheduled Closure Active' : 'Disabled'}
                  </span>
                  <Switch
                    checked={systemForm.customClosureEnabled}
                    onCheckedChange={(checked) =>
                      setSystemForm((p) => ({ ...p, customClosureEnabled: checked }))
                    }
                  />
                </div>
              </div>
            </CardHeader>

            {systemForm.customClosureEnabled && (
              <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="customClosureStart" className="text-xs font-semibold">
                      Closure Start Date & Time
                    </Label>
                    <Input
                      id="customClosureStart"
                      type="datetime-local"
                      value={systemForm.customClosureStart || ''}
                      onChange={(e) =>
                        setSystemForm((p) => ({ ...p, customClosureStart: e.target.value || null }))
                      }
                      className="text-xs h-9 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="customClosureEnd" className="text-xs font-semibold">
                      Closure End Date & Time (Automatic Reopening)
                    </Label>
                    <Input
                      id="customClosureEnd"
                      type="datetime-local"
                      value={systemForm.customClosureEnd || ''}
                      onChange={(e) =>
                        setSystemForm((p) => ({ ...p, customClosureEnd: e.target.value || null }))
                      }
                      className="text-xs h-9 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="customClosureMessage" className="text-xs font-semibold">
                    Customer Closure Notice Message
                  </Label>
                  <Input
                    id="customClosureMessage"
                    value={systemForm.customClosureMessage}
                    onChange={(e) =>
                      setSystemForm((p) => ({ ...p, customClosureMessage: e.target.value }))
                    }
                    className="text-xs h-9"
                    placeholder="e.g. Store closed for Dashain Holiday. Reopening on October 15 at 10:00 AM."
                  />
                </div>
              </CardContent>
            )}
          </Card>

          {/* Card 5: Offline Ordering & Customer Delivery Notice Policy */}
          <Card className="rounded-xl border border-border bg-card shadow-xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <Megaphone className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-base font-bold text-foreground">
                    Offline Customer Ordering & Delivery Policy
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Control advance order acceptance while store is closed, and configure the notice informing customers of reopening delivery times.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 space-y-4">
              {/* Option A: Allow Advance Orders When Closed */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-border bg-muted/20">
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      Accept Advance Scheduled Orders When Store is Closed
                    </span>
                    {systemForm.allowAdvanceOrdersWhenClosed && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                        Advance Orders Enabled
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    When enabled: Customers can browse items, add to cart, and checkout with a scheduled delivery time during upcoming operating hours. Immediate express delivery is disabled until reopen.
                  </p>
                  <p className="text-xs text-muted-foreground font-medium">
                    When disabled: Customers can browse items and add to cart, but the checkout button is locked until the store opens.
                  </p>
                </div>
                <Switch
                  checked={systemForm.allowAdvanceOrdersWhenClosed}
                  onCheckedChange={(checked) =>
                    setSystemForm((p) => ({ ...p, allowAdvanceOrdersWhenClosed: checked }))
                  }
                />
              </div>

              {/* Option B: Offline Notice Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-border bg-muted/20">
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      Broadcast Storefront Offline Notice Banner
                    </span>
                    {systemForm.showOfflineNotice && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40 text-primary">
                        Banner Visible
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Displays an announcement banner on the storefront header, cart drawer, and checkout screen alerting customers of the closed hours and when their order will be delivered.
                  </p>
                </div>
                <Switch
                  checked={systemForm.showOfflineNotice}
                  onCheckedChange={(checked) =>
                    setSystemForm((p) => ({ ...p, showOfflineNotice: checked }))
                  }
                />
              </div>

              {/* Custom Offline Notice Message */}
              <div className="space-y-1.5 pt-1">
                <Label htmlFor="offlineNoticeMessage" className="text-xs font-semibold">
                  Customer Offline Notice Message Template
                </Label>
                <Input
                  id="offlineNoticeMessage"
                  value={systemForm.offlineNoticeMessage}
                  onChange={(e) =>
                    setSystemForm((p) => ({ ...p, offlineNoticeMessage: e.target.value }))
                  }
                  className="text-xs h-9"
                  placeholder="Mezmani is currently closed for immediate delivery. Place your order now and it will be delivered after reopening!"
                />
                <p className="text-[11px] text-muted-foreground">
                  The system will automatically append the dynamic reopening time badge (e.g. &quot;Reopens: Tomorrow, 10:00 AM&quot;) to this notice.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Card 6: Emergency Kill-Switches & Blackout Controls */}
          <Card className="rounded-xl border border-border bg-card shadow-xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-base font-bold text-foreground">
                    Emergency Operational Kill-Switches
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Storefront maintenance intercepts, urgent order placement pauses, and delivery zone dispatch blackouts.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-4">
              {/* Switch 1: Maintenance Mode */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-border bg-muted/20">
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      Storefront Maintenance Mode
                    </span>
                    {systemForm.maintenanceMode && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        Active
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    When enabled, customer checkout and browsing are intercepted with a polite maintenance notice. Admins retain full console access.
                  </p>
                  <Input
                    value={systemForm.maintenanceMessage}
                    onChange={(e) =>
                      setSystemForm((p) => ({ ...p, maintenanceMessage: e.target.value }))
                    }
                    className="text-xs h-8 mt-2"
                    placeholder="Maintenance message shown to customers..."
                  />
                </div>
                <Switch
                  checked={systemForm.maintenanceMode}
                  onCheckedChange={(checked) =>
                    setSystemForm((p) => ({ ...p, maintenanceMode: checked }))
                  }
                />
              </div>

              {/* Switch 2: Order Placement Freeze */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-border bg-muted/20">
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      Emergency Order Placement Kill-switch
                    </span>
                    {systemForm.orderPlacementFreeze && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        Orders Paused
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Temporarily freeze new incoming orders (e.g. during physical warehouse audit or inventory count).
                  </p>
                  <Input
                    value={systemForm.freezeReason}
                    onChange={(e) =>
                      setSystemForm((p) => ({ ...p, freezeReason: e.target.value }))
                    }
                    className="text-xs h-8 mt-2"
                    placeholder="Reason for order placement freeze..."
                  />
                </div>
                <Switch
                  checked={systemForm.orderPlacementFreeze}
                  onCheckedChange={(checked) =>
                    setSystemForm((p) => ({ ...p, orderPlacementFreeze: checked }))
                  }
                />
              </div>

              {/* Switch 3: Delivery Blackout */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-border bg-muted/20">
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      Delivery Zone Dispatch Blackout
                    </span>
                    {systemForm.deliveryBlackout && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        Blackout Active
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Temporarily alerts riders and customers that dispatch is postponed due to severe weather, road blocks, or night curfew.
                  </p>
                  <Input
                    value={systemForm.blackoutMessage}
                    onChange={(e) =>
                      setSystemForm((p) => ({ ...p, blackoutMessage: e.target.value }))
                    }
                    className="text-xs h-8 mt-2"
                    placeholder="Blackout explanation..."
                  />
                </div>
                <Switch
                  checked={systemForm.deliveryBlackout}
                  onCheckedChange={(checked) =>
                    setSystemForm((p) => ({ ...p, deliveryBlackout: checked }))
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Sticky Save Action Bar */}
          <div className="sticky bottom-4 z-20 flex justify-end p-4 rounded-xl border border-border bg-background/95 backdrop-blur shadow-lg">
            <Button
              type="submit"
              disabled={isSavingSystem}
              size="default"
              className="h-10 text-xs gap-2 bg-primary font-bold shadow-md cursor-pointer uppercase tracking-wide"
            >
              {isSavingSystem ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <span>Save System Operational Controls & Operating Schedule</span>
            </Button>
          </div>
        </form>
      )}

      {/* ============================================================== */}
      {/* 9: ADMIN PANEL MANAGEMENT TAB (Broadcast Notices & Support) */}
      {/* ============================================================== */}
      {currentTab === 'admin-panel' && (
        <div className="space-y-6">
          {/* Section A: Send Dynamic Notices to Admin Panel */}
          <Card className="rounded-xl border border-border bg-card shadow-xs">
            <CardHeader className="border-b border-border/60 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Megaphone className="h-5 w-5 text-primary" />
                    <span>Admin Panel Management & Broadcast Notices</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Send high-priority notices, payment reminders ("Make Payment"), or developer support details dynamically across all admin and staff dashboards.
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Quick Presets:</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleApplyNoticePreset('payment')}
                    className="h-8 text-xs gap-1.5 border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20"
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    <span>Payment Reminder</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleApplyNoticePreset('support')}
                    className="h-8 text-xs gap-1.5 border-blue-500/40 text-blue-700 dark:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    <span>Developer Support</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleApplyNoticePreset('maintenance')}
                    className="h-8 text-xs gap-1.5 border-destructive/40 text-destructive bg-destructive/10 hover:bg-destructive/20"
                  >
                    <Cpu className="h-3.5 w-3.5" />
                    <span>Maintenance Alert</span>
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 space-y-6">
              {/* Notice Composer Form */}
              <form onSubmit={handleSaveNotice} className="p-4 rounded-xl border border-border bg-muted/20 space-y-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-primary" />
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Compose Dynamic Notice for Admin Panel
                    </span>
                  </div>
                  <Badge variant="outline" className="text-xs font-mono">
                    Broadcast Channel: Mezmani Admins
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-semibold">Notice Title</Label>
                    <Input
                      value={noticeForm.title}
                      onChange={(e) => setNoticeForm((p) => ({ ...p, title: e.target.value }))}
                      placeholder="e.g. Payment Required: Monthly Infrastructure & Database Invoice"
                      className="text-xs h-9 font-medium"
                      required
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-semibold">Notice Message</Label>
                    <Textarea
                      rows={3}
                      value={noticeForm.message}
                      onChange={(e) => setNoticeForm((p) => ({ ...p, message: e.target.value }))}
                      placeholder="Detailed explanation, payment deadline, bank transfer instructions, or support contact..."
                      className="text-xs font-medium"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Notice Severity / Style</Label>
                    <RadioGroup
                      value={noticeForm.type}
                      onValueChange={(val: any) => setNoticeForm((p) => ({ ...p, type: val }))}
                      className="grid grid-cols-2 gap-2 text-xs"
                    >
                      <div className="flex items-center space-x-2 border border-border bg-card p-2 rounded-md">
                        <RadioGroupItem value="warning" id="type-warning" />
                        <Label htmlFor="type-warning" className="cursor-pointer font-medium text-amber-700 dark:text-amber-300">
                          Warning (Payment)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 border border-border bg-card p-2 rounded-md">
                        <RadioGroupItem value="info" id="type-info" />
                        <Label htmlFor="type-info" className="cursor-pointer font-medium text-blue-700 dark:text-blue-300">
                          Info (Support)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 border border-border bg-card p-2 rounded-md">
                        <RadioGroupItem value="destructive" id="type-dest" />
                        <Label htmlFor="type-dest" className="cursor-pointer font-medium text-destructive">
                          Critical / Urgent
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 border border-border bg-card p-2 rounded-md">
                        <RadioGroupItem value="success" id="type-success" />
                        <Label htmlFor="type-success" className="cursor-pointer font-medium text-emerald-700 dark:text-emerald-300">
                          Success
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Action Button Label (Optional)</Label>
                      <Input
                        value={noticeForm.actionLabel}
                        onChange={(e) => setNoticeForm((p) => ({ ...p, actionLabel: e.target.value }))}
                        placeholder="e.g. Make Payment or View Details"
                        className="text-xs h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Action URL or Route Link</Label>
                      <Input
                        value={noticeForm.actionUrl}
                        onChange={(e) => setNoticeForm((p) => ({ ...p, actionUrl: e.target.value }))}
                        placeholder="e.g. /superadmin?tab=admin-panel or https://esewa.com.np"
                        className="text-xs h-9 font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border/60">
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="notice-active"
                        checked={noticeForm.active}
                        onCheckedChange={(checked) => setNoticeForm((p) => ({ ...p, active: checked }))}
                      />
                      <Label htmlFor="notice-active" className="cursor-pointer font-medium">
                        Publish as Active immediately
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="notice-dismiss"
                        checked={noticeForm.dismissible}
                        onCheckedChange={(checked) => setNoticeForm((p) => ({ ...p, dismissible: checked }))}
                      />
                      <Label htmlFor="notice-dismiss" className="cursor-pointer font-medium">
                        Allow Admins to Dismiss
                      </Label>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isSavingNotice}
                    size="sm"
                    className="h-9 text-xs gap-1.5 bg-primary font-semibold"
                  >
                    {isSavingNotice ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Megaphone className="h-3.5 w-3.5" />
                    )}
                    <span>Broadcast Notice to Admin Panel</span>
                  </Button>
                </div>
              </form>

              {/* Existing Active Notices Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Bell className="h-3.5 w-3.5" />
                    <span>Active & Configured Admin Notices ({noticesData?.notices?.length ?? 0})</span>
                  </h4>
                  <span className="text-[11px] text-muted-foreground">
                    Changes reflect instantly across all admin sessions
                  </span>
                </div>

                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="text-xs font-bold py-2 w-[110px]">Type</TableHead>
                        <TableHead className="text-xs font-bold py-2">Notice Title & Message</TableHead>
                        <TableHead className="text-xs font-bold py-2 w-[160px]">Action Button</TableHead>
                        <TableHead className="text-xs font-bold py-2 w-[100px] text-center">Status</TableHead>
                        <TableHead className="text-xs font-bold py-2 w-[110px] text-right">Controls</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(!noticesData?.notices || noticesData.notices.length === 0) ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-6 text-center text-xs text-muted-foreground">
                            No admin broadcast notices active. Use the form above to send an announcement.
                          </TableCell>
                        </TableRow>
                      ) : (
                        noticesData.notices.map((n) => (
                          <TableRow key={n.id} className="hover:bg-muted/20">
                            <TableCell className="py-2.5">
                              <Badge
                                variant={
                                  n.type === 'warning'
                                    ? 'destructive'
                                    : n.type === 'destructive'
                                      ? 'destructive'
                                      : n.type === 'success'
                                        ? 'default'
                                        : 'secondary'
                                }
                                className="text-[10px] uppercase font-mono px-2 py-0.5"
                              >
                                {n.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2.5">
                              <div className="space-y-0.5">
                                <p className="text-xs font-bold text-foreground">{n.title}</p>
                                <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                                <p className="text-[10px] text-muted-foreground/80 font-mono">
                                  ID: {n.id} • Created: {new Date(n.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="py-2.5 text-xs font-mono">
                              {n.actionLabel ? (
                                <Badge variant="outline" className="text-[11px] truncate max-w-[150px]">
                                  {n.actionLabel}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="py-2.5 text-center">
                              <div className="flex items-center justify-center">
                                <Switch
                                  checked={n.active}
                                  onCheckedChange={(checked) => handleToggleNotice(n.id, checked)}
                                />
                              </div>
                            </TableCell>
                            <TableCell className="py-2.5 text-right">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteNotice(n.id)}
                                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                title="Delete notice"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section B: Dynamic Developer Support & Payment Details */}
          <Card className="rounded-xl border border-border bg-card shadow-xs">
            <CardHeader className="border-b border-border/60 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    <span>Developer Support & Bank Payment Details</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Configure official developer contact details, WhatsApp hotline, and corporate bank accounts for admin subscription payments.
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="text-xs font-mono">
                  Managed dynamically
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6">
              <form onSubmit={handleSaveSupport} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Developer Team / Org Name</Label>
                    <Input
                      value={supportForm.developerTeamName}
                      onChange={(e) =>
                        setSupportForm((p) => ({ ...p, developerTeamName: e.target.value }))
                      }
                      className="text-xs h-9"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Developer Phone Hotline</Label>
                    <Input
                      value={supportForm.contactPhone}
                      onChange={(e) =>
                        setSupportForm((p) => ({ ...p, contactPhone: e.target.value }))
                      }
                      className="text-xs h-9"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Support WhatsApp Number</Label>
                    <Input
                      value={supportForm.whatsappNumber}
                      onChange={(e) =>
                        setSupportForm((p) => ({ ...p, whatsappNumber: e.target.value }))
                      }
                      className="text-xs h-9"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Developer Support Email</Label>
                    <Input
                      value={supportForm.supportEmail}
                      onChange={(e) =>
                        setSupportForm((p) => ({ ...p, supportEmail: e.target.value }))
                      }
                      className="text-xs h-9"
                      required
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-semibold">Office / Emergency Support Hours</Label>
                    <Input
                      value={supportForm.officeHours}
                      onChange={(e) =>
                        setSupportForm((p) => ({ ...p, officeHours: e.target.value }))
                      }
                      className="text-xs h-9"
                      required
                    />
                  </div>
                </div>

                {/* Bank Account Details */}
                <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Official Bank Payment Account (For Admin Invoices)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Bank Name</Label>
                      <Input
                        value={supportForm.paymentDetails.bankName}
                        onChange={(e) =>
                          setSupportForm((p) => ({
                            ...p,
                            paymentDetails: { ...p.paymentDetails, bankName: e.target.value },
                          }))
                        }
                        className="text-xs h-9"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Account Holder Name</Label>
                      <Input
                        value={supportForm.paymentDetails.accountName}
                        onChange={(e) =>
                          setSupportForm((p) => ({
                            ...p,
                            paymentDetails: { ...p.paymentDetails, accountName: e.target.value },
                          }))
                        }
                        className="text-xs h-9"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Account Number</Label>
                      <Input
                        value={supportForm.paymentDetails.accountNumber}
                        onChange={(e) =>
                          setSupportForm((p) => ({
                            ...p,
                            paymentDetails: { ...p.paymentDetails, accountNumber: e.target.value },
                          }))
                        }
                        className="text-xs h-9 font-mono"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Branch Name</Label>
                      <Input
                        value={supportForm.paymentDetails.branch}
                        onChange={(e) =>
                          setSupportForm((p) => ({
                            ...p,
                            paymentDetails: { ...p.paymentDetails, branch: e.target.value },
                          }))
                        }
                        className="text-xs h-9"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Deposit Instructions & Remarks Note</Label>
                    <Textarea
                      rows={2}
                      value={supportForm.paymentDetails.paymentInstructions}
                      onChange={(e) =>
                        setSupportForm((p) => ({
                          ...p,
                          paymentDetails: { ...p.paymentDetails, paymentInstructions: e.target.value },
                        }))
                      }
                      className="text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-border/60">
                  <Button
                    type="submit"
                    disabled={isSavingSupport}
                    size="sm"
                    className="h-9 text-xs gap-1.5 bg-primary font-semibold"
                  >
                    {isSavingSupport ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    <span>Save Support & Payment Credentials</span>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ============================================================== */}
      {/* 10: RUNTIME FEATURE FLAGS TAB */}
      {/* ============================================================== */}
      {currentTab === 'features' && (
        <div className="space-y-6">
          <Card className="rounded-xl border border-border bg-card shadow-xs">
            <CardHeader className="border-b border-border/60 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Sliders className="h-5 w-5 text-primary" />
                    <span>Dynamic Runtime Feature Flags</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Adjust checkout gateways, legal compliance gates, and dispatch mechanics at runtime with zero redeployments.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs font-mono border-primary/40 text-primary self-start sm:self-auto">
                  Zero-Downtime Hot-Config
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSaveFeatureFlags} className="space-y-6">
                {/* Gateway Toggles */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <CreditCard className="h-4 w-4 text-primary" />
                    <span>Payment Gateway Integrations</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-3.5 rounded-lg border border-border/70 bg-muted/20">
                      <div>
                        <p className="text-xs font-semibold">Cash On Delivery (COD)</p>
                        <p className="text-[11px] text-muted-foreground">Allow customers to pay in cash upon arrival</p>
                      </div>
                      <Switch
                        checked={featureFlagsForm.enableCod}
                        onCheckedChange={(c) => setFeatureFlagsForm((p) => ({ ...p, enableCod: c }))}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3.5 rounded-lg border border-border/70 bg-muted/20">
                      <div>
                        <p className="text-xs font-semibold">eSewa Digital Wallet</p>
                        <p className="text-[11px] text-muted-foreground">Direct online eSewa QR & epay checkout</p>
                      </div>
                      <Switch
                        checked={featureFlagsForm.enableEsewa}
                        onCheckedChange={(c) => setFeatureFlagsForm((p) => ({ ...p, enableEsewa: c }))}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3.5 rounded-lg border border-border/70 bg-muted/20">
                      <div>
                        <p className="text-xs font-semibold">Khalti Gateway</p>
                        <p className="text-[11px] text-muted-foreground">Khalti SDK payment checkout channel</p>
                      </div>
                      <Switch
                        checked={featureFlagsForm.enableKhalti}
                        onCheckedChange={(c) => setFeatureFlagsForm((p) => ({ ...p, enableKhalti: c }))}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3.5 rounded-lg border border-border/70 bg-muted/20">
                      <div>
                        <p className="text-xs font-semibold">FonePay Direct Interbank QR</p>
                        <p className="text-[11px] text-muted-foreground">Dynamic Fonepay merchant payment QR</p>
                      </div>
                      <Switch
                        checked={featureFlagsForm.enableFonepay}
                        onCheckedChange={(c) => setFeatureFlagsForm((p) => ({ ...p, enableFonepay: c }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Legal & Age Verification */}
                <div className="pt-4 border-t border-border/60">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4 text-primary" />
                    <span>Legal Compliance & Age Gate (Alcohol Control)</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-3.5 rounded-lg border border-border/70 bg-muted/20">
                      <div>
                        <p className="text-xs font-semibold">Mandatory 18+ Age Verification Modal</p>
                        <p className="text-[11px] text-muted-foreground">Prompt visitor for legal drinking age before entering liquor aisles</p>
                      </div>
                      <Switch
                        checked={featureFlagsForm.enableAgeVerificationModal}
                        onCheckedChange={(c) => setFeatureFlagsForm((p) => ({ ...p, enableAgeVerificationModal: c }))}
                      />
                    </div>
                    <div className="p-3.5 rounded-lg border border-border/70 bg-muted/20 space-y-1.5">
                      <Label className="text-xs font-semibold">Minimum Age Requirement</Label>
                      <Input
                        type="number"
                        min={16}
                        max={25}
                        value={featureFlagsForm.minAgeRequirement}
                        onChange={(e) => setFeatureFlagsForm((p) => ({ ...p, minAgeRequirement: parseInt(e.target.value) || 18 }))}
                        className="text-xs h-9"
                      />
                      <p className="text-[10px] text-muted-foreground">Standard Nepal legal age is 18 years.</p>
                    </div>
                  </div>
                </div>

                {/* Fulfillment & Messaging */}
                <div className="pt-4 border-t border-border/60">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Bike className="h-4 w-4 text-primary" />
                    <span>Fulfillment, Dispatch & Stock Policies</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-3.5 rounded-lg border border-border/70 bg-muted/20">
                      <div>
                        <p className="text-xs font-semibold">Rider Auto-Assignment Engine</p>
                        <p className="text-[11px] text-muted-foreground">Auto-match new orders to closest available rider</p>
                      </div>
                      <Switch
                        checked={featureFlagsForm.enableRiderAutoAssign}
                        onCheckedChange={(c) => setFeatureFlagsForm((p) => ({ ...p, enableRiderAutoAssign: c }))}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3.5 rounded-lg border border-border/70 bg-muted/20">
                      <div>
                        <p className="text-xs font-semibold">Guest One-Click Checkout</p>
                        <p className="text-[11px] text-muted-foreground">Allow instant orders without mandatory account creation</p>
                      </div>
                      <Switch
                        checked={featureFlagsForm.enableGuestCheckout}
                        onCheckedChange={(c) => setFeatureFlagsForm((p) => ({ ...p, enableGuestCheckout: c }))}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3.5 rounded-lg border border-border/70 bg-muted/20">
                      <div>
                        <p className="text-xs font-semibold">Real-Time SMS Notifications</p>
                        <p className="text-[11px] text-muted-foreground">Send order tracking SMS updates to customer phone</p>
                      </div>
                      <Switch
                        checked={featureFlagsForm.enableOrderSms}
                        onCheckedChange={(c) => setFeatureFlagsForm((p) => ({ ...p, enableOrderSms: c }))}
                      />
                    </div>
                    <div className="p-3.5 rounded-lg border border-border/70 bg-muted/20 space-y-1.5">
                      <Label className="text-xs font-semibold">Active SMS Gateway Provider</Label>
                      <Select
                        value={featureFlagsForm.smsGatewayProvider}
                        onValueChange={(val: any) => setFeatureFlagsForm((p) => ({ ...p, smsGatewayProvider: val }))}
                      >
                        <SelectTrigger className="text-xs h-9">
                          <SelectValue placeholder="Select gateway" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sparrow">Sparrow SMS (Live Production)</SelectItem>
                          <SelectItem value="aakash">Aakash SMS (Secondary Enterprise)</SelectItem>
                          <SelectItem value="mock">Development Sandbox (Mock Console Log)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground">Switches API dispatcher immediately.</p>
                    </div>
                    <div className="flex items-center justify-between p-3.5 rounded-lg border border-border/70 bg-muted/20">
                      <div>
                        <p className="text-xs font-semibold">Strict Out-of-Stock Prevention</p>
                        <p className="text-[11px] text-muted-foreground">Instantly disable cart adding if variant inventory reaches zero</p>
                      </div>
                      <Switch
                        checked={featureFlagsForm.enableStrictStockCheck}
                        onCheckedChange={(c) => setFeatureFlagsForm((p) => ({ ...p, enableStrictStockCheck: c }))}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3.5 rounded-lg border border-border/70 bg-muted/20">
                      <div>
                        <p className="text-xs font-semibold">Allow Pre-Orders on Depleted Stock</p>
                        <p className="text-[11px] text-muted-foreground">Accept backorders when catalog items are temporarily restocking</p>
                      </div>
                      <Switch
                        checked={featureFlagsForm.enablePreorders}
                        onCheckedChange={(c) => setFeatureFlagsForm((p) => ({ ...p, enablePreorders: c }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border/60">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFeatureFlagsForm(DEFAULT_FEATURE_FLAGS)}
                    className="text-xs text-muted-foreground"
                  >
                    Reset Defaults
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSavingFlags}
                    size="sm"
                    className="h-9 text-xs gap-1.5 bg-primary font-semibold"
                  >
                    {isSavingFlags ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    <span>Save Runtime Feature Flags</span>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ============================================================== */}
      {/* 11: DYNAMIC PRICING & DELIVERY RULES TAB */}
      {/* ============================================================== */}
      {currentTab === 'pricing' && (
        <div className="space-y-6">
          <Card className="rounded-xl border border-border bg-card shadow-xs">
            <CardHeader className="border-b border-border/60 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    <span>Dynamic Pricing & Delivery Rules Engine</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Configure delivery fee formulas, night surcharges, Nepal VAT rate (13%), and free shipping thresholds.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs font-mono border-primary/40 text-primary">
                  All monetary values in NPR (Rs.)
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSavePricing} className="space-y-6">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Bike className="h-4 w-4 text-primary" />
                    <span>Delivery Fee Formula</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Base Delivery Charge (NPR)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={pricingForm.baseDeliveryCharge}
                        onChange={(e) => setPricingForm((p) => ({ ...p, baseDeliveryCharge: parseFloat(e.target.value) || 0 }))}
                        className="text-xs h-9"
                      />
                      <p className="text-[10px] text-muted-foreground">Standard starting delivery fee</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Per-Kilometer Distance Surge (NPR/km)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={pricingForm.perKmCharge}
                        onChange={(e) => setPricingForm((p) => ({ ...p, perKmCharge: parseFloat(e.target.value) || 0 }))}
                        className="text-xs h-9"
                      />
                      <p className="text-[10px] text-muted-foreground">Applied beyond store radius</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Free Delivery Order Threshold (NPR)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={pricingForm.freeDeliveryThreshold}
                        onChange={(e) => setPricingForm((p) => ({ ...p, freeDeliveryThreshold: parseFloat(e.target.value) || 0 }))}
                        className="text-xs h-9"
                      />
                      <p className="text-[10px] text-muted-foreground">Orders equal or above receive free delivery</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-border/60">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-primary" />
                    <span>Night & Late-Hour Surcharge</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Night Surcharge Amount (NPR)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={pricingForm.nightSurcharge}
                        onChange={(e) => setPricingForm((p) => ({ ...p, nightSurcharge: parseFloat(e.target.value) || 0 }))}
                        className="text-xs h-9"
                      />
                      <p className="text-[10px] text-muted-foreground">Bonus rider compensation fee</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Start Hour (24h format, e.g. 21 = 9 PM)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={23}
                        value={pricingForm.nightSurchargeStartHour}
                        onChange={(e) => setPricingForm((p) => ({ ...p, nightSurchargeStartHour: parseInt(e.target.value) || 0 }))}
                        className="text-xs h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">End Hour (24h format, e.g. 6 = 6 AM)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={23}
                        value={pricingForm.nightSurchargeEndHour}
                        onChange={(e) => setPricingForm((p) => ({ ...p, nightSurchargeEndHour: parseInt(e.target.value) || 0 }))}
                        className="text-xs h-9"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-border/60">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-primary" />
                    <span>Nepal VAT & Service Charges</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex items-center justify-between p-3.5 rounded-lg border border-border/70 bg-muted/20">
                      <div>
                        <p className="text-xs font-semibold">Enable VAT Calculation</p>
                        <p className="text-[11px] text-muted-foreground">Include statutory VAT in order receipts</p>
                      </div>
                      <Switch
                        checked={pricingForm.enableVat}
                        onCheckedChange={(c) => setPricingForm((p) => ({ ...p, enableVat: c }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">VAT Rate (%)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={50}
                        value={pricingForm.vatRatePercent}
                        onChange={(e) => setPricingForm((p) => ({ ...p, vatRatePercent: parseFloat(e.target.value) || 0 }))}
                        className="text-xs h-9"
                      />
                      <p className="text-[10px] text-muted-foreground">Standard Nepal VAT is 13%</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Service Charge (%)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={50}
                        value={pricingForm.serviceChargePercent}
                        onChange={(e) => setPricingForm((p) => ({ ...p, serviceChargePercent: parseFloat(e.target.value) || 0 }))}
                        className="text-xs h-9"
                      />
                      <p className="text-[10px] text-muted-foreground">Packaging & handling fee</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border/60">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPricingForm(DEFAULT_PRICING_RULES)}
                    className="text-xs text-muted-foreground"
                  >
                    Reset Defaults
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSavingPricing}
                    size="sm"
                    className="h-9 text-xs gap-1.5 bg-primary font-semibold"
                  >
                    {isSavingPricing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    <span>Save Pricing & Delivery Rules</span>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ============================================================== */}
      {/* 12: USER & ROLE ENGINE TAB */}
      {/* ============================================================== */}
      {currentTab === 'users' && (
        <div className="space-y-6">
          <Card className="rounded-xl border border-border bg-card shadow-xs">
            <CardHeader className="border-b border-border/60 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    <span>User & Role Governance Matrix</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Inspect all customer, rider, staff, and admin accounts. Manage roles, active states, and bans with custom developer audit reasons.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportUsers}
                  className="h-9 text-xs gap-1.5 border-border shrink-0"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export Users CSV</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {/* Filter Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, or mobile number..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-8 text-xs h-9"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                    <SelectTrigger className="text-xs h-9 w-[150px]">
                      <SelectValue placeholder="Filter role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="superadmin">Super Admin</SelectItem>
                      <SelectItem value="admin">Store Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="rider">Rider</SelectItem>
                      <SelectItem value="customer">Customer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Badge variant="secondary" className="text-xs font-mono px-2.5 py-1.5 shrink-0">
                    {filteredUsers.length} Users
                  </Badge>
                </div>
              </div>

              {/* Users Table */}
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="text-xs font-bold">User / Identity</TableHead>
                      <TableHead className="text-xs font-bold">Phone Number</TableHead>
                      <TableHead className="text-xs font-bold">Current Role</TableHead>
                      <TableHead className="text-xs font-bold">Account Status</TableHead>
                      <TableHead className="text-xs font-bold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-xs">
                          No users found matching query
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.slice(0, 50).map((u) => {
                        const isSuper = u.role === 'superadmin' || u.email?.toLowerCase() === 'admin@newline.com'
                        return (
                          <TableRow key={u.id} className="text-xs hover:bg-muted/20">
                            <TableCell className="font-medium">
                              <div>
                                <p className="font-semibold text-foreground flex items-center gap-1.5">
                                  <span>{u.name || 'Unnamed User'}</span>
                                  {isSuper && (
                                    <Badge variant="default" className="text-[10px] px-1 py-0 bg-cyan-600">
                                      DEV ROOT
                                    </Badge>
                                  )}
                                </p>
                                <p className="text-[11px] text-muted-foreground font-mono">{u.email || 'No email'}</p>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-muted-foreground">
                              {u.phone || '—'}
                            </TableCell>
                            <TableCell>
                              <Select
                                disabled={isUpdatingUser || (isSuper && u.email === 'admin@newline.com')}
                                value={u.role || 'customer'}
                                onValueChange={(val) => handleChangeUserRole(u.id, val)}
                              >
                                <SelectTrigger className="text-xs h-7 w-[120px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="superadmin">Super Admin</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="manager">Manager</SelectItem>
                                  <SelectItem value="rider">Rider</SelectItem>
                                  <SelectItem value="customer">Customer</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className={
                                    u.isActive !== false
                                      ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10 text-[10px]'
                                      : 'text-amber-500 border-amber-500/30 bg-amber-500/10 text-[10px]'
                                  }
                                >
                                  {u.isActive !== false ? 'Active' : 'Inactive'}
                                </Badge>
                                {u.banned && (
                                  <Badge
                                    variant="destructive"
                                    className="text-[10px]"
                                    title={u.banReason || 'Banned account'}
                                  >
                                    Banned
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={isUpdatingUser || isSuper}
                                  onClick={() => handleToggleUserActive(u.id, u.isActive !== false)}
                                  className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                                  title={u.isActive !== false ? 'Deactivate account' : 'Activate account'}
                                >
                                  {u.isActive !== false ? 'Deactivate' : 'Activate'}
                                </Button>
                                {u.banned ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={isUpdatingUser}
                                    onClick={() => handleLiftBan(u)}
                                    className="h-7 text-xs px-2 text-emerald-500 border-emerald-500/40 hover:bg-emerald-500/10"
                                  >
                                    <UserCheck className="h-3 w-3 mr-1" />
                                    Lift Ban
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={isUpdatingUser || isSuper}
                                    onClick={() => handleOpenBanDialog(u)}
                                    className="h-7 text-xs px-2 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                                  >
                                    <UserX className="h-3 w-3 mr-1" />
                                    Ban
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ============================================================== */}
      {/* 13: LIVE AUDIT TRAIL TAB */}
      {/* ============================================================== */}
      {currentTab === 'audit' && (
        <div className="space-y-6">
          <Card className="rounded-xl border border-border bg-card shadow-xs">
            <CardHeader className="border-b border-border/60 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <span>Live System Audit Trail & Operator Stream</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Chronological activity log recording every configuration edit, role upgrade, data import, and broadcast notice published.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportAuditLogs}
                  disabled={isExportingAudit}
                  className="h-9 text-xs gap-1.5 border-border shrink-0"
                >
                  {isExportingAudit ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  <span>Export Audit Logs CSV</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search audit events by actor or detail..."
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    className="pl-8 text-xs h-9"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Select value={auditModuleFilter} onValueChange={setAuditModuleFilter}>
                    <SelectTrigger className="text-xs h-9 w-[160px]">
                      <SelectValue placeholder="Filter module" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Modules</SelectItem>
                      <SelectItem value="superadmin">Super Admin</SelectItem>
                      <SelectItem value="auth">Auth & Security</SelectItem>
                      <SelectItem value="catalog">Catalog</SelectItem>
                      <SelectItem value="orders">Orders</SelectItem>
                      <SelectItem value="dealers">Dealers</SelectItem>
                      <SelectItem value="settings">Settings</SelectItem>
                    </SelectContent>
                  </Select>
                  <Badge variant="secondary" className="text-xs font-mono px-2.5 py-1.5 shrink-0">
                    {filteredAuditLogs.length} Events
                  </Badge>
                </div>
              </div>

              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="text-xs font-bold w-[170px]">Timestamp</TableHead>
                      <TableHead className="text-xs font-bold w-[160px]">Actor</TableHead>
                      <TableHead className="text-xs font-bold w-[120px]">Module</TableHead>
                      <TableHead className="text-xs font-bold w-[100px]">Action</TableHead>
                      <TableHead className="text-xs font-bold">Event Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAuditLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-xs">
                          No audit events recorded yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAuditLogs.map((log) => (
                        <TableRow key={log.id} className="text-xs hover:bg-muted/20">
                          <TableCell className="font-mono text-muted-foreground whitespace-nowrap">
                            {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                          </TableCell>
                          <TableCell className="font-semibold text-foreground">
                            {log.actor}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] font-mono uppercase">
                              {log.module}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={
                                log.action === 'create'
                                  ? 'text-emerald-500 bg-emerald-500/10 text-[10px]'
                                  : log.action === 'delete'
                                  ? 'text-rose-500 bg-rose-500/10 text-[10px]'
                                  : 'text-cyan-500 bg-cyan-500/10 text-[10px]'
                              }
                            >
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground font-mono text-[11px]">
                            {log.detail}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ============================================================== */}
      {/* 14: DEVELOPER TELEMETRY & SANDBOX TAB */}
      {/* ============================================================== */}
      {currentTab === 'console' && (
        <div className="space-y-6">
          <Card className="rounded-xl border border-border bg-card shadow-xs">
            <CardHeader className="border-b border-border/60 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Terminal className="h-5 w-5 text-primary" />
                    <span>Developer Telemetry & Sandbox Diagnostics</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Live server health, database connection latency, runtime memory metrics, and developer diagnostic tools.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs font-mono border-emerald-500/40 text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse mr-1.5 inline-block" />
                  Cluster Online
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* Telemetry Metrics */}
              {telemetryData && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-lg border border-border bg-muted/20">
                    <p className="text-[11px] text-muted-foreground uppercase font-mono">Node Runtime</p>
                    <p className="text-base font-bold text-foreground font-mono mt-0.5">{telemetryData.nodeVersion}</p>
                    <p className="text-[10px] text-muted-foreground capitalize mt-0.5">Env: {telemetryData.environment}</p>
                  </div>
                  <div className="p-3.5 rounded-lg border border-border bg-muted/20">
                    <p className="text-[11px] text-muted-foreground uppercase font-mono">Database Latency</p>
                    <p className="text-base font-bold text-emerald-400 font-mono mt-0.5">{telemetryData.dbLatencyMs} ms</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Status: {telemetryData.dbStatus}</p>
                  </div>
                  <div className="p-3.5 rounded-lg border border-border bg-muted/20">
                    <p className="text-[11px] text-muted-foreground uppercase font-mono">Process Uptime</p>
                    <p className="text-base font-bold text-foreground font-mono mt-0.5">
                      {Math.floor(telemetryData.uptimeSeconds / 3600)}h {Math.floor((telemetryData.uptimeSeconds % 3600) / 60)}m
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Active daemon</p>
                  </div>
                  <div className="p-3.5 rounded-lg border border-border bg-muted/20">
                    <p className="text-[11px] text-muted-foreground uppercase font-mono">Memory Footprint</p>
                    <p className="text-base font-bold text-foreground font-mono mt-0.5">{telemetryData.memoryUsageMb.heapUsed} MB</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Heap: {telemetryData.memoryUsageMb.heapTotal} MB | RSS: {telemetryData.memoryUsageMb.rss} MB</p>
                  </div>
                </div>
              )}

              {/* Developer Sandbox Controls */}
              <div className="p-4 rounded-xl border border-border bg-muted/10 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-primary" />
                  <span>Developer Diagnostics & Sandbox Controls</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-lg border border-border/70 bg-card space-y-2">
                    <p className="text-xs font-semibold">Purge Query Client Cache</p>
                    <p className="text-[11px] text-muted-foreground">
                      Clears all cached TanStack queries and forces clean data refetches across all connected sessions.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        queryClient.clear()
                        toast.success('QueryClient cache cleared successfully')
                      }}
                      className="text-xs h-8"
                    >
                      Purge Cache Now
                    </Button>
                  </div>

                  <div className="p-3.5 rounded-lg border border-border/70 bg-card space-y-2">
                    <p className="text-xs font-semibold">Direct Store Admin Navigation</p>
                    <p className="text-[11px] text-muted-foreground">
                      Switch context directly into the store manager interface to inspect live order streams and staff views.
                    </p>
                    <Button
                      size="sm"
                      variant="secondary"
                      asChild
                      className="text-xs h-8"
                    >
                      <Link to="/admin/orders">
                        Open Store Operations (/admin)
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Database Entities Summary */}
              <div className="p-4 rounded-xl border border-border bg-muted/10 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-primary" />
                  <span>Database Entities Quick Manifest</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-center">
                  <div className="p-2.5 rounded-lg border border-border bg-card">
                    <p className="text-xs text-muted-foreground">Customers</p>
                    <p className="text-sm font-bold font-mono mt-0.5">{overview?.totalCustomers ?? 0}</p>
                  </div>
                  <div className="p-2.5 rounded-lg border border-border bg-card">
                    <p className="text-xs text-muted-foreground">Dealers</p>
                    <p className="text-sm font-bold font-mono mt-0.5">{overview?.totalDealers ?? 0}</p>
                  </div>
                  <div className="p-2.5 rounded-lg border border-border bg-card">
                    <p className="text-xs text-muted-foreground">Riders</p>
                    <p className="text-sm font-bold font-mono mt-0.5">{overview?.totalRiders ?? 0}</p>
                  </div>
                  <div className="p-2.5 rounded-lg border border-border bg-card">
                    <p className="text-xs text-muted-foreground">Products</p>
                    <p className="text-sm font-bold font-mono mt-0.5">{overview?.totalProducts ?? 0}</p>
                  </div>
                  <div className="p-2.5 rounded-lg border border-border bg-card">
                    <p className="text-xs text-muted-foreground">SKU Variants</p>
                    <p className="text-sm font-bold font-mono mt-0.5">{overview?.totalVariants ?? 0}</p>
                  </div>
                  <div className="p-2.5 rounded-lg border border-border bg-card">
                    <p className="text-xs text-muted-foreground">Total Users</p>
                    <p className="text-sm font-bold font-mono mt-0.5">{usersData?.length ?? 0}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Ban / Suspension Confirmation Dialog */}
      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-rose-500">
              <ShieldAlert className="h-4 w-4" />
              <span>Suspend / Ban User Account</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Suspending <strong className="text-foreground">{targetUser?.name || targetUser?.email}</strong> will immediately revoke login sessions and prevent cart checkout.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs font-semibold">Reason for Suspension (Audit Log)</Label>
            <Input
              value={banReasonInput}
              onChange={(e) => setBanReasonInput(e.target.value)}
              placeholder="e.g. Chargeback dispute, fake phone number, bad-faith orders..."
              className="text-xs h-9"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setBanDialogOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isUpdatingUser}
              onClick={handleConfirmBan}
              className="text-xs gap-1.5"
            >
              {isUpdatingUser ? <RefreshCw className="h-3 w-3 animate-spin" /> : <UserX className="h-3 w-3" />}
              <span>Confirm Suspension</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
