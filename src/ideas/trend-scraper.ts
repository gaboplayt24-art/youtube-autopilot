import {z} from 'zod';
import {PublicYouTubeClient} from '../packaging/engine';
import {demandVideo, observedVideo} from './biblical-demand';
import { chromium } from 'playwright';

/**
 * Agente de Scraping de Tendencias Globales
 * Busca temas de alta repercusión en arqueología y religión en otros mercados (EE.UU., Brasil).
 */
export async function scrapeGlobalTrends() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const trends: { topic: string; query: string }[] = [];

  try {
    // 1. Buscar en Google Trends (Sección Arqueología/Religión) o sitios de noticias especializados
    await page.goto('https://news.google.com/search?q=biblical+archaeology+discovery&hl=en-US&gl=US&ceid=US:en');
    const headlines = await page.$$eval('article h3', nodes => nodes.map(n => n.textContent).slice(0, 5));

    for (const title of headlines) {
      if (title) {
        trends.push({
          topic: title.trim(),
          query: title.trim() + ' history explained'
        });
      }
    }

    // 2. Buscar en portugués (mercado Brasil es muy fuerte en esto)
    await page.goto('https://news.google.com/search?q=arqueologia+biblica+descoberta&hl=pt-BR&gl=BR&ceid=BR:pt-419');
    const headlinesBR = await page.$$eval('article h3', nodes => nodes.map(n => n.textContent).slice(0, 5));

    for (const title of headlinesBR) {
      if (title) {
        trends.push({
          topic: title.trim(),
          query: title.trim() + ' historia explicada'
        });
      }
    }

  } catch (error) {
    console.error('Error durante el scraping global:', error);
  } finally {
    await browser.close();
  }

  return trends;
}
