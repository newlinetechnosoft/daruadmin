import { db } from './index'
import {
  liquorCategories,
  liquorBrands,
  liquorProducts,
  liquorVariants,
  liquorImages,
  groceryCategories,
  groceryProducts,
  groceryVariants,
  groceryImages,
  user,
} from './schema'
import { eq } from 'drizzle-orm'
import { toPaisa } from '../lib/money'

export async function seed() {
  console.log('🌱 Starting database seed...')

  // 1. Upgrade Admin Role
  await db
    .update(user)
    .set({ role: 'admin', phone: '+977-9800000000' })
    .where(eq(user.email, 'admin@Mezmani.com.np'))
  console.log('✅ Admin user role verified.')

  // 2. Liquor Categories
  const categoriesData = [
    {
      name: 'Whiskey',
      slug: 'whiskey',
      description:
        'Single malts, blended scotch, and premier domestic whiskies',
      imageUrl:
        'https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=600&q=80',
      sortOrder: 1,
    },
    {
      name: 'Vodka',
      slug: 'vodka',
      description:
        'Smooth triple-distilled vodkas from Nepal and around the globe',
      imageUrl:
        'https://images.unsplash.com/photo-1550985543-f47f38aeee65?auto=format&fit=crop&w=600&q=80',
      sortOrder: 2,
    },
    {
      name: 'Rum',
      slug: 'rum',
      description: 'The iconic Himalayan dark rums and spiced favourites',
      imageUrl:
        'https://images.unsplash.com/photo-1614313511387-1436a4480ebb?auto=format&fit=crop&w=600&q=80',
      sortOrder: 3,
    },
    {
      name: 'Beer & Cider',
      slug: 'beer-cider',
      description:
        'Crisp lagers, craft ales, stouts and ciders chilled for delivery',
      imageUrl:
        'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=600&q=80',
      sortOrder: 4,
    },
    {
      name: 'Wine',
      slug: 'wine',
      description:
        'Red, white, sparkling and fruit wines from renowned vineyards',
      imageUrl:
        'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=600&q=80',
      sortOrder: 5,
    },
    {
      name: 'Gin & Tequila',
      slug: 'gin-tequila',
      description: 'Botanical gins and premium agave spirits for cocktails',
      imageUrl:
        'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=600&q=80',
      sortOrder: 6,
    },
    {
      name: 'Liqueurs',
      slug: 'liqueurs',
      description: 'Herbal digestifs, cream liqueurs and party shots',
      imageUrl:
        'https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?auto=format&fit=crop&w=600&q=80',
      sortOrder: 7,
    },
  ]

  for (const cat of categoriesData) {
    await db
      .insert(liquorCategories)
      .values(cat)
      .onConflictDoUpdate({
        target: liquorCategories.slug,
        set: {
          name: cat.name,
          description: cat.description,
          imageUrl: cat.imageUrl,
          sortOrder: cat.sortOrder,
        },
      })
  }

  const allCategories = await db.select().from(liquorCategories)
  const catMap = Object.fromEntries(allCategories.map((c) => [c.slug, c.id]))

  // 3. Liquor Brands
  const brandsData = [
    {
      name: 'Old Durbar',
      slug: 'old-durbar',
      origin: 'Nepal',
      description: 'Nepal’s premier blended reserve whiskey',
    },
    {
      name: 'Khukri',
      slug: 'khukri',
      origin: 'Nepal',
      description: 'Legendary Coronation and XXX dark rum since 1959',
    },
    {
      name: '8848',
      slug: '8848',
      origin: 'Nepal',
      description: 'Crafted with pure Himalayan spring water',
    },
    {
      name: 'Ruslan',
      slug: 'ruslan',
      origin: 'Nepal',
      description: 'Original 100% pure grain vodka of Nepal',
    },
    {
      name: 'Barahsinghe',
      slug: 'barahsinghe',
      origin: 'Nepal',
      description: 'Nepal’s flagship craft pilsner and pilsner beers',
    },
    {
      name: 'Tuborg',
      slug: 'tuborg',
      origin: 'Denmark / Nepal',
      description: 'Nepal’s top-selling international lager',
    },
    {
      name: 'Carlsberg',
      slug: 'carlsberg',
      origin: 'Denmark / Nepal',
      description: 'Probably the best beer in the world',
    },
    {
      name: 'Gorkha',
      slug: 'gorkha',
      origin: 'Nepal',
      description: 'Brewed for the brave, authentic Himalayan brew',
    },
    {
      name: 'Somersby',
      slug: 'somersby',
      origin: 'Denmark / Nepal',
      description: 'Sparkling apple cider with juicy sweetness',
    },
    {
      name: 'Corona',
      slug: 'corona',
      origin: 'Mexico',
      description: 'World-famous refreshing Mexican pilsner',
    },
    {
      name: 'Heineken',
      slug: 'heineken',
      origin: 'Netherlands',
      description: 'Pure malt premium European lager',
    },
    {
      name: 'Johnnie Walker',
      slug: 'johnnie-walker',
      origin: 'Scotland',
      description: 'World-renowned blended scotch whisky',
    },
    {
      name: 'Jack Daniel’s',
      slug: 'jack-daniels',
      origin: 'USA',
      description: 'Tennessee sour mash whiskey',
    },
    {
      name: 'Chivas Regal',
      slug: 'chivas-regal',
      origin: 'Scotland',
      description: 'Rich and smooth 12YO blended scotch',
    },
    {
      name: 'Glenfiddich',
      slug: 'glenfiddich',
      origin: 'Scotland',
      description: 'The world’s most awarded single malt scotch whisky',
    },
    {
      name: 'Jameson',
      slug: 'jameson',
      origin: 'Ireland',
      description: 'Triple-distilled, twice as smooth Irish whiskey',
    },
    {
      name: 'Absolut',
      slug: 'absolut',
      origin: 'Sweden',
      description: 'Iconic Swedish winter wheat vodka',
    },
    {
      name: 'Grey Goose',
      slug: 'grey-goose',
      origin: 'France',
      description: 'Ultra-premium French wheat vodka',
    },
    {
      name: 'Snowman',
      slug: 'snowman',
      origin: 'Nepal',
      description: 'Distilled dry gin with Himalayan juniper',
    },
    {
      name: 'Hapusa',
      slug: 'hapusa',
      origin: 'Himalayas',
      description: 'Wild Himalayan juniper craft gin',
    },
    {
      name: 'Bombay Sapphire',
      slug: 'bombay-sapphire',
      origin: 'UK',
      description: 'Ten vapour-infused exotic botanical gin',
    },
    {
      name: 'Tanqueray',
      slug: 'tanqueray',
      origin: 'UK',
      description: 'Perfect balance of four timeless botanicals',
    },
    {
      name: 'Jose Cuervo',
      slug: 'jose-cuervo',
      origin: 'Mexico',
      description: 'Number 1 selling tequila in the world',
    },
    {
      name: 'Big Master',
      slug: 'big-master',
      origin: 'Nepal',
      description: 'Domestic reserve red & white wines',
    },
    {
      name: 'Hinwa',
      slug: 'hinwa',
      origin: 'Nepal',
      description: 'Unique wild Himalayan fruit and berry wines',
    },
    {
      name: 'Jacob’s Creek',
      slug: 'jacobs-creek',
      origin: 'Australia',
      description: 'Australia’s premier heritage vineyard wines',
    },
    {
      name: 'Jägermeister',
      slug: 'jagermeister',
      origin: 'Germany',
      description: 'Legendary 56 botanicals German herbal liqueur',
    },
    {
      name: 'Baileys',
      slug: 'baileys',
      origin: 'Ireland',
      description: 'Original Irish cream liqueur',
    },
    {
      name: 'Signature',
      slug: 'signature',
      origin: 'India / Nepal',
      description: 'Rare grain and imported scotch blend',
    },
    {
      name: 'Royal Stag',
      slug: 'royal-stag',
      origin: 'India / Nepal',
      description: 'Seagram’s premier blend of imported scotch and grain',
    },
    {
      name: 'Old Monk',
      slug: 'old-monk',
      origin: 'India',
      description: 'Legendary 7-year aged vatted dark rum',
    },
    {
      name: 'Bacardi',
      slug: 'bacardi',
      origin: 'Cuba / Puerto Rico',
      description: 'Superior white rum for mojitos and cocktails',
    },
  ]

  for (const b of brandsData) {
    await db
      .insert(liquorBrands)
      .values(b)
      .onConflictDoUpdate({
        target: liquorBrands.slug,
        set: {
          name: b.name,
          origin: b.origin,
          description: b.description,
        },
      })
  }

  const allBrands = await db.select().from(liquorBrands)
  const brandMap = Object.fromEntries(allBrands.map((b) => [b.slug, b.id]))

  // 4. Liquor Products
  const products = [
    // Whiskeys
    {
      name: 'Old Durbar Black Chimney',
      slug: 'old-durbar-black-chimney',
      categoryId: catMap['whiskey'],
      brandId: brandMap['old-durbar'],
      description:
        'Smoky, peat-infused reserve whiskey blended with English malt and matured in charred oak casks.',
      isFeatured: true,
      image:
        'https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=700&q=80',
      variants: [
        {
          name: '750 ml',
          volumeMl: 750,
          sku: 'OD-BC-750',
          price: toPaisa(3250),
          mrp: toPaisa(3400),
          abv: '42.8',
          stock: 45,
        },
        {
          name: '375 ml',
          volumeMl: 375,
          sku: 'OD-BC-375',
          price: toPaisa(1680),
          mrp: toPaisa(1750),
          abv: '42.8',
          stock: 30,
        },
      ],
    },
    {
      name: 'Old Durbar 12 Years Old Reserve',
      slug: 'old-durbar-12-years-old',
      categoryId: catMap['whiskey'],
      brandId: brandMap['old-durbar'],
      description:
        'Master-blended whiskey aged for 12 years in select bourbon barrels. Rich vanilla, caramel, and velvety oak.',
      isFeatured: true,
      image:
        'https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?auto=format&fit=crop&w=700&q=80',
      variants: [
        {
          name: '750 ml',
          volumeMl: 750,
          sku: 'OD-12YO-750',
          price: toPaisa(4800),
          mrp: toPaisa(5100),
          abv: '42.8',
          stock: 25,
        },
        {
          name: '375 ml',
          volumeMl: 375,
          sku: 'OD-12YO-375',
          price: toPaisa(2450),
          mrp: toPaisa(2600),
          abv: '42.8',
          stock: 20,
        },
      ],
    },
    {
      name: 'Johnnie Walker Black Label 12YO',
      slug: 'johnnie-walker-black-label-12yo',
      categoryId: catMap['whiskey'],
      brandId: brandMap['johnnie-walker'],
      description:
        'An iconic blend of over 30 malt and grain whiskies from Scotland, aged at least 12 years.',
      isFeatured: true,
      image:
        'https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?auto=format&fit=crop&w=700&q=80',
      variants: [
        {
          name: '1 Litre',
          volumeMl: 1000,
          sku: 'JW-BLK-1000',
          price: toPaisa(7600),
          mrp: toPaisa(8000),
          abv: '40.0',
          stock: 25,
        },
        {
          name: '750 ml',
          volumeMl: 750,
          sku: 'JW-BLK-750',
          price: toPaisa(5950),
          mrp: toPaisa(6300),
          abv: '40.0',
          stock: 35,
        },
      ],
    },
    {
      name: 'Johnnie Walker Red Label',
      slug: 'johnnie-walker-red-label',
      categoryId: catMap['whiskey'],
      brandId: brandMap['johnnie-walker'],
      description:
        'The world’s best-selling blended scotch whisky. Bold, vibrant with hints of cinnamon and black pepper.',
      isFeatured: false,
      image:
        'https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=700&q=80',
      variants: [
        {
          name: '1 Litre',
          volumeMl: 1000,
          sku: 'JW-RED-1000',
          price: toPaisa(5100),
          mrp: toPaisa(5400),
          abv: '40.0',
          stock: 30,
        },
        {
          name: '750 ml',
          volumeMl: 750,
          sku: 'JW-RED-750',
          price: toPaisa(3950),
          mrp: toPaisa(4200),
          abv: '40.0',
          stock: 40,
        },
      ],
    },
    {
      name: 'Jack Daniel’s Old No. 7 Tennessee Whiskey',
      slug: 'jack-daniels-old-no-7',
      categoryId: catMap['whiskey'],
      brandId: brandMap['jack-daniels'],
      description:
        'Charcoal mellowed drop by drop through 10 feet of sugar maple charcoal, then matured in handcrafted barrels.',
      isFeatured: true,
      image:
        'https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=700&q=80',
      variants: [
        {
          name: '1 Litre',
          volumeMl: 1000,
          sku: 'JD-NO7-1000',
          price: toPaisa(6900),
          mrp: toPaisa(7300),
          abv: '40.0',
          stock: 20,
        },
        {
          name: '750 ml',
          volumeMl: 750,
          sku: 'JD-NO7-750',
          price: toPaisa(5400),
          mrp: toPaisa(5750),
          abv: '40.0',
          stock: 35,
        },
      ],
    },
    {
      name: 'Chivas Regal 12 Years Old Blended Scotch',
      slug: 'chivas-regal-12-years-old',
      categoryId: catMap['whiskey'],
      brandId: brandMap['chivas-regal'],
      description:
        'A round and creamy palate with rich honey, ripe apples, vanilla, and butterscotch taste.',
      isFeatured: true,
      image:
        'https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?auto=format&fit=crop&w=700&q=80',
      variants: [
        {
          name: '1 Litre',
          volumeMl: 1000,
          sku: 'CHIVAS-12-1000',
          price: toPaisa(7400),
          mrp: toPaisa(7800),
          abv: '40.0',
          stock: 20,
        },
        {
          name: '750 ml',
          volumeMl: 750,
          sku: 'CHIVAS-12-750',
          price: toPaisa(5800),
          mrp: toPaisa(6200),
          abv: '40.0',
          stock: 30,
        },
      ],
    },
    {
      name: 'Glenfiddich 12 Year Old Single Malt',
      slug: 'glenfiddich-12-year-old',
      categoryId: catMap['whiskey'],
      brandId: brandMap['glenfiddich'],
      description:
        'Flowing in the Valley of the Deer since 1887. Distinctive fresh pear fragrance and subtle oak notes.',
      isFeatured: true,
      image:
        'https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=700&q=80',
      variants: [
        {
          name: '750 ml',
          volumeMl: 750,
          sku: 'GLEN-12-750',
          price: toPaisa(8900),
          mrp: toPaisa(9400),
          abv: '40.0',
          stock: 15,
        },
      ],
    },
    {
      name: 'Jameson Irish Whiskey',
      slug: 'jameson-irish-whiskey',
      categoryId: catMap['whiskey'],
      brandId: brandMap['jameson'],
      description:
        'Triple distilled blended Irish whiskey. Smooth, balanced, floral fragrance with sweet woody notes.',
      isFeatured: false,
      image:
        'https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?auto=format&fit=crop&w=700&q=80',
      variants: [
        {
          name: '1 Litre',
          volumeMl: 1000,
          sku: 'JAM-1000',
          price: toPaisa(5800),
          mrp: toPaisa(6100),
          abv: '40.0',
          stock: 22,
        },
        {
          name: '750 ml',
          volumeMl: 750,
          sku: 'JAM-750',
          price: toPaisa(4500),
          mrp: toPaisa(4800),
          abv: '40.0',
          stock: 30,
        },
      ],
    },
    {
      name: 'Signature Premier Rare Grain Whiskey',
      slug: 'signature-premier-rare-grain',
      categoryId: catMap['whiskey'],
      brandId: brandMap['signature'],
      description:
        'Finely crafted with 8-year aged Scotch malts and superior neutral Indian grain spirits.',
      isFeatured: false,
      image:
        'https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=700&q=80',
      variants: [
        {
          name: '750 ml',
          volumeMl: 750,
          sku: 'SIG-750',
          price: toPaisa(2450),
          mrp: toPaisa(2600),
          abv: '42.8',
          stock: 50,
        },
        {
          name: '375 ml',
          volumeMl: 375,
          sku: 'SIG-375',
          price: toPaisa(1250),
          mrp: toPaisa(1350),
          abv: '42.8',
          stock: 40,
        },
      ],
    },
    {
      name: 'Royal Stag Premier Special Blend',
      slug: 'royal-stag-premier-special-blend',
      categoryId: catMap['whiskey'],
      brandId: brandMap['royal-stag'],
      description:
        'Seagram’s iconic blend of imported Scottish malt and selected grain spirits with no artificial flavours.',
      isFeatured: false,
      image:
        'https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=700&q=80',
      variants: [
        {
          name: '750 ml',
          volumeMl: 750,
          sku: 'RS-750',
          price: toPaisa(1950),
          mrp: toPaisa(2100),
          abv: '42.8',
          stock: 65,
        },
        {
          name: '375 ml',
          volumeMl: 375,
          sku: 'RS-375',
          price: toPaisa(1020),
          mrp: toPaisa(1100),
          abv: '42.8',
          stock: 45,
        },
      ],
    },

    // Rums
    {
      name: 'Khukri XXX Coronation Dark Rum',
      slug: 'khukri-xxx-coronation-dark-rum',
      categoryId: catMap['rum'],
      brandId: brandMap['khukri'],
      description:
        'Aged in oak vats high in the Himalayas. Rich molasses, dried fruits, sweet spice and caramel notes.',
      isFeatured: true,
      image:
        'https://images.unsplash.com/photo-1614313511387-1436a4480ebb?auto=format&fit=crop&w=700&q=80',
      variants: [
        {
          name: '750 ml',
          volumeMl: 750,
          sku: 'KHU-CR-750',
          price: toPaisa(2100),
          mrp: toPaisa(2250),
          abv: '42.8',
          stock: 60,
        },
        {
          name: '375 ml',
          volumeMl: 375,
          sku: 'KHU-CR-375',
          price: toPaisa(1100),
          mrp: toPaisa(1180),
          abv: '42.8',
          stock: 40,
        },
        {
          name: '180 ml',
          volumeMl: 180,
          sku: 'KHU-CR-180',
          price: toPaisa(580),
          mrp: toPaisa(620),
          abv: '42.8',
          stock: 80,
        },
      ],
    },
    {
      name: 'Khukri Spiced Himalayan Rum',
      slug: 'khukri-spiced-himalayan-rum',
      categoryId: catMap['rum'],
      brandId: brandMap['khukri'],
      description:
        'Infused with authentic hand-picked Himalayan herbs and aromatic spices, clove, cinnamon and wild honey.',
      isFeatured: true,
      image:
        'https://images.unsplash.com/photo-1614313511387-1436a4480ebb?auto=format&fit=crop&w=700&q=80',
      variants: [
        {
          name: '750 ml',
          volumeMl: 750,
          sku: 'KHU-SP-750',
          price: toPaisa(2250),
          mrp: toPaisa(2400),
          abv: '42.8',
          stock: 35,
        },
        {
          name: '375 ml',
          volumeMl: 375,
          sku: 'KHU-SP-375',
          price: toPaisa(1180),
          mrp: toPaisa(1250),
          abv: '42.8',
          stock: 30,
        },
      ],
    },
    {
      name: 'Old Monk 7 Years Blended Dark Rum',
      slug: 'old-monk-7-years-dark-rum',
      categoryId: catMap['rum'],
      brandId: brandMap['old-monk'],
      description:
        'Legendary dark rum with distinct vanilla, dark chocolate and caramel undertones, aged 7 years in oak casks.',
      isFeatured: false,
      image:
        'https://images.unsplash.com/photo-1614313511387-1436a4480ebb?auto=format&fit=crop&w=700&q=80',
      variants: [
        {
          name: '750 ml',
          volumeMl: 750,
          sku: 'OM-750',
          price: toPaisa(2050),
          mrp: toPaisa(2200),
          abv: '42.8',
          stock: 55,
        },
        {
          name: '375 ml',
          volumeMl: 375,
          sku: 'OM-375',
          price: toPaisa(1080),
          mrp: toPaisa(1150),
          abv: '42.8',
          stock: 40,
        },
      ],
    },
    {
      name: 'Bacardi Carta Blanca Superior White Rum',
      slug: 'bacardi-carta-blanca-white-rum',
      categoryId: catMap['rum'],
      brandId: brandMap['bacardi'],
      description:
        'Light, aromatic white rum aged in white oak barrels and filtered through charcoal for incredible cocktail balance.',
      isFeatured: false,
      image:
        'https://images.unsplash.com/photo-1614313511387-1436a4480ebb?auto=format&fit=crop&w=700&q=80',
      variants: [
        {
          name: '750 ml',
          volumeMl: 750,
          sku: 'BAC-CB-750',
          price: toPaisa(3650),
          mrp: toPaisa(3900),
          abv: '40.0',
          stock: 25,
        },
      ],
    },

    // Vodkas
    {
      name: '8848 Himalayan Vodka',
      slug: '8848-himalayan-vodka',
      categoryId: catMap['vodka'],
      brandId: brandMap['8848'],
      description:
        'Charcoal-filtered, ultra-smooth premium vodka made from grains and glacial water.',
      isFeatured: true,
      image:
        'https://images.unsplash.com/photo-1550985543-f47f38aeee65?auto=format&fit=crop&w=700&q=80',
      variants: [
        {
          name: '750 ml',
          volumeMl: 750,
          sku: '8848-VOD-750',
          price: toPaisa(2350),
          mrp: toPaisa(2500),
          abv: '40.0',
          stock: 50,
        },
        {
          name: '375 ml',
          volumeMl: 375,
          sku: '8848-VOD-375',
          price: toPaisa(1200),
          mrp: toPaisa(1280),
          abv: '40.0',
          stock: 35,
        },
      ],
    },
    {
      name: '8848 Rye Crafted Vodka',
      slug: '8848-rye-crafted-vodka',
      categoryId: catMap['vodka'],
      brandId: brandMap['8848'],
      description:
        'Crafted from selected Polish rye and distilled five times, delivering a crisp, clean peppery finish.',
      isFeatured: false,
      image:
        'https://images.unsplash.com/photo-1550985543-f47f38aeee65?auto=format&fit=crop&w=700&q=80',
      variants: [
        {
          name: '750 ml',
          volumeMl: 750,
          sku: '8848-RYE-750',
          price: toPaisa(2650),
          mrp: toPaisa(2850),
          abv: '40.0',
          stock: 30,
        },
      ],
    },
    {
      name: 'Ruslan Ultra Premium Vodka',
      slug: 'ruslan-ultra-premium-vodka',
      categoryId: catMap['vodka'],
      brandId: brandMap['ruslan'],
      description:
        'Nepal’s original 100% pure grain spirit, multi-column distilled and cold filtered.',
      isFeatured: false,
      image:
        'https://images.unsplash.com/photo-1550985543-f47f38aeee65?auto=format&fit=crop&w=700&q=80',
      variants: [
        {
          name: '750 ml',
          volumeMl: 750,
          sku: 'RUS-750',
          price: toPaisa(2150),
          mrp: toPaisa(2300),
          abv: '40.0',
          stock: 55,
        },
        {
          name: '375 ml',
          volumeMl: 375,
          sku: 'RUS-375',
          price: toPaisa(1120),
          mrp: toPaisa(1190),
          abv: '40.0',
          stock: 45,
        },
      ],
    },
    {
      name: 'Absolut Vodka Original',
      slug: 'absolut-vodka-original',
      categoryId: catMap['vodka'],
      brandId: brandMap['absolut'],
      description:
        'Produced in Åhus, Sweden using winter wheat and deep well water with continuous distillation.',
      isFeatured: true,
      image:
        'https://images.unsplash.com/photo-1550985543-f47f38aeee65?auto=format&fit=crop&w=700&q=80',
      variants: [
        {
          name: '1 Litre',
          volumeMl: 1000,
          sku: 'ABS-1000',
          price: toPaisa(4800),
          mrp: toPaisa(5100),
          abv: '40.0',
          stock: 25,
        },
        {
          name: '750 ml',
          volumeMl: 750,
          sku: 'ABS-750',
          price: toPaisa(3850),
          mrp: toPaisa(4100),
          abv: '40.0',
          stock: 35,
        },
      ],
    },
    {
      name: 'Grey Goose Premium French Vodka',
      slug: 'grey-goose-premium-vodka',
      categoryId: catMap['vodka'],
      brandId: brandMap['grey-goose'],
      description:
        'Created in Picardy, France from soft winter wheat and natural spring water from Gensac-la-Pallue.',
      isFeatured: true,
      image:
        'https://images.unsplash.com/photo-1550985543-f47f38aeee65?auto=format&fit=crop&w=700&q=80',
      variants: [
        {
          name: '750 ml',
          volumeMl: 750,
          sku: 'GG-750',
          price: toPaisa(7200),
          mrp: toPaisa(7600),
          abv: '40.0',
          stock: 15,
        },
      ],
    },

    // Beers & Ciders
    {
      name: 'Barahsinghe Craft Pilsner',
      slug: 'barahsinghe-craft-pilsner',
      categoryId: catMap['beer-cider'],
      brandId: brandMap['barahsinghe'],
      description:
        'Brewed with imported German malts and noble hops according to the Bavarian Purity Law.',
      isFeatured: true,
      image:
        'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=700&q=80',
      variants: [
        {
          name: '650 ml Bottle',
          volumeMl: 650,
          sku: 'BAR-PIL-650',
          price: toPaisa(380),
          mrp: toPaisa(400),
          abv: '5.0',
          stock: 120,
        },
        {
          name: '500 ml Can',
          volumeMl: 500,
          sku: 'BAR-PIL-500',
          price: toPaisa(320),
          mrp: toPaisa(340),
          abv: '5.0',
          stock: 150,
        },
        {
          name: 'Pack of 6 (500 ml Cans)',
          volumeMl: 3000,
          sku: 'BAR-PIL-6PK',
          price: toPaisa(1860),
          mrp: toPaisa(2000),
          abv: '5.0',
          stock: 40,
        },
      ],
    },
    {
      name: 'Barahsinghe Hazy IPA Craft Beer',
      slug: 'barahsinghe-hazy-ipa',
      categoryId: catMap['beer-cider'],
      brandId: brandMap['barahsinghe'],
      description:
        'Juicy, unfiltered IPA packed with tropical citrus hops aroma and a creamy, hazy mouthfeel.',
      isFeatured: true,
      image:
        'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=700&q=80',
      variants: [
        {
          name: '500 ml Can',
          volumeMl: 500,
          sku: 'BAR-IPA-500',
          price: toPaisa(360),
          mrp: toPaisa(390),
          abv: '5.5',
          stock: 80,
        },
        {
          name: 'Pack of 6 (500 ml Cans)',
          volumeMl: 3000,
          sku: 'BAR-IPA-6PK',
          price: toPaisa(2100),
          mrp: toPaisa(2300),
          abv: '5.5',
          stock: 30,
        },
      ],
    },
    {
      name: 'Tuborg Premium Green Can',
      slug: 'tuborg-premium-green-can',
      categoryId: catMap['beer-cider'],
      brandId: brandMap['tuborg'],
      description:
        'The open-for-more crisp Danish pilsner, freshly brewed and delivered chilled.',
      isFeatured: true,
      image:
        'https://images.unsplash.com/photo-1567696911980-2eed69a46042?auto=format&fit=crop&w=700&q=80',
      variants: [
        {
          name: '500 ml Can (Pack of 1)',
          volumeMl: 500,
          sku: 'TUB-CAN-500',
          price: toPaisa(330),
          mrp: toPaisa(350),
          abv: '5.0',
          stock: 200,
        },
        {
          name: '650 ml Bottle',
          volumeMl: 650,
          sku: 'TUB-BOT-650',
          price: toPaisa(390),
          mrp: toPaisa(410),
          abv: '5.0',
          stock: 140,
        },
        {
          name: 'Pack of 6 (500 ml)',
          volumeMl: 3000,
          sku: 'TUB-CAN-6PK',
          price: toPaisa(1950),
          mrp: toPaisa(2100),
          abv: '5.0',
          stock: 40,
        },
      ],
    },
    {
      name: 'Carlsberg Danish Pilsner',
      slug: 'carlsberg-danish-pilsner',
      categoryId: catMap['beer-cider'],
      brandId: brandMap['carlsberg'],
      description:
        'Crisp, well-balanced premium Danish lager with sweet malt taste and gentle hop bitterness.',
      isFeatured: false,
      image:
        'https://images.unsplash.com/photo-1567696911980-2eed69a46042?auto=format&fit=crop&w=700&q=80',
      variants: [
        {
          name: '500 ml Can',
          volumeMl: 500,
          sku: 'CARL-500',
          price: toPaisa(370),
          mrp: toPaisa(400),
          abv: '5.0',
          stock: 90,
        },
        {
          name: '650 ml Bottle',
          volumeMl: 650,
          sku: 'CARL-650',
          price: toPaisa(430),
          mrp: toPaisa(460),
          abv: '5.0',
          stock: 75,
        },
      ],
    },
    {
      name: 'Gorkha Strong Premium Beer',
      slug: 'gorkha-strong-beer',
      categoryId: catMap['beer-cider'],
      brandId: brandMap['gorkha'],
      description:
        'Brewed for the brave. Rich, full-bodied bold Himalayan lager with a crisp kick.',
      isFeatured: false,
      image:
        'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=700&q=80',
      variants: [
        {
          name: '650 ml Bottle',
          volumeMl: 650,
          sku: 'GOR-650',
          price: toPaisa(360),
          mrp: toPaisa(380),
          abv: '6.0',
          stock: 80,
        },
      ],
    },
    {
      name: 'Somersby Sparkling Apple Cider',
      slug: 'somersby-sparkling-apple-cider',
      categoryId: catMap['beer-cider'],
      brandId: brandMap['somersby'],
      description:
        'Naturally refreshing fermented apple juice with pleasant sweetness and bubbly crisp finish.',
      isFeatured: true,
      image:
        'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=700&q=80',
      variants: [
        {
          name: '330 ml Bottle',
          volumeMl: 330,
          sku: 'SOM-BOT-330',
          price: toPaisa(240),
          mrp: toPaisa(260),
          abv: '4.5',
          stock: 95,
        },
        {
          name: 'Pack of 4 (330 ml)',
          volumeMl: 1320,
          sku: 'SOM-4PK-330',
          price: toPaisa(920),
          mrp: toPaisa(1000),
          abv: '4.5',
          stock: 30,
        },
      ],
    },
    {
      name: 'Corona Extra Mexican Beer',
      slug: 'corona-extra-mexican-beer',
      categoryId: catMap['beer-cider'],
      brandId: brandMap['corona'],
      description:
        'Classic Mexican pale lager served best ice-cold with a wedge of fresh lime.',
      isFeatured: true,
      image:
        'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=700&q=80',
      variants: [
        {
          name: '355 ml Bottle',
          volumeMl: 355,
          sku: 'COR-355',
          price: toPaisa(460),
          mrp: toPaisa(490),
          abv: '4.5',
          stock: 70,
        },
        {
          name: 'Pack of 6 (355 ml)',
          volumeMl: 2130,
          sku: 'COR-6PK',
          price: toPaisa(2700),
          mrp: toPaisa(2900),
          abv: '4.5',
          stock: 25,
        },
      ],
    },

    // Gins & Tequilas
    {
      name: 'Snowman Himalayan Distilled Gin',
      slug: 'snowman-himalayan-gin',
      categoryId: catMap['gin-tequila'],
      brandId: brandMap['snowman'],
      description:
        'Artisanal handcrafted gin infused with wild juniper berries and selected Himalayan citrus peels.',
      isFeatured: true,
      image:
        'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=700&q=80',
      variants: [
        {
          name: '750 ml',
          volumeMl: 750,
          sku: 'SNOW-GIN-750',
          price: toPaisa(2400),
          mrp: toPaisa(2550),
          abv: '40.0',
          stock: 35,
        },
      ],
    },
    {
      name: 'Hapusa Himalayan Dry Gin',
      slug: 'hapusa-himalayan-dry-gin',
      categoryId: catMap['gin-tequila'],
      brandId: brandMap['hapusa'],
      description:
        'Small-batch copper pot distilled with raw Himalayan juniper berries, turmeric, mango, and gondhoraj lime.',
      isFeatured: true,
      image:
        'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=700&q=80',
      variants: [
        {
          name: '700 ml',
          volumeMl: 700,
          sku: 'HAP-700',
          price: toPaisa(6200),
          mrp: toPaisa(6600),
          abv: '43.0',
          stock: 20,
        },
      ],
    },
    {
      name: 'Bombay Sapphire London Dry Gin',
      slug: 'bombay-sapphire-london-dry-gin',
      categoryId: catMap['gin-tequila'],
      brandId: brandMap['bombay-sapphire'],
      description:
        'World famous vapour-infused gin with 10 precious botanicals giving bright citrus and clean juniper freshness.',
      isFeatured: true,
      image:
        'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=700&q=80',
      variants: [
        {
          name: '750 ml',
          volumeMl: 750,
          sku: 'BOMB-750',
          price: toPaisa(5200),
          mrp: toPaisa(5500),
          abv: '47.0',
          stock: 30,
        },
      ],
    },
    {
      name: 'Jose Cuervo Especial Reposado Tequila',
      slug: 'jose-cuervo-especial-reposado',
      categoryId: catMap['gin-tequila'],
      brandId: brandMap['jose-cuervo'],
      description:
        'Golden tequila rested in oak barrels, boasting warm cooked agave notes with hints of vanilla and spice.',
      isFeatured: false,
      image:
        'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=700&q=80',
      variants: [
        {
          name: '750 ml',
          volumeMl: 750,
          sku: 'JC-REP-750',
          price: toPaisa(5600),
          mrp: toPaisa(5950),
          abv: '38.0',
          stock: 22,
        },
      ],
    },

    // Wines & Liqueurs
    {
      name: 'Big Master Reserve Red Wine',
      slug: 'big-master-reserve-red-wine',
      categoryId: catMap['wine'],
      brandId: brandMap['big-master'],
      description:
        'Smooth Nepali reserve dry red wine with ripe black cherry fruit flavours and gentle tannins.',
      isFeatured: true,
      image:
        'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=700&q=80',
      variants: [
        {
          name: '750 ml',
          volumeMl: 750,
          sku: 'BM-RED-750',
          price: toPaisa(1250),
          mrp: toPaisa(1350),
          abv: '12.0',
          stock: 45,
        },
      ],
    },
    {
      name: 'Hinwa Wild Fruit Wine',
      slug: 'hinwa-wild-fruit-wine',
      categoryId: catMap['wine'],
      brandId: brandMap['hinwa'],
      description:
        'Original wild Himalayan berry and fruit wine from Eastern Nepal. Tart, sweet and fruity aroma.',
      isFeatured: false,
      image:
        'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=700&q=80',
      variants: [
        {
          name: '750 ml',
          volumeMl: 750,
          sku: 'HIN-750',
          price: toPaisa(980),
          mrp: toPaisa(1050),
          abv: '11.5',
          stock: 50,
        },
      ],
    },
    {
      name: 'Jacob’s Creek Shiraz Cabernet',
      slug: 'jacobs-creek-shiraz-cabernet',
      categoryId: catMap['wine'],
      brandId: brandMap['jacobs-creek'],
      description:
        'Classic Australian medium-bodied red wine displaying spicy blackberry flavours and structured oak.',
      isFeatured: true,
      image:
        'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=700&q=80',
      variants: [
        {
          name: '750 ml',
          volumeMl: 750,
          sku: 'JC-SHIRAZ-750',
          price: toPaisa(2850),
          mrp: toPaisa(3050),
          abv: '13.5',
          stock: 35,
        },
      ],
    },
    {
      name: 'Jägermeister Herbal Liqueur',
      slug: 'jagermeister-herbal-liqueur',
      categoryId: catMap['liqueurs'],
      brandId: brandMap['jagermeister'],
      description:
        'Masterful blend of 56 herbs, roots, blossoms and fruits from around the world. Serve ice-cold.',
      isFeatured: true,
      image:
        'https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?auto=format&fit=crop&w=700&q=80',
      variants: [
        {
          name: '700 ml',
          volumeMl: 700,
          sku: 'JAG-700',
          price: toPaisa(4950),
          mrp: toPaisa(5300),
          abv: '35.0',
          stock: 25,
        },
        {
          name: '1 Litre',
          volumeMl: 1000,
          sku: 'JAG-1000',
          price: toPaisa(6400),
          mrp: toPaisa(6800),
          abv: '35.0',
          stock: 18,
        },
      ],
    },
    {
      name: 'Baileys Original Irish Cream',
      slug: 'baileys-original-irish-cream',
      categoryId: catMap['liqueurs'],
      brandId: brandMap['baileys'],
      description:
        'Velvety Irish cream blended with aged Irish whiskey and luxurious chocolate and vanilla flavours.',
      isFeatured: true,
      image:
        'https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?auto=format&fit=crop&w=700&q=80',
      variants: [
        {
          name: '750 ml',
          volumeMl: 750,
          sku: 'BAI-750',
          price: toPaisa(4600),
          mrp: toPaisa(4900),
          abv: '17.0',
          stock: 28,
        },
      ],
    },
  ]

  for (const prod of products) {
    const [insertedProd] = await db
      .insert(liquorProducts)
      .values({
        name: prod.name,
        slug: prod.slug,
        categoryId: prod.categoryId,
        brandId: prod.brandId,
        description: prod.description,
        isFeatured: prod.isFeatured,
      })
      .onConflictDoUpdate({
        target: liquorProducts.slug,
        set: {
          name: prod.name,
          categoryId: prod.categoryId,
          brandId: prod.brandId,
          description: prod.description,
          isFeatured: prod.isFeatured,
        },
      })
      .returning()

    const productId = insertedProd.id
    if (!productId) continue

    await db
      .insert(liquorImages)
      .values({
        productId,
        url: prod.image,
        alt: prod.name,
        isPrimary: true,
      })
      .onConflictDoNothing()

    for (const v of prod.variants) {
      await db
        .insert(liquorVariants)
        .values({
          productId,
          name: v.name,
          volumeMl: v.volumeMl,
          sku: v.sku,
          price: v.price,
          mrp: v.mrp,
          abv: v.abv,
          stock: v.stock,
        })
        .onConflictDoUpdate({
          target: liquorVariants.sku,
          set: {
            name: v.name,
            volumeMl: v.volumeMl,
            price: v.price,
            mrp: v.mrp,
            abv: v.abv,
            stock: v.stock,
          },
        })
    }
  }

  // 5. Grocery & Snack Categories
  const groceryCatsData = [
    {
      name: 'Snacks & Munchies',
      slug: 'snacks-munchies',
      description: 'Potato chips, nuts, spicy peanuts, and midnight crunchies',
      imageUrl:
        'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80',
      sortOrder: 1,
    },
    {
      name: 'Beverages & Mixers',
      slug: 'beverages-mixers',
      description: 'Tonic water, sodas, energy drinks, colas and juices',
      imageUrl:
        'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80',
      sortOrder: 2,
    },
    {
      name: 'Party Essentials & Ice',
      slug: 'party-essentials',
      description:
        'Crystal ice cubes, disposable cups, playing cards and accessories',
      imageUrl:
        'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=600&q=80',
      sortOrder: 3,
    },
    {
      name: 'Late-Night Food & Bites',
      slug: 'late-night-bites',
      description: 'Spicy noodles, snacks and quick late-night bites',
      imageUrl:
        'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80',
      sortOrder: 4,
    },
  ]

  for (const gc of groceryCatsData) {
    await db
      .insert(groceryCategories)
      .values(gc)
      .onConflictDoUpdate({
        target: groceryCategories.slug,
        set: {
          name: gc.name,
          description: gc.description,
          imageUrl: gc.imageUrl,
          sortOrder: gc.sortOrder,
        },
      })
  }

  const allGroceryCats = await db.select().from(groceryCategories)
  const gCatMap = Object.fromEntries(allGroceryCats.map((c) => [c.slug, c.id]))

  // 6. Grocery Products
  const groceryItems = [
    {
      name: 'Crystal Clear Party Ice Bag (3 kg)',
      slug: 'crystal-clear-ice-bag-3kg',
      categoryId: gCatMap['party-essentials'],
      description:
        'Triple-filtered hygienic crystal ice cubes in insulated zip seal bags, delivered chilled.',
      image:
        'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=700&q=80',
      isFeatured: true,
      variants: [
        {
          name: '3 kg Bag',
          unit: 'kg',
          quantity: '3.00',
          sku: 'ICE-3KG',
          price: toPaisa(150),
          mrp: toPaisa(180),
          stock: 80,
        },
      ],
    },
    {
      name: 'Crystal Clear Party Ice Bag (5 kg Jumbo)',
      slug: 'crystal-clear-ice-bag-5kg',
      categoryId: gCatMap['party-essentials'],
      description:
        'Large party-size bag of solid crystal ice cubes for drinks and chilling beer bottles.',
      image:
        'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=700&q=80',
      isFeatured: false,
      variants: [
        {
          name: '5 kg Bag',
          unit: 'kg',
          quantity: '5.00',
          sku: 'ICE-5KG',
          price: toPaisa(240),
          mrp: toPaisa(280),
          stock: 60,
        },
      ],
    },
    {
      name: 'Schweppes Tonic Water (330 ml)',
      slug: 'schweppes-tonic-water-330ml',
      categoryId: gCatMap['beverages-mixers'],
      description:
        'Classic crisp tonic water with quinine, ideal partner for gin and botanical cocktails.',
      image:
        'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=700&q=80',
      isFeatured: true,
      variants: [
        {
          name: 'Can (Pack of 1)',
          unit: 'can',
          quantity: '1.00',
          sku: 'SCH-TONIC-1',
          price: toPaisa(180),
          mrp: toPaisa(200),
          stock: 100,
        },
        {
          name: 'Pack of 6',
          unit: 'pack',
          quantity: '6.00',
          sku: 'SCH-TONIC-6',
          price: toPaisa(1020),
          mrp: toPaisa(1200),
          stock: 30,
        },
      ],
    },
    {
      name: 'Schweppes Club Soda (300 ml)',
      slug: 'schweppes-club-soda-300ml',
      categoryId: gCatMap['beverages-mixers'],
      description:
        'Crisp, highly carbonated pure bubbling club soda for whiskey, vodka, and scotch highballs.',
      image:
        'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=700&q=80',
      isFeatured: true,
      variants: [
        {
          name: 'Can (Pack of 1)',
          unit: 'can',
          quantity: '1.00',
          sku: 'SCH-SODA-1',
          price: toPaisa(80),
          mrp: toPaisa(90),
          stock: 150,
        },
        {
          name: 'Pack of 6',
          unit: 'pack',
          quantity: '6.00',
          sku: 'SCH-SODA-6',
          price: toPaisa(450),
          mrp: toPaisa(500),
          stock: 45,
        },
      ],
    },
    {
      name: 'Red Bull Energy Drink (250 ml)',
      slug: 'red-bull-energy-drink-250ml',
      categoryId: gCatMap['beverages-mixers'],
      description:
        'Vitalizes body and mind. The essential party booster for night owls and cocktail mixing.',
      image:
        'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=700&q=80',
      isFeatured: true,
      variants: [
        {
          name: '250 ml Can',
          unit: 'can',
          quantity: '1.00',
          sku: 'RB-CAN-250',
          price: toPaisa(220),
          mrp: toPaisa(240),
          stock: 90,
        },
        {
          name: 'Pack of 4',
          unit: 'pack',
          quantity: '4.00',
          sku: 'RB-CAN-4PK',
          price: toPaisa(840),
          mrp: toPaisa(920),
          stock: 40,
        },
      ],
    },
    {
      name: 'Coca-Cola Classic Can (330 ml)',
      slug: 'coca-cola-can-330ml',
      categoryId: gCatMap['beverages-mixers'],
      description:
        'Original refreshing taste of Coca-Cola, perfectly paired with dark rums and whiskeys.',
      image:
        'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=700&q=80',
      isFeatured: false,
      variants: [
        {
          name: '330 ml Can',
          unit: 'can',
          quantity: '1.00',
          sku: 'COKE-CAN-330',
          price: toPaisa(90),
          mrp: toPaisa(100),
          stock: 120,
        },
        {
          name: 'Pack of 6',
          unit: 'pack',
          quantity: '6.00',
          sku: 'COKE-CAN-6PK',
          price: toPaisa(510),
          mrp: toPaisa(580),
          stock: 35,
        },
      ],
    },
    {
      name: 'Sprite Lemon-Lime Can (330 ml)',
      slug: 'sprite-can-330ml',
      categoryId: gCatMap['beverages-mixers'],
      description:
        'Crisp, refreshing lemon-lime fizzy soda that cuts thirst and pairs brilliantly with clear spirits.',
      image:
        'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=700&q=80',
      isFeatured: false,
      variants: [
        {
          name: '330 ml Can',
          unit: 'can',
          quantity: '1.00',
          sku: 'SPRITE-CAN-330',
          price: toPaisa(90),
          mrp: toPaisa(100),
          stock: 110,
        },
        {
          name: 'Pack of 6',
          unit: 'pack',
          quantity: '6.00',
          sku: 'SPRITE-CAN-6PK',
          price: toPaisa(510),
          mrp: toPaisa(580),
          stock: 30,
        },
      ],
    },
    {
      name: 'Wai Wai Quick Chicken Noodles',
      slug: 'wai-wai-quick-chicken-noodles',
      categoryId: gCatMap['late-night-bites'],
      description:
        'Nepal’s favourite instant midnight hunger rescue with roasted onions and chicken spice sachet.',
      image:
        'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=700&q=80',
      isFeatured: true,
      variants: [
        {
          name: 'Pack of 5',
          unit: 'pack',
          quantity: '5.00',
          sku: 'WW-CHK-5PK',
          price: toPaisa(150),
          mrp: toPaisa(175),
          stock: 120,
        },
      ],
    },
    {
      name: 'Current Hot & Spicy Instant Noodles',
      slug: 'current-hot-spicy-noodles',
      categoryId: gCatMap['late-night-bites'],
      description:
        'Fiery extra hot red chili soup noodles for the ultimate spicy late-night kick.',
      image:
        'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=700&q=80',
      isFeatured: true,
      variants: [
        {
          name: 'Pack of 5',
          unit: 'pack',
          quantity: '5.00',
          sku: 'CURR-SPICY-5PK',
          price: toPaisa(250),
          mrp: toPaisa(275),
          stock: 90,
        },
      ],
    },
    {
      name: 'Kurkure Masala Munch (95 g)',
      slug: 'kurkure-masala-munch-95g',
      categoryId: gCatMap['snacks-munchies'],
      description:
        'Tedha hai par mera hai! Crispy, crunchy puffed rice & corn curls with authentic Indian spices.',
      image:
        'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=700&q=80',
      isFeatured: true,
      variants: [
        {
          name: '95 g Pouch',
          unit: 'pack',
          quantity: '1.00',
          sku: 'KURK-95',
          price: toPaisa(65),
          mrp: toPaisa(70),
          stock: 120,
        },
      ],
    },
    {
      name: 'Lay’s India’s Magic Masala (78 g)',
      slug: 'lays-magical-masala-78g',
      categoryId: gCatMap['snacks-munchies'],
      description:
        'Thin cut crispy potato chips seasoned with a blend of fiery Indian spices.',
      image:
        'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=700&q=80',
      isFeatured: true,
      variants: [
        {
          name: '78 g Pouch',
          unit: 'pack',
          quantity: '1.00',
          sku: 'LAYS-MAS-78',
          price: toPaisa(75),
          mrp: toPaisa(80),
          stock: 140,
        },
      ],
    },
    {
      name: 'Pringles Sour Cream & Onion (107 g)',
      slug: 'pringles-sour-cream-onion-107g',
      categoryId: gCatMap['snacks-munchies'],
      description:
        'Savory onion flavor blended with creamy sour cream on iconic stackable potato crisps.',
      image:
        'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=700&q=80',
      isFeatured: false,
      variants: [
        {
          name: '107 g Canister',
          unit: 'can',
          quantity: '1.00',
          sku: 'PRING-SC-107',
          price: toPaisa(260),
          mrp: toPaisa(290),
          stock: 65,
        },
      ],
    },
    {
      name: 'Spicy Peri-Peri Roasted Cashews (200 g)',
      slug: 'spicy-peri-peri-cashews-200g',
      categoryId: gCatMap['snacks-munchies'],
      description:
        'Crunchy premium jumbo cashews gently roasted and tossed in exotic peri-peri seasoning.',
      image:
        'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=700&q=80',
      isFeatured: true,
      variants: [
        {
          name: '200 g Jar',
          unit: 'jar',
          quantity: '1.00',
          sku: 'CSH-PERI-200',
          price: toPaisa(550),
          mrp: toPaisa(600),
          stock: 45,
        },
      ],
    },
    {
      name: 'Himalayan Roasted Peanut Sadeko Mix (250 g)',
      slug: 'himalayan-peanut-sadeko-mix-250g',
      categoryId: gCatMap['snacks-munchies'],
      description:
        'Spicy, crunchy roasted Nepali peanuts with chili, roasted garlic, mustard oil and Himalayan pink salt.',
      image:
        'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=700&q=80',
      isFeatured: true,
      variants: [
        {
          name: '250 g Pack',
          unit: 'pack',
          quantity: '1.00',
          sku: 'PNT-SAD-250',
          price: toPaisa(180),
          mrp: toPaisa(210),
          stock: 60,
        },
      ],
    },
    {
      name: 'Party Disposable Cups & Eco Straws Set',
      slug: 'party-cups-and-straws-set',
      categoryId: gCatMap['party-essentials'],
      description:
        'Pack of 50 heavy-duty plastic party cups and 50 biodegradable straws for hassle-free house parties.',
      image:
        'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=700&q=80',
      isFeatured: false,
      variants: [
        {
          name: '50 Pcs Set',
          unit: 'pack',
          quantity: '1.00',
          sku: 'PARTY-CUPS-50',
          price: toPaisa(220),
          mrp: toPaisa(260),
          stock: 75,
        },
      ],
    },
    {
      name: 'Casino Quality Playing Cards Deck',
      slug: 'casino-quality-playing-cards',
      categoryId: gCatMap['party-essentials'],
      description:
        'Plastic-coated water-resistant playing card deck for flush, marriage and poker game nights.',
      image:
        'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=700&q=80',
      isFeatured: false,
      variants: [
        {
          name: '1 Deck',
          unit: 'deck',
          quantity: '1.00',
          sku: 'CARDS-DECK-1',
          price: toPaisa(250),
          mrp: toPaisa(300),
          stock: 50,
        },
      ],
    },
  ]

  for (const item of groceryItems) {
    const [insertedItem] = await db
      .insert(groceryProducts)
      .values({
        name: item.name,
        slug: item.slug,
        categoryId: item.categoryId,
        description: item.description,
        isFeatured: item.isFeatured,
      })
      .onConflictDoUpdate({
        target: groceryProducts.slug,
        set: {
          name: item.name,
          categoryId: item.categoryId,
          description: item.description,
          isFeatured: item.isFeatured,
        },
      })
      .returning()

    const productId = insertedItem.id
    if (!productId) continue

    await db
      .insert(groceryImages)
      .values({
        productId,
        url: item.image,
        alt: item.name,
        isPrimary: true,
      })
      .onConflictDoNothing()

    for (const v of item.variants) {
      await db
        .insert(groceryVariants)
        .values({
          productId,
          name: v.name,
          unit: v.unit,
          quantity: v.quantity,
          sku: v.sku,
          price: v.price,
          mrp: v.mrp,
          stock: v.stock,
        })
        .onConflictDoUpdate({
          target: groceryVariants.sku,
          set: {
            name: v.name,
            unit: v.unit,
            quantity: v.quantity,
            price: v.price,
            mrp: v.mrp,
            stock: v.stock,
          },
        })
    }
  }

  console.log('🎉 Seed completed successfully!')
}

if (import.meta.main) {
  seed()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error('❌ Seed failed:', e)
      process.exit(1)
    })
}
