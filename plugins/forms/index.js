import { expect } from '@playwright/test';
import { loginViaUI } from '../../helpers/uiLogin.js';
import { fillForm, submitForm, verifyFormPersistence } from '../../helpers/forms.js';
import { expectNotification } from '../../helpers/notifications.js';
import { resolveTemplate } from '../../helpers/template.js';
import { verifyNetworkAction, assertNoNetworkErrors } from '../../helpers/network.js';

const formsPlugin = {
  id: 'forms',
  priority: 40,
  isEnabled: (config) => config.forms.length > 0,

  register({ test, config, context }) {
    const frontendUrl = config.frontendUrl || config.baseUrl;

    for (const form of config.forms) {
      test(`Form - ${form.name}`, { tag: form.tags }, async ({ page }) => {
        if (form.requiresAuth !== false) await loginViaUI(page, config);

        await page.goto(`${frontendUrl}${resolveTemplate(form.path, context)}`, { waitUntil: 'domcontentloaded' });

        if (form.openModal) {
          await page.click(resolveTemplate(form.openModal, context));
          await page.waitForSelector(resolveTemplate(form.modalSelector || '[role="dialog"]', context));
        }

        await fillForm(page, form, context);
        await submitForm(page, form, context);

        if (form.expectNotification) {
          await expectNotification(page, form.expectNotification, context);
        }

        if (form.expectRedirect) {
          await page.waitForURL(resolveTemplate(form.expectRedirect, context), { timeout: 10000 });
        }

        if (form.expectNetwork) {
          verifyNetworkAction(context, form.expectNetwork);
        }

        if (form.verifyNetwork !== false) {
          assertNoNetworkErrors(context, form.networkIgnore || {});
        }

        if (form.verifyPersistence) {
          if (form.detailsPath) {
            await page.goto(`${frontendUrl}${resolveTemplate(form.detailsPath, context)}`, { waitUntil: 'domcontentloaded' });
          }
          await verifyFormPersistence(page, form, context);
        }

        if (form.reopenPath) {
          await page.goto(`${frontendUrl}${resolveTemplate(form.reopenPath, context)}`, { waitUntil: 'domcontentloaded' });
          await verifyFormPersistence(page, form, context);
        }
      });
    }
  },
};

export default formsPlugin;
