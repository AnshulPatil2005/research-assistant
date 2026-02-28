import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-recent-tasks',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card">
      <div class="card-header">
        <div class="header-left">
          <div class="section-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </div>
          <h2>Recent Uploads</h2>
        </div>
        @if (apiService.recentTasks().length > 0) {
          <button class="btn-clear" (click)="clearTasks()">Clear all</button>
        }
      </div>

      @if (apiService.recentTasks().length === 0) {
        <div class="empty-state">
          <div class="empty-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <p>No uploads yet</p>
        </div>
      } @else {
        <div class="tasks-list">
          @for (task of apiService.recentTasks(); track task.task_id) {
            <div class="task-item">
              <div class="task-main">
                <div class="task-info">
                  <span class="filename">{{ task.filename || 'Unknown file' }}</span>
                  <div class="ids">
                    <span class="id-badge">Task: {{ truncate(task.task_id) }}</span>
                    @if (task.doc_id) {
                      <span class="id-badge">Doc: {{ truncate(task.doc_id) }}</span>
                    }
                  </div>
                </div>
                <span class="status-badge" [class]="task.status">
                  {{ task.status.toUpperCase() }}
                </span>
              </div>
              <div class="task-footer">
                <span class="timestamp">{{ formatDate(task.timestamp) }}</span>
                <div class="task-actions">
                  <button class="btn btn-sm btn-ghost" (click)="onCheckStatus(task.task_id)">
                    Status
                  </button>
                  @if (task.doc_id) {
                    <button class="btn btn-sm btn-primary" (click)="onUseInChat(task.doc_id)">
                      Use in Chat
                    </button>
                  }
                </div>
              </div>
            </div>
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
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 0.625rem;
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

    .btn-clear {
      background: none;
      border: none;
      color: #9ca3af;
      font-size: 0.8125rem;
      cursor: pointer;
      padding: 0.25rem 0.5rem;
      border-radius: 5px;
      transition: all 0.15s;
    }

    .btn-clear:hover {
      color: #ef4444;
      background: #fef2f2;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 1.5rem 0;
      color: #9ca3af;
    }

    .empty-state p {
      margin: 0;
      font-size: 0.875rem;
    }

    .tasks-list {
      display: flex;
      flex-direction: column;
      gap: 0.625rem;
    }

    .task-item {
      border: 1px solid #f3f4f6;
      border-radius: 8px;
      padding: 0.875rem;
      background: #fafafa;
      transition: border-color 0.15s;
    }

    .task-item:hover {
      border-color: #e5e7eb;
    }

    .task-main {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.75rem;
    }

    .task-info {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      min-width: 0;
    }

    .filename {
      font-weight: 600;
      color: #111827;
      font-size: 0.9375rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ids {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
    }

    .id-badge {
      font-size: 0.75rem;
      color: #6b7280;
      font-family: var(--font-mono, monospace);
      background: #f3f4f6;
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
      white-space: nowrap;
    }

    .status-badge {
      padding: 0.2rem 0.55rem;
      border-radius: 12px;
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      flex-shrink: 0;
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
    .status-badge.started {
      background: #fef3c7;
      color: #92400e;
    }

    .task-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 0.625rem;
      padding-top: 0.625rem;
      border-top: 1px solid #f3f4f6;
    }

    .timestamp {
      font-size: 0.75rem;
      color: #9ca3af;
    }

    .task-actions {
      display: flex;
      gap: 0.375rem;
    }

    .btn {
      border: none;
      border-radius: 6px;
      font-size: 0.8125rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
    }

    .btn-sm {
      padding: 0.3125rem 0.625rem;
    }

    .btn-ghost {
      background: #f3f4f6;
      color: #374151;
      border: 1px solid #e5e7eb;
    }

    .btn-ghost:hover {
      background: #e5e7eb;
    }

    .btn-primary {
      background: #6366f1;
      color: #fff;
    }

    .btn-primary:hover {
      background: #4f46e5;
    }

    @media (max-width: 480px) {
      .task-main {
        flex-direction: column;
      }

      .task-footer {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
      }
    }
  `]
})
export class RecentTasksComponent {
  apiService = inject(ApiService);

  checkStatus = output<string>();
  useInChat = output<string>();

  formatDate(timestamp: string): string {
    return new Date(timestamp).toLocaleString();
  }

  truncate(id: string): string {
    return id.length > 16 ? id.substring(0, 8) + '\u2026' : id;
  }

  onCheckStatus(taskId: string): void {
    this.checkStatus.emit(taskId);
  }

  onUseInChat(docId: string): void {
    this.useInChat.emit(docId);
  }

  clearTasks(): void {
    if (confirm('Clear all recent tasks?')) {
      this.apiService.clearRecentTasks();
    }
  }
}
