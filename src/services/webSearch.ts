export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

const DDG_URL = 'https://lite.duckduckgo.com/lite/';

export const webSearch = async (query: string): Promise<WebSearchResult[]> => {
  try {
    const params = new URLSearchParams({ q: query });
    const response = await fetch(`${DDG_URL}?${params.toString()}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36',
      },
    });

    if (!response.ok) return [];

    const html = await response.text();

    const results: WebSearchResult[] = [];
    const linkRegex = /<a[^>]*href="([^"]*)"[^>]*class="result-link"[^>]*>([\s\S]*?)<\/a>/gi;
    const snippetRegex = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;

    const links: string[] = [];
    const titles: string[] = [];
    let m: RegExpExecArray | null;

    while ((m = linkRegex.exec(html)) !== null) {
      links.push(m[1]);
      titles.push(m[2].replace(/<[^>]+>/g, '').trim());
    }

    const snippets: string[] = [];
    while ((m = snippetRegex.exec(html)) !== null) {
      snippets.push(m[1].replace(/<[^>]+>/g, '').trim());
    }

    for (let i = 0; i < Math.min(links.length, 8); i++) {
      results.push({
        title: titles[i] || 'Без названия',
        url: links[i].startsWith('http') ? links[i] : `https://${links[i]}`,
        snippet: snippets[i] || '',
      });
    }

    return results;
  } catch {
    return [];
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
