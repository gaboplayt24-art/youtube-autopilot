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
    const url = 'https://www.googleapis.com/youtube/v3/search' +
      '?part=snippet' +
      '&q=' + encodeURIComponent(q) +
      '&type=video' +
      '&maxResults=5' +
      '&order=viewCount' +
      '&regionCode=' + encodeURIComponent(regionCode) +
      '&relevanceLanguage=' + encodeURIComponent(hl.split('-')[0]) +
      '&publishedAfter=' + encodeURIComponent(new Date(Date.now() - 7 * 86400000).toISOString()) +
      '&key=' + encodeURIComponent(apiKey);

    try {
      const res = await fetch(url);
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