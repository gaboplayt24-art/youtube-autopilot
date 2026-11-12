/**
 * Trend Scraper (API-based)
 * Busca temas de alta repercusión en arqueología y religión usando la YouTube Data API
 * (ya es una dependencia del proyecto). No requiere navegador ni Playwright.
 */
import {google} from 'googleapis';

const youtubedataapi = google.youtube({version: 'v3', auth: process.env.YOUTUBE_DATA_API_KEY});

export async function scrapeGlobalTrends(regionCode = 'US', hl = 'en-US') {
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
    try {
      const res = await youtubedataapi.search.list({
        part: 'snippet',
        q,
        type: 'video',
        maxResults: 5,
        order: 'viewCount',
        regionCode,
        relevanceLanguage: hl.split('-')[0],
        publishedAfter: new Date(Date.now() - 7 * 86400000).toISOString()
      });
      for (const item of res.data.items ?? []) {
        const title = item.snippet?.title;
        if (title) trends.push({topic: title, query: title + ' history explained'});
      }
    } catch (err) {
      console.error('Error en scraping de tendencias para', q, err);
    }
  }

  return trends;
}