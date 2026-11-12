/**
 * Trend Scraper (HTTP-based)
 * Busca temas de alta repercusión en arqueología y religión usando la YouTube Data API v3
 * directamente con fetch, evitando problemas de tipado con googleapis.
 */
export async function scrapeGlobalTrends(regionCode = 'US', hl = 'en-US') {
  const apiKey = process.env.YOUTUBE_DATA_API_KEY;
  if (!apiKey) throw Error('YOUTUBE_DATA_API_KEY is required for trend scraping');

  const queries = [
    'biblical archaeology discovery',
    'ancient Bible history explained',
    'who were the Nephilim',
    'Dead Sea Scrolls history',
    'Ark of the Covenant mystery',
    'Tower of Babel history',
    'life in ancient Jerusalem',
    'Noahs ark history explained',
    'women in Bible times',
    'Jesus daily life history'
  ];

  const trends: { topic: string; query: string }[] = [];

  for (const q of queries) {
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('q', q);
    url.searchParams.set('type', 'video');
    url.searchParams.set('maxResults', '5');
    url.searchParams.set('order', 'viewCount');
    url.searchParams.set('regionCode', regionCode);
    url.searchParams.set('relevanceLanguage', hl.split('-')[0]);
    url.searchParams.set('publishedAfter', new Date(Date.now() - 7 * 86400000).toISOString());
    url.searchParams.set('key', apiKey);

    try {
      const res = await fetch(url.toString(), {timeout: 30000});
      if (!res.ok) throw Error('YouTube API HTTP ' + res.status);
      const data = await res.json() as any;
      for (const item of data.items ?? []) {
        const title = item?.snippet?.title;
        if (title) trends.push({topic: title, query: title + ' history explained'});
      }
    } catch (err) {
      console.error('Error en scraping de tendencias para', q, err);
    }
  }

  return trends;
}