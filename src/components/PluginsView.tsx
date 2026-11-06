import React, { useState, useEffect } from 'react';
import { 
  Download, Trash2, Search, Check, Star, 
  ExternalLink, Sparkles, RefreshCw, Layers, ShieldCheck, Zap
} from 'lucide-react';
import { PluginItem, MinecraftServer } from '../types';
import { api } from '../services/api';

interface PluginsViewProps {
  server: MinecraftServer;
  onRefreshServer: () => void;
}

export const PluginsView: React.FC<PluginsViewProps> = ({ server, onRefreshServer }) => {
  const [plugins, setPlugins] = useState<PluginItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState<string>('ALL');
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [autoReload, setAutoReload] = useState(true);

  const loadPlugins = async () => {
    setLoading(true);
    try {
      const data = await api.getServerPlugins(server.id);
      setPlugins(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setPlugins([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlugins();
  }, [server.id]);

  const handleInstall = async (plugin: PluginItem) => {
    setActionLoading(prev => ({ ...prev, [plugin.id]: true }));
    try {
      await api.installPlugin(server.id, plugin.id);
      if (autoReload && server.status === 'RUNNING') {
        await api.sendCommand(server.id, 'reload confirm');
      }
      await loadPlugins();
      onRefreshServer();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [plugin.id]: false }));
    }
  };

  const handleUninstall = async (plugin: PluginItem) => {
    if (!confirm(`Remove ${plugin.name} from /plugins directory?`)) return;
    setActionLoading(prev => ({ ...prev, [plugin.id]: true }));
    try {
      await api.uninstallPlugin(server.id, plugin.id);
      await loadPlugins();
      onRefreshServer();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [plugin.id]: false }));
    }
  };

  const filteredPlugins = plugins.filter(p => {
    const matchesCategory = category === 'ALL' || p.category === category;
    const matchesSearch = 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.author.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories = [
    { id: 'ALL', label: 'All Plugins' },
    { id: 'ESSENTIALS', label: 'Essentials & Economy' },
    { id: 'PERMISSIONS', label: 'Permissions (LuckPerms)' },
    { id: 'PERFORMANCE', label: 'Anti-Lag & Optimization' },
    { id: 'WORLDS', label: 'WorldEdit & Builders' },
    { id: 'PROTECTION', label: 'Anti-Grief & Logging' },
    { id: 'COSMETICS', label: 'Tablist & Chat' },
  ];

  return (
    <div className="space-y-5">
      {/* Search & Filter Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search Modrinth, SpigotMC, and Hangar catalogs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#111622] border border-slate-800 text-sm text-white pl-9 pr-3 py-1.5 rounded-md focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-300 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={autoReload}
              onChange={(e) => setAutoReload(e.target.checked)}
              className="rounded border-slate-700 text-emerald-500 focus:ring-0 w-3.5 h-3.5"
            />
            <span>Auto-reload server after download</span>
          </label>

          <button
            onClick={loadPlugins}
            className="p-1.5 text-slate-400 hover:text-white bg-[#111622] border border-slate-800 rounded-md"
            title="Refresh Catalog"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`px-3 py-1 rounded-md whitespace-nowrap transition-colors ${
              category === c.id
                ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30'
                : 'text-slate-400 hover:text-white bg-[#111622] border border-slate-800'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Plugins Grid */}
      {loading ? (
        <div className="py-20 text-center text-xs font-mono text-slate-500">
          Querying remote plugin repositories...
        </div>
      ) : filteredPlugins.length === 0 ? (
        <div className="py-16 text-center text-xs text-slate-500 bg-[#111622] border border-slate-800 rounded-lg">
          No plugins match your search criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlugins.map((plugin) => {
            const isInstalled = Boolean(plugin.isInstalled);
            const isBusy = actionLoading[plugin.id];

            return (
              <div
                key={plugin.id}
                className="bg-[#111622] border border-slate-800 hover:border-slate-700 rounded-lg p-4 flex flex-col justify-between transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                      {plugin.source}
                    </span>
                    <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      <span>{plugin.rating.toFixed(1)}</span>
                      <span>·</span>
                      <span>{(plugin.downloads / 1000000).toFixed(1)}M dl</span>
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                    <span>{plugin.name}</span>
                    <span className="text-[11px] font-mono text-slate-500 font-normal">v{plugin.version}</span>
                  </h4>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">by {plugin.author}</div>

                  <p className="text-xs text-slate-300 mt-2 line-clamp-2 leading-relaxed">
                    {plugin.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-slate-500">
                    {(plugin.fileSizeKb / 1024).toFixed(1)} MB
                  </span>

                  {isInstalled ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 font-mono">
                        <Check className="w-3.5 h-3.5" />
                        Installed
                      </span>
                      <button
                        onClick={() => handleUninstall(plugin)}
                        disabled={isBusy}
                        className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors disabled:opacity-50"
                        title="Uninstall plugin jar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleInstall(plugin)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 rounded transition-colors shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{isBusy ? 'Downloading...' : '1-Click Install'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
