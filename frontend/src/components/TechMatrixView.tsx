import React, { useMemo } from 'react';
import {
  Cpu,
  Layers,
  Server,
  Cloud,
  Code,
  Shield,
  BarChart3,
  Globe,
  ExternalLink,
  Filter,
} from 'lucide-react';
import { ScanResult, TechSignature } from '../types';
import { QCard, QBtn } from './QuasarUiElements';

interface TechMatrixViewProps {
  assets: ScanResult[];
  onFilterTech: (techName: string) => void;
}

export const TechMatrixView: React.FC<TechMatrixViewProps> = ({ assets = [], onFilterTech }) => {
  // Aggregate technologies
  const techStats = useMemo(() => {
    const map = new Map<string, { tech: TechSignature; count: number; hosts: string[] }>();

    for (const asset of assets) {
      for (const t of asset.technologies) {
        const existing = map.get(t.name);
        if (existing) {
          existing.count += 1;
          if (!existing.hosts.includes(asset.host)) {
            existing.hosts.push(asset.host);
          }
        } else {
          map.set(t.name, {
            tech: t,
            count: 1,
            hosts: [asset.host],
          });
        }
      }
    }

    // Group by category
    const categories: Record<string, { tech: TechSignature; count: number; hosts: string[] }[]> = {
      'Framework': [],
      'UI Library': [],
      'Web Server': [],
      'CDN': [],
      'CMS': [],
      'Language': [],
      'Analytics': [],
      'DevOps': [],
      'Frontend': [],
    };

    map.forEach((val) => {
      const cat = val.tech.category || 'Framework';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(val);
    });

    // Sort each category by count descending
    Object.keys(categories).forEach((cat) => {
      categories[cat].sort((a, b) => b.count - a.count);
    });

    return {
      all: Array.from(map.values()).sort((a, b) => b.count - a.count),
      categories,
    };
  }, [assets]);

  // Overall metrics
  const avgResponseTime = useMemo(() => {
    if (assets.length === 0) return 0;
    const total = assets.reduce((sum, a) => sum + a.responseTimeMs, 0);
    return Math.round(total / assets.length);
  }, [assets]);

  const successRate = useMemo(() => {
    if (assets.length === 0) return 0;
    const ok = assets.filter((a) => a.statusCode >= 200 && a.statusCode < 400).length;
    return Math.round((ok / assets.length) * 100);
  }, [assets]);

  const categoryIcons: Record<string, any> = {
    'Framework': Cpu,
    'UI Library': Layers,
    'Web Server': Server,
    'CDN': Cloud,
    'CMS': Globe,
    'Language': Code,
    'Analytics': BarChart3,
    'DevOps': Shield,
    'Frontend': Code,
  };

  return (
    <div className="space-y-6">
      {/* Top Metrics Cards (Quasar Dashboard style) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Assets */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 q-shadow-1 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium">Tổng tài sản đã quét</div>
            <div className="text-2xl font-black text-slate-800 mt-1">{assets.length}</div>
            <div className="text-[11px] text-[#1976D2] font-medium mt-0.5">Kho tài sản số đã phân tích</div>
          </div>
          <div className="w-12 h-12 rounded-lg bg-blue-50 text-[#1976D2] flex items-center justify-center font-bold">
            <Globe className="w-6 h-6" />
          </div>
        </div>

        {/* Detected Techs */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 q-shadow-1 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium">Chữ ký Công nghệ</div>
            <div className="text-2xl font-black text-[#26A69A] mt-1">{techStats.all.length}</div>
            <div className="text-[11px] text-teal-600 font-medium mt-0.5">Thư viện, CMS, Server</div>
          </div>
          <div className="w-12 h-12 rounded-lg bg-teal-50 text-[#26A69A] flex items-center justify-center font-bold">
            <Cpu className="w-6 h-6" />
          </div>
        </div>

        {/* Success Rate */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 q-shadow-1 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium">Tỷ lệ HTTP Hoạt động</div>
            <div className="text-2xl font-black text-[#21BA45] mt-1">{successRate}%</div>
            <div className="text-[11px] text-green-600 font-medium mt-0.5">Status 2xx & 3xx OK</div>
          </div>
          <div className="w-12 h-12 rounded-lg bg-green-50 text-[#21BA45] flex items-center justify-center font-bold">
            <BarChart3 className="w-6 h-6" />
          </div>
        </div>

        {/* Avg Response Time */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 q-shadow-1 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium">Thời gian Phản hồi TB</div>
            <div className="text-2xl font-black text-slate-800 mt-1">{avgResponseTime} ms</div>
            <div className="text-[11px] text-slate-500 font-medium mt-0.5">Độ trễ phản hồi máy chủ</div>
          </div>
          <div className="w-12 h-12 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
            <Server className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Category Breakdown Matrix */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#1976D2]" />
            <span>Phân bố Công nghệ theo Nhóm (Technology Matrix)</span>
          </h3>
          <span className="text-xs text-slate-500">
            Nhấn vào bất kỳ thẻ nào để lọc trong bảng tài sản
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(
            Object.entries(techStats.categories) as [
              string,
              Array<{ tech: TechSignature; count: number; hosts: string[] }>
            ][]
          ).map(([category, items]) => {
            if (items.length === 0) return null;
            const IconComponent = categoryIcons[category] || Cpu;

            return (
              <div
                key={category}
                className="bg-white rounded-lg border border-slate-200 q-shadow-1 overflow-hidden flex flex-col"
              >
                {/* Category Header */}
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-[#1976D2]/10 text-[#1976D2] flex items-center justify-center">
                      <IconComponent className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-bold text-xs text-slate-800">{category}</span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {items.length} loại
                  </span>
                </div>

                {/* Items in this category */}
                <div className="p-3 divide-y divide-slate-100 flex-1">
                  {items.map(({ tech, count, hosts }) => {
                    const percentage = assets.length > 0 ? Math.round((count / assets.length) * 100) : 0;
                    return (
                      <button
                        key={tech.name}
                        onClick={() => onFilterTech(tech.name)}
                        className="w-full text-left py-2 px-1 rounded hover:bg-blue-50/70 transition flex items-center justify-between group cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: tech.color || '#1976D2' }}
                          />
                          <div>
                            <div className="text-xs font-semibold text-slate-800 group-hover:text-[#1976D2] transition">
                              {tech.name}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {hosts.slice(0, 2).join(', ')}
                              {hosts.length > 2 ? ` +${hosts.length - 2}` : ''}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-bold text-slate-700 font-mono">
                            {count} ({percentage}%)
                          </span>
                          <div className="w-16 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${percentage}%`,
                                backgroundColor: tech.color || '#1976D2',
                              }}
                            />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
