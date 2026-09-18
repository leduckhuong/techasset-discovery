import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Trash2,
  RefreshCw,
  Globe,
  CheckCircle2,
  MoreVertical,
  Layers,
  Binoculars,
  Clock,
  ArrowUpDown,
  Plus,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { AssetGroup, ScanResult, CveMatchAlert } from '../types';
import { FooTablePagination } from './FooTablePagination';

interface AssetGroupsTableViewProps {
  assetGroups: AssetGroup[];
  assets: ScanResult[];
  cveAlerts?: CveMatchAlert[];
  onSelectGroup: (group: AssetGroup) => void;
  onOpenCreateGroup?: () => void;
  onOpenImportCsv?: () => void;
}

import { FilterBuilder, matchesFilters, ActiveFilter, FilterFieldDef } from './FilterBuilder';

// Định nghĩa các trường lọc cấp asset group (theo kiểu ProjectDiscovery)
const GROUP_FILTER_FIELDS: FilterFieldDef<AssetGroup>[] = [
  { key: 'rootDomain', label: 'Domain gốc', getValues: (g) => g.rootDomain },
  { key: 'project', label: 'Dự án', getValues: (g) => g.tags },
  { key: 'email', label: 'Email quản lý', getValues: (g) =>
      g.meta?.['EMAIL SẼ QUẢN LÝ DOMAIN'] || undefined },
  { key: 'owner', label: 'Người phụ trách', getValues: (g) =>
      g.meta?.['NGƯỜI PHỤ TRÁCH'] || undefined },
  { key: 'transferStatus', label: 'Trạng thái chuyển', getValues: (g) =>
      g.meta?.['TRẠNG THÁI CHUYỂN'] || undefined },
  { key: 'status', label: 'Status (meta)', getValues: (g) => g.meta?.['STATUS'] || undefined },
];

export const AssetGroupsTableView: React.FC<AssetGroupsTableViewProps> = ({
  assetGroups,
  assets,
  cveAlerts = [],
  onSelectGroup,
  onOpenCreateGroup,
  onOpenImportCsv,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<ActiveFilter[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortField, setSortField] = useState<'name' | 'assetCount' | 'createdAt'>('name');
  const [sortAsc, setSortAsc] = useState(true);

  // Filtered and sorted groups
  const filteredGroups = useMemo(() => {
    let result = assetGroups.filter((g) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        g.name.toLowerCase().includes(q) ||
        g.rootDomain.toLowerCase().includes(q) ||
        (g.description && g.description.toLowerCase().includes(q));
      return matchSearch && matchesFilters(g, filters, GROUP_FILTER_FIELDS);
    });

    result.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];
      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? (valA > valB ? 1 : -1) : valA < valB ? 1 : -1;
    });

    return result;
  }, [assetGroups, searchQuery, filters, sortField, sortAsc]);

  // Paginated groups
  const paginatedGroups = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredGroups.slice(start, start + pageSize);
  }, [filteredGroups, page, pageSize]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedGroups(filteredGroups.map((g) => g.id));
    } else {
      setSelectedGroups([]);
    }
  };

  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedGroups((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSort = (field: 'name' | 'assetCount' | 'createdAt') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  return (
    <div className="space-y-4 text-slate-800 dark:text-slate-200">
      {/* Top Banner Header (matching Image 1 cloud.projectdiscovery.io/assets) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-[#1c2234]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-sans">
            Asset groups
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Create and manage asset discovery groups. Start by adding domains or IP ranges to monitor. Upgrade for advanced scanning.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenImportCsv}
            className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 dark:bg-[#14192b] dark:hover:bg-[#1f2742] dark:text-slate-200 dark:border-[#273252] text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Import CSV</span>
          </button>

          <button
            type="button"
            onClick={onOpenCreateGroup || onOpenImportCsv}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-black font-semibold text-xs hover:bg-slate-800 dark:hover:bg-slate-200 shadow-xs flex items-center gap-2 transition-all cursor-pointer"
          >
            <Binoculars className="w-3.5 h-3.5" />
            <span>Start Discovery</span>
          </button>
        </div>
      </div>

      {/* Filter Row (matching Image 1) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          {/* Filter builder (kiểu ProjectDiscovery) */}
          <FilterBuilder
            rows={assetGroups}
            fields={GROUP_FILTER_FIELDS}
            filters={filters}
            onChange={setFilters}
          />

          {/* Search asset groups input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search asset groups"
              className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-[#0b0e18] border border-slate-200 dark:border-[#1e253a] rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          {/* Filter by button */}
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#0b0e18] hover:bg-slate-50 dark:hover:bg-[#14192a] border border-slate-200 dark:border-[#1e253a] text-slate-700 dark:text-slate-300 text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Filter className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Filter by</span>
          </button>

          {/* Trash button */}
          <button
            type="button"
            disabled={selectedGroups.length === 0}
            className="p-2 rounded-lg bg-white dark:bg-[#0b0e18] hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-[#1e253a] hover:border-rose-300 dark:hover:border-rose-800/40 text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
            title="Xóa nhóm đã chọn"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Refresh button */}
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="p-2 rounded-lg bg-white dark:bg-[#0b0e18] hover:bg-slate-50 dark:hover:bg-[#14192a] border border-slate-200 dark:border-[#1e253a] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
            title="Làm mới"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono self-center">
          Total groups: <strong className="text-slate-900 dark:text-white font-bold">{filteredGroups.length}</strong>
        </div>
      </div>

      {/* Asset Groups Table (Image 1 replica) */}
      <div className="bg-white dark:bg-[#0b0e18] border border-slate-200 dark:border-[#1e253a] rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#0e1322] border-b border-slate-200 dark:border-[#1e253a] text-slate-500 dark:text-slate-400 text-[11px] font-semibold tracking-wider">
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={
                      selectedGroups.length > 0 &&
                      selectedGroups.length === filteredGroups.length
                    }
                    onChange={handleSelectAll}
                    className="w-3.5 h-3.5 rounded bg-slate-100 dark:bg-[#161c2d] border-slate-300 dark:border-[#29344e] text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                </th>

                <th
                  onClick={() => toggleSort('name')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Asset group name</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                  </div>
                </th>

                <th className="py-3 px-4">
                  <span>Source</span>
                </th>

                <th
                  onClick={() => toggleSort('assetCount')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Total services</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                  </div>
                </th>

                <th className="py-3 px-4">
                  <span>Duration</span>
                </th>

                <th
                  onClick={() => toggleSort('createdAt')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Last Updated</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                  </div>
                </th>

                <th className="py-3 px-4 text-right w-14">
                  <span></span>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 dark:divide-[#161c2d]">
              {paginatedGroups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                    Không có nhóm tài sản nào phù hợp.
                  </td>
                </tr>
              ) : (
                paginatedGroups.map((group) => {
                  const isChecked = selectedGroups.includes(group.id);
                  // Count real scanned assets in this group
                  const realGroupAssets = assets.filter(
                    (a) => a.assetGroupId === group.id || a.host.endsWith(group.rootDomain)
                  );
                  const totalServices = Math.max(group.assetCount, realGroupAssets.length);

                  // Count matching CVEs in this group
                  const groupCveCount = cveAlerts.filter((alert) =>
                    realGroupAssets.some((a) => a.id === alert.matchedAssetId || a.host === alert.assetHost)
                  ).length;

                  return (
                    <tr
                      key={group.id}
                      onClick={() => onSelectGroup(group)}
                      className={`hover:bg-slate-50 dark:hover:bg-[#121727] cursor-pointer transition-colors group ${
                        isChecked ? 'bg-indigo-50/70 dark:bg-[#12182b]' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td
                        className="py-3.5 px-4 w-10"
                        onClick={(e) => handleToggleSelect(group.id, e)}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="w-3.5 h-3.5 rounded bg-slate-100 dark:bg-[#161c2d] border-slate-300 dark:border-[#29344e] text-indigo-600 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Group Name with checkmark & globe */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/30 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          </div>

                          <span className="font-bold text-slate-900 dark:text-white text-xs font-mono group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition">
                            {group.name}
                          </span>

                          <Globe className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400/80 shrink-0" />

                          {groupCveCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/40 font-mono">
                              {groupCveCount} CVE alerts
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Source */}
                      <td className="py-3.5 px-4">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#121626] border border-slate-200 dark:border-[#212a42] text-slate-700 dark:text-slate-300 text-[11px]">
                          <Search className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                          <span>Auto Discovery</span>
                        </div>
                      </td>

                      {/* Total Services */}
                      <td className="py-3.5 px-4 font-mono text-xs">
                        <strong className="text-slate-900 dark:text-white font-bold">{totalServices}</strong>{' '}
                        <span className="text-slate-500 dark:text-slate-400">services</span>
                      </td>

                      {/* Duration */}
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 font-mono text-xs">
                        {group.name.includes('caobang') ? '6m11s' : group.name.includes('phutho') ? '7m53s' : '8m5s'}
                      </td>

                      {/* Last Updated */}
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 text-xs">
                        1y ago
                      </td>

                      {/* Action column */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onSelectGroup(group)}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1b2238] transition"
                            title="Xem chi tiết nhóm"
                          >
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 group-hover:translate-x-0.5 transition-all" />
                          </button>
                          <button
                            type="button"
                            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1b2238] transition"
                          >
                            <MoreVertical className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
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

        {/* Foo Table Pagination */}
        <FooTablePagination
          currentPage={page}
          pageSize={pageSize}
          totalItems={filteredGroups.length}
          onPageChange={(p) => setPage(p)}
          onPageSizeChange={(s) => setPageSize(s)}
          pageSizeOptions={[10, 25, 50, 100]}
        />
      </div>
    </div>
  );
};
