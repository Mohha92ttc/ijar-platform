import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';

/** يسجّل الفشل في JSONL وملخص Markdown لقائمة المشاكل قبل الإطلاق */
export default class AuditReporter implements Reporter {
  private readonly dir: string;
  private readonly jsonl: string;
  private readonly md: string;

  constructor() {
    this.dir = path.join(process.cwd(), 'e2e', 'reports');
    this.jsonl = path.join(this.dir, 'audit-issues.jsonl');
    this.md = path.join(this.dir, 'AUDIT-LAST-RUN.md');
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    if (result.status === 'passed' || result.status === 'skipped') return;
    fs.mkdirSync(this.dir, { recursive: true });
    const payload = {
      timestamp: new Date().toISOString(),
      title: test.titlePath().join(' › '),
      status: result.status,
      durationMs: result.duration,
      error: result.error?.message ?? String(result.error ?? ''),
    };
    fs.appendFileSync(this.jsonl, JSON.stringify(payload, null, 0) + '\n', 'utf8');
  }

  onEnd(result: FullResult): void {
    fs.mkdirSync(this.dir, { recursive: true });
    const lines = [
      `# تقرير آخر تشغيل فحص الإطلاق`,
      ``,
      `- الوقت: ${new Date().toISOString()}`,
      `- الحالة: ${result.status}`,
      `- إجمالي الاختبارات: ${result.duration}ms (مدة التشغيل الكلية للواجهة)`,
      ``,
      `عند الفشل، راجع أيضاً:`,
      `- \`e2e/reports/audit-issues.jsonl\` (سطر لكل فشل)`,
      `- تقرير Playwright: \`npx playwright show-report\` إن وُجد`,
      ``,
    ];
    fs.writeFileSync(this.md, lines.join('\n'), 'utf8');
  }
}
