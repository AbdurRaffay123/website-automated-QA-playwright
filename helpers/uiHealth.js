import { resolveTemplate } from './template.js';

/**
 * UI health checks: broken images, spinners, empty states, layout issues.
 */
export async function checkBrokenImages(page) {
  return page.evaluate(() => {
    const images = [...document.querySelectorAll('img')];
    return images
      .filter((img) => img.complete && img.naturalWidth === 0 && img.src)
      .map((img) => ({ src: img.src, alt: img.alt }));
  });
}

export async function checkMissingIcons(page, iconSelector = '[class*="icon"], svg, .material-icons') {
  return page.evaluate((sel) => {
    const icons = [...document.querySelectorAll(sel)];
    return icons
      .filter((icon) => {
        const rect = icon.getBoundingClientRect();
        return rect.width === 0 && rect.height === 0;
      })
      .map((icon) => icon.className?.baseVal || icon.className || icon.tagName);
  }, iconSelector);
}

export async function checkStuckSpinners(page, spinnerSelector = '.spinner, .loading, [class*="spin"], .ant-spin') {
  await page.waitForTimeout(2000);
  const spinners = page.locator(spinnerSelector);
  const visible = [];
  const count = await spinners.count();
  for (let i = 0; i < count; i++) {
    if (await spinners.nth(i).isVisible()) {
      visible.push(await spinners.nth(i).evaluate((el) => el.className));
    }
  }
  return visible;
}

export async function checkEmptyState(page, config, context) {
  const selector = resolveTemplate(config.emptyStateSelector || '.empty-state, [data-empty]', context);
  const isEmpty = await page.locator(selector).isVisible().catch(() => false);
  return isEmpty;
}

export async function checkBlankPage(page) {
  const bodyText = await page.locator('body').textContent();
  const hasContent = bodyText && bodyText.trim().length > 10;
  const childCount = await page.locator('body > *').count();
  return !hasContent && childCount <= 1;
}

export async function checkLayoutOverlap(page) {
  return page.evaluate(() => {
    const issues = [];
    const elements = document.querySelectorAll('button, a, input, [role="button"]');
    const rects = [...elements].map((el) => ({ el, rect: el.getBoundingClientRect() })).filter((r) => r.rect.width > 0);

    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i].rect;
        const b = rects[j].rect;
        const overlap =
          a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        if (overlap) {
          const overlapArea =
            (Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
            (Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
          const smallerArea = Math.min(a.width * a.height, b.width * b.height);
          if (overlapArea > smallerArea * 0.5) {
            issues.push({ a: rects[i].el.tagName, b: rects[j].el.tagName });
          }
        }
      }
    }
    return issues.slice(0, 5);
  });
}

export async function runUiHealthChecks(page, healthConfig = {}, context = {}) {
  const issues = [];

  const brokenImages = await checkBrokenImages(page);
  if (brokenImages.length > 0) {
    issues.push({ type: 'broken-images', count: brokenImages.length, details: brokenImages.slice(0, 5) });
  }

  const spinnerSelector = healthConfig.spinnerSelector || '.spinner, .loading, [class*="spin"], .ant-spin';
  const stuckSpinners = await checkStuckSpinners(page, spinnerSelector);
  if (stuckSpinners.length > 0 && !healthConfig.allowSpinners) {
    issues.push({ type: 'stuck-spinners', count: stuckSpinners.length });
  }

  const isBlank = await checkBlankPage(page);
  if (isBlank) {
    issues.push({ type: 'blank-page' });
  }

  if (context.pageErrors?.length > 0) {
    issues.push({ type: 'js-errors', count: context.pageErrors.length, details: context.pageErrors.slice(0, 3) });
  }

  if (context.networkErrors?.length > 0) {
    issues.push({ type: 'network-errors', count: context.networkErrors.length });
  }

  return issues;
}
