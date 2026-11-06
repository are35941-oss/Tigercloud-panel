import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, Upload, Image as ImageIcon, Trash2, Save, 
  RotateCw, Check, AlertCircle, Copy, Palette, Eye, Wifi, ExternalLink
} from 'lucide-react';
import { MinecraftServer, ServerBranding } from '../types';
import { api } from '../services/api';

interface ServerBrandingViewProps {
  server: MinecraftServer;
  onRefreshServer: () => void;
}

// Minecraft Color Palette Definition (§0 - §f + formatting)
const MC_COLORS = [
  { code: '§0', name: 'Black', hex: '#000000', textLight: true },
  { code: '§1', name: 'Dark Blue', hex: '#0000AA', textLight: true },
  { code: '§2', name: 'Dark Green', hex: '#00AA00', textLight: true },
  { code: '§3', name: 'Dark Aqua', hex: '#00AAAA', textLight: true },
  { code: '§4', name: 'Dark Red', hex: '#AA0000', textLight: true },
  { code: '§5', name: 'Dark Purple', hex: '#AA00AA', textLight: true },
  { code: '§6', name: 'Gold', hex: '#FFAA00', textLight: false },
  { code: '§7', name: 'Gray', hex: '#AAAAAA', textLight: false },
  { code: '§8', name: 'Dark Gray', hex: '#555555', textLight: true },
  { code: '§9', name: 'Blue', hex: '#5555FF', textLight: true },
  { code: '§a', name: 'Green', hex: '#55FF55', textLight: false },
  { code: '§b', name: 'Aqua', hex: '#55FFFF', textLight: false },
  { code: '§c', name: 'Red', hex: '#FF5555', textLight: false },
  { code: '§d', name: 'Light Purple', hex: '#FF55FF', textLight: false },
  { code: '§e', name: 'Yellow', hex: '#FFFF55', textLight: false },
  { code: '§f', name: 'White', hex: '#FFFFFF', textLight: false },
];

const MC_FORMATS = [
  { code: '§l', name: 'Bold', label: 'B' },
  { code: '§o', name: 'Italic', label: 'I' },
  { code: '§n', name: 'Underline', label: 'U' },
  { code: '§m', name: 'Strikethrough', label: 'S' },
  { code: '§k', name: 'Magic', label: '?' },
  { code: '§r', name: 'Reset', label: '✕' },
];

export const ServerBrandingView: React.FC<ServerBrandingViewProps> = ({ server, onRefreshServer }) => {
  const [branding, setBranding] = useState<ServerBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [activeInput, setActiveInput] = useState<'line1' | 'line2'>('line1');
  const [savingMotd, setSavingMotd] = useState(false);
  const [motdSaved, setMotdSaved] = useState(false);

  // Icon upload state
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const line1Ref = useRef<HTMLInputElement>(null);
  const line2Ref = useRef<HTMLInputElement>(null);

  const loadBranding = async () => {
    setLoading(true);
    try {
      const data = await api.getServerBranding(server.id);
      setBranding(data);
      setLine1(data.motdLine1 || '');
      setLine2(data.motdLine2 || '');
      setIconPreview(data.iconDataUrl || null);
    } catch (err) {
      console.error('Failed to load server branding:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranding();
  }, [server.id]);

  const handleInsertCode = (code: string) => {
    if (activeInput === 'line1') {
      const input = line1Ref.current;
      if (input) {
        const start = input.selectionStart || line1.length;
        const end = input.selectionEnd || line1.length;
        const next = line1.substring(0, start) + code + line1.substring(end);
        setLine1(next);
        setTimeout(() => {
          input.focus();
          input.setSelectionRange(start + code.length, start + code.length);
        }, 10);
      } else {
        setLine1(prev => prev + code);
      }
    } else {
      const input = line2Ref.current;
      if (input) {
        const start = input.selectionStart || line2.length;
        const end = input.selectionEnd || line2.length;
        const next = line2.substring(0, start) + code + line2.substring(end);
        setLine2(next);
        setTimeout(() => {
          input.focus();
          input.setSelectionRange(start + code.length, start + code.length);
        }, 10);
      } else {
        setLine2(prev => prev + code);
      }
    }
  };

  const handleSaveMotd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingMotd(true);
    try {
      await api.updateServerMotd(server.id, line1, line2);
      setMotdSaved(true);
      setTimeout(() => setMotdSaved(false), 2500);
      onRefreshServer();
    } catch (err: any) {
      alert(`Failed to save MOTD: ${err.message}`);
    } finally {
      setSavingMotd(false);
    }
  };

  const processAndUploadIcon = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (PNG, JPG, WebP).');
      return;
    }
    setUploadingIcon(true);
    try {
      const result = await api.uploadServerIcon(server.id, file);
      setIconPreview(result.iconDataUrl);
      setBranding(prev => prev ? { ...prev, hasCustomIcon: true, iconDataUrl: result.iconDataUrl } : null);
      onRefreshServer();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploadingIcon(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processAndUploadIcon(e.dataTransfer.files[0]);
    }
  };

  const handleDeleteIcon = async () => {
    if (!confirm('Reset to default server icon? This will remove server-icon.png.')) return;
    try {
      await api.deleteServerIcon(server.id);
      setIconPreview(null);
      setBranding(prev => prev ? { ...prev, hasCustomIcon: false, iconDataUrl: undefined } : null);
      onRefreshServer();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const applyPresetMotd = (l1: string, l2: string) => {
    setLine1(l1);
    setLine2(l2.replace('{PORT}', String(server.port)));
  };

  // Helper to render Minecraft formatted string into HTML spans
  const renderMinecraftFormatted = (text: string) => {
    if (!text) return <span className="text-[#AAAAAA] italic">Empty message</span>;

    const tokens: React.ReactNode[] = [];
    let currentColor = '#FFFFFF';
    let isBold = false;
    let isItalic = false;
    let isUnderline = false;
    let isStrike = false;

    // Split text by formatting codes (§ followed by code or &#HEX)
    const regex = /(§[0-9a-fk-or]|&#[0-9a-fA-F]{6})/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    let segmentIndex = 0;

    const pushSegment = (content: string) => {
      if (!content) return;
      tokens.push(
        <span
          key={`seg-${segmentIndex++}`}
          style={{
            color: currentColor,
            fontWeight: isBold ? 700 : 400,
            fontStyle: isItalic ? 'italic' : 'normal',
            textDecoration: [
              isUnderline ? 'underline' : '',
              isStrike ? 'line-through' : '',
            ].filter(Boolean).join(' ') || 'none',
            textShadow: '1px 1px 0px rgba(0,0,0,0.7)',
          }}
        >
          {content}
        </span>
      );
    };

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        pushSegment(text.substring(lastIndex, match.index));
      }

      const code = match[0].toLowerCase();
      if (code.startsWith('&#')) {
        currentColor = code.substring(1);
      } else {
        const char = code.charAt(1);
        const colorMatch = MC_COLORS.find(c => c.code.endsWith(char));
        if (colorMatch) {
          currentColor = colorMatch.hex;
          isBold = false;
          isItalic = false;
          isUnderline = false;
          isStrike = false;
        } else if (char === 'l') isBold = true;
        else if (char === 'o') isItalic = true;
        else if (char === 'n') isUnderline = true;
        else if (char === 'm') isStrike = true;
        else if (char === 'r') {
          currentColor = '#FFFFFF';
          isBold = false;
          isItalic = false;
          isUnderline = false;
          isStrike = false;
        }
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      pushSegment(text.substring(lastIndex));
    }

    return <>{tokens}</>;
  };

  return (
    <div className="space-y-6">
      {/* 1. Live In-Game Multiplayer Browser Preview */}
      <div className="bg-[#111622] border border-slate-800 rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-400" />
              <span>Multiplayer Server List Preview</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live in-game appearance as rendered in the official Minecraft client server list.
            </p>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
            Client View: Java 1.21.x
          </span>
        </div>

        {/* Authentic Minecraft Server Browser Item */}
        <div className="bg-[#181a20] border-2 border-[#2b2d38] rounded-md p-3 font-mono shadow-inner flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* 64x64 Pixelated Server Icon */}
            <div className="w-16 h-16 rounded bg-[#0b0d13] border border-slate-700/80 shrink-0 overflow-hidden flex items-center justify-center relative shadow">
              {iconPreview ? (
                <img
                  src={iconPreview}
                  alt="Server Icon"
                  className="w-16 h-16 object-cover"
                  style={{ imageRendering: 'pixelated' }}
                />
              ) : (
                <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center text-slate-600">
                  <ImageIcon className="w-6 h-6 stroke-[1.5]" />
                  <span className="text-[9px] font-mono">64x64</span>
                </div>
              )}
            </div>

            {/* Server Display & 2-Line MOTD */}
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white tracking-wide truncate">
                  {server.name}
                </span>
                <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/40 border border-emerald-800/40 px-1 rounded">
                  ONLINE
                </span>
              </div>

              {/* Line 1 */}
              <div className="text-xs tracking-wide leading-tight truncate">
                {renderMinecraftFormatted(line1)}
              </div>

              {/* Line 2 */}
              <div className="text-xs tracking-wide leading-tight truncate">
                {renderMinecraftFormatted(line2)}
              </div>
            </div>
          </div>

          {/* Right Signal bars & Player count */}
          <div className="flex flex-col items-end shrink-0 gap-1 text-right">
            <div className="flex items-center gap-1.5" title="Latency: 4ms · PaperMC 1.21.1">
              <span className="text-xs text-slate-300 font-mono">
                <span className="text-emerald-400 font-bold">0</span>
                <span className="text-slate-500">/{server.maxPlayers}</span>
              </span>
              <div className="flex items-end gap-0.5 h-3.5 pl-1" title="Signal: 5/5 Bars">
                <div className="w-1 h-1.5 bg-emerald-400 rounded-xs" />
                <div className="w-1 h-2 bg-emerald-400 rounded-xs" />
                <div className="w-1 h-2.5 bg-emerald-400 rounded-xs" />
                <div className="w-1 h-3 bg-emerald-400 rounded-xs" />
                <div className="w-1 h-3.5 bg-emerald-400 rounded-xs" />
              </div>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              0.0.0.0:{server.port}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 2. Server Icon Manager */}
        <div className="bg-[#111622] border border-slate-800 rounded-lg p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-sky-400" />
              <span>Server Icon Manager</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Auto-processed via Sharp strictly into a 64x64 PNG format.
            </p>
          </div>

          {/* Upload Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-all ${
              isDragOver
                ? 'border-emerald-500 bg-emerald-500/10'
                : 'border-slate-700/80 hover:border-slate-600 bg-[#0c1018]'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files?.[0] && processAndUploadIcon(e.target.files[0])}
              accept="image/*"
              className="hidden"
            />

            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                {uploadingIcon ? (
                  <RotateCw className="w-5 h-5 animate-spin text-emerald-400" />
                ) : (
                  <Upload className="w-5 h-5 text-slate-400" />
                )}
              </div>
              <div className="text-xs text-white font-medium">
                {uploadingIcon ? 'Processing 64x64 PNG...' : 'Drop image or click to browse'}
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                PNG, JPG, WebP (auto-resized & cropped to 64x64)
              </span>
            </div>
          </div>

          {/* Icon Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <span className="text-xs text-slate-400 font-mono">
              Status: <b className={iconPreview ? 'text-emerald-400' : 'text-slate-500'}>
                {iconPreview ? 'Custom Icon Active' : 'Default Mojang Icon'}
              </b>
            </span>

            {iconPreview && (
              <button
                type="button"
                onClick={handleDeleteIcon}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-rose-400 hover:text-white hover:bg-rose-600/20 rounded transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reset to Default</span>
              </button>
            )}
          </div>

          <div className="p-3 bg-[#0c1018] border border-slate-800 rounded text-[11px] text-slate-400 space-y-1">
            <div className="text-slate-300 font-semibold flex items-center gap-1.5">
              <span>Minecraft Protocol Specs</span>
            </div>
            <p>
              Saved as <code className="text-slate-300">server-icon.png</code> in root directory. Resized to exact 64x64 pixels per vanilla protocol specification.
            </p>
          </div>
        </div>

        {/* 3. 2-Line Live MOTD Creator */}
        <div className="lg:col-span-2 bg-[#111622] border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <Palette className="w-4 h-4 text-emerald-400" />
                <span>2-Line MOTD Creator</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Design custom color codes and formatting. Automatically synchronizes with <code className="text-slate-300">server.properties</code>.
              </p>
            </div>

            {/* Quick SMP presets */}
            <div className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => applyPresetMotd('§e§lTOKEN§6§lSMP §7» §fSeason IV Launch', '§a✔ §fCustom Enchants §7| §e/tokenshop §7| §b0.0.0.0:{PORT}')}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono transition-colors"
              >
                TokenSMP Preset
              </button>
              <button
                type="button"
                onClick={() => applyPresetMotd('§c§lGEM§4§lSTEAL §fSMP §7[§cSEASON 3§7]', '§4⚔ §fKill to Steal Hearts §7| §cRevive Beacons Active')}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono transition-colors"
              >
                LifeSteal Preset
              </button>
            </div>
          </div>

          {/* Formatting & Color Palette Toolbar */}
          <div className="p-3 bg-[#0c1018] border border-slate-800 rounded-lg space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-semibold text-slate-300">Minecraft Colors (§0 – §f)</span>
              <span>Click to insert at cursor position</span>
            </div>

            <div className="flex flex-wrap gap-1">
              {MC_COLORS.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => handleInsertCode(c.code)}
                  title={`${c.name} (${c.code})`}
                  style={{ backgroundColor: c.hex }}
                  className={`px-2 py-1 rounded text-[11px] font-mono font-bold transition-transform active:scale-95 shadow-xs border border-white/10 ${
                    c.textLight ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {c.code}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
              <span className="font-semibold text-slate-300">Formatting Styles</span>
              <div className="flex items-center gap-1">
                {MC_FORMATS.map((f) => (
                  <button
                    key={f.code}
                    type="button"
                    onClick={() => handleInsertCode(f.code)}
                    title={`${f.name} (${f.code})`}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold rounded transition-colors"
                  >
                    <span>{f.code}</span> <span className="text-[10px] text-slate-400 font-normal">({f.name})</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* MOTD Inputs */}
          <form onSubmit={handleSaveMotd} className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1 text-xs">
                <label className="font-medium text-slate-300">Line 1 (Top Header)</label>
                <span className="text-slate-500 font-mono text-[11px]">{line1.length} chars</span>
              </div>
              <input
                ref={line1Ref}
                type="text"
                value={line1}
                onFocus={() => setActiveInput('line1')}
                onChange={(e) => setLine1(e.target.value)}
                placeholder="e.g. §a§lObsidianNode §7» §fHigh-Performance Minecraft"
                className="w-full bg-[#151c2c] border border-slate-700 text-sm font-mono text-white rounded px-3 py-2 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1 text-xs">
                <label className="font-medium text-slate-300">Line 2 (Subtitle / Features / IP)</label>
                <span className="text-slate-500 font-mono text-[11px]">{line2.length} chars</span>
              </div>
              <input
                ref={line2Ref}
                type="text"
                value={line2}
                onFocus={() => setActiveInput('line2')}
                onChange={(e) => setLine2(e.target.value)}
                placeholder="e.g. §2⚔ §fJoin Survival §7| §e/discord §7| §b0.0.0.0:25565"
                className="w-full bg-[#151c2c] border border-slate-700 text-sm font-mono text-white rounded px-3 py-2 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <span className="text-xs text-slate-500 font-mono">
                Writes to <code className="text-slate-300">motd=...</code> in server.properties
              </span>

              <button
                type="submit"
                disabled={savingMotd}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 rounded transition-colors shadow-sm"
              >
                {motdSaved ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Saved & Synchronized!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>{savingMotd ? 'Saving...' : 'Save MOTD'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
