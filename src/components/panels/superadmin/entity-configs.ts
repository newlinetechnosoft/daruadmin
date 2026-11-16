import {
  Users,
  Wine,
  Store,
  Bike,
  Tags,
  Award,
} from 'lucide-react'
import type { BulkEntityKey, EntityConfig } from './types'

export const ENTITY_CONFIGS: Record<BulkEntityKey, EntityConfig> = {
  customers: {
    key: 'customers',
    label: 'Customers Management',
    singularLabel: 'Customer',
    description: 'Bulk import customer accounts and contact credentials.',
    primaryKeyDesc: 'Upsert matches on email.',
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
    description: 'Manage products and variants with SKU tracking and NPR pricing.',
    primaryKeyDesc: 'Upsert matches on sku. Auto-creates product and category if missing.',
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
    description: 'Wholesale suppliers and distributors with credit limits and VAT credentials.',
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
    description: 'Fleet riders, vehicle specs, zone assignments, and compensation.',
    primaryKeyDesc: 'Upsert matches on email or phone. Auto-links or creates user account with rider role.',
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
    description: 'Taxonomy hierarchy for Liquor and Grocery catalog branches.',
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
    description: 'Manufacturer, distillery, and FMCG brands with origins and brand stories.',
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
