import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ServerList } from './components/ServerList';
import { ServerDetail } from './components/ServerDetail';
import { AllocationsView } from './components/AllocationsView';
import { NodesView } from './components/NodesView';
import { AdminHubView } from './components/AdminHubView';
import { CreateServerModal } from './components/CreateServerModal';
import { InstallerDeployModal } from './components/InstallerDeployModal';
import { AuthModal } from './components/AuthModal';
import { MinecraftServer, SystemStats, PortAllocation, NodeAgent } from './types';
import { api, setToken } from './services/api';
import { Terminal, Download, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState<'servers' | 'nodes' | 'allocations' | 'admin' | 'deploy' | 'server-detail'>('servers');
  const [currentUser, setCurrentUser] = useState<{ id?: string; username: string; role: string; email?: string } | null>({
    username: 'tiger',
    role: 'SUPER_ADMIN',
    email: 'tiger@obsidian-node.internal',
  });
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [servers, setServers] = useState<MinecraftServer[]>([]);
  const [nodes, setNodes] = useState<NodeAgent[]>([]);
  const [allocations, setAllocations] = useState<PortAllocation[]>([]);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [createServerModalOpen, setCreateServerModalOpen] = useState(false);
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = async () => {
    try {
      const [serversData, nodesData, allocsData, statsData] = await Promise.all([
        api.getServers(),
        api.getNodes(),
        api.getAllocations(),
        api.getSystemStats(),
      ]);
      setServers(serversData);
      setNodes(nodesData);
      setAllocations(allocsData);
      setSystemStats(statsData);
    } catch (err: any) {
      console.error('Failed to load initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(async () => {
      try {
        const [serversData, statsData] = await Promise.all([
          api.getServers(),
          api.getSystemStats(),
        ]);
        setServers(serversData);
        setSystemStats(statsData);
      } catch (err) {
        // ignore background poll
      }
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  const handleSelectServer = (server: MinecraftServer) => {
    setSelectedServerId(server.id);
    setCurrentView('server-detail');
  };

  const handlePowerAction = async (serverId: string, action: 'start' | 'stop' | 'restart' | 'kill') => {
    try {
      await api.setPower(serverId, action);
      showToast(`Power command dispatched: Server is now ${action}ing`, 'info');
      const updated = await api.getServers();
      setServers(updated);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleSendCommand = async (command: string) => {
    if (!selectedServerId) return;
    try {
      await api.sendCommand(selectedServerId, command);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateServer = async (serverData: any) => {
    try {
      const created = await api.createServer(serverData);
      showToast(`Server container "${created.name}" created on node ${created.nodeId}!`, 'success');
      await loadData();
      setSelectedServerId(created.id);
      setCurrentView('server-detail');
    } catch (err: any) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    try {
      await api.deleteServer(serverId);
      showToast('Server container and storage purged', 'info');
      await loadData();
      setSelectedServerId(null);
      setCurrentView('servers');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handlePingNode = async (id: string) => {
    try {
      const res = await api.pingNode(id);
      showToast(`Node ${id} responded in ${res.pingMs}ms (Status: ${res.status})`, 'success');
      const updatedNodes = await api.getNodes();
      setNodes(updatedNodes);
    } catch (err: any) {
      showToast(`Ping failed: ${err.message}`, 'error');
    }
  };

  const handleCreateNode = async (nodeData: any) => {
    try {
      const result = await api.createNode(nodeData);
      showToast(`Node "${result.node.name}" registered (OFFLINE). Execute pairing command to bring ONLINE!`, 'info');
      const updated = await api.getNodes();
      setNodes(updated);
      return result;
    } catch (err: any) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  const handleSimulateHandshake = async (id: string) => {
    try {
      const res = await api.simulateHandshake(id);
      showToast(`Dynamic Handshake verified: Node "${res.node.name}" is now ONLINE!`, 'success');
      const updated = await api.getNodes();
      setNodes(updated);
    } catch (err: any) {
      showToast(`Handshake failed: ${err.message}`, 'error');
    }
  };

  const handleDeleteNode = async (id: string) => {
    try {
      await api.deleteNode(id);
      showToast('Remote node removed from cluster', 'info');
      const updated = await api.getNodes();
      setNodes(updated);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateAllocation = async (port: number, protocol: 'TCP' | 'UDP' | 'BOTH', notes?: string) => {
    try {
      await api.createAllocation('node-us-east', port, protocol, notes);
      showToast(`Port :${port} registered in allocation table!`, 'success');
      const allocs = await api.getAllocations();
      setAllocations(allocs);
    } catch (err: any) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  const handleDeleteAllocation = async (id: string) => {
    try {
      await api.deleteAllocation(id);
      showToast('Port allocation released', 'info');
      const allocs = await api.getAllocations();
      setAllocations(allocs);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const selectedServer = servers.find((s) => s.id === selectedServerId);

  return (
    <div className="min-h-screen bg-[#0c0f17] text-slate-200 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-white">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-2xl border bg-[#111622] text-xs font-medium animate-slide-up text-white border-slate-700">
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header */}
      <Header
        currentView={currentView}
        onNavigate={(view) => {
          setCurrentView(view);
          if (view === 'deploy') setDeployModalOpen(true);
        }}
        onOpenCreateServerModal={() => setCreateServerModalOpen(true)}
        onOpenCreateNodeModal={() => setCurrentView('nodes')}
        onOpenDeployModal={() => setDeployModalOpen(true)}
        dockerMode={systemStats?.docker?.mode}
        onlineNodesCount={nodes.filter(n => n.status === 'ONLINE').length}
        currentUser={currentUser}
        onOpenAuthModal={() => setAuthModalOpen(true)}
      />

      {/* Main Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500 font-mono text-xs">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
            <span>Connecting to Obsidian Central Cluster Hub...</span>
          </div>
        ) : currentView === 'server-detail' && selectedServer ? (
          <ServerDetail
            server={selectedServer}
            onBack={() => {
              setCurrentView('servers');
              setSelectedServerId(null);
            }}
            onPowerAction={handlePowerAction}
            onSendCommand={handleSendCommand}
            onDeleteServer={handleDeleteServer}
            onRefreshServer={loadData}
          />
        ) : currentView === 'nodes' ? (
          <NodesView
            nodes={nodes}
            onPingNode={handlePingNode}
            onCreateNode={handleCreateNode}
            onDeleteNode={handleDeleteNode}
            onRefresh={loadData}
            onSimulateHandshake={handleSimulateHandshake}
          />
        ) : currentView === 'allocations' ? (
          <AllocationsView
            allocations={allocations}
            servers={servers}
            onCreateAllocation={handleCreateAllocation}
            onDeleteAllocation={handleDeleteAllocation}
          />
        ) : currentView === 'admin' ? (
          <AdminHubView />
        ) : (
          <ServerList
            servers={servers}
            systemStats={systemStats}
            onSelectServer={handleSelectServer}
            onPowerAction={handlePowerAction}
            onOpenCreateModal={() => setCreateServerModalOpen(true)}
            onRefresh={loadData}
          />
        )}
      </main>

      {/* Modals */}
      <CreateServerModal
        isOpen={createServerModalOpen}
        onClose={() => setCreateServerModalOpen(false)}
        onSubmit={handleCreateServer}
        availablePort={25567}
        nodes={nodes}
      />

      <InstallerDeployModal
        isOpen={deployModalOpen}
        onClose={() => setDeployModalOpen(false)}
      />

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        currentUser={currentUser}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          showToast(`Logged in as Super Admin "${user.username}"! Full administrative access unlocked.`, 'success');
        }}
        onLogout={() => {
          setToken('');
          setCurrentUser(null);
          showToast('Session logged out', 'info');
        }}
      />

      {/* Quiet Footer */}
      <footer className="border-t border-slate-800/80 bg-[#090c13] py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 font-mono">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-semibold">ObsidianNode Cluster</span>
            <span>·</span>
            <span>Pterodactyl & Wings Architecture</span>
            <span>·</span>
            <span>{nodes.length} Daemon Nodes Linked</span>
          </div>
          <div>
            <span>Run on Central VPS: </span>
            <code className="text-emerald-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
              chmod +x install-panel.sh && sudo ./install-panel.sh
            </code>
          </div>
        </div>
      </footer>
    </div>
  );
}
