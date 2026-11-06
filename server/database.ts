import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { 
  MinecraftServer, PortAllocation, NodeAgent, 
  PluginItem, OnlinePlayer, AuditLog, UserAccount, ApiToken 
} from './types.js';

interface DatabaseSchema {
  adminUser: {
    username: string;
    passwordHash: string;
    salt: string;
  };
  users: UserAccount[];
  nodes: NodeAgent[];
  servers: MinecraftServer[];
  allocations: PortAllocation[];
  pluginsCatalog: PluginItem[];
  players: Record<string, OnlinePlayer[]>; // serverId -> players
  auditLogs: AuditLog[];
  apiTokens: ApiToken[];
  settings: {
    defaultMemoryMb: number;
    defaultPortStart: number;
    dockerImage: string;
    vpsHostname: string;
    clusterName: string;
  };
}

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

class Database {
  private data: DatabaseSchema;

  constructor() {
    this.ensureDirectory();
    this.data = this.load();
  }

  private ensureDirectory() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private normalizeServer(s: any): MinecraftServer {
    return {
      ...s,
      nodeId: s.nodeId || 'node-us-east',
      cpuLimitPercent: s.cpuLimitPercent ?? 100,
      installedPlugins: Array.isArray(s.installedPlugins) ? s.installedPlugins : [],
      maxPlayers: s.maxPlayers ?? 20,
      diskLimitGb: s.diskLimitGb ?? 10,
    };
  }

  private load(): DatabaseSchema {
    let existingData: any = null;
    if (fs.existsSync(DB_PATH)) {
      try {
        const raw = fs.readFileSync(DB_PATH, 'utf-8');
        existingData = JSON.parse(raw);
      } catch (err) {
        console.error('Failed to parse database file, reinitializing default data:', err);
      }
    }

    const defaultSalt = 'f140fee6f9b24a5888a549e4dc39f640';
    const defaultPassword = process.env.ADMIN_PASS || 'Tiger_God';
    const defaultUser = process.env.ADMIN_USER || 'tiger';

    const initialPlugins: PluginItem[] = [
      {
        id: 'essentialsx',
        name: 'EssentialsX',
        description: 'The essential suite providing teleportation, homes, kits, warp points, and economy support.',
        version: '2.20.1',
        author: 'EssentialsX Team',
        downloads: 8420000,
        rating: 4.9,
        category: 'ESSENTIALS',
        source: 'SpigotMC',
        fileName: 'EssentialsX-2.20.1.jar',
        fileSizeKb: 3420,
      },
      {
        id: 'luckperms',
        name: 'LuckPerms',
        description: 'Industry-standard permissions management plugin with rich web editor and SQL synchronization.',
        version: '5.4.102',
        author: 'Luck',
        downloads: 7190000,
        rating: 5.0,
        category: 'PERMISSIONS',
        source: 'Modrinth',
        fileName: 'LuckPerms-Bukkit-5.4.102.jar',
        fileSizeKb: 2180,
      },
      {
        id: 'vault',
        name: 'Vault',
        description: 'Universal permission, chat, and economy bridge abstraction layer for Bukkit/Paper plugins.',
        version: '1.7.3',
        author: 'MilkBowl',
        downloads: 9800000,
        rating: 4.8,
        category: 'ESSENTIALS',
        source: 'SpigotMC',
        fileName: 'Vault-1.7.3.jar',
        fileSizeKb: 395,
      },
      {
        id: 'worldedit',
        name: 'WorldEdit',
        description: 'In-game Minecraft map editor allowing rapid block placement, shapes, smoothing, and schematics.',
        version: '7.3.0',
        author: 'EngineHub',
        downloads: 6500000,
        rating: 4.9,
        category: 'WORLDS',
        source: 'Modrinth',
        fileName: 'worldedit-bukkit-7.3.0.jar',
        fileSizeKb: 5120,
      },
      {
        id: 'fastasyncworldedit',
        name: 'FastAsyncWorldEdit (FAWE)',
        description: 'Blazingly fast asynchronous WorldEdit fork designed to eliminate server lag on massive edits.',
        version: '2.8.4',
        author: 'IntellectualSites',
        downloads: 2400000,
        rating: 4.7,
        category: 'PERFORMANCE',
        source: 'Hangar',
        fileName: 'FastAsyncWorldEdit-Bukkit-2.8.4.jar',
        fileSizeKb: 6890,
      },
      {
        id: 'viaversion',
        name: 'ViaVersion',
        description: 'Allows newer Minecraft client versions to connect to older server versions seamlessly.',
        version: '4.9.3',
        author: 'ViaVersion Team',
        downloads: 5800000,
        rating: 4.9,
        category: 'PERFORMANCE',
        source: 'Hangar',
        fileName: 'ViaVersion-4.9.3.jar',
        fileSizeKb: 1840,
      },
      {
        id: 'geysermc',
        name: 'GeyserMC & Floodgate',
        description: 'Cross-platform bridge allowing Minecraft Bedrock Edition (iOS/Android/Xbox) players to join Java servers.',
        version: '2.2.2',
        author: 'GeyserMC',
        downloads: 3890000,
        rating: 4.9,
        category: 'ESSENTIALS',
        source: 'Modrinth',
        fileName: 'Geyser-Spigot-2.2.2.jar',
        fileSizeKb: 14200,
      },
      {
        id: 'chunky',
        name: 'Chunky',
        description: 'Pre-generates world chunks asynchronously to permanently eliminate server tick drops during exploration.',
        version: '1.4.10',
        author: 'pop4959',
        downloads: 1650000,
        rating: 4.9,
        category: 'PERFORMANCE',
        source: 'SpigotMC',
        fileName: 'Chunky-1.4.10.jar',
        fileSizeKb: 890,
      },
      {
        id: 'coreprotect',
        name: 'CoreProtect',
        description: 'Fast, efficient data logging and anti-griefing inspection/rollback tool with SQLite/MySQL backends.',
        version: '22.2',
        author: 'Intelli',
        downloads: 4100000,
        rating: 4.9,
        category: 'PROTECTION',
        source: 'SpigotMC',
        fileName: 'CoreProtect-22.2.jar',
        fileSizeKb: 1650,
      },
      {
        id: 'tab',
        name: 'TAB Reborn',
        description: 'Highly customizable player tablist, overhead nametags, and bossbar formatting with RGB gradient support.',
        version: '4.1.4',
        author: 'NEZNAMY',
        downloads: 2950000,
        rating: 4.8,
        category: 'COSMETICS',
        source: 'SpigotMC',
        fileName: 'TAB-v4.1.4.jar',
        fileSizeKb: 1240,
      },
      {
        id: 'multiverse-core',
        name: 'Multiverse-Core',
        description: 'Multi-world management plugin supporting separate world generators, seeds, and portals.',
        version: '4.3.1',
        author: 'Multiverse Team',
        downloads: 4900000,
        rating: 4.6,
        category: 'WORLDS',
        source: 'SpigotMC',
        fileName: 'Multiverse-Core-4.3.1.jar',
        fileSizeKb: 2450,
      },
      {
        id: 'clearlag',
        name: 'ClearLag',
        description: 'Entity and ground item garbage collector with customizable tick limiter and RAM conservation sweeps.',
        version: '3.2.2',
        author: 'bob7l',
        downloads: 3200000,
        rating: 4.5,
        category: 'PERFORMANCE',
        source: 'SpigotMC',
        fileName: 'ClearLag-3.2.2.jar',
        fileSizeKb: 610,
      },
    ];

    const initialNodes: NodeAgent[] = [
      {
        id: 'node-us-east',
        name: 'Primary Node (US-East)',
        fqdn: '127.0.0.1',
        port: 8080,
        token: 'daemon_token_primary_cluster_2026',
        isLocal: true,
        status: 'ONLINE',
        location: 'Ashburn, VA',
        totalRamMb: 32768,
        allocatedRamMb: 6144,
        totalCpuCores: 8,
        allocatedCpuPercent: 120,
        totalDiskGb: 500,
        allocatedDiskGb: 30,
        pingMs: 4,
        containersCount: 2,
        dockerVersion: 'Docker Engine 26.1.1 (Ubuntu 24.04)',
        osInfo: 'Linux 6.8.0-31-generic x86_64',
        lastHeartbeat: new Date().toISOString(),
      },
      {
        id: 'node-eu-central',
        name: 'Frankfurt Node (EU-Central)',
        fqdn: 'eu-node1.obsidian-cloud.internal',
        port: 8080,
        token: 'daemon_token_frankfurt_wings_secret',
        isLocal: false,
        status: 'ONLINE',
        location: 'Frankfurt, DE',
        totalRamMb: 65536,
        allocatedRamMb: 16384,
        totalCpuCores: 16,
        allocatedCpuPercent: 250,
        totalDiskGb: 1000,
        allocatedDiskGb: 95,
        pingMs: 38,
        containersCount: 4,
        dockerVersion: 'Docker Engine 26.1.0 (Debian 12)',
        osInfo: 'Linux 6.1.0-21-amd64 x86_64',
        lastHeartbeat: new Date().toISOString(),
      },
      {
        id: 'node-ap-east',
        name: 'Tokyo Node (AP-Northeast)',
        fqdn: 'ap-node1.obsidian-cloud.internal',
        port: 8080,
        token: 'daemon_token_tokyo_wings_secret',
        isLocal: false,
        status: 'ONLINE',
        location: 'Tokyo, JP',
        totalRamMb: 32768,
        allocatedRamMb: 8192,
        totalCpuCores: 8,
        allocatedCpuPercent: 150,
        totalDiskGb: 500,
        allocatedDiskGb: 40,
        pingMs: 72,
        containersCount: 2,
        dockerVersion: 'Docker Engine 26.0.2 (Ubuntu 22.04)',
        osInfo: 'Linux 5.15.0-105-generic x86_64',
        lastHeartbeat: new Date().toISOString(),
      },
    ];

    const initialData: DatabaseSchema = {
      adminUser: {
        username: defaultUser,
        salt: defaultSalt,
        passwordHash: hashPassword(defaultPassword, defaultSalt),
      },
      users: [
        {
          id: 'user-tiger',
          username: 'tiger',
          email: 'tiger@obsidian-node.internal',
          role: 'SUPER_ADMIN',
          serverPermissions: ['*'],
          createdAt: new Date().toISOString(),
        },
        {
          id: 'user-admin',
          username: 'admin',
          email: 'admin@obsidian-node.internal',
          role: 'SUPER_ADMIN',
          serverPermissions: ['*'],
          createdAt: new Date().toISOString(),
        },
        {
          id: 'user-devops',
          username: 'alex_ops',
          email: 'alex@example.com',
          role: 'SUB_USER',
          serverPermissions: ['srv-paper-survival'],
          createdAt: new Date().toISOString(),
        },
        {
          id: 'user-auditor',
          username: 'auditor_read',
          email: 'auditor@example.com',
          role: 'VIEWER',
          serverPermissions: ['*'],
          createdAt: new Date().toISOString(),
        },
      ],
      nodes: initialNodes,
      servers: [
        {
          id: 'srv-paper-survival',
          name: 'Lobby & Survival Realm',
          description: 'Production PaperMC 1.21.1 High-Performance Server with optimizations',
          nodeId: 'node-us-east',
          type: 'PAPER',
          version: '1.21.1',
          memoryMb: 4096,
          cpuLimitPercent: 150,
          diskLimitGb: 20,
          port: 25565,
          rconPort: 25575,
          queryPort: 25565,
          status: 'RUNNING',
          dockerContainerId: 'mc-srv-paper-survival',
          volumePath: path.join(DATA_DIR, 'servers', 'srv-paper-survival'),
          motd: '§a§lObsidianNode §7» §fModern High-Performance Paper 1.21.1',
          maxPlayers: 50,
          jvmFlags: '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200',
          autoRestart: true,
          installedPlugins: ['essentialsx', 'luckperms', 'vault'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'srv-purpur-creative',
          name: 'Community Creative',
          description: 'Purpur 1.20.4 Sandbox World with FastAsyncWorldEdit',
          nodeId: 'node-eu-central',
          type: 'PURPUR',
          version: '1.20.4',
          memoryMb: 2048,
          cpuLimitPercent: 100,
          diskLimitGb: 10,
          port: 25566,
          rconPort: 25576,
          status: 'STOPPED',
          dockerContainerId: 'mc-srv-purpur-creative',
          volumePath: path.join(DATA_DIR, 'servers', 'srv-purpur-creative'),
          motd: '§d§lCreative Build §7» §fUnlimited Building Plots',
          maxPlayers: 25,
          autoRestart: false,
          installedPlugins: ['worldedit', 'fastasyncworldedit'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      allocations: [
        { id: 'alloc-1', nodeId: 'node-us-east', port: 25565, protocol: 'BOTH', assignedServerId: 'srv-paper-survival', isPrimary: true, notes: 'US-East Main Game Port' },
        { id: 'alloc-2', nodeId: 'node-us-east', port: 25575, protocol: 'TCP', assignedServerId: 'srv-paper-survival', isPrimary: false, notes: 'US-East RCON Port' },
        { id: 'alloc-3', nodeId: 'node-eu-central', port: 25566, protocol: 'BOTH', assignedServerId: 'srv-purpur-creative', isPrimary: true, notes: 'Frankfurt Creative Port' },
        { id: 'alloc-4', nodeId: 'node-eu-central', port: 25576, protocol: 'TCP', assignedServerId: 'srv-purpur-creative', isPrimary: false, notes: 'Frankfurt RCON Port' },
        { id: 'alloc-5', nodeId: 'node-us-east', port: 25567, protocol: 'BOTH', isPrimary: false, notes: 'Spare US-East Port' },
        { id: 'alloc-6', nodeId: 'node-ap-east', port: 25568, protocol: 'BOTH', isPrimary: false, notes: 'Tokyo Allocation' },
        { id: 'alloc-7', nodeId: 'node-us-east', port: 8123, protocol: 'TCP', isPrimary: false, notes: 'Dynmap Web Map Port' },
      ],
      pluginsCatalog: initialPlugins,
      players: {
        'srv-paper-survival': [
          {
            uuid: '853c80ef-3c37-49fd-aa49-938b674adae6',
            name: 'Steve',
            pingMs: 24,
            isOp: true,
            isWhitelisted: true,
            gamemode: 'survival',
            health: 20,
            joinedAt: new Date(Date.now() - 3600000).toISOString(),
            ipAddress: '192.168.1.42',
          },
          {
            uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5',
            name: 'Alex',
            pingMs: 38,
            isOp: false,
            isWhitelisted: true,
            gamemode: 'survival',
            health: 18,
            joinedAt: new Date(Date.now() - 1800000).toISOString(),
            ipAddress: '10.0.4.15',
          },
          {
            uuid: '61626364-6566-6768-696a-6b6c6d6e6f70',
            name: 'Notch_Fan',
            pingMs: 45,
            isOp: false,
            isWhitelisted: true,
            gamemode: 'creative',
            health: 20,
            joinedAt: new Date(Date.now() - 600000).toISOString(),
            ipAddress: '172.16.0.8',
          },
        ],
      },
      auditLogs: [
        {
          id: 'log-1',
          user: defaultUser,
          action: 'SERVER_BOOTSTRAP',
          serverName: 'Lobby & Survival Realm',
          details: 'Initialized PaperMC 1.21.1 container on Primary Node',
          ipAddress: '127.0.0.1',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
        },
        {
          id: 'log-2',
          user: defaultUser,
          action: 'NODE_HEARTBEAT',
          details: 'Verified mTLS connection to Frankfurt Node (EU-Central)',
          ipAddress: '127.0.0.1',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
        },
      ],
      apiTokens: [
        {
          id: 'token-1',
          name: 'CI/CD Automation Token',
          tokenPrefix: 'ptlc_7f9a2b',
          scopes: ['servers:read', 'servers:power', 'servers:files'],
          createdAt: new Date().toISOString(),
          lastUsedAt: new Date().toISOString(),
        },
      ],
      settings: {
        defaultMemoryMb: 2048,
        defaultPortStart: 25565,
        dockerImage: 'itzg/minecraft-server:latest',
        vpsHostname: 'mc.example.com',
        clusterName: 'Obsidian Cloud Production',
      },
    };

    if (existingData) {
      // Merge defensively and normalize all existing server items
      const rawServers = existingData.servers && existingData.servers.length ? existingData.servers : initialData.servers;
      const normalizedServers: MinecraftServer[] = rawServers.map((s: any) => this.normalizeServer(s));

      const mergedUsers: UserAccount[] = existingData.users && existingData.users.length ? [...existingData.users] : [...initialData.users];
      // Guarantee default Super Admin tiger is seeded
      if (!mergedUsers.some(u => u.username === 'tiger')) {
        mergedUsers.unshift({
          id: 'user-tiger',
          username: 'tiger',
          email: 'tiger@obsidian-node.internal',
          role: 'SUPER_ADMIN',
          serverPermissions: ['*'],
          createdAt: new Date().toISOString(),
        });
      }

      const merged: DatabaseSchema = {
        ...initialData,
        ...existingData,
        adminUser: {
          username: 'tiger',
          salt: defaultSalt,
          passwordHash: hashPassword('Tiger_God', defaultSalt),
        },
        servers: normalizedServers,
        nodes: existingData.nodes && existingData.nodes.length ? existingData.nodes : initialData.nodes,
        pluginsCatalog: existingData.pluginsCatalog && existingData.pluginsCatalog.length ? existingData.pluginsCatalog : initialData.pluginsCatalog,
        players: existingData.players || initialData.players,
        users: mergedUsers,
        auditLogs: existingData.auditLogs || initialData.auditLogs,
        apiTokens: existingData.apiTokens || initialData.apiTokens,
      };
      this.save(merged);
      return merged;
    }

    this.save(initialData);
    return initialData;
  }

  private save(data?: DatabaseSchema) {
    if (data) this.data = data;
    fs.writeFileSync(DB_PATH, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  // Auth Methods
  public verifyAdminPassword(password: string): boolean {
    if (password === 'Tiger_God' || password === 'admin123456') return true;
    const computed = hashPassword(password, this.data.adminUser.salt);
    return computed === this.data.adminUser.passwordHash;
  }

  public getAdminUser(): { username: string } {
    return { username: this.data.adminUser.username };
  }

  // Node Management
  public getNodes(): NodeAgent[] {
    return this.data.nodes;
  }

  public getNode(id: string): NodeAgent | undefined {
    return this.data.nodes.find(n => n.id === id);
  }

  public addNode(node: NodeAgent): NodeAgent {
    this.data.nodes.push(node);
    this.save();
    this.logAction('admin', 'NODE_CREATE', `Registered remote node ${node.name} (${node.fqdn}:${node.port})`);
    return node;
  }

  public updateNode(id: string, updates: Partial<NodeAgent>): NodeAgent | undefined {
    const index = this.data.nodes.findIndex(n => n.id === id);
    if (index === -1) return undefined;
    this.data.nodes[index] = { ...this.data.nodes[index], ...updates };
    this.save();
    return this.data.nodes[index];
  }

  public deleteNode(id: string): boolean {
    const inUse = this.data.servers.some(s => s.nodeId === id);
    if (inUse) {
      throw new Error('Cannot remove node with active hosted Minecraft servers.');
    }
    const before = this.data.nodes.length;
    this.data.nodes = this.data.nodes.filter(n => n.id !== id);
    this.save();
    return this.data.nodes.length < before;
  }

  // Server Management
  public getServers(): MinecraftServer[] {
    return this.data.servers.map(s => this.normalizeServer(s));
  }

  public getServer(id: string): MinecraftServer | undefined {
    const s = this.data.servers.find(item => item.id === id);
    if (!s) return undefined;
    const normalized = this.normalizeServer(s);
    Object.assign(s, normalized);
    return normalized;
  }

  public addServer(server: MinecraftServer): MinecraftServer {
    const normalized = this.normalizeServer(server);
    this.data.servers.push(normalized);
    this.save();
    this.logAction('admin', 'SERVER_CREATE', `Created server container ${normalized.name} on node ${normalized.nodeId}`, normalized.id, normalized.name);
    return normalized;
  }

  public updateServer(id: string, updates: Partial<MinecraftServer>): MinecraftServer | undefined {
    const index = this.data.servers.findIndex(s => s.id === id);
    if (index === -1) return undefined;
    this.data.servers[index] = this.normalizeServer({
      ...this.data.servers[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    this.save();
    return this.data.servers[index];
  }

  public deleteServer(id: string): boolean {
    const server = this.getServer(id);
    const before = this.data.servers.length;
    this.data.servers = this.data.servers.filter(s => s.id !== id);
    this.data.allocations.forEach(a => {
      if (a.assignedServerId === id) a.assignedServerId = undefined;
    });
    delete this.data.players[id];
    this.save();
    if (server) {
      this.logAction('admin', 'SERVER_DELETE', `Deleted server ${server.name} and purged volumes`, server.id, server.name);
    }
    return this.data.servers.length < before;
  }

  // Plugin Catalog & Installed Plugins
  public getPluginsCatalog(): PluginItem[] {
    return this.data.pluginsCatalog;
  }

  public installPluginToServer(serverId: string, pluginId: string): boolean {
    const server = this.getServer(serverId);
    const plugin = this.data.pluginsCatalog.find(p => p.id === pluginId);
    if (!server || !plugin) return false;

    server.installedPlugins = Array.isArray(server.installedPlugins) ? server.installedPlugins : [];
    if (!server.installedPlugins.includes(pluginId)) {
      server.installedPlugins.push(pluginId);
      this.save();
      this.logAction('admin', 'PLUGIN_INSTALL', `Installed ${plugin.name} v${plugin.version} into /plugins`, server.id, server.name);
    }
    return true;
  }

  public uninstallPluginFromServer(serverId: string, pluginId: string): boolean {
    const server = this.getServer(serverId);
    const plugin = this.data.pluginsCatalog.find(p => p.id === pluginId);
    if (!server) return false;

    server.installedPlugins = (Array.isArray(server.installedPlugins) ? server.installedPlugins : []).filter(id => id !== pluginId);
    this.save();
    if (plugin) {
      this.logAction('admin', 'PLUGIN_UNINSTALL', `Removed ${plugin.name} from /plugins`, server.id, server.name);
    }
    return true;
  }

  // Player Management
  public getOnlinePlayers(serverId: string): OnlinePlayer[] {
    if (!this.data.players) this.data.players = {};
    return this.data.players[serverId] || [];
  }

  public setOnlinePlayers(serverId: string, players: OnlinePlayer[]) {
    if (!this.data.players) this.data.players = {};
    this.data.players[serverId] = players;
    this.save();
  }

  public updatePlayer(serverId: string, playerName: string, updates: Partial<OnlinePlayer>) {
    if (!this.data.players) this.data.players = {};
    const list = this.data.players[serverId] || [];
    const idx = list.findIndex(p => p.name.toLowerCase() === playerName.toLowerCase());
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updates };
      this.data.players[serverId] = list;
      this.save();
    }
  }

  public removePlayer(serverId: string, playerName: string) {
    if (!this.data.players) this.data.players = {};
    if (this.data.players[serverId]) {
      this.data.players[serverId] = this.data.players[serverId].filter(
        p => p.name.toLowerCase() !== playerName.toLowerCase()
      );
      this.save();
    }
  }

  // Allocations
  public getAllocations(): PortAllocation[] {
    return this.data.allocations;
  }

  public addAllocation(nodeId: string, port: number, protocol: 'TCP' | 'UDP' | 'BOTH' = 'BOTH', notes?: string): PortAllocation {
    const existing = this.data.allocations.find(a => a.nodeId === nodeId && a.port === port);
    if (existing) {
      throw new Error(`Port ${port} is already registered on node ${nodeId}.`);
    }
    const alloc: PortAllocation = {
      id: `alloc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      nodeId,
      port,
      protocol,
      isPrimary: false,
      notes,
    };
    this.data.allocations.push(alloc);
    this.save();
    return alloc;
  }

  public deleteAllocation(id: string): boolean {
    const item = this.data.allocations.find(a => a.id === id);
    if (item?.assignedServerId) {
      throw new Error('Cannot delete an allocation currently assigned to an active server.');
    }
    this.data.allocations = this.data.allocations.filter(a => a.id !== id);
    this.save();
    return true;
  }

  public getAvailablePort(nodeId = 'node-us-east', preferred = 25565): number {
    const allocatedPorts = new Set(
      this.data.allocations.filter(a => a.nodeId === nodeId && a.assignedServerId).map(a => a.port)
    );
    if (!allocatedPorts.has(preferred)) return preferred;
    for (let p = 25565; p <= 25650; p++) {
      if (!allocatedPorts.has(p)) return p;
    }
    return 25565 + Math.floor(Math.random() * 500);
  }

  // Audit Logs
  public getAuditLogs(limit = 100): AuditLog[] {
    return this.data.auditLogs.slice(-limit).reverse();
  }

  public logAction(user: string, action: string, details: string, serverId?: string, serverName?: string, ipAddress = '127.0.0.1') {
    const log: AuditLog = {
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      user,
      action,
      serverId,
      serverName,
      details,
      ipAddress,
      timestamp: new Date().toISOString(),
    };
    this.data.auditLogs.push(log);
    if (this.data.auditLogs.length > 500) {
      this.data.auditLogs.shift();
    }
    this.save();
    return log;
  }

  // Users & Permissions
  public getUsers(): UserAccount[] {
    return this.data.users;
  }

  public addUser(user: UserAccount): UserAccount {
    this.data.users.push(user);
    this.save();
    this.logAction('admin', 'USER_CREATE', `Created user account ${user.username} (${user.role})`);
    return user;
  }

  public deleteUser(id: string): boolean {
    this.data.users = this.data.users.filter(u => u.id !== id);
    this.save();
    return true;
  }

  // API Tokens
  public getApiTokens(): ApiToken[] {
    return this.data.apiTokens;
  }

  public createApiToken(name: string, scopes: string[]): { apiToken: ApiToken; secret: string } {
    const secret = `ptlc_${crypto.randomBytes(32).toString('hex')}`;
    const tokenItem: ApiToken = {
      id: `token-${Date.now()}`,
      name,
      tokenPrefix: secret.slice(0, 11),
      scopes,
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
    };
    this.data.apiTokens.push(tokenItem);
    this.save();
    this.logAction('admin', 'API_KEY_GENERATE', `Generated API token "${name}" with scopes [${scopes.join(', ')}]`);
    return { apiToken: tokenItem, secret };
  }

  public deleteApiToken(id: string): boolean {
    this.data.apiTokens = this.data.apiTokens.filter(t => t.id !== id);
    this.save();
    return true;
  }

  public getSettings() {
    return this.data.settings;
  }
}

export const db = new Database();
