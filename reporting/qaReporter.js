import fs from 'fs';
import path from 'path';

/**
 * Custom HTML reporter that extends Playwright results with QA-specific metadata.
 */
export default class QAReporter {
  constructor(options = {}) {
    this.outputDir = options.outputDir || 'reports/qa';
    this.results = [];
    this.startTime = Date.now();
  }

  onBegin(config, suite) {
    this.config = config;
    this.totalTests = suite.allTests().length;
  }

  onTestEnd(test, result) {
    const entry = {
      title: test.title,
      status: result.status,
      duration: result.duration,
      annotations: result.annotations,
      errors: result.errors.map((e) => e.message),
      attachments: result.attachments.map((a) => ({ name: a.name, path: a.path, contentType: a.contentType })),
      retry: result.retry,
    };

    const knownIssue = result.annotations.find((a) => a.type === 'known-issue');
    if (knownIssue) entry.knownIssue = knownIssue.description;

    const perfWarning = result.annotations.find((a) => a.type === 'performance-warning');
    if (perfWarning) entry.performanceWarning = perfWarning.description;

    const a11yViolation = result.annotations.find((a) => a.type === 'a11y-violations');
    if (a11yViolation) entry.a11yViolations = a11yViolation.description;

    this.results.push(entry);
  }

  onEnd(result) {
    const endTime = Date.now();
    const passed = this.results.filter((r) => r.status === 'passed').length;
    const failed = this.results.filter((r) => r.status === 'failed').length;
    const skipped = this.results.filter((r) => r.status === 'skipped').length;
    const knownIssues = this.results.filter((r) => r.knownIssue).length;
    const perfWarnings = this.results.filter((r) => r.performanceWarning);

    const report = {
      generatedAt: new Date().toISOString(),
      project: process.env.PROJECT || 'unknown',
      summary: {
        total: this.results.length,
        passed,
        failed,
        skipped,
        knownIssues,
        performanceWarnings: perfWarnings.length,
        durationMs: endTime - this.startTime,
      },
      results: this.results,
    };

    fs.mkdirSync(this.outputDir, { recursive: true });
    fs.writeFileSync(path.join(this.outputDir, 'qa-report.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(this.outputDir, 'qa-report.html'), this.generateHtml(report));
  }

  generateHtml(report) {
    const { summary, results } = report;
    const rows = results
      .map((r) => {
        const statusClass = r.status === 'passed' ? 'pass' : r.status === 'failed' ? 'fail' : 'skip';
        const extras = [
          r.knownIssue ? `<span class="tag known">Known Issue</span>` : '',
          r.performanceWarning ? `<span class="tag warn">Perf Warning</span>` : '',
          r.a11yViolations ? `<span class="tag warn">A11y</span>` : '',
        ].filter(Boolean).join(' ');

        const screenshots = r.attachments
          .filter((a) => a.contentType?.includes('image'))
          .map((a) => `<img src="${a.path}" alt="screenshot" style="max-width:200px" />`)
          .join('');

        return `<tr class="${statusClass}">
          <td>${r.title}</td>
          <td class="${statusClass}">${r.status}</td>
          <td>${(r.duration / 1000).toFixed(2)}s</td>
          <td>${extras}</td>
          <td>${r.errors.join('<br>') || ''}</td>
          <td>${screenshots}</td>
        </tr>`;
      })
      .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>QA Report - ${report.project}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; padding: 2rem; }
    h1 { margin-bottom: 0.5rem; }
    .meta { color: #666; margin-bottom: 2rem; }
    .summary { display: flex; gap: 1rem; margin-bottom: 2rem; flex-wrap: wrap; }
    .card { background: white; border-radius: 8px; padding: 1.5rem; min-width: 120px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .card .num { font-size: 2rem; font-weight: bold; }
    .card.pass .num { color: #22c55e; }
    .card.fail .num { color: #ef4444; }
    .card.skip .num { color: #f59e0b; }
    .card.warn .num { color: #f97316; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th { background: #1e293b; color: white; padding: 0.75rem 1rem; text-align: left; }
    td { padding: 0.75rem 1rem; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    tr.fail td { background: #fef2f2; }
    tr.pass td:first-child + td { color: #22c55e; font-weight: 600; }
    tr.skip td:first-child + td { color: #f59e0b; }
    .tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; margin-right: 4px; }
    .tag.known { background: #fef3c7; color: #92400e; }
    .tag.warn { background: #ffedd5; color: #9a3412; }
  </style>
</head>
<body>
  <h1>QA Automation Report</h1>
  <p class="meta">Project: <strong>${report.project}</strong> · Generated: ${report.generatedAt} · Duration: ${(summary.durationMs / 1000).toFixed(1)}s</p>

  <div class="summary">
    <div class="card"><div class="num">${summary.total}</div><div>Total</div></div>
    <div class="card pass"><div class="num">${summary.passed}</div><div>Passed</div></div>
    <div class="card fail"><div class="num">${summary.failed}</div><div>Failed</div></div>
    <div class="card skip"><div class="num">${summary.skipped}</div><div>Skipped</div></div>
    <div class="card warn"><div class="num">${summary.knownIssues}</div><div>Known Issues</div></div>
    <div class="card warn"><div class="num">${summary.performanceWarnings}</div><div>Perf Warnings</div></div>
  </div>

  <table>
    <thead>
      <tr><th>Test</th><th>Status</th><th>Duration</th><th>Tags</th><th>Errors</th><th>Screenshots</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
  }
}
