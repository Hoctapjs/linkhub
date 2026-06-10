/**
 * Utility to fetch metadata (title, description, favicon) from URLs
 */

import { MetadataResult } from './types';

function extractFromHtml(html: string, pattern: RegExp): string | undefined {
  const match = html.match(pattern);
  return match ? match[1]?.trim() : undefined;
}

function buildFallbackFavicon(url: string): string {
  try {
    const parsed = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=64`;
  } catch {
    return '';
  }
}

function resolveRelativeUrl(baseUrl: string, value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return undefined;
  }
}

/**
 * Fetch metadata from a URL
 * Attempts to extract title, description, and favicon from HTML
 * Returns empty object if fetching fails (doesn't break the flow)
 */
export async function fetchMetadata(url: string): Promise<MetadataResult> {
  const fallbackFavicon = buildFallbackFavicon(url);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { favicon: fallbackFavicon };
    }

    const html = await response.text();

    // Extract title: try og:title first, then standard title
    const title =
      extractFromHtml(html, /<meta\s+property="og:title"\s+content="([^"]+)"/i) ||
      extractFromHtml(html, /<title[^>]*>([^<]+)<\/title>/i) ||
      undefined;

    // Extract description: try og:description first, then meta description
    const description =
      extractFromHtml(html, /<meta\s+property="og:description"\s+content="([^"]+)"/i) ||
      extractFromHtml(html, /<meta\s+name="description"\s+content="([^"]+)"/i) ||
      undefined;

    // Extract favicon: try og:image, then link rel="icon", then fallback to Google's favicon API
    const rawFavicon =
      extractFromHtml(html, /<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
      extractFromHtml(html, /<link\s+[^>]*rel="(?:icon|shortcut icon)"[^>]*href="([^"]+)"/i) ||
      extractFromHtml(html, /<link\s+[^>]*href="([^"]+)"[^>]*rel="(?:icon|shortcut icon)"/i) ||
      undefined;

    const favicon = resolveRelativeUrl(url, rawFavicon) || fallbackFavicon;

    return {
      title: title || undefined,
      description: description || undefined,
      favicon,
    };
  } catch (error) {
    // Log error for debugging but don't throw
    console.error(`Failed to fetch metadata from ${url}:`, error);

    // Return fallback favicon at minimum - allow link creation to proceed
    return {
      favicon: fallbackFavicon,
    };
  }
}

/**
 * Construct a fallback favicon URL for a domain
 * Used when metadata fetching fails or returns no favicon
 */
export function getFallbackFavicon(url: string): string {
  return buildFallbackFavicon(url);
}
