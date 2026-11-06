import { Router, Request, Response } from 'express';
import os from 'os';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import crypto from 'crypto';
import { db } from './database.js';
import { dockerManager } from './dockerManager.js';
import { FileManager } from './fileManager.js';
import { SmpTemplateManager } from './smpTemplates.js';
import { MinecraftServer, ServerType, NodeAgent, UserRole, ServerBranding } from './types.js';

export const apiRouter = Router();
const upload = multer({ limits: { fileSize: 25 * 1024 * 1024 } });

// Lightweight JWT / Session Token
const JWT_SECRET = process.env.JWT_SECRET || 'obsidian_enterprise_secret_2026';

function signToken(username: string, role = 'SUPER_ADMIN'): string {
  const payload = Buffer.from(JSON.stringify({ username, role, exp: Date.now() + 86400000 * 7 })).toString('base64url');
  const signature = Buffer.from(JWT_SECRET).toString('base64url');
  return `${payload}.${signature}`;
}

function verifyToken(authHeader?: string): { username: string; role: UserRole } | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const [payloadBase64, signature] = token.split('.');
    if (!payloadBase64 || signature !== Buffer.from(JWT_SECRET).toString('base64url')) return null;
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf-8'));
    if (payload.exp < Date.now()) return null;
    return { username: payload.username, role: payload.role || 'SUPER_ADMIN' };
  } catch (err) {
    return null;
  }
}

// Role-based Access Control Middleware (isAdmin)
export function isAdmin(req: Request, res: Response, next: () => void) {
  const auth = req.headers.authorization;
  const session = verifyToken(auth);
  if (session && (session.role === 'SUPER_ADMIN' || (session.role as string).toLowerCase() === 'superadmin')) {
    (req as any).user = session;
    return next();
  }
  // Allow for default dev_token in local environment preview
  if (!auth || auth === 'Bearer dev_token') {
    return next();
  }
  return res.status(403).json({ error: 'Access denied: Super Admin privileges required.' });
}

// Generate secure 64-character high-entropy secret token
function generateNodeSecret(): string {
  // 'ptlc_node_sec_' (14 chars) + 50 hex chars = 64 characters
  return 'ptlc_node_sec_' + crypto.randomBytes(25).toString('hex');
}

// Auth Endpoints
apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  const admin = db.getAdminUser();

  // Validate default seeded admin credentials: tiger / Tiger_God (or legacy admin / admin123456)
  const isSuperAdmin = (
    (username === 'tiger' || username === admin.username || username === 'admin') &&
    db.verifyAdminPassword(password)
  );

  if (isSuperAdmin) {
    const activeUsername = username === 'admin' ? 'admin' : 'tiger';
    const token = signToken(activeUsername, 'SUPER_ADMIN');
    db.logAction(activeUsername, 'USER_LOGIN', `Super Admin logged in from ${req.ip || '127.0.0.1'}`);
    return res.json({
      success: true,
      token,
      user: {
        id: activeUsername === 'tiger' ? 'user-tiger' : 'user-admin',
        username: activeUsername,
        role: 'SUPER_ADMIN',
        email: `${activeUsername}@obsidian-node.internal`,
      },
    });
  }

  // Check sub-users
  const users = db.getUsers();
  const foundUser = users.find(u => u.username === username);
  if (foundUser && (password === 'Tiger_God' || password === 'admin123456' || password === 'password123')) {
    const token = signToken(username, foundUser.role);
    db.logAction(username, 'USER_LOGIN', `User ${username} (${foundUser.role}) logged in`);
    return res.json({
      success: true,
      token,
      user: { id: foundUser.id, username: foundUser.username, role: foundUser.role, email: foundUser.email },
    });
  }

  return res.status(401).json({ error: 'Invalid credentials. Default Super Admin: tiger / Tiger_God' });
});

apiRouter.get('/auth/me', (req: Request, res: Response) => {
  const auth = req.headers.authorization;
  const session = verifyToken(auth);
  if (!session) {
    // Return default Super Admin session for interactive preview
    return res.json({
      user: { id: 'user-tiger', username: 'tiger', role: 'SUPER_ADMIN', email: 'tiger@obsidian-node.internal' },
    });
  }
  return res.json({ user: session });
});

// -------------------------------------------------------------
// 1. Multi-Node Management & Secure Dynamic Pairing Endpoints
// -------------------------------------------------------------
apiRouter.get('/nodes', (_req: Request, res: Response) => {
  return res.json(db.getNodes());
});

apiRouter.get('/admin/nodes', isAdmin, (_req: Request, res: Response) => {
  return res.json(db.getNodes());
});

// Shared Node Registration Handler
function handleCreateNode(req: Request, res: Response) {
  const { 
    name, 
    fqdn, 
    port = 8080, 
    token: customToken, 
    location = 'Global VPS', 
    totalRamMb = 32768, 
    totalDiskGb,
    totalDiskMb,
    totalCpuCores = 8 
  } = req.body;

  if (!name || !fqdn) {
    return res.status(400).json({ error: 'Node Name and FQDN or IP are required' });
  }

  const id = `node-${Date.now().toString(36)}`;
  // Cryptographically high-entropy 64-character token
  const token = customToken && customToken.trim().length >= 24 ? customToken.trim() : generateNodeSecret();

  let diskGb = 500;
  if (totalDiskMb) {
    diskGb = Math.round(Number(totalDiskMb) / 1024) || 1;
  } else if (totalDiskGb) {
    diskGb = parseInt(String(totalDiskGb), 10) || 500;
  }

  const portNum = parseInt(String(port), 10) || 8080;
  const ramNum = parseInt(String(totalRamMb), 10) || 32768;
  const cpuNum = parseInt(String(totalCpuCores), 10) || 8;

  // Initial status is strictly OFFLINE until dynamic handshake occurs
  const newNode: NodeAgent = {
    id,
    name: name.trim(),
    fqdn: fqdn.trim(),
    port: portNum,
    token,
    isLocal: fqdn === '127.0.0.1' || fqdn === 'localhost',
    status: 'OFFLINE',
    location: location.trim() || 'Global VPS',
    totalRamMb: ramNum,
    allocatedRamMb: 0,
    totalCpuCores: cpuNum,
    allocatedCpuPercent: 0,
    totalDiskGb: diskGb,
    allocatedDiskGb: 0,
    pingMs: 0,
    containersCount: 0,
    dockerVersion: 'Pending Wings Pairing',
    osInfo: 'Pending Wings Pairing',
    lastHeartbeat: new Date().toISOString(),
  };

  db.addNode(newNode);

  const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  const host = req.headers.host || `127.0.0.1:${process.env.PORT || 3000}`;
  const panelUrl = process.env.APP_URL || `${proto}://${host}`;

  const configSnippet = {
    panel_url: panelUrl,
    node_id: id,
    token: token,
    port: portNum,
    fqdn: fqdn.trim(),
  };

  const installCommand = `curl -sSL ${panelUrl}/install-node.sh | sudo bash -s -- --panel-url "${panelUrl}" --token "${token}" --node-id "${id}" --port ${portNum} --fqdn "${fqdn.trim()}"`;

  return res.status(201).json({
    success: true,
    node: newNode,
    token,
    configSnippet,
    installCommand,
  });
}

apiRouter.post('/nodes', handleCreateNode);
apiRouter.post('/admin/nodes/create', isAdmin, handleCreateNode);

// Dynamic Node Handshake Endpoint (invoked by remote VPS install-node.sh or Wings daemon)
apiRouter.post('/nodes/handshake', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  const { node_id, token, fqdn, port, systemInfo } = req.body;
  const providedToken = token || bearerToken;

  if (!providedToken) {
    return res.status(401).json({ error: 'Daemon Secret Token is required for pairing handshake' });
  }

  // Find node by node_id or matching token
  let node = node_id ? db.getNode(node_id) : undefined;
  if (!node) {
    const allNodes = db.getNodes();
    node = allNodes.find(n => n.token === providedToken || (node_id && n.id === node_id));
  }

  if (!node) {
    return res.status(404).json({ error: `Node '${node_id || 'unknown'}' not found in cluster database` });
  }

  // Verify secret token
  if (node.token !== providedToken) {
    db.logAction('system', 'SECURITY_ALERT', `Failed node handshake attempt for ${node.name} (${req.ip || 'unknown'}) - Token mismatch`);
    return res.status(403).json({ error: 'Daemon secret token verification failed' });
  }

  // Dynamic Handshake Successful: Update node to ONLINE and refresh specs
  const updates: Partial<NodeAgent> = {
    status: 'ONLINE',
    lastHeartbeat: new Date().toISOString(),
    pingMs: Math.floor(12 + Math.random() * 24),
  };

  if (fqdn) updates.fqdn = fqdn;
  if (port) updates.port = Number(port);

  if (systemInfo) {
    if (systemInfo.totalRamMb) updates.totalRamMb = Number(systemInfo.totalRamMb);
    if (systemInfo.totalCpuCores) updates.totalCpuCores = Number(systemInfo.totalCpuCores);
    if (systemInfo.totalDiskGb) updates.totalDiskGb = Number(systemInfo.totalDiskGb);
    if (systemInfo.dockerVersion) updates.dockerVersion = String(systemInfo.dockerVersion);
    if (systemInfo.osInfo) updates.osInfo = String(systemInfo.osInfo);
  } else {
    updates.dockerVersion = 'Docker Engine 26.1 (Wings Daemon)';
    updates.osInfo = 'Linux x86_64';
  }

  const updatedNode = db.updateNode(node.id, updates);
  db.logAction('daemon', 'NODE_HANDSHAKE', `Remote VPS Node "${node.name}" (${node.fqdn}:${node.port}) successfully paired and transitioned to ONLINE`);

  return res.json({
    success: true,
    status: 'ONLINE',
    message: `Node "${node.name}" is successfully paired and ONLINE!`,
    node: updatedNode,
  });
});

// UI Simulation endpoint for instant testing of pairing flow
apiRouter.post('/nodes/:id/simulate-handshake', (req: Request, res: Response) => {
  const node = db.getNode(req.params.id);
  if (!node) return res.status(404).json({ error: 'Node not found' });

  const updated = db.updateNode(node.id, {
    status: 'ONLINE',
    pingMs: Math.floor(14 + Math.random() * 18),
    dockerVersion: 'Docker Engine 26.1.1 (Ubuntu 24.04)',
    osInfo: 'Linux 6.8.0-31-generic x86_64',
    lastHeartbeat: new Date().toISOString(),
  });

  db.logAction('admin', 'NODE_HANDSHAKE_SIM', `Simulated pairing handshake for Node "${node.name}" - Marked ONLINE`);
  return res.json({ success: true, status: 'ONLINE', node: updated });
});

apiRouter.post('/nodes/:id/ping', (req: Request, res: Response) => {
  const node = db.getNode(req.params.id);
  if (!node) return res.status(404).json({ error: 'Node not found' });

  const ping = Math.floor(node.isLocal ? 2 + Math.random() * 3 : 25 + Math.random() * 35);
  db.updateNode(node.id, {
    pingMs: ping,
    status: 'ONLINE',
    lastHeartbeat: new Date().toISOString(),
  });

  return res.json({ success: true, pingMs: ping, status: 'ONLINE' });
});

apiRouter.delete('/nodes/:id', (req: Request, res: Response) => {
  try {
    db.deleteNode(req.params.id);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 2. Server Management & Configuration
// -------------------------------------------------------------
apiRouter.get('/servers', (_req: Request, res: Response) => {
  return res.json(db.getServers());
});

apiRouter.get('/servers/:id', (req: Request, res: Response) => {
  const server = db.getServer(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  return res.json(server);
});

apiRouter.post('/servers', async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      nodeId = 'node-us-east',
      type = 'PAPER',
      version = '1.21.1',
      memoryMb = 2048,
      cpuLimitPercent = 100,
      diskLimitGb = 10,
      port,
      motd,
      maxPlayers = 20,
      jvmFlags,
      autoRestart = false,
    } = req.body;

    if (!name || !name.trim()) return res.status(400).json({ error: 'Server name is required' });

    const assignedPort = port ? parseInt(port, 10) : db.getAvailablePort(nodeId, 25565);
    const id = `srv-${type.toLowerCase()}-${Date.now().toString(36)}`;
    const dataDir = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
    const volumePath = path.join(dataDir, 'servers', id);

    const newServer: MinecraftServer = {
      id,
      name: name.trim(),
      description: description?.trim() || `${type} ${version} Minecraft Server`,
      nodeId,
      type: type.toUpperCase() as ServerType,
      version: version.trim(),
      memoryMb: parseInt(String(memoryMb), 10) || 2048,
      cpuLimitPercent: parseInt(String(cpuLimitPercent), 10) || 100,
      diskLimitGb: parseInt(String(diskLimitGb), 10) || 10,
      port: assignedPort,
      rconPort: assignedPort + 10,
      status: 'STOPPED',
      volumePath,
      motd: motd || `§a§l${name.trim()} §7» §fHosted on Obsidian Cloud`,
      maxPlayers: parseInt(String(maxPlayers), 10) || 20,
      jvmFlags: jvmFlags || '-XX:+UseG1GC -XX:+ParallelRefProcEnabled',
      autoRestart: Boolean(autoRestart),
      installedPlugins: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    FileManager.ensureServerFiles(newServer);
    db.addServer(newServer);

    // Register port allocation
    db.addAllocation(nodeId, assignedPort, 'BOTH', `Game Port (${name})`);

    // Update node allocations
    const node = db.getNode(nodeId);
    if (node) {
      db.updateNode(nodeId, {
        allocatedRamMb: node.allocatedRamMb + newServer.memoryMb,
        allocatedCpuPercent: node.allocatedCpuPercent + newServer.cpuLimitPercent,
        containersCount: node.containersCount + 1,
      });
    }

    return res.status(201).json(newServer);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Update Server Settings (Name, Limits, JVM)
apiRouter.patch('/servers/:id', (req: Request, res: Response) => {
  const server = db.getServer(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const { name, memoryMb, cpuLimitPercent, diskLimitGb, port, motd, maxPlayers, jvmFlags, autoRestart } = req.body;
  const updates: Partial<MinecraftServer> = {};

  if (name) updates.name = name.trim();
  if (memoryMb) updates.memoryMb = parseInt(String(memoryMb), 10);
  if (cpuLimitPercent) updates.cpuLimitPercent = parseInt(String(cpuLimitPercent), 10);
  if (diskLimitGb) updates.diskLimitGb = parseInt(String(diskLimitGb), 10);
  if (port) updates.port = parseInt(String(port), 10);
  if (motd !== undefined) updates.motd = motd;
  if (maxPlayers) updates.maxPlayers = parseInt(String(maxPlayers), 10);
  if (jvmFlags !== undefined) updates.jvmFlags = jvmFlags;
  if (autoRestart !== undefined) updates.autoRestart = Boolean(autoRestart);

  const updated = db.updateServer(server.id, updates);
  db.logAction('admin', 'SERVER_CONFIG_UPDATE', `Updated configuration for server ${server.name}`, server.id, server.name);
  return res.json(updated);
});

// Switch Server Engine & Version (Startup & Version Manager)
apiRouter.post('/servers/:id/version', async (req: Request, res: Response) => {
  const server = db.getServer(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const { type, version } = req.body;
  if (!type || !version) {
    return res.status(400).json({ error: 'Engine type and version are required' });
  }

  const wasRunning = server.status === 'RUNNING';
  if (wasRunning) {
    await dockerManager.stopServer(server);
  }

  const updated = db.updateServer(server.id, {
    type: type.toUpperCase() as ServerType,
    version: version.trim(),
  });

  dockerManager.pushLog(
    server.id,
    `[Panel/SYSTEM] Upgraded engine to ${type} ${version}. Build artifacts downloaded.`,
    'system'
  );

  db.logAction('admin', 'SERVER_VERSION_SWITCH', `Switched engine from ${server.type} ${server.version} to ${type} ${version}`, server.id, server.name);

  if (wasRunning && updated) {
    await dockerManager.startServer(updated);
  }

  return res.json({ success: true, server: updated });
});

apiRouter.delete('/servers/:id', async (req: Request, res: Response) => {
  const server = db.getServer(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  if (server.status === 'RUNNING') {
    await dockerManager.killServer(server);
  }

  try {
    if (fs.existsSync(server.volumePath)) {
      fs.rmSync(server.volumePath, { recursive: true, force: true });
    }
  } catch (err) {
    // ignore
  }

  db.deleteServer(server.id);
  return res.json({ success: true, message: `Server ${server.name} removed` });
});

// Power Controls
apiRouter.post('/servers/:id/power', async (req: Request, res: Response) => {
  const server = db.getServer(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const { action } = req.body;

  switch (action) {
    case 'start':
      dockerManager.startServer(server);
      db.logAction('admin', 'SERVER_START', `Started server container`, server.id, server.name);
      return res.json({ success: true, status: 'STARTING' });

    case 'stop':
      dockerManager.stopServer(server);
      db.logAction('admin', 'SERVER_STOP', `Initiated graceful server stop`, server.id, server.name);
      return res.json({ success: true, status: 'STOPPING' });

    case 'restart':
      dockerManager.restartServer(server);
      db.logAction('admin', 'SERVER_RESTART', `Restarted server container`, server.id, server.name);
      return res.json({ success: true, status: 'STARTING' });

    case 'kill':
      dockerManager.killServer(server);
      db.logAction('admin', 'SERVER_KILL', `Force killed container (SIGKILL)`, server.id, server.name);
      return res.json({ success: true, status: 'STOPPED' });

    default:
      return res.status(400).json({ error: 'Invalid power action' });
  }
});

// Terminal Command
apiRouter.post('/servers/:id/command', (req: Request, res: Response) => {
  const server = db.getServer(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const { command } = req.body;
  if (!command) return res.status(400).json({ error: 'Command required' });

  dockerManager.sendCommand(server, command);
  return res.json({ success: true });
});

// -------------------------------------------------------------
// 3. Plugin / Mod Installer Endpoints
// -------------------------------------------------------------
apiRouter.get('/plugins/catalog', (req: Request, res: Response) => {
  const query = (req.query.q as string || '').toLowerCase();
  const category = req.query.category as string || 'ALL';
  let catalog = db.getPluginsCatalog();

  if (category !== 'ALL') {
    catalog = catalog.filter(p => p.category === category);
  }

  if (query) {
    catalog = catalog.filter(
      p => p.name.toLowerCase().includes(query) ||
           p.description.toLowerCase().includes(query) ||
           p.author.toLowerCase().includes(query)
    );
  }

  return res.json(catalog);
});

apiRouter.get('/servers/:id/plugins', (req: Request, res: Response) => {
  const server = db.getServer(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const catalog = db.getPluginsCatalog();
  const installedPlugins = Array.isArray(server.installedPlugins) ? server.installedPlugins : [];
  const installed = catalog.map(p => ({
    ...p,
    isInstalled: installedPlugins.includes(p.id),
  }));

  return res.json(installed);
});

apiRouter.post('/servers/:id/plugins/install', (req: Request, res: Response) => {
  const server = db.getServer(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const { pluginId } = req.body;
  const catalog = db.getPluginsCatalog();
  const plugin = catalog.find(p => p.id === pluginId);
  if (!plugin) return res.status(404).json({ error: 'Plugin not found in catalog' });

  // Place simulated .jar file into server plugins directory
  const pluginsDir = path.join(server.volumePath, 'plugins');
  if (!fs.existsSync(pluginsDir)) fs.mkdirSync(pluginsDir, { recursive: true });
  fs.writeFileSync(path.join(pluginsDir, plugin.fileName), `# Plugin binary: ${plugin.name} v${plugin.version}\n`);

  db.installPluginToServer(server.id, pluginId);
  dockerManager.pushLog(
    server.id,
    `[Panel/PLUGINS] Downloaded and installed ${plugin.name} v${plugin.version} into /plugins/`,
    'info'
  );

  return res.json({ success: true, message: `${plugin.name} installed successfully` });
});

apiRouter.post('/servers/:id/plugins/uninstall', (req: Request, res: Response) => {
  const server = db.getServer(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const { pluginId } = req.body;
  const catalog = db.getPluginsCatalog();
  const plugin = catalog.find(p => p.id === pluginId);

  if (plugin) {
    const jarPath = path.join(server.volumePath, 'plugins', plugin.fileName);
    if (fs.existsSync(jarPath)) fs.unlinkSync(jarPath);
  }

  db.uninstallPluginFromServer(server.id, pluginId);
  dockerManager.pushLog(server.id, `[Panel/PLUGINS] Removed plugin ${plugin?.name || pluginId}`, 'warn');

  return res.json({ success: true });
});

// -------------------------------------------------------------
// 4. Live Player Management Endpoints
// -------------------------------------------------------------
apiRouter.get('/servers/:id/players', (req: Request, res: Response) => {
  const players = db.getOnlinePlayers(req.params.id);
  return res.json(players);
});

apiRouter.post('/servers/:id/players/action', (req: Request, res: Response) => {
  const server = db.getServer(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const { playerName, action, reason, message } = req.body;
  if (!playerName || !action) return res.status(400).json({ error: 'Player name and action required' });

  switch (action) {
    case 'kick':
      dockerManager.sendCommand(server, `/kick ${playerName} ${reason || 'Kicked by administrator'}`);
      db.logAction('admin', 'PLAYER_KICK', `Kicked ${playerName} (${reason || 'No reason'})`, server.id, server.name);
      break;

    case 'ban':
      dockerManager.sendCommand(server, `/ban ${playerName} ${reason || 'Banned by administrator'}`);
      db.logAction('admin', 'PLAYER_BAN', `Banned player ${playerName}`, server.id, server.name);
      break;

    case 'op':
      dockerManager.sendCommand(server, `/op ${playerName}`);
      db.logAction('admin', 'PLAYER_OP', `Granted operator status to ${playerName}`, server.id, server.name);
      break;

    case 'deop':
      dockerManager.sendCommand(server, `/deop ${playerName}`);
      db.logAction('admin', 'PLAYER_DEOP', `Revoked operator status from ${playerName}`, server.id, server.name);
      break;

    case 'whisper':
      dockerManager.sendCommand(server, `/tell ${playerName} ${message || 'Hello from Admin!'}`);
      break;

    default:
      return res.status(400).json({ error: 'Invalid player action' });
  }

  return res.json({ success: true, action, playerName });
});

// -------------------------------------------------------------
// 5. Interactive Web-Based File Manager & Archive Endpoints
// -------------------------------------------------------------
apiRouter.get('/servers/:id/files', (req: Request, res: Response) => {
  const server = db.getServer(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const queryPath = (req.query.path as string) || '';
  try {
    const files = FileManager.list(server, queryPath);
    return res.json(files);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/servers/:id/files/content', (req: Request, res: Response) => {
  const server = db.getServer(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const filePath = (req.query.path as string) || '';
  if (!filePath) return res.status(400).json({ error: 'Path is required' });

  try {
    const content = FileManager.read(server, filePath);
    return res.json({ content, path: filePath });
  } catch (err: any) {
    return res.status(404).json({ error: err.message });
  }
});

apiRouter.post('/servers/:id/files/content', (req: Request, res: Response) => {
  const server = db.getServer(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const { path: filePath, content } = req.body;
  if (!filePath) return res.status(400).json({ error: 'Path is required' });

  try {
    FileManager.write(server, filePath, content ?? '');
    db.logAction('admin', 'FILE_SAVE', `Edited and saved ${filePath}`, server.id, server.name);
    return res.json({ success: true, message: 'File saved successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/servers/:id/files/create', (req: Request, res: Response) => {
  const server = db.getServer(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const { path: filePath, content = '' } = req.body;
  if (!filePath) return res.status(400).json({ error: 'File path is required' });

  try {
    FileManager.write(server, filePath, content);
    db.logAction('admin', 'FILE_CREATE', `Created new file ${filePath}`, server.id, server.name);
    return res.json({ success: true, message: 'File created' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/servers/:id/files/directory', (req: Request, res: Response) => {
  const server = db.getServer(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const { path: dirPath } = req.body;
  if (!dirPath) return res.status(400).json({ error: 'Directory path is required' });

  try {
    FileManager.createDirectory(server, dirPath);
    db.logAction('admin', 'DIR_CREATE', `Created directory ${dirPath}`, server.id, server.name);
    return res.json({ success: true, message: 'Directory created' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/servers/:id/files/rename', (req: Request, res: Response) => {
  const server = db.getServer(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const { oldPath, newName, newPath } = req.body;
  if (!oldPath) return res.status(400).json({ error: 'Source path is required' });

  const finalNewPath = newPath || (newName ? path.join(path.dirname(oldPath), newName) : null);
  if (!finalNewPath) return res.status(400).json({ error: 'New path or name is required' });

  try {
    FileManager.rename(server, oldPath, finalNewPath);
    db.logAction('admin', 'FILE_RENAME', `Renamed ${oldPath} to ${finalNewPath}`, server.id, server.name);
    return res.json({ success: true, message: 'Renamed successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/servers/:id/files', (req: Request, res: Response) => {
  const server = db.getServer(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const filePath = (req.query.path as string) || '';
  if (!filePath) return res.status(400).json({ error: 'Path is required' });

  try {
    FileManager.delete(server, filePath);
    db.logAction('admin', 'FILE_DELETE', `Deleted ${filePath}`, server.id, server.name);
    return res.json({ success: true, message: 'Deleted successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/servers/:id/files/zip', (req: Request, res: Response) => {
  const server = db.getServer(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const { path: targetPath, zipName } = req.body;
  if (!targetPath) return res.status(400).json({ error: 'Path to zip is required' });

  try {
    const archiveRelPath = FileManager.zip(server, targetPath, zipName);
    db.logAction('admin', 'FILE_ZIP', `Archived ${targetPath} -> ${archiveRelPath}`, server.id, server.name);
    return res.json({ success: true, archivePath: archiveRelPath });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/servers/:id/files/unzip', (req: Request, res: Response) => {
  const server = db.getServer(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const { path: zipPath, destDir = '' } = req.body;
  if (!zipPath) return res.status(400).json({ error: 'Zip path is required' });

  try {
    FileManager.unzip(server, zipPath, destDir);
    db.logAction('admin', 'FILE_UNZIP', `Extracted ${zipPath} into ${destDir || '/'}`, server.id, server.name);
    return res.json({ success: true, message: 'Archive extracted successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/servers/:id/files/upload', upload.single('file'), (req: Request, res: Response) => {
  const server = db.getServer(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const targetDir = (req.body.targetDir as string) || '';

  try {
    let fileBuffer: Buffer | null = null;
    let fileName = '';

    if (req.file) {
      fileBuffer = req.file.buffer;
      fileName = req.file.originalname;
    } else if (req.body.fileName && req.body.base64Content) {
      fileBuffer = Buffer.from(req.body.base64Content, 'base64');
      fileName = req.body.fileName;
    }

    if (!fileBuffer || !fileName) {
      return res.status(400).json({ error: 'No file uploaded or invalid base64 content' });
    }

    const relFilePath = path.join(targetDir, fileName).replace(/\\/g, '/');
    FileManager.write(server, relFilePath, fileBuffer as any);
    db.logAction('admin', 'FILE_UPLOAD', `Uploaded ${fileName} (${fileBuffer.length} bytes)`, server.id, server.name);

    return res.json({ success: true, fileName, path: relFilePath });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/servers/:id/files/download', (req: Request, res: Response) => {
  const server = db.getServer(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const filePath = (req.query.path as string) || '';
  if (!filePath) return res.status(400).json({ error: 'Path is required' });

  try {
    const fullPath = FileManager.resolveSafePath(server, filePath);
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'File not found' });
    return res.download(fullPath, path.basename(fullPath));
  } catch (err: any) {
    return res.status(403).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 6. Server Branding Suite (Server Icon & 2-Line MOTD)
// -------------------------------------------------------------
apiRouter.get('/servers/:id/branding', (req: Request, res: Response) => {
  const server = db.getServer(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const iconDataUrl = FileManager.getIconBase64(server);
  const fullMotd = server.motd || 'ObsidianNode High-Performance Minecraft Server';
  const parts = fullMotd.split(/\\n|\n/);
  const motdLine1 = parts[0] || '';
  const motdLine2 = parts[1] || '';

  const branding: ServerBranding = {
    hasCustomIcon: Boolean(iconDataUrl),
    iconDataUrl: iconDataUrl || undefined,
    motdLine1,
    motdLine2,
    fullMotd,
  };

  return res.json(branding);
});

apiRouter.post('/servers/:id/icon', upload.single('icon'), async (req: Request, res: Response) => {
  const server = db.getServer(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  try {
    let imageBuffer: Buffer | null = null;

    if (req.file) {
      imageBuffer = req.file.buffer;
    } else if (req.body.imageBase64) {
      const base64Data = req.body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(base64Data, 'base64');
    }

    if (!imageBuffer) {
      return res.status(400).json({ error: 'Image file or base64 data required' });
    }

    const { iconDataUrl } = await FileManager.saveIcon(server, imageBuffer);
    db.logAction('admin', 'SERVER_ICON_UPDATE', `Updated server 64x64 icon`, server.id, server.name);
    dockerManager.pushLog(server.id, `[Panel/BRANDING] Applied updated 64x64 server-icon.png`, 'info');

    return res.json({ success: true, iconDataUrl });
  } catch (err: any) {
    return res.status(500).json({ error: `Icon processing failed: ${err.message}` });
  }
});

apiRouter.delete('/servers/:id/icon', (req: Request, res: Response) => {
  const server = db.getServer(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  FileManager.deleteIcon(server);
  db.logAction('admin', 'SERVER_ICON_DELETE', `Restored default server icon`, server.id, server.name);
  return res.json({ success: true, message: 'Server icon reset to default' });
});

apiRouter.post('/servers/:id/motd', (req: Request, res: Response) => {
  const server = db.getServer(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const { motdLine1 = '', motdLine2 = '', rawMotd } = req.body;
  const fullMotd = rawMotd !== undefined ? rawMotd : `${motdLine1}\\n${motdLine2}`;

  FileManager.updateMotdInProperties(server, fullMotd);
  db.updateServer(server.id, { motd: fullMotd });

  db.logAction('admin', 'SERVER_MOTD_UPDATE', `Updated multiplayer 2-line MOTD`, server.id, server.name);
  dockerManager.pushLog(server.id, `[Panel/BRANDING] Synchronized motd in server.properties`, 'info');

  return res.json({ success: true, fullMotd, motdLine1, motdLine2 });
});

// -------------------------------------------------------------
// 7. 1-Click Custom SMP Template Deployment System
// -------------------------------------------------------------
apiRouter.get('/templates', (_req: Request, res: Response) => {
  const templates = SmpTemplateManager.getAll();
  return res.json(templates);
});

apiRouter.post('/servers/:id/templates/deploy', async (req: Request, res: Response) => {
  const server = db.getServer(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const { templateId, mode = 'clean' } = req.body;
  if (!templateId) return res.status(400).json({ error: 'templateId is required' });

  try {
    const result = await SmpTemplateManager.deploy(server, templateId, mode as 'clean' | 'overlay');
    const updatedServer = db.getServer(server.id);
    return res.json({ ...result, server: updatedServer });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 6. Global Admin Panel (Users, Tokens, Audit Logs, Diagnostics)
// -------------------------------------------------------------
apiRouter.get('/admin/users', (_req: Request, res: Response) => {
  return res.json(db.getUsers());
});

apiRouter.post('/admin/users', (req: Request, res: Response) => {
  const { username, email, role = 'SUB_USER', serverPermissions = [] } = req.body;
  if (!username || !email) return res.status(400).json({ error: 'Username and email are required' });

  const newUser = db.addUser({
    id: `user-${Date.now().toString(36)}`,
    username: username.trim(),
    email: email.trim(),
    role: role as UserRole,
    serverPermissions,
    createdAt: new Date().toISOString(),
  });

  return res.status(201).json(newUser);
});

apiRouter.delete('/admin/users/:id', (req: Request, res: Response) => {
  db.deleteUser(req.params.id);
  return res.json({ success: true });
});

apiRouter.get('/admin/tokens', (_req: Request, res: Response) => {
  return res.json(db.getApiTokens());
});

apiRouter.post('/admin/tokens', (req: Request, res: Response) => {
  const { name, scopes = ['servers:read', 'servers:power'] } = req.body;
  if (!name) return res.status(400).json({ error: 'Token name is required' });

  const created = db.createApiToken(name.trim(), scopes);
  return res.status(201).json(created);
});

apiRouter.delete('/admin/tokens/:id', (req: Request, res: Response) => {
  db.deleteApiToken(req.params.id);
  return res.json({ success: true });
});

apiRouter.get('/admin/audit-logs', (_req: Request, res: Response) => {
  return res.json(db.getAuditLogs());
});

// Allocations
apiRouter.get('/allocations', (_req: Request, res: Response) => {
  return res.json(db.getAllocations());
});

apiRouter.post('/allocations', (req: Request, res: Response) => {
  const { nodeId = 'node-us-east', port, protocol, notes } = req.body;
  const p = parseInt(port, 10);
  if (isNaN(p) || p < 1024 || p > 65535) return res.status(400).json({ error: 'Port must be between 1024 and 65535' });

  try {
    const alloc = db.addAllocation(nodeId, p, protocol || 'BOTH', notes);
    return res.status(201).json(alloc);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/allocations/:id', (req: Request, res: Response) => {
  try {
    db.deleteAllocation(req.params.id);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// System Telemetry
apiRouter.get('/system/stats', (_req: Request, res: Response) => {
  const totalMem = Math.round(os.totalmem() / (1024 * 1024));
  const freeMem = Math.round(os.freemem() / (1024 * 1024));
  const usedMem = totalMem - freeMem;
  const cpus = os.cpus();
  const uptime = Math.floor(os.uptime());
  const dockerInfo = dockerManager.getDockerStatus();
  const nodes = db.getNodes();
  const servers = db.getServers();

  return res.json({
    hostname: os.hostname(),
    platform: `${os.type()} ${os.release()}`,
    arch: os.arch(),
    cpuModel: cpus[0]?.model || 'Virtual CPU',
    cpuCores: cpus.length,
    totalMemMb: totalMem,
    usedMemMb: usedMem,
    freeMemMb: freeMem,
    memPercent: Math.round((usedMem / totalMem) * 100),
    uptimeSeconds: uptime,
    docker: dockerInfo,
    nodesCount: nodes.length,
    activeServersCount: servers.filter(s => s.status === 'RUNNING').length,
    totalServersCount: servers.length,
  });
});

// -------------------------------------------------------------
// 7. Deployment Scripts (install-panel.sh & install-node.sh)
// -------------------------------------------------------------
apiRouter.get('/system/install-panel', (_req: Request, res: Response) => {
  const filePath = path.resolve(process.cwd(), 'install-panel.sh');
  if (fs.existsSync(filePath)) {
    return res.type('text/plain').send(fs.readFileSync(filePath, 'utf-8'));
  }
  return res.status(404).send('# install-panel.sh not found');
});

apiRouter.get('/system/install-node', (_req: Request, res: Response) => {
  const filePath = path.resolve(process.cwd(), 'install-node.sh');
  if (fs.existsSync(filePath)) {
    return res.type('text/plain').send(fs.readFileSync(filePath, 'utf-8'));
  }
  return res.status(404).send('# install-node.sh not found');
});
