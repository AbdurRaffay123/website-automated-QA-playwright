import { expect } from '@playwright/test';
import { resolveTemplate, getByPath } from '../../helpers/template.js';
import { setVariable, trackCreatedRecord } from '../../core/context.js';
import { loginViaUI } from '../../helpers/uiLogin.js';
import { fillForm, submitForm } from '../../helpers/forms.js';
import { expectNotification } from '../../helpers/notifications.js';
import { verifyNetworkAction } from '../../helpers/network.js';

/**
 * Execute a single workflow step — supports api, ui, form, verify, wait, search actions.
 */
async function executeStep(step, { request, page, config, context, authHeaders }) {
  const frontendUrl = config.frontendUrl || config.baseUrl;

  switch (step.action) {
    case 'api': {
      const path = resolveTemplate(step.path, context);
      const body = step.body ? resolveTemplate(step.body, context) : undefined;
      const url = `${config.baseUrl}${path}`;
      const headers = step.auth === false ? {} : authHeaders;
      const res = await request[step.method.toLowerCase()](url, { headers, data: body });
      const status = res.status();
      const expected = step.expectStatus || [200, 201, 204];

      if (step.knownIssue && !expected.includes(status)) {
        return { skipped: true, knownIssue: step.knownIssue };
      }

      expect(expected).toContain(status);

      if (step.saveAs || step.saveResponseField) {
        const json = await res.json().catch(() => null);
        const saveConfig = step.saveAs
          ? { as: step.saveAs, path: step.savePath || 'data.uuid' }
          : step.saveResponseField;
        const value = getByPath(json, saveConfig.path);
        if (value !== undefined) {
          setVariable(context, saveConfig.as, value);
          if (step.trackRecord) {
            trackCreatedRecord(context, { id: value, type: step.trackRecord, path });
          }
        }
      }

      if (step.expectResponseContains) {
        const json = await res.json().catch(() => null);
        for (const [key, val] of Object.entries(step.expectResponseContains)) {
          expect(getByPath(json, key)).toEqual(resolveTemplate(val, context));
        }
      }
      break;
    }

    case 'ui': {
      if (step.requiresAuth) await loginViaUI(page, config);
      await page.goto(`${frontendUrl}${resolveTemplate(step.path, context)}`, { waitUntil: 'domcontentloaded' });

      if (step.expectSelector) {
        await expect(page.locator(resolveTemplate(step.expectSelector, context)).first()).toBeVisible({ timeout: 8000 });
      }

      if (step.expectText) {
        await expect(page.getByText(resolveTemplate(step.expectText, context))).toBeVisible();
      }
      break;
    }

    case 'form': {
      if (step.navigateTo) {
        await page.goto(`${frontendUrl}${resolveTemplate(step.navigateTo, context)}`, { waitUntil: 'domcontentloaded' });
      }
      await fillForm(page, step, context);
      if (step.submit !== false) await submitForm(page, step, context);
      break;
    }

    case 'click': {
      await page.click(resolveTemplate(step.selector, context));
      break;
    }

    case 'verify-notification': {
      await expectNotification(page, step, context);
      break;
    }

    case 'verify-network': {
      verifyNetworkAction(context, step);
      break;
    }

    case 'verify-absent': {
      const selector = resolveTemplate(step.selector, context);
      await expect(page.locator(selector)).not.toBeVisible({ timeout: step.timeout || 5000 });
      break;
    }

    case 'verify-present': {
      const selector = resolveTemplate(step.selector, context);
      await expect(page.locator(selector).first()).toBeVisible({ timeout: step.timeout || 8000 });
      break;
    }

    case 'search': {
      const inputSelector = resolveTemplate(step.inputSelector, context);
      await page.fill(inputSelector, resolveTemplate(step.query, context));
      if (step.submitSelector) {
        await page.click(resolveTemplate(step.submitSelector, context));
      } else {
        await page.keyboard.press('Enter');
      }
      await page.waitForTimeout(step.waitMs || 500);
      if (step.expectContains) {
        const text = await page.locator(resolveTemplate(step.resultsSelector || 'body', context)).textContent();
        expect(text?.toLowerCase()).toContain(String(step.expectContains).toLowerCase());
      }
      break;
    }

    case 'wait': {
      await page.waitForTimeout(step.ms || 1000);
      break;
    }

    case 'refresh': {
      await page.reload({ waitUntil: 'domcontentloaded' });
      break;
    }

    default:
      throw new Error(`Unknown workflow step action: ${step.action}`);
  }

  return { success: true };
}

const workflowsPlugin = {
  id: 'workflows',
  priority: 30,
  isEnabled: (config) => config.workflows.length > 0,

  register({ test, config, context, authHeadersRef }) {
    const frontendUrl = config.frontendUrl || config.baseUrl;

    for (const workflow of config.workflows) {
      const runWorkflow = async ({ request, page }) => {
        if (workflow.beforeEach) {
          for (const hook of workflow.beforeEach) {
            await executeStep(hook, { request, page, config, context, authHeaders: authHeadersRef.current });
          }
        }

        for (const step of workflow.steps) {
          const result = await executeStep(step, { request, page, config, context, authHeaders: authHeadersRef.current });
          if (result?.skipped) {
            test.fixme(true, result.knownIssue);
            return;
          }
        }

        if (workflow.afterEach) {
          for (const hook of workflow.afterEach) {
            await executeStep(hook, { request, page, config, context, authHeaders: authHeadersRef.current });
          }
        }
      };

      const needsPage = workflow.steps.some((s) => ['ui', 'form', 'click', 'search', 'verify-present', 'verify-absent', 'refresh'].includes(s.action));
      const tags = workflow.tags || [];

      if (needsPage) {
        test(`Workflow - ${workflow.name}`, { tag: tags }, async ({ request, page }) => {
          if (workflow.requiresAuth) await loginViaUI(page, config);
          await runWorkflow({ request, page });
        });
      } else {
        test(`Workflow - ${workflow.name}`, { tag: tags }, async ({ request }) => {
          await runWorkflow({ request, page: null });
        });
      }
    }
  },
};

export default workflowsPlugin;
export { executeStep };
