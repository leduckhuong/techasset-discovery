import React, { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  X,
  FileSpreadsheet,
  Download,
  Play,
  Layers,
  ArrowRight,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { CsvImportGroupPreview, CsvImportPreviewItem, ImportScanConfig } from '../types';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportToScan: (items: CsvImportPreviewItem[], groupName?: string, groupId?: string, cfg?: ImportScanConfig) => void;
  onImportToCrontab?: (urls: string[], name: string) => void;
  existingAssetGroups: Array<{ id: string; name: string }>;
}

// Template CSV cố định: cột DOMAIN + các cột metadata tùy ý (đều được giữ lại).
// Mỗi domain gốc (eTLD+1) sẽ được tạo thành 1 asset group khi import.
const SAMPLE_CSV = `DOMAIN,DỰ ÁN,EMAIL SẼ QUẢN LÝ DOMAIN,TRẠNG THÁI CHUYỂN,NOTE,NGƯỜI PHỤ TRÁCH
bizfly.vn,bizfly,zamba@bizflycloud.vn,Done,Domain chính BizFly,
sohagame.vn,shg,system@sohagame.vn,Done,,huynguyentien@sohagame.vn
admicro.vn,ads,adtech@bizflycloud.vn,Done,,khanhphamvan@admicro.vn
vneconomy.com.vn,cnnd,vcsvr@bizflycloud.vn,Done,Chưa muốn self serving,`;

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  onImportToScan,
  onImportToCrontab,
  existingAssetGroups,
}) => {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [previewItems, setPreviewItems] = useState<CsvImportPreviewItem[]>([]);
  const [groupPreview, setGroupPreview] = useState<CsvImportGroupPreview[]>([]);
  const [isTemplateMode, setIsTemplateMode] = useState(false);
  const [dnsRecordCount, setDnsRecordCount] = useState(0);
  const [selectedGroup, setSelectedGroup] = useState<string>('new');
  const [newGroupName, setNewGroupName] = useState('');
  const [actionChoice, setActionChoice] = useState<'scan-now' | 'crontab' | 'queue'>('scan-now');
  const [scanCfg, setScanCfg] = useState<ImportScanConfig>({
    techScan: true,
    discoverSubs: false,
    portScan: false,
    nuclei: false,
  });
  const [activeTab, setActiveTab] = useState<'upload' | 'manual'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Các cột metadata xuất hiện trong preview (union của meta keys)
  const metaColumns: string[] = [];
  for (const item of previewItems.slice(0, 200)) {
    for (const key of Object.keys(item.meta || {})) {
      if (!metaColumns.includes(key)) metaColumns.push(key);
    }
  }
  const previewMetaCols = metaColumns.slice(0, 3);

  const parseContent = async (content: string, name?: string) => {
    setIsParsing(true);
    try {
      const res = await fetch('/api/parse-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, fileName: name }),
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewItems(data.items || []);
        setGroupPreview(Array.isArray(data.groups) ? data.groups : []);
        setIsTemplateMode(data.template === 'domain-list');
        setDnsRecordCount(data.dnsRecordCount || 0);
      } else {
        // Fallback local parsing
        fallbackParse(content);
      }
    } catch {
      fallbackParse(content);
    } finally {
      setIsParsing(false);
    }
  };

  const fallbackParse = (text: string) => {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const results: CsvImportPreviewItem[] = [];
    const seen = new Set<string>();

    const domainRegex = /([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}/;

    for (const line of lines) {
      if (line.toLowerCase().startsWith('subdomain') || line.toLowerCase().startsWith('domain')) continue;
      const match = line.match(domainRegex);
      if (match) {
        const host = match[0].toLowerCase();
        if (!seen.has(host)) {
          seen.add(host);
          results.push({
            subdomain: host,
            detectedScheme: 'https',
            port: 443,
            normalizedUrl: `https://${host}`,
            isValid: true,
          });
        }
      }
    }
    setPreviewItems(results);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      parseContent(text, file.name);
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setCsvText(text);
        parseContent(text, file.name);
      };
      reader.readAsText(file);
    }
  };

  const loadSample = () => {
    setFileName('caobang_subdomains_sample.csv');
    setCsvText(SAMPLE_CSV);
    parseContent(SAMPLE_CSV, 'caobang_subdomains_sample.csv');
  };

  const handleImportSubmit = () => {
    // Loại DNS record (_domainkey/_dmarc/.arpa...) — không phải web asset để quét
    const scannableItems = previewItems.filter((i) => i.isValid && !i.isDnsRecord);
    if (scannableItems.length === 0) return;

    const targetGroupName = newGroupName.trim() ||
      (existingAssetGroups.find((g) => g.id === selectedGroup)?.name || 'Imported Subdomains');

    if (actionChoice === 'crontab' && onImportToCrontab) {
      onImportToCrontab(scannableItems.map((i) => i.normalizedUrl), `Cron Scan - ${targetGroupName}`);
    } else {
      onImportToScan(scannableItems, targetGroupName, selectedGroup, scanCfg);
    }
    onClose();
  };

  const validCount = previewItems.filter((i) => i.isValid && !i.isDnsRecord).length;
  const anyScanEnabled = scanCfg.techScan || scanCfg.discoverSubs || scanCfg.portScan;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0f1117] border border-slate-200 dark:border-[#232736] rounded-xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-800 dark:text-slate-200 transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#232736] bg-slate-50 dark:bg-[#141724]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Import Subdomains from CSV / TXT
                <span className="text-[11px] font-normal px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30">
                  ProjectDiscovery Compatible
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Nạp danh sách subdomain từ file CSV hoặc văn bản thô để quét và phân tích công nghệ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          {/* Tabs */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#232736] pb-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'upload'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                Upload File (CSV, TXT)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('manual')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'manual'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                Dán văn bản trực tiếp
              </button>
            </div>

            <button
              type="button"
              onClick={loadSample}
              className="flex items-center gap-1.5 text-xs text-indigo-700 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 px-3 py-1 rounded-md transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Nạp mẫu Caobang.gov.vn (11 subdomains)
            </button>
          </div>

          {/* Upload Dropzone */}
          {activeTab === 'upload' ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center
                ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 scale-[0.99]'
                    : 'border-slate-300 dark:border-[#2a3045] bg-slate-50 dark:bg-[#121522] hover:border-indigo-500/50 hover:bg-slate-100 dark:hover:bg-[#15192a]'
                }
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.tsv"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="w-14 h-14 rounded-full bg-slate-200 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3 shadow-inner">
                <Upload className="w-6 h-6 animate-pulse" />
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                Kéo & thả file CSV/TXT tại đây, hoặc <span className="text-indigo-600 dark:text-indigo-400 underline">duyệt từ máy</span>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
                Tự động nhận diện cột subdomain, domain, url (hỗ trợ phân cách bằng dấu phẩy, tab, chấm phẩy)
              </p>
              {fileName && (
                <div className="mt-4 flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-700/50 rounded-lg text-xs text-indigo-700 dark:text-indigo-300">
                  <FileText className="w-4 h-4" />
                  <span>{fileName}</span>
                  <span className="text-slate-500 dark:text-slate-400">({csvText.length} bytes)</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Dán danh sách Subdomains hoặc nội dung file CSV:</span>
                <span className="text-[11px] text-slate-400">Mỗi subdomain trên một dòng hoặc dạng CSV</span>
              </label>
              <textarea
                value={csvText}
                onChange={(e) => {
                  setCsvText(e.target.value);
                  parseContent(e.target.value, 'manual_paste.txt');
                }}
                rows={6}
                placeholder="login.caobang.gov.vn&#10;cloud.caobang.gov.vn&#10;thuvien.caobang.gov.vn&#10;..."
                className="w-full bg-slate-50 dark:bg-[#121522] border border-slate-300 dark:border-[#2a3045] rounded-lg p-3 text-xs font-mono text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          )}

          {/* Parsing state or Preview Table */}
          {isParsing ? (
            <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-xs flex items-center justify-center gap-2 bg-slate-50 dark:bg-[#121522] rounded-lg border border-slate-200 dark:border-[#232736]">
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" />
              Đang phân tích cấu trúc cột và chuẩn hóa Subdomains...
            </div>
          ) : previewItems.length > 0 ? (
            <div className="space-y-3 bg-slate-50 dark:bg-[#121522] p-4 rounded-xl border border-slate-200 dark:border-[#232736]">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Kết quả xem trước:</span>
                  {isTemplateMode && (
                    <span className="px-2 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-500/20 dark:text-violet-300 dark:border-violet-500/30 font-medium">
                      Template Domain List
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30 font-mono font-medium">
                    {validCount} mục tiêu hợp lệ
                  </span>
                  {isTemplateMode && groupPreview.length > 0 && (
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30 font-mono">
                      {groupPreview.length} domain gốc → {groupPreview.length} asset group
                    </span>
                  )}
                  {dnsRecordCount > 0 && (
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-500/20 dark:text-slate-300 dark:border-slate-500/30 font-mono">
                      {dnsRecordCount} DNS records (bỏ qua quét)
                    </span>
                  )}
                  {previewItems.length - validCount - dnsRecordCount > 0 && (
                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30 font-mono">
                      {previewItems.length - validCount - dnsRecordCount} không hợp lệ
                    </span>
                  )}
                </div>
                <span className="text-slate-400 text-[11px]">Hiển thị 8 mục đầu tiên</span>
              </div>

              {/* Preview Table */}
              <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-[#232736] rounded-lg bg-white dark:bg-[#0b0d14]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 dark:bg-[#141724] text-slate-600 dark:text-slate-400 sticky top-0 border-b border-slate-200 dark:border-[#232736]">
                    <tr>
                      <th className="py-2 px-3 font-semibold">Domain</th>
                      <th className="py-2 px-3 font-semibold">Domain gốc</th>
                      {previewMetaCols.map((col) => (
                        <th key={col} className="py-2 px-3 font-semibold">{col}</th>
                      ))}
                      <th className="py-2 px-3 font-semibold text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-[#1e2333] font-mono text-[11px]">
                    {previewItems.slice(0, 8).map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2 px-3 text-slate-800 dark:text-slate-200 font-semibold">
                          {item.subdomain}
                          {item.isDnsRecord && (
                            <span className="ml-1.5 text-[9px] px-1 rounded bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" title="Bản ghi DNS (DKIM/DMARC...) — bỏ qua quét">dns</span>
                          )}
                          {item.isWildcard && (
                            <span className="ml-1.5 text-[9px] px-1 rounded bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300" title="Wildcard">*</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-500 dark:text-slate-400">{item.rootDomain || '-'}</td>
                        {previewMetaCols.map((col) => (
                          <td key={col} className="py-2 px-3 text-slate-600 dark:text-slate-300 max-w-[140px] truncate" title={item.meta?.[col]}>
                            {item.meta?.[col] || <span className="text-slate-300 dark:text-slate-600">—</span>}
                          </td>
                        ))}
                        <td className="py-2 px-3 text-right">
                          {item.isDnsRecord ? (
                            <span className="text-slate-400 dark:text-slate-500">DNS</span>
                          ) : item.isValid ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                              <CheckCircle className="w-3.5 h-3.5" /> Valid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                              <AlertCircle className="w-3.5 h-3.5" /> Invalid
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {/* Cấu hình quét sau khi import */}
          {actionChoice === 'scan-now' && (
            <div className="rounded-xl border border-slate-200 dark:border-[#232736] bg-slate-50 dark:bg-[#121522] p-4 space-y-2.5">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Play className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                Cấu hình quét sau khi import:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {([
                  { key: 'techScan', title: 'Quét Tech Stack', desc: 'Fingerprint công nghệ + version từng mục tiêu', on: scanCfg.techScan, set: (v: boolean) => setScanCfg({ ...scanCfg, techScan: v }) },
                  { key: 'discoverSubs', title: 'Dò subdomain (subfinder)', desc: 'Tự dò sub của từng domain gốc, merge vào group', on: scanCfg.discoverSubs, set: (v: boolean) => setScanCfg({ ...scanCfg, discoverSubs: v }) },
                  { key: 'portScan', title: 'Quét port (httpx)', desc: 'Dò 79 web port phổ biến, service mới tự thêm vào group', on: scanCfg.portScan, set: (v: boolean) => setScanCfg({ ...scanCfg, portScan: v }) },
                  { key: 'nuclei', title: 'Nuclei tech sâu', desc: 'Chạy thêm nuclei -tags tech,discovery (chậm hơn ~30s/target)', on: scanCfg.nuclei, set: (v: boolean) => setScanCfg({ ...scanCfg, nuclei: v }) },
                ] as const).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => opt.set(!opt.on)}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                      opt.on
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                        : 'border-slate-200 bg-white dark:border-[#232736] dark:bg-[#121522] hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-semibold ${opt.on ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-300'}`}>
                        {opt.title}
                      </span>
                      <span className={`w-7 h-4 rounded-full relative transition ${opt.on ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${opt.on ? 'left-3.5' : 'left-0.5'}`} />
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
              {scanCfg.discoverSubs && (
                <div className="text-[10px] text-amber-600 dark:text-amber-400 flex items-start gap-1">
                  <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>Dò subdomain chạy subfinder trên từng domain gốc (30-90s/domain). Sub mới sẽ được lưu vào group — quét tech sau bằng nút "Quét Tech Stack" của từng group.</span>
                </div>
              )}
              {scanCfg.nuclei && (
                <div className="text-[10px] text-amber-600 dark:text-amber-400 flex items-start gap-1">
                  <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>Nuclei thêm ~30s-2p30s mỗi mục tiêu.</span>
                </div>
              )}
            </div>
          )}

          {/* Group & Action Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                {isTemplateMode ? 'Asset Groups sẽ tạo (theo domain gốc):' : 'Gán vào Asset Group (Nhóm tài sản):'}
              </label>
              {isTemplateMode ? (
                <div className="max-h-28 overflow-y-auto border border-slate-200 dark:border-[#2a3045] rounded-lg bg-slate-50 dark:bg-[#121522] divide-y divide-slate-200 dark:divide-[#1e2333]">
                  {groupPreview.map((g) => (
                    <div key={g.rootDomain} className="px-3 py-1.5 flex items-center justify-between text-xs">
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{g.rootDomain}</span>
                      <span className="flex items-center gap-1.5">
                        {g.tags.slice(0, 2).map((t) => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">{t}</span>
                        ))}
                        <span className="text-slate-400 font-mono">{g.assetCount} subs</span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <select
                    value={selectedGroup}
                    onChange={(e) => setSelectedGroup(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#121522] border border-slate-300 dark:border-[#2a3045] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    {existingAssetGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                    <option value="new">+ Tạo Asset Group mới...</option>
                  </select>

                  {selectedGroup === 'new' && (
                    <input
                      type="text"
                      placeholder="Nhập tên Asset Group (ví dụ: caobang.gov.vn)..."
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      className="w-full mt-2 bg-slate-50 dark:bg-[#121522] border border-indigo-500 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500"
                    />
                  )}
                </>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Play className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                Thao tác sau khi Import:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setActionChoice('scan-now')}
                  className={`p-2 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                    actionChoice === 'scan-now'
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-900 dark:text-white'
                      : 'border-slate-200 bg-white dark:border-[#232736] dark:bg-[#121522] text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="font-semibold text-[11px] text-indigo-600 dark:text-indigo-300 flex items-center gap-1">
                    ⚡ Quét Tech ngay
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Bắt đầu phát hiện Tech tức thời</div>
                </button>

                <button
                  type="button"
                  onClick={() => setActionChoice('crontab')}
                  className={`p-2 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                    actionChoice === 'crontab'
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-900 dark:text-white'
                      : 'border-slate-200 bg-white dark:border-[#232736] dark:bg-[#121522] text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="font-semibold text-[11px] text-emerald-600 dark:text-emerald-300 flex items-center gap-1">
                    ⏱️ Tạo Crontab Scan
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Lên lịch quét tự động định kỳ</div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-[#232736] bg-slate-50 dark:bg-[#141724] flex items-center justify-between">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {validCount > 0 ? (
              <span>
                Sẵn sàng import <strong className="text-slate-900 dark:text-white">{validCount}</strong> subdomains
              </span>
            ) : (
              <span>Chưa có subdomain nào được tải lên</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={validCount === 0 || isParsing || (actionChoice === 'scan-now' && !anyScanEnabled)}
              onClick={handleImportSubmit}
              className="px-5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all cursor-pointer"
            >
              {actionChoice === 'scan-now' ? 'Bắt đầu quét Tech' : 'Lưu & Tạo Lịch Scan'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
