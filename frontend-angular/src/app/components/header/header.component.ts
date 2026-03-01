import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="header-shell">
      <div class="header-inner">
        <div class="brand">
          <div class="brand-mark">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <path d="M8 13h8"/>
              <path d="M8 17h5"/>
            </svg>
          </div>

          <div class="brand-copy">
            <span class="micro-label">Research Ops</span>
            <h1>Research Assistant</h1>
            <p>Polished RAG workflow for hackathon judging and live demos.</p>
          </div>
        </div>

        <div class="header-tools">
          <label class="api-field" for="apiUrl">
            <span>API Endpoint</span>
            <input
              id="apiUrl"
              type="text"
              [ngModel]="apiService.apiUrl()"
              (ngModelChange)="onApiUrlChange($event)"
              placeholder="http://localhost:8000"
            />
          </label>

          <div class="status-pill" [class.online]="apiService.healthStatus().online">
            <span class="dot"></span>
            <span>{{ apiService.healthStatus().online ? 'Backend Online' : 'Backend Offline' }}</span>
          </div>
        </div>
      </div>
    </header>
  `,
  styles: [`
    .header-shell {
      position: sticky;
      top: 0;
      z-index: 40;
      padding: 1rem 0 0;
      backdrop-filter: blur(14px);
    }

    .header-inner {
      width: min(1180px, calc(100vw - 2rem));
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      padding: 1rem 1.15rem;
      border-radius: 28px;
      background: rgba(255, 255, 255, 0.68);
      border: 1px solid rgba(255, 255, 255, 0.72);
      box-shadow: 0 18px 42px rgba(18, 32, 58, 0.08);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.9rem;
      min-width: 0;
    }

    .brand-mark {
      width: 54px;
      height: 54px;
      display: grid;
      place-items: center;
      border-radius: 18px;
      color: #fff;
      background: linear-gradient(135deg, var(--color-accent) 0%, #ff8b53 100%);
      box-shadow: 0 16px 34px rgba(252, 92, 44, 0.28);
      flex-shrink: 0;
    }

    .brand-copy {
      min-width: 0;
    }

    .micro-label {
      display: inline-flex;
      margin-bottom: 0.28rem;
      color: var(--color-accent-deep);
      font-size: 0.74rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }

    .brand-copy h1 {
      font-family: var(--font-display);
      font-size: 1.45rem;
      line-height: 1;
      letter-spacing: -0.04em;
    }

    .brand-copy p {
      margin: 0.3rem 0 0;
      color: var(--color-muted);
      font-size: 0.9rem;
    }

    .header-tools {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .api-field {
      display: flex;
      flex-direction: column;
      gap: 0.38rem;
      min-width: min(100%, 280px);
    }

    .api-field span {
      color: var(--color-muted);
      font-size: 0.74rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }

    .api-field input {
      min-height: 46px;
      padding: 0.75rem 0.9rem;
      border-radius: 16px;
      border: 1px solid var(--color-border);
      background: rgba(255, 255, 255, 0.85);
      color: var(--color-ink);
      transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
    }

    .api-field input:focus {
      outline: none;
      border-color: rgba(252, 92, 44, 0.32);
      box-shadow: 0 0 0 4px rgba(252, 92, 44, 0.12);
      transform: translateY(-1px);
    }

    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.55rem;
      min-height: 46px;
      padding: 0.75rem 1rem;
      border-radius: 999px;
      background: var(--color-danger-soft);
      color: var(--color-danger);
      font-size: 0.86rem;
      font-weight: 700;
      white-space: nowrap;
    }

    .status-pill.online {
      background: var(--color-success-soft);
      color: var(--color-success);
    }

    .dot {
      width: 9px;
      height: 9px;
      border-radius: 999px;
      background: currentColor;
      box-shadow: 0 0 0 5px rgba(195, 58, 51, 0.12);
    }

    .status-pill.online .dot {
      box-shadow: 0 0 0 5px rgba(29, 138, 82, 0.12);
    }

    @media (max-width: 920px) {
      .header-inner {
        flex-direction: column;
        align-items: stretch;
      }

      .header-tools {
        justify-content: stretch;
      }

      .api-field {
        min-width: 100%;
      }
    }

    @media (max-width: 720px) {
      .header-shell {
        padding-top: 0.55rem;
      }

      .header-inner {
        width: min(1180px, calc(100vw - 1rem));
      }

      .brand-copy p {
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
