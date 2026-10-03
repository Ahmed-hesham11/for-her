import { cookies } from "next/headers";
import { isLocale, type Locale } from "@/lib/i18n/translations";
import { LOCALE_COOKIE } from "@/lib/i18n/translations";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : "en";
}
