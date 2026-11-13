import { createLogger } from './logger';
import { env } from '../config/env';

const log = createLogger('otp');

const CODE_RE = /\b(\d{6})\b/;

/**
 * Reads the newest eSignPro verification code from Gmail over IMAP.
 * Requires GMAIL_USER + GMAIL_APP_PASSWORD (Google App Password).
 * The dependency is loaded lazily so the rest of the suite works without it.
 */
export async function fetchOtpFromGmail(timeoutMs = 120_000): Promise<string> {
  if (!env.gmail.configured) {
    throw new Error(
      'Gmail IMAP is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in .env ' +
        'or pass OTP_CODE / enter the code interactively.',
    );
  }

  const { ImapFlow } = (await import('imapflow')) as typeof import('imapflow');
  const client = new ImapFlow({
    host: env.gmail.host,
    port: env.gmail.port,
    secure: true,
    auth: { user: env.gmail.user, pass: env.gmail.appPassword },
    logger: false,
  });

  const deadline = Date.now() + timeoutMs;
  try {
    await client.connect();
    while (Date.now() < deadline) {
      const lock = await client.getMailboxLock('INBOX');
      try {
        const since = new Date(Date.now() - 15 * 60 * 1000);
        for await (const message of client.fetch(
          { since, from: 'esignpro' },
          { envelope: true, bodyStructure: true },
        )) {
          const subject = message.envelope?.subject ?? '';
          if (!/code|verif|confirm/i.test(subject)) continue;

          const source = await client.download(String(message.uid), undefined, {
            uid: true,
          });
          if (!source?.content) continue;

          const chunks: Buffer[] = [];
          for await (const chunk of source.content) chunks.push(Buffer.from(chunk));
          const body = Buffer.concat(chunks).toString('utf8');
          const match = body.match(CODE_RE);
          if (match) {
            log.info(`OTP found in message "${subject}"`);
            return match[1];
          }
        }
      } finally {
        lock.release();
      }
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
  } finally {
    await client.logout().catch(() => undefined);
  }

  throw new Error(`No eSignPro verification email received within ${timeoutMs}ms`);
}

/** Reads a verification code from stdin (used by the interactive scripts). */
export async function promptForOtp(): Promise<string> {
  const { createInterface } = await import('node:readline/promises');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question('Enter the 6-digit eSignPro verification code: ');
    return answer.trim();
  } finally {
    rl.close();
  }
}
