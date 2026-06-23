import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerStore = await headers();

  let locale = cookieStore.get('NEXT_LOCALE')?.value;

  if (!locale) {
    const acceptLang = headerStore.get('accept-language') || '';
    locale = acceptLang.includes('zh') ? 'zh' : 'en';
  }

  if (!['en', 'zh'].includes(locale)) locale = 'en';

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
