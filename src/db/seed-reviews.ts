import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function main() {
  const { db } = await import('./index')
  const { sql, eq } = await import('drizzle-orm')
  const { reviews } = await import('./schema')

  console.log('Ensuring image_url column exists on reviews table...')
  await db.execute(sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS image_url text;`)
  console.log('✔ Column image_url verified.')

  const seedReviews = [
    {
      id: 'rev_amrit_bhattrai',
      productName: 'Express Delivery',
      customerName: 'Amrit Bhattrai',
      rating: 5,
      body: 'Too polite & for sure best service.',
      imageUrl:
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&h=200&q=80',
      status: 'published',
    },
    {
      id: 'rev_sandeep_gaire',
      productName: 'Late Night Service',
      customerName: 'Sandeep Gaire',
      rating: 5,
      body: 'One of the best service providers for late night.',
      imageUrl:
        'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=200&h=200&q=80',
      status: 'published',
    },
    {
      id: 'rev_susma_tandan',
      productName: 'Customer Support',
      customerName: 'Susma Tandan',
      rating: 5,
      body: 'Fast delivery and very cooperative. Highly recommended.',
      imageUrl:
        'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=200&h=200&q=80',
      status: 'published',
    },
  ]

  for (const r of seedReviews) {
    const existing = await db
      .select()
      .from(reviews)
      .where(eq(reviews.customerName, r.customerName))
      .limit(1)

    if (existing.length === 0) {
      await db.insert(reviews).values(r)
      console.log(`✔ Inserted review for "${r.customerName}" with image`)
    } else {
      await db
        .update(reviews)
        .set({
          body: r.body,
          imageUrl: r.imageUrl,
          rating: r.rating,
          status: 'published',
          productName: r.productName,
        })
        .where(eq(reviews.id, existing[0].id))
      console.log(`✔ Updated existing review for "${r.customerName}" with image`)
    }
  }

  const all = await db.select().from(reviews)
  console.log('\n--- VERIFICATION: Reviews in database ---')
  console.table(
    all.map((r) => ({
      id: r.id,
      name: r.customerName,
      quote: r.body,
      rating: r.rating,
      image: r.imageUrl,
      status: r.status,
    })),
  )
  process.exit(0)
}

main().catch((err) => {
  console.error('Failed to seed reviews:', err)
  process.exit(1)
})
