import { chromium, Browser } from 'playwright';

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
  }
  return browser;
}

/**
 * Generic HTML-to-PDF. Accepts raw HTML and returns an A4 PDF buffer.
 * Extend this with auth/templating as needed; see HL-350 for the full genericization.
 */
export async function generatePdfFromHtml(html: string): Promise<Buffer> {
  const b = await getBrowser();
  const context = await b.newContext();
  const page = await context.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', right: '12mm', bottom: '14mm', left: '12mm' },
    });
  } finally {
    await page.close();
    await context.close();
  }
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

process.on('SIGTERM', async () => {
  await closeBrowser();
});

process.on('SIGINT', async () => {
  await closeBrowser();
});
