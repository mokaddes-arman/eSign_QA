import { expect, type Page } from '@playwright/test';
import { API } from './api';
import type { ContactsPage, ContactInput } from '../pages/ContactsPage';

export type ApiContact = { id: string; name: string; email: string; title: string | null };

export async function listContacts(page: Page): Promise<ApiContact[]> {
  const body = await (await page.request.get(API.contacts)).json();
  return Array.isArray(body) ? body : body.items ?? body.data ?? body.contacts;
}

/**
 * Returns the id of the contact with `input.email`, creating it through the UI only if it
 * does not exist yet — fixed test contacts are reused, so runs do not pile up records.
 */
export async function ensureContact(page: Page, contactsPage: ContactsPage, input: ContactInput): Promise<string> {
  const find = async () => (await listContacts(page)).find((c) => c.email === input.email)?.id;
  const existing = await find();
  if (existing) return existing;
  await contactsPage.goto();
  await contactsPage.createContact(input);
  let id: string | undefined;
  await expect.poll(async () => (id = await find()), { message: `contact ${input.email} was not created` }).toBeTruthy();
  return id!;
}
