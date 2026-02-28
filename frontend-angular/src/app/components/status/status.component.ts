import { Component, inject, signal, input, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { TaskProcessingInfo, TaskResult, TaskStatus } from '../../models/api.models';

@Component({
  selector: 'app-status',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="card">
      <div class="card-header">
        <div class="section-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <h2>Task Status</h2>
      </div>

      <div class="form-group">
        <input
          type="text"
          [(ngModel)]="taskId"
          placeholder="Enter task ID from upload"
          class="input"
        />
      </div>

      <button
        class="btn btn-secondary"
        (click)="checkStatus()"
        [disabled]="!taskId || isLoading()"
      >
        @if (isLoading()) {
          <span class="btn-spinner dark"></span>Checking...
        } @else {
          Check Status
        }
      </button>

      @if (result()) {
        <div class="result" [class]="getResultClass()">
          <div class="status-header">
            <span class="status-label">Status</span>
            <span class="status-badge" [class]="result()!.status.toLowerCase()">
              {{ result()!.status }}
            </span>
          </div>

          @if (result()!.status === 'SUCCESS') {
            <div class="stats-grid">
              @if (getTaskResult()?.doc_id) {
                <div class="stat-box">
                  <span class="stat-label">Doc ID</span>
                  <code class="stat-val">{{ truncate(getTaskResult()!.doc_id!) }}</code>
                </div>
              }
              @if (getTaskResult()?.chunks_count !== undefined && getTaskResult()?.chunks_count !== null) {
                <div class="stat-box">
                  <span class="stat-label">Chunks</span>
                  <span class="stat-num">{{ getTaskResult()!.chunks_count }}</span>
                </div>
              }
              @if (getTaskResult()?.claims_count !== undefined && getTaskResult()?.claims_count !== null) {
                <div class="stat-box">
                  <span class="stat-label">Claims</span>
                  <span class="stat-num">{{ getTaskResult()!.claims_count }}</span>
                </div>
              }
              @if (getTaskResult()?.pdf_type) {
                <div class="stat-box">
                  <span class="stat-label">PDF Type</span>
                  <span class="stat-val">{{ getTaskResult()!.pdf_type }}</span>
                </div>
              }
            </div>
          }

          @if (result()!.status === 'FAILURE' && result()!.error) {
            <div class="error-detail">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {{ result()!.error }}
            </div>
          }

          @if (result()!.status === 'PROCESSING' || result()!.status === 'STARTED' || result()!.status === 'PENDING') {
            <div class="processing-row">
              <span class="processing-spinner"></span>
              <span>{{ result()!.info?.step || 'Processing document...' }}</span>
            </div>
          }

          @if (ocrDetails(); as ocr) {
            <div class="ocr-meta">
              <div class="ocr-row">
                <span class="ocr-key">OCR Mode</span>
                <span class="ocr-value">{{ formatOcrMode(ocr.ocr_mode) }}</span>
              </div>
              <div class="ocr-row">
                <span class="ocr-key">Extraction</span>
                <span class="ocr-value">{{ formatIngestionMode(ocr.ingestion_mode) }}</span>
              </div>
              <div class="ocr-row">
                <span class="ocr-key">OCR</span>
                <span class="ocr-value" [class.ocr-skipped]="ocr.ocr_skipped">
                  {{ getOcrStatusText(ocr) }}
                </span>
              </div>
            </div>
          }
        </div>
      }

      @if (error()) {
        <div class="result error-card">
          <p>{{ error() }}</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .card {
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      margin-bottom: 1.25rem;
    }

    .section-icon {
      width: 28px;
      height: 28px;
      background: #eef2ff;
      border-radius: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #6366f1;
      flex-shrink: 0;
    }

    h2 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: #111827;
    }

    .form-group {
      margin-bottom: 1rem;
    }

    .input {
      width: 100%;
      padding: 0.5625rem 0.875rem;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 0.9375rem;
      transition: border-color 0.15s, box-shadow 0.15s;
      background: #f9fafb;
      color: #111827;
      box-sizing: border-box;
    }

    .input:focus {
      outline: none;
      border-color: #6366f1;
      background: #fff;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
    }

    .btn {
      padding: 0.5625rem 1.125rem;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 0.9375rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: #f9fafb;
      color: #374151;
    }

    .btn-secondary:hover:not(:disabled) {
      background: #f3f4f6;
      border-color: #d1d5db;
    }

    .btn-spinner {
      width: 13px;
      height: 13px;
      border: 2px solid rgba(55, 65, 81, 0.2);
      border-top-color: #374151;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      flex-shrink: 0;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .result {
      margin-top: 1rem;
      padding: 1rem;
      border-radius: 8px;
      font-size: 0.9375rem;
    }

    .result.success {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
    }

    .result.error {
      background: #fef2f2;
      border: 1px solid #fca5a5;
    }

    .result.info {
      background: #eff6ff;
      border: 1px solid #93c5fd;
    }

    .result.pending {
      background: #fefce8;
      border: 1px solid #fde68a;
    }

    .error-card {
      background: #fef2f2;
      border: 1px solid #fca5a5;
      color: #dc2626;
    }

    .status-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.875rem;
    }

    .status-label {
      font-weight: 500;
      color: #6b7280;
      font-size: 0.875rem;
    }

    .status-badge {
      padding: 0.2rem 0.625rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .status-badge.success {
      background: #dcfce7;
      color: #15803d;
    }

    .status-badge.failure {
      background: #fee2e2;
      color: #dc2626;
    }

    .status-badge.pending,
    .status-badge.started,
    .status-badge.processing {
      background: #fef3c7;
      color: #92400e;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.625rem;
      margin-bottom: 0.875rem;
    }

    .stat-box {
      background: rgba(255, 255, 255, 0.7);
      border: 1px solid rgba(0, 0, 0, 0.06);
      border-radius: 8px;
      padding: 0.625rem 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .stat-label {
      font-size: 0.75rem;
      font-weight: 500;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .stat-num {
      font-size: 1.25rem;
      font-weight: 700;
      color: #111827;
      line-height: 1.2;
    }

    .stat-val {
      font-size: 0.8125rem;
      font-family: var(--font-mono, monospace);
      color: #374151;
      word-break: break-all;
    }

    .error-detail {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      background: rgba(255, 255, 255, 0.6);
      border-radius: 6px;
      padding: 0.625rem 0.75rem;
      color: #dc2626;
      font-size: 0.875rem;
      margin-bottom: 0.75rem;
    }

    .processing-row {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      font-size: 0.875rem;
      color: #92400e;
      margin-bottom: 0.75rem;
    }

    .processing-spinner {
      width: 13px;
      height: 13px;
      border: 2px solid rgba(146, 64, 14, 0.25);
      border-top-color: #92400e;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      flex-shrink: 0;
    }

    .ocr-meta {
      background: rgba(255, 255, 255, 0.6);
      border: 1px solid rgba(0, 0, 0, 0.06);
      border-radius: 8px;
      padding: 0.625rem 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }

    .ocr-row {
      display: flex;
      gap: 0.625rem;
      font-size: 0.8125rem;
    }

    .ocr-key {
      font-weight: 600;
      color: #374151;
      min-width: 72px;
    }

    .ocr-value {
      color: #374151;
    }

    .ocr-skipped {
      color: #92400e;
      font-weight: 600;
    }
  `]
})
export class StatusComponent {
  private apiService = inject(ApiService);

  initialTaskId = input<string>('');

  taskId = '';
  isLoading = signal(false);
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

  setTaskId(id: string): void {
    this.taskId = id;
    this.checkStatus();
  }

  checkStatus(): void {
    if (!this.taskId) return;

    this.isLoading.set(true);
    this.result.set(null);
    this.error.set(null);

    this.apiService.getTaskStatus(this.taskId).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        this.result.set(response);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.error.set(`Error: ${err.message}`);
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

  getTaskResult(): TaskResult | null {
    const r = this.result()?.result;
    if (!r) return null;
    return r as TaskResult;
  }

  truncate(id: string): string {
    return id.length > 20 ? id.substring(0, 8) + '...' + id.substring(id.length - 4) : id;
  }

  ocrDetails(): TaskProcessingInfo | TaskResult | null {
    const status = this.result();
    if (!status) return null;

    if (status.info && this.hasOcrFields(status.info)) {
      return status.info;
    }

    if (status.result && typeof status.result === 'object') {
      const completed = status.result as TaskResult;
      if (this.hasOcrFields(completed)) {
        return completed;
      }
    }

    return null;
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

  formatOcrMode(mode?: string): string {
    if (!mode) return 'Auto';
    if (mode === 'always') return 'Always OCR';
    if (mode === 'never') return 'Never OCR';
    return 'Auto';
  }

  formatIngestionMode(mode?: string): string {
    if (mode === 'ocr') return 'OCR';
    if (mode === 'digital_text') return 'Digital Text';
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

  private formatSkipReason(reason: string): string {
    if (reason === 'digital_pdf_detected') return 'digital PDF detected';
    if (reason === 'ocr_disabled_by_request') return 'OCR disabled by request';
    return reason;
  }
}
