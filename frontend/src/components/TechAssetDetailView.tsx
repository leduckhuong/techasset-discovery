import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Server,
  Layers,
  Globe,
  Lock,
  ExternalLink,
  ShieldAlert,
  Clock,
  Code2,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Tag,
  Search,
  Filter,
  Terminal,
  Copy,
  Check,
} from 'lucide-react';
import { ScanResult, AssetGroup, CveMatchAlert, TechSignature } from '../types';
import { FooTablePagination } from './FooTablePagination';

interface TechAssetDetailViewProps {
  asset: ScanResult;
  assetGroup: AssetGroup;
  cveAlerts?: CveMatchAlert[];
  onBackToAssetsList: () => void;
  onNavigateToCveAlerts?: () => void;
}

export const TechAssetDetailView: React.FC<TechAssetDetailViewProps> = ({
  asset,
  assetGroup,
  cveAlerts = [],
  onBackToAssetsList,
  onNavigateToCveAlerts,
}) => {
  const [activeTab, setActiveTab] = useState<'tech' | 'headers' | 'ssl' | 'cve'>('tech');
  const [techSearch, setTechSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // CVEs matching this asset
  const matchedCves = useMemo(() => {
    return cveAlerts.filter(
      (a) => a.matchedAssetId === asset.id || a.assetHost.toLowerCase() === asset.host.toLowerCase()
    );
  }, [cveAlerts, asset]);

  // Technologies list with enriched metadata
  const technologiesWithCve = useMemo(() => {
    return asset.technologies.map((t) => {
      // Check if this tech matches any active CVE
      const matchingCve = matchedCves.find(
        (cve) => cve.software.toLowerCase() === t.name.toLowerCase()
      );
      return {
        ...t,
        matchingCve,
        detectionSource: t.category === 'Web Server'
          ? 'HTTP Server Header'
          : t.category === 'CMS'
          ? 'HTML Meta Generator & Path'
          : t.category === 'UI Library' || t.category === 'Frontend'
          ? 'Inline Script & DOM Signature'
          : 'Multi-Engine Fingerprint Probe',
      };
    });
  }, [asset.technologies, matchedCves]);

  // Filtered technologies for the Foo Table
  const filteredTechs = useMemo(() => {
    return technologiesWithCve.filter((t) => {
      const matchesSearch =
        techSearch === '' ||
        t.name.toLowerCase().includes(techSearch.toLowerCase()) ||
        (t.version && t.version.toLowerCase().includes(techSearch.toLowerCase())) ||
        t.category.toLowerCase().includes(techSearch.toLowerCase());

      const matchesCat = categoryFilter === 'ALL' || t.category === categoryFilter;

      return matchesSearch && matchesCat;
    });
  }, [technologiesWithCve, techSearch, categoryFilter]);

  // Paginated techs
  const paginatedTechs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTechs.slice(start, start + pageSize);
  }, [filteredTechs, page, pageSize]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    technologiesWithCve.forEach((t) => set.add(t.category));
    return Array.from(set);
  }, [technologiesWithCve]);

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const isSuccess = asset.statusCode >= 200 && asset.statusCode < 300;
  const isRedirect = asset.statusCode >= 300 && asset.statusCode < 400;

  return (
    <div className="space-y-4 text-slate-200">
      {/* Breadcrumb navigation */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <button
          type="button"
          onClick={onBackToAssetsList}
          className="hover:text-indigo-400 transition flex items-center gap-1 cursor-pointer font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Danh sách Assets ({assetGroup.name})</span>
        </button>
        <span>/</span>
        <span className="font-mono text-slate-200 font-semibold">{asset.host}</span>
        <span>/</span>
        <span className="text-indigo-300 font-bold">Tech Asset (Cấp Chi Tiết)</span>
      </div>

      {/* Asset Header Banner */}
      <div className="bg-white dark:bg-[#0b0e18] border border-slate-200 dark:border-[#1e2538] rounded-xl p-5 shadow-xs dark:shadow-lg relative overflow-hidden transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={onBackToAssetsList}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#14192a] dark:hover:bg-[#1f263e] border border-slate-300 dark:border-[#27314f] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                title="Quay lại danh sách assets"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <h1 className="text-xl font-bold text-slate-900 dark:text-white font-mono flex items-center gap-2">
                <span>{asset.host}</span>
                <span className="text-slate-500 font-sans text-xs">:{asset.port || 443}</span>
              </h1>

              <a
                href={asset.url}
                target="_blank"
                rel="noreferrer"
                className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition"
                title="Mở URL trực tiếp"
              >
                <ExternalLink className="w-4 h-4" />
              </a>

              {/* Status Code Badge */}
              <span
                className={`px-2 py-0.5 rounded font-mono text-xs font-bold border ${
                  isSuccess
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-500/40'
                    : isRedirect
                    ? 'bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-500/40'
                    : 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-500/40'
                }`}
              >
                {asset.statusCode} {asset.statusText || 'OK'}
              </span>

              {/* Agent CVE Match Alert Badge */}
              {matchedCves.length > 0 && (
                <button
                  type="button"
                  onClick={onNavigateToCveAlerts}
                  className="px-2.5 py-0.5 rounded text-xs font-bold bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/50 flex items-center gap-1.5 hover:bg-rose-500/30 transition cursor-pointer animate-pulse"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                  <span>{matchedCves.length} CVE Matched</span>
                </button>
              )}
            </div>

            {asset.title && (
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium line-clamp-1">
                Tiêu đề trang: &ldquo;{asset.title}&rdquo;
              </p>
            )}

            {/* Quick Specs */}
            <div className="flex items-center gap-4 flex-wrap text-xs text-slate-500 dark:text-slate-400 pt-1">
              <span className="font-mono">IP: <strong className="text-slate-800 dark:text-slate-200">{asset.ip || '127.0.0.1'}</strong></span>
              <span>•</span>
              <span className="font-mono">ASN: <strong className="text-slate-800 dark:text-slate-200">{asset.asn || 'AS135905 VNPT'}</strong></span>
              <span>•</span>
              <span>Web Server: <strong className="text-slate-800 dark:text-slate-200 font-mono">{asset.webServer || 'N/A'}</strong></span>
              <span>•</span>
              <span>Thời gian phản hồi: <strong className="text-slate-800 dark:text-slate-200 font-mono">{asset.responseTimeMs}ms</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => copyText(asset.url, 'asset-url')}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#14192a] dark:hover:bg-[#1e253e] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-[#27314f] text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
            >
              {copiedKey === 'asset-url' ? <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === 'asset-url' ? 'Đã copy URL' : 'Copy URL'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-[#1c2336] text-xs font-medium">
        <button
          type="button"
          onClick={() => setActiveTab('tech')}
          className={`pb-2.5 px-3 flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'tech'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-500 dark:text-indigo-300 font-bold'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Bảng Công Nghệ (Tech Asset)</span>
          <span className="px-1.5 py-0.2 rounded-full bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-[10px] font-mono font-bold">
            {technologiesWithCve.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('headers')}
          className={`pb-2.5 px-3 flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'headers'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-500 dark:text-indigo-300 font-bold'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <FileCode className="w-4 h-4" />
          <span>HTTP Headers & Server</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ssl')}
          className={`pb-2.5 px-3 flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'ssl'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-500 dark:text-indigo-300 font-bold'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Chứng Chỉ SSL/TLS</span>
          {asset.ssl?.expiredAgoDays && (
            <span className="px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-300 text-[10px] font-bold">
              Expired
            </span>
          )}
        </button>

        {matchedCves.length > 0 && (
          <button
            type="button"
            onClick={() => setActiveTab('cve')}
            className={`pb-2.5 px-3 flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'cve'
                ? 'border-rose-500 text-rose-600 dark:text-rose-300 font-bold'
                : 'border-transparent text-rose-500 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-200'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-rose-500 dark:text-rose-400" />
            <span>Cảnh Báo CVE Trùng Khớp ({matchedCves.length})</span>
          </button>
        )}
      </div>

      {/* Tab 1: TECH ASSET TABLE WITH FOO TABLE PAGINATION */}
      {activeTab === 'tech' && (
        <div className="space-y-3">
          {/* Tech Filter bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={techSearch}
                  onChange={(e) => {
                    setTechSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Tìm công nghệ, phiên bản, phân loại..."
                  className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-[#0e1220] border border-slate-300 dark:border-[#1f273d] rounded-lg text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-white dark:bg-[#0e1220] border border-slate-300 dark:border-[#1f273d] rounded-lg text-xs text-slate-700 dark:text-slate-300 px-3 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="ALL">Tất cả phân loại</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              Tổng số: <span className="font-bold text-slate-800 dark:text-white">{filteredTechs.length}</span> công nghệ
            </div>
          </div>

          {/* Foo Table for Tech Assets */}
          <div className="bg-white dark:bg-[#0b0e18] border border-slate-200 dark:border-[#1d253a] rounded-xl overflow-hidden shadow-xs dark:shadow-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-[#0e1324] border-b border-slate-200 dark:border-[#1d253a] text-slate-600 dark:text-slate-400 text-[11px] font-semibold tracking-wider uppercase">
                    <th className="py-3 px-4">Công nghệ / Phần mềm</th>
                    <th className="py-3 px-4">Phân loại</th>
                    <th className="py-3 px-4">Phiên bản (Version)</th>
                    <th className="py-3 px-4">Nguồn nhận diện</th>
                    <th className="py-3 px-4">Tình trạng Agent CVE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#171f33]">
                  {paginatedTechs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                        Không tìm thấy công nghệ nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    paginatedTechs.map((t, idx) => (
                      <tr
                        key={`${t.name}-${idx}`}
                        className={`hover:bg-slate-50 dark:hover:bg-[#121728] transition-colors ${
                          t.matchingCve ? 'bg-rose-50/50 dark:bg-rose-950/20' : ''
                        }`}
                      >
                        {/* Name & Icon */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-[#182035] border border-indigo-200 dark:border-[#273250] flex items-center justify-center font-bold text-xs text-indigo-600 dark:text-indigo-300">
                              {t.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800 dark:text-white font-mono text-xs">{t.name}</div>
                            </div>
                          </div>
                        </td>

                        {/* Category */}
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-[#161d30] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#273352]">
                            {t.category}
                          </span>
                        </td>

                        {/* Version */}
                        <td className="py-3 px-4">
                          {t.version ? (
                            <span
                              className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                                t.matchingCve
                                  ? 'bg-rose-100 text-rose-700 border border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-[#182136] dark:text-amber-300 dark:border-[#2b395c]'
                              }`}
                            >
                              v{t.version}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 font-mono text-[11px]">Chưa rõ phiên bản</span>
                          )}
                        </td>

                        {/* Source */}
                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                          {t.detectionSource}
                        </td>

                        {/* CVE Status */}
                        <td className="py-3 px-4">
                          {t.matchingCve ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40 font-mono font-bold text-[11px]">
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                              <span>Trùng {t.matchingCve.cveId}</span>
                              <span className="text-[10px] opacity-80">({t.matchingCve.affectedVersions})</span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>An toàn (Chưa có CVE)</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Foo Table Pagination for Tech Asset Table */}
            <FooTablePagination
              currentPage={page}
              pageSize={pageSize}
              totalItems={filteredTechs.length}
              onPageChange={(p) => setPage(p)}
              onPageSizeChange={(s) => setPageSize(s)}
              pageSizeOptions={[5, 10, 20, 50]}
            />
          </div>
        </div>
      )}

      {/* Tab 2: HTTP HEADERS */}
      {activeTab === 'headers' && (
        <div className="bg-white dark:bg-[#0b0e18] border border-slate-200 dark:border-[#1d253a] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono">
              Raw HTTP Response Headers
            </h3>
            <button
              type="button"
              onClick={() => copyText(JSON.stringify(asset.headers, null, 2), 'raw-headers')}
              className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-[#161d30] dark:hover:bg-[#202944] text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-[#273352] text-xs flex items-center gap-1 cursor-pointer"
            >
              {copiedKey === 'raw-headers' ? <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copy Headers JSON</span>
            </button>
          </div>

          <div className="bg-slate-900 dark:bg-[#060810] border border-slate-800 dark:border-[#182033] rounded-lg p-3 font-mono text-xs text-slate-300 overflow-x-auto space-y-1">
            {Object.entries(asset.headers).map(([key, val]) => (
              <div key={key} className="flex gap-2">
                <span className="text-indigo-400 font-semibold select-all">{key}:</span>
                <span className="text-slate-300 select-all break-all">{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: SSL / TLS */}
      {activeTab === 'ssl' && (
        <div className="bg-white dark:bg-[#0b0e18] border border-slate-200 dark:border-[#1d253a] rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Chi Tiết Chứng Chỉ SSL / TLS</h3>
          </div>

          {asset.ssl ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-50 dark:bg-[#101424] border border-slate-200 dark:border-[#202842] rounded-lg p-3 space-y-1.5">
                <div className="text-slate-500 dark:text-slate-400">Tổ chức cấp phát (Issuer)</div>
                <div className="font-bold text-slate-800 dark:text-white font-mono">{asset.ssl.issuer}</div>
              </div>
              <div className="bg-slate-50 dark:bg-[#101424] border border-slate-200 dark:border-[#202842] rounded-lg p-3 space-y-1.5">
                <div className="text-slate-500 dark:text-slate-400">Tên miền chứng chỉ (Common Name)</div>
                <div className="font-bold text-slate-800 dark:text-white font-mono">{asset.ssl.commonName}</div>
              </div>
              <div className="bg-slate-50 dark:bg-[#101424] border border-slate-200 dark:border-[#202842] rounded-lg p-3 space-y-1.5">
                <div className="text-slate-500 dark:text-slate-400">Trạng thái hiệu lực</div>
                <div className="font-bold">
                  {asset.ssl.expiredAgoDays ? (
                    <span className="text-rose-600 dark:text-rose-400 font-mono">
                      Đã hết hạn {asset.ssl.expiredAgoDays} ngày trước
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                      Hợp lệ (Còn {asset.ssl.daysRemaining || 120} ngày)
                    </span>
                  )}
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-[#101424] border border-slate-200 dark:border-[#202842] rounded-lg p-3 space-y-1.5">
                <div className="text-slate-500 dark:text-slate-400">Giao thức mã hóa</div>
                <div className="font-bold text-slate-800 dark:text-slate-200 font-mono">TLS 1.3 / ECDHE-RSA-AES256-GCM-SHA384</div>
              </div>
            </div>
          ) : (
            <div className="text-slate-500 dark:text-slate-400 text-xs">Không có thông tin SSL/TLS cho tài sản này (HTTP port 80).</div>
          )}
        </div>
      )}

      {/* Tab 4: CVE MATCHES FOR THIS ASSET */}
      {activeTab === 'cve' && matchedCves.length > 0 && (
        <div className="space-y-3">
          {matchedCves.map((cve) => (
            <div
              key={cve.id}
              className="bg-[#0f1422] border border-rose-900/50 rounded-xl p-4 space-y-2.5 shadow-lg shadow-rose-950/20"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    {cve.severity} (CVSS {cve.cvssScore || 9.8})
                  </span>
                  <span className="font-mono text-sm font-bold text-white">{cve.cveId}</span>
                  <span className="text-xs text-slate-400">|</span>
                  <span className="text-xs text-slate-300">
                    Phần mềm: <strong className="text-amber-300 font-mono">{cve.software}</strong>
                  </span>
                  <span className="text-xs text-rose-300 font-mono px-2 py-0.2 rounded bg-rose-950/40 border border-rose-800/40">
                    Dải ảnh hưởng: {cve.affectedVersions}
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-300">{cve.cveTitle}</div>

              <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-lg p-2.5 text-xs text-emerald-300 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong>Giải pháp khắc phục:</strong> {cve.remediation}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
