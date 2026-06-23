'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export default function LanguageSwitcher() {
  const t = useTranslations('language');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function setLocale(locale: string) {
    document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    startTransition(() => {
      router.refresh();
    });
  }

  const currentLocale = typeof document !== 'undefined'
    ? (document.cookie.match(/NEXT_LOCALE=(\w+)/)?.[1] || 'en')
    : 'en';

  return (
    <div className={`flex items-center gap-1 text-xs ${isPending ? 'opacity-50' : ''}`}>
      <button
        onClick={() => setLocale('en')}
        disabled={isPending}
        className={`px-2 py-1 rounded transition-colors ${
          currentLocale === 'en'
            ? 'bg-zinc-700 text-white'
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
        }`}
      >
        {t('en')}
      </button>
      <span className="text-zinc-600">|</span>
      <button
        onClick={() => setLocale('zh')}
        disabled={isPending}
        className={`px-2 py-1 rounded transition-colors ${
          currentLocale === 'zh'
            ? 'bg-zinc-700 text-white'
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
        }`}
      >
        {t('zh')}
      </button>
    </div>
  );
}
