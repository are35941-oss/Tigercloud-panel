import React, { useState } from 'react';
import { 
  Wifi, Plus, Trash2, Check, Copy, Shield, 
  ExternalLink, Server, AlertCircle 
} from 'lucide-react';
import { PortAllocation, MinecraftServer } from '../types';

interface AllocationsViewProps {
  allocations: PortAllocation[];
  servers: MinecraftServer[];
  onCreateAllocation: (port: number, protocol: 'TCP' | 'UDP' | 'BOTH', notes?: string) => Promise<void>;
  onDeleteAllocation: (id: string) => Promise<void>;
}

export const AllocationsView: React.FC<AllocationsViewProps> = ({
  allocations,
  servers,
  onCreateAllocation,
  onDeleteAllocation,
}) => {
  const [newPort, setNewPort] = useState('');
  const [protocol, setProtocol] = useState<'TCP' | 'UDP' | 'BOTH'>('BOTH');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(newPort, 10);
    if (!p || p < 1024 || p > 65535) {
      alert('Please enter a valid port between 1024 and 65535');
      return;
    }

    setSubmitting(true);
    try {
      await onCreateAllocation(p, protocol, notes);
      setNewPort('');
      setNotes('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getServerName = (serverId?: string) => {
    if (!serverId) return null;
    const s = servers.find((item) => item.id === serverId);
    return s ? s.name : serverId;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Host Port Allocations & Networking</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage dynamic port bindings on your VPS. Prevents conflicts across isolated Minecraft Docker containers.
          </p>
        </div>
      </div>

      {/* Add Port Allocation Form */}
      <form onSubmit={handleAdd} className="p-4 bg-[#111622] border border-slate-800 rounded-lg">
        <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">
          Register New Port Binding
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Port Number</label>
            <input
              type="number"
              placeholder="e.g. 25567"
              value={newPort}
              onChange={(e) => setNewPort(e.target.value)}
              className="w-full bg-[#151c2c] border border-slate-700 text-sm font-mono text-white rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Protocol</label>
            <select
              value={protocol}
              onChange={(e) => setProtocol(e.target.value as any)}
              className="w-full bg-[#151c2c] border border-slate-700 text-sm font-mono text-white rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500"
            >
              <option value="BOTH">TCP & UDP (Recommended)</option>
              <option value="TCP">TCP Only (Standard Java / RCON)</option>
              <option value="UDP">UDP Only (Geyser / Bedrock)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Description / Notes</label>
            <input
              type="text"
              placeholder="e.g. Bedrock Geyser Bridge"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#151c2c] border border-slate-700 text-sm text-white rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitting || !newPort}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 rounded transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{submitting ? 'Allocating...' : 'Allocate Port'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Allocations Table */}
      <div className="bg-[#111622] border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0e131f] border-b border-slate-800 text-slate-400 font-mono">
            <tr>
              <th className="py-3 px-4 font-medium">Port</th>
              <th className="py-3 px-4 font-medium">Protocol</th>
              <th className="py-3 px-4 font-medium">Assigned Server</th>
              <th className="py-3 px-4 font-medium">Type</th>
              <th className="py-3 px-4 font-medium">Notes</th>
              <th className="py-3 px-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {allocations.map((alloc) => {
              const serverName = getServerName(alloc.assignedServerId);
              return (
                <tr key={alloc.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-white tabular-nums">
                    <span className="text-emerald-400">:{alloc.port}</span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-300">
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[11px] border border-slate-700">
                      {alloc.protocol}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {serverName ? (
                      <span className="inline-flex items-center gap-1.5 font-medium text-slate-200">
                        <Server className="w-3.5 h-3.5 text-emerald-400" />
                        {serverName}
                      </span>
                    ) : (
                      <span className="text-slate-500 font-mono text-[11px]">Unassigned (Available)</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {alloc.isPrimary ? (
                      <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                        Primary Game Port
                      </span>
                    ) : (
                      <span className="text-slate-500 text-[11px]">Secondary</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-400 text-xs">
                    {alloc.notes || '—'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleCopy(alloc.id, `0.0.0.0:${alloc.port}`)}
                        title="Copy Address"
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                      >
                        {copiedId === alloc.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {!alloc.assignedServerId && (
                        <button
                          onClick={() => onDeleteAllocation(alloc.id)}
                          title="Delete unassigned port"
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
