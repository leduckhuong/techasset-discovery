import React from 'react';
import { Menu, Terminal, Code2, ShieldCheck, RefreshCw, Layers } from 'lucide-react';
import { QBtn, QBadge } from './QuasarUiElements';

interface QuasarHeaderProps {
  drawerOpen: boolean;
  onToggleDrawer: () => void;
  onOpenVueCode: () => void;
  onOpenTerminal: () => void;
  assetCount: number;
  scanning: boolean;
  onRefreshAll: () => void;
}

export const QuasarHeader: React.FC<QuasarHeaderProps> = ({
  drawerOpen,
  onToggleDrawer,
  onOpenVueCode,
  onOpenTerminal,
  assetCount,
  scanning,
  onRefreshAll,
}) => {
  return (
    <header className="bg-[#1976D2] text-white sticky top-0 z-30 q-shadow-2 select-none">
      <div className="h-14 px-3 sm:px-4 flex items-center justify-between">
        {/* Left: Drawer Toggle & Brand */}
        <div className="flex items-center gap-3">
          <button
            id="btn-toggle-drawer"
            onClick={onToggleDrawer}
            className="p-2 rounded-full hover:bg-white/15 active:bg-white/25 transition-colors cursor-pointer"
            title={drawerOpen ? 'Đóng menu' : 'Mở menu'}
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Quasar Logo Style Badge */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm text-[#1976D2]">
              {/* Quasar geometric polygon icon representation */}
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.5-1.25L12 8.5l-2.5 1.25L12 11zm0 2.8L4.5 9.8 2 11l10 5 10-5-2.5-1.2-7.5 4zM2 16l10 5 10-5-2.5-1.2-7.5 4-7.5-4L2 16z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight">TechAsset</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-white/20 text-white">
                  Quasar UI
                </span>
                {scanning && (
                  <span className="flex items-center gap-1 text-[11px] bg-[#21BA45] text-white px-2 py-0.5 rounded-full animate-pulse">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                    Đang quét...
                  </span>
                )}
              </div>
              <p className="text-[11px] text-blue-100 hidden sm:block">
                ProjectDiscovery Multi-Tool Technology Fingerprinting Engine
              </p>
            </div>
          </div>
        </div>

        {/* Right: Actions & Tools */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Asset Counter Pill */}
          <div className="hidden md:flex items-center gap-1.5 bg-white/15 px-2.5 py-1 rounded-full text-xs">
            <Layers className="w-3.5 h-3.5 text-blue-200" />
            <span>Tài sản:</span>
            <span className="font-bold text-white bg-white/20 px-1.5 rounded-full">{assetCount}</span>
          </div>

          {/* Quick Terminal Button */}
          <button
            id="btn-open-terminal"
            onClick={onOpenTerminal}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded bg-white/10 hover:bg-white/20 transition cursor-pointer"
            title="Mở Terminal CLI"
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-300" />
            <span className="hidden sm:inline">Scanner CLI</span>
          </button>

          {/* Vue Quasar Code Preview Button */}
          <button
            id="btn-open-vue-code"
            onClick={onOpenVueCode}
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded bg-[#26A69A] hover:bg-[#00897B] text-white transition q-shadow-1 cursor-pointer"
            title="Xem mã nguồn Vue 3 Quasar Component"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Vue 3 SFC Code</span>
          </button>

          {/* Refresh Action */}
          <button
            id="btn-refresh-all"
            onClick={onRefreshAll}
            disabled={scanning}
            className="p-2 rounded hover:bg-white/15 active:bg-white/25 transition cursor-pointer text-white disabled:opacity-40"
            title="Làm mới trạng thái"
          >
            <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
};
