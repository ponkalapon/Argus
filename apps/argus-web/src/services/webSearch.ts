export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

export type WebSearchResponse = {
  results: WebSearchResult[];
  diagnostic?: string;
};

export type FetchPageResult =
  | {
      ok: true;
      content: string;
      length: number;
      truncated: boolean;
      finalUrl: string;
    }
  | {
      ok: false;
      error: string;
      finalUrl?: string;
    };

const DDG_URL = 'https://lite.duckduckgo.com/lite/';
const FETCH_PAGE_TIMEOUT_MS = 12_000;
const FETCH_PAGE_MAX_BYTES = 1_000_000;
const FETCH_PAGE_ALLOWED_CONTENT_TYPES = [
  'text/html',
  'text/plain',
  'application/json',
  'application/xml',
  'text/xml',
];

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};

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

const searchGoogleNewsRss = async (query: string): Promise<WebSearchResult[]> => {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ru&gl=RU&ceid=RU:ru`;
    const res = await fetch(url, { headers: FETCH_HEADERS });
    if (!res.ok) return [];
    const xml = await res.text();
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    const results: WebSearchResult[] = [];
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xml)) !== null && results.length < 8) {
      const itemXml = match[1];
      const titleMatch = /<title>([\s\S]*?)<\/title>/i.exec(itemXml);
      const linkMatch = /<link>([\s\S]*?)<\/link>/i.exec(itemXml);
      const pubDateMatch = /<pubDate>([\s\S]*?)<\/pubDate>/i.exec(itemXml);
      const sourceMatch = /<source[^>]*>([\s\S]*?)<\/source>/i.exec(itemXml);

      const title = stripHtmlTags(titleMatch?.[1] || '');
      const link = stripHtmlTags(linkMatch?.[1] || '');
      const pubDate = stripHtmlTags(pubDateMatch?.[1] || '');
      const source = stripHtmlTags(sourceMatch?.[1] || '');

      if (title && link) {
        results.push({
          title,
          url: link,
          snippet: [source ? `Источник: ${source}` : '', pubDate ? `Дата: ${pubDate}` : ''].filter(Boolean).join(' • '),
        });
      }
    }
    return results;
  } catch {
    return [];
  }
};

const searchWikipedia = async (query: string): Promise<WebSearchResult[]> => {
  try {
    const url = `https://ru.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=1&format=json`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const searchItems = data.query?.search;
    if (!Array.isArray(searchItems)) return [];

    return searchItems.slice(0, 6).map((item: any) => ({
      title: item.title,
      url: `https://ru.wikipedia.org/wiki/${encodeURIComponent(item.title)}`,
      snippet: stripHtmlTags(item.snippet || ''),
    }));
  } catch {
    return [];
  }
};

export const webSearch = async (query: string): Promise<WebSearchResponse> => {
  try {
    // 1. Try Google News RSS first for news / fresh content
    const newsResults = await searchGoogleNewsRss(query);
    if (newsResults.length > 0) {
      return { results: newsResults };
    }

    // 2. Try Wikipedia Search API
    const wikiResults = await searchWikipedia(query);
    if (wikiResults.length > 0) {
      return { results: wikiResults };
    }

    // 3. DuckDuckGo fallback
    const params = new URLSearchParams({ q: query });
    const response = await fetch(`${DDG_URL}?${params.toString()}`, {
      headers: FETCH_HEADERS,
    });

    if (!response.ok) {
      return { results: [], diagnostic: `Поиск вернул статус HTTP ${response.status}` };
    }

    const html = await response.text();

    const linkRegex = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
    const snippetRegex = /<td[^>]*class=(?:"[^"]*result-snippet[^"]*"|'[^']*result-snippet[^']*'|[^\s>]*result-snippet[^\s>]*)[^>]*>([\s\S]*?)<\/td>/gi;

    const links: string[] = [];
    const titles: string[] = [];
    let m: RegExpExecArray | null;

    while ((m = linkRegex.exec(html)) !== null) {
      const attributes = m[1];
      const href = /href=["']([^"']+)["']/i.exec(attributes)?.[1];
      if (!href) continue;
      links.push(href);
      titles.push(stripHtmlTags(m[2]));
    }

    const snippets: string[] = [];
    while ((m = snippetRegex.exec(html)) !== null) {
      snippets.push(stripHtmlTags(m[1]));
    }

    const results: WebSearchResult[] = [];
    for (let i = 0; i < links.length && results.length < 8; i++) {
      const normalizedUrl = normalizeDuckDuckGoUrl(links[i]);
      if (!normalizedUrl) continue;
      results.push({
        title: decodeHtmlEntities(titles[i] || 'Без названия'),
        url: normalizedUrl,
        snippet: decodeHtmlEntities(snippets[i] || ''),
      });
    }

    return { results };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'неизвестная ошибка';
    return { results: [], diagnostic: `Ошибка сети веб-поиска: ${message}` };
  }
};

export const fetchPage = async (rawUrl: string): Promise<FetchPageResult> => {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, error: `Недопустимый URL "${rawUrl}"` };
  }

  if (!isSupportedUrl(url)) {
    return { ok: false, error: `Неподдерживаемый протокол URL "${url.protocol}"` };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_PAGE_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      headers: FETCH_HEADERS,
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `Сервер вернул ошибку HTTP ${response.status}`,
        finalUrl: response.url || url.toString(),
      };
    }

    const rawContentType = response.headers.get('content-type') ?? '';
    const contentType = rawContentType.split(';')[0].trim().toLowerCase();

    if (contentType && !FETCH_PAGE_ALLOWED_CONTENT_TYPES.includes(contentType)) {
      return {
        ok: false,
        error: `Неподдерживаемый тип содержимого "${contentType}"`,
        finalUrl: response.url || url.toString(),
      };
    }

    const html = await response.text();

    const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    const title = titleMatch ? stripHtmlTags(titleMatch[1]) : '';

    let textContent = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ');

    textContent = stripHtmlTags(textContent);

    const fullContent = [title ? `# ${title}\n` : '', textContent]
      .filter(Boolean)
      .join('\n');

    const truncated = fullContent.length > FETCH_PAGE_MAX_BYTES;
    const content = truncated ? fullContent.slice(0, FETCH_PAGE_MAX_BYTES) : fullContent;

    return {
      ok: true,
      content,
      length: content.length,
      truncated,
      finalUrl: response.url || url.toString(),
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { ok: false, error: `Тайм-аут загрузки страницы (${FETCH_PAGE_TIMEOUT_MS / 1000}s)` };
    }
    const message = error instanceof Error ? error.message : 'неизвестная ошибка';
    return { ok: false, error: `Ошибка загрузки страницы: ${message}` };
  }
};
