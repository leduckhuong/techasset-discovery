/**
 * Modal tạo Asset Group mới — đặt tên tuỳ ý (thay vì mặc định theo domain),
 * kèm root domain bắt buộc + mô tả/tags/subdomain ban đầu (tuỳ chọn).
 * Backend: POST /api/asset-groups (subdomain mới sẽ tự thành asset "Chưa quét").
 */
import React, { useState } from 'react';
import { Layers, X, Loader2 } from 'lucide-react';
import { AssetGroup } from '../types';

interface CreateGroupModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (group: AssetGroup) => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ open, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [rootDomain, setRootDomain] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [subdomains, setSubdomains] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const reset = () => {
    setName(''); setRootDomain(''); setDescription(''); setTags(''); setSubdomains('');
    setError(null);
  };

  const submit = async () => {
    if (!name.trim() || !rootDomain.trim() || busy) return;
    setBusy(true); setError(null);
    try {
      const subs = subdomains
        .split(/[\n,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const res = await fetch('/api/asset-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          rootDomain: rootDomain.trim().toLowerCase(),
          description: description.trim(),
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
          subdomains: subs,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Lỗi tạo nhóm');
      const group: AssetGroup = await res.json();
      reset();
      onCreated(group);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Lỗi tạo nhóm');
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'w-full bg-white dark:bg-[#0d1120] border border-slate-300 dark:border-[#2a3350] rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" />
      <div
        className="relative bg-white dark:bg-[#0d101a] border border-slate-200 dark:border-[#1b2133] rounded-2xl shadow-2xl w-full max-w-lg p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-500" /> Tạo Asset Group mới
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="block">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Tên nhóm *</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VD: Khách hàng SohaGame — Production"
            className={`${inputCls} mt-1 font-semibold`}
          />
        </label>

        <label className="block">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Root domain * (eTLD+1)</span>
          <input
            value={rootDomain}
            onChange={(e) => setRootDomain(e.target.value)}
            placeholder="VD: sohagame.com"
            className={`${inputCls} mt-1 font-mono`}
          />
        </label>

        <label className="block">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Mô tả</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Mô tả ngắn về nhóm tài sản"
            className={`${inputCls} mt-1`}
          />
        </label>

        <label className="block">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Tags (phân tách bởi dấu phẩy)</span>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="VD: production, quan-trong"
            className={`${inputCls} mt-1`}
          />
        </label>

        <label className="block">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Subdomain ban đầu (tuỳ chọn — mỗi dòng 1 domain, sẽ thành asset "Chưa quét")
          </span>
          <textarea
            value={subdomains}
            onChange={(e) => setSubdomains(e.target.value)}
            rows={4}
            placeholder={'api.sohagame.com\nwww.sohagame.com'}
            className={`${inputCls} mt-1 font-mono resize-y`}
          />
        </label>

        {error && (
          <div className="text-[11px] text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!name.trim() || !rootDomain.trim() || busy}
          className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
          {busy ? 'Đang tạo...' : 'Tạo nhóm'}
        </button>
      </div>
    </div>
  );
};
