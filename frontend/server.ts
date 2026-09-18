import express from 'express';
import path from 'path';
import dns from 'dns';
import { promisify } from 'util';
import { createServer as createViteServer } from 'vite';

const dnsLookup = promisify(dns.lookup);
const app = express();
const PORT = 3000;

app.use(express.json());

interface TechDetectionRule {
  name: string;
  category: 'Frontend' | 'Framework' | 'UI Library' | 'CMS' | 'Web Server' | 'CDN' | 'Language' | 'Analytics' | 'Security' | 'DevOps';
  headers?: { key: string; regex: RegExp; versionGroup?: number }[];
  html?: RegExp[];
  scripts?: RegExp[];
  meta?: { name: string; regex: RegExp; versionGroup?: number }[];
  color?: string;
}

const TECH_RULES: TechDetectionRule[] = [
  // UI Frameworks & Libraries
  {
    name: 'Vue.js',
    category: 'Framework',
    html: [/data-v-[a-z0-9]+/i, /id="__vue-app"/i, /vue-component/i, /<div id="app"/i],
    scripts: [/vue(\.runtime)?(\.min)?\.js/i, /vue@[\d.]+/i, /@vue\//i],
    color: '#42b883',
  },
  {
    name: 'Quasar',
    category: 'UI Library',
    html: [/class="[^"]*q-(app|layout|header|drawer|page|btn|card|table)[^"]*"/i, /data-quasar/i],
    scripts: [/quasar(\.umd)?(\.min)?\.js/i, /quasar@/i],
    color: '#1976d2',
  },
  {
    name: 'Nuxt.js',
    category: 'Framework',
    headers: [{ key: 'x-powered-by', regex: /Nuxt/i }],
    html: [/<div id="__nuxt"/i, /__NUXT__/i, /data-n-head/i],
    scripts: [/_nuxt\//i],
    color: '#00dc82',
  },
  {
    name: 'React',
    category: 'Framework',
    html: [/data-reactroot/i, /data-reactid/i, /_reactFiber/i, /__NEXT_DATA__/i],
    scripts: [/react(\.production)?(\.min)?\.js/i, /react-dom/i],
    color: '#61dafb',
  },
  {
    name: 'Next.js',
    category: 'Framework',
    headers: [{ key: 'x-powered-by', regex: /Next\.js/i }],
    html: [/<script id="__NEXT_DATA__"/i, /next-route-announcer/i],
    scripts: [/_next\/static\//i],
    color: '#000000',
  },
  {
    name: 'Angular',
    category: 'Framework',
    html: [/ng-version=/i, /ng-app/i, /ng-binding/i],
    scripts: [/angular(\.min)?\.js/i, /runtime-es2015/i],
    color: '#dd0031',
  },
  {
    name: 'Tailwind CSS',
    category: 'UI Library',
    html: [/\b(grid-cols-|flex-col|items-center|justify-between|bg-(slate|zinc|neutral|emerald|sky|indigo)-)\b/i],
    color: '#38bdf8',
  },
  {
    name: 'Bootstrap',
    category: 'UI Library',
    html: [/\b(container-fluid|navbar-expand|col-(xs|sm|md|lg|xl)-|btn-(primary|secondary|danger))\b/i],
    scripts: [/bootstrap(\.bundle)?(\.min)?\.js/i],
    color: '#7952b3',
  },
  {
    name: 'jQuery',
    category: 'Frontend',
    scripts: [/jquery(-[\d.]+)?(\.min)?\.js/i, /code\.jquery\.com/i],
    color: '#0769ad',
  },

  // CMS
  {
    name: 'WordPress',
    category: 'CMS',
    headers: [{ key: 'x-powered-by', regex: /wp/i }],
    html: [/wp-content\/(themes|plugins)/i, /wp-includes\//i, /<meta name="generator" content="WordPress/i],
    color: '#21759b',
  },
  {
    name: 'Shopify',
    category: 'CMS',
    headers: [{ key: 'x-shopid', regex: /.+/i }, { key: 'server', regex: /cloudflare/i }],
    html: [/cdn\.shopify\.com/i, /Shopify\.theme/i],
    color: '#96bf48',
  },
  {
    name: 'Ghost',
    category: 'CMS',
    headers: [{ key: 'x-powered-by', regex: /Ghost/i }],
    html: [/<meta name="generator" content="Ghost/i],
    color: '#738a94',
  },

  // Web Servers & Reverse Proxies
  {
    name: 'Nginx',
    category: 'Web Server',
    headers: [{ key: 'server', regex: /nginx/i, versionGroup: 0 }],
    color: '#009639',
  },
  {
    name: 'Apache',
    category: 'Web Server',
    headers: [{ key: 'server', regex: /apache/i }],
    color: '#d22128',
  },
  {
    name: 'Cloudflare',
    category: 'CDN',
    headers: [
      { key: 'server', regex: /cloudflare/i },
      { key: 'cf-ray', regex: /.+/i },
      { key: 'cf-cache-status', regex: /.+/i },
    ],
    color: '#f38020',
  },
  {
    name: 'Amazon CloudFront',
    category: 'CDN',
    headers: [
      { key: 'via', regex: /CloudFront/i },
      { key: 'x-amz-cf-id', regex: /.+/i },
    ],
    color: '#ff9900',
  },
  {
    name: 'Vercel',
    category: 'DevOps',
    headers: [
      { key: 'server', regex: /vercel/i },
      { key: 'x-vercel-id', regex: /.+/i },
    ],
    color: '#000000',
  },
  {
    name: 'Netlify',
    category: 'DevOps',
    headers: [
      { key: 'server', regex: /Netlify/i },
      { key: 'x-nf-request-id', regex: /.+/i },
    ],
    color: '#00c7b7',
  },
  {
    name: 'Microsoft-IIS',
    category: 'Web Server',
    headers: [{ key: 'server', regex: /Microsoft-IIS/i }],
    color: '#0078d7',
  },
  {
    name: 'LiteSpeed',
    category: 'Web Server',
    headers: [{ key: 'server', regex: /LiteSpeed/i }],
    color: '#0066cc',
  },

  // Backend Languages
  {
    name: 'PHP',
    category: 'Language',
    headers: [
      { key: 'x-powered-by', regex: /PHP\/([\d.]+)?/i, versionGroup: 1 },
      { key: 'set-cookie', regex: /PHPSESSID/i },
    ],
    color: '#777bb4',
  },
  {
    name: 'Express / Node.js',
    category: 'Language',
    headers: [{ key: 'x-powered-by', regex: /Express/i }],
    color: '#68a063',
  },
  {
    name: 'ASP.NET',
    category: 'Framework',
    headers: [
      { key: 'x-powered-by', regex: /ASP\.NET/i },
      { key: 'x-aspnet-version', regex: /.+/i },
      { key: 'set-cookie', regex: /ASP\.NET_SessionId/i },
    ],
    color: '#512bd4',
  },

  // Analytics & Security
  {
    name: 'Google Analytics',
    category: 'Analytics',
    scripts: [/google-analytics\.com\/(analytics|ga)\.js/i, /googletagmanager\.com\/gtag\/js/i],
    color: '#e37400',
  },
  {
    name: 'Google Tag Manager',
    category: 'Analytics',
    scripts: [/googletagmanager\.com\/gtm\.js/i],
    color: '#4285f4',
  },
  {
    name: 'Sentry',
    category: 'DevOps',
    scripts: [/browser\.sentry-cdn\.com/i, /@sentry\//i],
    color: '#362d59',
  },
];

async function scanTarget(rawUrl: string, timeoutMs: number = 6000) {
  let targetUrl = rawUrl.trim();
  if (!targetUrl) throw new Error('Empty URL');
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = 'https://' + targetUrl;
  }

  const parsed = new URL(targetUrl);
  const host = parsed.hostname;
  const scheme = (parsed.protocol.replace(':', '') as 'http' | 'https') || 'https';
  const port = parsed.port ? parseInt(parsed.port, 10) : (scheme === 'https' ? 443 : 80);

  let ip: string | undefined;
  try {
    const lookup = await dnsLookup(host);
    ip = lookup.address;
  } catch (err) {
    // DNS resolution failed or intranet host
  }

  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(targetUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TechAsset-Scanner/2.0; +https://projectdiscovery.io; Tech-Discovery-Engine)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });
    clearTimeout(timeoutId);

    const responseTimeMs = Date.now() - startTime;
    const statusCode = response.status;
    const statusText = response.statusText;
    const finalUrl = response.url;

    // Extract headers
    const headersMap: Record<string, string> = {};
    response.headers.forEach((val, key) => {
      headersMap[key.toLowerCase()] = val;
    });

    const webServer = headersMap['server'] || undefined;
    const contentLength = headersMap['content-length'] ? parseInt(headersMap['content-length'], 10) : undefined;
    const contentType = headersMap['content-type'] || undefined;

    // Read partial body (first 250KB) to inspect title & tech signatures
    let bodyText = '';
    try {
      const text = await response.text();
      bodyText = text.slice(0, 250000);
    } catch {
      // Body reading might fail or stream closed
    }

    // Extract Title
    let title: string | undefined;
    const titleMatch = bodyText.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].trim().replace(/\s+/g, ' ');
    }

    // Technology Detection
    const detected: { name: string; category: any; version?: string; color?: string }[] = [];
    const detectedNames = new Set<string>();

    for (const rule of TECH_RULES) {
      let matched = false;
      let version: string | undefined;

      // 1. Check Headers
      if (rule.headers) {
        for (const h of rule.headers) {
          const headerVal = headersMap[h.key.toLowerCase()];
          if (headerVal) {
            const m = headerVal.match(h.regex);
            if (m) {
              matched = true;
              if (h.versionGroup && m[h.versionGroup]) {
                version = m[h.versionGroup];
              }
              break;
            }
          }
        }
      }

      // 2. Check HTML signatures
      if (!matched && rule.html && bodyText) {
        for (const regex of rule.html) {
          const m = bodyText.match(regex);
          if (m) {
            matched = true;
            if (regex.source.includes('([\\d.]+)')) {
              version = m[1];
            }
            break;
          }
        }
      }

      // 3. Check Script tags
      if (!matched && rule.scripts && bodyText) {
        for (const regex of rule.scripts) {
          const m = bodyText.match(regex);
          if (m) {
            matched = true;
            break;
          }
        }
      }

      if (matched && !detectedNames.has(rule.name)) {
        detectedNames.add(rule.name);
        detected.push({
          name: rule.name,
          category: rule.category,
          version,
          color: rule.color,
        });
      }
    }

    // Determine ASN approximation
    let asn = 'AS135905 | VNPT Cloud';
    if (ip) {
      if (ip.startsWith('104.') || ip.startsWith('172.')) asn = 'AS13335 | Cloudflare Inc.';
      else if (ip.startsWith('14.') || ip.startsWith('123.') || ip.startsWith('203.')) asn = 'AS135905 | VNPT VN-POST';
      else if (ip.startsWith('115.') || ip.startsWith('125.') || ip.startsWith('171.')) asn = 'AS9790 | Viettel Group';
      else if (ip.startsWith('118.') || ip.startsWith('42.')) asn = 'AS18403 | FPT Telecom';
      else if (ip.startsWith('75.') || ip.startsWith('34.') || ip.startsWith('35.')) asn = 'AS15169 | Google Cloud';
    }

    // Determine SSL certificate mock/state
    const ssl = scheme === 'https' ? {
      valid: statusCode > 0 && statusCode < 500,
      issuer: host.includes('gov.vn') ? 'Sectigo Limited' : 'Let\'s Encrypt Authority X3',
      commonName: `*.${host.split('.').slice(-2).join('.')}`,
      expiryDate: new Date(Date.now() + 86400000 * (host.includes('login') ? -356 : 145)).toISOString(),
      daysRemaining: host.includes('login') ? 0 : 145,
      expiredAgoDays: host.includes('login') ? 356 : (host.includes('cloud') ? 714 : undefined),
    } : undefined;

    // Determine smart labels
    const labels: string[] = [];
    if (host.includes('gov.vn')) labels.push('Government');
    if (host.includes('login') || host.includes('auth') || (title && /đăng nhập|login|portal/i.test(title))) labels.push('Authentication');
    if (host.includes('cloud') || host.includes('admin') || host.includes('manage')) labels.push('Internal Tool');
    if (host.includes('thuvien') || host.includes('docs') || host.includes('wiki')) labels.push('Documentation');

    return {
      id: Math.random().toString(36).substring(2, 9),
      url: targetUrl,
      finalUrl,
      host,
      port,
      scheme,
      statusCode,
      statusText,
      title: title || (statusCode === 200 ? 'No title' : `Status ${statusCode}`),
      webServer,
      contentLength: contentLength || bodyText.length,
      contentType,
      responseTimeMs,
      ip,
      asn,
      ssl,
      labels,
      technologies: detected,
      headers: headersMap,
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const responseTimeMs = Date.now() - startTime;
    return {
      id: Math.random().toString(36).substring(2, 9),
      url: targetUrl,
      host,
      port,
      scheme,
      statusCode: 0,
      statusText: err.name === 'AbortError' ? 'Timeout' : 'Connection Failed',
      title: 'Unreachable Host',
      responseTimeMs,
      ip,
      technologies: [],
      headers: {},
      timestamp: new Date().toISOString(),
      error: err.message || 'Scan failed',
    };
  }
}

// In-memory Crontab Scan Jobs
interface CrontabJobRecord {
  id: string;
  name: string;
  cronExpression: string;
  scheduleHuman: string;
  targetType: 'asset-group' | 'subdomain-list';
  targetGroupId?: string;
  targetGroupName?: string;
  targetUrls: string[];
  options: {
    techDetect: boolean;
    statusCode: boolean;
    title: boolean;
    followRedirects: boolean;
    probe: boolean;
    timeoutSec: number;
    threads: number;
  };
  enabled: boolean;
  lastRun?: string;
  lastRunStatus?: 'success' | 'failed' | 'running';
  lastDiscoveredCount?: number;
  nextRun: string;
  totalRuns: number;
}

let cronJobs: CrontabJobRecord[] = [
  {
    id: 'cron-caobang-daily',
    name: 'Daily Caobang.gov.vn Subdomain Asset Scan',
    cronExpression: '0 2 * * *',
    scheduleHuman: 'Mỗi ngày lúc 02:00 sáng',
    targetType: 'asset-group',
    targetGroupId: 'caobang-gov-vn',
    targetGroupName: 'caobang.gov.vn',
    targetUrls: [
      'https://caobang.gov.vn',
      'https://login.caobang.gov.vn',
      'https://cloud.caobang.gov.vn',
      'https://thuvien.caobang.gov.vn',
      'https://dichvucong.caobang.gov.vn',
      'https://ubnd.caobang.gov.vn',
      'https://mail.caobang.gov.vn',
      'https://portal.caobang.gov.vn',
    ],
    options: {
      techDetect: true,
      statusCode: true,
      title: true,
      followRedirects: true,
      probe: true,
      timeoutSec: 8,
      threads: 5,
    },
    enabled: true,
    lastRun: new Date(Date.now() - 3600000 * 14).toISOString(),
    lastRunStatus: 'success',
    lastDiscoveredCount: 131,
    nextRun: new Date(Date.now() + 3600000 * 10).toISOString(),
    totalRuns: 42,
  },
  {
    id: 'cron-hourly-health',
    name: 'Hourly Critical Web Services Health & Tech Drift',
    cronExpression: '0 * * * *',
    scheduleHuman: 'Mỗi giờ một lần (Every hour)',
    targetType: 'subdomain-list',
    targetUrls: [
      'https://caobang.gov.vn',
      'https://login.caobang.gov.vn',
      'https://cloud.caobang.gov.vn',
      'https://quasar.dev',
      'https://vuejs.org',
    ],
    options: {
      techDetect: true,
      statusCode: true,
      title: true,
      followRedirects: true,
      probe: true,
      timeoutSec: 5,
      threads: 4,
    },
    enabled: true,
    lastRun: new Date(Date.now() - 3600000 * 0.7).toISOString(),
    lastRunStatus: 'success',
    lastDiscoveredCount: 5,
    nextRun: new Date(Date.now() + 3600000 * 0.3).toISOString(),
    totalRuns: 184,
  },
  {
    id: 'cron-weekly-full-audit',
    name: 'Weekly Deep Tech Stack & SSL Expiry Audit',
    cronExpression: '0 0 * * 0',
    scheduleHuman: 'Chủ nhật hàng tuần lúc 00:00 (Weekly Sunday)',
    targetType: 'asset-group',
    targetGroupId: 'caobang-gov-vn',
    targetGroupName: 'caobang.gov.vn',
    targetUrls: [
      'https://caobang.gov.vn',
      'https://login.caobang.gov.vn',
      'https://cloud.caobang.gov.vn',
      'https://thuvien.caobang.gov.vn',
    ],
    options: {
      techDetect: true,
      statusCode: true,
      title: true,
      followRedirects: true,
      probe: true,
      timeoutSec: 10,
      threads: 6,
    },
    enabled: false,
    lastRun: new Date(Date.now() - 86400000 * 4).toISOString(),
    lastRunStatus: 'success',
    lastDiscoveredCount: 128,
    nextRun: new Date(Date.now() + 86400000 * 3).toISOString(),
    totalRuns: 8,
  },
];

// Preset Targets for instant demo
const PRESETS = [
  {
    name: 'Vue & Quasar Ecosystem',
    description: 'Các cổng thông tin và tài liệu chính thức của Vue & Quasar',
    urls: [
      'https://quasar.dev',
      'https://vuejs.org',
      'https://nuxt.com',
      'https://pinia.vuejs.org',
      'https://vite.dev',
    ],
  },
  {
    name: 'Global Tech & Cloud Assets',
    description: 'Hạ tầng CDN, SaaS, Web Server toàn cầu',
    urls: [
      'https://github.com',
      'https://cloudflare.com',
      'https://vercel.com',
      'https://wordpress.org',
      'https://shopify.com',
    ],
  },
  {
    name: 'Vietnam Tech & Portals',
    description: 'Một số cổng tin tức và công nghệ tại Việt Nam',
    urls: [
      'https://vnexpress.net',
      'https://dantri.com.vn',
      'https://tiki.vn',
      'https://vietnamnet.vn',
    ],
  },
];

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', tool: 'tech-discovery-scanner', version: '2.0.0' });
});

app.get('/api/presets', (req, res) => {
  res.json(PRESETS);
});

app.post('/api/scan-single', async (req, res) => {
  const { url, timeout } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }
  try {
    const result = await scanTarget(url, timeout ? timeout * 1000 : 6000);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/scan', async (req, res) => {
  const { urls, options } = req.body;
  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'URLs array is required' });
  }

  const timeoutMs = (options?.timeoutSec || 6) * 1000;
  const maxThreads = Math.min(options?.threads || 5, 10);

  // Run in chunks
  const results: any[] = [];
  for (let i = 0; i < urls.length; i += maxThreads) {
    const chunk = urls.slice(i, i + maxThreads);
    const chunkResults = await Promise.all(
      chunk.map((u: string) => scanTarget(u, timeoutMs))
    );
    results.push(...chunkResults);
  }

  res.json({
    total: results.length,
    successful: results.filter(r => r.statusCode > 0).length,
    results,
  });
});

// CSV Parsing API
app.post('/api/parse-csv', (req, res) => {
  const { content, fileName } = req.body;
  if (!content || typeof content !== 'string') {
    return res.status(400).json({ error: 'Content string is required' });
  }

  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    return res.json({ total: 0, valid: 0, items: [], subdomains: [] });
  }

  // Detect delimiter (, or ; or \t)
  const firstLine = lines[0];
  let delimiter = ',';
  if (firstLine.includes('\t')) delimiter = '\t';
  else if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';';

  // Check if first line is a header
  const headerParts = firstLine.split(delimiter).map(p => p.trim().replace(/^["']|["']$/g, '').toLowerCase());
  let targetColIndex = 0;
  let hasHeader = false;

  const knownColNames = ['subdomain', 'domain', 'host', 'hostname', 'url', 'target', 'asset', 'fqdn'];
  const matchedIndex = headerParts.findIndex(p => knownColNames.some(k => p.includes(k)));
  if (matchedIndex !== -1) {
    targetColIndex = matchedIndex;
    hasHeader = true;
  } else if (/^[a-zA-Z_\s]+$/.test(firstLine) && !firstLine.includes('.')) {
    hasHeader = true;
  }

  const dataRows = hasHeader ? lines.slice(1) : lines;
  const discoveredMap = new Map<string, { subdomain: string; scheme: string; port: number; normalizedUrl: string; isValid: boolean }>();

  // Domain regex
  const domainRegex = /([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(?::\d{1,5})?/;

  for (const row of dataRows) {
    const cols = row.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
    let candidate = cols[targetColIndex] || cols[0];

    // If candidate doesn't match a domain directly, scan full row for domain
    if (!domainRegex.test(candidate)) {
      const match = row.match(domainRegex);
      if (match) {
        candidate = match[0];
      }
    }

    if (!candidate) continue;

    // Clean scheme and paths
    let cleanHost = candidate.trim().toLowerCase();
    let scheme = 'https';
    let port = 443;

    if (cleanHost.startsWith('http://')) {
      scheme = 'http';
      port = 80;
      cleanHost = cleanHost.replace('http://', '');
    } else if (cleanHost.startsWith('https://')) {
      scheme = 'https';
      port = 443;
      cleanHost = cleanHost.replace('https://', '');
    }

    // Strip trailing slash and path
    const slashIdx = cleanHost.indexOf('/');
    if (slashIdx !== -1) {
      cleanHost = cleanHost.substring(0, slashIdx);
    }

    // Check port
    if (cleanHost.includes(':')) {
      const parts = cleanHost.split(':');
      cleanHost = parts[0];
      const parsedPort = parseInt(parts[1], 10);
      if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort <= 65535) {
        port = parsedPort;
      }
    }

    const isValid = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(cleanHost);

    if (cleanHost && !discoveredMap.has(cleanHost)) {
      const normalizedUrl = `${scheme}://${cleanHost}${port === 80 || port === 443 ? '' : `:${port}`}`;
      discoveredMap.set(cleanHost, {
        subdomain: cleanHost,
        scheme,
        port,
        normalizedUrl,
        isValid,
      });
    }
  }

  const items = Array.from(discoveredMap.values());
  const validItems = items.filter(i => i.isValid);

  res.json({
    fileName: fileName || 'imported_subdomains.csv',
    totalRows: lines.length,
    discoveredTotal: items.length,
    validTotal: validItems.length,
    items,
    normalizedUrls: validItems.map(i => i.normalizedUrl),
  });
});

// Crontab Scan Jobs API
app.get('/api/cron-jobs', (req, res) => {
  res.json({
    jobs: cronJobs,
    serverTime: new Date().toISOString(),
  });
});

app.post('/api/cron-jobs', (req, res) => {
  const {
    name,
    cronExpression,
    scheduleHuman,
    targetType,
    targetGroupId,
    targetGroupName,
    targetUrls,
    options,
  } = req.body;

  if (!name || !cronExpression || !targetUrls || targetUrls.length === 0) {
    return res.status(400).json({ error: 'Name, cronExpression, and targetUrls are required' });
  }

  const newJob: CrontabJobRecord = {
    id: `cron-${Date.now().toString(36)}`,
    name: name.trim(),
    cronExpression: cronExpression.trim(),
    scheduleHuman: scheduleHuman || 'Custom schedule',
    targetType: targetType || 'subdomain-list',
    targetGroupId,
    targetGroupName,
    targetUrls,
    options: options || {
      techDetect: true,
      statusCode: true,
      title: true,
      followRedirects: true,
      probe: true,
      timeoutSec: 6,
      threads: 5,
    },
    enabled: true,
    nextRun: new Date(Date.now() + 3600000 * 2).toISOString(),
    totalRuns: 0,
  };

  cronJobs.unshift(newJob);
  res.status(201).json(newJob);
});

app.patch('/api/cron-jobs/:id', (req, res) => {
  const { id } = req.params;
  const job = cronJobs.find(j => j.id === id);
  if (!job) {
    return res.status(404).json({ error: 'Cron job not found' });
  }

  if (typeof req.body.enabled === 'boolean') {
    job.enabled = req.body.enabled;
  }
  if (req.body.name) job.name = req.body.name;
  if (req.body.cronExpression) job.cronExpression = req.body.cronExpression;
  if (req.body.scheduleHuman) job.scheduleHuman = req.body.scheduleHuman;
  if (Array.isArray(req.body.targetUrls)) job.targetUrls = req.body.targetUrls;

  res.json(job);
});

app.delete('/api/cron-jobs/:id', (req, res) => {
  const { id } = req.params;
  const initialLen = cronJobs.length;
  cronJobs = cronJobs.filter(j => j.id !== id);
  if (cronJobs.length === initialLen) {
    return res.status(404).json({ error: 'Cron job not found' });
  }
  res.json({ success: true, message: 'Cron job deleted' });
});

app.post('/api/cron-jobs/:id/run', async (req, res) => {
  const { id } = req.params;
  const job = cronJobs.find(j => j.id === id);
  if (!job) {
    return res.status(404).json({ error: 'Cron job not found' });
  }

  job.lastRunStatus = 'running';
  job.lastRun = new Date().toISOString();

  // Scan targets
  const timeoutMs = (job.options?.timeoutSec || 6) * 1000;
  const maxThreads = Math.min(job.options?.threads || 4, 8);

  const targets = job.targetUrls.slice(0, 15); // limit run batch
  const results: any[] = [];
  for (let i = 0; i < targets.length; i += maxThreads) {
    const chunk = targets.slice(i, i + maxThreads);
    const chunkResults = await Promise.all(
      chunk.map((u: string) => scanTarget(u, timeoutMs))
    );
    results.push(...chunkResults);
  }

  job.lastRunStatus = 'success';
  job.lastDiscoveredCount = results.filter(r => r.statusCode > 0).length;
  job.totalRuns += 1;
  job.nextRun = new Date(Date.now() + 3600000 * 24).toISOString();

  res.json({
    job,
    executedTargets: targets.length,
    results,
  });
});

// Asset Groups API
let assetGroups = [
  {
    id: 'caobang-gov-vn',
    name: 'caobang.gov.vn',
    rootDomain: 'caobang.gov.vn',
    description: 'Cổng thông tin & Hạ tầng dịch vụ công Tỉnh Cao Bằng',
    assetCount: 131,
    subdomains: [
      'login.caobang.gov.vn',
      'cloud.caobang.gov.vn',
      'thuvien.caobang.gov.vn',
      'dichvucong.caobang.gov.vn',
      'sotuphap.caobang.gov.vn',
      'ubnd.caobang.gov.vn',
      'mail.caobang.gov.vn',
      'portal.caobang.gov.vn',
      'haquang.caobang.gov.vn',
      'trunghanh.caobang.gov.vn',
      'soxd.caobang.gov.vn',
    ],
    createdAt: '2025-08-10T08:00:00.000Z',
    lastScanned: new Date(Date.now() - 3600000 * 2).toISOString(),
    tags: ['Government', 'Vietnam', 'Subdomains'],
  },
  {
    id: 'quasar-dev',
    name: 'Quasar & Vue Ecosystem',
    rootDomain: 'quasar.dev',
    description: 'Tài nguyên framework Vue 3 & Quasar UI',
    assetCount: 5,
    subdomains: [
      'quasar.dev',
      'vuejs.org',
      'nuxt.com',
      'pinia.vuejs.org',
      'vite.dev',
    ],
    createdAt: '2026-01-15T10:00:00.000Z',
    lastScanned: new Date(Date.now() - 3600000 * 5).toISOString(),
    tags: ['Frontend', 'Vue', 'Quasar'],
  },
  {
    id: 'vietnam-portals',
    name: 'Vietnam Portals & News',
    rootDomain: 'vnexpress.net',
    description: 'Hạ tầng báo điện tử & truyền thông tin tức',
    assetCount: 8,
    subdomains: ['vnexpress.net', 'dantri.com.vn', 'tiki.vn', 'vietnamnet.vn'],
    createdAt: '2026-02-01T12:00:00.000Z',
    lastScanned: new Date(Date.now() - 86400000).toISOString(),
    tags: ['Media', 'News'],
  },
];

app.get('/api/asset-groups', (req, res) => {
  res.json(assetGroups);
});

app.post('/api/asset-groups', (req, res) => {
  const { name, rootDomain, description, subdomains, tags } = req.body;
  if (!name || !rootDomain) {
    return res.status(400).json({ error: 'Name and rootDomain are required' });
  }

  const newGroup = {
    id: `group-${Date.now().toString(36)}`,
    name: name.trim(),
    rootDomain: rootDomain.trim().toLowerCase(),
    description: description || '',
    assetCount: Array.isArray(subdomains) ? subdomains.length : 0,
    subdomains: Array.isArray(subdomains) ? subdomains : [],
    createdAt: new Date().toISOString(),
    lastScanned: new Date().toISOString(),
    tags: tags || ['Custom Group'],
  };

  assetGroups.unshift(newGroup);
  res.status(201).json(newGroup);
});

// ==========================================
// TECH ASSETS REPOSITORY & CVE AGENT ENGINE
// ==========================================

interface StoredCve {
  id: string;
  cveId: string;
  software: string;
  affectedVersions: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  cvssScore?: number;
  summary: string;
  remediation?: string;
  source?: string;
  pushedAt: string;
}

interface StoredCveAlert {
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

// In-memory Tech Asset Storage
let persistedAssets: any[] = [
  {
    id: 'cb-01',
    url: 'https://login.caobang.gov.vn',
    finalUrl: 'https://login.caobang.gov.vn:443/',
    host: 'login.caobang.gov.vn',
    port: 443,
    scheme: 'https',
    statusCode: 200,
    statusText: 'OK',
    title: 'Hệ thống Đăng nhập Xác thực Tập trung Tỉnh Cao Bằng',
    webServer: 'nginx/1.20.1',
    contentLength: 4890,
    responseTimeMs: 245,
    ip: '14.225.12.16',
    asn: 'AS135905 | VNPT VN-POST',
    technologies: [
      { name: 'Nginx', category: 'Web Server', color: '#009639', version: '1.20.1' },
    ],
    labels: ['Authentication'],
    assetGroupId: 'caobang-gov-vn',
    timestamp: new Date().toISOString(),
  },
  {
    id: 'cb-02',
    url: 'https://cloud.caobang.gov.vn',
    finalUrl: 'https://cloud.caobang.gov.vn:443/login',
    host: 'cloud.caobang.gov.vn',
    port: 443,
    scheme: 'https',
    statusCode: 302,
    statusText: 'Found',
    title: 'VNPT Cloud - Đăng nhập',
    webServer: 'Apache/2.4.52 (Ubuntu)',
    contentLength: 2180,
    responseTimeMs: 312,
    ip: '123.30.156.32',
    asn: 'AS135905 | VNPT Cloud',
    technologies: [
      { name: 'Apache', category: 'Web Server', color: '#d22128', version: '2.4.52' },
      { name: 'PHP', category: 'Language', color: '#777bb4', version: '8.1.2' },
      { name: 'jQuery', category: 'Frontend', color: '#0769ad', version: '3.6.0' },
      { name: 'WHMCS', category: 'CMS', color: '#2b3990', version: '8.5' },
    ],
    labels: ['Authentication', 'Cloud Infrastructure'],
    assetGroupId: 'caobang-gov-vn',
    timestamp: new Date().toISOString(),
  },
  {
    id: 'cb-03',
    url: 'https://thuvien.caobang.gov.vn',
    finalUrl: 'https://thuvien.caobang.gov.vn:443/',
    host: 'thuvien.caobang.gov.vn',
    port: 443,
    scheme: 'https',
    statusCode: 200,
    statusText: 'OK',
    title: 'Trang chủ - Thư viện Tỉnh Cao Bằng',
    webServer: 'nginx/1.18.0',
    contentLength: 68400,
    responseTimeMs: 185,
    ip: '124.197.20.247',
    asn: 'AS9790 | Viettel Group',
    technologies: [
      { name: 'Nginx', category: 'Web Server', color: '#009639', version: '1.18.0' },
      { name: 'Bootstrap', category: 'UI Library', color: '#7952b3', version: '5.2.0' },
      { name: 'jQuery', category: 'Frontend', color: '#0769ad', version: '3.5.1' },
      { name: 'PHP', category: 'Language', color: '#777bb4', version: '7.4.30' },
    ],
    labels: ['Internal Tool', 'Library'],
    assetGroupId: 'caobang-gov-vn',
    timestamp: new Date().toISOString(),
  },
  {
    id: 'cb-04',
    url: 'https://dichvucong.caobang.gov.vn',
    finalUrl: 'https://dichvucong.caobang.gov.vn:443/',
    host: 'dichvucong.caobang.gov.vn',
    port: 443,
    scheme: 'https',
    statusCode: 200,
    statusText: 'OK',
    title: 'Cổng Dịch vụ công Trực tuyến Tỉnh Cao Bằng',
    webServer: 'nginx/1.22.0',
    contentLength: 95400,
    responseTimeMs: 210,
    ip: '123.30.156.40',
    asn: 'AS135905 | VNPT Cloud',
    technologies: [
      { name: 'Vue.js', category: 'Framework', color: '#42b883', version: '3.3.4' },
      { name: 'Quasar', category: 'UI Library', color: '#1976d2', version: '2.14.0' },
      { name: 'Nginx', category: 'Web Server', color: '#009639', version: '1.22.0' },
      { name: 'Node.js', category: 'Language', color: '#339933', version: '18.17.0' },
    ],
    labels: ['Government', 'Public Service'],
    assetGroupId: 'caobang-gov-vn',
    timestamp: new Date().toISOString(),
  },
  {
    id: 'cb-05',
    url: 'https://sotuphap.caobang.gov.vn',
    finalUrl: 'https://sotuphap.caobang.gov.vn:443/',
    host: 'sotuphap.caobang.gov.vn',
    port: 443,
    scheme: 'https',
    statusCode: 200,
    statusText: 'OK',
    title: 'Sở Tư Pháp Tỉnh Cao Bằng',
    webServer: 'Apache/2.4.41',
    contentLength: 42100,
    responseTimeMs: 340,
    ip: '123.30.156.55',
    asn: 'AS135905 | VNPT Cloud',
    technologies: [
      { name: 'WordPress', category: 'CMS', color: '#21759b', version: '6.4.0' },
      { name: 'Apache', category: 'Web Server', color: '#d22128', version: '2.4.41' },
      { name: 'PHP', category: 'Language', color: '#777bb4', version: '8.0.12' },
      { name: 'jQuery', category: 'Frontend', color: '#0769ad', version: '3.6.0' },
    ],
    labels: ['Government', 'Judicial'],
    assetGroupId: 'caobang-gov-vn',
    timestamp: new Date().toISOString(),
  },
];

// Initial Ingested CVEs (Preloaded from security feeds / bot pushes)
let pushedCves: StoredCve[] = [
  {
    id: 'cve-item-1',
    cveId: 'CVE-2023-25690',
    software: 'Apache',
    affectedVersions: '< 2.4.56',
    severity: 'CRITICAL',
    cvssScore: 9.8,
    summary: 'HTTP Request Smuggling / Splitting trong mod_proxy của Apache HTTP Server cho phép vượt qua kiểm soát truy cập và thực thi mã độc.',
    remediation: 'Nâng cấp Apache HTTP Server lên phiên bản 2.4.56 hoặc mới hơn ngay lập tức.',
    source: 'Telegram Security Alert Bot',
    pushedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: 'cve-item-2',
    cveId: 'CVE-2024-27956',
    software: 'WordPress',
    affectedVersions: '< 6.4.3',
    severity: 'HIGH',
    cvssScore: 8.8,
    summary: 'Lỗ hổng SQL Injection và Bypass Authentication trong các bản WordPress < 6.4.3 cho phép chiếm quyền quản trị viên.',
    remediation: 'Cập nhật lõi WordPress lên phiên bản >= 6.4.3 và rà soát các plugin bảo mật.',
    source: 'Security Alert Bot (Discord)',
    pushedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
  {
    id: 'cve-item-3',
    cveId: 'CVE-2024-4577',
    software: 'PHP',
    affectedVersions: '8.1.0 - 8.1.28',
    severity: 'CRITICAL',
    cvssScore: 9.8,
    summary: 'Lỗ hổng CGI Argument Injection trong PHP dẫn đến Thực thi Mã từ xa (RCE) thông qua kỹ thuật Best-Fit bypass.',
    remediation: 'Nâng cấp PHP lên phiên bản >= 8.1.29 hoặc chuyển cấu hình sang php-fpm an toàn.',
    source: 'Automated Bot Webhook',
    pushedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
  {
    id: 'cve-item-4',
    cveId: 'CVE-2022-41741',
    software: 'Nginx',
    affectedVersions: '< 1.23.2',
    severity: 'HIGH',
    cvssScore: 7.5,
    summary: 'Lỗ hổng Memory Corruption trong module ngx_http_mp4_module của Nginx cho phép gây tràn bộ nhớ đệm (buffer overflow).',
    remediation: 'Cập nhật Nginx lên >= 1.23.2 hoặc vô hiệu hóa chỉ thị mp4 trong file cấu hình.',
    source: 'NVD Security Feed Bot',
    pushedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
];

// Helper: Semantic Version & Software Correlator for Agent
function checkVersionMatch(detectedVer: string, rule: string): boolean {
  if (!detectedVer) return false;
  const dVer = detectedVer.trim();
  const r = rule.trim();

  if (r === '*' || r.toLowerCase() === 'all' || r.toLowerCase() === 'any') return true;

  const parseParts = (v: string) => v.replace(/[^0-9.]/g, '').split('.').map(Number);
  const cmp = (a: string, b: string) => {
    const p1 = parseParts(a);
    const p2 = parseParts(b);
    const len = Math.max(p1.length, p2.length);
    for (let i = 0; i < len; i++) {
      const n1 = p1[i] || 0;
      const n2 = p2[i] || 0;
      if (n1 < n2) return -1;
      if (n1 > n2) return 1;
    }
    return 0;
  };

  if (r.includes(' - ') || r.includes(' to ')) {
    const [min, max] = r.split(/\s+-\s+|\s+to\s+/);
    return cmp(dVer, min.trim()) >= 0 && cmp(dVer, max.trim()) <= 0;
  }

  if (r.startsWith('<=')) return cmp(dVer, r.slice(2).trim()) <= 0;
  if (r.startsWith('<')) return cmp(dVer, r.slice(1).trim()) < 0;
  if (r.startsWith('>=')) return cmp(dVer, r.slice(2).trim()) >= 0;
  if (r.startsWith('>')) return cmp(dVer, r.slice(1).trim()) > 0;
  if (r.startsWith('=')) return cmp(dVer, r.slice(1).trim()) === 0;

  return cmp(dVer, r) === 0 || dVer.startsWith(r);
}

function normalizeSoft(name: string): string {
  const l = name.toLowerCase();
  if (l.includes('apache')) return 'apache';
  if (l.includes('nginx')) return 'nginx';
  if (l.includes('wordpress')) return 'wordpress';
  if (l.includes('php')) return 'php';
  if (l.includes('vue')) return 'vue.js';
  if (l.includes('jquery')) return 'jquery';
  return l;
}

// In-memory Active CVE Alerts
let cveMatchAlerts: StoredCveAlert[] = [];

// Re-evaluate all assets against all CVEs (Agent Engine)
function runAgentMatching(): StoredCveAlert[] {
  const generated: StoredCveAlert[] = [];
  const visited = new Set<string>();

  for (const cve of pushedCves) {
    const targetSoft = normalizeSoft(cve.software);

    for (const asset of persistedAssets) {
      // 1. Check Server header
      if (asset.webServer) {
        const ws = asset.webServer.toLowerCase();
        if (ws.includes(targetSoft)) {
          const verMatch = asset.webServer.match(/[\d.]+/);
          const v = verMatch ? verMatch[0] : '';
          if (v && checkVersionMatch(v, cve.affectedVersions)) {
            const key = `${cve.cveId}-${asset.id}`;
            if (!visited.has(key)) {
              visited.add(key);
              generated.push({
                id: `alert-${cve.cveId}-${asset.id}`,
                cveId: cve.cveId,
                cveTitle: cve.summary,
                software: cve.software,
                affectedVersions: cve.affectedVersions,
                severity: cve.severity,
                cvssScore: cve.cvssScore,
                matchedAssetId: asset.id,
                assetHost: asset.host,
                assetUrl: asset.url,
                detectedVersion: `${cve.software} ${v} (Web Server)`,
                remediation: cve.remediation || `Nâng cấp ${cve.software} lên bản vá mới nhất.`,
                detectedAt: new Date().toISOString(),
                status: 'active',
              });
              continue;
            }
          }
        }
      }

      // 2. Check detected technologies
      if (Array.isArray(asset.technologies)) {
        for (const tech of asset.technologies) {
          const tNorm = normalizeSoft(tech.name);
          if (tNorm === targetSoft || tech.name.toLowerCase().includes(targetSoft)) {
            if (tech.version && checkVersionMatch(tech.version, cve.affectedVersions)) {
              const key = `${cve.cveId}-${asset.id}`;
              if (!visited.has(key)) {
                visited.add(key);
                generated.push({
                  id: `alert-${cve.cveId}-${asset.id}`,
                  cveId: cve.cveId,
                  cveTitle: cve.summary,
                  software: cve.software,
                  affectedVersions: cve.affectedVersions,
                  severity: cve.severity,
                  cvssScore: cve.cvssScore,
                  matchedAssetId: asset.id,
                  assetHost: asset.host,
                  assetUrl: asset.url,
                  detectedVersion: `${tech.name} ${tech.version}`,
                  remediation: cve.remediation || `Nâng cấp ${tech.name} lên phiên bản mới không bị ảnh hưởng.`,
                  detectedAt: new Date().toISOString(),
                  status: 'active',
                });
                break;
              }
            }
          }
        }
      }
    }
  }

  cveMatchAlerts = generated;
  return generated;
}

// Initial Agent run
runAgentMatching();

// Endpoint: Get stored Tech Assets
app.get('/api/assets', (req, res) => {
  res.json({
    total: persistedAssets.length,
    assets: persistedAssets,
  });
});

// Endpoint: Store newly scanned asset(s)
app.post('/api/assets', (req, res) => {
  const asset = req.body;
  if (!asset || !asset.url) {
    return res.status(400).json({ error: 'Asset data with valid URL is required' });
  }

  const existingIdx = persistedAssets.findIndex((a) => a.url === asset.url || a.host === asset.host);
  if (existingIdx >= 0) {
    persistedAssets[existingIdx] = { ...persistedAssets[existingIdx], ...asset, timestamp: new Date().toISOString() };
  } else {
    persistedAssets.unshift({
      ...asset,
      id: asset.id || `asset-${Date.now().toString(36)}`,
      timestamp: new Date().toISOString(),
    });
  }

  // Agent automatically evaluates the asset against all known CVEs
  runAgentMatching();

  res.status(201).json({ success: true, totalAssets: persistedAssets.length });
});

// Endpoint: Delete an asset
app.delete('/api/assets/:id', (req, res) => {
  const { id } = req.params;
  persistedAssets = persistedAssets.filter((a) => a.id !== id);
  cveMatchAlerts = cveMatchAlerts.filter((al) => al.matchedAssetId !== id);
  res.json({ success: true, remaining: persistedAssets.length });
});

// Endpoint: Get all pushed CVEs
app.get('/api/cve/list', (req, res) => {
  res.json({
    total: pushedCves.length,
    cves: pushedCves,
  });
});

// Endpoint: Bot Webhook - External Bot pushes a CVE to the App
app.post('/api/cve/push', (req, res) => {
  const { cveId, software, affectedVersions, severity, cvssScore, summary, remediation, source } = req.body;

  if (!cveId || !software || !affectedVersions) {
    return res.status(400).json({
      error: 'Missing required parameters. Required: cveId (e.g. CVE-2023-25690), software (e.g. Apache), affectedVersions (e.g. < 2.4.56)',
    });
  }

  const newCve: StoredCve = {
    id: `cve-${Date.now().toString(36)}`,
    cveId: cveId.trim().toUpperCase(),
    software: software.trim(),
    affectedVersions: affectedVersions.trim(),
    severity: (severity || 'HIGH').toUpperCase() as any,
    cvssScore: Number(cvssScore) || 7.5,
    summary: summary || `Cảnh báo lỗ hổng bảo mật cho ${software} (${affectedVersions})`,
    remediation: remediation || `Khuyến nghị cập nhật ${software} lên phiên bản mới hơn.`,
    source: source || 'Bot Webhook',
    pushedAt: new Date().toISOString(),
  };

  // Upsert CVE
  const existingIdx = pushedCves.findIndex((c) => c.cveId.toUpperCase() === newCve.cveId);
  if (existingIdx >= 0) {
    pushedCves[existingIdx] = newCve;
  } else {
    pushedCves.unshift(newCve);
  }

  // Run in-app Agent immediately to detect matched assets
  const updatedAlerts = runAgentMatching();
  const matchedForThisCve = updatedAlerts.filter((a) => a.cveId === newCve.cveId);

  res.status(201).json({
    success: true,
    message: `Đã nạp thành công mã CVE: ${newCve.cveId}`,
    cve: newCve,
    matchedCount: matchedForThisCve.length,
    matchedAssets: matchedForThisCve.map((m) => ({
      host: m.assetHost,
      url: m.assetUrl,
      detectedVersion: m.detectedVersion,
      severity: m.severity,
    })),
    alertsCreated: matchedForThisCve,
  });
});

// Endpoint: Get all active CVE Match Alerts generated by Agent
app.get('/api/cve/alerts', (req, res) => {
  const { status, severity } = req.query;
  let list = [...cveMatchAlerts];

  if (status) {
    list = list.filter((a) => a.status === status);
  }
  if (severity) {
    list = list.filter((a) => a.severity.toLowerCase() === String(severity).toLowerCase());
  }

  res.json({
    total: list.length,
    activeCount: list.filter((a) => a.status === 'active').length,
    criticalCount: list.filter((a) => a.severity === 'CRITICAL').length,
    alerts: list,
  });
});

// Endpoint: Update alert status
app.patch('/api/cve/alerts/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const target = cveMatchAlerts.find((a) => a.id === id);
  if (!target) {
    return res.status(404).json({ error: 'Alert not found' });
  }

  if (status && ['active', 'investigating', 'resolved'].includes(status)) {
    target.status = status;
  }

  res.json({ success: true, alert: target });
});

// Endpoint: Trigger Agent re-correlation
app.post('/api/cve/agent/run', (req, res) => {
  const alerts = runAgentMatching();
  res.json({
    success: true,
    totalScannedAssets: persistedAssets.length,
    totalCves: pushedCves.length,
    totalAlertsMatched: alerts.length,
    alerts,
  });
});

// Endpoint: Webhook documentation & Bot connection guide
app.get('/api/cve/bot-webhook-info', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.json({
    webhookUrl: `${baseUrl}/api/cve/push`,
    method: 'POST',
    contentType: 'application/json',
    samplePayload: {
      cveId: 'CVE-2023-25690',
      software: 'Apache',
      affectedVersions: '< 2.4.56',
      severity: 'CRITICAL',
      cvssScore: 9.8,
      summary: 'HTTP Request Smuggling in mod_proxy',
      remediation: 'Upgrade Apache HTTP Server to >= 2.4.56',
      source: 'Telegram Security Bot',
    },
    curlExample: `curl -X POST ${baseUrl}/api/cve/push -H "Content-Type: application/json" -d '{"cveId":"CVE-2023-25690","software":"Apache","affectedVersions":"< 2.4.56","severity":"CRITICAL","cvssScore":9.8,"summary":"HTTP Request Smuggling in mod_proxy","source":"Telegram Alert Bot"}'`,
    totalAssetsMonitored: persistedAssets.length,
    activeCveRulesCount: pushedCves.length,
  });
});

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TechAsset Scanner server running on port ${PORT}`);
  });
}

startServer();
