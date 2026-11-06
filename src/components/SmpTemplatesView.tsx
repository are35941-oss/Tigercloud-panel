import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Download, Check, AlertCircle, RefreshCw, 
  Layers, Shield, Zap, Coins, HeartPulse, Swords, ArrowRight, Info
} from 'lucide-react';
import { MinecraftServer, SmpTemplate } from '../types';
import { api } from '../services/api';

interface SmpTemplatesViewProps {
  server: MinecraftServer;
  onRefreshServer: () => void;
}

export const SmpTemplatesView: React.FC<SmpTemplatesViewProps> = ({ server, onRefreshServer }) => {
  const [templates, setTemplates] = useState<SmpTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [deployModalTemplate, setDeployModalTemplate] = useState<SmpTemplate | null>(null);
  const [deployMode, setDeployMode] = useState<'clean' | 'overlay'>('clean');
  const [deploying, setDeploying] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState<string | null>(null);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await api.getTemplates();
      setTemplates(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleDeployConfirm = async () => {
    if (!deployModalTemplate) return;
    setDeploying(true);
    try {
      const res = await api.deployTemplate(server.id, deployModalTemplate.id, deployMode);
      setDeploySuccess(res.message);
      onRefreshServer();
      setTimeout(() => {
        setDeploySuccess(null);
        setDeployModalTemplate(null);
      }, 2500);
    } catch (err: any) {
      alert(`Deployment failed: ${err.message}`);
    } finally {
      setDeploying(false);
    }
  };

  const getTemplateIcon = (iconName: string) => {
    switch (iconName) {
      case 'Coins':
        return <Coins className="w-5 h-5 text-amber-400" />;
      case 'HeartPulse':
        return <HeartPulse className="w-5 h-5 text-rose-500" />;
      case 'Swords':
        return <Swords className="w-5 h-5 text-orange-400" />;
      case 'Shield':
        return <Shield className="w-5 h-5 text-indigo-400" />;
      default:
        return <Sparkles className="w-5 h-5 text-emerald-400" />;
    }
  };

  const filtered = templates.filter(t => {
    if (selectedCategory === 'ALL') return true;
    return t.category === selectedCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 bg-gradient-to-r from-[#111622] via-[#141b2c] to-[#0e1320] border border-slate-800 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>1-Click SMP Blueprint Deployer</span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            Production-Ready Community SMP Presets
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Deploy complete server frameworks in seconds. Automatically downloads pre-configured plugins, tuned Paper/Purpur configs, economy files, and custom multiplayer branding.
          </p>
        </div>

        <button
          onClick={loadTemplates}
          className="self-start md:self-auto px-3 py-1.5 bg-[#151c2c] hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300 rounded flex items-center gap-2 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Catalog</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
        {[
          { id: 'ALL', label: 'All SMP Presets' },
          { id: 'ECONOMY', label: 'Economy & Tokens (TokenSMP)' },
          { id: 'LIFESTEAL', label: 'Hardcore Combat (GemSteal)' },
          { id: 'PVP', label: 'Competitive Duels (FireMC / BattlePie)' },
          { id: 'VANILLA_PLUS', label: 'Vanilla+ Enhanced' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedCategory(tab.id)}
            className={`px-3 py-1.5 rounded-md whitespace-nowrap transition-colors font-medium ${
              selectedCategory === tab.id
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                : 'text-slate-400 hover:text-white bg-[#111622] border border-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="py-20 text-center text-xs font-mono text-slate-500">
          Loading community SMP blueprints...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((template) => (
            <div
              key={template.id}
              className="bg-[#111622] border border-slate-800 hover:border-slate-700 rounded-lg p-5 flex flex-col justify-between transition-colors shadow-md group"
            >
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#0e131f] border border-slate-700 flex items-center justify-center shrink-0">
                      {getTemplateIcon(template.icon)}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white tracking-tight group-hover:text-emerald-300 transition-colors">
                        {template.name}
                      </h3>
                      <div className="text-xs text-slate-400 font-mono">
                        {template.tagline}
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 shrink-0 uppercase font-semibold">
                    {template.badge}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {template.description}
                </p>

                {/* Engine Recommendation Pill & Ram */}
                <div className="flex items-center gap-3 text-xs font-mono text-slate-400 pt-1">
                  <span>Engine: <b className="text-slate-200">{template.recommendedEngine} {template.recommendedVersion}</b></span>
                  <span>·</span>
                  <span>Rec. RAM: <b className="text-emerald-400">{template.recommendedRamMb} MB</b></span>
                </div>

                {/* Key Features */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Core Mechanics Included
                  </span>
                  {template.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Included Plugins Badges */}
                <div className="space-y-1.5 pt-2">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Pre-Bundled Plugin Suite
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {template.includedPlugins.map((plug) => (
                      <span
                        key={plug}
                        className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300"
                      >
                        {plug}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-500 font-mono">
                  {template.configsOverview.length} custom configs
                </span>

                <button
                  onClick={() => {
                    setDeployModalTemplate(template);
                    setDeployMode('clean');
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded transition-colors shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Deploy Setup</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Deployment Modal */}
      {deployModalTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-[#0e1320] border border-slate-800 rounded-xl shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-mono text-emerald-400 uppercase font-semibold">
                  Confirm Deployment
                </span>
                <h3 className="text-lg font-bold text-white tracking-tight mt-0.5">
                  {deployModalTemplate.name}
                </h3>
              </div>
              <button
                disabled={deploying}
                onClick={() => setDeployModalTemplate(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Target server: <b className="text-white font-mono">{server.name}</b> (: {server.port}) on node <b className="text-white font-mono">{server.nodeId}</b>.
            </p>

            {/* Installation Mode Selector */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300 block">Installation Mode</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDeployMode('clean')}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    deployMode === 'clean'
                      ? 'border-emerald-500 bg-emerald-500/10 text-white'
                      : 'border-slate-800 bg-[#121724] text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5 mb-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>Clean Installation</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Clears existing plugin jars for an optimized, pristine setup.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setDeployMode('overlay')}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    deployMode === 'overlay'
                      ? 'border-emerald-500 bg-emerald-500/10 text-white'
                      : 'border-slate-800 bg-[#121724] text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs font-bold text-sky-300 flex items-center gap-1.5 mb-1">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Non-Destructive Overlay</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Preserves current world data and non-conflicting plugins.
                  </p>
                </button>
              </div>
            </div>

            {/* Included Artifacts summary */}
            <div className="p-3 bg-[#121724] border border-slate-800 rounded-lg text-xs space-y-1.5 font-mono">
              <div className="text-slate-400 text-[11px]">Deploy Actions:</div>
              <div className="text-slate-300 flex items-center gap-2">
                <span className="text-emerald-400">✓</span>
                <span>Configure 2-line themed server.properties MOTD</span>
              </div>
              <div className="text-slate-300 flex items-center gap-2">
                <span className="text-emerald-400">✓</span>
                <span>Generate matching 64x64 server-icon.png</span>
              </div>
              <div className="text-slate-300 flex items-center gap-2">
                <span className="text-emerald-400">✓</span>
                <span>Install {deployModalTemplate.includedPlugins.length} preset plugins & configs</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <span className="text-xs text-slate-500 font-mono">
                Port :{server.port} will be preserved
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={deploying}
                  onClick={() => setDeployModalTemplate(null)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 rounded transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={deploying}
                  onClick={handleDeployConfirm}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 rounded transition-colors"
                >
                  {deploySuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Setup Complete!</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className={`w-3.5 h-3.5 ${deploying ? 'animate-spin' : ''}`} />
                      <span>{deploying ? 'Deploying Blueprint...' : 'Deploy to Container'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
