/**
 * CVE and Tech Asset Version Matching Engine (In-App Agent)
 * Correlates detected software and versions on assets with pushed CVE vulnerability records.
 */

import { ScanResult, CveItem, CveMatchAlert, TechSignature } from '../types';

/**
 * Normalizes software names for resilient matching.
 * e.g., "Apache HTTP Server" -> "apache", "Nginx Web Server" -> "nginx"
 */
export function normalizeSoftwareName(name: string): string {
  const lower = name.toLowerCase().trim();
  if (lower.includes('apache')) return 'apache';
  if (lower.includes('nginx')) return 'nginx';
  if (lower.includes('wordpress')) return 'wordpress';
  if (lower.includes('php')) return 'php';
  if (lower.includes('vue')) return 'vue.js';
  if (lower.includes('quasar')) return 'quasar';
  if (lower.includes('jquery')) return 'jquery';
  if (lower.includes('bootstrap')) return 'bootstrap';
  if (lower.includes('openssl')) return 'openssl';
  if (lower.includes('tomcat')) return 'tomcat';
  if (lower.includes('node')) return 'node.js';
  return lower;
}

/**
 * Compare two semver-like strings. Returns:
 *  -1 if v1 < v2
 *   0 if v1 === v2
 *   1 if v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
  const clean1 = v1.replace(/[^0-9.]/g, '').split('.').map(Number);
  const clean2 = v2.replace(/[^0-9.]/g, '').split('.').map(Number);

  const len = Math.max(clean1.length, clean2.length);
  for (let i = 0; i < len; i++) {
    const num1 = clean1[i] || 0;
    const num2 = clean2[i] || 0;
    if (num1 < num2) return -1;
    if (num1 > num2) return 1;
  }
  return 0;
}

/**
 * Checks if a detected version matches a CVE affected version rule.
 * Supported patterns:
 *  - "< 2.4.56"
 *  - "<= 6.4.2"
 *  - "= 8.1.2" or "8.1.2"
 *  - "2.4.0 - 2.4.55"
 *  - "*", "all", "any"
 */
export function isVersionAffected(detectedVer: string, rule: string): boolean {
  if (!detectedVer) return false;
  const dVer = detectedVer.trim();
  const trimmedRule = rule.trim();

  if (trimmedRule === '*' || trimmedRule.toLowerCase() === 'all' || trimmedRule.toLowerCase() === 'any') {
    return true;
  }

  // Range format: "2.4.0 - 2.4.55" or "8.1.0 to 8.1.28"
  if (trimmedRule.includes(' - ') || trimmedRule.includes(' to ')) {
    const parts = trimmedRule.split(/\s+-\s+|\s+to\s+/);
    if (parts.length === 2) {
      const min = parts[0].trim();
      const max = parts[1].trim();
      return compareVersions(dVer, min) >= 0 && compareVersions(dVer, max) <= 0;
    }
  }

  // Inequality operators
  if (trimmedRule.startsWith('<=')) {
    const target = trimmedRule.slice(2).trim();
    return compareVersions(dVer, target) <= 0;
  }
  if (trimmedRule.startsWith('<')) {
    const target = trimmedRule.slice(1).trim();
    return compareVersions(dVer, target) < 0;
  }
  if (trimmedRule.startsWith('>=')) {
    const target = trimmedRule.slice(2).trim();
    return compareVersions(dVer, target) >= 0;
  }
  if (trimmedRule.startsWith('>')) {
    const target = trimmedRule.slice(1).trim();
    return compareVersions(dVer, target) > 0;
  }
  if (trimmedRule.startsWith('=')) {
    const target = trimmedRule.slice(1).trim();
    return compareVersions(dVer, target) === 0;
  }

  // Exact match or prefix match (e.g. "2.4.52")
  return compareVersions(dVer, trimmedRule) === 0 || dVer.startsWith(trimmedRule);
}

/**
 * In-App Agent: Correlates a CVE item with an array of scanned assets.
 * Returns generated CveMatchAlert items.
 */
export function matchCveWithAssets(cve: CveItem, assets: ScanResult[]): CveMatchAlert[] {
  const alerts: CveMatchAlert[] = [];
  const targetSoftwareNorm = normalizeSoftwareName(cve.software);

  for (const asset of assets) {
    // Check webServer field (e.g. "Apache/2.4.52", "nginx/1.22.0")
    if (asset.webServer) {
      const wsLower = asset.webServer.toLowerCase();
      if (wsLower.includes(targetSoftwareNorm)) {
        const verMatch = asset.webServer.match(/[\d.]+/);
        const ver = verMatch ? verMatch[0] : '';
        if (ver && isVersionAffected(ver, cve.affectedVersions)) {
          alerts.push({
            id: `alert-${cve.cveId}-${asset.id}-${Date.now().toString(36)}`,
            cveId: cve.cveId,
            cveTitle: cve.summary,
            software: cve.software,
            affectedVersions: cve.affectedVersions,
            severity: cve.severity,
            cvssScore: cve.cvssScore,
            matchedAssetId: asset.id,
            assetHost: asset.host,
            assetUrl: asset.url,
            detectedVersion: `${cve.software} ${ver} (via Server Header)`,
            remediation: cve.remediation || `Nâng cấp ${cve.software} lên phiên bản mới không nằm trong dải bị ảnh hưởng (${cve.affectedVersions}).`,
            detectedAt: new Date().toISOString(),
            status: 'active',
          });
          continue; // Matched via header, move to next asset
        }
      }
    }

    // Check detected technologies
    for (const tech of asset.technologies) {
      const techNorm = normalizeSoftwareName(tech.name);
      if (techNorm === targetSoftwareNorm || tech.name.toLowerCase().includes(targetSoftwareNorm)) {
        if (tech.version && isVersionAffected(tech.version, cve.affectedVersions)) {
          alerts.push({
            id: `alert-${cve.cveId}-${asset.id}-${Date.now().toString(36)}`,
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
            remediation: cve.remediation || `Nâng cấp ${tech.name} lên phiên bản an toàn hơn (${cve.affectedVersions}).`,
            detectedAt: new Date().toISOString(),
            status: 'active',
          });
          break;
        }
      }
    }
  }

  return alerts;
}

/**
 * Runs the Agent over ALL known CVEs against ALL stored assets.
 */
export function runAgentFullCorrelation(cves: CveItem[], assets: ScanResult[]): CveMatchAlert[] {
  const allAlerts: CveMatchAlert[] = [];
  const alertKeys = new Set<string>();

  for (const cve of cves) {
    const matches = matchCveWithAssets(cve, assets);
    for (const m of matches) {
      const key = `${m.cveId}-${m.matchedAssetId}`;
      if (!alertKeys.has(key)) {
        alertKeys.add(key);
        allAlerts.push(m);
      }
    }
  }

  return allAlerts;
}
