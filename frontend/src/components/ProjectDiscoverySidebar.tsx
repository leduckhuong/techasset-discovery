import React, { useState } from 'react';
import {
  LayoutDashboard,
  ShieldAlert,
  Radar,
  Database,
  Layers,
  Clock,
  FileText,
  FileCode2,
  Settings,
  HelpCircle,
  Plus,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  FileSpreadsheet,
  Zap,
  FolderPlus,
  Check,
  Globe,
  Bot,
  BellRing,
  X,
  Sun,
  Moon,
} from 'lucide-react';
import { AssetGroup, Workspace } from '../types';

export type MainNavSection = 
  | 'dashboard'
  | 'cve-alerts'
  | 'scans'
  | 'inventory'
  | 'asset-groups'
  | 'crontab'
  | 'reports'
  | 'templates'
  | 'settings';

interface ProjectDiscoverySidebarProps {
  currentSection: MainNavSection;
  onSelectSection: (section: MainNavSection) => void;
  assetGroups: AssetGroup[];
  selectedGroupId?: string | null;
  onSelectGroup: (groupId: string) => void;
  onOpenImportCsv: () => void;
  onOpenCreateScan: () => void;
  onOpenCreateCron: () => void;
  onOpenBotWebhook?: () => void;
  inventoryCount: number;
  cronJobsCount: number;
  cveAlertsCount?: number;
  cveCriticalCount?: number;
  isOpen: boolean;
  onToggleOpen: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  theme?: 'dark' | 'light';
  workspaces?: Workspace[];
  currentWorkspaceId?: string | null;
  onSelectWorkspace?: (id: string) => void;
  onCreateWorkspace?: (name: string) => void;
  onToggleTheme?: () => void;
}

export const ProjectDiscoverySidebar: React.FC<ProjectDiscoverySidebarProps> = ({
  currentSection,
  onSelectSection,
  assetGroups,
  selectedGroupId,
  onSelectGroup,
  onOpenImportCsv,
  onOpenCreateScan,
  onOpenCreateCron,
  onOpenBotWebhook,
  inventoryCount,
  cronJobsCount,
  cveAlertsCount = 0,
  cveCriticalCount = 0,
  isOpen,
  onToggleOpen,
  isMobileOpen = false,
  onCloseMobile,
  theme = 'dark',
  onToggleTheme,
  workspaces = [],
  currentWorkspaceId = null,
  onSelectWorkspace = (_id: string) => {},
  onCreateWorkspace = (_name: string) => {},
}) => {
  const [createDropdownOpen, setCreateDropdownOpen] = useState(false);
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);

  const handleNavClick = (section: MainNavSection) => {
    onSelectSection(section);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <aside
      className={`
        bg-white dark:bg-[#090b10] border-r border-slate-200 dark:border-[#1e2333] transition-all duration-300 flex flex-col z-50 shrink-0 text-slate-700 dark:text-slate-300 select-none shadow-xl lg:shadow-none
        fixed inset-y-0 left-0 lg:static
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${isOpen ? 'w-64' : 'w-16'}
      `}
    >
      {/* Top Brand & Workspace Header */}
      <div className="p-3 border-b border-slate-200 dark:border-[#1b1f2d]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            {/* ProjectDiscovery Spiral Logo */}
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#6366f1] via-[#8b5cf6] to-[#ec4899] p-0.5 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-white dark:bg-[#090b10] rounded-full flex items-center justify-center">
                <div className="w-4 h-4 rounded-full border-2 border-indigo-500 dark:border-indigo-400 border-t-transparent animate-spin duration-3000" />
              </div>
            </div>
            {isOpen && (
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-slate-900 dark:text-white tracking-tight">ProjectDiscovery</span>
                  <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                    TECH
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Cloud Security Platform</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Mobile Close Button */}
            {onCloseMobile && (
              <button
                type="button"
                onClick={onCloseMobile}
                title="Đóng menu"
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#151928] lg:hidden transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Desktop Collapse/Expand Button */}
            <button
              type="button"
              onClick={onToggleOpen}
              title={isOpen ? 'Thu gọn thanh bên' : 'Mở rộng thanh bên'}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#151928] hidden lg:inline-flex transition-colors"
            >
              {isOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Workspace Selector */}
        {isOpen && (
          <div className="relative mt-3">
            <button
              type="button"
              onClick={() => setTeamDropdownOpen(!teamDropdownOpen)}
              className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-[#121624] dark:hover:bg-[#161c2e] border border-slate-200 dark:border-[#22283d] transition-colors text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[11px] font-bold shrink-0">
                  {(workspaces.find((w) => w.id === currentWorkspaceId)?.name || 'W').slice(0, 1).toUpperCase()}
                </div>
                <div className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {workspaces.find((w) => w.id === currentWorkspaceId)?.name || 'Workspace'}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
            </button>

            {teamDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-[#141828] border border-slate-200 dark:border-[#262c44] rounded-lg shadow-2xl p-1.5 z-40 text-xs">
                <div className="px-2 py-1 text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase">Workspaces</div>
                {workspaces.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => {
                      onSelectWorkspace(w.id);
                      setTeamDropdownOpen(false);
                    }}
                    className="w-full text-left p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer flex items-center justify-between"
                  >
                    <span className="truncate">{w.name}</span>
                    {w.id === currentWorkspaceId && <Check className="w-3.5 h-3.5 text-indigo-500" />}
                  </button>
                ))}
                <div className="border-t border-slate-200 dark:border-[#262c44] mt-1 pt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const name = window.prompt('Tên workspace mới:', `Workspace ${workspaces.length + 1}`);
                      if (name && name.trim()) {
                        onCreateWorkspace(name.trim());
                        setTeamDropdownOpen(false);
                      }
                    }}
                    className="w-full text-left p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer text-[11px]"
                  >
                    + Thêm mới workspace
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Primary + Create Dropdown */}
        <div className="relative mt-3">
          <button
            type="button"
            onClick={() => setCreateDropdownOpen(!createDropdownOpen)}
            className={`
              w-full py-2 px-3 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-sm
              bg-slate-100 hover:bg-slate-200 dark:bg-[#151928] dark:hover:bg-[#1d2338] text-slate-900 dark:text-white border border-slate-200 dark:border-[#2a324d]
              ${isOpen ? 'justify-between' : 'p-2 justify-center'}
            `}
          >
            <div className="flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              {isOpen && <span>Create</span>}
            </div>
            {isOpen && <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />}
          </button>

          {createDropdownOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-60 bg-white dark:bg-[#121626] border border-slate-200 dark:border-[#262d47] rounded-xl shadow-2xl p-1.5 z-50 text-xs animate-in fade-in-50 duration-150">
              <button
                type="button"
                onClick={() => {
                  setCreateDropdownOpen(false);
                  onOpenCreateScan();
                  if (onCloseMobile) onCloseMobile();
                }}
                className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1c2238] text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-colors text-left"
              >
                <div className="w-7 h-7 rounded bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-xs">New Tech Scan</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Quét nhanh mục tiêu URL</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCreateDropdownOpen(false);
                  onOpenImportCsv();
                  if (onCloseMobile) onCloseMobile();
                }}
                className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1c2238] text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-colors text-left"
              >
                <div className="w-7 h-7 rounded bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-xs text-emerald-700 dark:text-emerald-300">Import Subdomains (CSV)</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Nạp danh sách từ file CSV/TXT</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCreateDropdownOpen(false);
                  onOpenCreateCron();
                  if (onCloseMobile) onCloseMobile();
                }}
                className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1c2238] text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-colors text-left"
              >
                <div className="w-7 h-7 rounded bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-xs text-amber-700 dark:text-amber-300">New Crontab Scan</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Lên lịch quét tự động định kỳ</div>
                </div>
              </button>

              {onOpenBotWebhook && (
                <button
                  type="button"
                  onClick={() => {
                    setCreateDropdownOpen(false);
                    onOpenBotWebhook();
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1c2238] text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-colors text-left border-t border-slate-200 dark:border-[#21273e]"
                >
                  <div className="w-7 h-7 rounded bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-indigo-700 dark:text-indigo-300">Push CVE từ Bot</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Mô phỏng Webhook nạp mã CVE</div>
                  </div>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation Links (List) */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar text-xs">
        {/* Core Highlight: Agent CVE Matching */}
        <button
          type="button"
          onClick={() => handleNavClick('cve-alerts')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left relative ${
            currentSection === 'cve-alerts'
              ? 'bg-rose-50 text-rose-900 font-bold border border-rose-300 shadow-sm dark:bg-gradient-to-r dark:from-rose-950/70 dark:to-indigo-950/60 dark:text-white dark:border-rose-500/40 dark:shadow-lg'
              : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#141829]'
          }`}
        >
          <div className="relative shrink-0">
            <ShieldAlert className={`w-4 h-4 ${cveAlertsCount > 0 ? 'text-rose-500 dark:text-rose-400 animate-pulse' : 'text-slate-400'}`} />
            {cveCriticalCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            )}
          </div>
          {isOpen && (
            <div className="flex-1 flex items-center justify-between min-w-0">
              <span className="truncate font-medium">Cảnh Báo CVE (Agent)</span>
              {cveAlertsCount > 0 ? (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                  {cveAlertsCount}
                </span>
              ) : (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                  Clean
                </span>
              )}
            </div>
          )}
        </button>

        {/* Dashboard Overview */}
        <button
          type="button"
          onClick={() => handleNavClick('dashboard')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
            currentSection === 'dashboard'
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:border-transparent dark:bg-[#1a1f33] dark:text-white font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#111422]'
          }`}
        >
          <LayoutDashboard className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
          {isOpen && <span className="flex-1">Dashboard</span>}
        </button>

        <button
          type="button"
          onClick={() => handleNavClick('scans')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
            currentSection === 'scans'
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:border-transparent dark:bg-[#1a1f33] dark:text-white font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#111422]'
          }`}
        >
          <Radar className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
          {isOpen && <span className="flex-1">Scans</span>}
          {isOpen && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-700 dark:text-indigo-300">
              LIVE
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleNavClick('inventory')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
            currentSection === 'inventory'
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:border-transparent dark:bg-[#1a1f33] dark:text-white font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#111422]'
          }`}
        >
          <Database className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
          {isOpen && <span className="flex-1">Inventory</span>}
          {isOpen && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {inventoryCount > 0 ? inventoryCount : 637}
            </span>
          )}
        </button>

        {/* Asset Groups Item */}
        <button
          type="button"
          onClick={() => handleNavClick('asset-groups')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
            currentSection === 'asset-groups'
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:border-transparent dark:bg-[#1a1f33] dark:text-white font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#111422]'
          }`}
        >
          <Layers className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
          {isOpen && <span className="flex-1">Asset Groups</span>}
          {isOpen && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
              {assetGroups.length}
            </span>
          )}
        </button>

        {/* Secondary Category Section Divider */}
        <div className="pt-3 pb-1">
          <div className="h-px bg-slate-200 dark:bg-[#1a1f30] mx-2" />
        </div>

        {/* Crontab Scan Schedule Item (Key User Request) */}
        <button
          type="button"
          onClick={() => handleNavClick('crontab')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
            currentSection === 'crontab'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 font-bold dark:border-emerald-500/30'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#111422]'
          }`}
        >
          <Clock className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          {isOpen && <span className="flex-1">Crontab Scans</span>}
          {isOpen && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold">
              {cronJobsCount} CRON
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleNavClick('reports')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
            currentSection === 'reports'
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:border-transparent dark:bg-[#1a1f33] dark:text-white font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#111422]'
          }`}
        >
          <FileText className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
          {isOpen && <span className="flex-1">Reports</span>}
        </button>

        <button
          type="button"
          onClick={() => handleNavClick('templates')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
            currentSection === 'templates'
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:border-transparent dark:bg-[#1a1f33] dark:text-white font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#111422]'
          }`}
        >
          <FileCode2 className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
          {isOpen && <span className="flex-1">Templates</span>}
        </button>
      </div>

      {/* Footer Navigation (Settings & Theme toggle) */}
      <div className="p-2 border-t border-slate-200 dark:border-[#1b1f2d] space-y-1 text-xs">
        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#111422] transition-colors text-left"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 shrink-0 text-amber-500" />
                {isOpen && <span>Giao diện Sáng</span>}
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 shrink-0 text-indigo-600" />
                {isOpen && <span>Giao diện Tối</span>}
              </>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={() => handleNavClick('settings')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
            currentSection === 'settings'
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:border-transparent dark:bg-[#1a1f33] dark:text-white font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#111422]'
          }`}
        >
          <Settings className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
          {isOpen && <span>Settings</span>}
        </button>

        <a
          href="https://projectdiscovery.io"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#111422] transition-colors text-left"
        >
          <HelpCircle className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
          {isOpen && <span>Help & Docs</span>}
        </a>
      </div>
    </aside>
  );
};
