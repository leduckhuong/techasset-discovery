import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Copy, Trash2, Check, ArrowDown, Play } from 'lucide-react';
import { ScanResult } from '../types';

interface ScannerTerminalProps {
  /** Log append-only theo thứ tự thời gian (cũ trên, mới đáy) — không bao giờ bị reshuffle */
  lines: ScanResult[];
  scanning?: boolean;
  isScanning?: boolean;
  currentHost?: string;
  onRunCustomCommand?: (cmd: string) => void;
}

export const ScannerTerminal: React.FC<ScannerTerminalProps> = ({
  lines,
  scanning: scanningProp,
  isScanning: isScanningProp,
  currentHost,
  onRunCustomCommand,
}) => {
  const scanning = scanningProp ?? isScanningProp ?? false;
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [cmdInput, setCmdInput] = useState('tech-scanner -l targets.txt -tech-detect -status-code -title');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines, scanning, autoScroll]);

  // Người dùng cuộn lên xem log cũ → ngừng auto-scroll; cuộn về đáy → tự bật lại
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (atBottom !== autoScroll) setAutoScroll(atBottom);
  };

  const handleCopy = () => {
    const text = lines.map((a) => {
      const techList = a.technologies.map((t) => t.name).join(',');
      return `[${a.statusCode}] [${a.url}] [${a.title || 'No title'}] [${techList || 'No tech'}] [${a.responseTimeMs}ms] [${a.ip || '-'}]`;
    });
    navigator.clipboard.writeText(text.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-[#0D1117] rounded-lg border border-[#30363D] q-shadow-2 overflow-hidden flex flex-col h-[520px]">
      {/* Terminal Title Bar */}
      <div className="bg-[#161B22] px-4 py-2.5 border-b border-[#30363D] flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* macOS / Linux style dots */}
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#EC6A5E]" />
            <div className="w-3 h-3 rounded-full bg-[#F5BF4F]" />
            <div className="w-3 h-3 rounded-full bg-[#62C554]" />
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-bold">tech-scanner@projectdiscovery: ~</span>
            <span className="text-slate-500 text-[10px]">v2.0.0</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`text-[11px] px-2 py-0.5 rounded font-mono flex items-center gap-1 transition cursor-pointer ${
              autoScroll
                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            <ArrowDown className="w-3 h-3" />
            <span>Auto-scroll</span>
          </button>

          <button
            onClick={handleCopy}
            disabled={lines.length === 0}
            className="text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1 p-1 rounded hover:bg-slate-800 transition cursor-pointer disabled:opacity-40"
            title="Sao chép toàn bộ log"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span className="text-[11px] hidden sm:inline">{copied ? 'Đã chép' : 'Sao chép'}</span>
          </button>
        </div>
      </div>

      {/* Terminal Output Area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-1.5 text-slate-200 select-text"
      >
        {/* Banner */}
        <div className="text-slate-400 pb-2 border-b border-[#30363D]/60 select-none">
          <div className="text-emerald-400 font-bold font-mono">
            ============================================<br />
            &nbsp;&nbsp;TECH ASSET &amp; FINGERPRINT DISCOVERY ENGINE<br />
            &nbsp;&nbsp;Multi-Tool Probing Platform&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;v2.0.0<br />
            ============================================
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            [*] Running tech asset identification with multi-engine probing...
          </div>
          <div className="text-[11px] text-slate-400">
            [*] Flags: <span className="text-cyan-300">-tech-detect -status-code -title -follow-redirects</span>
          </div>
        </div>

        {/* Scan Log Lines — cũ trên, mới đẩy xuống dưới như terminal thật */}
        {lines.length === 0 ? (
          <div className="text-slate-400 py-6 text-center italic">
            Chưa có dòng log nào. Hãy nhập URL và nhấn &quot;Quét Mục tiêu&quot; để quan sát CLI trực tiếp.
          </div>
        ) : (
          lines.map((asset, idx) => {
            const statusColor =
              asset.statusCode >= 200 && asset.statusCode < 300
                ? 'text-emerald-400'
                : asset.statusCode >= 300 && asset.statusCode < 400
                ? 'text-cyan-400'
                : asset.statusCode >= 400 && asset.statusCode < 500
                ? 'text-amber-400'
                : 'text-rose-400';

            const techString = asset.technologies.map((t) => t.name).join(', ');

            return (
              <div
                key={asset.id || idx}
                className="hover:bg-white/5 py-0.5 px-1 rounded flex flex-wrap items-baseline gap-x-2 gap-y-0.5 leading-relaxed"
              >
                {/* Status code */}
                <span className={`font-bold ${statusColor}`}>
                  [{asset.statusCode > 0 ? asset.statusCode : 'ERR'}]
                </span>

                {/* Target URL */}
                <span className="text-amber-300 font-semibold">{asset.url}</span>

                {/* Title */}
                {asset.title && (
                  <span className="text-purple-300 max-w-xs truncate" title={asset.title}>
                    [{asset.title}]
                  </span>
                )}

                {/* Detected Tech */}
                {techString ? (
                  <span className="text-emerald-300 bg-emerald-950/40 px-1 rounded border border-emerald-800/40">
                    [{techString}]
                  </span>
                ) : (
                  <span className="text-slate-400">[no-tech]</span>
                )}

                {/* Web Server */}
                {asset.webServer && (
                  <span className="text-blue-300">[{asset.webServer}]</span>
                )}

                {/* Latency */}
                <span className="text-slate-300">[{asset.responseTimeMs}ms]</span>

                {/* IP */}
                {asset.ip && <span className="text-slate-300">[{asset.ip}]</span>}
              </div>
            );
          })
        )}

        {/* Live scanning indicator — dòng đang probe nằm ở đáy, cập nhật từng host */}
        {scanning && currentHost && (
          <div className="flex flex-wrap items-baseline gap-x-2 text-cyan-300 py-0.5">
            <span className="text-cyan-500 font-bold">[*]</span>
            <span className="text-amber-300 font-semibold">{currentHost}</span>
            <span className="text-slate-400">— probing...</span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
          </div>
        )}
        {scanning && (
          <div className="flex items-center gap-2 text-cyan-400 py-1">
            <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>[+] tech-engine: sending concurrent probe requests...</span>
          </div>
        )}

        {/* Terminal prompt with blinking cursor */}
        <div className="flex items-center gap-1.5 pt-2 text-slate-400 select-none">
          <span className="text-emerald-400 font-bold">$</span>
          <span className="text-slate-300">tech-scanner</span>
          <span className="w-2 h-4 bg-emerald-400 animate-pulse inline-block" />
        </div>
      </div>

      {/* Terminal Footer Info */}
      <div className="bg-[#161B22] px-4 py-2 border-t border-[#30363D] flex items-center justify-between text-[11px] text-slate-400 font-mono">
        <div>
          <span>Total Probed: </span>
          <span className="text-emerald-400 font-bold">{lines.length}</span>
        </div>
        <div>
          <span>Engine: Multi-Tool Tech Discovery (Embedded)</span>
        </div>
      </div>
    </div>
  );
};
