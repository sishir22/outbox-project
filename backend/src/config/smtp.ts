import nodemailer from 'nodemailer';
import { config } from './env';

let cachedTransporter: nodemailer.Transporter | null = null;

export interface SmtpSendOptions {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  messageId?: string;
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: string | Buffer;
    contentType?: string;
  }>;
}

export interface SmtpSendResult {
  messageId: string;
  previewUrl: string | false;
}

/**
 * Creates or retrieves the Nodemailer transporter.
 * If credentials are missing in .env, automatically provisions an Ethereal test account.
 */
export async function getSmtpTransporter(customCredentials?: { user: string; pass: string; host?: string; port?: number }): Promise<nodemailer.Transporter> {
  if (customCredentials && customCredentials.user && customCredentials.pass) {
    return nodemailer.createTransport({
      host: customCredentials.host || 'smtp.ethereal.email',
      port: customCredentials.port || 587,
      secure: false,
      auth: {
        user: customCredentials.user,
        pass: customCredentials.pass,
      },
    });
  }

  if (cachedTransporter) return cachedTransporter;

  let user = config.ethereal.user;
  let pass = config.ethereal.pass;

  if (!user || !pass) {
    console.log('[SMTP] No Ethereal credentials provided. Auto-generating test account...');
    const testAccount = await nodemailer.createTestAccount();
    user = testAccount.user;
    pass = testAccount.pass;
    console.log(`[SMTP] Created Ethereal test account: ${user}`);
    console.log(`[SMTP] Access web inbox at: https://ethereal.email/login with user: ${user} and pass: ${pass}`);
  }

  cachedTransporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: { user, pass },
  });

  return cachedTransporter;
}

/**
 * Sends an email and returns the messageId and Ethereal preview URL.
 */
export async function sendEmailViaSmtp(
  options: SmtpSendOptions,
  credentials?: { user: string; pass: string; host?: string; port?: number }
): Promise<SmtpSendResult> {
  const transporter = await getSmtpTransporter(credentials);

  const info = await transporter.sendMail({
    from: options.from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
    messageId: options.messageId,
    attachments: options.attachments,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  return {
    messageId: info.messageId,
    previewUrl: previewUrl || false,
  };
}
