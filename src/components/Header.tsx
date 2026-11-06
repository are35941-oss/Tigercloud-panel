import React from 'react';
import { Terminal, Server, Plus, HardDrive, Shield, Network, Download, Users } from 'lucide-react';

interface HeaderProps {
  currentView: 'servers' | 'nodes' | 'allocations' | 'admin' | 'deploy' | 'server-detail';
  onNavigate: (view: 'servers' | 'nodes' | 'allocations' | 'admin' | 'deploy') => void;
  onOpenCreateServerModal: () => void;
  onOpenCreateNodeModal: () => void;
  onOpenDeployModal: () => void;
  dockerMode?: 'DOCKER_DAEMON' | 'VIRTUAL_SANDBOX';
  onlineNodesCount?: number;
  currentUser?: { username: string; role: string; email?: string } | null;
  onOpenAuthModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigate,
  onOpenCreateServerModal,
  onOpenCreateNodeModal,
  onOpenDeployModal,
  dockerMode,
  onlineNodesCount = 3,
  currentUser,
  onOpenAuthModal,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-[#0c0f17]/95 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onNavigate('servers')}
            className="flex items-center gap-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Terminal className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-white whitespace-nowrap">
                ObsidianNode
              </span>
              <span className="text-[11px] font-mono text-slate-400 leading-none">
                Enterprise Cluster
              </span>
            </div>
          </button>

          <span
            title="Active Daemon Nodes"
            className="hidden lg:inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono border border-slate-800 bg-slate-900/60 text-slate-300 ml-2"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>{onlineNodesCount} Nodes Active</span>
          </span>
        </div>

        {/* Zone 2: Navigation Links (single-line clean text links) */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <button
            onClick={() => onNavigate('servers')}
            className={`whitespace-nowrap transition-colors py-1 ${
              currentView === 'servers' || currentView === 'server-detail'
                ? 'text-white border-b-2 border-emerald-500 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Servers
          </button>
          <button
            onClick={() => onNavigate('nodes')}
            className={`whitespace-nowrap transition-colors py-1 ${
              currentView === 'nodes'
                ? 'text-white border-b-2 border-emerald-500 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Nodes (Wings)
          </button>
          <button
            onClick={() => onNavigate('allocations')}
            className={`whitespace-nowrap transition-colors py-1 ${
              currentView === 'allocations'
                ? 'text-white border-b-2 border-emerald-500 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Port Allocations
          </button>
          <button
            onClick={() => onNavigate('admin')}
            className={`whitespace-nowrap transition-colors py-1 ${
              currentView === 'admin'
                ? 'text-white border-b-2 border-emerald-500 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Admin & Audit
          </button>
          <button
            onClick={() => onNavigate('deploy')}
            className={`whitespace-nowrap transition-colors py-1 ${
              currentView === 'deploy'
                ? 'text-white border-b-2 border-emerald-500 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            VPS Installers
          </button>
        </nav>

        {/* Zone 3: Primary Action */}
        <div className="flex items-center gap-2.5 shrink-0">
          {onOpenAuthModal && (
            <button
              onClick={onOpenAuthModal}
              title="Click to view JWT session or switch user"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 transition-colors"
            >
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-semibold text-white">{currentUser?.username || 'tiger'}</span>
              <span className="hidden sm:inline px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                {currentUser?.role === 'SUPER_ADMIN' ? 'Super Admin' : (currentUser?.role || 'Admin')}
              </span>
            </button>
          )}

          <button
            onClick={onOpenDeployModal}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-md transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            Install Scripts
          </button>
          <button
            onClick={onOpenCreateServerModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-md transition-colors shadow-sm whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Server
          </button>
        </div>
      </div>
    </header>
  );
};
