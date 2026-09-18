/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ProjectDiscoverySidebar, MainNavSection } from './components/ProjectDiscoverySidebar';
import { ProjectDiscoveryAssetGroupView } from './components/ProjectDiscoveryAssetGroupView';
import { AssetGroupsTableView } from './components/AssetGroupsTableView';
import { TechAssetDetailView } from './components/TechAssetDetailView';
import { CsvImportModal } from './components/CsvImportModal';
import { CrontabScanManager } from './components/CrontabScanManager';
import { DashboardOverview } from './components/DashboardOverview';
import { ScanInputCard } from './components/ScanInputCard';
import { AssetTable } from './components/AssetTable';
import { TechMatrixView } from './components/TechMatrixView';
import { ScannerTerminal } from './components/ScannerTerminal';
import { VueQuasarCodeModal } from './components/VueQuasarCodeModal';
import { AssetDetailDialog } from './components/AssetDetailDialog';
import { CveAlertsAgentView } from './components/CveAlertsAgentView';
import { BotWebhookModal } from './components/BotWebhookModal';
import { ScanResult, ScanOptions, TargetPreset, AssetGroup, CrontabScanJob, CveItem, CveMatchAlert, CsvImportPreviewItem, ImportScanConfig } from './types';
import { runAgentFullCorrelation } from './utils/cveMatcher';
import {
  Code2,
  FileSpreadsheet,
  Clock,
  Radar,
  Server,
  Layers,
  Sparkles,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Database,
  ShieldAlert,
  Bot,
  Send,
  Menu,
  Sun,
  Moon,
  X,
} from 'lucide-react';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('pd_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
    localStorage.setItem('pd_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const [currentSection, setCurrentSection] = useState<MainNavSection>('cve-alerts');
  const [assetGroups, setAssetGroups] = useState<AssetGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedAssetForTech, setSelectedAssetForTech] = useState<ScanResult | null>(null);
  const [assets, setAssets] = useState<ScanResult[]>([]);
  const [crontabJobs, setCrontabJobs] = useState<CrontabScanJob[]>([]);

  // CVE & In-App Correlation Agent States
  const [cves, setCves] = useState<CveItem[]>([]);
  const [cveAlerts, setCveAlerts] = useState<CveMatchAlert[]>([]);
  const [isBotWebhookOpen, setIsBotWebhookOpen] = useState(false);
  const [isAgentRunning, setIsAgentRunning] = useState(false);

  // Dialog & Modal states
  const [isImportCsvOpen, setIsImportCsvOpen] = useState(false);
  const [isVueCodeOpen, setIsVueCodeOpen] = useState(false);
  const [selectedAssetDetail, setSelectedAssetDetail] = useState<ScanResult | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Scanner interactive states
  // Danh sách mục tiêu: rỗng mặc định, nạp từ Asset Group thật hoặc import CSV
  const [urlsInput, setUrlsInput] = useState('');
  // Dải web port mặc định cho httpx (lưu localStorage khi người dùng sửa)
  const DEFAULT_PORT_LIST =
    '80,443,8009,8180,81,300,591,593,832,981,1000,1010,1311,2082,2087,2095,2096,' +
    '2480,3000,3128,3333,4243,4567,4711,4712,4993,5000,5104,5108,5800,6443,6543,' +
    '7000,7396,7474,8000,8001,8008,8014,8042,8069,8080,8081,8088,8090,8091,8118,' +
    '8123,8172,8222,8243,8280,8281,8333,8443,8500,8834,8880,8888,8983,9000,9043,' +
    '9060,9080,9090,9091,9200,9443,9800,9981,10000,12443,16080,18091,18092,20720,28017';
  const [scanOptions, setScanOptions] = useState<ScanOptions>({
    techDetect: true,
    statusCode: true,
    title: true,
    followRedirects: true,
    probe: true,
    timeoutSec: 6,
    threads: 5,
    nuclei: false,
    portScan: false,
    portList: localStorage.getItem('pd_port_list') || DEFAULT_PORT_LIST,
  });

  useEffect(() => {
    localStorage.setItem('pd_port_list', scanOptions.portList);
  }, [scanOptions.portList]);
  const [scanning, setScanning] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [currentScanningHost, setCurrentScanningHost] = useState<string>('');
  // Log append-only cho terminal (tách khỏi assets để không bị reshuffle)
  const [scanLog, setScanLog] = useState<ScanResult[]>([]);
  const [selectedTechFilter, setSelectedTechFilter] = useState<string | null>(null);
  const [presets, setPresets] = useState<TargetPreset[]>([]);

  // Fetch scan presets from backend
  useEffect(() => {
    fetch('/api/presets')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setPresets(data);
      })
      .catch(() => {});
  }, []);


  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch backend Crontab Jobs, Asset Groups, Assets, and CVEs
  useEffect(() => {
    fetch('/api/cron-jobs')
      .then((res) => res.json())
      .then((data) => {
        if (data.jobs && Array.isArray(data.jobs)) {
          setCrontabJobs(data.jobs);
        }
      })
      .catch(() => {});

    fetch('/api/asset-groups')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setAssetGroups(data);
        }
      })
      .catch(() => {});

    fetch('/api/cve/list')
      .then((res) => res.json())
      .then((data) => {
        if (data.cves && Array.isArray(data.cves)) {
          setCves(data.cves);
        }
      })
      .catch(() => {});

    fetch('/api/cve/alerts')
      .then((res) => res.json())
      .then((data) => {
        if (data.alerts && Array.isArray(data.alerts)) {
          setCveAlerts(data.alerts);
        }
      })
      .catch(() => {});

    fetch('/api/assets')
      .then((res) => res.json())
      .then((data) => {
        if (data.assets && Array.isArray(data.assets) && data.assets.length > 0) {
          setAssets((prev) => {
            const existingUrls = new Set(data.assets.map((a: any) => a.url));
            return [...data.assets, ...prev.filter((a) => !existingUrls.has(a.url))];
          });
          // Terminal log: seed scrollback ban đầu (cũ → mới), sau đó chỉ APPEND,
          // không bao giờ đảo/xáo trộn lại — để giống terminal thật
          setScanLog((prev) => (prev.length > 0 ? prev : [...data.assets].slice().reverse()));
        }
      })
      .catch(() => {});
  }, []);

  // Bot Webhook Push handler
  const handlePushCve = async (cveData: Partial<CveItem>) => {
    try {
      const res = await fetch('/api/cve/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cveData),
      });
      const data = await res.json();
      if (res.ok && data.cve) {
        setCves((prev) => [data.cve, ...prev.filter((c) => c.cveId !== data.cve.cveId)]);
        if (data.alertsCreated && Array.isArray(data.alertsCreated)) {
          setCveAlerts((prev) => {
            const newKeys = new Set(data.alertsCreated.map((a: any) => `${a.cveId}-${a.matchedAssetId}`));
            return [...data.alertsCreated, ...prev.filter((a) => !newKeys.has(`${a.cveId}-${a.matchedAssetId}`))];
          });
        }
        showToast(`Bot đã đẩy thành công ${data.cve.cveId}! Agent phát hiện ${data.matchedCount} tài sản trùng khớp`);
        return data;
      } else {
        throw new Error(data.error || 'Thất bại');
      }
    } catch {
      const localCve: CveItem = {
        id: `cve-${Date.now()}`,
        cveId: (cveData.cveId || 'CVE-SAMPLE').toUpperCase(),
        software: cveData.software || 'Apache',
        affectedVersions: cveData.affectedVersions || '< 2.4.56',
        severity: cveData.severity || 'HIGH',
        cvssScore: Number(cveData.cvssScore) || 7.5,
        summary: cveData.summary || 'Cảnh báo từ Bot',
        remediation: cveData.remediation || 'Khuyến nghị nâng cấp phiên bản',
        source: cveData.source || 'Bot Webhook',
        pushedAt: new Date().toISOString(),
      };
      const newCves = [localCve, ...cves.filter((c) => c.cveId !== localCve.cveId)];
      setCves(newCves);
      const generated = runAgentFullCorrelation(newCves, assets);
      setCveAlerts(generated);
      const matched = generated.filter((a) => a.cveId === localCve.cveId);
      showToast(`Đã lưu ${localCve.cveId}! Agent phát hiện ${matched.length} tài sản trùng khớp`);
      return { success: true, cve: localCve, matchedCount: matched.length, matchedAssets: matched };
    }
  };

  // Re-run Agent Correlation
  const handleRunAgentRecheck = async () => {
    setIsAgentRunning(true);
    try {
      const res = await fetch('/api/cve/agent/run', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.alerts) setCveAlerts(data.alerts);
        showToast(`Agent đã hoàn tất so khớp: Tìm thấy ${data.totalAlertsMatched || 0} cảnh báo trùng khớp`);
      } else {
        const local = runAgentFullCorrelation(cves, assets);
        setCveAlerts(local);
        showToast(`Agent đã so khớp: Tìm thấy ${local.length} cảnh báo`);
      }
    } catch {
      const local = runAgentFullCorrelation(cves, assets);
      setCveAlerts(local);
      showToast(`Agent đã so khớp: ${local.length} tài sản phù hợp`);
    } finally {
      setIsAgentRunning(false);
    }
  };

  // Update alert status
  const handleUpdateAlertStatus = async (
    alertId: string,
    status: 'active' | 'investigating' | 'resolved'
  ) => {
    try {
      await fetch(`/api/cve/alerts/${alertId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
    } catch {}
    setCveAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, status } : a)));
    showToast(`Đã cập nhật trạng thái cảnh báo sang: ${status}`);
  };

  // Run Scan Logic
  const handleStartScan = async (urlsToScan?: string[]) => {
    const list = urlsToScan || urlsInput.split('\n').map((u) => u.trim()).filter(Boolean);
    if (list.length === 0) return;

    setCurrentSection('scans');
    setScanning(true);
    setProgressPercent(5);
    setCurrentScanningHost('Khởi động động cơ Tech Fingerprinting...');

    const newScannedAssets: ScanResult[] = [];
    const total = list.length;

    for (let i = 0; i < total; i++) {
      const url = list[i];
      setCurrentScanningHost(url);
      setProgressPercent(Math.round(((i + 0.3) / total) * 100));

      try {
        const res = await fetch('/api/scan-single', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url,
            timeout: scanOptions.timeoutSec,
            techDetect: scanOptions.techDetect,
            followRedirects: scanOptions.followRedirects,
            nuclei: scanOptions.nuclei,
          }),
        });

        if (res.ok) {
          const item: ScanResult = await res.json();
          item.assetGroupId = selectedGroupId;
          newScannedAssets.push(item);
          // Terminal: đẩy dòng mới xuống đáy log (append-only)
          setScanLog((prev) => [...prev, item]);
        }
      } catch {
        // Continue
      }
      setProgressPercent(Math.round(((i + 1) / total) * 100));
    }

    // httpx port probing (bật trong Tùy chọn nâng cao): dò web port trên các host vừa quét
    let portFound = 0;
    if (scanOptions.portScan && newScannedAssets.length > 0) {
      setCurrentScanningHost('httpx: đang dò web port...');
      try {
        const hosts = list.map((u) => {
          try {
            const p = new URL(u.startsWith('http') ? u : `https://${u}`);
            return p.port ? `${p.hostname}:${p.port}` : p.hostname;
          } catch {
            return u;
          }
        });
        const res2 = await fetch('/api/probe-ports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hosts, ports: scanOptions.portList }),
        });
        if (res2.ok) {
          const data = await res2.json();
          for (const r of data.results || []) {
            portFound++;
            setAssets((prev) => [r, ...prev.filter((a) => a.url !== r.url)]);
            setScanLog((prev) => [...prev, r]);
          }
        }
      } catch {
        // bỏ qua lỗi probe, giữ kết quả quét chính
      }
    }

    setScanning(false);
    setCurrentScanningHost('');
    setProgressPercent(100);

    if (newScannedAssets.length > 0) {
      setAssets((prev) => {
        const existingUrls = new Set(newScannedAssets.map((a) => a.url));
        return [...newScannedAssets, ...prev.filter((a) => !existingUrls.has(a.url))];
      });
      showToast(
        `Đã hoàn tất quét: Tìm thấy ${newScannedAssets.length} tài sản số` +
          (portFound ? ` — httpx phát hiện thêm ${portFound} service trên port` : ''),
      );
    }
  };

  // Dò web port bằng httpx cho 1 asset group — service tìm thấy lưu thành asset mới
  const [probingGroupId, setProbingGroupId] = useState<string | null>(null);
  const handleProbePorts = async (groupId: string) => {
    const grp = assetGroups.find((g) => g.id === groupId);
    if (!grp || probingGroupId) return;
    setProbingGroupId(groupId);
    try {
      const res = await fetch('/api/probe-ports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hosts: grp.subdomains, assetGroupId: groupId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'probe failed' }));
        throw new Error(err.detail || 'probe failed');
      }
      const data = await res.json();
      const results: ScanResult[] = data.results || [];
      for (const r of results) {
        setAssets((prev) => [r, ...prev.filter((a) => a.url !== r.url)]);
        setScanLog((prev) => [...prev, r]);
      }
      // merge host:port mới vào subdomains của group
      const subsSet = new Set(grp.subdomains);
      const newSubs: string[] = [];
      for (const r of results) {
        const hostPort = `${r.host}${r.port && r.port !== 80 && r.port !== 443 ? `:${r.port}` : ''}`;
        if (!subsSet.has(hostPort) && !subsSet.has(r.host)) newSubs.push(hostPort);
      }
      if (newSubs.length > 0) {
        const upd = await fetch(`/api/asset-groups/${groupId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subdomains: [...grp.subdomains, ...newSubs] }),
        });
        if (upd.ok) {
          const updated = await upd.json();
          setAssetGroups((prev) => prev.map((g) => (g.id === groupId ? updated : g)));
        }
      }
      showToast(
        `[httpx] Dò ${grp.subdomains.length} subdomain × 79 ports: tìm thấy ${data.total} service${newSubs.length ? ` (${newSubs.length} sub mới đã thêm vào group)` : ''}`,
      );
    } catch (err: any) {
      showToast(`Quét port thất bại: ${err?.message || 'lỗi không xác định'}`);
    } finally {
      setProbingGroupId(null);
    }
  };

  // Dò subdomain cho 1 asset group (subfinder / crt.sh) và merge vào group
  const [discoveringGroupId, setDiscoveringGroupId] = useState<string | null>(null);
  const handleDiscoverSubdomains = async (groupId: string, engine: 'subfinder' | 'crtsh') => {
    const grp = assetGroups.find((g) => g.id === groupId);
    if (!grp || discoveringGroupId) return;
    setDiscoveringGroupId(groupId);
    try {
      const res = await fetch('/api/discover-subdomains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootDomain: grp.rootDomain, engine }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const existing = new Set(grp.subdomains.map((s) => s.toLowerCase()));
      const newSubs: string[] = (data.subdomains || []).filter((s: string) => !existing.has(s.toLowerCase()));
      if (newSubs.length > 0) {
        const upd = await fetch(`/api/asset-groups/${groupId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subdomains: [...grp.subdomains, ...newSubs] }),
        });
        if (upd.ok) {
          const updated = await upd.json();
          setAssetGroups((prev) => prev.map((g) => (g.id === groupId ? updated : g)));
        }
      }
      showToast(
        `[${data.engine}] Tìm thấy ${data.total} subdomain của ${grp.rootDomain} — ${newSubs.length} mới (bấm "Quét Tech Stack" để quét)`,
      );
    } catch {
      showToast(`Tìm subdomain thất bại cho ${grp.rootDomain}`);
    } finally {
      setDiscoveringGroupId(null);
    }
  };

  // CSV Import Callback — hỗ trợ template "domain list" (1 domain gốc = 1 asset group,
  // giữ nguyên metadata DỰ ÁN/EMAIL/NOTE/...) và danh sách subdomain thuần
  const handleImportToScan = async (
    items: CsvImportPreviewItem[],
    _groupName?: string,
    _groupId?: string,
    cfg?: ImportScanConfig,
  ) => {
    if (items.length === 0) return;
    const config = cfg || { techScan: true, discoverSubs: false, portScan: false, nuclei: false };

    setCurrentSection('scans');
    setScanning(true);
    setProgressPercent(3);
    setCurrentScanningHost('Đăng ký pipeline import trên server...');

    try {
      const res = await fetch('/api/import-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          config,
          timeoutSec: scanOptions.timeoutSec,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { jobId } = await res.json();

      // Pipeline chạy NỀN trên server — đóng/refresh trang không ảnh hưởng.
      // Poll tiến độ mỗi 3s để cập nhật UI.
      for (;;) {
        await new Promise((r) => setTimeout(r, 3000));
        const jr = await fetch(`/api/import-jobs/${jobId}`);
        if (!jr.ok) throw new Error('mất kết nối tới import job');
        const job = await jr.json();
        setCurrentScanningHost(job.phase || '');
        setProgressPercent(Math.round(job.progress || 0));
        if (job.status === 'done' || job.status === 'error') {
          // refresh dữ liệu từ server
          const [aRes, gRes] = await Promise.all([fetch('/api/assets'), fetch('/api/asset-groups')]);
          const aData = await aRes.json();
          const gData = await gRes.json();
          if (Array.isArray(aData.assets)) {
            setAssets(aData.assets);
            setScanLog([...aData.assets].reverse());
          }
          if (Array.isArray(gData)) setAssetGroups(gData);
          if (job.status === 'error') throw new Error(job.error || 'pipeline lỗi');
          showToast(`Import hoàn tất: ${job.summary}`);
          break;
        }
      }
    } catch (err: any) {
      showToast(`Import pipeline thất bại: ${err?.message || 'lỗi không xác định'}`);
    } finally {
      setScanning(false);
      setCurrentScanningHost('');
    }
  };

  // Crontab Handlers
  const handleToggleCronJob = async (id: string, enabled: boolean) => {
    try {
      const res = await fetch(`/api/cron-jobs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCrontabJobs((prev) => prev.map((j) => (j.id === id ? updated : j)));
        showToast(`Đã ${enabled ? 'kích hoạt' : 'tạm dừng'} lịch quét định kỳ`);
      }
    } catch {
      setCrontabJobs((prev) => prev.map((j) => (j.id === id ? { ...j, enabled } : j)));
    }
  };

  const handleDeleteCronJob = async (id: string) => {
    try {
      await fetch(`/api/cron-jobs/${id}`, { method: 'DELETE' });
    } catch {}
    setCrontabJobs((prev) => prev.filter((j) => j.id !== id));
    showToast('Đã xóa lịch quét');
  };

  const handleRunCronNow = async (id: string) => {
    try {
      const res = await fetch(`/api/cron-jobs/${id}/run`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setCrontabJobs((prev) => prev.map((j) => (j.id === id ? data.job : j)));
        if (data.results && Array.isArray(data.results)) {
          setAssets((prev) => [...data.results, ...prev]);
          setScanLog((prev) => [...prev, ...data.results]);
        }
        showToast(`Đã kích hoạt quét ngay: Phát hiện ${data.job?.lastDiscoveredCount || 0} tài sản`);
      }
    } catch {
      showToast('Kích hoạt quét thất bại');
    }
  };

  const handleCreateCronJob = async (jobData: Partial<CrontabScanJob>) => {
    try {
      const res = await fetch('/api/cron-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobData),
      });
      if (res.ok) {
        const created = await res.json();
        setCrontabJobs((prev) => [created, ...prev]);
        showToast(`Đã tạo lịch quét Crontab mới: ${created.name}`);
      }
    } catch {
      const localJob = { ...jobData, id: `cron-${Date.now()}` } as CrontabScanJob;
      setCrontabJobs((prev) => [localJob, ...prev]);
      showToast('Đã lưu lịch quét mới');
    }
  };

  const handleDeleteAsset = (id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
    showToast('Đã gỡ bỏ tài sản khỏi nhóm');
  };

  const currentAssetGroup =
    assetGroups.find((g) => g.id === selectedGroupId) || assetGroups[0];

  // Assets belonging to currently active group (or all if inventory)
  const groupAssets = assets.filter(
    (a) => !a.assetGroupId || a.assetGroupId === selectedGroupId || currentSection === 'inventory'
  );

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-[#07090e] text-slate-800 dark:text-slate-100 font-sans overflow-hidden transition-colors duration-200">
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/60 dark:bg-black/75 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-indigo-900 text-indigo-100 dark:bg-indigo-950 dark:border-indigo-500/50 border border-indigo-300 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-3 text-xs">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* ProjectDiscovery Style Left Navigation Sidebar */}
      <ProjectDiscoverySidebar
        currentSection={currentSection}
        onSelectSection={(sec) => {
          if (sec === 'asset-groups') {
            setSelectedGroupId(null);
            setSelectedAssetForTech(null);
          }
          setCurrentSection(sec);
        }}
        assetGroups={assetGroups}
        selectedGroupId={selectedGroupId}
        onSelectGroup={(id) => {
          setSelectedGroupId(id);
          setSelectedAssetForTech(null);
          setCurrentSection('asset-groups');
        }}
        onOpenImportCsv={() => setIsImportCsvOpen(true)}
        onOpenCreateScan={() => setCurrentSection('scans')}
        onOpenCreateCron={() => setCurrentSection('crontab')}
        onOpenBotWebhook={() => setIsBotWebhookOpen(true)}
        inventoryCount={assets.length}
        cronJobsCount={crontabJobs.filter((j) => j.enabled).length}
        cveAlertsCount={cveAlerts.filter((a) => a.status !== 'resolved').length}
        cveCriticalCount={cveAlerts.filter((a) => a.severity === 'CRITICAL' && a.status !== 'resolved').length}
        isOpen={sidebarOpen}
        onToggleOpen={() => setSidebarOpen(!sidebarOpen)}
        isMobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-100 dark:bg-[#07090e] transition-colors duration-200">
        {/* Top Minimal Toolbar */}
        <header className="h-14 border-b border-slate-200 dark:border-[#1b1f2e] bg-white dark:bg-[#090c13] px-3 sm:px-6 flex items-center justify-between shrink-0 gap-2 transition-colors duration-200">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Mobile Menu Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#151928] lg:hidden transition-colors shrink-0 cursor-pointer"
              title="Mở menu"
              aria-label="Mở menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumbs */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 min-w-0">
              <span className="text-slate-700 dark:text-slate-300 font-semibold hidden sm:inline">ProjectDiscovery</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0 hidden sm:inline" />
              <span className="text-slate-800 dark:text-slate-200 font-medium capitalize truncate">
                {currentSection === 'cve-alerts'
                  ? 'Agent Cảnh Báo CVE & So Khớp Tech Asset'
                  : currentSection === 'asset-groups'
                  ? selectedAssetForTech
                    ? `Asset Groups / ${currentAssetGroup.name} / ${selectedAssetForTech.host} (Tech Asset)`
                    : selectedGroupId
                    ? `Asset Groups / ${currentAssetGroup.name}`
                    : 'Asset Groups'
                  : currentSection}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Light / Dark Mode Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-[#14192a] dark:hover:bg-[#1c233a] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#27304e] transition-all cursor-pointer shadow-xs"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-500" />
                  <span className="hidden md:inline">Sáng</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-indigo-600" />
                  <span className="hidden md:inline">Tối</span>
                </>
              )}
            </button>

            {/* Quick Bot Push Webhook Trigger */}
            <button
              type="button"
              onClick={() => setIsBotWebhookOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/80 dark:text-indigo-300 dark:border-indigo-500/40 transition-colors cursor-pointer"
              title="Mở cổng Webhook cho bot đẩy mã CVE"
            >
              <Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span className="hidden sm:inline">Bot Webhook</span>
            </button>

            {/* Quick Agent CVE Alerts shortcut */}
            <button
              type="button"
              onClick={() => setCurrentSection('cve-alerts')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                currentSection === 'cve-alerts'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 dark:border-rose-500/40'
              }`}
            >
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Agent Alerts</span>
              {cveAlerts.filter((a) => a.status !== 'resolved').length > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-500 text-white">
                  {cveAlerts.filter((a) => a.status !== 'resolved').length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsImportCsvOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-[#14192a] dark:hover:bg-[#1c233a] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#27304e] transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span className="hidden md:inline">Import CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setIsVueCodeOpen(true)}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-[#14192a] dark:hover:bg-[#1c233a] dark:text-emerald-300 dark:border-emerald-500/30 transition-colors cursor-pointer"
            >
              <Code2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Vue Quasar SFC</span>
            </button>

            <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">Agent LIVE</span>
            </div>
          </div>
        </header>

        {/* Scrollable Main Viewport */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 custom-scrollbar bg-slate-100 dark:bg-[#07090e] transition-colors duration-200">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* View 0: CORE AGENT CVE CORRELATION & BOT PUSH VIEW */}
            {currentSection === 'cve-alerts' && (
              <CveAlertsAgentView
                alerts={cveAlerts}
                cveAlerts={cveAlerts}
                cves={cves}
                assets={assets}
                onOpenBotWebhook={() => setIsBotWebhookOpen(true)}
                onOpenBotWebhookModal={() => setIsBotWebhookOpen(true)}
                onRunAgentRecheck={handleRunAgentRecheck}
                onRunAgentMatching={handleRunAgentRecheck}
                onUpdateAlertStatus={handleUpdateAlertStatus}
                onSelectAsset={(asset) => setSelectedAssetDetail(asset)}
                isAgentRunning={isAgentRunning}
              />
            )}

            {/* View 1: Asset Groups Hierarchical Flow (Level 1: Groups Table -> Level 2: Group Assets Table -> Level 3: Tech Asset Detail) */}
            {currentSection === 'asset-groups' && (
              <>
                {selectedAssetForTech ? (
                  /* Level 3: Tech Asset Detail (Cấp bé hơn của Asset) */
                  <TechAssetDetailView
                    asset={selectedAssetForTech}
                    assetGroup={currentAssetGroup}
                    cveAlerts={cveAlerts}
                    onBackToAssetsList={() => setSelectedAssetForTech(null)}
                    onNavigateToCveAlerts={() => setCurrentSection('cve-alerts')}
                  />
                ) : selectedGroupId ? (
                  /* Level 2: Assets Table của Group đã chọn */
                  <ProjectDiscoveryAssetGroupView
                    assetGroup={currentAssetGroup}
                    assets={groupAssets}
                    cveAlerts={cveAlerts}
                    onBackToGroups={() => {
                      setSelectedGroupId(null);
                      setSelectedAssetForTech(null);
                    }}
                    onNavigateToCveAlerts={() => setCurrentSection('cve-alerts')}
                    onOpenImportCsv={() => setIsImportCsvOpen(true)}
                    onStartScan={(urls) => handleStartScan(urls)}
                    onSelectAsset={(asset) => setSelectedAssetForTech(asset)}
                    onDeleteAsset={handleDeleteAsset}
                    onDiscoverSubdomains={(engine) => handleDiscoverSubdomains(currentAssetGroup.id, engine)}
                    discoveringSubs={discoveringGroupId === currentAssetGroup.id}
                    onProbePorts={() => handleProbePorts(currentAssetGroup.id)}
                    probingPorts={probingGroupId === currentAssetGroup.id}
                  />
                ) : (
                  /* Level 1: Bảng Danh Sách Asset Groups (Image 1) */
                  <AssetGroupsTableView
                    assetGroups={assetGroups}
                    assets={assets}
                    cveAlerts={cveAlerts}
                    onSelectGroup={(group) => {
                      setSelectedGroupId(group.id);
                      setSelectedAssetForTech(null);
                    }}
                    onOpenCreateGroup={() => setIsImportCsvOpen(true)}
                    onOpenImportCsv={() => setIsImportCsvOpen(true)}
                  />
                )}
              </>
            )}

            {/* View 2: Dashboard Overview */}
            {currentSection === 'dashboard' && (
              <DashboardOverview
                assets={assets}
                assetGroups={assetGroups}
                onNavigateToGroup={(id) => {
                  setSelectedGroupId(id);
                  setSelectedAssetForTech(null);
                  setCurrentSection('asset-groups');
                }}
                onOpenImportCsv={() => setIsImportCsvOpen(true)}
                onNavigateToCron={() => setCurrentSection('crontab')}
              />
            )}

            {/* View 3: Crontab Scans (Scheduled Scanning Manager) */}
            {currentSection === 'crontab' && (
              <CrontabScanManager
                jobs={crontabJobs}
                assetGroups={assetGroups}
                onToggleJob={handleToggleCronJob}
                onDeleteJob={handleDeleteCronJob}
                onRunNow={handleRunCronNow}
                onCreateJob={handleCreateCronJob}
                onSelectGroupView={(id) => {
                  setSelectedGroupId(id);
                  setCurrentSection('asset-groups');
                }}
              />
            )}

            {/* View 4: Scans (Live Scanner & Terminal) */}
            {currentSection === 'scans' && (
              <div className="space-y-6">
                <ScanInputCard
                  urlsInput={urlsInput}
                  onChangeUrls={setUrlsInput}
                  options={scanOptions}
                  onChangeOptions={setScanOptions}
                  onStartScan={() => handleStartScan()}
                  scanning={scanning}
                  presets={presets}
                  onLoadPreset={(preset) => {
                    setUrlsInput(preset.urls.join('\n'));
                    showToast(`Đã nạp preset: ${preset.name} (${preset.urls.length} mục tiêu)`);
                  }}
                  groups={assetGroups}
                  onLoadGroupDomains={(group) => {
                    if (!group.subdomains.length) {
                      showToast(`Group ${group.name} chưa có subdomain — bấm "Tìm Subdomain" trong trang group`);
                      return;
                    }
                    setUrlsInput(group.subdomains.map((s) => `https://${s}`).join('\n'));
                    showToast(`Đã nạp ${group.subdomains.length} domain từ group: ${group.name}`);
                  }}
                  progressPercent={progressPercent}
                  currentScanningHost={currentScanningHost}
                  onOpenImportModal={() => setIsImportCsvOpen(true)}
                />

                <ScannerTerminal lines={scanLog} isScanning={scanning} currentHost={currentScanningHost} />
              </div>
            )}

            {/* View 5: Inventory (Full Asset List Table & Filters) */}
            {currentSection === 'inventory' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#1e2333]">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Database className="w-5 h-5 text-indigo-400" />
                      All Inventory Discovered Assets ({assets.length})
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Toàn bộ tài sản số được lập chỉ mục kèm dữ liệu fingerprinting, thời gian phản hồi, mã trạng thái.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsImportCsvOpen(true)}
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md flex items-center gap-1.5 transition-all"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    Import CSV
                  </button>
                </div>

                <AssetTable
                  assets={assets}
                  groups={assetGroups}
                  selectedTechFilter={selectedTechFilter}
                  onSelectAsset={(asset) => setSelectedAssetDetail(asset)}
                  onClearFilter={() => setSelectedTechFilter(null)}
                />
              </div>
            )}

            {/* View 6: Reports */}
            {currentSection === 'reports' && (
              <div className="bg-[#121522] border border-[#232736] rounded-xl p-8 text-center">
                <FileSpreadsheet className="w-12 h-12 text-indigo-400 mx-auto mb-3" />
                <h3 className="text-base font-bold text-white">Xuất Báo Cáo Tài Sản Số &amp; Tech Stack</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-5">
                  Tải xuống bảng báo cáo tổng hợp đầy đủ các tài sản, công nghệ phát hiện, IP, ASN và phân tích chứng chỉ.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => {
                      const csvContent =
                        'data:text/csv;charset=utf-8,URL,Host,Port,Status,Title,IP,ASN,Techs\n' +
                        assets
                          .map(
                            (a) =>
                              `"${a.url}","${a.host}","${a.port || 443}","${a.statusCode}","${(a.title || '').replace(/"/g, '""')}","${a.ip || ''}","${a.asn || ''}","${a.technologies.map((t) => t.name).join(';')}"`
                          )
                          .join('\n');
                      const encodedUri = encodeURI(csvContent);
                      const link = document.createElement('a');
                      link.setAttribute('href', encodedUri);
                      link.setAttribute('download', 'projectdiscovery_tech_assets_report.csv');
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      showToast('Đã xuất file CSV báo cáo tài sản thành công!');
                    }}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 transition-all"
                  >
                    Tải về Báo Cáo CSV
                  </button>
                </div>
              </div>
            )}

            {/* View 8: Templates */}
            {currentSection === 'templates' && (
              <TechMatrixView
                assets={assets}
                onSelectTech={(tech) => {
                  setSelectedTechFilter(tech.name);
                  setCurrentSection('inventory');
                }}
              />
            )}

            {/* Fallback for other tabs */}
            {currentSection === 'settings' && (
              <div className="bg-[#121522] border border-[#232736] rounded-xl p-8 text-center text-slate-400">
                <div className="text-sm font-semibold text-white capitalize">{currentSection} Configuration</div>
                <div className="text-xs text-slate-500 mt-1">Cấu hình tích hợp Webhooks, Slack/Telegram Alert và API Keys.</div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* CSV Import Modal */}
      <CsvImportModal
        isOpen={isImportCsvOpen}
        onClose={() => setIsImportCsvOpen(false)}
        onImportToScan={handleImportToScan}
        onImportToCrontab={(urls, name) => {
          handleCreateCronJob({
            name,
            cronExpression: '0 2 * * *',
            scheduleHuman: 'Mỗi ngày lúc 02:00 AM',
            targetType: 'subdomain-list',
            targetUrls: urls,
            options: scanOptions,
            enabled: true,
            nextRun: new Date(Date.now() + 3600000 * 2).toISOString(),
            totalRuns: 0,
          });
          setCurrentSection('crontab');
        }}
        existingAssetGroups={assetGroups}
      />

      {/* Asset Detail Dialog */}
      {selectedAssetDetail && (
        <AssetDetailDialog
          asset={selectedAssetDetail}
          onClose={() => setSelectedAssetDetail(null)}
          onViewTechAsset={(asset) => {
            setSelectedAssetDetail(null);
            if (asset.assetGroupId) {
              setSelectedGroupId(asset.assetGroupId);
            }
            setSelectedAssetForTech(asset);
            setCurrentSection('asset-groups');
          }}
        />
      )}

      {/* Bot Webhook Modal (Push CVE from external alert bot) */}
      <BotWebhookModal
        isOpen={isBotWebhookOpen}
        onClose={() => setIsBotWebhookOpen(false)}
        onPushCve={handlePushCve}
      />

      {/* Vue 3 Quasar Code Modal */}
      {isVueCodeOpen && (
        <VueQuasarCodeModal
          isOpen={isVueCodeOpen}
          onClose={() => setIsVueCodeOpen(false)}
        />
      )}
    </div>
  );
}
