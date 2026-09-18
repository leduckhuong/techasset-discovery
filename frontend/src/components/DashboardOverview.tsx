import React from 'react';
import {
  ShieldAlert,
  Server,
  Layers,
  Clock,
  Lock,
  Globe,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';
import { ScanResult, AssetGroup } from '../types';

interface DashboardOverviewProps {
  assets: ScanResult[];
  assetGroups: AssetGroup[];
  onNavigateToGroup: (groupId: string) => void;
  onOpenImportCsv: () => void;
  onNavigateToCron: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  assets = [],
  assetGroups = [],
  onNavigateToGroup,
  onOpenImportCsv,
  onNavigateToCron,
}) => {
  const totalAssets = assets.length;
  const activeAssets = assets.filter((a) => a.statusCode === 200).length;
  const redirectAssets = assets.filter((a) => a.statusCode >= 300 && a.statusCode < 400).length;
  const expiredSsl = assets.filter((a) => a.ssl?.expiredAgoDays).length;

  // Tech frequency map
  const techMap = new Map<string, number>();
  assets.forEach((a) => {
    a.technologies.forEach((t) => {
      techMap.set(t.name, (techMap.get(t.name) || 0) + 1);
    });
  });

  const topTechs = Array.from(techMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-[#101320] border border-slate-200 dark:border-[#22283d] rounded-xl p-4 sm:p-6 relative overflow-hidden shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-xs font-mono font-semibold border border-indigo-200 dark:border-indigo-500/30">
                ATTACK SURFACE MONITORING
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">Team: leduckhuong2002's Team</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Tổng quan Giám sát Bề mặt Tấn công & Tài sản Số</h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
              Hệ thống theo dõi toàn diện các nhóm tên miền, phát hiện tự động tech stack, kiểm tra trạng thái dịch vụ và cảnh báo chứng chỉ SSL hết hạn.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onOpenImportCsv}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              + Import Subdomains (CSV)
            </button>
            <button
              onClick={onNavigateToCron}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-[#191f32] dark:hover:bg-[#232b45] dark:text-slate-200 border border-slate-200 dark:border-[#2b3552] text-xs font-medium transition-all cursor-pointer"
            >
              Quản lý Crontab
            </button>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-200 dark:border-[#1e2335]">
          <div className="bg-slate-50 dark:bg-[#0b0e17] p-4 rounded-xl border border-slate-200 dark:border-[#1e2335]">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
              <span>Tổng tài sản Subdomains</span>
              <Server className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-mono">{totalAssets}</div>
            <div className="text-[11px] text-indigo-600 dark:text-indigo-400 flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3" /> Đã nhận diện tech stack
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-[#0b0e17] p-4 rounded-xl border border-slate-200 dark:border-[#1e2335]">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
              <span>Dịch vụ Hoạt động (200 OK)</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">{activeAssets}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {Math.round((activeAssets / (totalAssets || 1)) * 100)}% tỷ lệ online
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-[#0b0e17] p-4 rounded-xl border border-slate-200 dark:border-[#1e2335]">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
              <span>Chuyển hướng (30x Redirect)</span>
              <ArrowUpRight className="w-4 h-4 text-sky-500 dark:text-sky-400" />
            </div>
            <div className="text-2xl font-bold text-sky-600 dark:text-sky-400 mt-1 font-mono">{redirectAssets}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Cổng điều hướng / Auth portal</div>
          </div>

          <div className="bg-slate-50 dark:bg-[#0b0e17] p-4 rounded-xl border border-slate-200 dark:border-[#1e2335]">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
              <span>Cảnh báo SSL Hết hạn</span>
              <Lock className="w-4 h-4 text-rose-500 dark:text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1 font-mono">{expiredSsl}</div>
            <div className="text-[11px] text-rose-600 dark:text-rose-400/80 mt-1 font-medium">Cần gia hạn chứng chỉ ngay</div>
          </div>
        </div>
      </div>

      {/* Grid: Asset Groups & Top Technologies */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Asset Groups List (2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-[#101320] border border-slate-200 dark:border-[#22283d] rounded-xl p-4 sm:p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Nhóm Tài sản Số (Asset Groups)
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">{assetGroups.length} nhóm</span>
          </div>

          <div className="space-y-3">
            {assetGroups.map((group) => (
              <div
                key={group.id}
                onClick={() => onNavigateToGroup(group.id)}
                className="bg-slate-50 hover:bg-slate-100 dark:bg-[#0b0e17] dark:hover:bg-[#151928] border border-slate-200 dark:border-[#1e2335] hover:border-indigo-400 dark:hover:border-indigo-500/40 p-4 rounded-xl cursor-pointer transition-all flex items-center justify-between group"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-300 font-mono transition-colors">
                      {group.name}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30">
                      {group.rootDomain}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{group.description}</p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-900 dark:text-white font-mono">{group.assetCount}</div>
                    <div className="text-[10px] text-slate-500">tài sản</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-200/70 text-slate-600 group-hover:text-white group-hover:bg-indigo-600 dark:bg-slate-800/60 dark:text-slate-400 dark:group-hover:text-white dark:group-hover:bg-indigo-600 transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Top Techs */}
        <div className="bg-white dark:bg-[#101320] border border-slate-200 dark:border-[#22283d] rounded-xl p-4 sm:p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Công nghệ Thịnh hành (Top Techs)
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">{techMap.size} loại</span>
          </div>

          <div className="space-y-2.5">
            {topTechs.map(([techName, count], idx) => {
              const percent = Math.round((count / (totalAssets || 1)) * 100);
              return (
                <div key={idx} className="bg-slate-50 dark:bg-[#0b0e17] p-3 rounded-lg border border-slate-200 dark:border-[#1e2335]">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{techName}</span>
                    <span className="font-mono text-slate-500 dark:text-slate-400">
                      {count} ({percent}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-[#1b2033] h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
