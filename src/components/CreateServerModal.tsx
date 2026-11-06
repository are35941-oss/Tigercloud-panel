import React, { useState } from 'react';
import { X, Server, Cpu, HardDrive, ShieldCheck, Check } from 'lucide-react';
import { ServerType, NodeAgent } from '../types';

interface CreateServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (serverData: any) => Promise<void>;
  availablePort: number;
  nodes: NodeAgent[];
}

export const CreateServerModal: React.FC<CreateServerModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  availablePort,
  nodes,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nodeId, setNodeId] = useState(nodes[0]?.id || 'node-us-east');
  const [type, setType] = useState<ServerType>('PAPER');
  const [version, setVersion] = useState('1.21.1');
  const [memoryMb, setMemoryMb] = useState(2048);
  const [cpuLimitPercent, setCpuLimitPercent] = useState(100);
  const [diskLimitGb, setDiskLimitGb] = useState(10);
  const [port, setPort] = useState(availablePort);
  const [motd, setMotd] = useState('§a§lObsidianNode §7» §fHigh-Performance Minecraft Cluster');
  const [maxPlayers, setMaxPlayers] = useState(25);
  const [eulaAccepted, setEulaAccepted] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const serverTemplates: { type: ServerType; title: string; desc: string; tag: string }[] = [
    { type: 'PAPER', title: 'PaperMC', desc: 'Industry-standard high-performance server with async chunk loading', tag: 'Recommended' },
    { type: 'PURPUR', title: 'Purpur', desc: 'Ultra-configurable Paper fork designed for high player-count servers', tag: 'Optimized' },
    { type: 'FABRIC', title: 'Fabric', desc: 'Lightweight modular modding toolchain with fast modern snapshots', tag: 'Mods' },
    { type: 'SPIGOT', title: 'Spigot', desc: 'Traditional CraftBukkit plugin engine', tag: 'Classic' },
    { type: 'VELOCITY', title: 'Velocity', desc: 'Modern high-performance proxy network gateway', tag: 'Proxy' },
    { type: 'VANILLA', title: 'Vanilla', desc: 'Official Mojang server implementation with un-altered mechanics', tag: 'Standard' },
  ];

  const versionsMap: Record<ServerType, string[]> = {
    PAPER: ['1.21.1', '1.21', '1.20.4', '1.20.1', '1.19.4'],
    PURPUR: ['1.21.1', '1.21', '1.20.4', '1.20.1'],
    FABRIC: ['1.21.1', '1.21', '1.20.4', '1.20.1', '1.19.4'],
    SPIGOT: ['1.21.1', '1.20.4', '1.19.4', '1.16.5'],
    VELOCITY: ['3.3.0-SNAPSHOT', '3.2.0'],
    BUNGEECORD: ['Latest-1.21', 'Latest-1.20'],
    FORGE: ['1.20.1', '1.19.2'],
    VANILLA: ['1.21.1', '1.21', '1.20.4', '1.20.1'],
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (!eulaAccepted) {
      alert('You must accept the Mojang EULA to create a Minecraft server.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        nodeId,
        type,
        version,
        memoryMb: Number(memoryMb),
        cpuLimitPercent: Number(cpuLimitPercent),
        diskLimitGb: Number(diskLimitGb),
        port: Number(port),
        motd,
        maxPlayers: Number(maxPlayers),
      });
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-[#0f1420] border border-slate-800 rounded-xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#131a2a] border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Deploy Minecraft Server Container</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Deploys an isolated Docker instance onto your selected VPS node.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Node Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Target Hosting Node (Wings Agent)
            </label>
            <select
              value={nodeId}
              onChange={(e) => setNodeId(e.target.value)}
              className="w-full bg-[#151c2c] border border-slate-700 text-sm font-mono text-white rounded px-3 py-2 focus:outline-none focus:border-emerald-500"
            >
              {nodes.map(n => (
                <option key={n.id} value={n.id}>
                  {n.name} ({n.location} · {n.fqdn}) — {n.containersCount} containers active
                </option>
              ))}
            </select>
          </div>

          {/* Engine Template Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Select Engine Template
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {serverTemplates.map((item) => (
                <button
                  type="button"
                  key={item.type}
                  onClick={() => {
                    setType(item.type);
                    const avail = versionsMap[item.type] || ['1.21.1'];
                    setVersion(avail[0]);
                  }}
                  className={`p-3 rounded-lg border text-left transition-all relative ${
                    type === item.type
                      ? 'bg-emerald-500/10 border-emerald-500 text-white'
                      : 'bg-[#151c2c] border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-white">{item.title}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {item.tag}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-snug">{item.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Server Name & Version */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">Server Name</label>
              <input
                type="text"
                placeholder="e.g. Survival SMP or Minigames Lobby"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-[#151c2c] border border-slate-700 text-sm text-white rounded px-3 py-2 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Version</label>
              <select
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="w-full bg-[#151c2c] border border-slate-700 text-sm font-mono text-white rounded px-3 py-2 focus:outline-none focus:border-emerald-500"
              >
                {(versionsMap[type] || ['1.21.1']).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Hardware Resources: RAM, CPU Limit, Port */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">RAM Allocation</label>
              <select
                value={memoryMb}
                onChange={(e) => setMemoryMb(Number(e.target.value))}
                className="w-full bg-[#151c2c] border border-slate-700 text-sm font-mono text-white rounded px-3 py-2 focus:outline-none focus:border-emerald-500"
              >
                <option value={1024}>1024 MB (1 GB)</option>
                <option value={2048}>2048 MB (2 GB)</option>
                <option value={4096}>4096 MB (4 GB)</option>
                <option value={6144}>6144 MB (6 GB)</option>
                <option value={8192}>8192 MB (8 GB)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">CPU Quota Limit</label>
              <select
                value={cpuLimitPercent}
                onChange={(e) => setCpuLimitPercent(Number(e.target.value))}
                className="w-full bg-[#151c2c] border border-slate-700 text-sm font-mono text-white rounded px-3 py-2 focus:outline-none focus:border-emerald-500"
              >
                <option value={50}>50% (Half Core)</option>
                <option value={100}>100% (1 Core)</option>
                <option value={150}>150% (1.5 Cores)</option>
                <option value={200}>200% (2 Cores)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Port Binding</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                className="w-full bg-[#151c2c] border border-slate-700 text-sm font-mono text-white rounded px-3 py-2 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* MOTD */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Message of the Day (MOTD)</label>
            <input
              type="text"
              value={motd}
              onChange={(e) => setMotd(e.target.value)}
              className="w-full bg-[#151c2c] border border-slate-700 text-sm font-mono text-white rounded px-3 py-2 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Mojang EULA */}
          <div className="p-3.5 bg-[#131a2a] border border-slate-800 rounded-lg flex items-center justify-between gap-3">
            <div className="text-xs">
              <span className="font-semibold text-white block">Mojang EULA Agreement</span>
              <span className="text-slate-400">Accept Mojang End User License Agreement (eula=true)</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={eulaAccepted}
                onChange={(e) => setEulaAccepted(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#131a2a] border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleFormSubmit}
            disabled={submitting || !name.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 rounded-md transition-colors shadow-sm"
          >
            <Server className="w-4 h-4" />
            <span>{submitting ? 'Provisioning Container...' : 'Deploy Container'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
