import React, { useState } from 'react';
import { 
  Server, Cpu, HardDrive, Wifi, Activity, Plus, 
  RefreshCw, Check, Copy, ExternalLink, ShieldCheck, 
  AlertCircle, Trash2, Key, Terminal, Globe, Zap, CheckCircle2
} from 'lucide-react';
import { NodeAgent } from '../types';

interface NodesViewProps {
  nodes: NodeAgent[];
  onPingNode: (id: string) => Promise<void>;
  onCreateNode: (nodeData: any) => Promise<any>;
  onDeleteNode: (id: string) => Promise<void>;
  onRefresh: () => void;
  onSimulateHandshake?: (id: string) => Promise<void>;
}

export const NodesView: React.FC<NodesViewProps> = ({
  nodes,
  onPingNode,
  onCreateNode,
  onDeleteNode,
  onRefresh,
  onSimulateHandshake,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [configModalNode, setConfigModalNode] = useState<NodeAgent | null>(null);
  const [pairingModalData, setPairingModalData] = useState<{
    node: NodeAgent;
    token: string;
    installCommand: string;
    configSnippet: any;
  } | null>(null);

  const [pinging, setPinging] = useState<Record<string, boolean>>({});
  const [simulating, setSimulating] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [fqdn, setFqdn] = useState('');
  const [port, setPort] = useState(8080);
  const [location, setLocation] = useState('Frankfurt, Germany');
  const [totalRamMb, setTotalRamMb] = useState(32768);
  const [totalDiskMb, setTotalDiskMb] = useState(512000); // 500 GB in MB
  const [totalCpuCores, setTotalCpuCores] = useState(8);
  const [submitting, setSubmitting] = useState(false);

  const totalClusterRam = nodes.reduce((acc, n) => acc + n.totalRamMb, 0);
  const allocatedClusterRam = nodes.reduce((acc, n) => acc + n.allocatedRamMb, 0);
  const totalClusterCores = nodes.reduce((acc, n) => acc + n.totalCpuCores, 0);
  const totalContainers = nodes.reduce((acc, n) => acc + n.containersCount, 0);

  const handlePing = async (id: string) => {
    setPinging(prev => ({ ...prev, [id]: true }));
    try {
      await onPingNode(id);
    } finally {
      setPinging(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleSimulateHandshakeAction = async (nodeId: string) => {
    if (!onSimulateHandshake) return;
    setSimulating(prev => ({ ...prev, [nodeId]: true }));
    try {
      await onSimulateHandshake(nodeId);
      // Update pairing modal data if currently open for this node
      if (pairingModalData && pairingModalData.node.id === nodeId) {
        setPairingModalData(prev => prev ? {
          ...prev,
          node: { ...prev.node, status: 'ONLINE', pingMs: 14 }
        } : null);
      }
    } finally {
      setSimulating(prev => ({ ...prev, [nodeId]: false }));
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !fqdn.trim()) return;

    setSubmitting(true);
    try {
      const res = await onCreateNode({
        name: name.trim(),
        fqdn: fqdn.trim(),
        port: Number(port),
        location: location.trim(),
        totalRamMb: Number(totalRamMb),
        totalDiskMb: Number(totalDiskMb),
        totalCpuCores: Number(totalCpuCores),
      });

      setModalOpen(false);
      setName('');
      setFqdn('');

      // Open Pairing Modal with Token and Auto-Install Command
      if (res && res.token) {
        setPairingModalData({
          node: res.node,
          token: res.token,
          installCommand: res.installCommand,
          configSnippet: res.configSnippet,
        });
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const openPairingModalForNode = (node: NodeAgent) => {
    const proto = window.location.protocol;
    const host = window.location.host;
    const panelUrl = `${proto}//${host}`;

    const configSnippet = {
      panel_url: panelUrl,
      node_id: node.id,
      token: node.token,
      port: node.port,
      fqdn: node.fqdn,
    };

    const installCommand = `curl -sSL ${panelUrl}/install-node.sh | sudo bash -s -- --panel-url "${panelUrl}" --token "${node.token}" --node-id "${node.id}" --port ${node.port} --fqdn "${node.fqdn}"`;

    setPairingModalData({
      node,
      token: node.token,
      installCommand,
      configSnippet,
    });
  };

  return (
    <div className="space-y-6">
      {/* Cluster Summary Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Remote VPS Nodes & Wings Daemons</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Decentralized execution agents running across global VPS instances. Manage CPU quotas and RAM allocations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            title="Refresh Nodes"
            className="p-2 text-slate-400 hover:text-white bg-[#111622] border border-slate-800 rounded-md transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-md transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Node
          </button>
        </div>
      </div>

      {/* 4 Global Cluster Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-lg bg-[#111622] border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-medium">Cluster Nodes</span>
            <Server className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">
            {nodes.length} Registered
          </div>
          <div className="text-xs text-emerald-400 mt-1">
            {nodes.filter(n => n.status === 'ONLINE').length} online & communicating
          </div>
        </div>

        <div className="p-4 rounded-lg bg-[#111622] border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-medium">Cluster Total Memory</span>
            <HardDrive className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono tabular-nums">
            {(allocatedClusterRam / 1024).toFixed(1)} / {(totalClusterRam / 1024).toFixed(0)} GB
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {Math.round((allocatedClusterRam / (totalClusterRam || 1)) * 100)}% committed to containers
          </div>
        </div>

        <div className="p-4 rounded-lg bg-[#111622] border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-medium">Total Cluster Cores</span>
            <Cpu className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">
            {totalClusterCores} vCPUs
          </div>
          <div className="text-xs text-slate-400 mt-1">
            cgroups CPU bandwidth isolation
          </div>
        </div>

        <div className="p-4 rounded-lg bg-[#111622] border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-medium">Running Game Containers</span>
            <Activity className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">
            {totalContainers} Containers
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Isolated Docker processes
          </div>
        </div>
      </div>

      {/* Nodes Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {nodes.map((node) => {
          const isOnline = node.status === 'ONLINE';
          const ramPercent = Math.round((node.allocatedRamMb / (node.totalRamMb || 1)) * 100);
          const isPinging = pinging[node.id];
          const isSimulating = simulating[node.id];

          return (
            <div
              key={node.id}
              className={`bg-[#111622] border rounded-lg p-5 flex flex-col justify-between transition-colors ${
                isOnline ? 'border-slate-800 hover:border-slate-700' : 'border-amber-500/30 bg-amber-500/5'
              }`}
            >
              <div>
                {/* Node Top Line */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isOnline
                          ? 'bg-emerald-400 shadow-sm shadow-emerald-500/50'
                          : 'bg-amber-400 animate-pulse'
                      }`}
                    />
                    <span
                      className={`text-xs font-mono font-semibold ${
                        isOnline ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {node.status}
                    </span>
                    {!isOnline && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        Awaiting Handshake
                      </span>
                    )}
                    {node.isLocal && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        Primary Node
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
                    <Wifi className="w-3.5 h-3.5 text-slate-500" />
                    <span>{isOnline ? `${node.pingMs}ms` : '--'}</span>
                  </div>
                </div>

                {/* Node Title */}
                <h3 className="text-base font-bold text-white tracking-tight">{node.name}</h3>
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5 font-mono">
                  <Globe className="w-3 h-3 text-slate-500" />
                  <span>{node.location}</span>
                  <span>·</span>
                  <span className="text-slate-300">{node.fqdn}:{node.port}</span>
                </div>

                {/* Hardware Telemetry Progress Bars */}
                <div className="mt-4 space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs font-mono mb-1 text-slate-300">
                      <span className="flex items-center gap-1 text-slate-400">
                        <HardDrive className="w-3.5 h-3.5" />
                        Memory
                      </span>
                      <span>{(node.allocatedRamMb / 1024).toFixed(1)} / {(node.totalRamMb / 1024).toFixed(0)} GB ({ramPercent}%)</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isOnline ? 'bg-sky-500' : 'bg-slate-700'
                        }`}
                        style={{ width: `${Math.min(100, ramPercent)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs font-mono mb-1 text-slate-300">
                      <span className="flex items-center gap-1 text-slate-400">
                        <Cpu className="w-3.5 h-3.5" />
                        CPU Allocation
                      </span>
                      <span>{node.allocatedCpuPercent}% / {node.totalCpuCores * 100}% ({node.totalCpuCores} Cores)</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isOnline ? 'bg-emerald-500' : 'bg-slate-700'
                        }`}
                        style={{ width: `${Math.min(100, (node.allocatedCpuPercent / (node.totalCpuCores * 100)) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* System Info */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] font-mono text-slate-400 space-y-1">
                  <div className="truncate">Runtime: <span className="text-slate-300">{node.dockerVersion}</span></div>
                  <div>Hosted Containers: <span className="text-white font-bold">{node.containersCount}</span></div>
                </div>
              </div>

              {/* Node Card Actions */}
              <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openPairingModalForNode(node)}
                    className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 px-2.5 py-1.5 rounded transition-colors"
                  >
                    <Key className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Pairing Setup</span>
                  </button>

                  {!isOnline && onSimulateHandshake && (
                    <button
                      onClick={() => handleSimulateHandshakeAction(node.id)}
                      disabled={isSimulating}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2.5 py-1.5 rounded transition-colors disabled:opacity-50"
                      title="Simulate remote daemon handshake immediately"
                    >
                      <Zap className={`w-3.5 h-3.5 ${isSimulating ? 'animate-bounce' : ''}`} />
                      <span>{isSimulating ? 'Pairing...' : 'Handshake'}</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {isOnline && (
                    <button
                      onClick={() => handlePing(node.id)}
                      disabled={isPinging}
                      className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors disabled:opacity-50"
                      title="Test mTLS Daemon Connection"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin text-emerald-400' : ''}`} />
                    </button>
                  )}

                  {!node.isLocal && (
                    <button
                      onClick={async () => {
                        if (confirm(`Remove remote node ${node.name}?`)) {
                          await onDeleteNode(node.id);
                        }
                      }}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                      title="Delete Node"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 1. "Create Node" Form Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-xl bg-[#0f1420] border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 bg-[#131a2a] border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Create Remote VPS Node</h3>
                <p className="text-xs text-slate-400 mt-0.5">Registers a new node in Offline status and generates pairing token</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="p-1 text-slate-400 hover:text-white rounded">
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3.5">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">Node Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Frankfurt EU-1 or Dallas US-Central"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full bg-[#151c2c] border border-slate-700 text-sm text-white rounded px-3 py-2 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Fully Qualified Domain Name / IP</label>
                  <input
                    type="text"
                    placeholder="e.g. node1.example.com or 192.168.1.50"
                    value={fqdn}
                    onChange={(e) => setFqdn(e.target.value)}
                    required
                    className="w-full bg-[#151c2c] border border-slate-700 text-sm font-mono text-white rounded px-3 py-2 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Daemon Port</label>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(Number(e.target.value))}
                    required
                    className="w-full bg-[#151c2c] border border-slate-700 text-sm font-mono text-white rounded px-3 py-2 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">Daemon Location / Region</label>
                  <input
                    type="text"
                    placeholder="e.g. Frankfurt, Germany (EU-Central)"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    required
                    className="w-full bg-[#151c2c] border border-slate-700 text-sm text-white rounded px-3 py-2 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Total RAM (MB)</label>
                  <input
                    type="number"
                    value={totalRamMb}
                    onChange={(e) => setTotalRamMb(Number(e.target.value))}
                    required
                    className="w-full bg-[#151c2c] border border-slate-700 text-sm font-mono text-white rounded px-3 py-2 focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">{(totalRamMb / 1024).toFixed(1)} GB Available</span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Total Disk (MB)</label>
                  <input
                    type="number"
                    value={totalDiskMb}
                    onChange={(e) => setTotalDiskMb(Number(e.target.value))}
                    required
                    className="w-full bg-[#151c2c] border border-slate-700 text-sm font-mono text-white rounded px-3 py-2 focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">{(totalDiskMb / 1024).toFixed(0)} GB Storage</span>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">Total CPU Cores</label>
                  <input
                    type="number"
                    value={totalCpuCores}
                    onChange={(e) => setTotalCpuCores(Number(e.target.value))}
                    required
                    className="w-full bg-[#151c2c] border border-slate-700 text-sm font-mono text-white rounded px-3 py-2 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-mono">Status starts as OFFLINE until handshake</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 text-xs text-slate-300 hover:text-white bg-slate-800 rounded transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded transition-colors"
                  >
                    {submitting ? 'Registering...' : 'Generate Token & Create Node'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Pairing Success & Credentials Modal */}
      {pairingModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-2xl bg-[#0f1420] border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 bg-[#131a2a] border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Node Pairing Credentials: {pairingModalData.node.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Execute the command below on your remote VPS to pair with this panel
                  </p>
                </div>
              </div>
              <button onClick={() => setPairingModalData(null)} className="p-1 text-slate-400 hover:text-white rounded">
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
              {/* Pairing Status Banner */}
              <div
                className={`p-3.5 rounded-lg border flex items-center justify-between ${
                  pairingModalData.node.status === 'ONLINE'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                }`}
              >
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      pairingModalData.node.status === 'ONLINE' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                    }`}
                  />
                  <span>
                    Status:{' '}
                    <strong>
                      {pairingModalData.node.status === 'ONLINE'
                        ? 'ONLINE & VERIFIED'
                        : 'OFFLINE — AWAITING VPS HANDSHAKE'}
                    </strong>
                  </span>
                </div>

                {pairingModalData.node.status !== 'ONLINE' && onSimulateHandshake && (
                  <button
                    onClick={() => handleSimulateHandshakeAction(pairingModalData.node.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded shadow-sm transition-colors"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Simulate VPS Handshake</span>
                  </button>
                )}
              </div>

              {/* 1. Generated Node Secret Token */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-emerald-400" />
                    1. High-Entropy Node Secret Token
                  </label>
                  <button
                    onClick={() => handleCopy('token', pairingModalData.token)}
                    className="text-xs font-mono text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    {copiedKey === 'token' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'token' ? 'Copied Token' : 'Copy Secret'}</span>
                  </button>
                </div>
                <div className="p-3 bg-[#080b11] border border-slate-800 rounded font-mono text-xs text-emerald-400 break-all select-all">
                  {pairingModalData.token}
                </div>
              </div>

              {/* 2. One-Click Automated Terminal Command */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-sky-400" />
                    2. Automated 1-Click VPS Terminal Command
                  </label>
                  <button
                    onClick={() => handleCopy('cmd', pairingModalData.installCommand)}
                    className="text-xs font-mono text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    {copiedKey === 'cmd' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'cmd' ? 'Copied Command' : 'Copy Command'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-[#080b11] border border-slate-800 rounded font-mono text-xs text-sky-300 whitespace-pre-wrap break-all select-all">
                  {pairingModalData.installCommand}
                </pre>
                <p className="text-[11px] text-slate-400 mt-1">
                  Installs Docker, dependencies, writes <code className="text-slate-300">/etc/mc-daemon/config.json</code>, and performs dynamic handshake.
                </p>
              </div>

              {/* 3. JSON Configuration Snippet (/etc/mc-daemon/config.json) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-purple-400" />
                    3. JSON Config Snippet (<span className="text-slate-400 font-mono">/etc/mc-daemon/config.json</span>)
                  </label>
                  <button
                    onClick={() => handleCopy('json', JSON.stringify(pairingModalData.configSnippet, null, 2))}
                    className="text-xs font-mono text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    {copiedKey === 'json' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'json' ? 'Copied JSON' : 'Copy JSON'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-[#080b11] border border-slate-800 rounded font-mono text-xs text-purple-300 overflow-x-auto select-all">
                  {JSON.stringify(pairingModalData.configSnippet, null, 2)}
                </pre>
              </div>
            </div>

            <div className="px-6 py-3 bg-[#131a2a] border-t border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setPairingModalData(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
