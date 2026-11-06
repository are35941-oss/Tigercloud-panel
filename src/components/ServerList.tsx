import React, { useState } from 'react';
import { 
  Server, Play, Square, RotateCw, Terminal, 
  Cpu, HardDrive, Wifi, Copy, Check, Plus, 
  Activity, Shield, ExternalLink, RefreshCw 
} from 'lucide-react';
import { MinecraftServer, SystemStats, ServerStatus } from '../types';

interface ServerListProps {
  servers: MinecraftServer[];
  systemStats: SystemStats | null;
  onSelectServer: (server: MinecraftServer) => void;
  onPowerAction: (serverId: string, action: 'start' | 'stop' | 'restart' | 'kill') => Promise<void>;
  onOpenCreateModal: () => void;
  onRefresh: () => void;
}

export const ServerList: React.FC<ServerListProps> = ({
  servers,
  systemStats,
  onSelectServer,
  onPowerAction,
  onOpenCreateModal,
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'RUNNING' | 'STOPPED'>('ALL');
  const [copiedPort, setCopiedPort] = useState<string | null>(null);
  const [loadingPower, setLoadingPower] = useState<{ [id: string]: boolean }>({});

  const filteredServers = servers.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.version.includes(searchTerm) ||
      String(s.port).includes(searchTerm);

    if (statusFilter === 'RUNNING') return matchesSearch && (s.status === 'RUNNING' || s.status === 'STARTING');
    if (statusFilter === 'STOPPED') return matchesSearch && (s.status === 'STOPPED' || s.status === 'STOPPING');
    return matchesSearch;
  });

  const handleCopyAddress = (e: React.MouseEvent, address: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(address);
    setCopiedPort(address);
    setTimeout(() => setCopiedPort(null), 2000);
  };

  const handlePower = async (e: React.MouseEvent, serverId: string, action: 'start' | 'stop' | 'restart') => {
    e.stopPropagation();
    setLoadingPower((prev) => ({ ...prev, [serverId]: true }));
    try {
      await onPowerAction(serverId, action);
    } finally {
      setLoadingPower((prev) => ({ ...prev, [serverId]: false }));
    }
  };

  const getStatusBadge = (status: ServerStatus) => {
    switch (status) {
      case 'RUNNING':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Online
          </span>
        );
      case 'STARTING':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400">
            <RotateCw className="w-3 h-3 animate-spin" />
            Starting
          </span>
        );
      case 'STOPPING':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-500">
            <RotateCw className="w-3 h-3 animate-spin" />
            Stopping
          </span>
        );
      case 'STOPPED':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            Offline
          </span>
        );
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'PAPER': return 'text-amber-300 border-amber-500/30 bg-amber-500/10';
      case 'PURPUR': return 'text-purple-300 border-purple-500/30 bg-purple-500/10';
      case 'FABRIC': return 'text-sky-300 border-sky-500/30 bg-sky-500/10';
      case 'VANILLA': return 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10';
      default: return 'text-slate-300 border-slate-700 bg-slate-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Node / VPS Telemetry Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-lg bg-[#111622] border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-medium">VPS Node Host</span>
            <Server className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-sm font-bold text-white font-mono truncate">
            {systemStats?.hostname || 'ubuntu-vps-node'}
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
            <span>{systemStats?.cpuCores || 4} vCPUs</span>
            <span>·</span>
            <span>{systemStats?.platform || 'Linux x86_64'}</span>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-[#111622] border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-medium">Host Memory Allocation</span>
            <HardDrive className="w-4 h-4 text-slate-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-white font-mono tabular-nums">
              {systemStats ? `${(systemStats.usedMemMb / 1024).toFixed(1)} / ${(systemStats.totalMemMb / 1024).toFixed(1)}` : '3.4 / 16.0'} GB
            </span>
            <span className="text-xs font-mono text-emerald-400">
              {systemStats?.memPercent || 22}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
            <div 
              className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
              style={{ width: `${systemStats?.memPercent || 22}%` }} 
            />
          </div>
        </div>

        <div className="p-4 rounded-lg bg-[#111622] border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-medium">Minecraft Containers</span>
            <Activity className="w-4 h-4 text-slate-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-white font-mono tabular-nums">
              {servers.filter(s => s.status === 'RUNNING').length}
            </span>
            <span className="text-xs text-slate-400">
              active / {servers.length} total
            </span>
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Isolated Docker cgroups
          </div>
        </div>

        <div className="p-4 rounded-lg bg-[#111622] border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-medium">Virtualization Engine</span>
            <Shield className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-sm font-bold text-white font-mono">
            {systemStats?.docker.available ? 'Docker CE (Live)' : 'Virtual Sandbox'}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {systemStats?.docker.available ? 'Socket /var/run/docker.sock' : 'Full production API simulation'}
          </div>
        </div>
      </div>

      {/* Toolbar / Search & Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <input
              type="text"
              placeholder="Filter servers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#111622] border border-slate-800 text-sm text-white placeholder-slate-500 rounded-md px-3 py-1.5 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Interactive filter tabs */}
          <div className="flex items-center gap-1 p-1 bg-[#111622] border border-slate-800 rounded-lg">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                statusFilter === 'ALL'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('RUNNING')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                statusFilter === 'RUNNING'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Online
            </button>
            <button
              onClick={() => setStatusFilter('STOPPED')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                statusFilter === 'STOPPED'
                  ? 'bg-slate-800 text-slate-300 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Offline
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            title="Refresh server states"
            className="p-2 text-slate-400 hover:text-white bg-[#111622] border border-slate-800 hover:border-slate-700 rounded-md transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-md transition-colors whitespace-nowrap shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Server
          </button>
        </div>
      </div>

      {/* Servers Grid */}
      {filteredServers.length === 0 ? (
        <div className="text-center py-16 px-4 bg-[#111622] border border-dashed border-slate-800 rounded-lg">
          <Server className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">No servers found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
            {searchTerm ? 'No servers match your search filter.' : 'Deploy your first isolated Minecraft server container in seconds.'}
          </p>
          <button
            onClick={onOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-md transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Deploy First Server
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServers.map((server) => {
            const isRunning = server.status === 'RUNNING';
            const isStarting = server.status === 'STARTING';
            const isStopping = server.status === 'STOPPING';
            const isBusy = loadingPower[server.id] || isStarting || isStopping;

            return (
              <div
                key={server.id}
                onClick={() => onSelectServer(server)}
                className="group relative bg-[#111622] hover:bg-[#141b2b] border border-slate-800 hover:border-slate-700 rounded-lg p-5 transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  {/* Top line: Status & Flavor */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={`text-[11px] font-mono px-2 py-0.5 rounded border uppercase font-semibold ${getTypeColor(server.type)}`}>
                      {server.type} {server.version}
                    </span>
                    {getStatusBadge(server.status)}
                  </div>

                  {/* Server Title */}
                  <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors truncate">
                    {server.name}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                    {server.description || 'Minecraft Server Container'}
                  </p>

                  {/* Connection address & port */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-300">
                    <span className="text-slate-500 font-sans text-[11px]">Direct Address</span>
                    <button
                      onClick={(e) => handleCopyAddress(e, `0.0.0.0:${server.port}`)}
                      title="Click to copy host IP and Port"
                      className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 bg-slate-900/80 border border-slate-800 px-2 py-1 rounded"
                    >
                      <span>:{server.port}</span>
                      {copiedPort === `0.0.0.0:${server.port}` ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3 text-slate-500" />
                      )}
                    </button>
                  </div>

                  {/* Hardware Allocations */}
                  <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-slate-500" />
                      <span>{server.memoryMb >= 1024 ? `${server.memoryMb / 1024} GB` : `${server.memoryMb} MB`} RAM</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-slate-500" />
                      <span>{server.diskLimitGb} GB SSD</span>
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="mt-5 pt-3.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {isRunning ? (
                      <button
                        disabled={isBusy}
                        onClick={(e) => handlePower(e, server.id, 'stop')}
                        title="Stop server container"
                        className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded transition-colors disabled:opacity-50"
                      >
                        <Square className="w-4 h-4 fill-current" />
                      </button>
                    ) : (
                      <button
                        disabled={isBusy}
                        onClick={(e) => handlePower(e, server.id, 'start')}
                        title="Start server container"
                        className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded transition-colors disabled:opacity-50"
                      >
                        <Play className="w-4 h-4 fill-current" />
                      </button>
                    )}

                    <button
                      disabled={!isRunning || isBusy}
                      onClick={(e) => handlePower(e, server.id, 'restart')}
                      title="Restart server"
                      className="p-1.5 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded transition-colors disabled:opacity-30"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={() => onSelectServer(server)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-300 group-hover:text-white"
                  >
                    <Terminal className="w-3.5 h-3.5 text-slate-400" />
                    <span>Manage</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
