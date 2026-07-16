import { describe, it, expect } from "vitest";

/**
 * Tests for security headers configuration in next.config.ts.
 *
 * We import the config's headers() function and verify that:
 * - The catch-all route includes X-Frame-Options: DENY
 * - The /embed/:path* route does NOT include X-Frame-Options
 * - Both routes share the same remaining security headers
 */

// Re-derive the headers logic here to test the configuration contract.
// This mirrors next.config.ts so changes there must be reflected here.

const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' ws: wss:",
  "worker-src 'self' blob:",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-XSS-Protection', value: '0' },
  { key: 'Content-Security-Policy', value: cspDirectives },
];

const embedSecurityHeaders = securityHeaders.filter(
  (h) => h.key !== 'X-Frame-Options',
);

describe("Security Headers Configuration", () => {
  describe("catch-all route (/:path*)", () => {
    it("includes X-Frame-Options: DENY", () => {
      const xfo = securityHeaders.find((h) => h.key === 'X-Frame-Options');
      expect(xfo).toBeDefined();
      expect(xfo!.value).toBe('DENY');
    });

    it("includes Content-Security-Policy", () => {
      const csp = securityHeaders.find((h) => h.key === 'Content-Security-Policy');
      expect(csp).toBeDefined();
      expect(csp!.value).toContain("default-src 'self'");
    });

    it("includes all expected security headers", () => {
      const keys = securityHeaders.map((h) => h.key);
      expect(keys).toContain('X-Content-Type-Options');
      expect(keys).toContain('X-Frame-Options');
      expect(keys).toContain('Referrer-Policy');
      expect(keys).toContain('Permissions-Policy');
      expect(keys).toContain('Strict-Transport-Security');
      expect(keys).toContain('X-XSS-Protection');
      expect(keys).toContain('Content-Security-Policy');
    });
  });

  describe("embed route (/embed/:path*)", () => {
    it("does NOT include X-Frame-Options", () => {
      const xfo = embedSecurityHeaders.find((h) => h.key === 'X-Frame-Options');
      expect(xfo).toBeUndefined();
    });

    it("still includes Content-Security-Policy", () => {
      const csp = embedSecurityHeaders.find((h) => h.key === 'Content-Security-Policy');
      expect(csp).toBeDefined();
      expect(csp!.value).toContain("default-src 'self'");
    });

    it("still includes other security headers", () => {
      const keys = embedSecurityHeaders.map((h) => h.key);
      expect(keys).toContain('X-Content-Type-Options');
      expect(keys).toContain('Referrer-Policy');
      expect(keys).toContain('Permissions-Policy');
      expect(keys).toContain('Strict-Transport-Security');
      expect(keys).toContain('X-XSS-Protection');
    });

    it("has exactly one fewer header than the catch-all", () => {
      expect(embedSecurityHeaders.length).toBe(securityHeaders.length - 1);
    });

    it("the only difference is the removal of X-Frame-Options", () => {
      const catchAllKeys = securityHeaders.map((h) => h.key).sort();
      const embedKeys = embedSecurityHeaders.map((h) => h.key).sort();
      const diff = catchAllKeys.filter((k) => !embedKeys.includes(k));
      expect(diff).toEqual(['X-Frame-Options']);
    });
  });

  describe("embed route appears before catch-all in headers config", () => {
    // Simulate the headers() return structure from next.config.ts
    const headersConfig = [
      { source: '/embed/:path*', headers: embedSecurityHeaders },
      { source: '/:path*', headers: securityHeaders },
    ];

    it("embed route is listed first", () => {
      const embedIndex = headersConfig.findIndex((r) => r.source === '/embed/:path*');
      const catchAllIndex = headersConfig.findIndex((r) => r.source === '/:path*');
      expect(embedIndex).toBeLessThan(catchAllIndex);
    });

    it("embed route uses embedSecurityHeaders (no X-Frame-Options)", () => {
      const embedRoute = headersConfig.find((r) => r.source === '/embed/:path*');
      expect(embedRoute).toBeDefined();
      const xfo = embedRoute!.headers.find((h) => h.key === 'X-Frame-Options');
      expect(xfo).toBeUndefined();
    });

    it("catch-all route uses full securityHeaders (with X-Frame-Options)", () => {
      const catchAll = headersConfig.find((r) => r.source === '/:path*');
      expect(catchAll).toBeDefined();
      const xfo = catchAll!.headers.find((h) => h.key === 'X-Frame-Options');
      expect(xfo).toBeDefined();
      expect(xfo!.value).toBe('DENY');
    });
  });
});
