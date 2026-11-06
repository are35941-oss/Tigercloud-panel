export type ServerType = 'PAPER' | 'PURPUR' | 'FABRIC' | 'VANILLA' | 'FORGE' | 'SPIGOT' | 'BUNGEECORD' | 'VELOCITY';

export type ServerStatus = 'RUNNING' | 'STOPPED' | 'STARTING' | 'STOPPING' | 'OFFLINE';

export type UserRole = 'SUPER_ADMIN' | 'SUB_USER' | 'VIEWER';

export interface NodeAgent {
  id: string;
  name: string;
  fqdn: string;
  port: number;
  token: string;
  isLocal: boolean;
  status: 'ONLINE' | 'OFFLINE' | 'DEGRADED';
  location: string;
  totalRamMb: number;
  allocatedRamMb: number;
  totalCpuCores: number;
  allocatedCpuPercent: number;
  totalDiskGb: number;
  allocatedDiskGb: number;
  pingMs: number;
  containersCount: number;
  dockerVersion: string;
  osInfo: string;
  lastHeartbeat: string;
}

export interface MinecraftServer {
  id: string;
  name: string;
  description: string;
  nodeId: string;
  type: ServerType;
  version: string;
  memoryMb: number;
  cpuLimitPercent: number;
  diskLimitGb: number;
  port: number;
  rconPort?: number;
  queryPort?: number;
  status: ServerStatus;
  dockerContainerId?: string;
  volumePath: string;
  motd: string;
  maxPlayers: number;
  jvmFlags?: string;
  autoRestart: boolean;
  installedPlugins: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PortAllocation {
  id: string;
  nodeId: string;
  port: number;
  protocol: 'TCP' | 'UDP' | 'BOTH';
  assignedServerId?: string;
  isPrimary: boolean;
  notes?: string;
}

export interface ServerStats {
  serverId: string;
  cpuPercent: number;
  memoryUsedMb: number;
  memoryLimitMb: number;
  memoryPercent: number;
  diskUsedMb: number;
  diskLimitMb: number;
  diskPercent: number;
  netRxKb: number;
  netTxKb: number;
  uptimeSeconds: number;
  onlinePlayers: number;
  maxPlayers: number;
  tps: number;
}

export interface ConsoleLogMessage {
  serverId: string;
  line: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'command' | 'system';
}

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  updatedAt: string;
  extension?: string;
}

export interface PluginItem {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  downloads: number;
  rating: number;
  category: 'ESSENTIALS' | 'PERMISSIONS' | 'PROTECTION' | 'PERFORMANCE' | 'WORLDS' | 'COSMETICS';
  source: 'Modrinth' | 'SpigotMC' | 'Hangar';
  fileName: string;
  fileSizeKb: number;
  isInstalled?: boolean;
}

export interface OnlinePlayer {
  uuid: string;
  name: string;
  pingMs: number;
  isOp: boolean;
  isWhitelisted: boolean;
  gamemode: 'survival' | 'creative' | 'adventure' | 'spectator';
  health: number;
  joinedAt: string;
  ipAddress: string;
}

export interface AuditLog {
  id: string;
  user: string;
  action: string;
  serverId?: string;
  serverName?: string;
  details: string;
  ipAddress: string;
  timestamp: string;
}

export interface UserAccount {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  serverPermissions: string[];
  createdAt: string;
  lastLoginAt?: string;
}

export interface ApiToken {
  id: string;
  name: string;
  tokenPrefix: string;
  token?: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt?: string;
}

export interface SystemStats {
  hostname: string;
  platform: string;
  arch: string;
  cpuModel: string;
  cpuCores: number;
  totalMemMb: number;
  usedMemMb: number;
  freeMemMb: number;
  memPercent: number;
  uptimeSeconds: number;
  docker: {
    available: boolean;
    mode: 'DOCKER_DAEMON' | 'VIRTUAL_SANDBOX';
  };
  nodesCount: number;
  activeServersCount: number;
  totalServersCount: number;
}

export interface SmpTemplate {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: 'ECONOMY' | 'LIFESTEAL' | 'PVP' | 'VANILLA_PLUS';
  recommendedEngine: ServerType;
  recommendedVersion: string;
  recommendedRamMb: number;
  badge: string;
  icon: string;
  features: string[];
  includedPlugins: string[];
  sampleMotdLine1: string;
  sampleMotdLine2: string;
  configsOverview: string[];
}

export interface ServerBranding {
  hasCustomIcon: boolean;
  iconDataUrl?: string;
  motdLine1: string;
  motdLine2: string;
  fullMotd: string;
}

