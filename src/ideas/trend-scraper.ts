/**
 * Agente de Scraping de Tendencias Globales
 * Busca temas de alta repercusión en arqueología y religión en otros mercados (EE.UU., Brasil).
 * Se ejecuta con Playwright ya instalado por el proyecto (rembg/Chromium del runner).
 */
export async function scrapeGlobalTrends() {
  const {chromium} = await import('playwright');
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const trends: { topic: string; query: string }[] = [];

  try {
    await page.goto('https://news.google.com/search?q=biblical+archaeology+discovery&hl=en-US&gl=US&ceid=US:en', {timeout: 30000});
    const headlines = await page.$$eval('article h3', (nodes: Element[]) => nodes.map(n => n.textContent).slice(0, 5));
    for (const title of headlines) {
      if (title) trends.push({topic: title.trim(), query: title.trim() + ' history explained'});
    }

    await page.goto('https://news.google.com/search?q=arqueologia+biblica+descoberta&hl=pt-BR&gl=BR&ceid=BR:pt-419', {timeout: 30000});
    const headlinesBR = await page.$$eval('article h3', (nodes: Element[]) => nodes.map(n => n.textContent).slice(0, 5));
    for (const title of headlinesBR) {
      if (title) trends.push({topic: title.trim(), query: title.trim() + ' historia explicada'});
    }
  } catch (error) {
    console.error('Error durante el scraping global:', error);
  } finally {
    await browser.close();
  }

  return trends;
}
