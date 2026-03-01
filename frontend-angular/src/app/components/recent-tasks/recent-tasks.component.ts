import { CommonModule } from '@angular/common';
import { Component, inject, output } from '@angular/core';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-recent-tasks',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="card">
      <div class="card-header">
        <div>
          <span class="eyebrow">Activity Feed</span>
          <h2>Recent uploads and task handoffs</h2>
          <p class="intro">
            This keeps the demo grounded in real activity. One click jumps back into status checks
            or opens a processed document directly in the chat panel.
          </p>
        </div>

        @if (apiService.recentTasks().length > 0) {
          <button class="clear-btn" (click)="clearTasks()" type="button">Clear history</button>
        }
      </div>

      @if (apiService.recentTasks().length === 0) {
        <div class="empty-state">
          <div class="empty-icon">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <path d="M8 13h8"/>
              <path d="M8 17h4"/>
            </svg>
          </div>
          <h3>No uploads yet</h3>
          <p>Upload a document above and this panel becomes your live activity timeline.</p>
        </div>
      } @else {
        <div class="task-grid">
          @for (task of apiService.recentTasks(); track task.task_id) {
            <article class="task-card">
              <div class="task-top">
                <div>
                  <span class="status-chip" [ngClass]="task.status">{{ task.status.toUpperCase() }}</span>
                  <h3>{{ task.filename || 'Unknown file' }}</h3>
                </div>
                <span class="timestamp">{{ formatDate(task.timestamp) }}</span>
              </div>

              <div class="id-row">
                <span class="id-pill">Task: {{ truncate(task.task_id) }}</span>
                @if (task.doc_id) {
                  <span class="id-pill">Doc: {{ truncate(task.doc_id) }}</span>
                }
              </div>

              <div class="task-actions">
                <button class="ghost-btn" (click)="onCheckStatus(task.task_id)" type="button">Inspect status</button>
                @if (task.doc_id) {
                  <button class="primary-btn" (click)="onUseInChat(task.doc_id)" type="button">Open in chat</button>
                }
              </div>
            </article>
          }
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
      color: var(--color-accent-deep);
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
      max-width: 54ch;
      color: var(--color-muted);
      line-height: 1.7;
    }

    .clear-btn {
      border: 0;
      border-radius: 999px;
      min-height: 44px;
      padding: 0 1rem;
      background: rgba(18, 32, 58, 0.06);
      color: var(--color-ink);
      font-weight: 700;
      cursor: pointer;
      transition: transform 0.2s ease, background 0.2s ease;
    }

    .clear-btn:hover {
      transform: translateY(-2px);
      background: rgba(18, 32, 58, 0.1);
    }

    .empty-state {
      display: grid;
      place-items: center;
      text-align: center;
      gap: 0.8rem;
      min-height: 220px;
      border-radius: 24px;
      background: rgba(255, 255, 255, 0.56);
      border: 1px dashed var(--color-border);
      margin-top: 1rem;
      padding: 1.5rem;
    }

    .empty-icon {
      display: grid;
      place-items: center;
      width: 74px;
      height: 74px;
      border-radius: 24px;
      background: rgba(18, 32, 58, 0.06);
      color: var(--color-muted);
    }

    .empty-state h3 {
      margin: 0;
      font-family: var(--font-display);
      font-size: 1.35rem;
      letter-spacing: -0.03em;
    }

    .empty-state p {
      margin: 0;
      color: var(--color-muted);
      max-width: 42ch;
      line-height: 1.7;
    }

    .task-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 0.95rem;
      margin-top: 1rem;
    }

    .task-card {
      padding: 1rem;
      border-radius: 24px;
      background: rgba(255, 255, 255, 0.72);
      border: 1px solid var(--color-border);
      box-shadow: 0 12px 26px rgba(18, 32, 58, 0.06);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .task-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 18px 36px rgba(18, 32, 58, 0.09);
    }

    .task-top {
      display: flex;
      justify-content: space-between;
      gap: 0.8rem;
      align-items: flex-start;
    }

    .status-chip {
      display: inline-flex;
      margin-bottom: 0.65rem;
      padding: 0.38rem 0.65rem;
      border-radius: 999px;
      background: rgba(18, 32, 58, 0.08);
      color: var(--color-muted);
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .status-chip.success {
      background: rgba(29, 138, 82, 0.14);
      color: var(--color-success);
    }

    .status-chip.failure {
      background: rgba(195, 58, 51, 0.14);
      color: var(--color-danger);
    }

    .status-chip.pending,
    .status-chip.started,
    .status-chip.processing {
      background: rgba(236, 168, 46, 0.2);
      color: var(--color-warning);
    }

    .task-top h3 {
      margin: 0;
      font-size: 1.02rem;
      line-height: 1.35;
      word-break: break-word;
    }

    .timestamp {
      color: var(--color-muted);
      font-size: 0.78rem;
      text-align: right;
      white-space: nowrap;
    }

    .id-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.55rem;
      margin-top: 1rem;
    }

    .id-pill {
      padding: 0.48rem 0.7rem;
      border-radius: 999px;
      background: rgba(18, 32, 58, 0.06);
      color: var(--color-muted);
      font-size: 0.77rem;
      font-family: var(--font-mono);
    }

    .task-actions {
      display: flex;
      gap: 0.65rem;
      flex-wrap: wrap;
      margin-top: 1rem;
    }

    .ghost-btn,
    .primary-btn {
      min-height: 42px;
      padding: 0 0.95rem;
      border: 0;
      border-radius: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
    }

    .ghost-btn {
      background: rgba(18, 32, 58, 0.07);
      color: var(--color-ink);
    }

    .primary-btn {
      background: linear-gradient(135deg, var(--color-accent) 0%, #ff8b53 100%);
      color: #fff;
      box-shadow: 0 12px 22px rgba(252, 92, 44, 0.18);
    }

    .ghost-btn:hover,
    .primary-btn:hover {
      transform: translateY(-2px);
    }

    @media (max-width: 720px) {
      .card {
        padding: 1.1rem;
      }

      .card-header,
      .task-top {
        flex-direction: column;
      }

      .timestamp {
        text-align: left;
      }

      .task-actions button {
        width: 100%;
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
    return id.length > 16 ? `${id.substring(0, 8)}...` : id;
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
