/**
 * Admin Settings — cấu hình env của app (Telegram/AI/auth/engine).
 * GET/PUT /api/admin/settings (yêu cầu đăng nhập admin hoặc X-API-Key).
 * Key "hot" áp dụng ngay; key "restart" cần restart container.
 * Kèm quản lý Telegram user session (MTProto) để đọc nhóm feed.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Settings, RefreshCw, Check, AlertCircle, Save, UserCheck, History, LogOut, Loader2 } from 'lucide-react';

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

interface UserSessionStatus {
  configured: boolean;
  loggedIn: boolean;
  user?: { id: number; firstName?: string; username?: string } | null;
  listening: boolean;
}

// KeyInfo cần renderInput — định nghĩa local để Object.entries không mất type
type KeyInfoEntry = [string, KeyInfo];

export const AdminSettingsView: React.FC = () => {
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [hotValues, setHotValues] = useState<Record<string, string>>({});
  const [restartValues, setRestartValues] = useState<Record<string, string>>({});
  const [original, setOriginal] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [showSecrets, setShowSecrets] = useState(false);

  // ---- Telegram user session (đọc nhóm feed bằng tài khoản user) ----
  const [usStatus, setUsStatus] = useState<UserSessionStatus | null>(null);
  const [usPhone, setUsPhone] = useState('');
  const [usCode, setUsCode] = useState('');
  const [usPassword, setUsPassword] = useState('');
  const [usNeedPassword, setUsNeedPassword] = useState(false);
  const [usStep, setUsStep] = useState<'idle' | 'code-sent'>('idle');
  const [usBusy, setUsBusy] = useState(false);
  const [usMessage, setUsMessage] = useState<string | null>(null);

  const loadUserSession = useCallback(async () => {
    try {
      const res = await fetch('/api/telegram/user-session/status');
      setUsStatus(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadUserSession();
  }, [loadUserSession]);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings');
      const d: SettingsPayload = await res.json();
      setData(d);
      const hv: Record<string, string> = {};
      const rv: Record<string, string> = {};
      const all: Record<string, string> = {};
      for (const [k, info] of Object.entries(d.hot)) {
        hv[k] = info.value;
        all[k] = info.value;
      }
      for (const [k, info] of Object.entries(d.restart)) {
        rv[k] = info.value;
        all[k] = info.value;
      }
      setHotValues(hv);
      setRestartValues(rv);
      setOriginal(all);
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
      // Chỉ gửi field người dùng THAY ĐỔI so với lúc load — ô secret được GET
      // mask về "" nên gửi nguyên form sẽ xoá sạch key đang cấu hình.
      const changed: Record<string, string> = {};
      for (const [k, v] of Object.entries(values)) {
        if (v !== (original[k] ?? '')) changed[k] = v;
      }
      if (!Object.keys(changed).length) {
        setMessage({ ok: true, text: 'Không có thay đổi nào để lưu.' });
        setSaving(false);
        return;
      }
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: changed }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Lỗi lưu cấu hình');
      const rr: string[] = d.restartRequired || [];
      const kept: string[] = d.kept || [];
      setMessage({
        ok: true,
        text: [
          `Đã lưu ${Object.keys(changed).length} cấu hình.`,
          kept.length ? `Giữ nguyên (không cho xoá bằng ô trống): ${kept.join(', ')}.` : '',
          rr.length ? `Cần restart container để áp dụng: ${rr.join(', ')}` : 'Áp dụng ngay lập tức.',
        ].filter(Boolean).join(' '),
      });
      await load();
    } catch (err: any) {
      setMessage({ ok: false, text: `Lưu thất bại: ${err?.message || 'lỗi'}` });
    } finally {
      setSaving(false);
    }
  };

  const handleUsSendCode = async () => {
    if (!usPhone.trim() || usBusy) return;
    setUsBusy(true); setUsMessage(null);
    try {
      const res = await fetch('/api/telegram/user-session/login-start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: usPhone }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error || 'lỗi');
      setUsStep('code-sent');
      setUsMessage('Đã gửi mã OTP tới Telegram của bạn — kiểm tra app Telegram.');
    } catch (err: any) {
      setUsMessage(`Lỗi gửi mã: ${err?.message || 'lỗi'}`);
    } finally { setUsBusy(false); }
  };

  const handleUsVerify = async () => {
    if (!usCode.trim() || usBusy) return;
    setUsBusy(true); setUsMessage(null);
    try {
      const res = await fetch('/api/telegram/user-session/login-verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: usCode, password: usPassword }),
      });
      const d = await res.json();
      if (d.needPassword) { setUsNeedPassword(true); setUsMessage(d.error || 'Cần mật khẩu 2FA'); return; }
      if (!d.ok) throw new Error(d.error || 'lỗi');
      setUsStep('idle'); setUsCode(''); setUsPassword(''); setUsNeedPassword(false);
      setUsMessage('Đăng nhập thành công — listener user session đã bật.');
      await loadUserSession();
    } catch (err: any) {
      setUsMessage(`Lỗi xác thực: ${err?.message || 'lỗi'}`);
    } finally { setUsBusy(false); }
  };

  const handleUsLogout = async () => {
    setUsBusy(true);
    try {
      await fetch('/api/telegram/user-session/logout', { method: 'POST' });
      await loadUserSession();
      setUsMessage('Đã đăng xuất và xoá session.');
    } finally { setUsBusy(false); }
  };

  const handleUsBackfill = async (hours: number) => {
    setUsBusy(true); setUsMessage(null);
    try {
      const res = await fetch('/api/telegram/user-session/backfill', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error || 'lỗi');
      setUsMessage(`Đã kích hoạt quét ${hours}h lịch sử nhóm feed — CVE mới sẽ vào kho trong vài phút (mục Kho CVE).`);
    } catch (err: any) {
      setUsMessage(`Lỗi quét lịch sử: ${err?.message || 'lỗi'}`);
    } finally { setUsBusy(false); }
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
          placeholder={info.set ? '•••••••• (đã cấu hình — để trống là giữ nguyên)' : ''}
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

      {/* Telegram user session */}
      <section className="bg-white dark:bg-[#0d101a] border border-slate-200 dark:border-[#1b2133] rounded-xl overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-[#1b2133] flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-500" />
            Telegram User Session — đọc nhóm feed bằng tài khoản user
          </h2>
          {usStatus && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              usStatus.loggedIn
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30'
                : 'bg-slate-200 text-slate-500 dark:bg-[#1a2033] dark:text-slate-400 border-transparent'
            }`}>
              {usStatus.loggedIn ? `Đã đăng nhập: ${usStatus.user?.firstName || usStatus.user?.username || 'user'}${usStatus.listening ? ' · đang nghe' : ''}` : 'Chưa đăng nhập'}
            </span>
          )}
        </div>
        <div className="p-4 space-y-3">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Bot Telegram bị chế độ privacy mode chặn và không đọc được lịch sử chat. Đăng nhập
            <b> tài khoản Telegram của bạn</b> (chỉ 1 lần) để app đọc nhóm feed bằng session user — thấy
            <b> mọi tin nhắn</b> không cần quyền admin nhóm. Session chỉ dùng để <b>ĐỌC</b>; app không gửi
            bất kỳ tin nào bằng tài khoản này.
          </p>
          {usStatus?.loggedIn ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleUsBackfill(24)}
                disabled={usBusy}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
              >
                {usBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <History className="w-3.5 h-3.5" />}
                Quét lịch sử nhóm feed (24h)
              </button>
              <button
                type="button"
                onClick={() => handleUsBackfill(7 * 24)}
                disabled={usBusy}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#1a2033] dark:hover:bg-[#232a42] text-slate-600 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
              >
                Quét 7 ngày
              </button>
              <button
                type="button"
                onClick={handleUsLogout}
                disabled={usBusy}
                className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
              >
                <LogOut className="w-3.5 h-3.5" /> Đăng xuất
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-[minmax(140px,220px)_1fr_auto] gap-2 items-center">
                <input
                  value={usPhone}
                  onChange={(e) => setUsPhone(e.target.value)}
                  placeholder="+84 9xx xxx xxx"
                  className="bg-white dark:bg-[#0d1120] border border-slate-300 dark:border-[#2a3350] rounded px-2.5 py-1.5 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                />
                <input
                  value={usCode}
                  onChange={(e) => setUsCode(e.target.value)}
                  placeholder={usStep === 'code-sent' ? 'Mã OTP Telegram (5 chữ số)' : 'Mã OTP (nhập sau khi bấm gửi mã)'}
                  disabled={usStep !== 'code-sent'}
                  className="bg-white dark:bg-[#0d1120] border border-slate-300 dark:border-[#2a3350] rounded px-2.5 py-1.5 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={usStep === 'code-sent' ? handleUsVerify : handleUsSendCode}
                  disabled={usBusy || (usStep === 'code-sent' ? !usCode.trim() : !usPhone.trim())}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition justify-center"
                >
                  {usBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  {usStep === 'code-sent' ? 'Xác thực' : 'Gửi mã OTP'}
                </button>
              </div>
              {usNeedPassword && (
                <input
                  type="password"
                  value={usPassword}
                  onChange={(e) => setUsPassword(e.target.value)}
                  placeholder="Mật khẩu 2FA của Telegram"
                  className="w-full bg-white dark:bg-[#0d1120] border border-slate-300 dark:border-[#2a3350] rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              )}
            </div>
          )}
          {usMessage && (
            <div className="text-[11px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#161c2e] rounded px-3 py-2">
              {usMessage}
            </div>
          )}
        </div>
      </section>

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
