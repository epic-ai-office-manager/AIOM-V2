/**
 * SMS Service using Twilio
 *
 * Provides SMS sending functionality for workflows and notifications.
 */

interface InternalSmsResponse {
  sid?: string;
  status?: string;
}

export interface SendSMSParams {
  to: string;
  body: string;
  from?: string;
}

export interface SendSMSResult {
  sent: boolean;
  sid?: string;
  status?: string;
  error?: string;
}

/**
 * Sends an SMS using Twilio
 */
export async function sendSMS(params: SendSMSParams): Promise<SendSMSResult> {
  try {
    const fromNumber = params.from || process.env.TWILIO_PHONE_NUMBER;

    const smsServerUrl = process.env.SMS_SERVER_URL;
    if (!smsServerUrl) {
      return {
        sent: false,
        error: "SMS_SERVER_URL not configured",
      };
    }

    const endpoint = `${smsServerUrl.replace(/\/+$/, "")}/send-sms`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.SMS_SERVER_API_KEY
          ? { Authorization: `Bearer ${process.env.SMS_SERVER_API_KEY}` }
          : {}),
      },
      body: JSON.stringify({
        to: params.to,
        from: fromNumber,
        body: params.body,
      }),
    });

    if (!res.ok) {
      return {
        sent: false,
        error: `SMS server request failed (${res.status})`,
      };
    }

    const parsed = (await res.json().catch(() => ({}))) as InternalSmsResponse;
    return {
      sent: true,
      sid: parsed.sid,
      status: parsed.status ?? "accepted",
    };
  } catch (error) {
    console.error('[SMS] Failed to send:', error);
    return {
      sent: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Sends a bulk SMS to multiple recipients
 */
export async function sendBulkSMS(
  recipients: string[],
  body: string,
  from?: string
): Promise<Array<SendSMSResult & { to: string }>> {
  const results = await Promise.allSettled(
    recipients.map((to) => sendSMS({ to, body, from }))
  );

  return results.map((result, index) => ({
    to: recipients[index],
    ...(result.status === 'fulfilled'
      ? result.value
      : { sent: false, error: 'Promise rejected' }),
  }));
}
