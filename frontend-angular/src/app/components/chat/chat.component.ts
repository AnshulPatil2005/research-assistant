import { CommonModule } from '@angular/common';
import { Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChatRequest, ChatResponse, ClaimType, SectionBucket, TableVariant } from '../../models/api.models';
import { ApiService } from '../../services/api.service';

type SearchMode = 'general' | 'claims' | 'tables';

interface SummarySection {
  title: string;
  content: string;
  color: 'blue' | 'amber' | 'green' | 'rose';
  index: string;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="card">
      <div class="card-header">
        <div>
          <span class="eyebrow">Step 3</span>
          <h2>Ask grounded questions and summarize papers</h2>
          <p class="intro">
            Query across all documents or narrow the search to claims, tables, or section buckets.
            Results stay presentation-friendly with source snippets and structured paper summaries.
          </p>
        </div>

        @if (docId) {
          <div class="active-doc">
            <span class="meta-label">Active doc</span>
            <code>{{ truncateId(docId) }}</code>
          </div>
        }
      </div>

      <div class="mode-panel">
        <span class="meta-label">Search mode</span>
        <div class="mode-row">
          <button
            class="mode-chip"
            [class.active]="searchMode() === 'general'"
            (click)="setMode('general')"
            type="button"
          >
            General QA
          </button>
          <button
            class="mode-chip"
            [class.active]="searchMode() === 'claims'"
            (click)="setMode('claims')"
            type="button"
          >
            Claims focus
          </button>
          <button
            class="mode-chip"
            [class.active]="searchMode() === 'tables'"
            (click)="setMode('tables')"
            type="button"
          >
            Tables focus
          </button>
        </div>
        <p class="mode-hint">{{ modeHint() }}</p>
      </div>

      <div class="prompt-row">
        @for (prompt of quickPrompts(); track prompt) {
          <button class="prompt-chip" (click)="applyPrompt(prompt)" type="button">{{ prompt }}</button>
        }
      </div>

      <div class="composer">
        <label class="composer-label" for="queryInput">Question</label>
        <textarea
          id="queryInput"
          [(ngModel)]="query"
          rows="4"
          [placeholder]="queryPlaceholder()"
          class="textarea"
        ></textarea>
      </div>

      <div class="filter-grid">
        <label class="filter-box">
          <span class="meta-label">Document scope</span>
          <input
            type="text"
            [(ngModel)]="docId"
            placeholder="All documents"
          />
        </label>

        <label class="filter-box">
          <span class="meta-label">Section bucket</span>
          <select [(ngModel)]="sectionBucket">
            <option value="">All sections</option>
            <option value="problem">Problem</option>
            <option value="method">Method</option>
            <option value="results">Key results</option>
            <option value="limitations">Limitations</option>
          </select>
        </label>
      </div>

      @if (searchMode() === 'claims') {
        <div class="subfilters">
          <span class="meta-label">Claim type</span>
          <div class="subfilter-row">
            <button class="sub-chip" [class.active]="claimType === ''" (click)="claimType = ''" type="button">All</button>
            <button class="sub-chip" [class.active]="claimType === 'method'" (click)="claimType = 'method'" type="button">Method</button>
            <button class="sub-chip" [class.active]="claimType === 'result'" (click)="claimType = 'result'" type="button">Result</button>
            <button class="sub-chip" [class.active]="claimType === 'assumption'" (click)="claimType = 'assumption'" type="button">Assumption</button>
          </div>
        </div>
      }

      @if (searchMode() === 'tables') {
        <div class="subfilters">
          <span class="meta-label">Table type</span>
          <div class="subfilter-row">
            <button class="sub-chip" [class.active]="tableVariant === ''" (click)="tableVariant = ''" type="button">All</button>
            <button class="sub-chip" [class.active]="tableVariant === 'raw_markdown'" (click)="tableVariant = 'raw_markdown'" type="button">Full table</button>
            <button class="sub-chip" [class.active]="tableVariant === 'normalized_row'" (click)="tableVariant = 'normalized_row'" type="button">Rows</button>
            <button class="sub-chip" [class.active]="tableVariant === 'metric_fact'" (click)="tableVariant = 'metric_fact'" type="button">Metric facts</button>
          </div>
        </div>
      }

      <div class="action-row">
        <button
          class="primary-btn"
          (click)="sendQuery()"
          [disabled]="!query || isLoading()"
          type="button"
        >
          @if (isLoading()) {
            <span class="spinner light"></span>
            Generating answer
          } @else {
            Ask the assistant
          }
        </button>

        <button
          class="secondary-btn"
          (click)="getSummary()"
          [disabled]="!docId || isSummaryLoading()"
          type="button"
        >
          @if (isSummaryLoading()) {
            <span class="spinner"></span>
            Building summary
          } @else {
            Paper at a glance
          }
        </button>
      </div>

      @if (summaryText()) {
        <div class="summary-block">
          <div class="block-heading">
            <span class="meta-label">Structured summary</span>
            <strong>Paper at a glance</strong>
          </div>

          @if (parsedSummary().length > 0) {
            <div class="summary-grid">
              @for (sec of parsedSummary(); track sec.title) {
                <div class="summary-card" [ngClass]="'summary-' + sec.color">
                  <span class="summary-index">{{ sec.index }}</span>
                  <h3>{{ sec.title }}</h3>
                  <p>{{ sec.content.trim() }}</p>
                </div>
              }
            </div>
          } @else {
            <div class="raw-summary">{{ summaryText() }}</div>
          }
        </div>
      }

      @if (result()) {
        <div class="answer-block">
          <div class="block-heading">
            <span class="meta-label">Answer</span>
            <strong>Citation-grounded response</strong>
          </div>

          <div class="answer-meta">
            <span class="pill">{{ modePillLabel() }}</span>
            @if (sectionBucket) {
              <span class="pill">{{ bucketLabel(sectionBucket) }}</span>
            }
            @if (result()!.citations?.length) {
              <span class="pill">{{ result()!.citations!.length }} sources</span>
            }
          </div>

          <div class="answer-text">{{ result()!.answer }}</div>

          @if (result()!.citations && result()!.citations!.length > 0) {
            <div class="citation-list">
              @for (citation of result()!.citations; track $index) {
                <article class="citation-card" [ngClass]="citationClass(citation)">
                  <div class="citation-index">{{ $index + 1 }}</div>

                  <div class="citation-body">
                    <div class="citation-top">
                      <strong>{{ citation.filename || 'Unknown source' }}</strong>

                      <div class="citation-tags">
                        @if (citation.page) {
                          <span class="tag">p.{{ citation.page }}</span>
                        }
                        @if (citation.section_bucket) {
                          <span class="tag">{{ bucketLabel(citation.section_bucket) }}</span>
                        }
                        @if (citation.is_claim && citation.claim_type) {
                          <span class="tag claim">{{ citation.claim_type | uppercase }}</span>
                        } @else if (citation.is_claim) {
                          <span class="tag claim">CLAIM</span>
                        }
                        @if (citation.is_table && citation.table_variant) {
                          <span class="tag table">{{ tableVariantLabel(citation.table_variant) }}</span>
                        } @else if (citation.is_table) {
                          <span class="tag table">TABLE</span>
                        }
                      </div>
                    </div>

                    @if (citation.doc_id) {
                      <code class="doc-ref">{{ truncateId(citation.doc_id) }}</code>
                    }

                    <p class="citation-text">"{{ citation.text_snippet }}"</p>
                  </div>
                </article>
              }
            </div>
          }
        </div>
      }

      @if (error()) {
        <div class="error-box">
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
      box-shadow: var(--surface-shadow);
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
      font-size: 2rem;
      line-height: 1;
      letter-spacing: -0.04em;
    }

    .intro {
      margin: 0.7rem 0 0;
      max-width: 58ch;
      color: var(--color-muted);
      line-height: 1.7;
    }

    .active-doc {
      min-width: 160px;
      padding: 0.9rem 1rem;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.75);
      border: 1px solid var(--color-border);
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

    .active-doc code,
    .doc-ref {
      color: var(--color-ink);
      word-break: break-word;
    }

    .mode-panel {
      margin-top: 1.2rem;
      padding: 1rem;
      border-radius: 24px;
      background: rgba(255, 255, 255, 0.68);
      border: 1px solid var(--color-border);
    }

    .mode-row,
    .prompt-row,
    .subfilter-row,
    .action-row,
    .answer-meta,
    .citation-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.65rem;
    }

    .mode-chip,
    .prompt-chip,
    .sub-chip,
    .primary-btn,
    .secondary-btn {
      border: 0;
      cursor: pointer;
      transition: transform 0.2s ease, background 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
    }

    .mode-chip,
    .prompt-chip,
    .sub-chip {
      padding: 0.7rem 0.95rem;
      border-radius: 999px;
      background: rgba(18, 32, 58, 0.06);
      color: var(--color-muted);
      font-size: 0.86rem;
      font-weight: 700;
    }

    .mode-chip:hover,
    .prompt-chip:hover,
    .sub-chip:hover,
    .mode-chip.active,
    .sub-chip.active {
      transform: translateY(-2px);
      background: var(--color-accent-soft);
      color: var(--color-accent-deep);
    }

    .mode-chip.active {
      box-shadow: 0 12px 22px rgba(252, 92, 44, 0.14);
    }

    .mode-hint {
      margin: 0.8rem 0 0;
      color: var(--color-muted);
      line-height: 1.6;
    }

    .prompt-row {
      margin-top: 0.9rem;
    }

    .composer {
      margin-top: 1rem;
    }

    .composer-label {
      display: inline-flex;
      margin-bottom: 0.55rem;
      color: var(--color-ink);
      font-size: 0.85rem;
      font-weight: 700;
    }

    .textarea,
    .filter-box input,
    .filter-box select {
      width: 100%;
      border: 1px solid var(--color-border);
      background: rgba(255, 255, 255, 0.82);
      color: var(--color-ink);
    }

    .textarea {
      min-height: 140px;
      padding: 1rem;
      border-radius: 22px;
      resize: vertical;
      line-height: 1.7;
    }

    .textarea:focus,
    .filter-box input:focus,
    .filter-box select:focus {
      outline: none;
      border-color: rgba(252, 92, 44, 0.26);
      box-shadow: 0 0 0 4px rgba(252, 92, 44, 0.1);
    }

    .filter-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.9rem;
      margin-top: 1rem;
    }

    .filter-box {
      display: block;
      padding: 0.95rem;
      border-radius: 22px;
      background: rgba(255, 255, 255, 0.68);
      border: 1px solid var(--color-border);
    }

    .filter-box input,
    .filter-box select {
      min-height: 48px;
      margin-top: 0.3rem;
      padding: 0.75rem 0.85rem;
      border-radius: 16px;
    }

    .subfilters {
      margin-top: 1rem;
      padding: 1rem;
      border-radius: 22px;
      background: rgba(255, 255, 255, 0.64);
      border: 1px solid var(--color-border);
    }

    .action-row {
      margin-top: 1rem;
    }

    .primary-btn,
    .secondary-btn {
      min-height: 54px;
      padding: 0 1.2rem;
      border-radius: 18px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.6rem;
      flex: 1;
    }

    .primary-btn {
      background: linear-gradient(135deg, var(--color-accent) 0%, #ff8b53 100%);
      color: #fff;
      box-shadow: 0 18px 34px rgba(252, 92, 44, 0.22);
    }

    .secondary-btn {
      background: rgba(18, 32, 58, 0.07);
      color: var(--color-ink);
    }

    .primary-btn:hover:not(:disabled),
    .secondary-btn:hover:not(:disabled) {
      transform: translateY(-2px);
    }

    .primary-btn:disabled,
    .secondary-btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
      box-shadow: none;
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(18, 32, 58, 0.2);
      border-top-color: currentColor;
      border-radius: 999px;
      animation: spin 0.75s linear infinite;
      flex-shrink: 0;
    }

    .spinner.light {
      border-color: rgba(255, 255, 255, 0.28);
      border-top-color: #fff;
    }

    .summary-block,
    .answer-block,
    .error-box {
      margin-top: 1rem;
      padding: 1rem;
      border-radius: 24px;
      background: rgba(255, 255, 255, 0.74);
      border: 1px solid var(--color-border);
    }

    .block-heading strong {
      font-family: var(--font-display);
      font-size: 1.35rem;
      letter-spacing: -0.03em;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.85rem;
      margin-top: 0.9rem;
    }

    .summary-card {
      position: relative;
      padding: 1rem;
      border-radius: 22px;
      border: 1px solid transparent;
      overflow: hidden;
    }

    .summary-card h3 {
      margin: 0.65rem 0 0.45rem;
      font-size: 1rem;
    }

    .summary-card p {
      margin: 0;
      line-height: 1.65;
      color: var(--color-ink);
    }

    .summary-index {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.85);
      font-family: var(--font-display);
      font-weight: 700;
    }

    .summary-blue {
      background: rgba(26, 145, 255, 0.12);
      border-color: rgba(26, 145, 255, 0.18);
    }

    .summary-amber {
      background: rgba(236, 168, 46, 0.16);
      border-color: rgba(165, 106, 24, 0.18);
    }

    .summary-green {
      background: rgba(29, 138, 82, 0.12);
      border-color: rgba(29, 138, 82, 0.18);
    }

    .summary-rose {
      background: rgba(252, 92, 44, 0.12);
      border-color: rgba(252, 92, 44, 0.18);
    }

    .raw-summary,
    .answer-text {
      margin-top: 0.9rem;
      white-space: pre-wrap;
      line-height: 1.75;
      color: var(--color-ink);
    }

    .answer-meta {
      margin-top: 0.8rem;
    }

    .pill,
    .tag {
      display: inline-flex;
      align-items: center;
      min-height: 32px;
      padding: 0.35rem 0.65rem;
      border-radius: 999px;
      background: rgba(18, 32, 58, 0.07);
      color: var(--color-muted);
      font-size: 0.74rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .tag.claim {
      background: rgba(252, 92, 44, 0.12);
      color: var(--color-accent-deep);
    }

    .tag.table {
      background: rgba(26, 145, 255, 0.12);
      color: var(--color-secondary);
    }

    .citation-list {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      margin-top: 1rem;
    }

    .citation-card {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 0.9rem;
      padding: 1rem;
      border-radius: 22px;
      background: rgba(248, 248, 248, 0.86);
      border: 1px solid rgba(18, 32, 58, 0.08);
    }

    .citation-card.citation-claim {
      border-color: rgba(252, 92, 44, 0.18);
    }

    .citation-card.citation-table {
      border-color: rgba(26, 145, 255, 0.18);
    }

    .citation-index {
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      border-radius: 14px;
      background: rgba(18, 32, 58, 0.08);
      font-family: var(--font-display);
      font-weight: 700;
      flex-shrink: 0;
    }

    .citation-top {
      display: flex;
      justify-content: space-between;
      gap: 0.75rem;
      align-items: flex-start;
      flex-wrap: wrap;
    }

    .citation-top strong {
      font-size: 1rem;
    }

    .citation-text {
      margin: 0.7rem 0 0;
      color: var(--color-muted);
      line-height: 1.7;
      font-style: italic;
    }

    .error-box p {
      margin: 0;
      color: var(--color-danger);
      line-height: 1.65;
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

      .card-header,
      .filter-grid,
      .summary-grid,
      .citation-card {
        grid-template-columns: 1fr;
      }

      .card-header,
      .citation-card {
        display: flex;
        flex-direction: column;
      }

      .action-row {
        flex-direction: column;
      }

      .primary-btn,
      .secondary-btn {
        width: 100%;
      }
    }
  `]
})
export class ChatComponent {
  private apiService = inject(ApiService);

  initialDocId = input<string>('');

  query = '';
  docId = '';
  sectionBucket: SectionBucket | '' = '';
  claimType: ClaimType | '' = '';
  tableVariant: TableVariant | '' = '';

  searchMode = signal<SearchMode>('general');
  isLoading = signal(false);
  isSummaryLoading = signal(false);
  result = signal<ChatResponse | null>(null);
  summaryText = signal<string | null>(null);
  parsedSummary = signal<SummarySection[]>([]);
  error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.initialDocId();
      if (id) {
        this.docId = id;
      }
    });
  }

  setDocId(id: string): void {
    this.docId = id;
  }

  setMode(mode: SearchMode): void {
    this.searchMode.set(mode);
    this.claimType = '';
    this.tableVariant = '';
  }

  quickPrompts(): string[] {
    const mode = this.searchMode();
    if (mode === 'claims') {
      return [
        'List the strongest result claims with citations',
        'What assumptions does the paper rely on?',
        'Summarize the method claims in plain language'
      ];
    }

    if (mode === 'tables') {
      return [
        'Extract the key benchmark numbers',
        'Which table shows the best result?',
        'Summarize the quantitative findings'
      ];
    }

    return [
      'Summarize the methodology and limitations',
      'What are the key results with sources?',
      'Give me a concise executive briefing'
    ];
  }

  applyPrompt(prompt: string): void {
    this.query = prompt;
  }

  modeHint(): string {
    const mode = this.searchMode();
    if (mode === 'claims') return 'Filters retrieval to extracted research claims such as methods, assumptions, and reported results.';
    if (mode === 'tables') return 'Filters retrieval to extracted tables and quantitative data points.';
    return 'Searches the general document index and is best for broad paper Q&A.';
  }

  queryPlaceholder(): string {
    const mode = this.searchMode();
    if (mode === 'claims') return 'Ask about methods, assumptions, or reported findings...';
    if (mode === 'tables') return 'Ask about metrics, tables, or benchmark comparisons...';
    return 'Ask a citation-grounded question about the uploaded documents...';
  }

  modePillLabel(): string {
    if (this.searchMode() === 'claims') return 'Claims mode';
    if (this.searchMode() === 'tables') return 'Tables mode';
    return 'General mode';
  }

  bucketLabel(bucket: string): string {
    const labels: Record<string, string> = {
      problem: 'Problem',
      method: 'Method',
      results: 'Results',
      limitations: 'Limitations',
      other: 'Other'
    };
    return labels[bucket] ?? bucket;
  }

  tableVariantLabel(variant: string): string {
    const labels: Record<string, string> = {
      raw_markdown: 'TABLE',
      normalized_row: 'ROWS',
      metric_fact: 'METRIC'
    };
    return labels[variant] ?? variant.toUpperCase();
  }

  citationClass(citation: { is_claim?: boolean; is_table?: boolean }): string {
    if (citation.is_claim) return 'citation-claim';
    if (citation.is_table) return 'citation-table';
    return '';
  }

  truncateId(id: string): string {
    return id.length > 20 ? `${id.substring(0, 8)}...${id.substring(id.length - 4)}` : id;
  }

  parseSummaryText(text: string): SummarySection[] {
    const definitions: Array<{ key: string; title: string; color: SummarySection['color']; index: string }> = [
      { key: 'Problem', title: 'Problem', color: 'blue', index: '01' },
      { key: 'Method', title: 'Method', color: 'amber', index: '02' },
      { key: 'Key Results', title: 'Key Results', color: 'green', index: '03' },
      { key: 'Limitations', title: 'Limitations', color: 'rose', index: '04' }
    ];

    const headerPattern = definitions.map((definition) => definition.key.replace(' ', '\\s+')).join('|');
    const regex = new RegExp(`(?:\\*\\*|##\\s?)(${headerPattern})(?:\\*\\*)?`, 'gi');

    const parts = text.split(regex);
    if (parts.length < 3) return [];

    const sections: SummarySection[] = [];
    for (let i = 1; i < parts.length; i += 2) {
      const rawTitle = parts[i].trim();
      const content = (parts[i + 1] || '').trim();
      const definition = definitions.find((item) => item.key.toLowerCase() === rawTitle.toLowerCase());

      if (definition && content) {
        sections.push({
          title: definition.title,
          content,
          color: definition.color,
          index: definition.index
        });
      }
    }

    return sections;
  }

  sendQuery(): void {
    if (!this.query) return;

    const mode = this.searchMode();
    this.isLoading.set(true);
    this.result.set(null);
    this.summaryText.set(null);
    this.parsedSummary.set([]);
    this.error.set(null);

    const request: ChatRequest = {
      query: this.query,
      ...(this.docId && { doc_id: this.docId }),
      ...(this.sectionBucket && { section_bucket: this.sectionBucket }),
      ...(mode === 'claims' && { is_claim: true }),
      ...(mode === 'claims' && this.claimType && { claim_type: this.claimType }),
      ...(mode === 'tables' && { is_table: true }),
      ...(mode === 'tables' && this.tableVariant && { table_variant: this.tableVariant })
    };

    this.apiService.chat(request).subscribe({
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

  getSummary(): void {
    if (!this.docId) return;

    this.isSummaryLoading.set(true);
    this.summaryText.set(null);
    this.parsedSummary.set([]);
    this.result.set(null);
    this.error.set(null);

    this.apiService.getSummary(this.docId).subscribe({
      next: (response) => {
        this.isSummaryLoading.set(false);
        this.summaryText.set(response.summary);
        this.parsedSummary.set(this.parseSummaryText(response.summary));
      },
      error: (err) => {
        this.isSummaryLoading.set(false);
        this.error.set(`Error: ${err.message}`);
      }
    });
  }
}
