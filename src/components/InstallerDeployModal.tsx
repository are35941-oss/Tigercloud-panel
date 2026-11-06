import React, { useState, useEffect } from 'react';
import { 
  X, Copy, Check, Download, Terminal, Server, 
  ShieldCheck, FileCode, HardDrive, Layers, CheckCircle2 
} from 'lucide-react';
import { api } from '../services/api';

interface InstallerDeployModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallerDeployModal: React.FC<InstallerDeployModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'panel' | 'node' | 'arch'>('panel');
  const [panelScript, setPanelScript] = useState<string>('');
  const [nodeScript, setNodeScript] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      api.getInstallScript('panel').then(setPanelScript).catch(console.error);
      api.getInstallScript('node').then(setNodeScript).catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl bg-[#0f1420] border border-slate-800 rounded-xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#131a2a] border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Production VPS Deployment Scripts (Panel & Wings Node)
              </h2>
              <p className="text-xs text-slate-400">
                Idempotent automated installers for Ubuntu 22.04/24.04 & Debian 11/12
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Command Bar */}
        <div className="px-6 py-3 bg-[#0a0d14] border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">
              {activeTab === 'panel' ? 'Central Panel Installer:' : activeTab === 'node' ? 'Remote Node Agent:' : 'Quick Run:'}
            </span>
            <code className="text-xs font-mono text-emerald-400 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded select-all">
              {activeTab === 'node' ? 'chmod +x install-node.sh && sudo ./install-node.sh' : 'chmod +x install-panel.sh && sudo ./install-panel.sh'}
            </code>
          </div>
          <button
            onClick={() => handleCopy(
              'cmd',
              activeTab === 'node'
                ? 'chmod +x install-node.sh && sudo ./install-node.sh'
                : 'chmod +x install-panel.sh && sudo ./install-panel.sh'
            )}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded transition-colors whitespace-nowrap"
          >
            {copiedKey === 'cmd' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedKey === 'cmd' ? 'Copied Command!' : 'Copy Command'}</span>
          </button>
        </div>

        {/* Nav Tabs */}
        <div className="px-6 pt-3 bg-[#131a2a]/60 border-b border-slate-800 flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('panel')}
            className={`pb-2.5 px-3 text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${
              activeTab === 'panel' ? 'border-emerald-500 text-white font-semibold' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            1. install-panel.sh (Central Hub)
          </button>

          <button
            onClick={() => setActiveTab('node')}
            className={`pb-2.5 px-3 text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${
              activeTab === 'node' ? 'border-emerald-500 text-white font-semibold' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            2. install-node.sh (Remote Wings Daemon)
          </button>

          <button
            onClick={() => setActiveTab('arch')}
            className={`pb-2.5 px-3 text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${
              activeTab === 'arch' ? 'border-emerald-500 text-white font-semibold' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Architecture & Cluster Guide
          </button>
        </div>

        {/* Content Viewport */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#0a0d14]">
          {activeTab === 'panel' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">
                  Target: /install-panel.sh · Sets up Node.js 20, Nginx SSL reverse proxy & mc-panel.service
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy('panel_script', panelScript)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 rounded border border-slate-700"
                  >
                    {copiedKey === 'panel_script' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>Copy Script</span>
                  </button>
                  <button
                    onClick={() => handleDownloadFile('install-panel.sh', panelScript)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download</span>
                  </button>
                </div>
              </div>

              <pre className="p-4 bg-[#080b11] border border-slate-800 rounded-lg font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed select-all">
                {panelScript || '# Loading install-panel.sh...'}
              </pre>
            </div>
          )}

          {activeTab === 'node' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">
                  Target: /install-node.sh · Installs Docker Engine, configures UFW firewall & mc-node.service
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy('node_script', nodeScript)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 rounded border border-slate-700"
                  >
                    {copiedKey === 'node_script' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>Copy Script</span>
                  </button>
                  <button
                    onClick={() => handleDownloadFile('install-node.sh', nodeScript)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download</span>
                  </button>
                </div>
              </div>

              <pre className="p-4 bg-[#080b11] border border-slate-800 rounded-lg font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed select-all">
                {nodeScript || '# Loading install-node.sh...'}
              </pre>
            </div>
          )}

          {activeTab === 'arch' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-2">
                  Pterodactyl & Wings Cluster Topology
                </h3>
                <pre className="p-4 bg-[#080b11] border border-slate-800 rounded-lg font-mono text-xs text-emerald-400/90 leading-relaxed overflow-x-auto">
{`                   +----------------------------------+
                   |  Central Management Hub (Panel)  |
                   |  Web Dashboard & REST / WS API   |
                   |  (Runs: mc-panel.service :3000)   |
                   +-----------------+----------------+
                                     |
         +---------------------------+---------------------------+
         | (Encrypted mTLS / Bearer)                             | (Encrypted mTLS / Bearer)
         v                                                       v
+-------------------------------+               +-------------------------------+
|    Node 1 (Local / US-East)   |               |   Node 2 (Remote / Frankfurt) |
|   Daemon Agent (Wings equiv)  |               |   Daemon Agent (Wings equiv)  |
|   (Runs: mc-node.service)     |               |   (Runs: mc-node.service)     |
+---------------+---------------+               +---------------+---------------+
                |                                               |
  +-------------+-------------+                   +-------------+-------------+
  | Docker Engine (cgroups)   |                   | Docker Engine (cgroups)   |
  |                           |                   |                           |
  | [Container 1] PaperMC     |                   | [Container 3] Purpur      |
  |   Port: 25565, 4GB RAM    |                   |   Port: 25566, 6GB RAM    |
  |   /data volume mount      |                   |   /data volume mount      |
  |                           |                   |                           |
  | [Container 2] Velocity    |                   | [Container 4] Fabric      |
  |   Port: 25577, 1GB RAM    |                   |   Port: 25567, 4GB RAM    |
  +---------------------------+                   +---------------------------+
`}
                </pre>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 bg-[#111622] border border-slate-800 rounded-lg">
                  <div className="font-semibold text-white mb-1">Central Panel Responsibilities</div>
                  <ul className="text-slate-400 space-y-1 list-disc list-inside">
                    <li>Multi-tenant Web UI & JWT user session management</li>
                    <li>Global node registry, telemetry aggregation, and health checks</li>
                    <li>Plugin repository gateway (SpigotMC, Modrinth, Hangar)</li>
                    <li>Port allocation conflict detection</li>
                  </ul>
                </div>

                <div className="p-3.5 bg-[#111622] border border-slate-800 rounded-lg">
                  <div className="font-semibold text-white mb-1">Daemon Agent (Wings) Responsibilities</div>
                  <ul className="text-slate-400 space-y-1 list-disc list-inside">
                    <li>Direct Docker daemon interaction via `/var/run/docker.sock`</li>
                    <li>Hard CPU quota (`--cpus`) and memory limits (`-m`)</li>
                    <li>Streaming stdin/stdout via WebSocket pipes</li>
                    <li>Volume path filesystem isolation (`/data`)</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#131a2a] border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-mono">
            Target OS: Ubuntu 22.04/24.04 LTS & Debian 11/12 · Root privileges required
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
