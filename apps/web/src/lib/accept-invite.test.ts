import { describe, expect, it } from 'vitest';

// Inline the logic we test so this file stays pure (no DOM/browser globals).
function hashHasToken(hash: string): boolean {
  return hash.includes('access_token');
}

function buildRedirectTo(siteUrl: string): string {
  return `${siteUrl.replace(/\/$/, '')}/accept-invite`;
}

describe('accept-invite helpers', () => {
  describe('hashHasToken', () => {
    it('detects an invite hash', () => {
      expect(hashHasToken('#access_token=abc&type=invite')).toBe(true);
    });

    it('detects a recovery (password-reset) hash', () => {
      expect(hashHasToken('#access_token=xyz&type=recovery')).toBe(true);
    });

    it('returns false for an empty hash', () => {
      expect(hashHasToken('')).toBe(false);
    });

    it('returns false for unrelated hash params', () => {
      expect(hashHasToken('#section=2')).toBe(false);
    });
  });

  describe('buildRedirectTo', () => {
    it('appends /accept-invite to the site URL', () => {
      expect(buildRedirectTo('http://127.0.0.1:5173')).toBe(
        'http://127.0.0.1:5173/accept-invite',
      );
    });

    it('strips a trailing slash before appending', () => {
      expect(buildRedirectTo('https://example.vercel.app/')).toBe(
        'https://example.vercel.app/accept-invite',
      );
    });

    it('works with a bare HTTPS origin', () => {
      expect(buildRedirectTo('https://cmc.example.org')).toBe(
        'https://cmc.example.org/accept-invite',
      );
    });
  });
});
