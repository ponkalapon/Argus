export class WebSearch {
  /** Perform a web search using a public API */
  async search(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
    try {
      // Try DuckDuckGo-style instant answer API (no API key needed)
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      const response = await fetch(url);
      
      if (!response.ok) return [];

      const data = (await response.json()) as {
        AbstractText?: string;
        RelatedTopics?: Array<{ Text?: string; FirstURL?: string; Result?: string }>;
      };

      const results: { title: string; url: string; snippet: string }[] = [];

      if (data.AbstractText) {
        results.push({
          title: 'Summary',
          url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
          snippet: data.AbstractText,
        });
      }

      if (data.RelatedTopics) {
        for (const topic of data.RelatedTopics.slice(0, 8)) {
          if (topic.Text) {
            const [title, ...rest] = topic.Text.split(' - ');
            results.push({
              title: title || topic.Text,
              url: topic.FirstURL || '',
              snippet: rest.join(' - ') || topic.Text,
            });
          }
        }
      }

      return results;
    } catch (error) {
      return [];
    }
  }

  /** Fetch and extract text from a URL */
  async fetchUrl(url: string): Promise<string | null> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ArgusCLI/1.0)',
          'Accept': 'text/html,text/plain,*/*',
        },
      });
      
      if (!response.ok) return null;
      
      const text = await response.text();
      // Strip HTML tags for plain text
      return text
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 5000);
    } catch {
      return null;
    }
  }
}
