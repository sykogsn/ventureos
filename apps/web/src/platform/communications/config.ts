/**
 * Inbound communications credentials.
 * Authentication mail uses RESEND_API_KEY and MAIL_FROM. Those variables are not read here.
 * Receiving mail is expected on a dedicated subdomain configured at the provider.
 * This module does not change DNS or root-domain MX records.
 */
export type CommunicationsConfig = {
  apiKey: string;
  webhookSecret: string;
};

type CommunicationsEnv = {
  COMMUNICATIONS_RESEND_API_KEY?: string;
  COMMUNICATIONS_RESEND_WEBHOOK_SECRET?: string;
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
};

export function readCommunicationsConfig(env?: CommunicationsEnv): CommunicationsConfig | null {
  const source = env ?? process.env;
  const apiKey = source.COMMUNICATIONS_RESEND_API_KEY?.trim() ?? "";
  const webhookSecret = source.COMMUNICATIONS_RESEND_WEBHOOK_SECRET?.trim() ?? "";
  if (!apiKey || !webhookSecret) return null;
  return { apiKey, webhookSecret };
}
