import { resolveTemplate } from './template.js';

/**
 * Notification, toast, modal, and dialog verification.
 */
export async function expectNotification(page, notificationConfig, context) {
  const selector = resolveTemplate(notificationConfig.selector, context);
  const timeout = notificationConfig.timeout || 8000;

  const locator = notificationConfig.text
    ? page.getByText(resolveTemplate(notificationConfig.text, context))
    : page.locator(selector).first();

  await locator.waitFor({ state: 'visible', timeout });

  if (notificationConfig.type) {
    const className = await locator.getAttribute('class').catch(() => '');
    const dataType = await locator.getAttribute('data-type').catch(() => '');
    const combined = `${className} ${dataType}`.toLowerCase();
    if (!combined.includes(notificationConfig.type.toLowerCase())) {
      throw new Error(`Expected ${notificationConfig.type} notification, element: ${combined}`);
    }
  }
}

export async function expectModal(page, modalConfig, context) {
  const selector = resolveTemplate(modalConfig.selector || '[role="dialog"]', context);
  await page.locator(selector).waitFor({ state: 'visible', timeout: modalConfig.timeout || 5000 });

  if (modalConfig.expectText) {
    const text = await page.locator(selector).textContent();
    const expected = resolveTemplate(modalConfig.expectText, context);
    if (!text?.includes(expected)) {
      throw new Error(`Modal should contain "${expected}", got "${text}"`);
    }
  }

  if (modalConfig.confirmSelector) {
    await page.click(resolveTemplate(modalConfig.confirmSelector, context));
  } else if (modalConfig.dismissSelector) {
    await page.click(resolveTemplate(modalConfig.dismissSelector, context));
  }
}

export async function expectConfirmationDialog(page, dialogConfig, context) {
  const selector = resolveTemplate(dialogConfig.selector || '[role="alertdialog"], .confirm-dialog', context);
  await page.locator(selector).waitFor({ state: 'visible', timeout: 5000 });

  if (dialogConfig.confirmSelector) {
    await page.click(resolveTemplate(dialogConfig.confirmSelector, context));
  }
}

export async function dismissNotification(page, dismissSelector, context) {
  if (dismissSelector) {
    await page.click(resolveTemplate(dismissSelector, context));
  }
}
