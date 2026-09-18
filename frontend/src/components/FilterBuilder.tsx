/**
 * FilterBuilder — bộ lọc kiểu ProjectDiscovery Cloud:
 *  "Add Filters" -> menu chọn trường -> panel giá trị dạng checklist kèm số lượng
 *  -> Apply -> chip filter có nút xóa.
 * Cùng trường: nhiều giá trị = OR; khác trường: AND.
 */
import React, { useMemo, useRef, useState } from 'react';
import { Filter, X, ChevronRight, Search } from 'lucide-react';

export interface FilterFieldDef<T> {
  key: string;
  label: string;
  /** Trả về 1 hoặc nhiều giá trị facet của row (null/undefined = bỏ qua) */
  getValues: (item: T) => string | number | null | undefined | (string | number | null | undefined)[];
}

export interface ActiveFilter {
  key: string;
  label: string;
  values: string[];
}

function normalize(v: string | number | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

/** Đếm facet cho từng trường từ rows */
function facetCounts<T>(rows: T[], field: FilterFieldDef<T>): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const out = field.getValues(row);
    const list = Array.isArray(out) ? out : [out];
    const seen = new Set<string>();
    for (const raw of list) {
      const v = normalize(raw);
      if (v === null || seen.has(v)) continue;
      seen.add(v);
      counts.set(v, (counts.get(v) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** Row có khớp toàn bộ active filters không (trong cùng trường: OR; khác trường: AND) */
export function matchesFilters<T>(item: T, filters: ActiveFilter[], fields: FilterFieldDef<T>[]): boolean {
  for (const f of filters) {
    const field = fields.find((fd) => fd.key === f.key);
    if (!field || f.values.length === 0) continue;
    const out = field.getValues(item);
    const list = (Array.isArray(out) ? out : [out])
      .map((v) => normalize(v)?.toLowerCase())
      .filter((v): v is string => v !== null);
    const wanted = f.values.map((v) => v.toLowerCase());
    if (!wanted.some((w) => list.includes(w))) return false;
  }
  return true;
}

interface FilterBuilderProps<T> {
  rows: T[];
  fields: FilterFieldDef<T>[];
  filters: ActiveFilter[];
  onChange: (filters: ActiveFilter[]) => void;
}

export function FilterBuilder<T>({ rows, fields, filters, onChange }: FilterBuilderProps<T>) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [panelField, setPanelField] = useState<FilterFieldDef<T> | null>(null);
  const [valueQuery, setValueQuery] = useState('');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  const facets = useMemo(
    () => (panelField ? facetCounts(rows, panelField) : []),
    [rows, panelField]
  );
  const visibleFacets = useMemo(() => {
    const q = valueQuery.trim().toLowerCase();
    if (!q) return facets;
    return facets.filter((f) => f.value.toLowerCase().includes(q));
  }, [facets, valueQuery]);

  const openField = (field: FilterFieldDef<T>) => {
    setPanelField(field);
    setValueQuery('');
    const existing = filters.find((f) => f.key === field.key);
    setChecked(new Set(existing ? existing.values : []));
  };

  const apply = () => {
    if (!panelField) return;
    const values = [...checked];
    const others = filters.filter((f) => f.key !== panelField.key);
    onChange(values.length > 0 ? [...others, { key: panelField.key, label: panelField.label, values }] : others);
    setPanelField(null);
    setMenuOpen(false);
  };

  const removeFilter = (key: string) => {
    onChange(filters.filter((f) => f.key !== key));
  };

  const closeAll = () => {
    setMenuOpen(false);
    setPanelField(null);
  };

  return (
    <div className="relative flex items-center gap-1.5 flex-wrap" ref={containerRef}>
      {/* Nút Add Filters */}
      <button
        type="button"
        id="btn-add-filters"
        onClick={() => {
          if (menuOpen) closeAll();
          else {
            setPanelField(null);
            setMenuOpen(true);
          }
        }}
        className="px-3 py-1.5 rounded bg-white dark:bg-[#14192a] border border-slate-300 dark:border-[#27314f] text-slate-700 dark:text-slate-200 hover:border-[#1976D2] hover:text-[#1976D2] dark:hover:border-indigo-400 dark:hover:text-indigo-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shrink-0"
      >
        <Filter className="w-3.5 h-3.5" />
        Add Filters
      </button>

      {/* Active filter chips */}
      {filters.map((f) => (
        <span
          key={f.key}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#1976D2]/10 dark:bg-indigo-500/15 border border-[#1976D2]/30 dark:border-indigo-500/30 text-[11px] font-medium text-[#1976D2] dark:text-indigo-300 max-w-[280px]"
          title={`${f.label}: ${f.values.join(', ')}`}
        >
          <span className="text-slate-500 dark:text-slate-400">{f.label}:</span>
          <span className="font-semibold truncate">{f.values.join(', ')}</span>
          <button
            type="button"
            onClick={() => removeFilter(f.key)}
            className="hover:text-red-500 cursor-pointer"
            title="Xóa filter"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}

      {menuOpen && (
        <>
          {/* backdrop để đóng khi click ra ngoài */}
          <div className="fixed inset-0 z-30" onClick={closeAll} />
          {/* Menu danh sách trường */}
          {!panelField && (
            <div className="absolute z-40 left-0 top-full mt-1 w-56 max-h-96 overflow-y-auto rounded-lg border border-slate-200 dark:border-[#27314f] bg-white dark:bg-[#141828] shadow-xl py-1 custom-scrollbar">
              {fields.map((field) => {
                const active = filters.find((f) => f.key === field.key);
                return (
                  <button
                    key={field.key}
                    type="button"
                    onClick={() => openField(field)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 dark:hover:bg-[#1f263d] text-xs text-slate-700 dark:text-slate-200 transition cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      {field.label}
                      {active && (
                        <span className="text-[10px] px-1.5 rounded bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300">
                          {active.values.length}
                        </span>
                      )}
                    </span>
                    <ChevronRight className="w-3 h-3 text-slate-400" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Panel chọn giá trị (checklist + count) */}
          {panelField && (
            <div className="absolute z-40 left-0 top-full mt-1 w-72 rounded-lg border border-slate-200 dark:border-[#27314f] bg-white dark:bg-[#141828] shadow-xl p-2">
              <div className="relative mb-1.5">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  autoFocus
                  value={valueQuery}
                  onChange={(e) => setValueQuery(e.target.value)}
                  placeholder={`Tìm giá trị ${panelField.label}...`}
                  className="w-full pl-7 pr-2 py-1.5 text-xs bg-slate-50 dark:bg-[#0e1220] border border-slate-300 dark:border-[#27314f] rounded focus:outline-none focus:border-[#1976D2] text-slate-800 dark:text-slate-100"
                />
              </div>
              <div className="max-h-64 overflow-y-auto custom-scrollbar">
                {visibleFacets.length === 0 ? (
                  <div className="py-4 text-center text-xs text-slate-400 italic">Không có giá trị nào</div>
                ) : (
                  visibleFacets.map(({ value, count }) => (
                    <label
                      key={value}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 dark:hover:bg-[#1f263d] cursor-pointer text-xs text-slate-700 dark:text-slate-200"
                    >
                      <input
                        type="checkbox"
                        checked={checked.has(value)}
                        onChange={() => {
                          const next = new Set(checked);
                          if (next.has(value)) next.delete(value);
                          else next.add(value);
                          setChecked(next);
                        }}
                        className="rounded text-[#1976D2] focus:ring-[#1976D2]"
                      />
                      <span className="truncate flex-1 font-mono" title={value}>{value}</span>
                      <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-[#1d2438] px-1.5 rounded-full">{count}</span>
                    </label>
                  ))
                )}
              </div>
              <div className="flex justify-end items-center gap-1.5 pt-2 mt-1 border-t border-slate-200 dark:border-[#27314f]">
                <button
                  type="button"
                  onClick={closeAll}
                  className="px-2.5 py-1 text-[11px] rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1d2438] transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={apply}
                  disabled={checked.size === 0}
                  className="px-3 py-1 text-[11px] rounded bg-[#1976D2] hover:bg-[#1565C0] disabled:opacity-40 text-white font-semibold transition cursor-pointer"
                >
                  Apply ({checked.size})
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
