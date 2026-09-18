import React, { useState } from 'react';
import {
  Clock,
  Play,
  Pause,
  Plus,
  Trash2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Layers,
  Settings2,
  ChevronRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { CrontabScanJob, AssetGroup, ScanOptions } from '../types';

interface CrontabScanManagerProps {
  jobs: CrontabScanJob[];
  assetGroups: AssetGroup[];
  onToggleJob: (id: string, enabled: boolean) => void;
  onDeleteJob: (id: string) => void;
  onRunNow: (id: string) => Promise<void>;
  onCreateJob: (jobData: Partial<CrontabScanJob>) => void;
  onSelectGroupView?: (groupId: string) => void;
}

const CRON_PRESETS = [
  { label: 'Mỗi giờ một lần', cron: '0 * * * *', human: 'Chạy mỗi giờ (:00 phút)' },
  { label: 'Hàng ngày lúc 02:00 sáng', cron: '0 2 * * *', human: 'Mỗi ngày lúc 02:00 AM' },
  { label: 'Mỗi 6 tiếng', cron: '0 */6 * * *', human: 'Mỗi 6 tiếng một lần' },
  { label: 'Hàng tuần (Chủ nhật 00:00)', cron: '0 0 * * 0', human: 'Mỗi Chủ nhật lúc 00:00 AM' },
  { label: 'Tùy chỉnh (Custom)', cron: '*/30 * * * *', human: 'Mỗi 30 phút một lần' },
];

export const CrontabScanManager: React.FC<CrontabScanManagerProps> = ({
  jobs = [],
  assetGroups = [],
  onToggleJob,
  onDeleteJob,
  onRunNow,
  onCreateJob,
  onSelectGroupView,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [runningJobId, setRunningJobId] = useState<string | null>(null);

  // Form states
  const [newJobName, setNewJobName] = useState('');
  const [selectedCronPreset, setSelectedCronPreset] = useState(CRON_PRESETS[1].cron);
  const [customCron, setCustomCron] = useState('0 2 * * *');
  const [selectedGroupId, setSelectedGroupId] = useState(assetGroups[0]?.id || 'new');
  const [targetUrlsText, setTargetUrlsText] = useState('');
  const [targetMode, setTargetMode] = useState<'asset-group' | 'custom'>('asset-group');
  const [threads, setThreads] = useState(5);
  const [timeoutSec, setTimeoutSec] = useState(6);

  const handleRunTrigger = async (id: string) => {
    setRunningJobId(id);
    try {
      await onRunNow(id);
    } finally {
      setRunningJobId(null);
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJobName.trim()) return;

    let targetUrls: string[] = [];
    let targetGroupName = undefined;

    if (targetMode === 'asset-group') {
      const grp = assetGroups.find(g => g.id === selectedGroupId);
      if (grp) {
        targetGroupName = grp.name;
        targetUrls = grp.subdomains.map(s => `https://${s}`);
      }
    } else {
      targetUrls = targetUrlsText
        .split('\n')
        .map(u => u.trim())
        .filter(Boolean)
        .map(u => (u.startsWith('http') ? u : `https://${u}`));
    }

    if (targetUrls.length === 0) {
      targetUrls = ['https://caobang.gov.vn'];
    }

    const presetObj = CRON_PRESETS.find(p => p.cron === selectedCronPreset);
    const scheduleHuman = presetObj ? presetObj.human : `Biểu thức: ${customCron}`;

    onCreateJob({
      name: newJobName.trim(),
      cronExpression: selectedCronPreset === 'custom' ? customCron : selectedCronPreset,
      scheduleHuman,
      targetType: targetMode === 'asset-group' ? 'asset-group' : 'subdomain-list',
      targetGroupId: targetMode === 'asset-group' ? selectedGroupId : undefined,
      targetUrls,
      options: {
        techDetect: true,
        statusCode: true,
        title: true,
        followRedirects: true,
        probe: true,
        timeoutSec,
        threads,
      },
      enabled: true,
      nextRun: new Date(Date.now() + 3600000 * 2).toISOString(),
      totalRuns: 0,
    });

    setIsCreating(false);
    setNewJobName('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-slate-50 dark:bg-[#121522] border border-slate-200 dark:border-[#232736] rounded-xl p-6 relative overflow-hidden transition-colors shadow-xs dark:shadow-none">
        <div className="absolute -right-8 -top-8 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-xs font-mono font-semibold border border-indigo-200 dark:border-indigo-500/30">
                CRONTAB DAEMON
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">Node.js Engine Active</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Lịch Quét Tự Động Định Kỳ (Crontab Scan Schedules)
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
              Tự động hóa tiến trình chạy quét Tech Fingerprinting định kỳ đối với các tên miền, subdomain của Asset Groups hoặc danh sách tùy chỉnh. Phát hiện thay đổi tech stack và chứng chỉ SSL hết hạn.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCreating(true)}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Tạo Lịch Quét Mới
            </button>
          </div>
        </div>

        {/* Quick Stats Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-200 dark:border-[#1e2333]">
          <div className="bg-white dark:bg-[#0e101a] p-3 rounded-lg border border-slate-200 dark:border-[#1e2333] shadow-2xs dark:shadow-none">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-medium">Tổng số lịch quét</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{jobs.length} Jobs</div>
          </div>
          <div className="bg-white dark:bg-[#0e101a] p-3 rounded-lg border border-slate-200 dark:border-[#1e2333] shadow-2xs dark:shadow-none">
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 uppercase font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> Đang hoạt động
            </div>
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-300 mt-0.5">
              {jobs.filter(j => j.enabled).length} Active
            </div>
          </div>
          <div className="bg-white dark:bg-[#0e101a] p-3 rounded-lg border border-slate-200 dark:border-[#1e2333] shadow-2xs dark:shadow-none">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-medium">Tổng lượt đã thực thi</div>
            <div className="text-lg font-bold text-slate-700 dark:text-slate-200 mt-0.5">
              {jobs.reduce((acc, j) => acc + (j.totalRuns || 0), 0)} Runs
            </div>
          </div>
          <div className="bg-white dark:bg-[#0e101a] p-3 rounded-lg border border-slate-200 dark:border-[#1e2333] shadow-2xs dark:shadow-none">
            <div className="text-[11px] text-indigo-600 dark:text-indigo-400 uppercase font-medium">Mục tiêu theo dõi</div>
            <div className="text-lg font-bold text-indigo-600 dark:text-indigo-300 mt-0.5">
              {jobs.reduce((acc, j) => acc + (j.targetUrls?.length || 0), 0)} Targets
            </div>
          </div>
        </div>
      </div>

      {/* Creation Drawer / Modal */}
      {isCreating && (
        <div className="bg-white dark:bg-[#121522] border border-indigo-300 dark:border-indigo-500/40 rounded-xl p-6 shadow-xl dark:shadow-2xl animate-in slide-in-from-top-4 duration-200">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 dark:border-[#232736]">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Tạo Lịch Quét Crontab Mới (New Scheduled Scan)
            </h3>
            <button
              onClick={() => setIsCreating(false)}
              className="text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white px-2 py-1 rounded bg-slate-100 dark:bg-slate-800"
            >
              Đóng
            </button>
          </div>

          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tên tác vụ quét (Job Name):</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Caobang Subdomain Asset Health Scan"
                  value={newJobName}
                  onChange={(e) => setNewJobName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#0b0d14] border border-slate-300 dark:border-[#2a3045] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Chu kỳ chạy (Schedule Interval):</label>
                <select
                  value={selectedCronPreset}
                  onChange={(e) => {
                    setSelectedCronPreset(e.target.value);
                    if (e.target.value !== 'custom') {
                      setCustomCron(e.target.value);
                    }
                  }}
                  className="w-full bg-slate-50 dark:bg-[#0b0d14] border border-slate-300 dark:border-[#2a3045] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  {CRON_PRESETS.map((p) => (
                    <option key={p.cron} value={p.cron}>
                      {p.label} ({p.cron})
                    </option>
                  ))}
                  <option value="custom">Tùy chỉnh Crontab Expression...</option>
                </select>
              </div>
            </div>

            {selectedCronPreset === 'custom' && (
              <div className="space-y-1.5 bg-slate-50 dark:bg-[#0b0d14] p-3 rounded-lg border border-slate-200 dark:border-[#232736]">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Biểu thức Cron tiêu chuẩn (5 trường: min hour day month weekday):</label>
                <input
                  type="text"
                  value={customCron}
                  onChange={(e) => setCustomCron(e.target.value)}
                  placeholder="*/15 * * * *"
                  className="w-full bg-white dark:bg-[#141724] border border-slate-300 dark:border-[#2a3045] rounded-lg px-3 py-1.5 font-mono text-xs text-indigo-600 dark:text-indigo-300"
                />
                <span className="text-[10px] text-slate-500">Ví dụ: `0 */2 * * *` (Mỗi 2 giờ), `30 8 * * 1-5` (8:30 sáng từ Thứ 2 - Thứ 6)</span>
              </div>
            )}

            {/* Target selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Chọn nguồn mục tiêu (Targets):</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="targetMode"
                    checked={targetMode === 'asset-group'}
                    onChange={() => setTargetMode('asset-group')}
                    className="accent-indigo-500"
                  />
                  Theo Asset Group ({assetGroups.length} nhóm có sẵn)
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="targetMode"
                    checked={targetMode === 'custom'}
                    onChange={() => setTargetMode('custom')}
                    className="accent-indigo-500"
                  />
                  Nhập danh sách Subdomains riêng
                </label>
              </div>

              {targetMode === 'asset-group' ? (
                <div className="mt-2">
                  <select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#0b0d14] border border-slate-300 dark:border-[#2a3045] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    {assetGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} — {g.assetCount} subdomains ({g.rootDomain})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="mt-2">
                  <textarea
                    rows={4}
                    value={targetUrlsText}
                    onChange={(e) => setTargetUrlsText(e.target.value)}
                    placeholder="login.caobang.gov.vn&#10;cloud.caobang.gov.vn&#10;thuvien.caobang.gov.vn"
                    className="w-full bg-slate-50 dark:bg-[#0b0d14] border border-slate-300 dark:border-[#2a3045] rounded-lg p-3 text-xs font-mono text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}
            </div>

            {/* Concurrency / Tuning */}
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-[#1e2333]">
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Số luồng quét song song (Threads): {threads}</label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={threads}
                  onChange={(e) => setThreads(parseInt(e.target.value, 10))}
                  className="w-full accent-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Thời gian chờ phản hồi (Timeout): {timeoutSec}s</label>
                <input
                  type="range"
                  min={2}
                  max={15}
                  value={timeoutSec}
                  onChange={(e) => setTimeoutSec(parseInt(e.target.value, 10))}
                  className="w-full accent-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 flex items-center gap-2 cursor-pointer"
              >
                Lưu & Kích Hoạt Lịch Quét
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Jobs List */}
      <div className="space-y-4">
        {jobs.map((job) => {
          const isRunning = runningJobId === job.id;

          return (
            <div
              key={job.id}
              className={`
                bg-white dark:bg-[#121522] border rounded-xl p-5 transition-all shadow-xs dark:shadow-none
                ${job.enabled ? 'border-slate-200 dark:border-[#232736] hover:border-indigo-400 dark:hover:border-indigo-500/40' : 'border-slate-200 dark:border-[#1b1e2c] opacity-75'}
              `}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Job Info */}
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold border flex items-center gap-1 ${
                        job.enabled
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30'
                          : 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                      }`}
                    >
                      {job.enabled ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" /> Active
                        </>
                      ) : (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500" /> Paused
                        </>
                      )}
                    </span>

                    <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/30 font-mono text-[11px]">
                      {job.cronExpression}
                    </span>

                    <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {job.scheduleHuman}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors">
                    {job.name}
                  </h3>

                  <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 flex-wrap pt-1">
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                      <span>
                        Mục tiêu:{' '}
                        <strong className="text-slate-800 dark:text-slate-200">
                          {job.targetGroupId || 'Custom targets'}
                        </strong>{' '}
                        ({job.targetUrls?.length || 0} URLs)
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        Lần chạy kế tiếp:{' '}
                        <span className="text-slate-800 dark:text-slate-200 font-mono">
                          {new Date(job.nextRun).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (
                          {new Date(job.nextRun).toLocaleDateString()})
                        </span>
                      </span>
                    </div>

                    {job.lastRun && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>Lần chạy trước:</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">Thành công</span>
                        <span>({job.lastDiscoveredCount || 0} tài sản)</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end lg:self-center">
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => handleRunTrigger(job.id)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-indigo-600 dark:bg-[#1a1f33] text-indigo-700 dark:text-indigo-300 hover:text-white border border-indigo-200 dark:border-indigo-500/30 text-xs font-medium flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    <Play className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
                    {isRunning ? 'Đang chạy...' : 'Run Now'}
                  </button>

                  <button
                    type="button"
                    onClick={() => onToggleJob(job.id, !job.enabled)}
                    title={job.enabled ? 'Tạm dừng lịch' : 'Bật lịch quét'}
                    className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                      job.enabled
                        ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30 hover:bg-amber-100 dark:hover:bg-amber-500/20'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'
                    }`}
                  >
                    {job.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteJob(job.id)}
                    title="Xóa lịch quét"
                    className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 text-xs transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
