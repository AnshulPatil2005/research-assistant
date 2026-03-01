import { CommonModule } from '@angular/common';
import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OcrMode, UploadResponse } from '../../models/api.models';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="card">
      <div class="card-header">
        <div>
          <span class="eyebrow">Step 1</span>
          <h2>Ingest a paper into the pipeline</h2>
          <p class="intro">
            Drop in a PDF, choose how aggressive OCR should be, and the app will queue a task
            that flows directly into live status tracking and chat.
          </p>
        </div>
        <div class="header-badge">Async Upload</div>
      </div>

      <div class="capability-row">
        <span class="capability-pill">PDF intake</span>
        <span class="capability-pill">OCR aware</span>
        <span class="capability-pill">Task IDs returned</span>
      </div>

      <div
        class="drop-zone"
        [class.dragover]="isDragover()"
        [class.has-file]="selectedFile()"
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave()"
        (drop)="onDrop($event)"
        (click)="fileInput.click()"
      >
        <div class="drop-glow"></div>

        @if (selectedFile()) {
          <div class="selected-file">
            <div class="file-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <path d="M8 13h8"/>
                <path d="M8 17h5"/>
              </svg>
            </div>

            <div class="file-meta">
              <span class="file-name">{{ selectedFile()?.name }}</span>
              <span class="file-detail">{{ formatSize(selectedFile()!.size) }} · Ready for processing</span>
            </div>

            <button class="icon-btn" (click)="removeFile($event)" title="Remove file" type="button">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        } @else {
          <div class="drop-copy">
            <div class="drop-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <h3>Drop your PDF here</h3>
            <p>Click to browse or drag a paper into the intake area.</p>
            <span class="drop-meta">PDF only · Best for research papers, specs, reports, and whitepapers</span>
          </div>
        }
      </div>

      <input
        #fileInput
        type="file"
        accept=".pdf"
        (change)="onFileSelect($event)"
        hidden
      />

      <div class="control-grid">
        <label class="toggle-card">
          <div class="toggle-copy">
            <span class="control-label">Force re-process</span>
            <span class="control-note">Ignore cached results and rebuild the document pipeline.</span>
          </div>
          <input type="checkbox" [(ngModel)]="forceUpload" />
        </label>

        <label class="select-card" for="ocrModeSelect">
          <span class="control-label">OCR mode</span>
          <span class="control-note">Choose automatic detection or force scanned-text extraction.</span>
          <select id="ocrModeSelect" [(ngModel)]="ocrMode">
            <option value="auto">Auto detect</option>
            <option value="always">Always OCR</option>
            <option value="never">Never OCR</option>
          </select>
        </label>
      </div>

      <button
        class="primary-btn"
        (click)="upload()"
        [disabled]="!selectedFile() || isLoading()"
        type="button"
      >
        @if (isLoading()) {
          <span class="spinner"></span>
          Uploading and creating task
        } @else {
          Start ingestion
        }
      </button>

      @if (result()) {
        <div class="result-card" [ngClass]="result()!.type">
          <div class="result-message">
            <span class="result-title">{{ result()!.type === 'success' ? 'Pipeline ready' : result()!.type === 'error' ? 'Upload failed' : 'Working' }}</span>
            <p>{{ result()!.message }}</p>
          </div>

          @if (result()!.data) {
            <div class="meta-grid">
              @if (result()!.data!.task_id) {
                <div class="meta-box">
                  <span class="meta-key">Task ID</span>
                  <code>{{ result()!.data!.task_id }}</code>
                </div>
              }
              @if (result()!.data!.doc_id) {
                <div class="meta-box">
                  <span class="meta-key">Doc ID</span>
                  <code>{{ result()!.data!.doc_id }}</code>
                </div>
              }
              @if (result()!.data!.ocr_mode) {
                <div class="meta-box">
                  <span class="meta-key">OCR</span>
                  <strong>{{ result()!.data!.ocr_mode }}</strong>
                </div>
              }
            </div>
          }

          @if (result()!.taskId) {
            <button class="ghost-btn" (click)="checkTaskStatus()" type="button">
              Open live task status
            </button>
          }
        </div>
      }
    </section>
  `,
  styles: [`
    .card {
      position: relative;
      padding: 1.5rem;
      border-radius: var(--radius-xl);
      background: var(--color-panel);
      border: 1px solid rgba(255, 255, 255, 0.78);
      box-shadow: var(--surface-shadow-soft);
      backdrop-filter: blur(18px);
      overflow: hidden;
    }

    .card::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(252, 92, 44, 0.08), transparent 38%);
      pointer-events: none;
    }

    .card-header,
    .capability-row,
    .drop-zone,
    .control-grid,
    .primary-btn,
    .result-card {
      position: relative;
      z-index: 1;
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
      color: var(--color-accent-deep);
      font-size: 0.76rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }

    h2 {
      font-family: var(--font-display);
      font-size: 1.9rem;
      line-height: 1;
      letter-spacing: -0.04em;
    }

    .intro {
      margin: 0.7rem 0 0;
      max-width: 54ch;
      color: var(--color-muted);
      line-height: 1.7;
    }

    .header-badge {
      flex-shrink: 0;
      padding: 0.55rem 0.8rem;
      border-radius: 999px;
      background: var(--color-secondary-soft);
      color: var(--color-secondary);
      font-size: 0.78rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }

    .capability-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.65rem;
      margin-top: 1.2rem;
    }

    .capability-pill {
      padding: 0.55rem 0.8rem;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.68);
      border: 1px solid var(--color-border);
      color: var(--color-muted);
      font-size: 0.82rem;
      font-weight: 600;
    }

    .drop-zone {
      position: relative;
      margin-top: 1.2rem;
      min-height: 240px;
      padding: 1.4rem;
      border-radius: 28px;
      border: 1px dashed rgba(18, 32, 58, 0.18);
      background: rgba(255, 255, 255, 0.58);
      cursor: pointer;
      transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
      overflow: hidden;
    }

    .drop-zone:hover,
    .drop-zone.dragover,
    .drop-zone.has-file {
      transform: translateY(-2px);
      border-color: rgba(252, 92, 44, 0.34);
      background: rgba(255, 255, 255, 0.78);
      box-shadow: 0 18px 40px rgba(18, 32, 58, 0.08);
    }

    .drop-glow {
      position: absolute;
      inset: auto -30px -80px auto;
      width: 180px;
      height: 180px;
      border-radius: 999px;
      background: radial-gradient(circle, rgba(252, 92, 44, 0.2) 0%, rgba(252, 92, 44, 0) 72%);
      pointer-events: none;
    }

    .drop-copy,
    .selected-file {
      position: relative;
      z-index: 1;
      height: 100%;
    }

    .drop-copy {
      display: grid;
      place-items: center;
      text-align: center;
      gap: 0.8rem;
      min-height: 210px;
    }

    .drop-icon {
      display: grid;
      place-items: center;
      width: 78px;
      height: 78px;
      border-radius: 24px;
      background: var(--color-accent-soft);
      color: var(--color-accent);
      box-shadow: inset 0 0 0 1px rgba(252, 92, 44, 0.12);
    }

    .drop-copy h3 {
      margin: 0;
      font-family: var(--font-display);
      font-size: 1.5rem;
      letter-spacing: -0.03em;
    }

    .drop-copy p,
    .drop-meta {
      margin: 0;
      color: var(--color-muted);
      line-height: 1.65;
    }

    .drop-meta {
      font-size: 0.86rem;
    }

    .selected-file {
      display: flex;
      align-items: center;
      gap: 1rem;
      min-height: 210px;
    }

    .file-icon {
      width: 70px;
      height: 70px;
      display: grid;
      place-items: center;
      border-radius: 22px;
      background: var(--color-accent-soft);
      color: var(--color-accent);
      flex-shrink: 0;
    }

    .file-meta {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      min-width: 0;
    }

    .file-name {
      font-size: 1.05rem;
      font-weight: 700;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .file-detail {
      color: var(--color-muted);
    }

    .icon-btn {
      width: 42px;
      height: 42px;
      margin-left: auto;
      border: 0;
      border-radius: 999px;
      background: rgba(18, 32, 58, 0.07);
      color: var(--color-muted);
      display: grid;
      place-items: center;
      cursor: pointer;
      transition: background 0.2s ease, color 0.2s ease;
      flex-shrink: 0;
    }

    .icon-btn:hover {
      background: var(--color-danger-soft);
      color: var(--color-danger);
    }

    .control-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.9rem;
      margin-top: 1rem;
    }

    .toggle-card,
    .select-card {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: center;
      padding: 1rem;
      border-radius: 22px;
      background: rgba(255, 255, 255, 0.7);
      border: 1px solid var(--color-border);
    }

    .toggle-copy,
    .select-card {
      min-width: 0;
    }

    .select-card {
      flex-direction: column;
      align-items: flex-start;
    }

    .control-label {
      display: block;
      font-size: 0.86rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-ink);
    }

    .control-note {
      display: block;
      margin-top: 0.35rem;
      color: var(--color-muted);
      line-height: 1.55;
      font-size: 0.9rem;
    }

    .toggle-card input[type='checkbox'] {
      width: 48px;
      height: 48px;
      margin: 0;
      accent-color: var(--color-accent);
      cursor: pointer;
      flex-shrink: 0;
    }

    .select-card select {
      width: 100%;
      margin-top: 0.8rem;
      min-height: 48px;
      padding: 0.75rem 0.85rem;
      border-radius: 16px;
      border: 1px solid var(--color-border);
      background: #fff;
      color: var(--color-ink);
    }

    .primary-btn,
    .ghost-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.6rem;
      border: 0;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
    }

    .primary-btn {
      width: 100%;
      min-height: 56px;
      margin-top: 1rem;
      border-radius: 18px;
      background: linear-gradient(135deg, var(--color-accent) 0%, #ff8b53 100%);
      color: #fff;
      font-weight: 700;
      box-shadow: 0 18px 36px rgba(252, 92, 44, 0.24);
    }

    .primary-btn:hover:not(:disabled),
    .ghost-btn:hover {
      transform: translateY(-2px);
    }

    .primary-btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
      box-shadow: none;
    }

    .ghost-btn {
      min-height: 46px;
      padding: 0 1rem;
      border-radius: 14px;
      background: rgba(18, 32, 58, 0.06);
      color: var(--color-ink);
      font-weight: 700;
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #fff;
      border-radius: 999px;
      animation: spin 0.7s linear infinite;
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

    .result-title {
      display: block;
      margin-bottom: 0.35rem;
      font-size: 0.82rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-muted);
    }

    .result-message p {
      margin: 0;
      line-height: 1.6;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.75rem;
      margin-top: 0.9rem;
    }

    .meta-box {
      padding: 0.8rem;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.78);
      border: 1px solid rgba(18, 32, 58, 0.08);
    }

    .meta-key {
      display: block;
      margin-bottom: 0.35rem;
      color: var(--color-muted);
      font-size: 0.74rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .meta-box code,
    .meta-box strong {
      color: var(--color-ink);
      word-break: break-word;
    }

    .ghost-btn {
      margin-top: 0.9rem;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    @media (max-width: 720px) {
      .card {
        padding: 1.1rem;
      }

      .card-header {
        flex-direction: column;
      }

      .selected-file {
        align-items: flex-start;
        min-height: auto;
        padding-top: 1rem;
      }

      .control-grid,
      .meta-grid {
        grid-template-columns: 1fr;
      }

      .toggle-card {
        align-items: flex-start;
      }
    }
  `]
})
export class UploadComponent {
  private apiService = inject(ApiService);

  taskUploaded = output<{ taskId: string; docId?: string }>();

  selectedFile = signal<File | null>(null);
  isDragover = signal(false);
  forceUpload = false;
  ocrMode: OcrMode = 'auto';
  isLoading = signal(false);
  result = signal<{ message: string; type: string; data?: UploadResponse; taskId?: string } | null>(null);

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragover.set(true);
  }

  onDragLeave(): void {
    this.isDragover.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragover.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.name.toLowerCase().endsWith('.pdf')) {
        this.selectedFile.set(file);
        this.result.set(null);
      } else {
        this.result.set({ message: 'Please select a valid PDF file.', type: 'error' });
      }
    }
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (file.name.toLowerCase().endsWith('.pdf')) {
        this.selectedFile.set(file);
        this.result.set(null);
      } else {
        this.result.set({ message: 'Please select a valid PDF file.', type: 'error' });
      }
    }
  }

  removeFile(event: Event): void {
    event.stopPropagation();
    this.selectedFile.set(null);
    this.result.set(null);
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  upload(): void {
    const file = this.selectedFile();
    if (!file) return;

    this.isLoading.set(true);
    this.result.set({ message: 'Uploading file and starting ingestion.', type: 'info' });

    this.apiService.uploadPdf(file, this.forceUpload, this.ocrMode).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        this.result.set({
          message: response.message,
          type: 'success',
          data: response,
          taskId: response.task_id
        });

        if (response.task_id) {
          this.taskUploaded.emit({ taskId: response.task_id, docId: response.doc_id });
        }
      },
      error: (error) => {
        this.isLoading.set(false);
        this.result.set({ message: `Error: ${error.message}`, type: 'error' });
      }
    });
  }

  checkTaskStatus(): void {
    const taskId = this.result()?.taskId;
    if (taskId) {
      this.taskUploaded.emit({ taskId, docId: this.result()?.data?.doc_id });
    }
  }
}
