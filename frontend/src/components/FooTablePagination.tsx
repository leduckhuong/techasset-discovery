import React from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

interface FooTablePaginationProps {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newPageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export const FooTablePagination: React.FC<FooTablePaginationProps> = ({
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className = '',
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, totalItems);

  // Generate visible page numbers
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (safePage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (safePage >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', safePage - 1, safePage, safePage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <div
      className={`px-4 py-3 bg-slate-50 dark:bg-[#0a0d16] border-t border-slate-200 dark:border-[#1a2133] rounded-b-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400 select-none ${className}`}
    >
      {/* Left: Page Size Selector (Foo Table style) */}
      <div className="flex items-center gap-2">
        <div className="relative inline-block">
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
            className="appearance-none bg-white dark:bg-[#121626] hover:bg-slate-50 dark:hover:bg-[#181e33] border border-slate-200 dark:border-[#242d45] hover:border-slate-300 dark:hover:border-[#354266] text-slate-800 dark:text-slate-200 text-xs rounded-lg px-3 py-1.5 pr-8 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer font-medium transition"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size} per page
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Right: Showing Info & Navigation Arrows */}
      <div className="flex items-center gap-3">
        <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
          Showing <span className="text-slate-900 dark:text-slate-200 font-semibold">{startItem}</span> -{' '}
          <span className="text-slate-900 dark:text-slate-200 font-semibold">{endItem}</span> of{' '}
          <span className="text-slate-900 dark:text-slate-200 font-semibold">{totalItems}</span>
        </span>

        <div className="flex items-center gap-1">
          {/* Previous Page */}
          <button
            type="button"
            onClick={() => onPageChange(safePage - 1)}
            disabled={safePage <= 1}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-[#242d45] bg-white dark:bg-[#121626] hover:bg-slate-100 dark:hover:bg-[#1a2138] hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-white dark:disabled:hover:bg-[#121626] disabled:hover:text-slate-400 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 transition cursor-pointer"
            title="Trang trước"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* Page numbers */}
          {getPageNumbers().map((p, idx) => {
            if (p === '...') {
              return (
                <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 dark:text-slate-500 font-mono">
                  ...
                </span>
              );
            }
            const isCurrent = p === safePage;
            return (
              <button
                key={`page-${p}`}
                type="button"
                onClick={() => onPageChange(Number(p))}
                className={`min-w-7 h-7 px-2 rounded-lg text-xs font-mono font-medium transition flex items-center justify-center cursor-pointer ${
                  isCurrent
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-black font-bold shadow-xs'
                    : 'bg-white dark:bg-[#121626] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#242d45] hover:bg-slate-100 dark:hover:bg-[#1a2138] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {p}
              </button>
            );
          })}

          {/* Next Page */}
          <button
            type="button"
            onClick={() => onPageChange(safePage + 1)}
            disabled={safePage >= totalPages}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-[#242d45] bg-white dark:bg-[#121626] hover:bg-slate-100 dark:hover:bg-[#1a2138] hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-white dark:disabled:hover:bg-[#121626] disabled:hover:text-slate-400 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 transition cursor-pointer"
            title="Trang sau"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
