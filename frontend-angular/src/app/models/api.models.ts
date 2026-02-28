export type OcrMode = 'auto' | 'always' | 'never';
export type SectionBucket = 'problem' | 'method' | 'results' | 'limitations' | 'other';
export type ClaimType = 'method' | 'result' | 'assumption';
export type TableVariant = 'raw_markdown' | 'normalized_row' | 'metric_fact';

export interface UploadResponse {
  message: string;
  task_id?: string;
  doc_id?: string;
  ocr_mode?: OcrMode;
  detail?: string;
}

export interface TaskProcessingInfo {
  step?: string;
  doc_id?: string;
  ocr_mode?: OcrMode;
  ocr_used?: boolean;
  ocr_skipped?: boolean;
  ocr_skip_reason?: string;
  ingestion_mode?: 'ocr' | 'digital_text';
  pdf_type?: string;
}

export interface TaskResult {
  status?: string;
  doc_id?: string;
  chunks_count?: number;
  claims_count?: number;
  ocr_mode?: OcrMode;
  ocr_used?: boolean;
  ocr_skipped?: boolean;
  ocr_skip_reason?: string;
  ingestion_mode?: 'ocr' | 'digital_text';
  pdf_type?: string;
}

export interface TaskStatus {
  task_id: string;
  status: 'PENDING' | 'STARTED' | 'PROCESSING' | 'SUCCESS' | 'FAILURE';
  info?: TaskProcessingInfo;
  result?: TaskResult | Record<string, unknown>;
  error?: string;
}

export interface Citation {
  filename?: string;
  page?: number;
  section?: string;
  section_bucket?: SectionBucket;
  doc_id?: string;
  text_snippet: string;
  is_table?: boolean;
  is_claim?: boolean;
  claim_type?: ClaimType;
  table_variant?: TableVariant;
  content_type?: string;
}

export interface ChatRequest {
  query: string;
  doc_id?: string;
  section?: string;
  section_bucket?: SectionBucket;
  is_claim?: boolean;
  claim_type?: ClaimType;
  is_table?: boolean;
  table_variant?: TableVariant;
}

export interface ChatResponse {
  answer: string;
  citations?: Citation[];
}

export interface SummaryResponse {
  summary: string;
}

export interface RecentTask {
  task_id: string;
  doc_id?: string;
  filename: string;
  timestamp: string;
  status: string;
}

export interface HealthStatus {
  online: boolean;
  message?: string;
}
