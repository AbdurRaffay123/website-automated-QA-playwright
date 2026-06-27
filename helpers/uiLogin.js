/**
 * Generic UI login helper — works with any project config that defines uiLogin.
 */
export async function loginViaUI(page, config, credentials = null) {
  const frontendUrl = config.frontendUrl || config.baseUrl;
  const login = credentials
    ? { ...config.uiLogin, username: credentials.username, password: credentials.password }
    : config.uiLogin;

  if (!login) return;

  await page.goto(`${frontendUrl}${login.path}`);
  await page.fill(login.usernameSelector, login.username);
  await page.fill(login.passwordSelector, login.password);
  await page.click(login.submitSelector);
  await page.waitForURL(login.successUrlPattern || '**/*', { timeout: 15000 });
}

export async function logoutViaUI(page, config) {
  const logout = config.uiLogout;
  if (!logout) return;

  if (logout.selector) {
    await page.click(logout.selector);
  }
  if (logout.confirmSelector) {
    await page.click(logout.confirmSelector);
  }
  if (logout.successUrlPattern) {
    await page.waitForURL(logout.successUrlPattern, { timeout: 10000 });
  }
}
