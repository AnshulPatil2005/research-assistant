import { Component, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { OcrMode, UploadResponse } from '../../models/api.models';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="card">
      <div class="card-header">
        <div class="section-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <h2>Upload PDF</h2>
      </div>

      <div class="form-group">
        <div
          class="file-drop-zone"
          [class.dragover]="isDragover()"
          [class.has-file]="selectedFile()"
          (dragover)="onDragOver($event)"
          (dragleave)="onDragLeave()"
          (drop)="onDrop($event)"
          (click)="fileInput.click()"
        >
          @if (selectedFile()) {
            <div class="file-info">
              <div class="file-icon-wrap">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              <div class="file-details">
                <span class="file-name">{{ selectedFile()?.name }}</span>
                <span class="file-size">{{ formatSize(selectedFile()!.size) }}</span>
              </div>
              <button class="remove-btn" (click)="removeFile($event)" title="Remove file">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          } @else {
            <div class="drop-content">
              <svg class="drop-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <span class="drop-text">Drop PDF here or <span class="browse-link">browse</span></span>
              <span class="drop-hint">PDF files only</span>
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
      </div>

      <div class="options-row">
        <label class="checkbox-label">
          <input type="checkbox" [(ngModel)]="forceUpload" />
          <span>Force re-process</span>
        </label>
        <div class="ocr-select-wrap">
          <label for="ocrModeSelect">OCR</label>
          <select id="ocrModeSelect" class="select-inline" [(ngModel)]="ocrMode">
            <option value="auto">Auto</option>
            <option value="always">Always</option>
            <option value="never">Never</option>
          </select>
        </div>
      </div>

      <button
        class="btn btn-primary"
        (click)="upload()"
        [disabled]="!selectedFile() || isLoading()"
      >
        @if (isLoading()) {
          <span class="btn-spinner"></span>Uploading...
        } @else {
          Upload PDF
        }
      </button>

      @if (result()) {
        <div class="result" [class]="result()!.type">
          <div class="result-message">
            @if (result()!.type === 'success') {
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            }
            <span>{{ result()!.message }}</span>
          </div>
          @if (result()!.data) {
            <div class="result-meta">
              @if (result()!.data!.task_id) {
                <div class="meta-row">
                  <span class="meta-key">Task ID</span>
                  <code class="meta-val">{{ result()!.data!.task_id }}</code>
                </div>
              }
              @if (result()!.data!.doc_id) {
                <div class="meta-row">
                  <span class="meta-key">Doc ID</span>
                  <code class="meta-val">{{ result()!.data!.doc_id }}</code>
                </div>
              }
              @if (result()!.data!.ocr_mode) {
                <div class="meta-row">
                  <span class="meta-key">OCR</span>
                  <span class="meta-val">{{ result()!.data!.ocr_mode }}</span>
                </div>
              }
            </div>
          }
          @if (result()!.taskId) {
            <button class="btn btn-ghost btn-sm" (click)="checkTaskStatus()">
              Check Status →
            </button>
          }
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

    .file-drop-zone {
      border: 2px dashed #d1d5db;
      border-radius: 10px;
      padding: 1.5rem 1rem;
      text-align: center;
      cursor: pointer;
      transition: all 0.15s;
      background: #fafafa;
    }

    .file-drop-zone:hover,
    .file-drop-zone.dragover {
      border-color: #6366f1;
      background: #eef2ff;
    }

    .file-drop-zone.has-file {
      border-style: solid;
      border-color: #6366f1;
      background: #eef2ff;
    }

    .drop-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.375rem;
    }

    .drop-icon {
      margin-bottom: 0.25rem;
    }

    .drop-text {
      color: #374151;
      font-size: 0.9375rem;
    }

    .browse-link {
      color: #6366f1;
      font-weight: 500;
    }

    .drop-hint {
      font-size: 0.8125rem;
      color: #9ca3af;
    }

    .file-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .file-icon-wrap {
      flex-shrink: 0;
    }

    .file-details {
      flex: 1;
      text-align: left;
      min-width: 0;
    }

    .file-name {
      display: block;
      font-weight: 500;
      color: #111827;
      font-size: 0.9375rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .file-size {
      display: block;
      font-size: 0.8125rem;
      color: #6b7280;
    }

    .remove-btn {
      background: none;
      border: none;
      color: #9ca3af;
      cursor: pointer;
      padding: 0.3rem;
      display: flex;
      align-items: center;
      border-radius: 5px;
      flex-shrink: 0;
      transition: all 0.15s;
    }

    .remove-btn:hover {
      color: #ef4444;
      background: #fee2e2;
    }

    .options-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
      font-size: 0.875rem;
      color: #374151;
    }

    .checkbox-label input[type="checkbox"] {
      width: 15px;
      height: 15px;
      accent-color: #6366f1;
      cursor: pointer;
    }

    .ocr-select-wrap {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
    }

    .ocr-select-wrap label {
      color: #6b7280;
      font-weight: 500;
    }

    .select-inline {
      padding: 0.3125rem 0.5rem;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      background: #f9fafb;
      font-size: 0.875rem;
      color: #111827;
      cursor: pointer;
    }

    .select-inline:focus {
      outline: none;
      border-color: #6366f1;
    }

    .btn {
      padding: 0.625rem 1.25rem;
      border: none;
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

    .btn-primary {
      background: #6366f1;
      color: #fff;
      width: 100%;
      justify-content: center;
    }

    .btn-primary:hover:not(:disabled) {
      background: #4f46e5;
    }

    .btn-ghost {
      background: transparent;
      color: #6366f1;
      border: 1px solid #c7d2fe;
      padding: 0.4375rem 0.875rem;
    }

    .btn-ghost:hover {
      background: #eef2ff;
    }

    .btn-sm {
      font-size: 0.875rem;
    }

    .btn-spinner {
      width: 13px;
      height: 13px;
      border: 2px solid rgba(255, 255, 255, 0.35);
      border-top-color: #fff;
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

    .result-message {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 500;
      margin-bottom: 0.625rem;
    }

    .result.success {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      color: #15803d;
    }

    .result.error {
      background: #fef2f2;
      border: 1px solid #fca5a5;
      color: #dc2626;
    }

    .result.info {
      background: #eff6ff;
      border: 1px solid #93c5fd;
      color: #1d4ed8;
    }

    .result-meta {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      background: rgba(255, 255, 255, 0.6);
      border-radius: 6px;
      padding: 0.625rem 0.75rem;
      margin-bottom: 0.75rem;
    }

    .meta-row {
      display: flex;
      align-items: baseline;
      gap: 0.75rem;
      font-size: 0.8125rem;
    }

    .meta-key {
      font-weight: 600;
      color: #374151;
      min-width: 56px;
    }

    .meta-val {
      font-family: var(--font-mono, monospace);
      font-size: 0.8125rem;
      color: #374151;
      word-break: break-all;
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
        this.result.set({ message: 'Please select a valid PDF file', type: 'error' });
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
        this.result.set({ message: 'Please select a valid PDF file', type: 'error' });
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
    this.result.set({ message: 'Uploading...', type: 'info' });

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
