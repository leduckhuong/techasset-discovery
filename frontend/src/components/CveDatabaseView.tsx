/**
 * Kho CVE (dùng chung) — danh sách CVE bot đẩy về, áp dụng cho TOÀN BỘ workspace.
 * Bot Telegram không đọc được lịch sử chat nên có modal "Dán tin nhắn CVE" để
 * nhập lại các tin cũ: copy từ nhóm feed → paste → AGI parse + rà asset.
 */
import React, { useMemo, useState } from 'react';
import {
  Database,
  ShieldAlert,
  Search,
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  X,
  Loader2,
  Globe2,
  CheckCircle2,
  Info,
  History,
} from 'lucide-react';
import { CveItem, CveMatchAlert } from '../types';

interface CveDatabaseViewProps {
  cves: CveItem[];
  alerts: CveMatchAlert[];
  onImportCveText: (text: string, notify: boolean) => Promise<{ found: number; imported: number; skipped: number }>;
}

const SEV_COLORS: Record<string, string> = {
  CRITICAL: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/40',
  HIGH: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/40',
  MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40',
  LOW: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/40',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Chưa xử lý',
  investigating: 'Đang điều tra',
  resolved: 'Đã vá',
};

export const CveDatabaseView: React.FC<CveDatabaseViewProps> = ({ cves, alerts, onImportCveText }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [notify, setNotify] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [backfillBusy, setBackfillBusy] = useState(false);

  const handleBackfill = async () => {
    if (backfillBusy) return;
    setBackfillBusy(true);
    try {
      const res = await fetch('/api/telegram/user-session/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours: 24 }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error || 'lỗi');
      setImportResult(`Đã kích hoạt quét ${d.hours}h lịch sử nhóm feed — CVE mới sẽ xuất hiện trong kho sau vài phút (worker xử lý nền).`);
      setModalOpen(true);
      // refresh danh sách sau 20s để thấy CVE mới
      setTimeout(() => window.dispatchEvent(new Event('cve-refresh')), 20000);
    } catch {
      setImportResult('Quét lịch sử thất bại — kiểm tra đã đăng nhập user session trong Settings.');
      setModalOpen(true);
    } finally {
      setBackfillBusy(false);
    }
  };

  const alertsByCve = useMemo(() => {
    const map = new Map<string, CveMatchAlert[]>();
    for (const a of alerts) {
      const list = map.get(a.cveId) || [];
      list.push(a);
      map.set(a.cveId, list);
    }
    return map;
  }, [alerts]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return cves.filter((c) => {
      if (severityFilter !== 'ALL' && c.severity !== severityFilter) return false;
      if (!q) return true;
      return (
        c.cveId.toLowerCase().includes(q) ||
        (c.software || '').toLowerCase().includes(q) ||
        (c.summary || '').toLowerCase().includes(q)
      );
    });
  }, [cves, searchTerm, severityFilter]);

  const criticalCount = cves.filter((c) => c.severity === 'CRITICAL').length;
  const totalAffected = alertsByCve.size;

  const handleImport = async () => {
    if (!pasteText.trim() || importing) return;
    setImporting(true);
    setImportResult(null);
    try {
      const r = await onImportCveText(pasteText, notify);
      setImportResult(`Tìm thấy ${r.found} CVE — nhập mới ${r.imported}, bỏ qua (đã có/lỗi) ${r.skipped}.`);
      setPasteText('');
    } catch {
      setImportResult('Import thất bại — thử lại.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2.5">
            <span className="font-semibold text-slate-900 dark:text-white">Kho CVE</span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <Globe2 className="w-3.5 h-3.5" /> Dùng chung mọi workspace
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Danh mục CVE bot bảo mật đẩy về
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
            Toàn bộ CVE được push qua webhook/Telegram, không phụ thuộc workspace đang chọn.
            Agent rà soát trên toàn bộ danh mục asset của mọi workspace.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleBackfill}
            disabled={backfillBusy}
            className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#1a2033] dark:hover:bg-[#232a42] text-slate-600 dark:text-slate-300 text-xs font-semibold flex items-center gap-2 cursor-pointer transition"
            title="Đọc lịch sử nhóm feed bằng user session — nhập CVE chưa có vào kho"
          >
            {backfillBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <History className="w-4 h-4" />}
            Quét lịch sử feed (24h)
          </button>
          <button
            type="button"
            onClick={() => { setModalOpen(true); setImportResult(null); }}
            className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer transition shadow-sm"
          >
            <ClipboardPaste className="w-4 h-4" />
            Dán tin nhắn CVE từ nhóm feed
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Tổng CVE đã nhận', value: cves.length, cls: 'text-slate-900 dark:text-white' },
          { label: 'Mức Critical', value: criticalCount, cls: 'text-rose-600 dark:text-rose-400' },
          { label: 'CVE dính asset', value: totalAffected, cls: 'text-indigo-600 dark:text-indigo-300' },
          { label: 'Tổng cảnh báo', value: alerts.length, cls: 'text-emerald-600 dark:text-emerald-400' },
        ].map((s) => (
          <div key={s.label} className="bg-white dark:bg-[#0d101a] border border-slate-200 dark:border-[#1b2133] rounded-xl p-4 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{s.label}</div>
            <div className={`text-2xl font-bold mt-1 ${s.cls}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo mã CVE, phần mềm, mô tả..."
            className="w-full bg-white dark:bg-[#0d1120] border border-slate-200 dark:border-[#22283d] rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
            <button
              key={sev}
              type="button"
              onClick={() => setSeverityFilter(sev)}
              className={`px-2.5 py-1 rounded text-[10px] font-bold transition cursor-pointer border ${
                severityFilter === sev
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white dark:bg-[#141a2b] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[#22283d] hover:border-indigo-400'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* CVE list */}
      <div className="bg-white dark:bg-[#0d101a] border border-slate-200 dark:border-[#1b2133] rounded-xl overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-[#1b2133] flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-500" />
            Danh sách CVE
          </h2>
          <span className="text-xs text-slate-500 font-mono">( {filtered.length} mục )</span>
        </div>
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <ShieldAlert className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <div className="font-semibold text-slate-900 dark:text-white text-sm">Chưa có CVE nào khớp</div>
            <div className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Bot chỉ nhận tin CVE MỚI trong nhóm feed (Telegram Bot API không đọc được lịch sử chat).
              Với các tin đã gửi trước đó, bấm "Dán tin nhắn CVE từ nhóm feed" để nhập lại.
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-[#171d2e]">
            {filtered.map((cve) => {
              const cveAlerts = alertsByCve.get(cve.cveId) || [];
              const expanded = expandedId === cve.id;
              return (
                <div key={cve.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : cve.id)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-[#111422] transition text-left cursor-pointer"
                  >
                    {expanded ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                    <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border shrink-0 ${SEV_COLORS[cve.severity] || SEV_COLORS.LOW}`}>
                      {cve.severity}{cve.cvssScore ? ` (${cve.cvssScore})` : ''}
                    </span>
                    <span className="font-mono font-bold text-xs text-slate-900 dark:text-white shrink-0">{cve.cveId}</span>
                    <span className="text-xs text-slate-600 dark:text-slate-300 truncate flex-1">
                      <span className="font-semibold">{cve.software}</span>
                      <span className="text-slate-400"> · {cve.affectedVersions} · </span>
                      {cve.summary}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0 hidden md:block">
                      {new Date(cve.pushedAt).toLocaleString('vi-VN')}
                    </span>
                    {cveAlerts.length > 0 ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30 shrink-0">
                        {cveAlerts.length} assets
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 shrink-0">
                        An toàn
                      </span>
                    )}
                  </button>
                  {expanded && (
                    <div className="px-4 pb-4 pt-1 bg-slate-50/60 dark:bg-[#0a0d16]">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-2 flex flex-wrap gap-x-4 gap-y-1">
                        <span>Nguồn: <b>{cve.source || 'Webhook'}</b></span>
                        <span>Dải ảnh hưởng: <b className="font-mono">{cve.affectedVersions}</b></span>
                        {cve.remediation && <span className="basis-full">Khuyến nghị: {cve.remediation}</span>}
                      </div>
                      {cveAlerts.length === 0 ? (
                        <div className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Không có asset nào trong inventory chạy phần mềm này.
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                            <ShieldAlert className="w-3.5 h-3.5" /> {cveAlerts.length} asset bị ảnh hưởng:
                          </div>
                          {cveAlerts.map((a) => (
                            <div key={a.id} className="flex flex-wrap items-center gap-2 text-xs bg-white dark:bg-[#0d1120] border border-slate-200 dark:border-[#1d2336] rounded-lg px-3 py-2">
                              <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">{a.assetHost}</span>
                              {a.detectedVersion && <span className="text-[10px] font-mono text-slate-500">phát hiện: {a.detectedVersion}</span>}
                              <a href={a.assetUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline truncate max-w-[280px]">{a.assetUrl}</a>
                              <span className="ml-auto text-[10px] font-semibold text-slate-500">{STATUS_LABEL[a.status] || a.status}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Import modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setModalOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" />
          <div
            className="relative bg-white dark:bg-[#0d101a] border border-slate-200 dark:border-[#1b2133] rounded-2xl shadow-2xl w-full max-w-xl p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ClipboardPaste className="w-4 h-4 text-indigo-500" /> Dán tin nhắn CVE từ nhóm feed
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-1.5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-lg px-3 py-2">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-indigo-500" />
              Telegram Bot API không cho bot đọc lịch sử chat. Mở nhóm feed, copy (các) tin CVE cần nhập rồi dán vào đây —
              hệ thống tự nhận diện mọi mã CVE trong văn bản, AGI parse và rà soát asset. Mã đã có sẵn sẽ được bỏ qua.
            </div>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={8}
              placeholder={'VD:\nCẢNH BÁO: CVE-2024-21762 rất nghiêm trọng (CVSS 9.8), RCE trong FortiOS SSL-VPN...\nCVE-2024-3400 — Palo Alto GlobalProtect command injection, ảnh hưởng < 10.2.9-h1...'}
              className="w-full bg-white dark:bg-[#0d1120] border border-slate-200 dark:border-[#22283d] rounded-lg px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 resize-y"
            />
            <label className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 cursor-pointer">
              <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="accent-indigo-600" />
              Gửi kết quả phân tích vào nhóm Telegram nhận kết quả
            </label>
            {importResult && (
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-lg px-3 py-2">
                {importResult}
              </div>
            )}
            <button
              type="button"
              onClick={handleImport}
              disabled={!pasteText.trim() || importing}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardPaste className="w-4 h-4" />}
              {importing ? 'Đang parse & rà soát asset...' : 'Import CVE'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
