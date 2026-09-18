import React, { useState } from 'react';
import {
  ShieldAlert,
  Bot,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronRight,
  Filter,
  Send,
  Zap,
  Server,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  BellRing,
  HelpCircle,
} from 'lucide-react';
import { CveMatchAlert, CveItem, ScanResult } from '../types';

interface CveAlertsAgentViewProps {
  alerts?: CveMatchAlert[];
  cveAlerts?: CveMatchAlert[];
  cves?: CveItem[];
  assets?: ScanResult[];
  onOpenBotWebhook?: () => void;
  onOpenBotWebhookModal?: () => void;
  onRunAgentRecheck?: () => void;
  onRunAgentMatching?: () => void;
  onUpdateAlertStatus: (alertId: string, status: 'active' | 'investigating' | 'resolved') => void;
  onSelectAsset: (asset: ScanResult) => void;
  isAgentRunning?: boolean;
}

export const CveAlertsAgentView: React.FC<CveAlertsAgentViewProps> = ({
  alerts: rawAlerts,
  cveAlerts: rawCveAlerts,
  cves = [],
  assets = [],
  onOpenBotWebhook,
  onOpenBotWebhookModal,
  onRunAgentRecheck,
  onRunAgentMatching,
  onUpdateAlertStatus,
  onSelectAsset,
  isAgentRunning = false,
}) => {
  const alerts = rawAlerts || rawCveAlerts || [];
  const handleOpenBot = onOpenBotWebhook || onOpenBotWebhookModal || (() => {});
  const handleRecheck = onRunAgentRecheck || onRunAgentMatching || (() => {});
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'active' | 'investigating' | 'resolved'>('ALL');
  const [selectedAlertForModal, setSelectedAlertForModal] = useState<CveMatchAlert | null>(null);

  // Filter alerts
  const filteredAlerts = alerts.filter((alert) => {
    const matchesSearch =
      alert.cveId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.assetHost.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.software.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.cveTitle.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSeverity = severityFilter === 'ALL' || alert.severity === severityFilter;
    const matchesStatus = statusFilter === 'ALL' || alert.status === statusFilter;

    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const criticalCount = alerts.filter((a) => a.severity === 'CRITICAL' && a.status !== 'resolved').length;
  const highCount = alerts.filter((a) => a.severity === 'HIGH' && a.status !== 'resolved').length;
  const activeCount = alerts.filter((a) => a.status === 'active').length;
  const uniqueImpactedHosts = new Set(alerts.filter((a) => a.status !== 'resolved').map((a) => a.assetHost)).size;

  const getSeverityBadge = (sev: string, score?: number) => {
    switch (sev.toUpperCase()) {
      case 'CRITICAL':
        return (
          <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
            CRITICAL {score ? `(${score})` : ''}
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            HIGH {score ? `(${score})` : ''}
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
            MEDIUM
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-500/20 text-slate-300 border border-slate-500/30">
            LOW
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Agent Status Header Banner */}
      <div className="bg-gradient-to-r from-indigo-50 via-slate-50 to-indigo-50 dark:from-[#121629] dark:via-[#161a33] dark:to-[#121629] border border-indigo-200 dark:border-indigo-500/30 rounded-2xl p-6 shadow-xs dark:shadow-xl relative overflow-hidden transition-colors">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 border border-indigo-300 dark:border-indigo-500/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-xs">
                <Bot className="w-5 h-5 animate-pulse" />
              </div>
              <span className="text-xs font-mono font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30">
                In-App Correlation Agent
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Giám sát & So khớp Thời gian thực</span>
            </div>

            <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Agent Cảnh Báo Trùng Khớp CVE & Tech Asset
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              Agent cắm sẵn trong ứng dụng liên tục đối chiếu danh mục tài sản đã quét nhận diện với các mã CVE được
              bot bảo mật đẩy về qua Webhook. Khi phát hiện asset chạy công nghệ trùng với dải phiên bản bị lỗi, hệ
              thống tự động kích hoạt cảnh báo tức thì.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleOpenBot}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Cổng Bot Webhook (Push CVE)</span>
            </button>

            <button
              onClick={handleRecheck}
              disabled={isAgentRunning}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 dark:bg-[#1c2238] dark:hover:bg-[#252d4a] text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-[#2d3654] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 ${isAgentRunning ? 'animate-spin' : ''}`} />
              <span>{isAgentRunning ? 'Agent đang quét...' : 'Chạy Lại Agent'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#0f1320] border border-slate-200 dark:border-[#1d2438] rounded-xl p-4 flex items-center justify-between shadow-xs dark:shadow-none">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cảnh Báo Trùng Khớp</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{alerts.length}</div>
            <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1 font-medium">
              <AlertTriangle className="w-3 h-3" /> {activeCount} cảnh báo đang chờ xử lý
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 dark:text-amber-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#0f1320] border border-slate-200 dark:border-[#1d2438] rounded-xl p-4 flex items-center justify-between shadow-xs dark:shadow-none">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mức Critical / Nguy Hiểm</div>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{criticalCount}</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              +{highCount} mức High cần vá sớm
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 dark:text-rose-400">
            <Zap className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#0f1320] border border-slate-200 dark:border-[#1d2438] rounded-xl p-4 flex items-center justify-between shadow-xs dark:shadow-none">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tài Sản Bị Ảnh Hưởng</div>
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-300 mt-1">{uniqueImpactedHosts}</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              trên tổng số {assets.length} tài sản lưu trữ
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Server className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#0f1320] border border-slate-200 dark:border-[#1d2438] rounded-xl p-4 flex items-center justify-between shadow-xs dark:shadow-none">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mã CVE Đã Đẩy Vào</div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{cves.length}</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              từ Bot Telegram / Webhook
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Bot className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="bg-slate-50 dark:bg-[#0e121d] border border-slate-200 dark:border-[#1c2234] rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo mã CVE, tên phần mềm, hoặc tên miền..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-[#141828] border border-slate-300 dark:border-[#232a42] rounded-lg text-xs text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Severity Filters */}
          <div className="flex items-center gap-1 bg-white dark:bg-[#141828] p-1 rounded-lg border border-slate-200 dark:border-[#232a42] text-xs">
            <span className="text-[10px] font-semibold text-slate-500 px-1.5">Mức độ:</span>
            {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'] as const).map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                  severityFilter === sev
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-white dark:bg-[#141828] p-1 rounded-lg border border-slate-200 dark:border-[#232a42] text-xs">
            <span className="text-[10px] font-semibold text-slate-500 px-1.5">Trạng thái:</span>
            {(['ALL', 'active', 'investigating', 'resolved'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold capitalize transition-colors cursor-pointer ${
                  statusFilter === st
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {st === 'ALL' ? 'Tất cả' : st === 'active' ? 'Chưa xử lý' : st === 'investigating' ? 'Đang điều tra' : 'Đã vá'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Alert List Table */}
      <div className="bg-white dark:bg-[#0d101a] border border-slate-200 dark:border-[#1b2133] rounded-xl overflow-hidden shadow-xs dark:shadow-xl">
        <div className="p-4 border-b border-slate-200 dark:border-[#1b2133] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-500 dark:text-rose-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Danh Sách Cảnh Báo CVE Được Agent Phát Hiện</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">({filteredAlerts.length} mục)</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Tự động cập nhật khi có CVE mới hoặc hoàn tất lượt quét tech
          </div>
        </div>

        {filteredAlerts.length === 0 ? (
          <div className="p-12 text-center">
            <ShieldCheck className="w-12 h-12 text-emerald-500 dark:text-emerald-400 mx-auto opacity-70 mb-3" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Không có cảnh báo nào khớp với bộ lọc</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              Tất cả tài sản đã quét hiện an toàn trước các mã CVE được chỉ định, hoặc bạn có thể điều chỉnh lại tiêu chí lọc.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-[#171d2e]">
            {filteredAlerts.map((alert) => {
              const matchedAsset = assets.find((a) => a.id === alert.matchedAssetId || a.host === alert.assetHost);

              return (
                <div
                  key={alert.id}
                  className="p-4 hover:bg-slate-50 dark:hover:bg-[#111624] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* Left Column: CVE & Severity */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {getSeverityBadge(alert.severity, alert.cvssScore)}
                      <span className="font-mono text-sm font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors">
                        {alert.cveId}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">|</span>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Phần mềm: <span className="text-amber-600 dark:text-amber-300 font-mono">{alert.software}</span>
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20 font-mono">
                        Dải ảnh hưởng: {alert.affectedVersions}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                      {alert.cveTitle}
                    </div>

                    {/* Affected Asset info & Detected Version */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-[#161c2e] border border-slate-200 dark:border-[#232b45] text-xs">
                        <Server className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                        <span className="text-slate-500 dark:text-slate-400">Host:</span>
                        <a
                          href={alert.assetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono font-bold text-indigo-600 dark:text-indigo-300 hover:underline flex items-center gap-1"
                        >
                          {alert.assetHost}
                          <ArrowUpRight className="w-3 h-3 text-slate-400" />
                        </a>
                      </div>

                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-50 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-800/40 text-xs">
                        <span className="w-2 h-2 rounded-full bg-rose-500 dark:bg-rose-400" />
                        <span className="text-rose-700 dark:text-rose-200">Phiên bản phát hiện:</span>
                        <span className="font-mono font-bold text-rose-800 dark:text-rose-300">{alert.detectedVersion}</span>
                      </div>

                      <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        Phát hiện lúc {new Date(alert.detectedAt).toLocaleTimeString('vi-VN')} {new Date(alert.detectedAt).toLocaleDateString('vi-VN')}
                      </span>
                    </div>

                    {/* Remediation Note */}
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-400/90 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 rounded-lg px-3 py-1.5 flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <span><strong>Khắc phục:</strong> {alert.remediation}</span>
                    </div>
                  </div>

                  {/* Right Column: Status & Action Buttons */}
                  <div className="flex flex-row md:flex-col items-end justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">Trạng thái:</span>
                      <select
                        value={alert.status}
                        onChange={(e) => onUpdateAlertStatus(alert.id, e.target.value as any)}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-md border focus:outline-none cursor-pointer ${
                          alert.status === 'active'
                            ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-500/20 dark:border-rose-500/40 dark:text-rose-300'
                            : alert.status === 'investigating'
                            ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:border-amber-500/40 dark:text-amber-300'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:border-emerald-500/40 dark:text-emerald-300'
                        }`}
                      >
                        <option value="active">Chưa xử lý (Active)</option>
                        <option value="investigating">Đang điều tra (Investigating)</option>
                        <option value="resolved">Đã khắc phục (Resolved)</option>
                      </select>
                    </div>

                    {matchedAsset && (
                      <button
                        onClick={() => onSelectAsset(matchedAsset)}
                        className="px-3 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-[#1a2136] dark:hover:bg-[#232c47] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-[#2b3656] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Server className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
                        <span>Xem Tech Asset</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Knowledge Note: How the Bot & Agent Workflow Functions */}
      <div className="bg-slate-50 dark:bg-[#0b0e17] border border-slate-200 dark:border-[#1a2030] rounded-xl p-4 text-xs text-slate-600 dark:text-slate-400 space-y-2">
        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold">
          <HelpCircle className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
          <span>Quy trình hoạt động: Bot đẩy mã CVE & Agent cảnh báo tự động</span>
        </div>
        <p className="leading-relaxed">
          1. <strong>Thu thập Tech Asset:</strong> Bộ quét quét URL/Subdomain, phát hiện chuẩn xác tên phần mềm và phiên bản (ví dụ: Apache 2.4.52, WordPress 6.4.0, PHP 8.1.2, Vue 3.3).<br />
          2. <strong>Lưu trữ Tech Asset:</strong> Dữ liệu fingerprint được lưu tại kho Asset Repository để làm cơ sở đối chiếu bền vững.<br />
          3. <strong>Bot Đẩy Mã CVE:</strong> Bot bảo mật bên ngoài (Telegram/Discord/Webhook) gửi mã CVE kèm tên phần mềm và dải phiên bản bị lỗi (ví dụ: `Apache &lt; 2.4.56`) qua API `POST /api/cve/push`.<br />
          4. <strong>Agent So Khớp Tức Thì:</strong> Agent cắm sẵn duyệt toàn bộ danh mục tài sản và kích hoạt cảnh báo các máy chủ trùng khớp để đội ngũ kỹ thuật vá lỗi ngay lập tức.
        </p>
      </div>
    </div>
  );
};
