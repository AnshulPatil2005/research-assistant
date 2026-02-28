import { Component, inject, signal, input, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { ChatRequest, ChatResponse, ClaimType, SectionBucket, TableVariant } from '../../models/api.models';

type SearchMode = 'general' | 'claims' | 'tables';

interface SummarySection {
  title: string;
  content: string;
  color: 'blue' | 'violet' | 'green' | 'amber';
  icon: string;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="card">
      <div class="card-header">
        <div class="section-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <h2>Chat / Query Documents</h2>
      </div>

      <!-- Search Mode Selector -->
      <div class="mode-section">
        <span class="mode-label">Search Mode</span>
        <div class="mode-chips">
          <button
            class="mode-chip"
            [class.active]="searchMode() === 'general'"
            (click)="setMode('general')"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            General
          </button>
          <button
            class="mode-chip"
            [class.active]="searchMode() === 'claims'"
            (click)="setMode('claims')"
            title="Search only extracted research claims (methods, results, assumptions)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            Claims
          </button>
          <button
            class="mode-chip"
            [class.active]="searchMode() === 'tables'"
            (click)="setMode('tables')"
            title="Search only extracted tables and quantitative data"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/>
              <line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/>
            </svg>
            Tables
          </button>
        </div>
        @if (searchMode() === 'claims') {
          <p class="mode-hint">Searches only extracted research claims indexed from the document.</p>
        }
        @if (searchMode() === 'tables') {
          <p class="mode-hint">Searches only extracted tables and quantitative results.</p>
        }
      </div>

      <!-- Query Input -->
      <div class="form-group">
        <textarea
          [(ngModel)]="query"
          rows="3"
          [placeholder]="queryPlaceholder()"
          class="textarea"
        ></textarea>
      </div>

      <!-- Filters Row -->
      <div class="filters-row">
        <div class="filter-item">
          <label class="filter-label">Doc ID</label>
          <input
            type="text"
            [(ngModel)]="docId"
            placeholder="All documents"
            class="filter-input"
          />
        </div>
        <div class="filter-item">
          <label class="filter-label">Section</label>
          <select class="filter-select" [(ngModel)]="sectionBucket">
            <option value="">All sections</option>
            <option value="problem">Problem (Abstract / Intro)</option>
            <option value="method">Method</option>
            <option value="results">Key Results</option>
            <option value="limitations">Limitations</option>
          </select>
        </div>
      </div>

      <!-- Mode-Specific Filters -->
      @if (searchMode() === 'claims') {
        <div class="sub-filter-row">
          <label class="filter-label">Claim Type</label>
          <div class="sub-chips">
            <button class="sub-chip" [class.active]="claimType === ''" (click)="claimType = ''">All</button>
            <button class="sub-chip" [class.active]="claimType === 'method'" (click)="claimType = 'method'">Method</button>
            <button class="sub-chip" [class.active]="claimType === 'result'" (click)="claimType = 'result'">Result</button>
            <button class="sub-chip" [class.active]="claimType === 'assumption'" (click)="claimType = 'assumption'">Assumption</button>
          </div>
        </div>
      }

      @if (searchMode() === 'tables') {
        <div class="sub-filter-row">
          <label class="filter-label">Table Type</label>
          <div class="sub-chips">
            <button class="sub-chip" [class.active]="tableVariant === ''" (click)="tableVariant = ''">All</button>
            <button class="sub-chip" [class.active]="tableVariant === 'raw_markdown'" (click)="tableVariant = 'raw_markdown'">Full Table</button>
            <button class="sub-chip" [class.active]="tableVariant === 'normalized_row'" (click)="tableVariant = 'normalized_row'">Row Breakdown</button>
            <button class="sub-chip" [class.active]="tableVariant === 'metric_fact'" (click)="tableVariant = 'metric_fact'">Metric Facts</button>
          </div>
        </div>
      }

      <!-- Action Buttons -->
      <div class="actions">
        <button
          class="btn btn-primary"
          (click)="sendQuery()"
          [disabled]="!query || isLoading()"
        >
          @if (isLoading()) {
            <span class="btn-spinner"></span>Processing...
          } @else {
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
            Send Query
          }
        </button>

        <button
          class="btn btn-outline"
          (click)="getSummary()"
          [disabled]="!docId || isSummaryLoading()"
          title="Generates a structured overview: Problem, Method, Key Results, Limitations"
        >
          @if (isSummaryLoading()) {
            <span class="btn-spinner dark"></span>Summarizing...
          } @else {
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
              <line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
            Paper at a Glance
          }
        </button>
      </div>

      <!-- Structured Summary (Feature 3: Paper-at-a-Glance) -->
      @if (summaryText()) {
        <div class="summary-area">
          <div class="result-label">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            Paper at a Glance
          </div>

          @if (parsedSummary().length > 0) {
            <div class="summary-grid">
              @for (sec of parsedSummary(); track sec.title) {
                <div class="summary-card" [class]="'summary-' + sec.color">
                  <div class="summary-card-title">
                    <span class="summary-icon">{{ sec.icon }}</span>
                    {{ sec.title }}
                  </div>
                  <div class="summary-card-body">{{ sec.content.trim() }}</div>
                </div>
              }
            </div>
          } @else {
            <div class="summary-raw">{{ summaryText() }}</div>
          }
        </div>
      }

      <!-- Answer (Feature 2: Citation-Aware QA) -->
      @if (result()) {
        <div class="answer-area">
          <div class="answer-block">
            <div class="result-label">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              Answer
              @if (searchMode() === 'claims') {
                <span class="mode-tag claims">Claims Only</span>
              }
              @if (searchMode() === 'tables') {
                <span class="mode-tag tables">Tables Only</span>
              }
              @if (sectionBucket) {
                <span class="mode-tag section">{{ bucketLabel(sectionBucket) }}</span>
              }
            </div>
            <div class="answer-text">{{ result()!.answer }}</div>
          </div>

          <!-- Citations (Feature 2: verbatim quotes + page/section) -->
          @if (result()!.citations && result()!.citations!.length > 0) {
            <div class="citations-block">
              <div class="result-label">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                Sources ({{ result()!.citations!.length }})
              </div>
              @for (citation of result()!.citations; track $index) {
                <div class="citation" [class]="citationClass(citation)">
                  <div class="citation-num">{{ $index + 1 }}</div>
                  <div class="citation-body">
                    <div class="citation-header">
                      <span class="source-name">{{ citation.filename || 'Unknown' }}</span>

                      <!-- Page + Section (Feature 1: section-aware) -->
                      @if (citation.page) {
                        <span class="page-tag">p.{{ citation.page }}{{ citation.section ? ' · ' + citation.section : '' }}</span>
                      }

                      <!-- Section Bucket (Feature 1) -->
                      @if (citation.section_bucket) {
                        <span class="bucket-tag" [class]="'bucket-' + citation.section_bucket">
                          {{ bucketLabel(citation.section_bucket) }}
                        </span>
                      }

                      <!-- Claim Type (Feature 4) -->
                      @if (citation.is_claim && citation.claim_type) {
                        <span class="type-tag claim-tag">{{ citation.claim_type | uppercase }}</span>
                      } @else if (citation.is_claim) {
                        <span class="type-tag claim-tag">CLAIM</span>
                      }

                      <!-- Table Variant (Feature 5) -->
                      @if (citation.is_table && citation.table_variant) {
                        <span class="type-tag table-tag">{{ tableVariantLabel(citation.table_variant) }}</span>
                      } @else if (citation.is_table) {
                        <span class="type-tag table-tag">TABLE</span>
                      }
                    </div>

                    @if (citation.doc_id) {
                      <div class="doc-id">{{ truncateId(citation.doc_id) }}</div>
                    }
                    <div class="citation-text">"{{ citation.text_snippet }}"</div>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      }

      @if (error()) {
        <div class="error-card">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {{ error() }}
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

    /* ── Mode selector ─────────────────── */
    .mode-section {
      margin-bottom: 1rem;
    }

    .mode-label {
      display: block;
      font-size: 0.75rem;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }

    .mode-chips {
      display: flex;
      gap: 0.5rem;
    }

    .mode-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.4rem 0.875rem;
      border: 1px solid #e5e7eb;
      border-radius: 20px;
      background: #f9fafb;
      color: #6b7280;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
    }

    .mode-chip:hover {
      border-color: #6366f1;
      color: #6366f1;
      background: #eef2ff;
    }

    .mode-chip.active {
      background: #6366f1;
      border-color: #6366f1;
      color: #fff;
    }

    .mode-hint {
      margin: 0.5rem 0 0;
      font-size: 0.8125rem;
      color: #6b7280;
      font-style: italic;
    }

    /* ── Inputs ────────────────────────── */
    .form-group {
      margin-bottom: 0.875rem;
    }

    .textarea {
      width: 100%;
      padding: 0.5625rem 0.875rem;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 0.9375rem;
      font-family: inherit;
      transition: border-color 0.15s, box-shadow 0.15s;
      background: #f9fafb;
      color: #111827;
      box-sizing: border-box;
      resize: vertical;
      min-height: 80px;
    }

    .textarea:focus {
      outline: none;
      border-color: #6366f1;
      background: #fff;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
    }

    .filters-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }

    .filter-item {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }

    .filter-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .filter-input, .filter-select {
      padding: 0.4375rem 0.75rem;
      border: 1px solid #e5e7eb;
      border-radius: 7px;
      font-size: 0.875rem;
      background: #f9fafb;
      color: #111827;
      transition: border-color 0.15s, box-shadow 0.15s;
      font-family: inherit;
    }

    .filter-input:focus, .filter-select:focus {
      outline: none;
      border-color: #6366f1;
      background: #fff;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
    }

    .sub-filter-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
      flex-wrap: wrap;
    }

    .sub-chips {
      display: flex;
      gap: 0.375rem;
      flex-wrap: wrap;
    }

    .sub-chip {
      padding: 0.25rem 0.625rem;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      background: #f9fafb;
      color: #6b7280;
      font-size: 0.8125rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
    }

    .sub-chip:hover {
      border-color: #6366f1;
      color: #6366f1;
    }

    .sub-chip.active {
      background: #eef2ff;
      border-color: #6366f1;
      color: #4f46e5;
      font-weight: 600;
    }

    /* ── Action buttons ────────────────── */
    .actions {
      display: flex;
      gap: 0.75rem;
      margin-bottom: 0;
    }

    .btn {
      padding: 0.5625rem 1rem;
      border: none;
      border-radius: 8px;
      font-size: 0.9rem;
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
      flex: 1;
      justify-content: center;
    }

    .btn-primary:hover:not(:disabled) { background: #4f46e5; }

    .btn-outline {
      background: #fff;
      color: #374151;
      border: 1px solid #e5e7eb;
      flex: 1;
      justify-content: center;
    }

    .btn-outline:hover:not(:disabled) {
      background: #f9fafb;
      border-color: #d1d5db;
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

    .btn-spinner.dark {
      border-color: rgba(55, 65, 81, 0.2);
      border-top-color: #374151;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Result label ──────────────────── */
    .result-label {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.75rem;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.625rem;
    }

    .mode-tag {
      padding: 0.15rem 0.5rem;
      border-radius: 10px;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .mode-tag.claims { background: #ede9fe; color: #5b21b6; }
    .mode-tag.tables { background: #ccfbf1; color: #0f766e; }
    .mode-tag.section { background: #fef3c7; color: #92400e; }

    /* ── Summary (Feature 3) ───────────── */
    .summary-area {
      margin-top: 1.25rem;
      padding-top: 1.25rem;
      border-top: 1px solid #f3f4f6;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.625rem;
    }

    .summary-card {
      border-radius: 10px;
      padding: 0.875rem;
      border: 1px solid transparent;
    }

    .summary-card-title {
      font-size: 0.8125rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }

    .summary-icon {
      font-size: 0.9rem;
    }

    .summary-card-body {
      font-size: 0.875rem;
      line-height: 1.6;
      white-space: pre-wrap;
    }

    .summary-blue { background: #eff6ff; border-color: #bfdbfe; color: #1e3a5f; }
    .summary-blue .summary-card-title { color: #1d4ed8; }

    .summary-violet { background: #f5f3ff; border-color: #ddd6fe; color: #3b2f6e; }
    .summary-violet .summary-card-title { color: #6d28d9; }

    .summary-green { background: #f0fdf4; border-color: #bbf7d0; color: #14532d; }
    .summary-green .summary-card-title { color: #15803d; }

    .summary-amber { background: #fffbeb; border-color: #fde68a; color: #451a03; }
    .summary-amber .summary-card-title { color: #92400e; }

    .summary-raw {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 1rem;
      font-size: 0.9rem;
      line-height: 1.65;
      white-space: pre-wrap;
      color: #374151;
    }

    /* ── Answer + Citations (Feature 2) ── */
    .answer-area {
      margin-top: 1.25rem;
      padding-top: 1.25rem;
      border-top: 1px solid #f3f4f6;
    }

    .answer-block {
      margin-bottom: 1.25rem;
    }

    .answer-text {
      line-height: 1.65;
      color: #111827;
      font-size: 0.9375rem;
      white-space: pre-wrap;
    }

    .citations-block {
      border-top: 1px solid #f3f4f6;
      padding-top: 1rem;
    }

    .citation {
      display: flex;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
      padding-left: 0.375rem;
      border-left: 3px solid #e5e7eb;
    }

    .citation.citation-claim { border-left-color: #a78bfa; }
    .citation.citation-table { border-left-color: #2dd4bf; }

    .citation:last-child { margin-bottom: 0; }

    .citation-num {
      width: 22px;
      height: 22px;
      background: #eef2ff;
      color: #6366f1;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 700;
      flex-shrink: 0;
      margin-top: 0.1rem;
    }

    .citation-body { flex: 1; min-width: 0; }

    .citation-header {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      flex-wrap: wrap;
      margin-bottom: 0.25rem;
    }

    .source-name {
      font-weight: 600;
      color: #111827;
      font-size: 0.875rem;
    }

    .page-tag {
      font-size: 0.8125rem;
      color: #6b7280;
      background: #f3f4f6;
      padding: 0.1rem 0.4rem;
      border-radius: 4px;
    }

    /* Section bucket badges (Feature 1) */
    .bucket-tag {
      font-size: 0.7rem;
      font-weight: 600;
      padding: 0.15rem 0.45rem;
      border-radius: 8px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .bucket-problem  { background: #dbeafe; color: #1d4ed8; }
    .bucket-method   { background: #ede9fe; color: #6d28d9; }
    .bucket-results  { background: #dcfce7; color: #15803d; }
    .bucket-limitations { background: #fef3c7; color: #92400e; }
    .bucket-other    { background: #f3f4f6; color: #6b7280; }

    /* Content type tags (Feature 4 + 5) */
    .type-tag {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.15rem 0.45rem;
      border-radius: 8px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .claim-tag { background: #ede9fe; color: #5b21b6; }
    .table-tag { background: #ccfbf1; color: #0f766e; }

    .doc-id {
      font-size: 0.75rem;
      color: #9ca3af;
      font-family: var(--font-mono, monospace);
      margin-bottom: 0.3rem;
    }

    .citation-text {
      font-style: italic;
      color: #4b5563;
      line-height: 1.55;
      font-size: 0.875rem;
    }

    /* ── Error ─────────────────────────── */
    .error-card {
      margin-top: 1rem;
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      padding: 0.875rem 1rem;
      background: #fef2f2;
      border: 1px solid #fca5a5;
      border-radius: 8px;
      color: #dc2626;
      font-size: 0.9375rem;
    }

    @media (max-width: 640px) {
      .filters-row { grid-template-columns: 1fr; }
      .summary-grid { grid-template-columns: 1fr; }
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
      if (id) this.docId = id;
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

  queryPlaceholder(): string {
    const mode = this.searchMode();
    if (mode === 'claims') return 'Ask about research claims, methods, or assumptions...';
    if (mode === 'tables') return 'Ask about quantitative results, metrics, or table data...';
    return 'Ask a question about your documents...';
  }

  bucketLabel(bucket: string): string {
    const labels: Record<string, string> = {
      problem: 'Problem',
      method: 'Method',
      results: 'Key Results',
      limitations: 'Limitations',
      other: 'Other',
    };
    return labels[bucket] ?? bucket;
  }

  tableVariantLabel(variant: string): string {
    const labels: Record<string, string> = {
      raw_markdown: 'TABLE',
      normalized_row: 'ROW',
      metric_fact: 'METRIC',
    };
    return labels[variant] ?? variant.toUpperCase();
  }

  citationClass(citation: { is_claim?: boolean; is_table?: boolean }): string {
    if (citation.is_claim) return 'citation-claim';
    if (citation.is_table) return 'citation-table';
    return '';
  }

  truncateId(id: string): string {
    return id.length > 20 ? id.substring(0, 8) + '\u2026' + id.substring(id.length - 4) : id;
  }

  parseSummaryText(text: string): SummarySection[] {
    const definitions: Array<{ key: string; title: string; color: SummarySection['color']; icon: string }> = [
      { key: 'Problem',      title: 'Problem',      color: 'blue',   icon: '🔍' },
      { key: 'Method',       title: 'Method',       color: 'violet', icon: '⚙️' },
      { key: 'Key Results',  title: 'Key Results',  color: 'green',  icon: '📊' },
      { key: 'Limitations',  title: 'Limitations',  color: 'amber',  icon: '⚠️' },
    ];

    // Build a regex that splits on **Section** or ## Section headers
    const headerPattern = definitions.map(d => d.key.replace(' ', '\\s+')).join('|');
    const regex = new RegExp(`(?:\\*\\*|##\\s?)(${headerPattern})(?:\\*\\*)?`, 'gi');

    const parts = text.split(regex);
    if (parts.length < 3) return [];

    const sections: SummarySection[] = [];
    for (let i = 1; i < parts.length; i += 2) {
      const rawTitle = parts[i].trim();
      const content = (parts[i + 1] || '').trim();
      const def = definitions.find(d => d.key.toLowerCase() === rawTitle.toLowerCase());
      if (def && content) {
        sections.push({ title: def.title, content, color: def.color, icon: def.icon });
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
      ...(mode === 'tables' && this.tableVariant && { table_variant: this.tableVariant }),
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
