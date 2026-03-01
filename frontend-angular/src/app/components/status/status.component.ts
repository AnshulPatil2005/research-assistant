import { CommonModule } from '@angular/common';
import { Component, OnDestroy, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TaskProcessingInfo, TaskResult, TaskStatus } from '../../models/api.models';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-status',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="card">
      <div class="card-header">
        <div>
          <span class="eyebrow">Step 2</span>
          <h2>Watch the ingestion pipeline</h2>
          <p class="intro">
            Paste a task ID or let uploads feed this panel automatically. While a job is active,
            the component polls in the background so the demo keeps moving without manual refresh.
          </p>
        </div>

        <div class="live-badge" [class.active]="isLive()">
          <span class="live-dot"></span>
          {{ isLive() ? 'Auto-refreshing' : 'Idle' }}
        </div>
      </div>

      <div class="controls">
        <input
          type="text"
          [(ngModel)]="taskId"
          placeholder="Paste task ID"
          class="task-input"
        />

        <button
          class="check-btn"
          (click)="checkStatus()"
          [disabled]="!taskId || isLoading()"
          type="button"
        >
          @if (isLoading()) {
            <span class="spinner"></span>
            Checking
          } @else {
            Check status
          }
        </button>
      </div>

      @if (result()) {
        <div class="result-card" [ngClass]="getResultClass()">
          <div class="status-row">
            <div>
              <span class="meta-label">Pipeline status</span>
              <div class="status-title-row">
                <strong>{{ result()!.status }}</strong>
                <span class="status-badge" [ngClass]="result()!.status.toLowerCase()">
                  {{ statusTone(result()!.status) }}
                </span>
              </div>
            </div>

            <div class="task-id-badge">
              <span>Task</span>
              <code>{{ truncate(result()!.task_id) }}</code>
            </div>
          </div>

          @if (result()!.status === 'PROCESSING' || result()!.status === 'STARTED' || result()!.status === 'PENDING') {
            <div class="processing-card">
              <span class="spinner amber"></span>
              <div>
                <strong>{{ result()!.info?.step || 'Processing document and building retrieval assets.' }}</strong>
                <p>The panel will refresh automatically every few seconds until the task completes.</p>
              </div>
            </div>
          }

          @if (result()!.status === 'SUCCESS') {
            <div class="stats-grid">
              @if (getTaskResult()?.doc_id) {
                <div class="stat-box">
                  <span class="meta-label">Doc ID</span>
                  <code>{{ truncate(getTaskResult()!.doc_id!) }}</code>
                </div>
              }
              @if (getTaskResult()?.chunks_count !== undefined && getTaskResult()?.chunks_count !== null) {
                <div class="stat-box">
                  <span class="meta-label">Chunks</span>
                  <strong>{{ getTaskResult()!.chunks_count }}</strong>
                </div>
              }
              @if (getTaskResult()?.claims_count !== undefined && getTaskResult()?.claims_count !== null) {
                <div class="stat-box">
                  <span class="meta-label">Claims</span>
                  <strong>{{ getTaskResult()!.claims_count }}</strong>
                </div>
              }
              @if (getTaskResult()?.pdf_type) {
                <div class="stat-box">
                  <span class="meta-label">PDF Type</span>
                  <strong>{{ getTaskResult()!.pdf_type }}</strong>
                </div>
              }
            </div>
          }

          @if (result()!.status === 'FAILURE' && result()!.error) {
            <div class="error-box">
              <span class="meta-label">Failure reason</span>
              <p>{{ result()!.error }}</p>
            </div>
          }

          @if (ocrDetails(); as ocr) {
            <div class="ocr-grid">
              <div class="ocr-box">
                <span class="meta-label">OCR mode</span>
                <strong>{{ formatOcrMode(ocr.ocr_mode) }}</strong>
              </div>
              <div class="ocr-box">
                <span class="meta-label">Extraction path</span>
                <strong>{{ formatIngestionMode(ocr.ingestion_mode) }}</strong>
              </div>
              <div class="ocr-box">
                <span class="meta-label">OCR result</span>
                <strong [class.warning]="ocr.ocr_skipped">{{ getOcrStatusText(ocr) }}</strong>
              </div>
            </div>
          }
        </div>
      }

      @if (error()) {
        <div class="error-box standalone">
          <span class="meta-label">Request error</span>
          <p>{{ error() }}</p>
        </div>
      }
    </section>
  `,
  styles: [`
    .card {
      padding: 1.5rem;
      border-radius: var(--radius-xl);
      background: var(--color-panel);
      border: 1px solid rgba(255, 255, 255, 0.78);
      box-shadow: var(--surface-shadow-soft);
      backdrop-filter: blur(18px);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: flex-start;
    }

    .eyebrow {
      display: inline-flex;
      margin-bottom: 0.7rem;
      color: var(--color-secondary);
      font-size: 0.76rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }

    h2 {
      font-family: var(--font-display);
      font-size: 1.85rem;
      line-height: 1;
      letter-spacing: -0.04em;
    }

    .intro {
      margin: 0.7rem 0 0;
      color: var(--color-muted);
      line-height: 1.7;
      max-width: 54ch;
    }

    .live-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.55rem;
      padding: 0.55rem 0.85rem;
      border-radius: 999px;
      background: rgba(18, 32, 58, 0.07);
      color: var(--color-muted);
      font-size: 0.78rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      white-space: nowrap;
    }

    .live-badge.active {
      background: var(--color-success-soft);
      color: var(--color-success);
    }

    .live-dot {
      width: 9px;
      height: 9px;
      border-radius: 999px;
      background: currentColor;
      box-shadow: 0 0 0 5px rgba(18, 32, 58, 0.08);
    }

    .live-badge.active .live-dot {
      animation: pulse 1.4s ease-in-out infinite;
      box-shadow: 0 0 0 5px rgba(29, 138, 82, 0.12);
    }

    .controls {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 0.85rem;
      margin-top: 1.2rem;
    }

    .task-input {
      min-height: 52px;
      padding: 0.85rem 1rem;
      border-radius: 18px;
      border: 1px solid var(--color-border);
      background: rgba(255, 255, 255, 0.8);
      color: var(--color-ink);
    }

    .task-input:focus {
      outline: none;
      border-color: rgba(26, 145, 255, 0.28);
      box-shadow: 0 0 0 4px rgba(26, 145, 255, 0.12);
    }

    .check-btn {
      min-width: 152px;
      min-height: 52px;
      border: 0;
      border-radius: 18px;
      background: rgba(18, 32, 58, 0.08);
      color: var(--color-ink);
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.6rem;
      transition: transform 0.2s ease, background 0.2s ease, opacity 0.2s ease;
    }

    .check-btn:hover:not(:disabled) {
      transform: translateY(-2px);
      background: rgba(18, 32, 58, 0.12);
    }

    .check-btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .spinner {
      width: 15px;
      height: 15px;
      border: 2px solid rgba(18, 32, 58, 0.2);
      border-top-color: currentColor;
      border-radius: 999px;
      animation: spin 0.75s linear infinite;
      flex-shrink: 0;
    }

    .spinner.amber {
      color: var(--color-warning);
    }

    .result-card {
      margin-top: 1rem;
      padding: 1rem;
      border-radius: 24px;
      border: 1px solid transparent;
    }

    .result-card.success {
      background: var(--color-success-soft);
      border-color: rgba(29, 138, 82, 0.14);
    }

    .result-card.error {
      background: var(--color-danger-soft);
      border-color: rgba(195, 58, 51, 0.14);
    }

    .result-card.info {
      background: var(--color-secondary-soft);
      border-color: rgba(26, 145, 255, 0.16);
    }

    .result-card.pending {
      background: var(--color-warning-soft);
      border-color: rgba(165, 106, 24, 0.14);
    }

    .status-row {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: flex-start;
    }

    .meta-label {
      display: block;
      margin-bottom: 0.35rem;
      color: var(--color-muted);
      font-size: 0.74rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .status-title-row {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      flex-wrap: wrap;
    }

    .status-title-row strong {
      font-family: var(--font-display);
      font-size: 1.5rem;
      letter-spacing: -0.04em;
    }

    .status-badge {
      padding: 0.45rem 0.7rem;
      border-radius: 999px;
      font-size: 0.74rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      background: rgba(18, 32, 58, 0.08);
      color: var(--color-muted);
    }

    .status-badge.success {
      background: rgba(29, 138, 82, 0.14);
      color: var(--color-success);
    }

    .status-badge.failure {
      background: rgba(195, 58, 51, 0.14);
      color: var(--color-danger);
    }

    .status-badge.pending,
    .status-badge.started,
    .status-badge.processing {
      background: rgba(236, 168, 46, 0.18);
      color: var(--color-warning);
    }

    .task-id-badge {
      min-width: 150px;
      padding: 0.8rem;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.78);
      border: 1px solid rgba(18, 32, 58, 0.08);
    }

    .task-id-badge span {
      display: block;
      margin-bottom: 0.35rem;
      color: var(--color-muted);
      font-size: 0.74rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .task-id-badge code {
      color: var(--color-ink);
      word-break: break-word;
    }

    .processing-card {
      display: flex;
      gap: 0.8rem;
      align-items: flex-start;
      margin-top: 1rem;
      padding: 1rem;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.7);
      border: 1px solid rgba(165, 106, 24, 0.14);
    }

    .processing-card strong {
      display: block;
      line-height: 1.5;
    }

    .processing-card p {
      margin: 0.35rem 0 0;
      color: var(--color-muted);
      line-height: 1.6;
    }

    .stats-grid,
    .ocr-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.8rem;
      margin-top: 1rem;
    }

    .stat-box,
    .ocr-box {
      padding: 0.9rem;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.78);
      border: 1px solid rgba(18, 32, 58, 0.08);
    }

    .stat-box strong,
    .ocr-box strong {
      color: var(--color-ink);
      font-size: 1rem;
    }

    .stat-box code {
      color: var(--color-ink);
      word-break: break-word;
    }

    .warning {
      color: var(--color-warning);
    }

    .error-box {
      margin-top: 1rem;
      padding: 1rem;
      border-radius: 22px;
      background: var(--color-danger-soft);
      border: 1px solid rgba(195, 58, 51, 0.14);
    }

    .error-box p {
      margin: 0;
      color: var(--color-danger);
      line-height: 1.6;
    }

    .standalone {
      margin-top: 1rem;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    @keyframes pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.45;
      }
    }

    @media (max-width: 720px) {
      .card {
        padding: 1.1rem;
      }

      .card-header,
      .status-row {
        flex-direction: column;
      }

      .controls,
      .stats-grid,
      .ocr-grid {
        grid-template-columns: 1fr;
      }

      .check-btn {
        width: 100%;
      }

      .task-id-badge {
        min-width: 0;
        width: 100%;
      }
    }
  `]
})
export class StatusComponent implements OnDestroy {
  private apiService = inject(ApiService);
  private pollingHandle: ReturnType<typeof setInterval> | null = null;

  initialTaskId = input<string>('');

  taskId = '';
  isLoading = signal(false);
  isLive = signal(false);
  result = signal<TaskStatus | null>(null);
  error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.initialTaskId();
      if (id) {
        this.taskId = id;
        this.checkStatus();
      }
    });
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  setTaskId(id: string): void {
    this.taskId = id;
    this.checkStatus();
  }

  checkStatus(background = false): void {
    if (!this.taskId) return;

    this.isLoading.set(true);
    if (!background) {
      this.error.set(null);
    }

    this.apiService.getTaskStatus(this.taskId).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        this.result.set(response);
        this.syncPolling(response.status);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.error.set(`Error: ${err.message}`);
        this.stopPolling();
      }
    });
  }

  getResultClass(): string {
    const status = this.result()?.status;
    if (status === 'SUCCESS') return 'success';
    if (status === 'FAILURE') return 'error';
    if (status === 'PROCESSING') return 'info';
    return 'pending';
  }

  statusTone(status: TaskStatus['status']): string {
    if (status === 'SUCCESS') return 'Complete';
    if (status === 'FAILURE') return 'Needs attention';
    if (status === 'PROCESSING') return 'In progress';
    return 'Queued';
  }

  getTaskResult(): TaskResult | null {
    const current = this.result()?.result;
    if (!current) return null;
    return current as TaskResult;
  }

  truncate(id: string): string {
    return id.length > 20 ? `${id.substring(0, 8)}...${id.substring(id.length - 4)}` : id;
  }

  ocrDetails(): TaskProcessingInfo | TaskResult | null {
    const current = this.result();
    if (!current) return null;

    if (current.info && this.hasOcrFields(current.info)) {
      return current.info;
    }

    if (current.result && typeof current.result === 'object') {
      const completed = current.result as TaskResult;
      if (this.hasOcrFields(completed)) {
        return completed;
      }
    }

    return null;
  }

  formatOcrMode(mode?: string): string {
    if (!mode) return 'Auto';
    if (mode === 'always') return 'Always OCR';
    if (mode === 'never') return 'Never OCR';
    return 'Auto';
  }

  formatIngestionMode(mode?: string): string {
    if (mode === 'ocr') return 'OCR extraction';
    if (mode === 'digital_text') return 'Digital text path';
    return 'Unknown';
  }

  getOcrStatusText(payload: TaskProcessingInfo | TaskResult): string {
    if (payload.ocr_skipped) {
      return `Skipped${payload.ocr_skip_reason ? ` (${this.formatSkipReason(payload.ocr_skip_reason)})` : ''}`;
    }
    if (payload.ocr_used) {
      return 'Used';
    }
    return 'Unknown';
  }

  private hasOcrFields(payload: TaskProcessingInfo | TaskResult): boolean {
    return (
      payload.ocr_mode !== undefined ||
      payload.ocr_used !== undefined ||
      payload.ocr_skipped !== undefined ||
      payload.ocr_skip_reason !== undefined ||
      payload.ingestion_mode !== undefined
    );
  }

  private formatSkipReason(reason: string): string {
    if (reason === 'digital_pdf_detected') return 'digital PDF detected';
    if (reason === 'ocr_disabled_by_request') return 'disabled by request';
    return reason;
  }

  private syncPolling(status: TaskStatus['status']): void {
    const shouldPoll = status === 'PENDING' || status === 'STARTED' || status === 'PROCESSING';

    if (!shouldPoll) {
      this.stopPolling();
      return;
    }

    if (this.pollingHandle) {
      this.isLive.set(true);
      return;
    }

    this.isLive.set(true);
    this.pollingHandle = setInterval(() => {
      if (!this.isLoading()) {
        this.checkStatus(true);
      }
    }, 4000);
  }

  private stopPolling(): void {
    if (this.pollingHandle) {
      clearInterval(this.pollingHandle);
      this.pollingHandle = null;
    }
    this.isLive.set(false);
  }
}
