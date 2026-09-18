/**
 * FacetTabs — dải tab phân loại kiểu ProjectDiscovery Cloud:
 *  [All Services] [Technologies] [Ports] [Labels] [Domains] [More ▾]
 * Chọn 1 tab -> hiện danh sách giá trị (kèm icon + "N Services" + chip phân loại),
 * click 1 giá trị để lọc bảng theo giá trị đó; "Tất cả" để bỏ lọc.
 */
import React, { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface FacetTabDef<T> {
  key: string;
  label: string;
  /** Trả về giá trị facet của row (mảng = 1 row thuộc nhiều giá trị) */
  getValues: (item: T) => (string | number | null | undefined)[] | string | number | null | undefined;
  /** Chip phân loại cho 1 giá trị (VD: category của technology) */
  getCategory?: (value: string) => string | undefined;
  /** Màu dot cho 1 giá trị */
  getColor?: (value: string) => string | undefined;
}

interface FacetTabsProps<T> {
  rows: T[];
  tabs: FacetTabDef<T>[];
  activeTabKey: string | null;
  activeValue: string | null;
  onSelect: (tabKey: string | null, value: string | null) => void;
  totalRows: number;
  /** Số tab hiển thị trực tiếp, phần còn lại nằm trong "More" */
  maxVisible?: number;
}

function facetList<T>(rows: T[], tab: FacetTabDef<T>): { value: string; count: number; category?: string; color?: string }[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const out = tab.getValues(row);
    const list = Array.isArray(out) ? out : [out];
    const seen = new Set<string>();
    for (const raw of list) {
      if (raw === null || raw === undefined) continue;
      const v = String(raw).trim();
      if (!v || seen.has(v)) continue;
      seen.add(v);
      counts.set(v, (counts.get(v) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([value, count]) => ({
      value,
      count,
      category: tab.getCategory?.(value),
      color: tab.getColor?.(value),
    }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export function FacetTabs<T>({ rows, tabs, activeTabKey, activeValue, onSelect, totalRows, maxVisible = 4 }: FacetTabsProps<T>) {
  const [moreOpen, setMoreOpen] = useState(false);

  const visible = tabs.slice(0, maxVisible);
  const hidden = tabs.slice(maxVisible);
  const activeTab = tabs.find((t) => t.key === activeTabKey) || null;
  const hiddenContainsActive = hidden.some((t) => t.key === activeTabKey);

  const valueList = useMemo(
    () => (activeTab ? facetList(rows, activeTab) : []),
    [rows, activeTab]
  );

  const tabBtnClass = (selected: boolean) =>
    `px-3 py-1.5 rounded-t-md text-xs font-semibold transition cursor-pointer border-b-2 whitespace-nowrap ${
      selected
        ? 'border-[#1976D2] text-[#1976D2] dark:text-indigo-300 bg-white dark:bg-[#10162a]'
        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-[#141b2e]'
    }`;

  return (
    <div>
      {/* Tab row */}
      <div className="flex items-center justify-between flex-wrap gap-2 border-t border-slate-200/60 dark:border-[#1d253a] pt-2">
        <div role="tablist" className="flex items-center gap-1 flex-wrap">
          <button type="button" role="tab" aria-selected={activeTabKey === null} onClick={() => onSelect(null, null)} className={tabBtnClass(activeTabKey === null)}>
            All Services
          </button>
          {visible.map((tab) => (
            <button key={tab.key} type="button" role="tab" aria-selected={activeTabKey === tab.key} onClick={() => onSelect(tab.key, activeTabKey === tab.key ? activeValue : null)} className={tabBtnClass(activeTabKey === tab.key)}>
              {tab.label}
            </button>
          ))}
          {hidden.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                className={`px-3 py-1.5 rounded-t-md text-xs font-semibold transition cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                  hiddenContainsActive || moreOpen
                    ? 'border-b-2 border-[#1976D2] text-[#1976D2] dark:text-indigo-300 bg-white dark:bg-[#10162a]'
                    : 'border-b-2 border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100'
                }`}
              >
                More
                <ChevronDown className={`w-3 h-3 transition ${moreOpen ? 'rotate-180' : ''}`} />
              </button>
              {moreOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMoreOpen(false)} />
                  <div className="absolute z-40 right-0 top-full mt-1 w-44 rounded-lg border border-slate-200 dark:border-[#27314f] bg-white dark:bg-[#141828] shadow-xl py-1">
                    {hidden.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => {
                          setMoreOpen(false);
                          onSelect(tab.key, null);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 dark:hover:bg-[#1f263d] text-xs text-slate-700 dark:text-slate-200 transition cursor-pointer"
                      >
                        {tab.label}
                        {activeTabKey === tab.key && <span className="text-emerald-500">✓</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">{totalRows} services</span>
      </div>

    </div>
  );
}
