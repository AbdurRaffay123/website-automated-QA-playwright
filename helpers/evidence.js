import fs from 'fs';
import path from 'path';

/**
 * Automatic evidence collection on test failure.
 */
export async function collectEvidence(page, testInfo, context, options = {}) {
  const evidenceDir = path.join(
    'reports',
    'evidence',
    testInfo.project.name,
    sanitize(testInfo.title)
  );

  fs.mkdirSync(evidenceDir, { recursive: true });
  const evidence = { test: testInfo.title, collectedAt: new Date().toISOString(), artifacts: [] };

  try {
    const screenshotPath = path.join(evidenceDir, 'screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    evidence.artifacts.push({ type: 'screenshot', path: screenshotPath });
  } catch { /* page may be closed */ }

  try {
    const domPath = path.join(evidenceDir, 'dom.html');
    const html = await page.content();
    fs.writeFileSync(domPath, html);
    evidence.artifacts.push({ type: 'dom', path: domPath });
  } catch { /* ignore */ }

  try {
    const consolePath = path.join(evidenceDir, 'console.json');
    const consoleLogs = context.consoleLogs || [];
    fs.writeFileSync(consolePath, JSON.stringify(consoleLogs, null, 2));
    evidence.artifacts.push({ type: 'console', path: consolePath });
  } catch { /* ignore */ }

  try {
    const networkPath = path.join(evidenceDir, 'network.json');
    fs.writeFileSync(networkPath, JSON.stringify(context.networkLog || [], null, 2));
    evidence.artifacts.push({ type: 'network', path: networkPath });
  } catch { /* ignore */ }

  if (context.lastRequest) {
    const reqPath = path.join(evidenceDir, 'last-request.json');
    fs.writeFileSync(reqPath, JSON.stringify(context.lastRequest, null, 2));
    evidence.artifacts.push({ type: 'request', path: reqPath });
  }

  if (context.lastResponse) {
    const resPath = path.join(evidenceDir, 'last-response.json');
    fs.writeFileSync(resPath, JSON.stringify(context.lastResponse, null, 2));
    evidence.artifacts.push({ type: 'response', path: resPath });
  }

  if (testInfo.error) {
    const stackPath = path.join(evidenceDir, 'stack.txt');
    fs.writeFileSync(stackPath, testInfo.error.stack || testInfo.error.message);
    evidence.artifacts.push({ type: 'stack', path: stackPath });
  }

  const summaryPath = path.join(evidenceDir, 'evidence.json');
  fs.writeFileSync(summaryPath, JSON.stringify(evidence, null, 2));

  testInfo.annotations.push({
    type: 'evidence',
    description: `Evidence saved to ${evidenceDir}`,
  });

  return evidence;
}

function sanitize(str) {
  return str.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 80);
}

export function attachPageListeners(page, context) {
  context.consoleLogs = context.consoleLogs || [];
  context.pageErrors = context.pageErrors || [];

  page.on('console', (msg) => {
    context.consoleLogs.push({ type: msg.type(), text: msg.text(), timestamp: Date.now() });
  });

  page.on('pageerror', (err) => {
    context.pageErrors.push({ message: err.message, stack: err.stack, timestamp: Date.now() });
  });
}
