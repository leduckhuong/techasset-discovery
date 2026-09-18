import React, { useState } from 'react';
import {
  Play,
  Settings2,
  Trash2,
  Sparkles,
  Sliders,
  CheckSquare,
  Square,
  Globe2,
  HelpCircle,
} from 'lucide-react';
import { ScanOptions, TargetPreset, AssetGroup } from '../types';
import { QBtn, QChip, QCard } from './QuasarUiElements';

interface ScanInputCardProps {
  urlsInput: string;
  onChangeUrls: (val: string) => void;
  options: ScanOptions;
  onChangeOptions: (opts: ScanOptions) => void;
  onStartScan: () => void;
  scanning: boolean;
  presets?: TargetPreset[];
  onLoadPreset?: (preset: TargetPreset) => void;
  /** Asset groups thật từ backend — nạp domain của group vào danh sách mục tiêu */
  groups?: AssetGroup[];
  onLoadGroupDomains?: (group: AssetGroup) => void;
  progressPercent?: number;
  currentScanningHost?: string;
}

export const ScanInputCard: React.FC<ScanInputCardProps> = ({
  urlsInput,
  onChangeUrls,
  options,
  onChangeOptions,
  onStartScan,
  scanning,
  presets = [],
  onLoadPreset = (_preset: TargetPreset) => {},
  groups = [],
  onLoadGroupDomains = (_group: AssetGroup) => {},
  progressPercent = 0,
  currentScanningHost,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Parse lines to get count of non-empty URLs
  const urlLines = urlsInput
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const toggleOption = (key: keyof ScanOptions) => {
    if (typeof options[key] === 'boolean') {
      onChangeOptions({
        ...options,
        [key]: !options[key],
      });
    }
  };

  return (
    <div className="bg-white dark:bg-[#0f1320] rounded-lg border border-slate-200 dark:border-[#1d2438] q-shadow-1 overflow-hidden transition-all">
      {/* Quasar Card Header */}
      <div className="px-4 py-3 bg-slate-50 dark:bg-[#0c101c] border-b border-slate-200 dark:border-[#1d2438] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#1976D2] text-white flex items-center justify-center font-mono text-xs font-bold">
            &gt;_
          </div>
          <div>
            <h2 className="font-bold text-slate-800 dark:text-slate-100 text-sm tracking-tight flex items-center gap-2">
              <span>Mục tiêu Quét Tech Asset (Target URL List)</span>
              <span className="text-[11px] font-semibold text-[#1976D2] bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                {urlLines.length} mục tiêu
              </span>
            </h2>
          </div>
        </div>

        {/* Quick Presets Pills + Nạp domain từ Asset Group thật */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium mr-1 hidden sm:inline">Nạp nhanh:</span>
          {presets.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              id={`pill-preset-${idx}`}
              onClick={() => onLoadPreset(preset)}
              className="text-[11px] px-2.5 py-1 rounded-full bg-white dark:bg-[#14192a] border border-slate-300 dark:border-[#27314f] text-slate-700 dark:text-slate-300 hover:border-[#1976D2] hover:text-[#1976D2] dark:hover:border-indigo-400 dark:hover:text-indigo-400 transition font-medium cursor-pointer"
            >
              {preset.name.split(' ')[0]}
            </button>
          ))}
          {groups.length > 0 && (
            <>
              <span className="text-xs text-slate-300 dark:text-slate-600 mr-0.5 hidden sm:inline">|</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium mr-1 hidden sm:inline">Domain từ group:</span>
              <select
                id="select-load-group-domains"
                disabled={scanning}
                value=""
                onChange={(e) => {
                  const g = groups.find((x) => x.id === e.target.value);
                  if (g) onLoadGroupDomains(g);
                  e.target.value = '';
                }}
                className="text-[11px] px-2 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-300 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 hover:border-indigo-500 transition font-medium cursor-pointer focus:outline-none max-w-[220px]"
                title="Nạp danh sách subdomain của asset group vào danh sách mục tiêu"
              >
                <option value="">Chọn group...</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.assetCount})
                  </option>
                ))}
              </select>
            </>
          )}
          <button
            type="button"
            onClick={() => onChangeUrls('')}
            className="text-[11px] px-2 py-1 rounded text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 transition flex items-center gap-1 cursor-pointer"
            title="Xóa danh sách"
          >
            <Trash2 className="w-3 h-3" />
            <span className="hidden sm:inline">Xóa</span>
          </button>
        </div>
      </div>

      {/* Textarea Input for URLs */}
      <div className="p-4 space-y-3">
        <div className="relative">
          <textarea
            id="input-urls-textarea"
            rows={4}
            value={urlsInput}
            onChange={(e) => onChangeUrls(e.target.value)}
            disabled={scanning}
            placeholder={`Nhập mỗi URL hoặc domain trên 1 dòng. Ví dụ:
https://quasar.dev
https://vuejs.org
https://github.com
https://cloudflare.com`}
            className="w-full p-3 font-mono text-xs bg-slate-50 dark:bg-[#090c16] border border-slate-300 dark:border-[#242d45] rounded-md focus:outline-none focus:ring-2 focus:ring-[#1976D2] focus:bg-white dark:focus:bg-[#0d1222] text-slate-800 dark:text-slate-100 resize-y transition"
          />
          {urlsInput.length === 0 && (
            <div className="absolute top-3 right-3 pointer-events-none text-slate-400 dark:text-slate-500 text-xs flex items-center gap-1">
              <Globe2 className="w-3.5 h-3.5" />
              <span>Hỗ trợ HTTP/HTTPS & FQDN</span>
            </div>
          )}
        </div>

        {/* Scanner Flag Toggles (Quasar-style toggles) */}
        <div className="pt-1">
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-3 flex-wrap">
              {/* -tech-detect */}
              <label
                className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer select-none font-medium hover:text-[#1976D2] dark:hover:text-indigo-400"
                title="Sử dụng chữ ký nhận diện Vue, Quasar, Nginx, Cloudflare, React, PHP..."
              >
                <input
                  type="checkbox"
                  id="flag-tech-detect"
                  checked={options.techDetect}
                  onChange={() => toggleOption('techDetect')}
                  className="rounded text-[#1976D2] focus:ring-[#1976D2]"
                />
                <span className="font-mono text-[#1976D2] dark:text-indigo-400 bg-blue-50 dark:bg-blue-950/50 px-1 rounded">-tech-detect</span>
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">(Công nghệ)</span>
              </label>

              {/* -status-code */}
              <label className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer select-none font-medium hover:text-[#1976D2] dark:hover:text-indigo-400">
                <input
                  type="checkbox"
                  id="flag-status-code"
                  checked={options.statusCode}
                  onChange={() => toggleOption('statusCode')}
                  className="rounded text-[#1976D2] focus:ring-[#1976D2]"
                />
                <span className="font-mono text-[#1976D2] dark:text-indigo-400 bg-blue-50 dark:bg-blue-950/50 px-1 rounded">-status-code</span>
              </label>

              {/* -title */}
              <label className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer select-none font-medium hover:text-[#1976D2] dark:hover:text-indigo-400">
                <input
                  type="checkbox"
                  id="flag-title"
                  checked={options.title}
                  onChange={() => toggleOption('title')}
                  className="rounded text-[#1976D2] focus:ring-[#1976D2]"
                />
                <span className="font-mono text-[#1976D2] dark:text-indigo-400 bg-blue-50 dark:bg-blue-950/50 px-1 rounded">-title</span>
              </label>

              {/* -follow-redirects */}
              <label className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer select-none font-medium hover:text-[#1976D2] dark:hover:text-indigo-400">
                <input
                  type="checkbox"
                  id="flag-follow-redirects"
                  checked={options.followRedirects}
                  onChange={() => toggleOption('followRedirects')}
                  className="rounded text-[#1976D2] focus:ring-[#1976D2]"
                />
                <span className="font-mono text-[#1976D2] dark:text-indigo-400 bg-blue-50 dark:bg-blue-950/50 px-1 rounded">-follow-redirects</span>
              </label>

              {/* -nuclei (tech,discovery templates) */}
              <label
                className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer select-none font-medium hover:text-emerald-600 dark:hover:text-emerald-400"
                title="Chạy thêm nuclei -tags tech,discovery để nhận diện công nghệ sâu hơn (chậm hơn — mỗi target thêm ~5-30s)"
              >
                <input
                  type="checkbox"
                  id="flag-nuclei"
                  checked={options.nuclei}
                  onChange={() => toggleOption('nuclei')}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1 rounded">-nuclei</span>
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">(Tech sâu)</span>
              </label>
            </div>

            {/* Toggle Advanced settings */}
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition cursor-pointer text-xs font-medium"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{showAdvanced ? 'Ẩn cấu hình' : 'Tùy chọn nâng cao (-threads, -timeout)'}</span>
            </button>
          </div>

          {/* Advanced Sliders */}
          {showAdvanced && (
            <div className="mt-3 p-3 bg-slate-50 dark:bg-[#0a0d17] rounded border border-slate-200 dark:border-[#1e253b] grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Luồng quét đồng thời (-threads):</span>
                  <span className="font-mono font-bold text-[#1976D2] dark:text-indigo-400">{options.threads} threads</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={options.threads}
                  onChange={(e) =>
                    onChangeOptions({ ...options, threads: parseInt(e.target.value, 10) })
                  }
                  className="w-full accent-[#1976D2]"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Thời gian chờ phản hồi (-timeout):</span>
                  <span className="font-mono font-bold text-[#1976D2] dark:text-indigo-400">{options.timeoutSec}s</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={15}
                  value={options.timeoutSec}
                  onChange={(e) =>
                    onChangeOptions({ ...options, timeoutSec: parseInt(e.target.value, 10) })
                  }
                  className="w-full accent-[#1976D2]"
                />
              </div>

              {/* httpx port scan toggle + danh sách port */}
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 cursor-pointer select-none font-medium text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400">
                  <input
                    type="checkbox"
                    id="flag-httpx-ports"
                    checked={options.portScan}
                    onChange={() => toggleOption('portScan')}
                    className="rounded text-cyan-600 focus:ring-cyan-500"
                  />
                  <span className="font-mono text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/50 px-1 rounded">-httpx-ports</span>
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">(Quét port web bằng httpx sau khi quét tech)</span>
                </label>
                {options.portScan && (
                  <textarea
                    id="input-port-list"
                    rows={2}
                    value={options.portList}
                    onChange={(e) => onChangeOptions({ ...options, portList: e.target.value })}
                    placeholder="80,443,8080,8443,9090..."
                    className="mt-2 w-full p-2 font-mono text-[10px] leading-relaxed bg-white dark:bg-[#090c16] border border-cyan-300 dark:border-cyan-800 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-800 dark:text-slate-100 resize-y"
                  />
                )}
                {options.portScan && (
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                    {options.portList.split(',').filter((p) => p.trim()).length} ports — service tìm thấy trên port sẽ tự thêm vào Inventory & Asset Group
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Progress bar during scan (Quasar q-linear-progress) */}
        {scanning && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-[#1976D2] animate-ping" />
                Đang quét: <span className="font-mono text-[#1976D2] dark:text-indigo-400 font-semibold">{currentScanningHost || 'Chuẩn bị dữ liệu...'}</span>
              </span>
              <span className="font-bold text-[#1976D2] dark:text-indigo-400">{Math.round(progressPercent)}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#1976D2] to-[#26A69A] transition-all duration-200"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Bar */}
        <div className="pt-2 flex items-center justify-between flex-wrap gap-2 border-t border-slate-100 dark:border-[#1c2236]">
          <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
            CLI Syntax: <span className="text-slate-600 dark:text-slate-400">tech-scanner -l targets.txt -tech-detect -status-code -title</span>
          </div>

          <div className="flex items-center gap-2">
            <QBtn
              id="btn-start-scan"
              color="primary"
              onClick={onStartScan}
              disabled={scanning || urlLines.length === 0}
              loading={scanning}
              icon={<Play className="w-4 h-4 fill-current" />}
              label={scanning ? 'Đang thực thi quét...' : `Quét ${urlLines.length} Mục tiêu`}
              className="px-5 font-semibold text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
