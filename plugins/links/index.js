import { expect } from '@playwright/test';
import { loginViaUI } from '../../helpers/uiLogin.js';
import { resolveTemplate } from '../../helpers/template.js';

const linksPlugin = {
  id: 'links',
  priority: 85,
  isEnabled: (config) => config.plugins?.links === true || config.links?.pages?.length > 0,

  register({ test, config, context }) {
    const frontendUrl = config.frontendUrl || config.baseUrl;
    const linksConfig = config.links || {};
    const pagesToCheck = linksConfig.pages || config.pages.filter((p) => p.linkCheck !== false).slice(0, 5);
    const maxLinks = linksConfig.maxLinksPerPage || 50;

    for (const pageConfig of pagesToCheck) {
      test(`Links - ${pageConfig.name}`, { tag: pageConfig.tags || ['links'] }, async ({ page, request }) => {
        if (pageConfig.requiresAuth) await loginViaUI(page, config);
        await page.goto(`${frontendUrl}${resolveTemplate(pageConfig.path, context)}`, { waitUntil: 'domcontentloaded' });

        const links = await page.evaluate((max) => {
          return [...document.querySelectorAll('a[href]')]
            .map((a) => ({ href: a.href, text: a.textContent?.trim() }))
            .filter((l) => l.href && !l.href.startsWith('javascript:') && !l.href.startsWith('mailto:') && !l.href.startsWith('tel:'))
            .slice(0, max);
        }, maxLinks);

        const broken = [];
        const visited = new Set();

        for (const link of links) {
          if (visited.has(link.href)) continue;
          visited.add(link.href);

          try {
            const isExternal = !link.href.startsWith(frontendUrl) && !link.href.startsWith('/');
            const url = isExternal ? link.href : link.href.startsWith('/') ? `${frontendUrl}${link.href}` : link.href;

            const response = await request.get(url, { maxRedirects: 5, timeout: 10000 });
            const status = response.status();

            if (status >= 400) {
              broken.push({ href: link.href, text: link.text, status });
            }
          } catch (error) {
            broken.push({ href: link.href, text: link.text, error: error.message });
          }
        }

        if (broken.length > 0) {
          const summary = broken.map((b) => `  ${b.href} → ${b.status || b.error}`).join('\n');
          test.info().annotations.push({ type: 'broken-links', description: summary });

          if (linksConfig.failOnBroken !== false) {
            throw new Error(`Broken links on ${pageConfig.name}:\n${summary}`);
          }
        }
      });
    }
  },
};

export default linksPlugin;
