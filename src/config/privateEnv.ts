export const privateEnv = {
  // Database
  DATABASE_URL: process.env.DATABASE_URL!,

  // Better Auth
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET!,

  // Stripe
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY!,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET!,

  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID!,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY!,

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID!,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET!,

  // Anthropic Claude API
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  USE_SDK_CLIENT: process.env.USE_SDK_CLIENT === 'true',

  // Odoo ERP Connection
  ODOO_URL: process.env.ODOO_URL || '',
  ODOO_DATABASE: process.env.ODOO_DATABASE || '',
  ODOO_USERNAME: process.env.ODOO_USERNAME || '',
  ODOO_PASSWORD: process.env.ODOO_PASSWORD || '',

  // Push Notifications - Web Push (VAPID)
  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY || '',
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY || '',
  VAPID_SUBJECT: process.env.VAPID_SUBJECT || '', // mailto:your-email@example.com

  // Push Notifications - Firebase Cloud Messaging (FCM)
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || '',
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY || '',

  // Reloadly - Mobile Airtime & Data Top-ups
  RELOADLY_CLIENT_ID: process.env.RELOADLY_CLIENT_ID || '',
  RELOADLY_CLIENT_SECRET: process.env.RELOADLY_CLIENT_SECRET || '',
  RELOADLY_SANDBOX: process.env.RELOADLY_SANDBOX === 'true', // Set to true for testing

  // Briefing Scheduler - Cron job authentication
  BRIEFING_SCHEDULER_API_KEY: process.env.BRIEFING_SCHEDULER_API_KEY || '',

  // Job Queue - API key for job queue operations
  JOB_QUEUE_API_KEY: process.env.JOB_QUEUE_API_KEY || '',

  // FusionPBX Call Recording Service
  FUSIONPBX_WEBHOOK_SECRET: process.env.FUSIONPBX_WEBHOOK_SECRET || '', // HMAC secret for webhook verification
  FUSIONPBX_API_URL: process.env.FUSIONPBX_API_URL || '', // FusionPBX API endpoint
  FUSIONPBX_API_KEY: process.env.FUSIONPBX_API_KEY || '', // FusionPBX API key for downloads
  RECORDING_ENCRYPTION_KEY: process.env.RECORDING_ENCRYPTION_KEY || '', // 64-char hex string for AES-256-GCM
  RECORDING_API_KEY: process.env.RECORDING_API_KEY || '', // API key for retention enforcement cron
} as const;
