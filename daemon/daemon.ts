import express, { Request, Response } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Configuration
const DAEMON_PORT = parseInt(process.env.DAEMON_PORT || '8080', 10);
const DAEMON_TOKEN = process.env.DAEMON_TOKEN || 'wings_secret_token_change_in_production';
const DATA_DIR = process.env.DATA_DIR || '/var/lib/minecraft-panel/servers';

const app = express();
app.use(express.json({ limit: '100mb' }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/console' });

// Bearer Token Authentication Middleware
function authMiddleware(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }
  const token = authHeader.split(' ')[1];
  if (token !== DAEMON_TOKEN) {
    return res.status(403).json({ error: 'Forbidden: Daemon token mismatch' });
  }
  next();
}

// System Health & Diagnostics
app.get('/health', (_req, res) => {
  res.json({
    status: 'ONLINE',
    version: '1.4.0',
    agent: 'ObsidianWings-NodeAgent',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/system', authMiddleware, (_req, res) => {
  const totalMem = Math.round(os.totalmem() / (1024 * 1024));
  const freeMem = Math.round(os.freemem() / (1024 * 1024));
  const cpus = os.cpus();

  let dockerAlive = false;
  let dockerVersion = 'Unavailable';
  try {
    if (fs.existsSync('/var/run/docker.sock')) {
      dockerVersion = execSync('docker --version', { encoding: 'utf-8' }).trim();
      dockerAlive = true;
    }
  } catch (err) {
    dockerAlive = false;
  }

  res.json({
    hostname: os.hostname(),
    os: `${os.type()} ${os.release()} (${os.arch()})`,
    cpuCores: cpus.length,
    cpuModel: cpus[0]?.model || 'Standard Virtual CPU',
    totalRamMb: totalMem,
    usedRamMb: totalMem - freeMem,
    freeRamMb: freeMem,
    docker: {
      available: dockerAlive,
      version: dockerVersion,
    },
    uptimeSeconds: Math.floor(os.uptime()),
  });
});

// Server Container Provisioning on this Node
app.post('/api/servers', authMiddleware, (req, res) => {
  const {
    id,
    type = 'PAPER',
    version = '1.21.1',
    memoryMb = 2048,
    cpuLimitPercent = 100,
    port = 25565,
    motd = 'Minecraft Server',
    maxPlayers = 20,
    jvmFlags = '',
  } = req.body;

  if (!id) return res.status(400).json({ error: 'Server ID required' });

  const serverDir = path.join(DATA_DIR, id);
  if (!fs.existsSync(serverDir)) {
    fs.mkdirSync(serverDir, { recursive: true });
  }

  // Create eula and properties
  fs.writeFileSync(path.join(serverDir, 'eula.txt'), 'eula=true\n', 'utf-8');
  const propsPath = path.join(serverDir, 'server.properties');
  if (!fs.existsSync(propsPath)) {
    fs.writeFileSync(propsPath, `server-port=${port}\nmotd=${motd}\nmax-players=${maxPlayers}\n`, 'utf-8');
  }

  const containerName = `mc-${id}`;

  try {
    if (fs.existsSync('/var/run/docker.sock')) {
      const cpusArg = cpuLimitPercent ? `--cpus="${(cpuLimitPercent / 100).toFixed(1)}"` : '';
      const runCmd = [
        'docker run -d',
        `--name ${containerName}`,
        `-i -t`,
        `--restart unless-stopped`,
        `-p ${port}:25565`,
        `-m ${memoryMb}M`,
        cpusArg,
        `-e EULA=TRUE`,
        `-e TYPE=${type}`,
        `-e VERSION=${version}`,
        `-e MEMORY=${memoryMb}M`,
        `-e MOTD="${motd.replace(/"/g, '\\"')}"`,
        `-e MAX_PLAYERS=${maxPlayers}`,
        `-e JVM_OPTS="${jvmFlags}"`,
        `-v "${serverDir}:/data"`,
        'itzg/minecraft-server:latest',
      ].filter(Boolean).join(' ');

      execSync(runCmd);
    }
    return res.status(201).json({ success: true, serverId: id, containerName });
  } catch (err: any) {
    return res.status(500).json({ error: `Docker provisioning failed: ${err.message}` });
  }
});

// Power Actions
app.post('/api/servers/:id/power', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { action } = req.body; // start, stop, restart, kill
  const containerName = `mc-${id}`;

  try {
    if (fs.existsSync('/var/run/docker.sock')) {
      switch (action) {
        case 'start':
          execSync(`docker start ${containerName}`);
          break;
        case 'stop':
          execSync(`docker stop -t 15 ${containerName}`);
          break;
        case 'restart':
          execSync(`docker restart -t 15 ${containerName}`);
          break;
        case 'kill':
          execSync(`docker kill ${containerName}`);
          break;
        default:
          return res.status(400).json({ error: 'Invalid action' });
      }
    }
    res.json({ success: true, action, serverId: id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Send Console Command
app.post('/api/servers/:id/command', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { command } = req.body;
  const containerName = `mc-${id}`;

  try {
    if (fs.existsSync('/var/run/docker.sock')) {
      execSync(`docker exec -i ${containerName} rcon-cli "${command.replace(/"/g, '\\"')}"`);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// WebSocket Console Stream
wss.on('connection', (ws: WebSocket, req) => {
  // Extract server ID from query e.g. /ws/console?serverId=xyz&token=abc
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const serverId = url.searchParams.get('serverId');
  const token = url.searchParams.get('token');

  if (token !== DAEMON_TOKEN) {
    ws.close(4001, 'Unauthorized daemon token');
    return;
  }

  if (!serverId) {
    ws.close(4000, 'Missing serverId parameter');
    return;
  }

  const containerName = `mc-${serverId}`;
  let proc: any = null;

  try {
    if (fs.existsSync('/var/run/docker.sock')) {
      proc = spawn('docker', ['logs', '-f', '--tail', '100', containerName]);

      proc.stdout.on('data', (data: Buffer) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'log', line: data.toString() }));
        }
      });

      proc.stderr.on('data', (data: Buffer) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'log', line: data.toString() }));
        }
      });
    }
  } catch (err) {
    // fallback
  }

  ws.on('message', (msg: string) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === 'command' && fs.existsSync('/var/run/docker.sock')) {
        execSync(`docker exec -i ${containerName} rcon-cli "${data.command.replace(/"/g, '\\"')}"`);
      }
    } catch (err) {
      // ignore
    }
  });

  ws.on('close', () => {
    if (proc) proc.kill();
  });
});

server.listen(DAEMON_PORT, '0.0.0.0', () => {
  console.log(`[Wings-Daemon] Node Agent daemon listening on port ${DAEMON_PORT}`);
  console.log(`[Wings-Daemon] Auth token active: ${DAEMON_TOKEN.slice(0, 8)}...`);
});
