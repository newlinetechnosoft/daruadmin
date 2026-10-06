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
    .where(eq(user.email, 'admin@daru.com.np'))
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
  ]

  await db
    .insert(liquorCategories)
    .values(categoriesData)
    .onConflictDoNothing({ target: liquorCategories.slug })

  // Map category slugs
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
  ]

  await db
    .insert(liquorBrands)
    .values(brandsData)
    .onConflictDoNothing({ target: liquorBrands.slug })

  const allBrands = await db.select().from(liquorBrands)
  const brandMap = Object.fromEntries(allBrands.map((b) => [b.slug, b.id]))

  // 4. Liquor Products
  const products = [
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
      .onConflictDoNothing({ target: liquorProducts.slug })
      .returning()

    let productId = insertedProd.id
    if (!productId) {
      const existing = await db
        .select({ id: liquorProducts.id })
        .from(liquorProducts)
        .where(eq(liquorProducts.slug, prod.slug))
        .limit(1)
      if (existing.length > 0) {
        productId = existing[0].id
      }
    }
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
        .onConflictDoNothing({ target: liquorVariants.sku })
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
        'Crystal ice cubes, disposable cups, playing cards and snacks',
      imageUrl:
        'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=600&q=80',
      sortOrder: 3,
    },
    {
      name: 'Late-Night Food & Bites',
      slug: 'late-night-bites',
      description: 'Frozen momos, Wai Wai noodles, sausages and quick bites',
      imageUrl:
        'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?auto=format&fit=crop&w=600&q=80',
      sortOrder: 4,
    },
  ]

  await db
    .insert(groceryCategories)
    .values(groceryCatsData)
    .onConflictDoNothing({ target: groceryCategories.slug })

  const allGroceryCats = await db.select().from(groceryCategories)
  const gCatMap = Object.fromEntries(allGroceryCats.map((c) => [c.slug, c.id]))

  // 6. Grocery Products
  const groceryItems = [
    {
      name: 'Crystal Clear Ice Bag (3 kg)',
      slug: 'crystal-clear-ice-bag-3kg',
      categoryId: gCatMap['party-essentials'],
      description:
        'Triple-filtered hygienic ice cubes in insulated zip seal bags, delivered frozen in iceboxes.',
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
      name: 'Red Bull Energy Drink (250 ml)',
      slug: 'red-bull-energy-drink-250ml',
      categoryId: gCatMap['beverages-mixers'],
      description:
        'Vitalizes body and mind. The essential party booster for night owls.',
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
      .onConflictDoNothing({ target: groceryProducts.slug })
      .returning()

    let productId = insertedItem.id
    if (!productId) {
      const existing = await db
        .select({ id: groceryProducts.id })
        .from(groceryProducts)
        .where(eq(groceryProducts.slug, item.slug))
        .limit(1)
      if (existing.length > 0) {
        productId = existing[0].id
      }
    }
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
        .onConflictDoNothing({ target: groceryVariants.sku })
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
