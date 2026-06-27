import { expect } from '@playwright/test';
import { loginViaUI } from '../../helpers/uiLogin.js';
import { fillFormField, submitForm } from '../../helpers/forms.js';
import { resolveTemplate } from '../../helpers/template.js';

const BUILTIN_RULES = {
  required: { value: '', expectMessage: /required|mandatory|cannot be empty/i },
  invalidEmail: { field: 'email', value: 'not-an-email', expectMessage: /valid email|invalid email/i },
  tooShort: { minLength: true, value: 'a', expectMessage: /at least|minimum|too short/i },
  tooLong: { maxLength: true, value: 'x'.repeat(500), expectMessage: /at most|maximum|too long/i },
  negativeNumber: { field: 'number', value: '-1', expectMessage: /positive|greater than|minimum/i },
  invalidFormat: { expectMessage: /invalid|format|pattern/i },
  duplicate: { expectMessage: /already exists|duplicate|taken/i },
};

const validatorsPlugin = {
  id: 'validators',
  priority: 50,
  isEnabled: (config) => config.validations.length > 0,

  register({ test, config, context }) {
    const frontendUrl = config.frontendUrl || config.baseUrl;

    for (const validation of config.validations) {
      const rules = validation.rules || [validation];

      for (const rule of rules) {
        test(`Validation - ${validation.name}: ${rule.type || rule.name}`, { tag: validation.tags }, async ({ page }) => {
          if (validation.requiresAuth !== false) await loginViaUI(page, config);

          await page.goto(`${frontendUrl}${resolveTemplate(validation.path, context)}`, { waitUntil: 'domcontentloaded' });

          if (validation.openModal) {
            await page.click(resolveTemplate(validation.openModal, context));
          }

          const builtin = BUILTIN_RULES[rule.type];
          const field = rule.field || validation.field;
          const fieldConfig = {
            selector: field.selector || validation.fieldSelector,
            type: field.type || 'text',
            value: rule.value ?? builtin?.value ?? '',
          };

          if (rule.skipFields) {
            const allFields = validation.fields || [];
            for (const f of allFields) {
              if (!rule.skipFields.includes(f.name)) {
                await fillFormField(page, f, context);
              }
            }
          } else if (validation.fields) {
            for (const f of validation.fields) {
              if (f.name !== field.name) await fillFormField(page, f, context);
            }
          }

          await fillFormField(page, { ...fieldConfig, selector: resolveTemplate(fieldConfig.selector, context) }, context);
          await submitForm(page, validation, context);

          const messagePattern = rule.expectMessage || builtin?.expectMessage;
          const errorSelector = resolveTemplate(
            rule.errorSelector || validation.errorSelector || '.error, .invalid-feedback, [role="alert"], .ant-form-item-explain-error',
            context
          );

          if (messagePattern) {
            const errorText = await page.locator(errorSelector).first().textContent({ timeout: 5000 }).catch(() => '');
            const pattern = messagePattern instanceof RegExp ? messagePattern : new RegExp(messagePattern, 'i');
            expect(errorText || page.url()).toMatch(pattern);
          }

          if (rule.expectStatus) {
            // API validation test
            expect(context.lastResponse?.status).toBe(rule.expectStatus);
          }
        });
      }
    }
  },
};

export default validatorsPlugin;
