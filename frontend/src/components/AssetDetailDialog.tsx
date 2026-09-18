import React, { useState } from 'react';
import {
  X,
  ExternalLink,
  Copy,
  Check,
  Server,
  Shield,
  Clock,
  Terminal,
  FileCode,
  Globe,
  Layers,
} from 'lucide-react';
import { ScanResult } from '../types';
import { QChip, QBtn } from './QuasarUiElements';

interface AssetDetailDialogProps {
  asset: ScanResult | null;
  onClose: () => void;
  onViewTechAsset?: (asset: ScanResult) => void;
}

export const AssetDetailDialog: React.FC<AssetDetailDialogProps> = ({ asset, onClose, onViewTechAsset }) => {
  const [activeTab, setActiveTab] = useState<'headers' | 'tech' | 'raw'>('headers');
  const [copied, setCopied] = useState<string | null>(null);

  if (!asset) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  const curlCommand = `curl -i -L -A "Mozilla/5.0 (compatible; TechAsset-Scanner/2.0)" "${asset.url}"`;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="bg-white dark:bg-[#121522] w-full max-w-3xl max-h-[90vh] rounded-xl q-shadow-3 border border-slate-200 dark:border-[#232736] flex flex-col overflow-hidden transition-colors">
        {/* Modal Header */}
        <div className="p-4 bg-slate-50 dark:bg-[#0e121d] border-b border-slate-200 dark:border-[#1c2234] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1976D2] text-white flex items-center justify-center font-bold text-xs">
              HTTP
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">{asset.host}</h3>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                    asset.statusCode >= 200 && asset.statusCode < 300
                      ? 'bg-[#21BA45]/20 text-[#1b9937] dark:text-emerald-400'
                      : 'bg-[#1976D2]/20 text-[#1976D2] dark:text-blue-400'
                  }`}
                >
                  {asset.statusCode} {asset.statusText}
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-md">{asset.url}</p>
              {asset.meta && Object.keys(asset.meta).length > 0 && (
                <div className="flex flex-wrap items-center gap-1 mt-1.5">
                  {Object.entries(asset.meta).map(([key, value]) => (
                    <span
                      key={key}
                      title={`${key}: ${value}`}
                      className="inline-flex items-center gap-1 max-w-[260px] text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 dark:bg-[#151928] dark:text-slate-300 dark:border-[#27304d]"
                    >
                      <span className="text-slate-400 dark:text-slate-500 truncate">{key}:</span>
                      <span className="font-semibold truncate">{value}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onViewTechAsset && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onViewTechAsset(asset);
                }}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Xem Tech Asset</span>
              </button>
            )}
            <a
              href={asset.url}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded text-slate-500 hover:text-[#1976D2] hover:bg-slate-200 dark:hover:bg-slate-800 transition"
              title="Mở URL trong tab mới"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Metadata Strip */}
        <div className="px-4 py-2.5 bg-blue-50/50 dark:bg-[#161c2e] border-b border-slate-200 dark:border-[#232b45] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Thời gian phản hồi</div>
            <div className="font-semibold text-slate-800 dark:text-slate-200 font-mono">{asset.responseTimeMs} ms</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Địa chỉ IP</div>
            <div className="font-semibold text-slate-800 dark:text-slate-200 font-mono">{asset.ip || 'N/A'}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Máy chủ Web</div>
            <div className="font-semibold text-slate-800 dark:text-slate-200 font-mono">{asset.webServer || 'N/A'}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Độ dài nội dung</div>
            <div className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
              {asset.contentLength ? `${(asset.contentLength / 1024).toFixed(1)} KB` : 'N/A'}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-4 border-b border-slate-200 dark:border-[#232736] flex gap-4 text-xs font-medium">
          <button
            onClick={() => setActiveTab('headers')}
            className={`py-2.5 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'headers'
                ? 'border-[#1976D2] text-[#1976D2] dark:text-blue-400 font-bold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Response Headers ({Object.keys(asset.headers || {}).length})</span>
          </button>

          <button
            onClick={() => setActiveTab('tech')}
            className={`py-2.5 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'tech'
                ? 'border-[#1976D2] text-[#1976D2] dark:text-blue-400 font-bold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Công nghệ nhận diện ({asset.technologies.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('raw')}
            className={`py-2.5 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'raw'
                ? 'border-[#1976D2] text-[#1976D2] dark:text-blue-400 font-bold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Raw JSON &amp; cURL</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 p-4 overflow-y-auto">
          {activeTab === 'headers' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                <span>Các HTTP Header trả về từ máy chủ:</span>
                <button
                  onClick={() =>
                    copyToClipboard(
                      Object.entries(asset.headers)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join('\n'),
                      'headers'
                    )
                  }
                  className="text-[#1976D2] dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                >
                  {copied === 'headers' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copied === 'headers' ? 'Đã sao chép' : 'Sao chép tất cả'}</span>
                </button>
              </div>

              <div className="bg-slate-50 dark:bg-[#0b0d14] rounded-lg border border-slate-200 dark:border-[#232736] divide-y divide-slate-200/60 dark:divide-[#1e2333] font-mono text-xs">
                {Object.entries(asset.headers).length === 0 ? (
                  <div className="p-4 text-slate-400 text-center italic">
                    Không có thông tin headers hoặc máy chủ không thể phản hồi.
                  </div>
                ) : (
                  Object.entries(asset.headers).map(([key, val]) => (
                    <div
                      key={key}
                      className="p-2 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 hover:bg-slate-100/60 dark:hover:bg-slate-800/40"
                    >
                      <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0">{key}:</span>
                      <span className="text-slate-600 dark:text-slate-400 break-all text-right">{val}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'tech' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Các chữ ký công nghệ (Frameworks, CMS, CDN, Web Server) phát hiện bởi bộ quét:
              </div>

              {asset.technologies.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-slate-50 dark:bg-[#0b0d14] rounded-lg border border-slate-200 dark:border-[#232736] italic text-xs">
                  Không phát hiện chữ ký công nghệ nào trên trang này.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {asset.technologies.map((tech, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 dark:bg-[#0e121d] rounded-lg border border-slate-200 dark:border-[#1c2234] flex items-start justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: tech.color || '#1976D2' }}
                          />
                          <span className="font-bold text-xs text-slate-900 dark:text-white">{tech.name}</span>
                          {tech.version && (
                            <span className="text-[10px] bg-slate-200 dark:bg-slate-800 px-1.5 py-0.2 rounded font-mono text-slate-700 dark:text-slate-300">
                              v{tech.version}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          Phân loại: <span className="font-medium text-slate-700 dark:text-slate-300">{tech.category}</span>
                        </div>
                      </div>

                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: tech.color ? `${tech.color}15` : '#1976D215',
                          color: tech.color || '#1976D2',
                        }}
                      >
                        Fingerprinted
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'raw' && (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Lệnh cURL tái tạo:</span>
                  <button
                    onClick={() => copyToClipboard(curlCommand, 'curl')}
                    className="text-[#1976D2] dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copied === 'curl' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copied === 'curl' ? 'Đã sao chép' : 'Sao chép'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-[#0d1117] text-emerald-400 rounded-lg font-mono text-xs overflow-x-auto select-all border border-slate-800">
                  <code>{curlCommand}</code>
                </pre>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Asset Record JSON:</span>
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(asset, null, 2), 'json')}
                    className="text-[#1976D2] dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copied === 'json' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copied === 'json' ? 'Đã sao chép' : 'Sao chép'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-[#0d1117] text-slate-200 rounded-lg font-mono text-xs max-h-64 overflow-y-auto select-all border border-slate-800">
                  <code>{JSON.stringify(asset, null, 2)}</code>
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 dark:bg-[#0e121d] border-t border-slate-200 dark:border-[#1c2234] flex items-center justify-between">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            Scanned at: {new Date(asset.timestamp).toLocaleString('vi-VN')}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
