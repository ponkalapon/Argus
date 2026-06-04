export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

export type WebSearchResponse = {
  results: WebSearchResult[];
  diagnostic?: string;
};

const DDG_URL = 'https://lite.duckduckgo.com/lite/';
const SUPPORTED_URL_PROTOCOLS = new Set(['http:', 'https:']);

const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
};

const decodeCodePoint = (codePoint: number, fallback: string): string => {
  if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return fallback;
  return String.fromCodePoint(codePoint);
};

export const decodeHtmlEntities = (value: string): string =>
  value.replace(/&(#x[\da-f]+|#\d+|[a-z][\da-z]+);/gi, (entity, body: string) => {
    const normalizedBody = body.toLowerCase();

    if (normalizedBody.startsWith('#x')) {
      return decodeCodePoint(Number.parseInt(normalizedBody.slice(2), 16), entity);
    }

    if (normalizedBody.startsWith('#')) {
      return decodeCodePoint(Number.parseInt(normalizedBody.slice(1), 10), entity);
    }

    return HTML_ENTITIES[normalizedBody] ?? entity;
  });

const stripHtmlTags = (value: string): string =>
  decodeHtmlEntities(value.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());

const isSupportedUrl = (url: URL): boolean => SUPPORTED_URL_PROTOCOLS.has(url.protocol);

export const normalizeDuckDuckGoUrl = (rawUrl: string): string | null => {
  const decodedUrl = decodeHtmlEntities(rawUrl).trim();
  if (!decodedUrl) return null;

  let url: URL;
  try {
    url = new URL(decodedUrl.startsWith('//') ? `https:${decodedUrl}` : decodedUrl, DDG_URL);
  } catch {
    return null;
  }

  if (!isSupportedUrl(url)) return null;

  const duckDuckGoRedirect =
    url.hostname === 'duckduckgo.com' || url.hostname.endsWith('.duckduckgo.com');
  const redirectedUrl = duckDuckGoRedirect ? url.searchParams.get('uddg') : null;

  if (!redirectedUrl) return url.toString();

  try {
    const normalizedRedirect = new URL(decodeHtmlEntities(redirectedUrl));
    return isSupportedUrl(normalizedRedirect) ? normalizedRedirect.toString() : null;
  } catch {
    return null;
  }
};

const extractAttribute = (tag: string, attributeName: string): string | null => {
  const attributeRegex = new RegExp(`${attributeName}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = attributeRegex.exec(tag);
  return match?.[2] ?? match?.[3] ?? match?.[4] ?? null;
};

export const webSearch = async (query: string): Promise<WebSearchResponse> => {
  try {
    const params = new URLSearchParams({ q: query });
    const response = await fetch(`${DDG_URL}?${params.toString()}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return { results: [], diagnostic: `DuckDuckGo вернул ошибку HTTP ${response.status}` };
    }

    const html = await response.text();

    const linkRegex = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
    const snippetRegex = /<td[^>]*class=(?:"[^"]*result-snippet[^"]*"|'[^']*result-snippet[^']*'|[^\s>]*result-snippet[^\s>]*)[^>]*>([\s\S]*?)<\/td>/gi;

    const links: string[] = [];
    const titles: string[] = [];
    let m: RegExpExecArray | null;

    while ((m = linkRegex.exec(html)) !== null) {
      const attributes = m[1];
      const className = extractAttribute(attributes, 'class') ?? '';
      if (!className.split(/\s+/).includes('result-link')) continue;

      const href = extractAttribute(attributes, 'href');
      if (!href) continue;

      links.push(href);
      titles.push(stripHtmlTags(m[2]));
    }

    const snippets: string[] = [];
    while ((m = snippetRegex.exec(html)) !== null) {
      snippets.push(stripHtmlTags(m[1]));
    }

    const results: WebSearchResult[] = [];
    let unsupportedUrlCount = 0;

    for (let i = 0; i < links.length && results.length < 8; i++) {
      const normalizedUrl = normalizeDuckDuckGoUrl(links[i]);
      if (!normalizedUrl) {
        unsupportedUrlCount += 1;
        continue;
      }

      results.push({
        title: decodeHtmlEntities(titles[i] || 'Без названия'),
        url: normalizedUrl,
        snippet: decodeHtmlEntities(snippets[i] || ''),
      });
    }

    if (results.length > 0) return { results };

    if (links.length > 0) {
      return {
        results,
        diagnostic: `DuckDuckGo вернул ${links.length} ссылок, но ${unsupportedUrlCount} из них были отброшены из-за неподдерживаемой схемы или ошибки нормализации URL. Возможно, изменился формат выдачи.`,
      };
    }

    if (/result-link|result-snippet|uddg=/i.test(html)) {
      return {
        results,
        diagnostic: 'DuckDuckGo вернул HTML, похожий на страницу результатов, но парсер не смог извлечь ссылки. Возможно, изменился формат выдачи.',
      };
    }

    return { results };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'неизвестная ошибка';
    return { results: [], diagnostic: `Не удалось выполнить веб-поиск: ${message}` };
  }
};

export const fetchPage = async (url: string, maxChars = 8000): Promise<string> => {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36',
      },
    });

    if (!response.ok) return `Ошибка: ${response.status}`;

    const html = await response.text();

    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[^;]+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (text.length > maxChars) {
      text = text.slice(0, maxChars) + '...' + '\n\n[Текст обрезан]';
    }

    return text || 'Не удалось извлечь текст со страницы';
  } catch {
    return 'Не удалось загрузить страницу';
  }
};
