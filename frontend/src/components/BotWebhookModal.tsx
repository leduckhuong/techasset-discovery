import React, { useState } from 'react';
import {
  X,
  Send,
  Bot,
  Copy,
  Check,
  Code2,
  Terminal,
  AlertTriangle,
  Sparkles,
  ShieldAlert,
  Zap,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { CveItem } from '../types';

interface BotWebhookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPushCve: (cveData: Partial<CveItem>) => Promise<any>;
}

// Real-world sample CVE templates for instant testing
const SAMPLE_CVES: Array<Partial<CveItem> & { desc: string }> = [
  {
    cveId: 'CVE-2023-25690',
    software: 'Apache',
    affectedVersions: '< 2.4.56',
    severity: 'CRITICAL',
    cvssScore: 9.8,
    summary: 'HTTP Request Smuggling trong mod_proxy của Apache HTTP Server cho phép bypass truy cập và thực thi mã độc.',
    remediation: 'Khuyến nghị nâng cấp Apache HTTP Server lên phiên bản 2.4.56 hoặc mới hơn.',
    source: 'Telegram Bot Cảnh Báo An Toàn Thông Tin',
    desc: 'Trùng khớp với cloud.caobang.gov.vn (đang chạy Apache 2.4.52)',
  },
  {
    cveId: 'CVE-2024-27956',
    software: 'WordPress',
    affectedVersions: '< 6.4.3',
    severity: 'HIGH',
    cvssScore: 8.8,
    summary: 'Lỗ hổng SQL Injection và Authentication Bypass trong lõi WordPress cho phép chiếm tài khoản quản trị viên.',
    remediation: 'Nâng cấp WordPress Core lên phiên bản >= 6.4.3 ngay lập tức.',
    source: 'Security Alert Bot (Discord)',
    desc: 'Trùng khớp với sotuphap.caobang.gov.vn (đang chạy WordPress 6.4.0)',
  },
  {
    cveId: 'CVE-2024-4577',
    software: 'PHP',
    affectedVersions: '8.1.0 - 8.1.28',
    severity: 'CRITICAL',
    cvssScore: 9.8,
    summary: 'Lỗ hổng CGI Argument Injection trong PHP dẫn đến Thực thi Mã từ xa (RCE) qua kỹ thuật Best-Fit bypass.',
    remediation: 'Cập nhật PHP lên phiên bản >= 8.1.29 hoặc vô hiệu hóa cấu hình CGI không an toàn.',
    source: 'Automated Bot Webhook',
    desc: 'Trùng khớp với cloud.caobang.gov.vn (đang chạy PHP 8.1.2)',
  },
  {
    cveId: 'CVE-2022-41741',
    software: 'Nginx',
    affectedVersions: '< 1.23.2',
    severity: 'HIGH',
    cvssScore: 7.5,
    summary: 'Lỗ hổng Memory Corruption trong module ngx_http_mp4_module của Nginx cho phép gây tràn bộ nhớ đệm.',
    remediation: 'Cập nhật Nginx lên >= 1.23.2 hoặc tắt cấu hình mp4 directive.',
    source: 'SOC Security Feed Bot',
    desc: 'Trùng khớp với dichvucong.caobang.gov.vn (đang chạy Nginx 1.22.0)',
  },
];

export const BotWebhookModal: React.FC<BotWebhookModalProps> = ({ isOpen, onClose, onPushCve }) => {
  const [activeTab, setActiveTab] = useState<'simulate' | 'docs'>('simulate');
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pushResult, setPushResult] = useState<any | null>(null);

  // Form states
  const [cveId, setCveId] = useState('CVE-2023-25690');
  const [software, setSoftware] = useState('Apache');
  const [affectedVersions, setAffectedVersions] = useState('< 2.4.56');
  const [severity, setSeverity] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('CRITICAL');
  const [cvssScore, setCvssScore] = useState('9.8');
  const [summary, setSummary] = useState(
    'HTTP Request Smuggling trong mod_proxy của Apache HTTP Server cho phép bypass truy cập và thực thi mã độc.'
  );
  const [remediation, setRemediation] = useState(
    'Khuyến nghị nâng cấp Apache HTTP Server lên phiên bản 2.4.56 hoặc mới hơn.'
  );
  const [source, setSource] = useState('Telegram Alert Bot');

  if (!isOpen) return null;

  const handleApplyTemplate = (tpl: (typeof SAMPLE_CVES)[0]) => {
    setCveId(tpl.cveId || '');
    setSoftware(tpl.software || '');
    setAffectedVersions(tpl.affectedVersions || '');
    setSeverity(tpl.severity || 'HIGH');
    setCvssScore(String(tpl.cvssScore || 7.5));
    setSummary(tpl.summary || '');
    setRemediation(tpl.remediation || '');
    setSource(tpl.source || 'Bot Webhook');
    setPushResult(null);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setPushResult(null);

    try {
      const res = await onPushCve({
        cveId,
        software,
        affectedVersions,
        severity,
        cvssScore: Number(cvssScore) || 7.0,
        summary,
        remediation,
        source,
      });
      setPushResult(res);
    } catch (err: any) {
      setPushResult({ error: err.message || 'Lỗi gửi yêu cầu tới webhook' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const webhookUrl = `${window.location.origin}/api/cve/push`;

  const curlExample = `curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "cveId": "${cveId}",
    "software": "${software}",
    "affectedVersions": "${affectedVersions}",
    "severity": "${severity}",
    "cvssScore": ${cvssScore},
    "summary": "${summary.replace(/"/g, '\\"')}",
    "remediation": "${remediation.replace(/"/g, '\\"')}",
    "source": "${source}"
  }'`;

  const pythonExample = `import requests

# Payload từ bot cảnh báo (Telegram, Discord, hoặc NVD Scraper)
payload = {
    "cveId": "${cveId}",
    "software": "${software}",
    "affectedVersions": "${affectedVersions}",
    "severity": "${severity}",
    "cvssScore": ${cvssScore},
    "summary": "${summary}",
    "remediation": "${remediation}",
    "source": "Python Telegram Security Bot"
}

response = requests.post("${webhookUrl}", json=payload)
data = response.json()

print(f"Agent matched {data.get('matchedCount')} affected tech assets!")
for asset in data.get("matchedAssets", []):
    print(f"🚨 [CẢNH BÁO] {asset['host']} chạy {asset['detectedVersion']} trùng mã {payload['cveId']}")
`;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#0b0f19] border border-slate-200 dark:border-[#232a42] rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150 transition-colors">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1c2236] flex items-center justify-between bg-slate-50 dark:bg-[#0e1322]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Cổng Tiếp Nhận Mã CVE Từ Bot (Webhook & Push API)
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Cho phép Bot bảo mật bên ngoài đẩy mã CVE vào; Agent cắm sẵn sẽ tự động so khớp với kho tài sản.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-[#1c2236] bg-slate-100/60 dark:bg-[#090c16] px-6">
          <button
            onClick={() => setActiveTab('simulate')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'simulate'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-500 dark:text-indigo-300'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Thử Nghiệm Đẩy CVE (Bot Simulator)</span>
          </button>
          <button
            onClick={() => setActiveTab('docs')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'docs'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-500 dark:text-indigo-300'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Tích Hợp Webhook Cho Bot (API Docs & cURL)</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
          {activeTab === 'simulate' ? (
            <div className="space-y-5">
              {/* Quick Template Picker */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">
                  Chọn mẫu CVE thực tế để thử nghiệm ngay:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SAMPLE_CVES.map((tpl) => (
                    <button
                      key={tpl.cveId}
                      type="button"
                      onClick={() => handleApplyTemplate(tpl)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        cveId === tpl.cveId
                          ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-500/20 dark:border-indigo-500/50 text-indigo-900 dark:text-indigo-200'
                          : 'bg-slate-50 dark:bg-[#121626] border-slate-200 dark:border-[#222942] hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">{tpl.cveId}</span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            tpl.severity === 'CRITICAL'
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                          }`}
                        >
                          {tpl.severity}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        {tpl.software} ({tpl.affectedVersions})
                      </div>
                      <div className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-1 truncate">
                        👉 {tpl.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Push CVE Form */}
              <form onSubmit={handleFormSubmit} className="space-y-4 bg-slate-50 dark:bg-[#0f1322] border border-slate-200 dark:border-[#1e253c] p-4 rounded-xl">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Mã CVE (*)</label>
                    <input
                      type="text"
                      required
                      value={cveId}
                      onChange={(e) => setCveId(e.target.value)}
                      placeholder="CVE-2023-25690"
                      className="w-full px-3 py-1.5 bg-white dark:bg-[#161a2c] border border-slate-300 dark:border-[#2a3350] rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Tên Phần Mềm (*)</label>
                    <input
                      type="text"
                      required
                      value={software}
                      onChange={(e) => setSoftware(e.target.value)}
                      placeholder="Apache, Nginx, WordPress, PHP..."
                      className="w-full px-3 py-1.5 bg-white dark:bg-[#161a2c] border border-slate-300 dark:border-[#2a3350] rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Phiên Bản Bị Ảnh Hưởng (*)</label>
                    <input
                      type="text"
                      required
                      value={affectedVersions}
                      onChange={(e) => setAffectedVersions(e.target.value)}
                      placeholder="< 2.4.56 hoặc 8.1.0 - 8.1.28"
                      className="w-full px-3 py-1.5 bg-white dark:bg-[#161a2c] border border-slate-300 dark:border-[#2a3350] rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 font-mono text-rose-600 dark:text-rose-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Mức Độ (Severity)</label>
                    <select
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value as any)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-[#161a2c] border border-slate-300 dark:border-[#2a3350] rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="CRITICAL">CRITICAL (Nghiêm trọng)</option>
                      <option value="HIGH">HIGH (Cao)</option>
                      <option value="MEDIUM">MEDIUM (Trung bình)</option>
                      <option value="LOW">LOW (Thấp)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Điểm CVSS v3 (0 - 10)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={cvssScore}
                      onChange={(e) => setCvssScore(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-[#161a2c] border border-slate-300 dark:border-[#2a3350] rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Nguồn Đẩy (Source Bot)</label>
                    <input
                      type="text"
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      placeholder="Telegram Bot, NVD, SOC Bot..."
                      className="w-full px-3 py-1.5 bg-white dark:bg-[#161a2c] border border-slate-300 dark:border-[#2a3350] rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Mô Tả Lỗ Hổng (Summary)</label>
                  <textarea
                    rows={2}
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-[#161a2c] border border-slate-300 dark:border-[#2a3350] rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Khuyến Nghị Khắc Phục (Remediation)</label>
                  <input
                    type="text"
                    value={remediation}
                    onChange={(e) => setRemediation(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-[#161a2c] border border-slate-300 dark:border-[#2a3350] rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Đang đẩy CVE & Agent đang so khớp...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>🚀 Đẩy Mã CVE Vào Hệ Thống (Bot Push)</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Push Result Display */}
              {pushResult && (
                <div
                  className={`p-4 rounded-xl border animate-in fade-in-50 duration-200 ${
                    pushResult.error
                      ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-300'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-200'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs">
                    {pushResult.error ? (
                      <>
                        <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                        <span>Thất bại: {pushResult.error}</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>{pushResult.message || 'Đã nạp CVE thành công!'}</span>
                      </>
                    )}
                  </div>

                  {pushResult.matchedCount !== undefined && (
                    <div className="mt-2 text-xs space-y-1.5">
                      <div className="text-slate-800 dark:text-slate-200 font-semibold">
                        🤖 Agent đã đối chiếu ngay lập tức:{' '}
                        <strong className="text-rose-600 dark:text-rose-400 font-bold">
                          {pushResult.matchedCount} tài sản trùng khớp phiên bản bị lỗi
                        </strong>
                      </div>

                      {Array.isArray(pushResult.matchedAssets) && pushResult.matchedAssets.length > 0 && (
                        <div className="space-y-1 pt-1">
                          {pushResult.matchedAssets.map((m: any, idx: number) => (
                            <div
                              key={idx}
                              className="px-2.5 py-1.5 rounded bg-white dark:bg-black/40 border border-slate-200 dark:border-slate-700/60 font-mono text-[11px] flex items-center justify-between"
                            >
                              <span className="text-indigo-600 dark:text-indigo-300 font-bold">{m.host}</span>
                              <span className="text-rose-600 dark:text-rose-300 font-bold">{m.detectedVersion}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Tab 2: Webhook API Documentation */
            <div className="space-y-5">
              <div className="bg-slate-50 dark:bg-[#121626] border border-slate-200 dark:border-[#222a42] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Webhook Endpoint dành cho Bot</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 text-[10px] font-mono font-bold">
                    HTTP POST
                  </span>
                </div>

                <div className="bg-white dark:bg-black/50 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 font-mono text-xs text-indigo-600 dark:text-indigo-300 flex items-center justify-between">
                  <span>{webhookUrl}</span>
                </div>
              </div>

              {/* cURL Example */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Lệnh cURL mẫu để test từ terminal hoặc script:</span>
                  </label>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(curlExample);
                      setCopiedCurl(true);
                      setTimeout(() => setCopiedCurl(false), 2000);
                    }}
                    className="text-[11px] text-indigo-600 dark:text-indigo-300 hover:text-indigo-800 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    {copiedCurl ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCurl ? 'Đã sao chép' : 'Sao chép cURL'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-[#080a12] border border-slate-800 dark:border-[#1d2338] rounded-xl text-[11px] font-mono text-slate-300 overflow-x-auto">
                  {curlExample}
                </pre>
              </div>

              {/* Python Telegram Bot Integration Example */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Mẫu mã Python tích hợp Bot (Telegram / Discord / NVD):</span>
                  </label>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(pythonExample);
                      setCopiedJson(true);
                      setTimeout(() => setCopiedJson(false), 2000);
                    }}
                    className="text-[11px] text-emerald-600 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    {copiedJson ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedJson ? 'Đã sao chép' : 'Sao chép Python code'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-[#080a12] border border-slate-800 dark:border-[#1d2338] rounded-xl text-[11px] font-mono text-slate-300 overflow-x-auto">
                  {pythonExample}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-[#1c2236] bg-slate-50 dark:bg-[#090c16] flex items-center justify-between">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Cổng Webhook lắng nghe trên <span className="font-mono text-slate-700 dark:text-slate-300">/api/cve/push</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-[#181d2e] dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
