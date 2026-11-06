import React, { useState, useEffect } from 'react';
import { 
  Shield, Users, Key, FileText, Plus, Trash2, 
  Check, Copy, Clock, RefreshCw, AlertCircle, CheckCircle2 
} from 'lucide-react';
import { UserAccount, AuditLog, ApiToken, UserRole } from '../types';
import { api } from '../services/api';

export const AdminHubView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'audit' | 'tokens'>('users');
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);

  // User Creation Modal State
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('SUB_USER');
  const [creatingUser, setCreatingUser] = useState(false);

  // Token Creation Modal State
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [tokenName, setTokenName] = useState('');
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [creatingToken, setCreatingToken] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [u, a, t] = await Promise.all([
        api.getUsers(),
        api.getAuditLogs(),
        api.getApiTokens(),
      ]);
      setUsers(u);
      setAuditLogs(a);
      setTokens(t);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newEmail.trim()) return;

    setCreatingUser(true);
    try {
      await api.createUser({
        username: newUsername.trim(),
        email: newEmail.trim(),
        role: newRole,
        serverPermissions: newRole === 'SUPER_ADMIN' ? ['*'] : ['srv-paper-survival'],
      });
      setUserModalOpen(false);
      setNewUsername('');
      setNewEmail('');
      await loadAll();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await api.deleteUser(id);
      await loadAll();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenName.trim()) return;

    setCreatingToken(true);
    try {
      const res = await api.createApiToken(tokenName.trim(), ['servers:read', 'servers:power', 'servers:files']);
      setCreatedSecret(res.secret);
      setTokenName('');
      await loadAll();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreatingToken(false);
    }
  };

  const handleDeleteToken = async (id: string) => {
    if (!confirm('Revoke this API token? Any automated scripts using it will lose access immediately.')) return;
    try {
      await api.deleteApiToken(id);
      await loadAll();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCopySecret = () => {
    if (!createdSecret) return;
    navigator.clipboard.writeText(createdSecret);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">Super Admin</span>;
      case 'SUB_USER':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">Sub-User</span>;
      case 'VIEWER':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700">Viewer</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Global Administration & Security Hub</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Role-based user permissions, Pterodactyl-compatible API keys, and immutable system audit logs.
          </p>
        </div>

        <button
          onClick={loadAll}
          className="p-2 text-slate-400 hover:text-white bg-[#111622] border border-slate-800 rounded-md transition-colors self-start sm:self-auto"
          title="Refresh Data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-[#111622] border border-slate-800 rounded-lg w-full sm:w-auto">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'users' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>User Accounts ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'audit' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Audit Logs ({auditLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('tokens')}
          className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'tokens' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Key className="w-3.5 h-3.5" />
          <span>API Tokens ({tokens.length})</span>
        </button>
      </div>

      {/* Tab 1: Users */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setUserModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-md transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create User</span>
            </button>
          </div>

          <div className="bg-[#111622] border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0e131f] border-b border-slate-800 text-slate-400 font-mono">
                <tr>
                  <th className="py-3 px-4 font-medium">Username</th>
                  <th className="py-3 px-4 font-medium">Email</th>
                  <th className="py-3 px-4 font-medium">Role</th>
                  <th className="py-3 px-4 font-medium">Server Scope</th>
                  <th className="py-3 px-4 font-medium">Created</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-bold text-white font-mono">{u.username}</td>
                    <td className="py-3 px-4 text-slate-300">{u.email}</td>
                    <td className="py-3 px-4">{getRoleBadge(u.role)}</td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                      {u.serverPermissions.includes('*') ? 'All Servers (*)' : `${u.serverPermissions.length} Assigned Server(s)`}
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {u.role !== 'SUPER_ADMIN' && (
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors"
                          title="Delete User"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Audit Logs */}
      {activeTab === 'audit' && (
        <div className="bg-[#111622] border border-slate-800 rounded-lg overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0e131f] border-b border-slate-800 text-slate-400 font-mono">
              <tr>
                <th className="py-3 px-4 font-medium">Timestamp</th>
                <th className="py-3 px-4 font-medium">User</th>
                <th className="py-3 px-4 font-medium">Action</th>
                <th className="py-3 px-4 font-medium">Target Server</th>
                <th className="py-3 px-4 font-medium">Event Details</th>
                <th className="py-3 px-4 font-medium text-right">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-2.5 px-4 text-slate-500 tabular-nums">
                    {new Date(log.timestamp).toLocaleTimeString()} · {new Date(log.timestamp).toLocaleDateString()}
                  </td>
                  <td className="py-2.5 px-4 font-bold text-white font-sans">{log.user}</td>
                  <td className="py-2.5 px-4">
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-emerald-300">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-slate-300 font-sans">{log.serverName || '—'}</td>
                  <td className="py-2.5 px-4 text-slate-400 max-w-xs truncate">{log.details}</td>
                  <td className="py-2.5 px-4 text-right text-slate-500">{log.ipAddress}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: API Tokens */}
      {activeTab === 'tokens' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => {
                setCreatedSecret(null);
                setTokenModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-md transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Generate API Key</span>
            </button>
          </div>

          <div className="bg-[#111622] border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0e131f] border-b border-slate-800 text-slate-400 font-mono">
                <tr>
                  <th className="py-3 px-4 font-medium">Token Name</th>
                  <th className="py-3 px-4 font-medium">Identifier Prefix</th>
                  <th className="py-3 px-4 font-medium">Permission Scopes</th>
                  <th className="py-3 px-4 font-medium">Created</th>
                  <th className="py-3 px-4 font-medium text-right">Revoke</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {tokens.map((token) => (
                  <tr key={token.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-bold text-white">{token.name}</td>
                    <td className="py-3 px-4 font-mono text-emerald-400">{token.tokenPrefix}...</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 flex-wrap">
                        {token.scopes.map(s => (
                          <span key={s} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 border border-slate-700 text-slate-300">
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                      {new Date(token.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteToken(token.id)}
                        className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors"
                        title="Revoke Token"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* User Modal */}
      {userModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-[#0f1420] border border-slate-800 rounded-xl shadow-2xl p-6">
            <h3 className="text-base font-bold text-white tracking-tight mb-1">Create User Account</h3>
            <p className="text-xs text-slate-400 mb-4">Grant access to servers with fine-grained role control.</p>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full bg-[#151c2c] border border-slate-700 text-sm text-white rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-[#151c2c] border border-slate-700 text-sm text-white rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">User Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full bg-[#151c2c] border border-slate-700 text-sm font-mono text-white rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500"
                >
                  <option value="SUB_USER">Sub-User (Manage specific assigned servers)</option>
                  <option value="VIEWER">Viewer (Read-only logs and resource monitoring)</option>
                  <option value="SUPER_ADMIN">Super Admin (Full root access to nodes & users)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="px-4 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded"
                >
                  {creatingUser ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Token Modal */}
      {tokenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-[#0f1420] border border-slate-800 rounded-xl shadow-2xl p-6">
            <h3 className="text-base font-bold text-white tracking-tight mb-1">Generate Application API Key</h3>
            <p className="text-xs text-slate-400 mb-4">Bearer token for REST API / WebSocket integration.</p>

            {createdSecret ? (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-300">
                  <div className="font-semibold mb-1 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Token Generated Successfully!</span>
                  </div>
                  Please copy this key immediately. It will not be shown again.
                </div>

                <div className="p-3 bg-[#080b11] border border-slate-800 rounded font-mono text-xs text-emerald-400 break-all select-all">
                  {createdSecret}
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleCopySecret}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded"
                  >
                    {copiedToken ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedToken ? 'Copied!' : 'Copy API Key'}</span>
                  </button>
                  <button
                    onClick={() => setTokenModalOpen(false)}
                    className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 rounded"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateToken} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Token Name / Service Description</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Discord Bot or Backup Worker"
                    value={tokenName}
                    onChange={(e) => setTokenName(e.target.value)}
                    className="w-full bg-[#151c2c] border border-slate-700 text-sm text-white rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setTokenModalOpen(false)}
                    className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingToken}
                    className="px-4 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded"
                  >
                    {creatingToken ? 'Generating...' : 'Generate Key'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
