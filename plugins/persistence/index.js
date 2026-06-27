import { expect } from '@playwright/test';
import { loginViaUI, logoutViaUI } from '../../helpers/uiLogin.js';
import { resolveTemplate, getByPath } from '../../helpers/template.js';
import { setVariable } from '../../core/context.js';

/**
 * Data persistence verification — ensures created data appears everywhere it should.
 */
const persistencePlugin = {
  id: 'persistence',
  priority: 50,
  isEnabled: (config) => config.persistence.length > 0,

  register({ test, config, context, authHeadersRef }) {
    const frontendUrl = config.frontendUrl || config.baseUrl;

    for (const check of config.persistence) {
      test(`Persistence - ${check.name}`, { tag: check.tags }, async ({ page, request }) => {
        const authHeaders = authHeadersRef.current;

        // Create record via API if setup step provided
        if (check.create) {
          const create = check.create;
          const path = resolveTemplate(create.path, context);
          const body = create.body ? resolveTemplate(create.body, context) : undefined;
          const res = await request[create.method.toLowerCase()](`${config.baseUrl}${path}`, {
            headers: authHeaders,
            data: body,
          });
          expect(create.expectStatus || [200, 201]).toContain(res.status());

          if (create.saveAs) {
            const json = await res.json().catch(() => null);
            setVariable(context, create.saveAs, getByPath(json, create.savePath || 'data.uuid'));
          }
        }

        const recordId = context.variables[check.idVariable || check.saveAs];
        if (!recordId && check.requireId !== false) {
          throw new Error(`Persistence check "${check.name}" missing id variable`);
        }

        // Verify in listing page
        if (check.listingPage) {
          if (check.listingPage.requiresAuth !== false) await loginViaUI(page, config);
          await page.goto(`${frontendUrl}${resolveTemplate(check.listingPage.path, context)}`, { waitUntil: 'domcontentloaded' });

          const searchQuery = resolveTemplate(check.listingPage.searchQuery || recordId, context);
          if (check.listingPage.searchInput) {
            await page.fill(resolveTemplate(check.listingPage.searchInput, context), searchQuery);
            await page.keyboard.press('Enter');
            await page.waitForTimeout(500);
          }

          const rowSelector = resolveTemplate(check.listingPage.rowSelector || 'tbody tr', context);
          const rowText = await page.locator(rowSelector).textContent();
          expect(rowText).toContain(resolveTemplate(check.listingPage.expectContains || searchQuery, context));
        }

        // Verify on details page
        if (check.detailsPage) {
          await page.goto(`${frontendUrl}${resolveTemplate(check.detailsPage.path, context)}`, { waitUntil: 'domcontentloaded' });
          for (const field of check.detailsPage.expectFields || []) {
            const text = await page.locator(resolveTemplate(field.selector, context)).textContent();
            expect(text).toContain(resolveTemplate(field.value, context));
          }
        }

        // Verify on edit page
        if (check.editPage) {
          await page.goto(`${frontendUrl}${resolveTemplate(check.editPage.path, context)}`, { waitUntil: 'domcontentloaded' });
          for (const field of check.editPage.expectFields || []) {
            const val = await page.locator(resolveTemplate(field.selector, context)).inputValue().catch(async () => {
              return page.locator(resolveTemplate(field.selector, context)).textContent();
            });
            expect(String(val)).toContain(String(resolveTemplate(field.value, context)));
          }
        }

        // Verify via API
        if (check.apiVerify) {
          const path = resolveTemplate(check.apiVerify.path, context);
          const res = await request.get(`${config.baseUrl}${path}`, { headers: authHeaders });
          expect(res.status()).toBe(200);
          const json = await res.json();
          for (const [keypath, expected] of Object.entries(check.apiVerify.expectFields || {})) {
            expect(getByPath(json, keypath)).toEqual(resolveTemplate(expected, context));
          }
        }

        // Verify after page refresh
        if (check.afterRefresh && check.detailsPage) {
          await page.reload({ waitUntil: 'domcontentloaded' });
          for (const field of check.detailsPage.expectFields || []) {
            const text = await page.locator(resolveTemplate(field.selector, context)).textContent();
            expect(text).toContain(resolveTemplate(field.value, context));
          }
        }

        // Verify after logout/login
        if (check.afterRelogin) {
          await logoutViaUI(page, config);
          await loginViaUI(page, config);
          await page.goto(`${frontendUrl}${resolveTemplate(check.detailsPage?.path || check.listingPage?.path, context)}`, {
            waitUntil: 'domcontentloaded',
          });
          const selector = check.detailsPage?.expectFields?.[0]?.selector || check.listingPage?.rowSelector;
          if (selector) {
            await expect(page.locator(resolveTemplate(selector, context)).first()).toBeVisible();
          }
        }
      });
    }
  },
};

export default persistencePlugin;
