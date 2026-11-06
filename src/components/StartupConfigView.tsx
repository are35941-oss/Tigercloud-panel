import React, { useState } from 'react';
import { 
  Save, RotateCw, Sparkles, Cpu, HardDrive, 
  Layers, Check, AlertCircle, RefreshCw, Server, ArrowRight 
} from 'lucide-react';
import { MinecraftServer, ServerType } from '../types';
import { api } from '../services/api';

interface StartupConfigViewProps {
  server: MinecraftServer;
  onRefreshServer: () => void;
}

export const StartupConfigView: React.FC<StartupConfigViewProps> = ({ server, onRefreshServer }) => {
  // General Settings State
  const [name, setName] = useState(server.name);
  const [port, setPort] = useState(server.port);
  const [memoryMb, setMemoryMb] = useState(server.memoryMb);
  const [cpuLimitPercent, setCpuLimitPercent] = useState(server.cpuLimitPercent || 100);
  const [diskLimitGb, setDiskLimitGb] = useState(server.diskLimitGb);
  const [maxPlayers, setMaxPlayers] = useState(server.maxPlayers);
  const [motd, setMotd] = useState(server.motd);
  const [jvmFlags, setJvmFlags] = useState(server.jvmFlags || '-XX:+UseG1GC -XX:+ParallelRefProcEnabled');
  const [autoRestart, setAutoRestart] = useState(server.autoRestart);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [generalSaved, setGeneralSaved] = useState(false);

  // Version Switcher State
  const [targetType, setTargetType] = useState<ServerType>(server.type);
  const [targetVersion, setTargetVersion] = useState(server.version);
  const [switchingVersion, setSwitchingVersion] = useState(false);
  const [versionSuccess, setVersionSuccess] = useState(false);

  const engineOptions: { type: ServerType; label: string; desc: string; versions: string[] }[] = [
    { type: 'PAPER', label: 'PaperMC', desc: 'Optimized Spigot fork with async chunk loading', versions: ['1.21.1', '1.21', '1.20.4', '1.20.1', '1.19.4'] },
    { type: 'PURPUR', label: 'Purpur', desc: 'High-throughput Paper fork with gameplay customizers', versions: ['1.21.1', '1.21', '1.20.4', '1.20.1'] },
    { type: 'FABRIC', label: 'Fabric', desc: 'Lightweight modular modding toolchain', versions: ['1.21.1', '1.21', '1.20.4', '1.20.1', '1.19.4'] },
    { type: 'SPIGOT', label: 'Spigot', desc: 'Traditional Bukkit/CraftBukkit plugin engine', versions: ['1.21.1', '1.20.4', '1.19.4', '1.16.5'] },
    { type: 'VELOCITY', label: 'Velocity', desc: 'Next-generation high performance proxy', versions: ['3.3.0-SNAPSHOT', '3.2.0'] },
    { type: 'BUNGEECORD', label: 'BungeeCord', desc: 'Classic proxy connecting multiple server realms', versions: ['Latest-1.21', 'Latest-1.20'] },
    { type: 'VANILLA', label: 'Vanilla', desc: 'Official Mojang server implementation', versions: ['1.21.1', '1.21', '1.20.4', '1.20.1'] },
  ];

  const currentEngine = engineOptions.find(e => e.type === targetType) || engineOptions[0];

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGeneral(true);
    try {
      await api.patchServer(server.id, {
        name,
        port: Number(port),
        memoryMb: Number(memoryMb),
        cpuLimitPercent: Number(cpuLimitPercent),
        diskLimitGb: Number(diskLimitGb),
        maxPlayers: Number(maxPlayers),
        motd,
        jvmFlags,
        autoRestart,
      });
      setGeneralSaved(true);
      setTimeout(() => setGeneralSaved(false), 2500);
      onRefreshServer();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleSwitchVersion = async () => {
    if (!confirm(`Switch server engine from ${server.type} ${server.version} to ${targetType} ${targetVersion}? This will automatically download the build artifact and update configuration.`)) {
      return;
    }

    setSwitchingVersion(true);
    try {
      await api.switchVersion(server.id, targetType, targetVersion);
      setVersionSuccess(true);
      setTimeout(() => setVersionSuccess(false), 3000);
      onRefreshServer();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSwitchingVersion(false);
    }
  };

  const applyAikarsFlags = () => {
    setJvmFlags('-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1ReservePercent=20');
  };

  return (
    <div className="space-y-6">
      {/* 1. Startup & Version Manager */}
      <div className="p-5 bg-[#111622] border border-slate-800 rounded-lg space-y-4">
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Startup & Version Manager (Automatic Artifact Downloader)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Switch server engines and versions on the fly. Download builds directly into the container runtime.
          </p>
        </div>

        <div className="p-3.5 bg-[#0e131f] border border-slate-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
          <div>
            <span className="text-slate-500 block text-[11px]">Active Running Version:</span>
            <span className="text-emerald-400 font-bold text-sm">{server.type} {server.version}</span>
          </div>
          <div className="text-slate-400 text-right">
            <span>Container Image: </span>
            <code className="text-slate-200">itzg/minecraft-server:latest</code>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Target Engine</label>
            <select
              value={targetType}
              onChange={(e) => {
                const newT = e.target.value as ServerType;
                setTargetType(newT);
                const opt = engineOptions.find(o => o.type === newT);
                if (opt && opt.versions[0]) setTargetVersion(opt.versions[0]);
              }}
              className="w-full bg-[#151c2c] border border-slate-700 text-sm font-mono text-white rounded px-3 py-2 focus:outline-none focus:border-emerald-500"
            >
              {engineOptions.map(opt => (
                <option key={opt.type} value={opt.type}>
                  {opt.label} — {opt.desc}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Target Version Snapshot</label>
            <select
              value={targetVersion}
              onChange={(e) => setTargetVersion(e.target.value)}
              className="w-full bg-[#151c2c] border border-slate-700 text-sm font-mono text-white rounded px-3 py-2 focus:outline-none focus:border-emerald-500"
            >
              {currentEngine.versions.map(v => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-slate-500 font-mono">
            Will preserve world data and plugins across version updates
          </span>

          <button
            onClick={handleSwitchVersion}
            disabled={switchingVersion || (server.type === targetType && server.version === targetVersion)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 rounded transition-colors shadow-sm"
          >
            {versionSuccess ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Build Switched!</span>
              </>
            ) : (
              <>
                <RefreshCw className={`w-3.5 h-3.5 ${switchingVersion ? 'animate-spin' : ''}`} />
                <span>{switchingVersion ? 'Downloading Artifact...' : 'Switch Engine & Download'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. General Settings & Limits Form */}
      <form onSubmit={handleSaveGeneral} className="p-5 bg-[#111622] border border-slate-800 rounded-lg space-y-4">
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
            <Cpu className="w-4 h-4 text-sky-400" />
            <span>Hardware Limits & cgroups Throttling</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure container memory boundaries, CPU core quotas, and allocation ports.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1">Server Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-[#151c2c] border border-slate-700 text-sm text-white rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Assigned Port</label>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(Number(e.target.value))}
              required
              className="w-full bg-[#151c2c] border border-slate-700 text-sm font-mono text-white rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Memory Allocation (RAM MB)</label>
            <input
              type="number"
              value={memoryMb}
              onChange={(e) => setMemoryMb(Number(e.target.value))}
              step={512}
              min={1024}
              required
              className="w-full bg-[#151c2c] border border-slate-700 text-sm font-mono text-white rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">CPU Quota Limit (%)</label>
            <select
              value={cpuLimitPercent}
              onChange={(e) => setCpuLimitPercent(Number(e.target.value))}
              className="w-full bg-[#151c2c] border border-slate-700 text-sm font-mono text-white rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500"
            >
              <option value={50}>50% (Half Core)</option>
              <option value={100}>100% (1 Dedicated Core)</option>
              <option value={150}>150% (1.5 Cores)</option>
              <option value={200}>200% (2 Dedicated Cores)</option>
              <option value={300}>300% (3 Dedicated Cores)</option>
              <option value={400}>400% (4 Dedicated Cores)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Disk Storage Limit (GB)</label>
            <input
              type="number"
              value={diskLimitGb}
              onChange={(e) => setDiskLimitGb(Number(e.target.value))}
              min={5}
              required
              className="w-full bg-[#151c2c] border border-slate-700 text-sm font-mono text-white rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="sm:col-span-3">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-300">JVM Garbage Collector & Startup Flags</label>
              <button
                type="button"
                onClick={applyAikarsFlags}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 font-mono"
              >
                + Apply Aikar's Flags Preset
              </button>
            </div>
            <textarea
              rows={2}
              value={jvmFlags}
              onChange={(e) => setJvmFlags(e.target.value)}
              className="w-full bg-[#151c2c] border border-slate-700 text-xs font-mono text-white p-2.5 rounded focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRestart}
              onChange={(e) => setAutoRestart(e.target.checked)}
              className="rounded border-slate-700 text-emerald-500 focus:ring-0 w-4 h-4"
            />
            <span>Auto-restart container on crash / node reboot</span>
          </label>

          <button
            type="submit"
            disabled={savingGeneral}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 rounded transition-colors shadow-sm"
          >
            {generalSaved ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Configuration Saved!</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>{savingGeneral ? 'Saving...' : 'Save Settings'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
