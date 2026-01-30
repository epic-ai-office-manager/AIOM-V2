/**
 * Email Service using SMTP2GO
 *
 * Provides email sending functionality for workflows and notifications.
 */

import SMTP2GOApi from 'smtp2go-nodejs';

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  body?: string;
  html?: string;
  from?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  sent: boolean;
  emailId?: string;
  error?: string;
}

/**
 * Sends an email using SMTP2GO
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  try {
    const fromEmail = params.from || process.env.DEFAULT_FROM_EMAIL || 'noreply@aiom.app';
    const toAddresses = Array.isArray(params.to) ? params.to : [params.to];

    // Validate API key
    if (!process.env.SMTP2GO_API_KEY) {
      console.warn('[Email] SMTP2GO_API_KEY not configured - email not sent');
      return {
        sent: false,
        error: 'SMTP2GO_API_KEY not configured',
      };
    }

    // Initialize SMTP2GO client
    const api = SMTP2GOApi(process.env.SMTP2GO_API_KEY);
    const mailService = api.mail() as any;

    // Build email using smtp2go-nodejs fluent API
    toAddresses.forEach((address) => {
      mailService.to({ email: address });
    });

    mailService.from({ email: fromEmail });
    mailService.subject(params.subject);

    if (params.html) {
      mailService.html(params.html);
    } else if (params.body) {
      mailService.text(params.body);
    }

    // Send the email
    const response = await api.client().consume(mailService);

    console.log(`[Email] Sent to ${toAddresses.join(', ')}: ${params.subject}`);

    return {
      sent: true,
      emailId: (response as any)?.data?.email_id || 'unknown',
    };
  } catch (error) {
    console.error('[Email] Failed to send:', error);
    return {
      sent: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Sends a simple text email
 */
export async function sendTextEmail(
  to: string | string[],
  subject: string,
  body: string
): Promise<SendEmailResult> {
  return sendEmail({ to, subject, body });
}

/**
 * Sends an HTML email
 */
export async function sendHtmlEmail(
  to: string | string[],
  subject: string,
  html: string
): Promise<SendEmailResult> {
  return sendEmail({ to, subject, html });
}
