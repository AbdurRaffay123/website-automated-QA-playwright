import { loginViaUI } from '../../helpers/uiLogin.js';
import { expectNotification, expectModal, expectConfirmationDialog } from '../../helpers/notifications.js';
import { resolveTemplate } from '../../helpers/template.js';

const notificationsPlugin = {
  id: 'notifications',
  priority: 65,
  isEnabled: (config) => config.notifications.length > 0,

  register({ test, config, context }) {
    const frontendUrl = config.frontendUrl || config.baseUrl;

    for (const notif of config.notifications) {
      test(`Notification - ${notif.name}`, { tag: notif.tags }, async ({ page }) => {
        if (notif.requiresAuth !== false) await loginViaUI(page, config);
        await page.goto(`${frontendUrl}${resolveTemplate(notif.path, context)}`, { waitUntil: 'domcontentloaded' });

        if (notif.triggerSelector) {
          await page.click(resolveTemplate(notif.triggerSelector, context));
        }

        if (notif.type === 'toast' || notif.type === 'alert' || notif.type === 'success' || notif.type === 'error' || notif.type === 'warning') {
          await expectNotification(page, { ...notif, type: notif.type === 'toast' ? notif.expectType : notif.type }, context);
        }

        if (notif.type === 'modal') {
          await expectModal(page, notif, context);
        }

        if (notif.type === 'confirm') {
          await expectConfirmationDialog(page, notif, context);
        }
      });
    }
  },
};

export default notificationsPlugin;
