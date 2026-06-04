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
];

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36',
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

const extractAttribute = (tag: string, attributeName: string): string | null => {
  const attributeRegex = new RegExp(`${attributeName}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = attributeRegex.exec(tag);
  return match?.[2] ?? match?.[3] ?? match?.[4] ?? null;
};

export const webSearch = async (query: string): Promise<WebSearchResponse> => {
  try {
    const params = new URLSearchParams({ q: query });
    const response = await fetch(`${DDG_URL}?${params.toString()}`, {
      headers: FETCH_HEADERS,
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

const parseFetchPageUrl = (url: string): URL | string => {
  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return `Неподдерживаемый протокол URL: ${parsedUrl.protocol}. Разрешены только http и https.`;
    }

    return parsedUrl;
  } catch {
    return 'Некорректный URL. Укажите полный адрес, например https://example.com/page.';
  }
};

const isAllowedContentType = (contentTypeHeader: string | null): boolean => {
  if (!contentTypeHeader) {
    // Some valid web pages omit Content-Type. Keep them readable, but still reject
    // known non-text formats when the server declares them.
    return true;
  }

  const contentType = contentTypeHeader.split(';')[0].trim().toLowerCase();

  return (
    FETCH_PAGE_ALLOWED_CONTENT_TYPES.includes(contentType) ||
    contentType.startsWith('text/') ||
    contentType === 'application/xhtml+xml' ||
    (contentType.startsWith('application/') && contentType.endsWith('+json'))
  );
};

const readResponseTextWithLimit = async (
  response: Response,
  maxBytes: number,
): Promise<{ text: string; truncated: boolean } | { error: string }> => {
  const contentLength = response.headers.get('Content-Length');
  const expectedBytes = contentLength ? Number(contentLength) : NaN;

  if (Number.isFinite(expectedBytes) && expectedBytes > maxBytes) {
    return {
      error: `Страница слишком большая: ${expectedBytes} байт. Лимит загрузки — ${maxBytes} байт.`,
    };
  }

  if (!response.body) {
    const text = await response.text();
    const truncated = text.length > maxBytes;
    return {
      text: truncated ? text.slice(0, maxBytes) : text,
      truncated,
    };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  const chunks: string[] = [];
  let receivedBytes = 0;
  let truncated = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    if (!value) continue;

    receivedBytes += value.byteLength;

    if (receivedBytes > maxBytes) {
      const allowedBytes = value.byteLength - (receivedBytes - maxBytes);
      if (allowedBytes > 0) {
        chunks.push(decoder.decode(value.slice(0, allowedBytes), { stream: true }));
      }

      truncated = true;
      await reader.cancel();
      break;
    }

    chunks.push(decoder.decode(value, { stream: true }));
  }

  chunks.push(decoder.decode());

  return { text: chunks.join(''), truncated };
};

const extractReadableText = (body: string, contentTypeHeader: string | null): string => {
  const contentType = contentTypeHeader?.split(';')[0].trim().toLowerCase() || '';

  if (contentType === 'application/json' || contentType.endsWith('+json')) {
    return body.replace(/\s+/g, ' ').trim();
  }

  return body
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[^;]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const fetchPage = async (url: string, maxChars = 8000): Promise<FetchPageResult> => {
  const parsedUrl = parseFetchPageUrl(url);
  if (typeof parsedUrl === 'string') {
    return { ok: false, error: parsedUrl };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_PAGE_TIMEOUT_MS);

  try {
    const response = await fetch(parsedUrl.href, {
      headers: FETCH_HEADERS,
      signal: controller.signal,
    });

    const finalUrl = response.url || parsedUrl.href;

    if (!response.ok) {
      return {
        ok: false,
        error: `Сервер вернул ошибку HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}.`,
        finalUrl,
      };
    }

    const contentType = response.headers.get('Content-Type');
    if (!isAllowedContentType(contentType)) {
      return {
        ok: false,
        error: `Неподдерживаемый Content-Type: ${contentType}. Можно читать только HTML, plain text и JSON.`,
        finalUrl,
      };
    }

    const readResult = await readResponseTextWithLimit(response, FETCH_PAGE_MAX_BYTES);
    if ('error' in readResult) {
      return { ok: false, error: readResult.error, finalUrl };
    }

    let text = extractReadableText(readResult.text, contentType);
    let truncated = readResult.truncated;

    if (text.length > maxChars) {
      text = `${text.slice(0, maxChars)}...\n\n[Текст обрезан]`;
      truncated = true;
    } else if (truncated) {
      text = `${text}\n\n[Загрузка остановлена после лимита ${FETCH_PAGE_MAX_BYTES} байт]`;
    }

    return {
      ok: true,
      content: text || 'Не удалось извлечь текст со страницы',
      length: text.length,
      truncated,
      finalUrl,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        ok: false,
        error: `Таймаут загрузки страницы: ответ не получен за ${FETCH_PAGE_TIMEOUT_MS / 1000} секунд.`,
        finalUrl: parsedUrl.href,
      };
    }

    return {
      ok: false,
      error: `Не удалось загрузить страницу${error instanceof Error ? `: ${error.message}` : '.'}`,
      finalUrl: parsedUrl.href,
    };
  } finally {
    clearTimeout(timeoutId);
  }
};
