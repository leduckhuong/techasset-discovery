export interface TechSignature {
  name: string;
  category: 'Frontend' | 'Framework' | 'UI Library' | 'CMS' | 'Web Server' | 'CDN' | 'Language' | 'Analytics' | 'Security' | 'DevOps' | 'Technology';
  version?: string;
  icon?: string;
  color?: string; // Quasar color token or hex
  source?: string; // 'nuclei' nếu phát hiện bởi nuclei tech templates
  templateId?: string;
}

export interface SslInfo {
  valid: boolean;
  issuer: string;
  commonName: string;
  expiryDate?: string;
  daysRemaining?: number;
  expiredAgoDays?: number;
}

export interface ScanResult {
  id: string;
  url: string;
  finalUrl?: string;
  host: string;
  port?: number;
  scheme: 'http' | 'https';
  statusCode: number;
  statusText?: string;
  title?: string;
  webServer?: string;
  contentLength?: number;
  contentType?: string;
  responseTimeMs: number;
  ip?: string;
  asn?: string; // e.g. "AS135905 | VNPT Corp"
  cname?: string;
  technologies: TechSignature[];
  headers: Record<string, string>;
  chain?: string[];
  timestamp: string;
  ssl?: SslInfo;
  labels?: string[];
  screenshotUrl?: string;
  assetGroupId?: string;
  meta?: Record<string, string>;
  error?: string;
}

export interface ScanOptions {
  techDetect: boolean;
  statusCode: boolean;
  title: boolean;
  followRedirects: boolean;
  probe: boolean; // probe both http & https
  timeoutSec: number;
  threads: number;
  nuclei: boolean; // nuclei -tags tech,discovery enrichment
  portScan: boolean; // httpx dò web port sau khi quét
  portList: string; // danh sách port cách nhau bởi dấu phẩy
}

export interface TargetPreset {
  name: string;
  description: string;
  urls: string[];
}

export interface AssetGroup {
  id: string;
  name: string; // e.g. "caobang.gov.vn"
  rootDomain: string;
  description?: string;
  assetCount: number;
  subdomains: string[];
  createdAt: string;
  lastScanned?: string;
  tags?: string[];
  meta?: Record<string, string>; // metadata từ CSV template (email quản lý, người phụ trách, note...)
}

export interface CrontabScanJob {
  id: string;
  name: string;
  cronExpression: string; // e.g. "0 * * * *" or "0 2 * * *"
  scheduleHuman: string; // e.g. "Every 1 hour", "Daily at 02:00 AM"
  targetType: 'asset-group' | 'subdomain-list';
  targetGroupId?: string;
  targetUrls: string[];
  options: ScanOptions;
  enabled: boolean;
  lastRun?: string;
  lastRunStatus?: 'success' | 'failed' | 'running';
  lastDiscoveredCount?: number;
  nextRun: string;
  totalRuns: number;
  notifyOnNewAssets?: boolean;
}

export interface CsvImportPreviewItem {
  subdomain: string;
  detectedScheme: string;
  port: number;
  normalizedUrl: string;
  isValid: boolean;
  extraCols?: Record<string, string>;
  meta?: Record<string, string>;
  rootDomain?: string;
  isRoot?: boolean;
  isDnsRecord?: boolean;
  isWildcard?: boolean;
}

/** Cấu hình pipeline quét sau khi import CSV */
export interface ImportScanConfig {
  techScan: boolean;    // quét tech từng mục tiêu
  discoverSubs: boolean; // dò subdomain (subfinder) theo domain gốc trước khi quét
  portScan: boolean;     // httpx dò 79 web port
  nuclei: boolean;       // nuclei -tags tech,discovery (chậm hơn)
}

export interface CsvImportGroupPreview {
  name: string;
  rootDomain: string;
  subdomains: string[];
  tags: string[];
  meta: Record<string, string>;
  assetCount: number;
  dnsRecordCount: number;
  hasRootRow: boolean;
}

export interface CveItem {
  id: string;
  cveId: string; // e.g. "CVE-2023-25690"
  software: string; // e.g. "Apache", "WordPress", "PHP"
  affectedVersions: string; // e.g. "< 2.4.56", "8.1.0 - 8.1.28"
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  cvssScore?: number; // e.g. 9.8
  summary: string;
  remediation?: string;
  source?: string; // e.g. "Telegram Alert Bot", "NVD Webhook", "Security Bot"
  pushedAt: string;
}

export interface CveMatchAlert {
  id: string;
  cveId: string;
  cveTitle: string;
  software: string;
  affectedVersions: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  cvssScore?: number;
  matchedAssetId: string;
  assetHost: string;
  assetUrl: string;
  detectedVersion: string;
  remediation: string;
  detectedAt: string;
  status: 'active' | 'investigating' | 'resolved';
}
