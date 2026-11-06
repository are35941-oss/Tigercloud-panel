import React, { useState } from 'react';
import { Shield, Key, Check, LogIn, LogOut, AlertCircle, CheckCircle2, User } from 'lucide-react';
import { api, setToken, getToken } from '../services/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: { username: string; role: string; email?: string } | null;
  onLoginSuccess: (user: any) => void;
  onLogout: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLoginSuccess,
  onLogout,
}) => {
  const [username, setUsername] = useState('tiger');
  const [password, setPassword] = useState('Tiger_God');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.login(username.trim(), password);
      onLoginSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFillCredentials = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  const handleCopyToken = () => {
    const token = getToken();
    navigator.clipboard.writeText(token);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-[#0f1420] border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#131a2a] border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Admin Authentication & Session</h3>
              <p className="text-xs text-slate-400 mt-0.5">Role-based JWT Session Management</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded">
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Active Session Info Box */}
          <div className="p-3.5 bg-[#090d15] border border-slate-800/80 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-slate-400">Current Session:</span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                {currentUser?.role || 'SUPER_ADMIN'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white font-mono flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                {currentUser?.username || 'tiger'}
              </span>
              <button
                onClick={handleCopyToken}
                className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 font-mono"
              >
                {copiedToken ? <Check className="w-3 h-3 text-emerald-400" /> : <Key className="w-3 h-3" />}
                <span>{copiedToken ? 'Copied JWT' : 'Copy JWT'}</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-xs text-rose-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full bg-[#151c2c] border border-slate-700 text-sm font-mono text-white rounded px-3 py-2 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-[#151c2c] border border-slate-700 text-sm font-mono text-white rounded px-3 py-2 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Quick autofill pills */}
            <div className="pt-1">
              <span className="text-[11px] text-slate-400 block mb-1.5">Quick Seeding Credentials:</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleFillCredentials('tiger', 'Tiger_God')}
                  className="px-2.5 py-1 text-xs font-mono rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-400 flex items-center gap-1"
                >
                  <Shield className="w-3 h-3" />
                  <span>tiger / Tiger_God (Super Admin)</span>
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={onLogout}
                className="px-3 py-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded transition-colors flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Reset Session</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs text-slate-300 hover:text-white bg-slate-800 rounded transition-colors"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded transition-colors flex items-center gap-1.5"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{loading ? 'Authenticating...' : 'Sign In as Admin'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
