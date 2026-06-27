import { resolveTemplate } from './template.js';

/**
 * Generic form field filler — supports all common input types via config.
 */
export async function fillFormField(page, field, context) {
  const selector = resolveTemplate(field.selector, context);
  const value = field.value !== undefined ? resolveTemplate(field.value, context) : undefined;
  const type = field.type || 'text';

  switch (type) {
    case 'text':
    case 'email':
    case 'password':
    case 'number':
    case 'tel':
    case 'url':
      await page.fill(selector, String(value ?? ''));
      break;

    case 'textarea':
      await page.fill(selector, String(value ?? ''));
      break;

    case 'select':
    case 'dropdown':
      await page.selectOption(selector, String(value));
      break;

    case 'radio':
      await page.check(`${selector}[value="${value}"]`);
      break;

    case 'checkbox':
      if (value === true || value === 'true') {
        await page.check(selector);
      } else {
        await page.uncheck(selector);
      }
      break;

    case 'multiselect':
      await page.selectOption(selector, Array.isArray(value) ? value.map(String) : [String(value)]);
      break;

    case 'autocomplete': {
      await page.fill(selector, String(value ?? ''));
      if (field.optionSelector) {
        const optionSel = resolveTemplate(field.optionSelector, context);
        await page.waitForSelector(optionSel, { timeout: 5000 });
        await page.click(optionSel);
      } else if (field.optionText) {
        await page.getByRole('option', { name: field.optionText }).click();
      } else {
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
      }
      break;
    }

    case 'date':
    case 'datetime':
      await page.fill(selector, String(value ?? ''));
      break;

    case 'datepicker':
      await page.click(selector);
      if (field.dateValue) {
        const dateSel = resolveTemplate(field.dateValue, context);
        await page.click(dateSel);
      }
      break;

    case 'file':
      if (field.filePath) {
        await page.setInputFiles(selector, resolveTemplate(field.filePath, context));
      }
      break;

    case 'hidden':
      await page.evaluate(
        ({ sel, val }) => {
          const el = document.querySelector(sel);
          if (el) el.value = val;
        },
        { sel: selector, val: String(value ?? '') }
      );
      break;

    default:
      await page.fill(selector, String(value ?? ''));
  }
}

export async function fillForm(page, formConfig, context) {
  for (const field of formConfig.fields || []) {
    if (field.skip) continue;
    await fillFormField(page, field, context);
  }
}

export async function submitForm(page, formConfig, context) {
  const submitSelector = formConfig.submitSelector || 'button[type="submit"]';
  await page.click(resolveTemplate(submitSelector, context));
}

export async function verifyFormPersistence(page, formConfig, context) {
  const checks = formConfig.verifyFields || formConfig.fields || [];
  for (const field of checks) {
    if (!field.verifySelector && !field.selector) continue;
    const selector = resolveTemplate(field.verifySelector || field.selector, context);
    const expected = resolveTemplate(field.value, context);
    const locator = page.locator(selector).first();
    const tag = await locator.evaluate((el) => el.tagName.toLowerCase()).catch(() => '');

    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      await expectValue(locator, expected);
    } else {
      const text = await locator.textContent();
      if (expected && !text?.includes(String(expected))) {
        throw new Error(`Expected "${expected}" in ${selector}, got "${text}"`);
      }
    }
  }
}

async function expectValue(locator, expected) {
  const inputType = await locator.getAttribute('type').catch(() => 'text');
  if (inputType === 'checkbox') {
    const checked = await locator.isChecked();
    const wantChecked = expected === true || expected === 'true';
    if (checked !== wantChecked) throw new Error(`Checkbox expected ${wantChecked}, got ${checked}`);
  } else {
    const val = await locator.inputValue().catch(async () => locator.textContent());
    if (expected && !String(val).includes(String(expected))) {
      throw new Error(`Expected "${expected}" in field, got "${val}"`);
    }
  }
}
