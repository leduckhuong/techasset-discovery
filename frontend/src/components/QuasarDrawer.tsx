import React from 'react';
import {
  Radar,
  Server,
  Cpu,
  Terminal,
  Code,
  Globe,
  Settings2,
  Sparkles,
  ExternalLink,
  Shield,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { TargetPreset } from '../types';

interface QuasarDrawerProps {
  isOpen: boolean;
  activeTab: 'scanner' | 'assets' | 'matrix' | 'terminal' | 'vue-code';
  onSelectTab: (tab: 'scanner' | 'assets' | 'matrix' | 'terminal' | 'vue-code') => void;
  presets: TargetPreset[];
  onLoadPreset: (preset: TargetPreset) => void;
  assetCount: number;
}

export const QuasarDrawer: React.FC<QuasarDrawerProps> = ({
  isOpen,
  activeTab,
  onSelectTab,
  presets,
  onLoadPreset,
  assetCount,
}) => {
  const navItems = [
    {
      id: 'scanner' as const,
      label: 'Quét Tech Asset',
      caption: 'Nhập URL & phân tích Tech',
      icon: Radar,
      badge: null,
    },
    {
      id: 'assets' as const,
      label: 'Tài sản Công nghệ',
      caption: 'Bảng dữ liệu & Headers',
      icon: Server,
      badge: assetCount > 0 ? assetCount : null,
      badgeColor: 'bg-[#1976D2]',
    },
    {
      id: 'matrix' as const,
      label: 'Ma trận Tech Stack',
      caption: 'Phân loại theo Framework / CDN',
      icon: Cpu,
      badge: null,
    },
    {
      id: 'terminal' as const,
      label: 'Scanner CLI Console',
      caption: 'Log quét thời gian thực',
      icon: Terminal,
      badge: 'LIVE',
      badgeColor: 'bg-[#21BA45]',
    },
    {
      id: 'vue-code' as const,
      label: 'Vue 3 Quasar Code',
      caption: 'Template SFC xuất bản',
      icon: Code,
      badge: 'SFC',
      badgeColor: 'bg-[#26A69A]',
    },
  ];

  return (
    <aside
      className={`
        bg-white border-r border-slate-200 transition-all duration-300 flex flex-col z-20 shrink-0
        ${isOpen ? 'w-64' : 'w-0 overflow-hidden border-none'}
      `}
    >
      {/* Drawer User / App Header Banner */}
      <div className="p-4 bg-gradient-to-br from-[#1976D2] to-[#1565C0] text-white">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded bg-white/20 flex items-center justify-center font-bold text-xs">
            Q2
          </div>
          <div>
            <div className="font-bold text-sm tracking-wide">Quasar v2.x</div>
            <div className="text-[11px] text-blue-100">Vue 3 Composition API</div>
          </div>
        </div>
        <div className="text-[11px] text-blue-100/90 mt-2 bg-black/15 p-2 rounded border border-white/10">
          Công cụ giám sát & phân tích tài sản số và tech stack đa nền tảng
        </div>
      </div>

      {/* Main Navigation Items (q-list) */}
      <div className="flex-1 overflow-y-auto py-2">
        <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          Điều hướng chính
        </div>

        <div className="space-y-0.5 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-item-${item.id}`}
                onClick={() => onSelectTab(item.id)}
                className={`
                  w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-all cursor-pointer group
                  ${isActive
                    ? 'bg-[#1976D2]/10 text-[#1976D2] font-semibold'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`
                      w-8 h-8 rounded-lg flex items-center justify-center transition-colors
                      ${isActive ? 'bg-[#1976D2] text-white' : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'}
                    `}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm leading-tight">{item.label}</div>
                    <div className="text-[11px] text-slate-400 font-normal leading-tight">
                      {item.caption}
                    </div>
                  </div>
                </div>

                {item.badge !== null && (
                  <span
                    className={`
                      text-[10px] font-bold px-1.5 py-0.5 rounded text-white
                      ${item.badgeColor || 'bg-slate-600'}
                    `}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Quick Presets Section */}
        <div className="mt-4 pt-3 border-t border-slate-100">
          <div className="px-3 py-1.5 flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <span>Mục tiêu mẫu (Presets)</span>
            <Sparkles className="w-3 h-3 text-amber-500" />
          </div>

          <div className="px-2 space-y-1">
            {presets.map((preset, idx) => (
              <button
                key={idx}
                id={`preset-btn-${idx}`}
                onClick={() => onLoadPreset(preset)}
                className="w-full text-left p-2 rounded text-xs text-slate-600 hover:bg-blue-50 hover:text-[#1976D2] transition group flex items-start justify-between cursor-pointer"
              >
                <div>
                  <div className="font-medium group-hover:text-[#1976D2]">{preset.name}</div>
                  <div className="text-[10px] text-slate-400">{preset.urls.length} tên miền</div>
                </div>
                <span className="text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 font-bold transition">
                  Nạp +
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer System Status Card */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#21BA45] inline-block" />
            <span className="font-semibold text-slate-700">Tech Discovery Engine</span>
          </span>
          <span className="font-mono text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-700">
            v2.0.0
          </span>
        </div>
        <div className="text-[10px] text-slate-400 flex items-center justify-between">
          <span>Quasar Material UI</span>
          <span className="text-[#1976D2] font-semibold">Active</span>
        </div>
      </div>
    </aside>
  );
};
