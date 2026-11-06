import { 
  MinecraftServer, PortAllocation, SystemStats, FileEntry, 
  NodeAgent, PluginItem, OnlinePlayer, AuditLog, UserAccount, ApiToken,
  SmpTemplate, ServerBranding
} from '../types';

let authToken = localStorage.getItem('obsidian_token') || 'dev_token';

export function setToken(token: string) {
  authToken = token;
  localStorage.setItem('obsidian_token', token);
}

export function getToken(): string {
  return authToken;
}

const headers = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${authToken}`,
});

export const api = {
  // Auth
  async login(username: string, password: string) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    if (data.token) setToken(data.token);
    return data;
  },

  async getMe() {
    const res = await fetch('/api/auth/me', { headers: headers() });
    return res.json();
  },

  // 1. Nodes Management
  async getNodes(): Promise<NodeAgent[]> {
    const res = await fetch('/api/nodes', { headers: headers() });
    if (!res.ok) throw new Error('Failed to fetch nodes');
    return res.json();
  },

  async createNode(payload: any): Promise<{ success: boolean; node: NodeAgent; token: string; configSnippet: any; installCommand: string }> {
    const res = await fetch('/api/admin/nodes/create', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create node');
    return data;
  },

  async simulateHandshake(id: string): Promise<{ success: boolean; status: string; node: NodeAgent }> {
    const res = await fetch(`/api/nodes/${id}/simulate-handshake`, {
      method: 'POST',
      headers: headers(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to simulate handshake');
    return data;
  },

  async handshakeNode(payload: { node_id: string; token: string; fqdn?: string; port?: number; systemInfo?: any }) {
    const res = await fetch('/api/nodes/handshake', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Handshake failed');
    return data;
  },

  async pingNode(id: string): Promise<{ success: boolean; pingMs: number; status: string }> {
    const res = await fetch(`/api/nodes/${id}/ping`, {
      method: 'POST',
      headers: headers(),
    });
    return res.json();
  },

  async deleteNode(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/nodes/${id}`, {
      method: 'DELETE',
      headers: headers(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete node');
    return data;
  },

  // 2. Servers
  async getServers(): Promise<MinecraftServer[]> {
    const res = await fetch('/api/servers', { headers: headers() });
    if (!res.ok) throw new Error('Failed to fetch servers');
    return res.json();
  },

  async getServer(id: string): Promise<MinecraftServer> {
    const res = await fetch(`/api/servers/${id}`, { headers: headers() });
    if (!res.ok) throw new Error('Failed to fetch server details');
    return res.json();
  },

  async createServer(payload: Partial<MinecraftServer>): Promise<MinecraftServer> {
    const res = await fetch('/api/servers', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create server');
    return data;
  },

  async patchServer(id: string, updates: Partial<MinecraftServer>): Promise<MinecraftServer> {
    const res = await fetch(`/api/servers/${id}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update server');
    return data;
  },

  async switchVersion(id: string, type: string, version: string): Promise<{ success: boolean; server: MinecraftServer }> {
    const res = await fetch(`/api/servers/${id}/version`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ type, version }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to switch version');
    return data;
  },

  async deleteServer(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/servers/${id}`, {
      method: 'DELETE',
      headers: headers(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete server');
    return data;
  },

  // Power
  async setPower(id: string, action: 'start' | 'stop' | 'restart' | 'kill'): Promise<{ success: boolean; status: string }> {
    const res = await fetch(`/api/servers/${id}/power`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Failed to ${action} server`);
    return data;
  },

  // Command
  async sendCommand(id: string, command: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/servers/${id}/command`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ command }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Command failed');
    return data;
  },

  // 3. Plugins
  async getPluginCatalog(query = '', category = 'ALL'): Promise<PluginItem[]> {
    const res = await fetch(`/api/plugins/catalog?q=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}`, { headers: headers() });
    return res.json();
  },

  async getServerPlugins(id: string): Promise<PluginItem[]> {
    const res = await fetch(`/api/servers/${id}/plugins`, { headers: headers() });
    return res.json();
  },

  async installPlugin(serverId: string, pluginId: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/servers/${serverId}/plugins/install`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ pluginId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to install plugin');
    return data;
  },

  async uninstallPlugin(serverId: string, pluginId: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/servers/${serverId}/plugins/uninstall`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ pluginId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to uninstall plugin');
    return data;
  },

  // 4. Live Players
  async getOnlinePlayers(serverId: string): Promise<OnlinePlayer[]> {
    const res = await fetch(`/api/servers/${serverId}/players`, { headers: headers() });
    return res.json();
  },

  async playerAction(serverId: string, playerName: string, action: string, reason?: string, message?: string) {
    const res = await fetch(`/api/servers/${serverId}/players/action`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ playerName, action, reason, message }),
    });
    return res.json();
  },

  // 5. Files
  async listFiles(id: string, path = ''): Promise<FileEntry[]> {
    const res = await fetch(`/api/servers/${id}/files?path=${encodeURIComponent(path)}`, { headers: headers() });
    if (!res.ok) throw new Error('Failed to list files');
    return res.json();
  },

  async readFile(id: string, path: string): Promise<{ content: string; path: string }> {
    const res = await fetch(`/api/servers/${id}/files/content?path=${encodeURIComponent(path)}`, { headers: headers() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to read file');
    return data;
  },

  async writeFile(id: string, path: string, content: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/servers/${id}/files/content`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ path, content }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save file');
    return data;
  },

  async createFile(id: string, path: string, content = ''): Promise<{ success: boolean }> {
    const res = await fetch(`/api/servers/${id}/files/create`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ path, content }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create file');
    return data;
  },

  async createDirectory(id: string, path: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/servers/${id}/files/directory`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ path }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create directory');
    return data;
  },

  async deleteFile(id: string, path: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/servers/${id}/files?path=${encodeURIComponent(path)}`, {
      method: 'DELETE',
      headers: headers(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete file');
    return data;
  },

  async renameFile(id: string, oldPath: string, newName: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/servers/${id}/files/rename`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ oldPath, newName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to rename file');
    return data;
  },

  async zipFiles(id: string, path: string, zipName?: string): Promise<{ success: boolean; archivePath: string }> {
    const res = await fetch(`/api/servers/${id}/files/zip`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ path, zipName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to archive file');
    return data;
  },

  async unzipFiles(id: string, path: string, destDir = ''): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/servers/${id}/files/unzip`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ path, destDir }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to extract archive');
    return data;
  },

  async uploadFile(id: string, file: File, targetDir = ''): Promise<{ success: boolean; fileName: string; path: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('targetDir', targetDir);

    const res = await fetch(`/api/servers/${id}/files/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to upload file');
    return data;
  },

  getDownloadUrl(id: string, path: string): string {
    return `/api/servers/${id}/files/download?path=${encodeURIComponent(path)}`;
  },

  // 6. Server Branding (Icon & 2-Line MOTD)
  async getServerBranding(id: string): Promise<ServerBranding> {
    const res = await fetch(`/api/servers/${id}/branding`, { headers: headers() });
    if (!res.ok) throw new Error('Failed to fetch server branding');
    return res.json();
  },

  async uploadServerIcon(id: string, fileOrBase64: File | string): Promise<{ success: boolean; iconDataUrl: string }> {
    if (typeof fileOrBase64 === 'string') {
      const res = await fetch(`/api/servers/${id}/icon`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ imageBase64: fileOrBase64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload icon');
      return data;
    } else {
      const formData = new FormData();
      formData.append('icon', fileOrBase64);
      const res = await fetch(`/api/servers/${id}/icon`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload icon');
      return data;
    }
  },

  async deleteServerIcon(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/servers/${id}/icon`, {
      method: 'DELETE',
      headers: headers(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete icon');
    return data;
  },

  async updateServerMotd(id: string, motdLine1: string, motdLine2: string, rawMotd?: string): Promise<{ success: boolean; fullMotd: string }> {
    const res = await fetch(`/api/servers/${id}/motd`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ motdLine1, motdLine2, rawMotd }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update MOTD');
    return data;
  },

  // 7. 1-Click SMP Templates
  async getTemplates(): Promise<SmpTemplate[]> {
    const res = await fetch('/api/templates', { headers: headers() });
    if (!res.ok) throw new Error('Failed to fetch SMP templates');
    return res.json();
  },

  async deployTemplate(id: string, templateId: string, mode: 'clean' | 'overlay'): Promise<{ success: boolean; message: string; server: MinecraftServer }> {
    const res = await fetch(`/api/servers/${id}/templates/deploy`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ templateId, mode }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to deploy template');
    return data;
  },

  // 6. Allocations
  async getAllocations(): Promise<PortAllocation[]> {
    const res = await fetch('/api/allocations', { headers: headers() });
    return res.json();
  },

  async createAllocation(nodeId: string, port: number, protocol: 'TCP' | 'UDP' | 'BOTH' = 'BOTH', notes?: string): Promise<PortAllocation> {
    const res = await fetch('/api/allocations', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ nodeId, port, protocol, notes }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to allocate port');
    return data;
  },

  async deleteAllocation(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/allocations/${id}`, {
      method: 'DELETE',
      headers: headers(),
    });
    return res.json();
  },

  // 7. Admin Panel (Users, Tokens, Audit Logs)
  async getUsers(): Promise<UserAccount[]> {
    const res = await fetch('/api/admin/users', { headers: headers() });
    return res.json();
  },

  async createUser(payload: { username: string; email: string; role: string; serverPermissions: string[] }) {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async deleteUser(id: string) {
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE', headers: headers() });
    return res.json();
  },

  async getApiTokens(): Promise<ApiToken[]> {
    const res = await fetch('/api/admin/tokens', { headers: headers() });
    return res.json();
  },

  async createApiToken(name: string, scopes: string[]) {
    const res = await fetch('/api/admin/tokens', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ name, scopes }),
    });
    return res.json();
  },

  async deleteApiToken(id: string) {
    const res = await fetch(`/api/admin/tokens/${id}`, { method: 'DELETE', headers: headers() });
    return res.json();
  },

  async getAuditLogs(): Promise<AuditLog[]> {
    const res = await fetch('/api/admin/audit-logs', { headers: headers() });
    return res.json();
  },

  async getSystemStats(): Promise<SystemStats> {
    const res = await fetch('/api/system/stats', { headers: headers() });
    return res.json();
  },

  async getInstallScript(type: 'panel' | 'node'): Promise<string> {
    const endpoint = type === 'panel' ? '/api/system/install-panel' : '/api/system/install-node';
    const res = await fetch(endpoint, { headers: headers() });
    return res.text();
  },
};
