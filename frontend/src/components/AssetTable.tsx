import React, { useState, useMemo } from 'react';
import {
  Search,
  Download,
  Copy,
  ExternalLink,
  Info,
  Trash2,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Server,
  ArrowUpDown,
  CheckSquare,
  Square,
  Sparkles,
  Boxes,
} from 'lucide-react';
import { ScanResult, TechSignature, AssetGroup } from '../types';
import { QBtn, QChip, QBadge, QCard } from './QuasarUiElements';
import { FooTablePagination } from './FooTablePagination';

import { FilterBuilder, matchesFilters, ActiveFilter, FilterFieldDef } from './FilterBuilder';
import { FacetTabDef, FacetTabs } from './FacetTabs';

const VN_SECOND_LEVEL = [
  'com.vn', 'net.vn', 'org.vn', 'edu.vn', 'gov.vn', 'info.vn', 'int.vn', 'ac.vn',
  'biz.vn', 'name.vn', 'pro.vn', 'health.vn', 'hn.vn', 'hcm.vn', 'dn.vn', 'hp.vn', 'nd.vn',
];

// Ước lượng domain gốc (eTLD+1) từ host khi asset không thuộc group nào
function roughRegistrable(host: string): string {
  const parts = host.replace(/\.$/, '').split('.');
  if (parts.length >= 3) {
    const last2 = parts.slice(-2).join('.');
    if (VN_SECOND_LEVEL.includes(last2)) return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

interface AssetTableProps {
  assets: ScanResult[];
  groups?: AssetGroup[];
  onSelectAsset: (asset: ScanResult) => void;
  onDeleteAsset?: (id: string) => void;
  onClearAll?: () => void;
  onFilterByTech?: (techName: string) => void;
  selectedTechFilter?: string | null;
  onClearTechFilter?: () => void;
  onClearFilter?: () => void;
  onLoadPresets?: () => void;
}

export const AssetTable: React.FC<AssetTableProps> = ({
  assets,
  groups = [],
  onSelectAsset,
  onDeleteAsset = (_id: string) => {},
  onClearAll = () => {},
  onFilterByTech = (_techName: string) => {},
  selectedTechFilter,
  onClearTechFilter,
  onClearFilter,
  onLoadPresets = () => {},
}) => {
  const handleClearFilter = onClearTechFilter || onClearFilter || (() => {});
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<ActiveFilter[]>([]);
  const [facetTab, setFacetTab] = useState<string | null>(null);
  const [facetValue, setFacetValue] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<'responseTimeMs' | 'statusCode' | 'host'>('responseTimeMs');
  const [sortAsc, setSortAsc] = useState(true);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Map subdomain -> rootDomain từ các asset group (ưu tiên), fallback heuristic
  const rootDomainOf = useMemo(() => {
    const subToRoot = new Map<string, string>();
    const byId = new Map<string, AssetGroup>();
    for (const g of groups) {
      byId.set(g.id, g);
      subToRoot.set(g.rootDomain.toLowerCase(), g.rootDomain);
      for (const sub of g.subdomains) subToRoot.set(sub.toLowerCase(), g.rootDomain);
    }
    return (asset: ScanResult): string => {
      if (asset.assetGroupId && byId.has(asset.assetGroupId)) {
        return byId.get(asset.assetGroupId)!.rootDomain;
      }
      return subToRoot.get(asset.host.toLowerCase()) || roughRegistrable(asset.host);
    };
  }, [groups]);

  const sslState = (a: ScanResult): string => {
    if (!a.ssl) return 'No SSL';
    if (a.ssl.expiredAgoDays && a.ssl.expiredAgoDays > 0) return 'Expired';
    if ((a.ssl.daysRemaining ?? 999) <= 30) return 'Expiring ≤30d';
    return 'Valid';
  };

  // Các trường filter theo kiểu ProjectDiscovery
  const filterFields: FilterFieldDef<ScanResult>[] = useMemo(() => [
    { key: 'host', label: 'Host', getValues: (a) => a.host },
    { key: 'domain', label: 'Domain', getValues: (a) => rootDomainOf(a) },
    { key: 'port', label: 'Port', getValues: (a) => a.port },
    { key: 'status', label: 'Status', getValues: (a) => (a.statusCode > 0 ? a.statusCode : 'ERR') },
    { key: 'technology', label: 'Technology', getValues: (a) => a.technologies.map((t) => t.name) },
    { key: 'webserver', label: 'Webserver', getValues: (a) => a.webServer },
    { key: 'ip', label: 'IP', getValues: (a) => a.ip },
    { key: 'asn', label: 'ASN', getValues: (a) => a.asn },
    { key: 'labels', label: 'Labels', getValues: (a) => a.labels },
    { key: 'title', label: 'Title', getValues: (a) => a.title },
    { key: 'ssl', label: 'SSL', getValues: (a) => sslState(a) },
    { key: 'project', label: 'Dự án', getValues: (a) => a.meta?.['DỰ ÁN'] || a.meta?.['PROJECT'] },
  ], [rootDomainOf]);

  // Tab facets kiểu ProjectDiscovery: bấm tab -> danh sách giá trị + số services
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
    { key: 'domains', label: 'Domains', getValues: (a) => rootDomainOf(a) },
    { key: 'webserver', label: 'Webserver', getValues: (a) => a.webServer },
    { key: 'asn', label: 'ASN', getValues: (a) => a.asn },
    { key: 'ssl', label: 'SSL', getValues: (a) => sslState(a) },
    { key: 'status', label: 'Status', getValues: (a) => (a.statusCode > 0 ? a.statusCode : 'ERR') },
  ];

  // Filtered and sorted assets
  const filteredAssets = useMemo(() => {
    return assets
      .filter((item) => {
        // Search term
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchHost = item.host.toLowerCase().includes(q);
          const matchUrl = item.url.toLowerCase().includes(q);
          const matchTitle = (item.title || '').toLowerCase().includes(q);
          const matchTech = item.technologies.some((t) => t.name.toLowerCase().includes(q));
          const matchServer = (item.webServer || '').toLowerCase().includes(q);
          const matchIp = (item.ip || '').toLowerCase().includes(q);
          if (!matchHost && !matchUrl && !matchTitle && !matchTech && !matchServer && !matchIp) {
            return false;
          }
        }

        // Tech filter chip (từ TechMatrix click sang)
        if (selectedTechFilter) {
          const hasTech = item.technologies.some(
            (t) => t.name.toLowerCase() === selectedTechFilter.toLowerCase()
          );
          if (!hasTech) return false;
        }

        // FilterBuilder (kiểu ProjectDiscovery)
        if (!matchesFilters(item, filters, filterFields)) return false;

        // Facet tab đang chọn (VD Technologies -> Nginx)
        if (facetTab && facetValue) {
          const def = facetTabs.find((f) => f.key === facetTab);
          if (def) {
            const out = def.getValues(item);
            const list = (Array.isArray(out) ? out : [out]).map((v) =>
              v === null || v === undefined ? '' : String(v).trim().toLowerCase()
            );
            if (!list.includes(facetValue.toLowerCase())) return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortField === 'responseTimeMs') {
          return sortAsc ? a.responseTimeMs - b.responseTimeMs : b.responseTimeMs - a.responseTimeMs;
        }
        if (sortField === 'statusCode') {
          return sortAsc ? a.statusCode - b.statusCode : b.statusCode - a.statusCode;
        }
        if (sortField === 'host') {
          return sortAsc ? a.host.localeCompare(b.host) : b.host.localeCompare(a.host);
        }
        return 0;
      });
  }, [assets, searchTerm, selectedTechFilter, filters, filterFields, facetTab, facetValue, sortField, sortAsc]);

  // Paginated assets for Foo Table
  const paginatedAssets = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAssets.slice(start, start + pageSize);
  }, [filteredAssets, page, pageSize]);

  const toggleSort = (field: 'responseTimeMs' | 'statusCode' | 'host') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredAssets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAssets.map((a) => a.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 1500);
  };

  const exportCSV = () => {
    const dataToExport = selectedIds.size > 0
      ? assets.filter((a) => selectedIds.has(a.id))
      : filteredAssets;

    const headers = ['URL', 'Host', 'Status', 'Title', 'Technologies', 'Web Server', 'Response Time (ms)', 'IP'];
    const rows = dataToExport.map((a) => [
      `"${a.url}"`,
      `"${a.host}"`,
      a.statusCode,
      `"${(a.title || '').replace(/"/g, '""')}"`,
      `"${a.technologies.map((t) => t.name).join(', ')}"`,
      `"${a.webServer || ''}"`,
      a.responseTimeMs,
      `"${a.ip || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `tech_assets_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportJSON = () => {
    const dataToExport = selectedIds.size > 0
      ? assets.filter((a) => selectedIds.has(a.id))
      : filteredAssets;

    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(dataToExport, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `tech_assets_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const getStatusBadge = (code: number, text?: string) => {
    if (code >= 200 && code < 300) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-[#21BA45]/15 text-[#1b9937] border border-[#21BA45]/30">
          <CheckCircle2 className="w-3 h-3" />
          {code} {text || 'OK'}
        </span>
      );
    }
    if (code >= 300 && code < 400) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-[#1976D2]/15 text-[#1565C0] border border-[#1976D2]/30">
          <ArrowUpDown className="w-3 h-3" />
          {code} {text || 'Redirect'}
        </span>
      );
    }
    if (code >= 400 && code < 500) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-[#F2C037]/20 text-[#a37604] border border-[#F2C037]/40">
          <AlertTriangle className="w-3 h-3" />
          {code} {text || 'Client Err'}
        </span>
      );
    }
    if (code >= 500) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-[#C10015]/15 text-[#C10015] border border-[#C10015]/30">
          <XCircle className="w-3 h-3" />
          {code} {text || 'Server Err'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-slate-200 text-slate-700">
        <XCircle className="w-3 h-3 text-slate-500" />
        0 Failed
      </span>
    );
  };

  // Danh sách giá trị của tab facet đang chọn (kèm count + versions) — render thành
  // nội dung CHÍNH thay bảng (như tab Technologies của ProjectDiscovery)
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

  const activeFacetValue = facetValue
    ? facetValueList.find((v) => v.value === facetValue)
    : undefined;

  return (
    <div className="bg-white dark:bg-[#0b0e18] rounded-lg border border-slate-200 dark:border-[#1d253a] q-shadow-1 overflow-hidden transition-all">
      {/* Table Toolbar (Quasar q-table top) */}
      <div className="p-3 sm:p-4 bg-slate-50 dark:bg-[#0e1220] border-b border-slate-200 dark:border-[#1d253a] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
              <Server className="w-4 h-4 text-[#1976D2]" />
              <span>Danh mục Tài sản Quét (Tech Inventory)</span>
            </h3>
            <span className="text-xs bg-[#1976D2] text-white font-bold px-2 py-0.5 rounded-full">
              {filteredAssets.length} / {assets.length}
            </span>
          </div>

          {/* Search Box */}
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                id="input-search-table"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm URL, host, tech (Vue, Quasar, Nginx...), title, IP..."
                className="w-full pl-8 pr-8 py-1.5 text-xs bg-white dark:bg-[#14192a] border border-slate-300 dark:border-[#242d45] rounded focus:outline-none focus:ring-2 focus:ring-[#1976D2] text-slate-800 dark:text-slate-100 placeholder-slate-400"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs cursor-pointer"
                >
                  ×
                </button>
              )}
            </div>

            {/* Export Buttons */}
            <div className="flex items-center gap-1 shrink-0">
              <QBtn
                dense
                flat
                color="primary"
                onClick={exportCSV}
                disabled={filteredAssets.length === 0}
                icon={<Download className="w-3.5 h-3.5" />}
                label="CSV"
                title="Xuất bảng ra tệp CSV"
              />
              <QBtn
                dense
                flat
                color="secondary"
                onClick={exportJSON}
                disabled={filteredAssets.length === 0}
                icon={<Download className="w-3.5 h-3.5" />}
                label="JSON"
                title="Xuất định dạng JSON"
              />
            </div>
          </div>
        </div>

        {/* Filter Builder (kiểu ProjectDiscovery) */}
        <div className="flex items-center flex-wrap gap-2 pt-1 border-t border-slate-200/60 dark:border-[#1d253a]">
          <FilterBuilder
            rows={assets}
            fields={filterFields}
            filters={filters}
            onChange={setFilters}
          />
          {(filters.length > 0 || searchTerm || (facetTab && facetValue)) && (
            <button
              onClick={() => { setFilters([]); setSearchTerm(''); setFacetTab(null); setFacetValue(null); }}
              className="text-[11px] text-slate-500 hover:text-red-500 dark:text-slate-400 transition cursor-pointer font-medium"
            >
              × Xóa toàn bộ lọc
            </button>
          )}

        {/* Facet tabs kiểu ProjectDiscovery (Technologies / Ports / Labels / Domains / More) */}
        <FacetTabs
          rows={assets}
          tabs={facetTabs}
          activeTabKey={facetTab}
          activeValue={facetValue}
          onSelect={(tabKey, value) => { setFacetTab(tabKey); setFacetValue(value); setPage(1); }}
          totalRows={filteredAssets.length}
        />

          {/* Active Tech Filter indicator */}
          {selectedTechFilter && (
            <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/40 text-[#1976D2] dark:text-indigo-300 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800 text-[11px] font-medium">
              <span>Đang lọc công nghệ:</span>
              <span className="font-bold">{selectedTechFilter}</span>
              <button
                onClick={handleClearFilter}
                className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full w-4 h-4 flex items-center justify-center font-bold text-xs cursor-pointer"
              >
                ×
              </button>
            </div>
          )}

          {/* Bulk Action / Selection Count */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded text-xs text-slate-800 dark:text-slate-200 font-medium">
              <span>Đã chọn: {selectedIds.size}</span>
              <button
                onClick={() => {
                  selectedIds.forEach((id) => onDeleteAsset(id));
                  setSelectedIds(new Set());
                }}
                className="text-red-600 dark:text-red-400 hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" /> Xóa
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table Content — khi chọn tab facet: hiện view nhóm full-width thay bảng */}
      {facetTab && !facetValue && (
        <div className="divide-y divide-slate-100 dark:divide-[#1a2033]">
          {facetValueList.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400 italic">Không có dữ liệu cho "{activeFacetDef?.label}"</div>
          ) : (
            facetValueList.map((v) => (
              <button
                key={v.value}
                type="button"
                onClick={() => { setFacetValue(v.value); setPage(1); }}
                className="w-full flex items-center justify-between gap-4 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-[#131a2c] transition cursor-pointer text-left"
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
                    <span className="hidden md:inline text-[11px] font-mono text-slate-400 dark:text-slate-500 truncate max-w-[240px]" title={`Các phiên bản: ${v.versions}`}>
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
      )}

      {facetTab && facetValue && activeFacetValue && (
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-[#0e1220] border-b border-slate-200 dark:border-[#1d253a]">
          <button
            type="button"
            onClick={() => setFacetValue(null)}
            className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#14192a] border border-slate-300 dark:border-[#27314f] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#1976D2] hover:text-[#1976D2] transition cursor-pointer flex items-center gap-1.5"
          >
            ← Tất cả {activeFacetDef?.label}
          </button>
          <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white" style={{ background: activeFacetValue.color || '#64748b' }}>
            {activeFacetValue.value.slice(0, 1).toUpperCase()}
          </span>
          <span className="font-mono text-sm font-bold text-slate-800 dark:text-slate-100">{activeFacetValue.value}</span>
          <span className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-[#2a3350] bg-slate-50 dark:bg-[#141b2e] text-xs font-semibold text-slate-700 dark:text-slate-200">
            {activeFacetValue.count} Services
          </span>
          {facetTab === 'technology' && (
            <span className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-[#2a3350] text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Boxes className="w-3.5 h-3.5" />
              {techCategoryOf(activeFacetValue.value) || 'Miscellaneous'}
            </span>
          )}
          {activeFacetValue.versions && (
            <span className="hidden md:inline text-[11px] font-mono text-slate-400">v{activeFacetValue.versions}</span>
          )}
        </div>
      )}

      {(!facetTab || !!facetValue) && (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300 border-collapse">
          {/* Table Header (q-table header) */}
          <thead className="bg-slate-100 dark:bg-[#0e1324] text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-[#1d253a] select-none">
            <tr>
              <th className="p-3 w-10 text-center">
                <button
                  onClick={handleSelectAll}
                  className="cursor-pointer text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  {selectedIds.size === filteredAssets.length && filteredAssets.length > 0 ? (
                    <CheckSquare className="w-4 h-4 text-[#1976D2]" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
              </th>
              <th
                onClick={() => toggleSort('statusCode')}
                className="p-3 cursor-pointer hover:bg-slate-200/70 dark:hover:bg-[#161c32] transition w-28"
              >
                <div className="flex items-center gap-1">
                  <span>Trạng thái</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => toggleSort('host')}
                className="p-3 cursor-pointer hover:bg-slate-200/70 dark:hover:bg-[#161c32] transition min-w-[200px]"
              >
                <div className="flex items-center gap-1">
                  <span>Mục tiêu / URL</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="p-3 min-w-[220px]">Tiêu đề Trang (Title)</th>
              <th className="p-3 min-w-[250px]">Công nghệ phát hiện (Tech Stack)</th>
              <th className="p-3 w-28">Máy chủ Web</th>
              <th
                onClick={() => toggleSort('responseTimeMs')}
                className="p-3 cursor-pointer hover:bg-slate-200/70 dark:hover:bg-[#161c32] transition w-24 text-right"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Phản hồi</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="p-3 w-28">Địa chỉ IP</th>
              <th className="p-3 w-20 text-center">Chi tiết</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-100 dark:divide-[#171f33]">
            {filteredAssets.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-12 text-center text-slate-400">
                  <div className="max-w-xs mx-auto space-y-3">
                    <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-[#14192a] flex items-center justify-center text-slate-400">
                      <Server className="w-6 h-6" />
                    </div>
                    <div className="font-semibold text-slate-700 dark:text-slate-200 text-sm">Chưa có tài sản nào</div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Nhập danh sách URL và nhấn &quot;Quét&quot; hoặc nạp bộ mục tiêu mẫu để xem kết quả quét công nghệ.
                    </p>
                    <QBtn
                      dense
                      color="primary"
                      onClick={onLoadPresets}
                      icon={<Sparkles className="w-3.5 h-3.5" />}
                      label="Nạp mục tiêu mẫu"
                      className="mx-auto"
                    />
                  </div>
                </td>
              </tr>
            ) : (
              paginatedAssets.map((asset) => {
                const isSelected = selectedIds.has(asset.id);
                return (
                  <tr
                    key={asset.id}
                    id={`asset-row-${asset.id}`}
                    className={`hover:bg-blue-50/50 dark:hover:bg-[#121728] transition-colors ${
                      isSelected ? 'bg-blue-50/70 dark:bg-indigo-950/30' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="p-3 text-center">
                      <button
                        onClick={() => toggleSelect(asset.id)}
                        className="cursor-pointer text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-[#1976D2]" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 dark:text-slate-600" />
                        )}
                      </button>
                    </td>

                    {/* Status Code */}
                    <td className="p-3 whitespace-nowrap">
                      {getStatusBadge(asset.statusCode, asset.statusText)}
                    </td>

                    {/* Target Host & URL */}
                    <td className="p-3">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                        <span className="truncate max-w-[240px]" title={asset.host}>
                          {asset.host}
                        </span>
                        <a
                          href={asset.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-400 hover:text-[#1976D2] dark:hover:text-indigo-400 transition p-0.5"
                          title="Mở URL"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <button
                          onClick={() => handleCopyUrl(asset.url)}
                          className="text-slate-400 hover:text-[#1976D2] dark:hover:text-indigo-400 transition p-0.5 cursor-pointer"
                          title={copiedUrl === asset.url ? 'Đã sao chép!' : 'Sao chép URL'}
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 dark:text-slate-500 truncate max-w-[240px]">
                        {asset.url}
                      </div>
                    </td>

                    {/* Title */}
                    <td className="p-3">
                      <div
                        className="text-xs text-slate-700 dark:text-slate-300 font-medium line-clamp-2 max-w-[280px]"
                        title={asset.title}
                      >
                        {asset.title || <span className="text-slate-400 dark:text-slate-500 italic">Không có tiêu đề</span>}
                      </div>
                    </td>

                    {/* Detected Technologies (Quasar Chips) */}
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1 max-w-[320px]">
                        {asset.technologies.length === 0 ? (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 italic">Không có chữ ký</span>
                        ) : (
                          asset.technologies.map((tech, idx) => (
                            <button
                              key={idx}
                              onClick={() => onFilterByTech(tech.name)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition cursor-pointer hover:opacity-85 active:scale-95 shadow-xs"
                              style={{
                                backgroundColor: tech.color ? `${tech.color}18` : '#1976D218',
                                color: tech.color || '#1976D2',
                                border: `1px solid ${tech.color ? `${tech.color}40` : '#1976D240'}`,
                              }}
                              title={`Lọc theo công nghệ: ${tech.name} (${tech.category})`}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: tech.color || '#1976D2' }}
                              />
                              <span>{tech.name}</span>
                              {tech.version && (
                                <span className="opacity-70 text-[10px]">v{tech.version}</span>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    </td>

                    {/* Web Server */}
                    <td className="p-3 whitespace-nowrap">
                      {asset.webServer ? (
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-[#14192a] text-slate-700 dark:text-slate-300 rounded text-[11px] font-mono border border-slate-200 dark:border-[#27314f]">
                          {asset.webServer}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 text-[11px]">-</span>
                      )}
                    </td>

                    {/* Response Time */}
                    <td className="p-3 whitespace-nowrap text-right font-mono">
                      <span
                        className={`text-xs font-semibold ${
                          asset.responseTimeMs < 300
                            ? 'text-[#21BA45]'
                            : asset.responseTimeMs < 800
                            ? 'text-[#1976D2]'
                            : 'text-[#F2C037]'
                        }`}
                      >
                        {asset.responseTimeMs} ms
                      </span>
                    </td>

                    {/* IP Address */}
                    <td className="p-3 whitespace-nowrap font-mono text-[11px] text-slate-600 dark:text-slate-400">
                      {asset.ip || <span className="text-slate-400 dark:text-slate-600">-</span>}
                    </td>

                    {/* Actions */}
                    <td className="p-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onSelectAsset(asset)}
                          className="p-1 rounded text-[#1976D2] hover:bg-[#1976D2]/10 transition cursor-pointer"
                          title="Xem headers & chi tiết raw HTTP"
                        >
                          <Info className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteAsset(asset.id)}
                          className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
                          title="Xóa tài sản"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      )}

      {facetTab && !facetValue && <div className="h-4" />}
      {(!facetTab || !!facetValue) && (
      <>
      {/* Foo Table Pagination */}
      <FooTablePagination
        currentPage={page}
        pageSize={pageSize}
        totalItems={filteredAssets.length}
        onPageChange={(p) => setPage(p)}
        onPageSizeChange={(s) => setPageSize(s)}
        pageSizeOptions={[10, 25, 50, 100]}
      />
      </>
      )}

      {/* Quasar Table Footer Summary */}
      <div className="p-3 bg-slate-50 dark:bg-[#0e1220] border-t border-slate-200 dark:border-[#1d253a] flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2">
        <div>
          Hiển thị <span className="font-bold text-slate-700 dark:text-slate-200">{filteredAssets.length}</span> trong tổng số{' '}
          <span className="font-bold text-slate-700 dark:text-slate-200">{assets.length}</span> tài sản
        </div>

        {assets.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-red-600 dark:text-red-400 hover:underline text-xs flex items-center gap-1 cursor-pointer font-medium"
          >
            <Trash2 className="w-3 h-3" />
            <span>Xóa toàn bộ kết quả</span>
          </button>
        )}
      </div>
    </div>
  );
};
