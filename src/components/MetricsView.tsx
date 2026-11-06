import React, { useState, useEffect } from 'react';
import { 
  Cpu, HardDrive, Wifi, Activity, Clock, 
  Users, Gauge, ShieldCheck, Zap
} from 'lucide-react';
import { MinecraftServer, ServerStats } from '../types';

interface MetricsViewProps {
  server: MinecraftServer;
  stats: ServerStats | null;
}

export const MetricsView: React.FC<MetricsViewProps> = ({ server, stats }) => {
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [ramHistory, setRamHistory] = useState<number[]>([]);

  useEffect(() => {
    if (stats) {
      setCpuHistory((prev) => [...prev.slice(-29), stats.cpuPercent]);
      setRamHistory((prev) => [...prev.slice(-29), stats.memoryPercent]);
    }
  }, [stats]);

  // Generate SVG path for sparkline
  const renderSparkline = (data: number[], maxVal = 100, strokeColor = '#10b981', fillColor = 'rgba(16, 185, 129, 0.15)') => {
    if (data.length < 2) {
      return <div className="h-28 flex items-center justify-center text-xs text-slate-500 font-mono">Gathering telemetry...</div>;
    }

    const width = 400;
    const height = 100;
    const points = data.map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - (Math.min(val, maxVal) / maxVal) * (height - 10) - 5;
      return `${x},${y}`;
    });

    const pathD = `M ${points.join(' L ')}`;
    const areaD = `${pathD} L ${width},${height} L 0,${height} Z`;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-28 overflow-visible">
        <defs>
          <linearGradient id={`grad-${strokeColor}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#grad-${strokeColor})`} />
        <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  };

  const formatUptime = (sec?: number) => {
    if (!sec) return '0s';
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (hrs > 0) return `${hrs}h ${mins}m ${s}s`;
    if (mins > 0) return `${mins}m ${s}s`;
    return `${s}s`;
  };

  return (
    <div className="space-y-6">
      {/* 4 Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CPU */}
        <div className="p-4 bg-[#111622] border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-medium">Processor Load (CPU)</span>
            <Cpu className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white tabular-nums">
              {stats?.cpuPercent ? stats.cpuPercent.toFixed(1) : '0.0'}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, stats?.cpuPercent || 0)}%` }}
            />
          </div>
        </div>

        {/* RAM */}
        <div className="p-4 bg-[#111622] border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-medium">Memory Usage (RAM)</span>
            <Activity className="w-4 h-4 text-sky-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white tabular-nums">
              {stats?.memoryUsedMb || 0}
            </span>
            <span className="text-xs font-mono text-slate-400">/ {server.memoryMb} MB</span>
            <span className="text-xs font-mono text-sky-400 ml-auto font-semibold">
              {stats?.memoryPercent || 0}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-sky-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, stats?.memoryPercent || 0)}%` }}
            />
          </div>
        </div>

        {/* Disk */}
        <div className="p-4 bg-[#111622] border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-medium">Disk Storage</span>
            <HardDrive className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white tabular-nums">
              {stats?.diskUsedMb ? (stats.diskUsedMb / 1024).toFixed(2) : '1.48'}
            </span>
            <span className="text-xs font-mono text-slate-400">/ {server.diskLimitGb} GB</span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-300"
              style={{ width: `${stats?.diskPercent || 15}%` }}
            />
          </div>
        </div>

        {/* Network & TPS */}
        <div className="p-4 bg-[#111622] border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-medium">Tick Rate (TPS)</span>
            <Gauge className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white tabular-nums">
              {stats?.tps ? stats.tps.toFixed(2) : '20.00'}
            </span>
            <span className="text-xs text-emerald-400 font-semibold">Target: 20.0</span>
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center justify-between font-mono">
            <span>RX: {stats?.netRxKb || 0} KB/s</span>
            <span>TX: {stats?.netTxKb || 0} KB/s</span>
          </div>
        </div>
      </div>

      {/* Real-time Telemetry Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* CPU Chart */}
        <div className="p-5 bg-[#111622] border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Live CPU Load Timeline</h3>
              <p className="text-xs text-slate-400">Streaming 1-second interval container cgroup metrics</p>
            </div>
            <span className="text-xs font-mono text-emerald-400 font-bold">
              {stats?.cpuPercent ? `${stats.cpuPercent.toFixed(1)}%` : '0%'}
            </span>
          </div>
          {renderSparkline(cpuHistory.length > 0 ? cpuHistory : [0, 0], 100, '#10b981')}
        </div>

        {/* RAM Chart */}
        <div className="p-5 bg-[#111622] border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Memory Allocation Timeline</h3>
              <p className="text-xs text-slate-400">Heap + Off-Heap JVM container footprint</p>
            </div>
            <span className="text-xs font-mono text-sky-400 font-bold">
              {stats?.memoryUsedMb || 0} MB
            </span>
          </div>
          {renderSparkline(ramHistory.length > 0 ? ramHistory : [0, 0], 100, '#38bdf8')}
        </div>
      </div>

      {/* Server Environment Telemetry Details */}
      <div className="p-5 bg-[#111622] border border-slate-800 rounded-lg">
        <h3 className="text-sm font-semibold text-white mb-3">Container Metadata & Execution Context</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
          <div>
            <span className="text-slate-500 block text-[11px]">Container ID</span>
            <span className="text-slate-200">{server.dockerContainerId || `mc-${server.id}`}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Engine Type & API</span>
            <span className="text-slate-200">{server.type} {server.version}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Container Uptime</span>
            <span className="text-slate-200">{formatUptime(stats?.uptimeSeconds)}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Host Volume Mount</span>
            <span className="text-slate-200 truncate block" title={server.volumePath}>
              {server.volumePath}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
