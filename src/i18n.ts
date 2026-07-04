import { createI18n } from 'vue-i18n';
import { nextTick } from 'vue';

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

export const i18n = createI18n({
  legacy: false, // Composition API mode
  locale: 'en',  // Initial temporary locale
  fallbackLocale: 'en',
  messages: {}   // Kept empty initially to allow lazy loading
});

const loadedLocales: string[] = [];

// Lazy load locale translation files
export async function loadLocaleMessages(i18nInstance: any, locale: string) {
  if (!SUPPORT_LOCALES.includes(locale)) return;

  if (loadedLocales.includes(locale)) {
    return nextTick();
  }

  // Vite dynamic imports will build separate JSON chunks at build-time
  const messages = await import(`./locales/${locale}.json`);

  // Set the locale messages dynamically
  i18nInstance.global.setLocaleMessage(locale, messages.default);
  loadedLocales.push(locale);

  return nextTick();
}

// Set active language and save choice
export function setI18nLanguage(i18nInstance: any, locale: string) {
  if (i18nInstance.mode === 'legacy') {
    i18nInstance.global.locale = locale;
  } else {
    i18nInstance.global.locale.value = locale;
  }
  
  localStorage.setItem('user_lang', locale);
  document.querySelector('html')?.setAttribute('lang', locale);
}
