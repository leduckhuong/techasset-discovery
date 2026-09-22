/**
 * Admin Settings — cấu hình env của app (Telegram/AI/auth/engine).
 * GET/PUT /api/admin/settings (yêu cầu đăng nhập admin hoặc X-API-Key).
 * Key "hot" áp dụng ngay; key "restart" cần restart container.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Settings, RefreshCw, Check, AlertCircle, Save } from 'lucide-react';

interface KeyInfo {
  label: string;
  set: boolean;
  value: string;
}

interface SettingsPayload {
  authEnabled: boolean;
  hot: Record<string, KeyInfo>;
  restart: Record<string, KeyInfo>;
  restartNote: string;
}

// KeyInfo cần renderInput — định nghĩa local để Object.entries không mất type
type KeyInfoEntry = [string, KeyInfo];

export const AdminSettingsView: React.FC = () => {
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [hotValues, setHotValues] = useState<Record<string, string>>({});
  const [restartValues, setRestartValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [showSecrets, setShowSecrets] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings');
      const d: SettingsPayload = await res.json();
      setData(d);
      const hv: Record<string, string> = {};
      for (const [k, info] of Object.entries(d.hot)) hv[k] = info.value;
      const rv: Record<string, string> = {};
      for (const [k, info] of Object.entries(d.restart)) rv[k] = info.value;
      setHotValues(hv);
      setRestartValues(rv);
    } catch {
      setMessage({ ok: false, text: 'Không tải được cấu hình' });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (section: 'hot' | 'restart') => {
    setSaving(true);
    setMessage(null);
    try {
      const values = section === 'hot' ? hotValues : restartValues;
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Lỗi lưu cấu hình');
      const rr: string[] = d.restartRequired || [];
      setMessage({
        ok: true,
        text: rr.length
          ? `Đã lưu ${Object.keys(values).length} cấu hình. Cần restart container để áp dụng: ${rr.join(', ')}`
          : `Đã áp dụng ${Object.keys(values).length} cấu hình ngay lập tức.`,
      });
      await load();
    } catch (err: any) {
      setMessage({ ok: false, text: `Lưu thất bại: ${err?.message || 'lỗi'}` });
    } finally {
      setSaving(false);
    }
  };

  const renderInput = (key: string, info: KeyInfo, section: 'hot' | 'restart') => {
    const isSecret = ['TELEGRAM_BOT_TOKEN', 'AI_API_KEY', 'CVE_PUSH_API_KEY', 'ADMIN_PASSWORD', 'TOTP_SECRET', 'SESSION_SECRET'].includes(key);
    const values = section === 'hot' ? hotValues : restartValues;
    const value = values[key] ?? info.value ?? '';
    return (
      <div key={key} className="grid grid-cols-[minmax(140px,220px)_1fr] gap-3 items-center py-1.5">
        <label className="text-xs font-medium text-slate-600 dark:text-slate-300" title={key}>
          {info.label}
        </label>
        <input
          type={isSecret && !showSecrets ? 'password' : 'text'}
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            section === 'hot'
              ? setHotValues((prev) => ({ ...prev, [key]: v }))
              : setRestartValues((prev) => ({ ...prev, [key]: v }));
          }}
          placeholder={info.set ? '•••••••• (đã cấu hình)' : ''}
          className="w-full bg-white dark:bg-[#0d1120] border border-slate-300 dark:border-[#2a3350] rounded px-2.5 py-1.5 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
        />
      </div>
    );
  };

  if (!data) {
    return (
      <div className="p-10 text-center text-sm text-slate-400">Đang tải cấu hình...</div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-indigo-500" />
            Cấu hình ứng dụng
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Quản trị env: Telegram, AI engine, bảo mật, engine tuning. Chỉ admin truy cập.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowSecrets((v) => !v)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-[#1a2033] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#232a42] transition cursor-pointer"
        >
          {showSecrets ? 'Ẩn giá trị' : 'Hiện giá trị'}
        </button>
      </div>

      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-xs flex items-start gap-2 border ${
            message.ok
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30'
              : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30'
          }`}
        >
          {message.ok ? <Check className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Hot keys */}
      <section className="bg-white dark:bg-[#0d101a] border border-slate-200 dark:border-[#1b2133] rounded-xl overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-[#1b2133] flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
            ⚡ Áp dụng ngay
          </h2>
          <button
            type="button"
            onClick={() => save('hot')}
            disabled={saving}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
          >
            <Save className="w-3.5 h-3.5" />
            Lưu & Áp dụng
          </button>
        </div>
        <div className="p-4">
          {(Object.entries(data.hot) as [string, KeyInfo][]).map(([key, info]) => renderInput(key, info, 'hot'))}
        </div>
      </section>

      {/* Restart keys */}
      <section className="bg-white dark:bg-[#0d101a] border border-slate-200 dark:border-[#1b2133] rounded-xl overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-[#1b2133] flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 dark:text-white">🔐 Bảo mật & vận hành (cần restart)</h2>
          <button
            type="button"
            onClick={() => save('restart')}
            disabled={saving}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 dark:bg-white text-white dark:text-black text-xs font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-slate-700 dark:hover:bg-slate-200 disabled:opacity-50 transition"
          >
            <Save className="w-3.5 h-3.5" />
            Lưu
          </button>
        </div>
        <div className="p-4">
          <div className="text-[11px] text-amber-600 dark:text-amber-400 mb-2 flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {data.restartNote}
          </div>
          {(Object.entries(data.restart) as [string, KeyInfo][]).map(([key, info]) => renderInput(key, info, 'restart'))}
        </div>
      </section>
    </div>
  );
};
