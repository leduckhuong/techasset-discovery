import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Search,
  Filter,
  Download,
  Settings,
  RefreshCw,
  Plus,
  Trash2,
  Lock,
  Globe,
  ExternalLink,
  ShieldAlert,
  Layers,
  ChevronDown,
  FileSpreadsheet,
  Image as ImageIcon,
  History as HistoryIcon,
  Tag,
  CheckCircle2,
  Clock,
  Sparkles,
  Radar,
  Boxes,
} from 'lucide-react';
import { ScanResult, AssetGroup, CveMatchAlert } from '../types';
import { FacetTabDef, FacetTabs } from './FacetTabs';
import { matchesFilters, ActiveFilter, FilterFieldDef } from './FilterBuilder';
import { FooTablePagination } from './FooTablePagination';

interface ProjectDiscoveryAssetGroupViewProps {
  assetGroup: AssetGroup;
  assets: ScanResult[];
  cveAlerts?: CveMatchAlert[];
  onNavigateToCveAlerts?: () => void;
  onBackToInventory?: () => void;
  onBackToGroups?: () => void;
  onOpenImportCsv: () => void;
  onStartScan: (urls: string[]) => void;
  onSelectAsset: (asset: ScanResult) => void;
  onDeleteAsset: (id: string) => void;
  onDiscoverSubdomains?: (engine: 'subfinder' | 'crtsh') => void;
  discoveringSubs?: boolean;
  onProbePorts?: () => void;
  probingPorts?: boolean;
}

export const ProjectDiscoveryAssetGroupView: React.FC<ProjectDiscoveryAssetGroupViewProps> = ({
  assetGroup,
  assets,
  cveAlerts = [],
  onNavigateToCveAlerts,
  onBackToInventory,
  onBackToGroups,
  onOpenImportCsv,
  onStartScan,
  onSelectAsset,
  onDeleteAsset,
  onDiscoverSubdomains,
  discoveringSubs = false,
  onProbePorts,
  probingPorts = false,
}) => {
  const [activeTab, setActiveTab] = useState<'data' | 'screenshots' | 'history'>('data');
  const [searchQuery, setSearchQuery] = useState('');
  const [facetTab, setFacetTab] = useState<string | null>(null);
  const [facetValue, setFacetValue] = useState<string | null>(null);
  const [techSearch, setTechSearch] = useState('');

  const VN_SECOND_LEVEL = [
    'com.vn', 'net.vn', 'org.vn', 'edu.vn', 'gov.vn', 'info.vn', 'ac.vn', 'biz.vn', 'name.vn', 'pro.vn',
  ];
  const registrable = (host: string): string => {
    const parts = host.replace(/\.$/, '').split('.');
    if (parts.length >= 3) {
      const last2 = parts.slice(-2).join('.');
      if (VN_SECOND_LEVEL.includes(last2)) return parts.slice(-3).join('.');
    }
    return parts.slice(-2).join('.');
  };
  const sslState = (a: ScanResult): string => {
    if (!a.ssl) return 'No SSL';
    if (a.ssl.expiredAgoDays && a.ssl.expiredAgoDays > 0) return 'Expired';
    if ((a.ssl.daysRemaining ?? 999) <= 30) return 'Expiring ≤30d';
    return 'Valid';
  };
  const [discoverEngine, setDiscoverEngine] = useState<'subfinder' | 'crtsh'>('subfinder');
  const [showDiscoverMenu, setShowDiscoverMenu] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Tab facets kiểu ProjectDiscovery
  const techCategoryOf = useMemo(() => {
    const tally = new Map<string, Map<string, number>>();
    for (const a of assets) {
      for (const t of a.technologies) {
        if (!t.category) continue;
        const key = t.name.toLowerCase();
        const cats = tally.get(key) || new Map<string, number>();
        cats.set(t.category, (cats.get(t.category) || 0) + 1);
        tally.set(key, cats);
      }
    }
    return (name: string): string | undefined => {
      const cats = tally.get(name.toLowerCase());
      if (!cats) return undefined;
      return [...cats.entries()].sort((x, y) => y[1] - x[1])[0][0];
    };
  }, [assets]);

  const facetTabs: FacetTabDef<ScanResult>[] = [
    { key: 'technology', label: 'Technologies', getValues: (a) => a.technologies.map((t) => t.name), getCategory: techCategoryOf, getColor: (name) => assets.flatMap((a) => a.technologies).find((t) => t.name === name)?.color },
    { key: 'ports', label: 'Ports', getValues: (a) => a.port },
    { key: 'labels', label: 'Labels', getValues: (a) => a.labels },
    { key: 'domains', label: 'Domains', getValues: (a) => registrable(a.host) },
    { key: 'webserver', label: 'Webserver', getValues: (a) => a.webServer },
    { key: 'asn', label: 'ASN', getValues: (a) => a.asn },
    { key: 'ssl', label: 'SSL', getValues: (a) => sslState(a) },
    { key: 'status', label: 'Status', getValues: (a) => (a.statusCode > 0 ? a.statusCode : 'ERR') },
  ];

  // Filtered Assets
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      // Search matching
      const matchesSearch =
        searchQuery === '' ||
        asset.host.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (asset.ip && asset.ip.includes(searchQuery)) ||
        (asset.title && asset.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (asset.asn && asset.asn.toLowerCase().includes(searchQuery.toLowerCase())) ||
        asset.technologies.some((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      // Facet drill-down (VD: Technologies -> Nginx)
      if (facetTab && facetValue) {
        const def = facetTabs.find((f) => f.key === facetTab);
        if (def) {
          const out = def.getValues(asset);
          const list = (Array.isArray(out) ? out : [out]).map((v) =>
            v === null || v === undefined ? '' : String(v).trim().toLowerCase()
          );
          if (!list.includes(facetValue.toLowerCase())) return false;
        }
      }

      return true;
    });
  }, [assets, searchQuery, facetTab, facetValue]);

  // Paginated Assets for Foo Table
  const paginatedAssets = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAssets.slice(start, start + pageSize);
  }, [filteredAssets, page, pageSize]);


  // Giá trị của tab facet đang chọn (cho view nhóm full-width)
  const activeFacetDef = facetTabs.find((f) => f.key === facetTab) || null;
  const facetValueList = useMemo(() => {
    if (!activeFacetDef) return [];
    const agg = new Map<string, { value: string; count: number; versions: Set<string>; color?: string }>();
    for (const a of assets) {
      const out = activeFacetDef.getValues(a);
      const list = Array.isArray(out) ? out : [out];
      const seen = new Set<string>();
      for (const raw of list) {
        if (raw === null || raw === undefined) continue;
        const value = String(raw).trim();
        if (!value || seen.has(value)) continue;
        seen.add(value);
        const e = agg.get(value) || { value, count: 0, versions: new Set<string>() };
        e.count += 1;
        if (facetTab === 'technology') {
          for (const t of a.technologies) {
            if (t.name.toLowerCase() === value.toLowerCase() && t.version) e.versions.add(t.version);
          }
          if (!e.color) e.color = a.technologies.find((t) => t.name.toLowerCase() === value.toLowerCase())?.color;
        }
        agg.set(value, e);
      }
    }
    return [...agg.values()]
      .map((e) => ({ ...e, versions: [...e.versions].slice(0, 4).join(', ') }))
      .sort((x, y) => y.count - x.count || x.value.localeCompare(y.value));
  }, [assets, activeFacetDef, facetTab]);

  const activeFacetValue = facetValue ? facetValueList.find((v) => v.value === facetValue) : undefined;
  const visibleTechList = useMemo(() => {
    const q = techSearch.trim().toLowerCase();
    if (!q) return facetValueList;
    return facetValueList.filter((v) => v.value.toLowerCase().includes(q));
  }, [facetValueList, techSearch]);

  const handleExportCsv = () => {
    const headers = 'URL,Host,Port,Status,Title,Web Server,IP,ASN,Technologies\n';
    const rows = filteredAssets
      .map((a) => {
        const techs = a.technologies.map((t) => t.name).join('; ');
        return `"${a.url}","${a.host}","${a.port || 443}","${a.statusCode}","${(a.title || '').replace(/"/g, '""')}","${a.webServer || ''}","${a.ip || ''}","${a.asn || ''}","${techs}"`;
      })
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${assetGroup.name}_assets_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 text-slate-900 dark:text-slate-200">
      {/* Group Header Banner (Identical to ProjectDiscovery Cloud) */}
      <div className="bg-white dark:bg-[#0b0d14] border-b border-slate-200 dark:border-[#1e2333] pb-4 pt-1">
        {/* Navigation Breadcrumb / Actions Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              {(onBackToGroups || onBackToInventory) && (
                <button
                  type="button"
                  onClick={onBackToGroups || onBackToInventory}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 dark:bg-[#141828] dark:hover:bg-[#1f263d] dark:border-[#242e47] dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
                  title="Quay lại danh sách Asset Groups"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-sans flex items-center gap-2.5">
                {assetGroup.name}
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
              Kho lưu trữ tài sản số & tech stack được quét bởi bộ quét tự động. Kết nối tự động với Agent cảnh báo khi bot đẩy mã CVE trùng phiên bản.
            </p>
            {/* Metadata từ CSV template (email quản lý, người phụ trách, trạng thái, ghi chú...) */}
            {assetGroup.meta && Object.keys(assetGroup.meta).length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {Object.entries(assetGroup.meta).map(([key, value]) => (
                  <span
                    key={key}
                    title={`${key}: ${value}`}
                    className="inline-flex items-center gap-1 max-w-[320px] text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 dark:bg-[#151928] dark:text-slate-300 dark:border-[#27304d]"
                  >
                    <span className="text-slate-400 dark:text-slate-500 font-medium truncate">{key}:</span>
                    <span className="font-semibold truncate">{value}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="relative flex items-center rounded-lg overflow-visible">
              <button
                type="button"
                disabled={discoveringSubs || !onDiscoverSubdomains}
                onClick={() => onDiscoverSubdomains?.(discoverEngine)}
                className="px-4 py-2 rounded-l-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold text-xs shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                title={`Tìm subdomain của ${assetGroup.rootDomain} bằng ${discoverEngine === 'subfinder' ? 'subfinder (passive)' : 'crt.sh'}`}
              >
                <Radar className={`w-3.5 h-3.5 ${discoveringSubs ? 'animate-spin' : ''}`} />
                {discoveringSubs ? 'Đang tìm sub...' : 'Tìm Subdomain'}
              </button>
              <button
                type="button"
                onClick={() => setShowDiscoverMenu((v) => !v)}
                disabled={discoveringSubs}
                className="px-2 py-2 rounded-r-lg border-l border-emerald-700/40 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white flex items-center transition-all cursor-pointer"
                title="Chọn engine dò subdomain"
              >
                <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20"><path d="M5.5 7.5L10 12l4.5-4.5z" /></svg>
              </button>
              {showDiscoverMenu && (
                <div className="absolute top-full right-0 mt-1 z-20 w-64 rounded-lg border border-slate-200 dark:border-[#27304d] bg-white dark:bg-[#141828] shadow-lg overflow-hidden">
                  {([
                    { id: 'subfinder' as const, title: 'subfinder (khuyến nghị)', desc: 'Passive enum từ 40+ nguồn (VT, crt.sh, Shodan...), nhanh' },
                    { id: 'crtsh' as const, title: 'crt.sh', desc: 'Chỉ certificate transparency, không cần binary' },
                  ]).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => { setDiscoverEngine(opt.id); setShowDiscoverMenu(false); }}
                      className={`w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-[#1f263d] transition-colors cursor-pointer ${discoverEngine === opt.id ? 'bg-emerald-50 dark:bg-emerald-500/10' : ''}`}
                    >
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        {opt.title}
                        {discoverEngine === opt.id && <span className="text-emerald-500">✓</span>}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={probingPorts || !onProbePorts}
              onClick={onProbePorts}
              title={`Dò 79 web port phổ biến (80, 443, 8080, 8443, 9090...) trên các subdomain của ${assetGroup.rootDomain} bằng httpx`}
              className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white font-semibold text-xs shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Globe className={`w-3.5 h-3.5 ${probingPorts ? 'animate-spin' : ''}`} />
              {probingPorts ? 'Đang dò port...' : 'Quét Port'}
            </button>

            <button
              type="button"
              onClick={() => onStartScan(assetGroup.subdomains.map((s) => `https://${s}`))}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-black font-semibold text-xs hover:bg-slate-800 dark:hover:bg-slate-200 shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Radar className="w-3.5 h-3.5" />
              Quét Tech Stack
            </button>

            <button
              type="button"
              onClick={onOpenImportCsv}
              className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Import Subdomains (CSV)
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 dark:bg-[#151928] dark:hover:bg-[#1f263d] dark:text-slate-300 dark:hover:text-white dark:border-[#27304d] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>

            <button
              type="button"
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 dark:bg-[#151928] dark:hover:bg-[#1f263d] dark:text-slate-400 dark:hover:text-white dark:border-[#27304d] text-xs transition-colors cursor-pointer"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Headers (Data 131, Screenshots 120, History 1) */}
        <div className="flex items-center gap-6 mt-6 border-b border-slate-200 dark:border-[#1e2333] text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('data')}
            className={`pb-3 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'data'
                ? 'border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-white font-semibold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Data</span>
            <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 text-[11px] font-mono dark:text-slate-300">
              {filteredAssets.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('screenshots')}
            className={`pb-3 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'screenshots'
                ? 'border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-white font-semibold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Screenshots</span>
            <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 text-[11px] font-mono dark:text-slate-300">
              {Math.min(filteredAssets.length, 120)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`pb-3 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-white font-semibold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <HistoryIcon className="w-4 h-4" />
            <span>History</span>
            <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 text-[11px] font-mono dark:text-slate-300">
              1
            </span>
          </button>
        </div>
      </div>

      {/* Main Filter & Search Bar */}
      <div className="space-y-3">
        {/* Search row with "Add Filters" */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="px-3 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 dark:bg-[#141828] dark:hover:bg-[#1a2034] dark:text-slate-300 dark:border-[#232a42] text-xs font-semibold flex items-center gap-2 shrink-0 transition-colors cursor-pointer"
          >
            <Filter className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Add Filters</span>
          </button>

          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search results (domain, ip, tech stack, asn...)"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full bg-white dark:bg-[#121626] border border-slate-200 dark:border-[#232a42] rounded-lg pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>

        {/* Facet tabs kiểu ProjectDiscovery (Technologies / Ports / Labels / Domains / More) */}
        <FacetTabs
          rows={assets}
          tabs={facetTabs}
          activeTabKey={facetTab}
          activeValue={facetValue}
          onSelect={(tabKey, value) => { setFacetTab(tabKey); setFacetValue(value); setPage(1); }}
          totalRows={filteredAssets.length}
        />

        {facetTab && !facetValue && (
          <div className="rounded-lg border border-slate-200 dark:border-[#232a42] bg-white dark:bg-[#10131e] overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-[#232a42]">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={techSearch}
                onChange={(e) => setTechSearch(e.target.value)}
                placeholder={`Tìm ${activeFacetDef?.label.toLowerCase() || 'giá trị'}...`}
                className="flex-1 bg-transparent text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 focus:outline-none"
              />
            </div>
            <div className="max-h-[520px] overflow-y-auto divide-y divide-slate-100 dark:divide-[#1a2033]">
              {visibleTechList.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 italic">Không có dữ liệu</div>
              ) : (
                visibleTechList.map((v) => (
                  <button
                    key={v.value}
                    type="button"
                    onClick={() => { setFacetValue(v.value); setPage(1); }}
                    className="w-full flex items-center justify-between gap-4 px-3 py-3 hover:bg-slate-50 dark:hover:bg-[#161c30] transition cursor-pointer text-left"
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <span
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold text-white"
                        style={{ background: v.color || '#64748b' }}
                      >
                        {v.value.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="font-mono text-sm font-bold text-slate-800 dark:text-slate-100 truncate" title={v.value}>
                        {v.value}
                      </span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0 min-w-0">
                      {v.versions && (
                        <span className="hidden md:inline text-[11px] font-mono text-slate-400 dark:text-slate-500 truncate max-w-[220px]" title={`Các phiên bản: ${v.versions}`}>
                          v{v.versions}
                        </span>
                      )}
                      <span className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-[#2a3350] bg-slate-50 dark:bg-[#141b2e] text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                        {v.count} Services
                      </span>
                      {facetTab === 'technology' && (
                        <span className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-[#2a3350] text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 whitespace-nowrap">
                          <Boxes className="w-3.5 h-3.5" />
                          {techCategoryOf(v.value) || 'Miscellaneous'}
                        </span>
                      )}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {facetTab && facetValue && (
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30">
            <button
              type="button"
              onClick={() => setFacetValue(null)}
              className="px-2.5 py-1 rounded-md bg-white dark:bg-[#141828] border border-slate-200 dark:border-[#27314f] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-indigo-400 transition cursor-pointer"
            >
              ← Tất cả {activeFacetDef?.label}
            </button>
            <span className="font-mono text-sm font-bold text-slate-800 dark:text-slate-100">{facetValue}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{filteredAssets.length} assets thuộc nhóm này</span>
          </div>
        )}

        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setFacetTab(null);
              setFacetValue(null);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Reset filters"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

            {/* Asset Cards List — ẩn khi đang ở view bảng facet (Technologies/Ports/...) */}
      {(!facetTab || !!facetValue) && (
      <>
      <div className="space-y-3">
        {filteredAssets.length === 0 ? (
          <div className="bg-white dark:bg-[#10131e] border border-slate-200 dark:border-[#202638] rounded-xl p-12 text-center text-slate-500 dark:text-slate-400 shadow-xs">
            <ShieldAlert className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-600 mb-3" />
            <div className="font-semibold text-slate-900 dark:text-white">Không tìm thấy tài sản số phù hợp</div>
            <div className="text-xs text-slate-500 mt-1">Thử thay đổi từ khóa tìm kiếm hoặc bấm nút "Import Subdomains (CSV)" để nạp thêm</div>
          </div>
        ) : (
          paginatedAssets.map((asset) => {
            const isRedirect = asset.statusCode >= 300 && asset.statusCode < 400;
            const isSuccess = asset.statusCode >= 200 && asset.statusCode < 300;
            const isError = asset.statusCode >= 400 || asset.statusCode === 0;
            const assetCveMatches = cveAlerts.filter(
              (a) => a.matchedAssetId === asset.id || a.assetHost.toLowerCase() === asset.host.toLowerCase()
            );

            return (
              <div
                key={asset.id}
                className={`bg-white dark:bg-[#0c0f18] hover:bg-slate-50 dark:hover:bg-[#111422] border rounded-xl p-4 transition-all duration-150 flex flex-col xl:flex-row xl:items-center justify-between gap-4 cursor-pointer shadow-xs ${
                  assetCveMatches.length > 0
                    ? 'border-rose-300 dark:border-rose-900/50 hover:border-rose-400 dark:hover:border-rose-700/70'
                    : 'border-slate-200 dark:border-[#1d2336] hover:border-indigo-300 dark:hover:border-[#2b3452]'
                }`}
                onClick={() => onSelectAsset(asset)}
              >
                {/* Left Column: Host & Port, ASN, IP, Badges, Labels */}
                <div className="space-y-2 min-w-[280px] max-w-sm">
                  {/* Host:Port */}
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-mono tracking-tight">
                      {asset.host}:{asset.port || 443}
                    </span>
                    <a
                      href={asset.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  {/* Status, ASN, IP, and In-App CVE Alert */}
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    {/* In-App Agent CVE Match Warning */}
                    {assetCveMatches.length > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onNavigateToCveAlerts) onNavigateToCveAlerts();
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded font-mono text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/50 hover:bg-rose-100 dark:hover:bg-rose-500/30 transition shadow-xs cursor-pointer"
                        title="Agent cảnh báo: Phát hiện phiên bản công nghệ trùng với mã CVE! Bấm để xem."
                      >
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400 animate-pulse" />
                        <span>{assetCveMatches.length} CVE Matched</span>
                        <span className="text-[10px] opacity-80 font-sans">
                          ({assetCveMatches.map((m) => m.cveId).join(', ')})
                        </span>
                      </button>
                    )}

                    {/* Status Code Badge */}
                    {isSuccess && (
                      <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-[#14532d]/80 dark:text-emerald-300 dark:border-emerald-500/40">
                        {asset.statusCode} OK
                      </span>
                    )}
                    {isRedirect && (
                      <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-[#1e3a8a]/80 dark:text-blue-300 dark:border-blue-500/40">
                        {asset.statusCode} {asset.statusText || 'Found'}
                      </span>
                    )}
                    {isError && (
                      <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-[#7f1d1d]/80 dark:text-rose-300 dark:border-rose-500/40">
                        {asset.statusCode || 'FAIL'}
                      </span>
                    )}

                    {/* ASN Tag */}
                    {asset.asn && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 text-slate-700 border border-slate-200 dark:bg-[#161a29] dark:text-slate-300 dark:border-[#272e48]">
                        {asset.asn}
                      </span>
                    )}

                    {/* IP Address */}
                    {asset.ip && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 text-slate-600 border border-slate-200 dark:bg-[#161a29] dark:text-slate-400 dark:border-[#272e48]">
                        {asset.ip}
                      </span>
                    )}
                  </div>

                  {/* Labels / Tags Row */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    {asset.labels && asset.labels.length > 0 ? (
                      asset.labels.map((lbl, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200 dark:bg-[#1a2034] dark:text-slate-300 dark:border-[#2a3352] flex items-center gap-1"
                        >
                          <Tag className="w-2.5 h-2.5 text-indigo-500 dark:text-indigo-400" />
                          {lbl}
                        </span>
                      ))
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        className="px-2 py-0.5 rounded text-[11px] text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border border-dashed border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> Add labels
                      </button>
                    )}
                  </div>
                </div>

                {/* Center-Left: Thumbnail Screenshot Preview */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-28 h-18 rounded-lg bg-slate-100 dark:bg-[#141828] border border-slate-200 dark:border-[#22283f] overflow-hidden relative flex flex-col justify-between p-1 shadow-inner group">
                    {asset.title && (
                      <div className="text-[9px] text-slate-700 dark:text-slate-300 line-clamp-2 px-1 font-sans bg-white/70 dark:bg-black/40 rounded py-0.5">
                        {asset.title}
                      </div>
                    )}
                    <div className="mt-auto flex items-center justify-between text-[8px] text-slate-500 px-1">
                      <span>Tech</span>
                      <span className="font-mono">{asset.responseTimeMs}ms</span>
                    </div>
                  </div>
                </div>

                {/* Center-Right: Stacked Technologies Chips */}
                <div className="flex-1 max-w-md">
                  {asset.technologies.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {asset.technologies.slice(0, 5).map((tech, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-100 text-slate-800 border border-slate-200 dark:bg-[#151a2a] dark:text-slate-200 dark:border-[#27304d] flex items-center gap-1.5"
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: tech.color || '#6366f1' }}
                          />
                          <span className="font-sans font-medium">{tech.name}</span>
                          {tech.version && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">v{tech.version}</span>
                          )}
                        </span>
                      ))}
                      {asset.technologies.length > 5 && (
                        <span className="px-2 py-1 rounded-md text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-[#151a2a] dark:text-indigo-400 dark:border-indigo-500/30">
                          + {asset.technologies.length - 5} more
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 dark:text-slate-500 italic">No technologies detected</span>
                  )}
                </div>

                {/* Right Column: SSL Certificate Badge & Delete Action */}
                <div className="flex items-center gap-4 shrink-0 justify-between xl:justify-end">
                  {/* SSL Info */}
                  <div className="space-y-1 text-right">
                    {asset.ssl ? (
                      <div>
                        <div
                          className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded ${
                            asset.ssl.expiredAgoDays
                              ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-700/50'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700/50'
                          }`}
                        >
                          <Lock className="w-3 h-3" />
                          {asset.ssl.expiredAgoDays ? (
                            <span>SSL (Expired {asset.ssl.expiredAgoDays}d ago)</span>
                          ) : (
                            <span>SSL Valid ({asset.ssl.daysRemaining || 90}d)</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                          {asset.ssl.issuer}
                        </div>
                        <div className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">
                          {asset.ssl.commonName}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">No SSL</span>
                    )}
                  </div>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteAsset(asset.id);
                    }}
                    title="Xóa tài sản này"
                    className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 dark:bg-rose-950/30 dark:hover:bg-rose-900/50 dark:text-rose-400 dark:border-rose-800/40 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {(!facetTab || !!facetValue) && filteredAssets.length > 0 && (
        <FooTablePagination
          currentPage={page}
          pageSize={pageSize}
          totalItems={filteredAssets.length}
          onPageChange={(p) => setPage(p)}
          onPageSizeChange={(s) => setPageSize(s)}
          pageSizeOptions={[10, 25, 50, 100]}
        />
      )}
      </>
      )}
    </div>
  );
};
