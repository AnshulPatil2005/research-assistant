import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="header">
      <div class="brand">
        <div class="brand-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <circle cx="10" cy="14" r="2"/>
            <path d="m12 16 2 2"/>
          </svg>
        </div>
        <div class="brand-text">
          <h1>Research Assistant</h1>
          <p class="subtitle">AI-Powered Research & Document Analysis</p>
        </div>
      </div>

      <div class="header-controls">
        <div class="api-url-input">
          <label for="apiUrl">API</label>
          <input
            type="text"
            id="apiUrl"
            [ngModel]="apiService.apiUrl()"
            (ngModelChange)="onApiUrlChange($event)"
            placeholder="http://localhost:8000"
          />
        </div>
        <div class="status-pill" [class.online]="apiService.healthStatus().online">
          <span class="dot"></span>
          <span>{{ apiService.healthStatus().online ? 'Online' : 'Offline' }}</span>
        </div>
      </div>
    </header>
  `,
  styles: [`
    .header {
      background: #fff;
      border-bottom: 1px solid #e5e7eb;
      padding: 0.875rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .brand-icon {
      width: 38px;
      height: 38px;
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35);
    }

    .brand-text h1 {
      font-size: 1.125rem;
      font-weight: 700;
      color: #111827;
      margin: 0;
      letter-spacing: -0.01em;
    }

    .subtitle {
      margin: 0.1rem 0 0;
      font-size: 0.75rem;
      color: #9ca3af;
    }

    .header-controls {
      display: flex;
      align-items: center;
      gap: 0.875rem;
      flex-wrap: wrap;
    }

    .api-url-input {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .api-url-input label {
      font-size: 0.8125rem;
      color: #9ca3af;
      font-weight: 500;
    }

    .api-url-input input {
      padding: 0.4375rem 0.75rem;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 0.8125rem;
      width: 230px;
      transition: border-color 0.15s, box-shadow 0.15s;
      background: #f9fafb;
      color: #374151;
    }

    .api-url-input input:focus {
      outline: none;
      border-color: #6366f1;
      background: #fff;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
    }

    .status-pill {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.375rem 0.75rem;
      border-radius: 20px;
      font-size: 0.8125rem;
      font-weight: 500;
      background: #fef2f2;
      color: #991b1b;
      transition: background 0.3s, color 0.3s;
    }

    .status-pill.online {
      background: #f0fdf4;
      color: #166534;
    }

    .status-pill .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #ef4444;
      flex-shrink: 0;
    }

    .status-pill.online .dot {
      background: #22c55e;
    }

    @media (max-width: 768px) {
      .header {
        padding: 0.75rem 1rem;
      }

      .api-url-input input {
        width: 160px;
      }

      .subtitle {
        display: none;
      }
    }
  `]
})
export class HeaderComponent {
  apiService = inject(ApiService);

  onApiUrlChange(url: string): void {
    this.apiService.setApiUrl(url);
  }
}
