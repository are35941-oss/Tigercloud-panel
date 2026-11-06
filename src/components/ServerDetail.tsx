import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Play, Square, RotateCw, Skull, 
  Terminal, Folder, Activity, Settings, 
  Check, Copy, Users, Sparkles, Layers, ShieldAlert, Palette, Download 
} from 'lucide-react';
import { MinecraftServer, ServerStats } from '../types';
import { ConsoleView } from './ConsoleView';
import { FileManagerView } from './FileManagerView';
import { MetricsView } from './MetricsView';
import { PlayersView } from './PlayersView';
import { PluginsView } from './PluginsView';
import { StartupConfigView } from './StartupConfigView';
import { ServerBrandingView } from './ServerBrandingView';
import { SmpTemplatesView } from './SmpTemplatesView';

interface ServerDetailProps {
  server: MinecraftServer;
  onBack: () => void;
  onPowerAction: (serverId: string, action: 'start' | 'stop' | 'restart' | 'kill') => Promise<void>;
  onSendCommand: (command: string) => Promise<void>;
  onDeleteServer: (serverId: string) => Promise<void>;
  onRefreshServer: () => void;
}

export const ServerDetail: React.FC<ServerDetailProps> = ({
  server,
  onBack,
  onPowerAction,
  onSendCommand,
  onDeleteServer,
  onRefreshServer,
}) => {
  const [activeTab, setActiveTab] = useState<'console' | 'branding' | 'templates' | 'files' | 'players' | 'plugins' | 'startup' | 'metrics'>('console');
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [powerBusy, setPowerBusy] = useState(false);
  const [copiedAddr, setCopiedAddr] = useState(false);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/console`);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', serverId: server.id }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'stats' && msg.data?.serverId === server.id) {
          setStats(msg.data);
        }
      } catch (err) {
        // ignore
      }
    };

    return () => {
      ws.close();
    };
  }, [server.id]);

  const handlePower = async (action: 'start' | 'stop' | 'restart' | 'kill') => {
    if (action === 'kill' && !confirm('Are you sure you want to force kill this container? Unsaved chunk data may be lost.')) {
      return;
    }
    setPowerBusy(true);
    try {
      await onPowerAction(server.id, action);
    } finally {
      setTimeout(() => setPowerBusy(false), 800);
    }
  };

  const handleCopyAddr = () => {
    navigator.clipboard.writeText(`0.0.0.0:${server.port}`);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 2000);
  };

  const isRunning = server.status === 'RUNNING';
  const isStarting = server.status === 'STARTING';
  const isStopping = server.status === 'STOPPING';

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Power Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-slate-400 hover:text-white bg-[#111622] hover:bg-slate-800 border border-slate-800 rounded-md transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">{server.name}</h1>
              <span className="text-xs font-mono px-2 py-0.5 rounded border border-slate-700 bg-slate-800 text-slate-300">
                {server.type} {server.version}
              </span>
              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                Node: {server.nodeId || 'node-us-east'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <span>Host Port: <b className="text-white font-mono">{server.port}</b></span>
              <span>·</span>
              <button
                onClick={handleCopyAddr}
                className="hover:text-emerald-400 font-mono flex items-center gap-1"
              >
                <span>0.0.0.0:{server.port}</span>
                {copiedAddr ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>

        {/* Power Action Buttons */}
        <div className="flex items-center gap-2">
          {isRunning ? (
            <button
              disabled={powerBusy || isStopping}
              onClick={() => handlePower('stop')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 rounded-md transition-colors disabled:opacity-50"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>{isStopping ? 'Stopping...' : 'Stop'}</span>
            </button>
          ) : (
            <button
              disabled={powerBusy || isStarting}
              onClick={() => handlePower('start')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:text-slate-950 bg-emerald-500/10 hover:bg-emerald-400 border border-emerald-500/30 rounded-md transition-colors disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isStarting ? 'Starting...' : 'Start'}</span>
            </button>
          )}

          <button
            disabled={!isRunning || powerBusy}
            onClick={() => handlePower('restart')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-400 hover:text-slate-950 bg-amber-500/10 hover:bg-amber-400 border border-amber-500/30 rounded-md transition-colors disabled:opacity-40"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Restart</span>
          </button>

          <button
            disabled={!isRunning || powerBusy}
            onClick={() => handlePower('kill')}
            title="Force Kill Container (SIGKILL)"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-md transition-colors disabled:opacity-30"
          >
            <Skull className="w-3.5 h-3.5" />
            <span>Kill</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs (Functional Button Controls) */}
      <div className="flex items-center gap-1 p-1 bg-[#111622] border border-slate-800 rounded-lg overflow-x-auto">
        <button
          onClick={() => setActiveTab('console')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
            activeTab === 'console'
              ? 'bg-slate-800 text-white shadow-sm font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Console & Logs</span>
        </button>

        <button
          onClick={() => setActiveTab('branding')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
            activeTab === 'branding'
              ? 'bg-slate-800 text-white shadow-sm font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Palette className="w-3.5 h-3.5 text-emerald-400" />
          <span>Branding & MOTD</span>
        </button>

        <button
          onClick={() => setActiveTab('templates')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
            activeTab === 'templates'
              ? 'bg-slate-800 text-white shadow-sm font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>SMP Presets</span>
        </button>

        <button
          onClick={() => setActiveTab('files')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
            activeTab === 'files'
              ? 'bg-slate-800 text-white shadow-sm font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Folder className="w-3.5 h-3.5" />
          <span>File Manager</span>
        </button>

        <button
          onClick={() => setActiveTab('players')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
            activeTab === 'players'
              ? 'bg-slate-800 text-white shadow-sm font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Players</span>
        </button>

        <button
          onClick={() => setActiveTab('plugins')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
            activeTab === 'plugins'
              ? 'bg-slate-800 text-white shadow-sm font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Plugins ({(server.installedPlugins || []).length})</span>
        </button>

        <button
          onClick={() => setActiveTab('startup')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
            activeTab === 'startup'
              ? 'bg-slate-800 text-white shadow-sm font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Startup & Engine</span>
        </button>

        <button
          onClick={() => setActiveTab('metrics')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
            activeTab === 'metrics'
              ? 'bg-slate-800 text-white shadow-sm font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Metrics</span>
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'console' && (
        <ConsoleView server={server} onSendCommand={onSendCommand} stats={stats} />
      )}

      {activeTab === 'branding' && (
        <ServerBrandingView server={server} onRefreshServer={onRefreshServer} />
      )}

      {activeTab === 'templates' && (
        <SmpTemplatesView server={server} onRefreshServer={onRefreshServer} />
      )}

      {activeTab === 'files' && (
        <FileManagerView server={server} />
      )}

      {activeTab === 'players' && (
        <PlayersView server={server} />
      )}

      {activeTab === 'plugins' && (
        <PluginsView server={server} onRefreshServer={onRefreshServer} />
      )}

      {activeTab === 'startup' && (
        <StartupConfigView server={server} onRefreshServer={onRefreshServer} />
      )}

      {activeTab === 'metrics' && (
        <MetricsView server={server} stats={stats} />
      )}
    </div>
  );
};
