import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for API routes, static files, and internal Next.js routes
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/templates/') ||
    pathname.includes('.') // static files
  ) {
    return NextResponse.next();
  }

  const response = NextResponse.next();

  // Only set locale cookie if not already set
  const localeCookie = request.cookies.get('NEXT_LOCALE')?.value;
  if (!localeCookie) {
    const acceptLang = request.headers.get('accept-language') || '';
    const detectedLocale = acceptLang.includes('zh') ? 'zh' : 'en';
    response.cookies.set('NEXT_LOCALE', detectedLocale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: 'lax',
    });
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
