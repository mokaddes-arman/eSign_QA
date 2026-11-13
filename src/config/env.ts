import 'dotenv/config';
import path from 'node:path';

function optional(name: string, fallback = ''): string {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable "${name}". ` +
        'Copy .env.example to .env and fill in the values.',
    );
  }
  return value;
}

export const env = {
  baseUrl: optional('BASE_URL', 'https://esignpro.net').replace(/\/$/, ''),

  user: {
    get name() {
      return required('ESIGN_NAME');
    },
    get company() {
      return required('ESIGN_COMPANY');
    },
    get email() {
      return required('ESIGN_EMAIL');
    },
    get password() {
      return required('ESIGN_PASSWORD');
    },
    get companyType() {
      return optional('ESIGN_COMPANY_TYPE', 'Other');
    },
    get companySize() {
      return optional('ESIGN_COMPANY_SIZE', '1–50');
    },
  },

  otpCode: optional('OTP_CODE'),
  authStatePath: path.resolve(
    process.cwd(),
    optional('AUTH_STATE_PATH', 'auth/storageState.json'),
  ),

  gmail: {
    host: optional('GMAIL_IMAP_HOST', 'imap.gmail.com'),
    port: Number(optional('GMAIL_IMAP_PORT', '993')),
    user: optional('GMAIL_USER'),
    appPassword: optional('GMAIL_APP_PASSWORD'),
    get configured() {
      return Boolean(this.user && this.appPassword);
    },
  },
} as const;

export type TestUser = {
  name: string;
  company: string;
  email: string;
  password: string;
  companyType: string;
  companySize: string;
};
