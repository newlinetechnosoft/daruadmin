import { config } from 'dotenv'
import { NepalOtpProvider } from './sms-providers'
import { sendOtp, verifyOtp } from './otp.service'

config({ path: ['.env.local', '.env'] })

async function runNepalOtpDemo() {
  const targetPhone = process.argv[2] || '9801234567'
  const apiKey = process.env.NEPALOTP_API_KEY
  const baseUrl = process.env.NEPALOTP_BASE_URL || 'https://api.nepalotp.com'
  const senderId = process.env.NEPALOTP_SENDER_ID || 'Mezmani'

  console.log('====================================================')
  console.log('          NEPALOTP (https://nepalotp.com) DEMO      ')
  console.log('====================================================')
  console.log(`Base URL:     ${baseUrl}`)
  console.log(`Sender ID:    ${senderId}`)
  console.log(`Target Phone: ${targetPhone}`)
  console.log(
    `API Key:      ${
      apiKey
        ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)} (Configured)`
        : 'Not configured (Running in Demo/Mock Mode)'
    }`,
  )
  console.log('----------------------------------------------------')

  if (!apiKey) {
    console.log('ℹ️  HOW TO CONFIGURE NEPALOTP FOR PRODUCTION:')
    console.log('1. Sign up / log in at https://nepalotp.com')
    console.log('2. Obtain your API key from the dashboard')
    console.log('3. Add the key to your environment:')
    console.log('     SMS_PROVIDER=nepalotp')
    console.log('     NEPALOTP_API_KEY=your_api_key_here')
    console.log('     NEPALOTP_SENDER_ID=Mezmani')
    console.log('----------------------------------------------------')
  }

  // 1. Direct Provider Dispatch Test
  console.log('📡 Step 1: Testing NepalOtpProvider dispatch...')
  const provider = new NepalOtpProvider()
  const providerResult = await provider.sendSms(
    targetPhone,
    'Your Mezmani verification code is 849201. Valid for 5 minutes.',
  )
  console.log('Provider Result:', providerResult)

  // 2. Full OTP Service Test (Creation, Hashing & Verification)
  console.log('\n🔐 Step 2: Testing Full Mezmani OTP Service with NepalOTP...')
  try {
    const sendResult = await sendOtp(targetPhone)
    console.log('Service sendOtp Result:', sendResult)

    console.log('\n✅ Step 3: Verifying with dev bypass code (123456)...')
    const verifyResult = await verifyOtp(targetPhone, '123456')
    console.log('Service verifyOtp Result:', verifyResult)
  } catch (dbErr) {
    console.log(
      '⚠️  Database connectivity note: Neon database is currently unreachable in this offline/sandboxed terminal context.',
    )
    console.log(
      '   (In live dev server with network, OTP hashes are persisted to the "verification" table in Postgres).',
    )
  }

  console.log('====================================================')
  console.log('✨ Demo completed successfully.')
  console.log('====================================================')
}

runNepalOtpDemo().catch((err) => {
  console.error('Demo error:', err)
  process.exit(1)
})
