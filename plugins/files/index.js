import { expect } from '@playwright/test';
import { loginViaUI } from '../../helpers/uiLogin.js';
import { resolveTemplate } from '../../helpers/template.js';
import fs from 'fs';
import path from 'path';

const filesPlugin = {
  id: 'files',
  priority: 55,
  isEnabled: (config) => config.files.length > 0,

  register({ test, config, context }) {
    const frontendUrl = config.frontendUrl || config.baseUrl;

    for (const fileTest of config.files) {
      test(`File - ${fileTest.name}`, { tag: fileTest.tags }, async ({ page }) => {
        if (fileTest.requiresAuth !== false) await loginViaUI(page, config);
        await page.goto(`${frontendUrl}${resolveTemplate(fileTest.path, context)}`, { waitUntil: 'domcontentloaded' });

        if (fileTest.openModal) {
          await page.click(resolveTemplate(fileTest.openModal, context));
        }

        if (fileTest.upload) {
          const filePath = resolveTemplate(fileTest.upload.filePath, context);
          if (!fs.existsSync(filePath)) {
            // Create a minimal test file if it doesn't exist
            const dir = path.dirname(filePath);
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(filePath, fileTest.upload.content || 'QA test file content');
          }

          await page.setInputFiles(
            resolveTemplate(fileTest.upload.inputSelector, context),
            filePath
          );

          if (fileTest.upload.submitSelector) {
            await page.click(resolveTemplate(fileTest.upload.submitSelector, context));
          }

          if (fileTest.upload.expectSuccess) {
            await page.waitForSelector(
              resolveTemplate(fileTest.upload.successSelector || '.success, [data-success]', context),
              { timeout: 10000 }
            );
          }
        }

        if (fileTest.invalidUpload) {
          const invalidPath = resolveTemplate(fileTest.invalidUpload.filePath, context);
          if (!fs.existsSync(invalidPath)) {
            fs.mkdirSync(path.dirname(invalidPath), { recursive: true });
            fs.writeFileSync(invalidPath, 'invalid content');
          }

          await page.setInputFiles(
            resolveTemplate(fileTest.invalidUpload.inputSelector, context),
            invalidPath
          );

          if (fileTest.invalidUpload.submitSelector) {
            await page.click(resolveTemplate(fileTest.invalidUpload.submitSelector, context));
          }

          const errorSelector = resolveTemplate(
            fileTest.invalidUpload.errorSelector || '.error, [role="alert"]',
            context
          );
          await expect(page.locator(errorSelector).first()).toBeVisible({ timeout: 5000 });
        }

        if (fileTest.download) {
          const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 15000 }),
            page.click(resolveTemplate(fileTest.download.triggerSelector, context)),
          ]);

          const filename = download.suggestedFilename();
          expect(filename).toBeTruthy();

          if (fileTest.download.expectExtension) {
            expect(filename).toMatch(new RegExp(`\\.${fileTest.download.expectExtension}$`));
          }
        }

        if (fileTest.preview) {
          await page.click(resolveTemplate(fileTest.preview.triggerSelector, context));
          await expect(page.locator(resolveTemplate(fileTest.preview.viewerSelector, context)).first()).toBeVisible();
        }

        if (fileTest.delete) {
          await page.click(resolveTemplate(fileTest.delete.triggerSelector, context));
          if (fileTest.delete.confirmSelector) {
            await page.click(resolveTemplate(fileTest.delete.confirmSelector, context));
          }
          await expect(page.locator(resolveTemplate(fileTest.delete.absentSelector, context))).not.toBeVisible({ timeout: 5000 });
        }
      });
    }
  },
};

export default filesPlugin;
