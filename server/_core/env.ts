// ─── Environment Variables ───
// All env vars used by the server, with defaults for development.
//
// Required:
//   JWT_SECRET        - Secret for signing session JWTs (generate: openssl rand -hex 32)
//
// Optional (features degrade gracefully without these):
//   DATABASE_URL      - PostgreSQL connection string (default: postgresql://app:app@localhost:5432/app_db)
//   APP_URL           - Public URL for email links (default: http://localhost:8497)
//   PORT              - Server port (default: 8497)
//   SMTP_HOST         - SMTP server for sending emails (logs to console if not set)
//   SMTP_PORT         - SMTP port (default: 587)
//   SMTP_USER         - SMTP username
//   SMTP_PASS         - SMTP password
//   SMTP_FROM         - Sender address for emails
//   STRIPE_SECRET_KEY - Stripe secret key (billing disabled if not set)
//   STRIPE_WEBHOOK_SECRET - Stripe webhook signing secret

export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "dev-secret-key-change-in-production",
  isProduction: process.env.NODE_ENV === "production",
};
