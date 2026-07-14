import { createI18n } from 'vue-i18n';

export const SUPPORT_LOCALES = ['en', 'pt'];

// Detect initial language based on browser setting or saved preferences
export function getInitialLocale(): string {
  const saved = localStorage.getItem('user_lang');
  if (saved && SUPPORT_LOCALES.includes(saved)) {
    return saved;
  }

  const browserLang = (navigator.language || (navigator as any).userLanguage || 'en')
    .split('-')[0]
    .toLowerCase();

  return SUPPORT_LOCALES.includes(browserLang) ? browserLang : 'en';
}

// i18n starts with the correct detected locale right away.
// Messages are still lazy-loaded per locale, but the locale key is set
// correctly from the start so components never show raw translation keys.
export const i18n = createI18n({
  legacy: false,
  locale: getInitialLocale(),
  fallbackLocale: 'en',
  messages: {}
});

const loadedLocales: string[] = [];

/**
 * Lazy-loads the JSON translation chunk for the given locale.
 * Safe to call multiple times — subsequent calls for the same locale are no-ops.
 */
export async function loadLocaleMessages(i18nInstance: any, locale: string): Promise<void> {
  if (!SUPPORT_LOCALES.includes(locale)) return;
  if (loadedLocales.includes(locale)) return;

  const messages = await import(`./locales/${locale}.json`);
  i18nInstance.global.setLocaleMessage(locale, messages.default);
  loadedLocales.push(locale);
}

/**
 * Sets the active locale on the i18n instance, persists to localStorage,
 * and updates the HTML lang attribute.
 */
export function setI18nLanguage(i18nInstance: any, locale: string): void {
  if (i18nInstance.mode === 'legacy') {
    i18nInstance.global.locale = locale;
  } else {
    i18nInstance.global.locale.value = locale;
  }

  localStorage.setItem('user_lang', locale);
  document.querySelector('html')?.setAttribute('lang', locale);
}
