import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from './components/header/header.component';
import { UploadComponent } from './components/upload/upload.component';
import { StatusComponent } from './components/status/status.component';
import { ChatComponent } from './components/chat/chat.component';
import { RecentTasksComponent } from './components/recent-tasks/recent-tasks.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    UploadComponent,
    StatusComponent,
    ChatComponent,
    RecentTasksComponent
  ],
  template: `
    <div class="top-bar"></div>
    <app-header />

    <main class="main-content">
      <div class="container">
        <div class="grid">
          <div class="grid-col">
            <app-upload (taskUploaded)="onTaskUploaded($event)" />
            <app-status #statusComponent />
          </div>
          <div class="grid-col">
            <app-chat #chatComponent />
            <app-recent-tasks
              (checkStatus)="onCheckStatus($event)"
              (useInChat)="onUseInChat($event)"
            />
          </div>
        </div>
      </div>
    </main>

    <footer class="footer">
      <p>Research Assistant &mdash; AI-Powered Research & Document Analysis</p>
    </footer>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    .top-bar {
      height: 3px;
      background: linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #06b6d4 100%);
      flex-shrink: 0;
    }

    .main-content {
      flex: 1;
      background: #f3f4f6;
      padding: 2rem;
    }

    .container {
      max-width: 1280px;
      margin: 0 auto;
    }

    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
    }

    .grid-col {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .footer {
      background: #fff;
      border-top: 1px solid #e5e7eb;
      padding: 1rem 2rem;
      text-align: center;
    }

    .footer p {
      margin: 0;
      color: #9ca3af;
      font-size: 0.8125rem;
    }

    @media (max-width: 900px) {
      .grid {
        grid-template-columns: 1fr;
      }

      .main-content {
        padding: 1rem;
      }
    }
  `]
})
export class AppComponent {
  @ViewChild('statusComponent') statusComponent!: StatusComponent;
  @ViewChild('chatComponent') chatComponent!: ChatComponent;

  onTaskUploaded(event: { taskId: string; docId?: string }): void {
    this.statusComponent.setTaskId(event.taskId);
    if (event.docId) {
      this.chatComponent.setDocId(event.docId);
    }
  }

  onCheckStatus(taskId: string): void {
    this.statusComponent.setTaskId(taskId);
  }

  onUseInChat(docId: string): void {
    this.chatComponent.setDocId(docId);
  }
}
