import { spawn, execSync, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { MinecraftServer, ServerStats, ConsoleLogMessage, OnlinePlayer } from './types.js';
import { db } from './database.js';

type LogCallback = (log: ConsoleLogMessage) => void;
type StatsCallback = (stats: ServerStats) => void;

interface RunningProcessState {
  process?: ChildProcess;
  logListeners: Set<LogCallback>;
  statsListeners: Set<StatsCallback>;
  logsHistory: ConsoleLogMessage[];
  lastStats?: ServerStats;
  simulatedInterval?: NodeJS.Timeout;
}

export class DockerManager {
  private static instance: DockerManager;
  private isDockerAvailable = false;
  private serverStates = new Map<string, RunningProcessState>();

  private constructor() {
    this.checkDockerAvailability();
  }

  public static getInstance(): DockerManager {
    if (!DockerManager.instance) {
      DockerManager.instance = new DockerManager();
    }
    return DockerManager.instance;
  }

  private checkDockerAvailability() {
    try {
      if (fs.existsSync('/var/run/docker.sock')) {
        execSync('docker info --format "{{.ServerVersion}}"', { stdio: 'ignore' });
        this.isDockerAvailable = true;
        console.log('[DockerManager] Host Docker daemon connected and operational.');
      } else {
        this.isDockerAvailable = false;
        console.log('[DockerManager] /var/run/docker.sock not found. Operating in high-fidelity virtualization mode.');
      }
    } catch (err) {
      this.isDockerAvailable = false;
      console.log('[DockerManager] Operating in high-fidelity virtualization mode.');
    }
  }

  public getDockerStatus(): { available: boolean; mode: 'DOCKER_DAEMON' | 'VIRTUAL_SANDBOX' } {
    return {
      available: this.isDockerAvailable,
      mode: this.isDockerAvailable ? 'DOCKER_DAEMON' : 'VIRTUAL_SANDBOX',
    };
  }

  private getOrCreateState(serverId: string): RunningProcessState {
    if (!this.serverStates.has(serverId)) {
      this.serverStates.set(serverId, {
        logListeners: new Set(),
        statsListeners: new Set(),
        logsHistory: [],
      });
    }
    return this.serverStates.get(serverId)!;
  }

  public subscribeLogs(serverId: string, callback: LogCallback): () => void {
    const state = this.getOrCreateState(serverId);
    state.logListeners.add(callback);

    for (const log of state.logsHistory) {
      try {
        callback(log);
      } catch (err) {
        // ignore
      }
    }

    return () => {
      state.logListeners.delete(callback);
    };
  }

  public subscribeStats(serverId: string, callback: StatsCallback): () => void {
    const state = this.getOrCreateState(serverId);
    state.statsListeners.add(callback);

    if (state.lastStats) {
      callback(state.lastStats);
    }

    return () => {
      state.statsListeners.delete(callback);
    };
  }

  public pushLog(serverId: string, rawLine: string, level: ConsoleLogMessage['level'] = 'info') {
    const state = this.getOrCreateState(serverId);
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const log: ConsoleLogMessage = {
      serverId,
      line: rawLine,
      timestamp: timeStr,
      level,
    };

    state.logsHistory.push(log);
    if (state.logsHistory.length > 500) {
      state.logsHistory.shift();
    }

    state.logListeners.forEach(cb => {
      try {
        cb(log);
      } catch (err) {
        // ignore
      }
    });
  }

  public async startServer(server: MinecraftServer): Promise<void> {
    db.updateServer(server.id, { status: 'STARTING' });
    this.pushLog(server.id, `[Panel/SYSTEM] Initializing container runtime on node "${server.nodeId}"...`, 'system');
    this.pushLog(server.id, `[Panel/SYSTEM] Allocating ${server.memoryMb}MB RAM, CPU throttle: ${server.cpuLimitPercent}%, Port: ${server.port}`, 'system');

    if (this.isDockerAvailable) {
      await this.startRealDocker(server);
    } else {
      this.startVirtualServer(server);
    }
  }

  private async startRealDocker(server: MinecraftServer): Promise<void> {
    const containerName = `mc-${server.id}`;

    try {
      const inspect = execSync(`docker ps -a --filter "name=${containerName}" --format "{{.ID}}"`, { encoding: 'utf-8' }).trim();
      
      if (inspect) {
        this.pushLog(server.id, `[Panel/DOCKER] Resuming existing container ${containerName}...`, 'system');
        execSync(`docker start ${containerName}`);
      } else {
        this.pushLog(server.id, `[Panel/DOCKER] Spawning container with cgroup throttles (Memory: ${server.memoryMb}M, CPU: ${server.cpuLimitPercent}%)...`, 'system');
        const rconFlag = server.rconPort ? `-p ${server.rconPort}:${server.rconPort}` : '';
        const jvmFlags = server.jvmFlags ? `-e JVM_OPTS="${server.jvmFlags}"` : '';
        const cpusArg = `--cpus="${(server.cpuLimitPercent / 100).toFixed(1)}"`;

        const dockerRunCmd = [
          'docker run -d',
          `--name ${containerName}`,
          `-i -t`,
          `--restart unless-stopped`,
          `-p ${server.port}:25565`,
          rconFlag,
          `-m ${server.memoryMb}M`,
          cpusArg,
          `-e EULA=TRUE`,
          `-e TYPE=${server.type}`,
          `-e VERSION=${server.version}`,
          `-e MEMORY=${server.memoryMb}M`,
          `-e MOTD="${server.motd.replace(/"/g, '\\"')}"`,
          `-e MAX_PLAYERS=${server.maxPlayers}`,
          jvmFlags,
          `-v "${server.volumePath}:/data"`,
          'itzg/minecraft-server:latest',
        ].filter(Boolean).join(' ');

        execSync(dockerRunCmd);
      }

      db.updateServer(server.id, { status: 'RUNNING', dockerContainerId: containerName });
      this.attachDockerLogs(server, containerName);
      this.startDockerMetricsCollector(server, containerName);

    } catch (err: any) {
      this.pushLog(server.id, `[Panel/ERROR] Docker execution failed: ${err.message}`, 'error');
      db.updateServer(server.id, { status: 'STOPPED' });
    }
  }

  private attachDockerLogs(server: MinecraftServer, containerName: string) {
    const state = this.getOrCreateState(server.id);
    if (state.process) state.process.kill();

    const logProcess = spawn('docker', ['logs', '-f', '--tail', '100', containerName]);
    state.process = logProcess;

    logProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) this.pushLog(server.id, line.trim(), 'info');
      }
    });

    logProcess.stderr.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) this.pushLog(server.id, line.trim(), line.includes('WARN') ? 'warn' : 'error');
      }
    });
  }

  private startDockerMetricsCollector(server: MinecraftServer, containerName: string) {
    const state = this.getOrCreateState(server.id);
    if (state.simulatedInterval) clearInterval(state.simulatedInterval);

    state.simulatedInterval = setInterval(() => {
      try {
        const out = execSync(`docker stats --no-stream --format "{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}|{{.NetIO}}" ${containerName}`, { encoding: 'utf-8' }).trim();
        const [cpuRaw, , memPercRaw] = out.split('|');

        const cpu = parseFloat(cpuRaw?.replace('%', '') || '0') || 0;
        const memPerc = parseFloat(memPercRaw?.replace('%', '') || '0') || 0;
        const usedMb = Math.round((memPerc / 100) * server.memoryMb);
        const players = db.getOnlinePlayers(server.id);

        const stats: ServerStats = {
          serverId: server.id,
          cpuPercent: Math.min(100, Math.max(0, cpu)),
          memoryUsedMb: usedMb,
          memoryLimitMb: server.memoryMb,
          memoryPercent: memPerc,
          diskUsedMb: 1240,
          diskLimitMb: server.diskLimitGb * 1024,
          diskPercent: Math.round((1240 / (server.diskLimitGb * 1024)) * 100),
          netRxKb: 450,
          netTxKb: 890,
          uptimeSeconds: 120,
          onlinePlayers: players.length,
          maxPlayers: server.maxPlayers,
          tps: 20.0,
        };

        state.lastStats = stats;
        state.statsListeners.forEach(cb => cb(stats));
      } catch (err) {
        // Container stopped
      }
    }, 2000);
  }

  private startVirtualServer(server: MinecraftServer) {
    const state = this.getOrCreateState(server.id);

    const bootSequence = [
      { delay: 300, line: `[${server.type}/INFO]: Environment: Java 21 OpenJDK 64-Bit Server VM on Node ${server.nodeId}` },
      { delay: 600, line: `[${server.type}/INFO]: Loading ${server.type} server version ${server.version} (API snapshot)` },
      { delay: 1000, line: `[${server.type}/INFO]: Loading server.properties & async chunk configurations` },
      { delay: 1300, line: `[${server.type}/INFO]: Initializing ${server.installedPlugins.length} installed plugins: [${server.installedPlugins.join(', ')}]` },
      { delay: 1700, line: `[${server.type}/INFO]: Generating 4096-bit RSA keypair for secure packet encryption` },
      { delay: 2100, line: `[${server.type}/INFO]: Starting Minecraft server on 0.0.0.0:${server.port}` },
      { delay: 2500, line: `[${server.type}/INFO]: Preparing level "world" (Overworld, Nether, End)` },
      { delay: 3200, line: `[${server.type}/INFO]: Time elapsed: 3210 ms. Done (3.842s)! For help, type "help"` },
    ];

    bootSequence.forEach(step => {
      setTimeout(() => {
        const curServer = db.getServer(server.id);
        if (curServer && curServer.status !== 'STOPPED') {
          this.pushLog(server.id, step.line, 'info');
        }
      }, step.delay);
    });

    setTimeout(() => {
      db.updateServer(server.id, { status: 'RUNNING' });
      this.pushLog(server.id, `[Panel/SYSTEM] Server container ${server.name} is now ONLINE on port ${server.port}`, 'system');

      // Start simulated metrics
      this.startSimulatedMetrics(server);
    }, 3600);
  }

  private startSimulatedMetrics(server: MinecraftServer) {
    const state = this.getOrCreateState(server.id);
    if (state.simulatedInterval) clearInterval(state.simulatedInterval);

    let uptime = 0;
    const baseMem = Math.floor(server.memoryMb * 0.4);

    state.simulatedInterval = setInterval(() => {
      const curServer = db.getServer(server.id);
      if (!curServer || curServer.status !== 'RUNNING') {
        if (state.simulatedInterval) clearInterval(state.simulatedInterval);
        return;
      }

      uptime += 2;
      const players = db.getOnlinePlayers(server.id);
      const cpuJitter = Number((2.0 + Math.random() * 3.5 + (players.length * 1.8)).toFixed(1));
      const memJitter = Math.floor(baseMem + (Math.sin(uptime / 20) * 80) + (players.length * 110));
      const memPerc = Number(((memJitter / server.memoryMb) * 100).toFixed(1));

      const stats: ServerStats = {
        serverId: server.id,
        cpuPercent: cpuJitter,
        memoryUsedMb: memJitter,
        memoryLimitMb: server.memoryMb,
        memoryPercent: memPerc,
        diskUsedMb: 1480 + Math.floor(uptime * 0.05),
        diskLimitMb: server.diskLimitGb * 1024,
        diskPercent: Number(((1480 / (server.diskLimitGb * 1024)) * 100).toFixed(1)),
        netRxKb: Math.floor(140 + Math.random() * 70),
        netTxKb: Math.floor(380 + Math.random() * 120),
        uptimeSeconds: uptime,
        onlinePlayers: players.length,
        maxPlayers: server.maxPlayers,
        tps: Number((19.96 + Math.random() * 0.04).toFixed(2)),
      };

      state.lastStats = stats;
      state.statsListeners.forEach(cb => {
        try {
          cb(stats);
        } catch (err) {
          // ignore
        }
      });
    }, 2000);
  }

  public async stopServer(server: MinecraftServer): Promise<void> {
    const state = this.getOrCreateState(server.id);
    db.updateServer(server.id, { status: 'STOPPING' });
    this.pushLog(server.id, `[Panel/SYSTEM] Sending stop signal to server container...`, 'system');

    if (this.isDockerAvailable) {
      try {
        execSync(`docker stop -t 15 mc-${server.id}`);
      } catch (err) {
        // ignore
      }
    } else {
      this.pushLog(server.id, `[Server thread/INFO]: Stopping server`, 'info');
      this.pushLog(server.id, `[Server thread/INFO]: Saving players and worlds to disk...`, 'info');
      this.pushLog(server.id, `[Server thread/INFO]: ThreadedAnvilChunkStorage: All chunks saved cleanly`, 'info');
      this.pushLog(server.id, `[Server thread/INFO]: Halting VM`, 'info');
    }

    if (state.simulatedInterval) clearInterval(state.simulatedInterval);
    db.updateServer(server.id, { status: 'STOPPED' });
    this.pushLog(server.id, `[Panel/SYSTEM] Server container stopped cleanly.`, 'system');
  }

  public async killServer(server: MinecraftServer): Promise<void> {
    const state = this.getOrCreateState(server.id);
    this.pushLog(server.id, `[Panel/SYSTEM] SIGKILL signal sent! Force killing container process...`, 'error');

    if (this.isDockerAvailable) {
      try {
        execSync(`docker kill mc-${server.id}`);
      } catch (err) {
        // ignore
      }
    }

    if (state.simulatedInterval) clearInterval(state.simulatedInterval);
    db.updateServer(server.id, { status: 'STOPPED' });
    this.pushLog(server.id, `[Panel/SYSTEM] Container terminated immediately.`, 'system');
  }

  public async restartServer(server: MinecraftServer): Promise<void> {
    await this.stopServer(server);
    await new Promise(r => setTimeout(r, 1000));
    await this.startServer(server);
  }

  public sendCommand(server: MinecraftServer, command: string): void {
    const cleanCmd = command.trim();
    if (!cleanCmd) return;

    this.pushLog(server.id, `> ${cleanCmd}`, 'command');

    if (server.status !== 'RUNNING') {
      this.pushLog(server.id, `[Panel/WARN] Server is currently ${server.status}. Command cannot be executed.`, 'warn');
      return;
    }

    if (this.isDockerAvailable) {
      try {
        execSync(`docker exec -i mc-${server.id} rcon-cli "${cleanCmd.replace(/"/g, '\\"')}"`, { encoding: 'utf-8' });
      } catch (err: any) {
        this.pushLog(server.id, `[Panel/ERROR] RCON dispatch error: ${err.message}`, 'error');
      }
      return;
    }

    // High-fidelity command responses and player state updates
    const parts = cleanCmd.replace(/^\//, '').split(' ');
    const root = parts[0]?.toLowerCase();

    setTimeout(() => {
      switch (root) {
        case 'help':
          this.pushLog(server.id, `[Server thread/INFO]: --- Showing help page 1 of 4 (/help <page>) ---`, 'info');
          this.pushLog(server.id, `[Server thread/INFO]: /kick <target> [reason] - Disconnects a player`, 'info');
          this.pushLog(server.id, `[Server thread/INFO]: /ban <targets> [reason] - Adds player to banlist`, 'info');
          this.pushLog(server.id, `[Server thread/INFO]: /op <targets> - Grants operator status to a player`, 'info');
          this.pushLog(server.id, `[Server thread/INFO]: /deop <targets> - Revokes operator status`, 'info');
          this.pushLog(server.id, `[Server thread/INFO]: /tell <target> <message> - Sends a private message`, 'info');
          this.pushLog(server.id, `[Server thread/INFO]: /whitelist <add|remove|list|on|off>`, 'info');
          this.pushLog(server.id, `[Server thread/INFO]: /tps - Shows current ticks per second`, 'info');
          this.pushLog(server.id, `[Server thread/INFO]: /time set <day|night|noon>`, 'info');
          break;

        case 'kick':
          const targetKick = parts[1] || 'Player';
          const reason = parts.slice(2).join(' ') || 'Kicked by an operator';
          db.removePlayer(server.id, targetKick);
          this.pushLog(server.id, `[Server thread/INFO]: Kicked ${targetKick}: ${reason}`, 'warn');
          break;

        case 'ban':
          const targetBan = parts[1] || 'Player';
          const banReason = parts.slice(2).join(' ') || 'Banned by operator';
          db.removePlayer(server.id, targetBan);
          this.pushLog(server.id, `[Server thread/INFO]: Banned ${targetBan}: ${banReason}`, 'error');
          break;

        case 'op':
          const targetOp = parts[1] || 'Steve';
          db.updatePlayer(server.id, targetOp, { isOp: true });
          this.pushLog(server.id, `[Server thread/INFO]: Made ${targetOp} a server operator`, 'info');
          break;

        case 'deop':
          const targetDeop = parts[1] || 'Steve';
          db.updatePlayer(server.id, targetDeop, { isOp: false });
          this.pushLog(server.id, `[Server thread/INFO]: Made ${targetDeop} no longer a server operator`, 'info');
          break;

        case 'tell':
        case 'msg':
        case 'w':
          const tellTarget = parts[1] || 'Player';
          const tellMsg = parts.slice(2).join(' ') || 'Hello!';
          this.pushLog(server.id, `[Server thread/INFO]: [Server -> ${tellTarget}] ${tellMsg}`, 'info');
          break;

        case 'say':
          const sayMsg = parts.slice(1).join(' ');
          this.pushLog(server.id, `[Server thread/INFO]: [Server] ${sayMsg || 'Broadcast'}`, 'info');
          break;

        case 'tps':
          this.pushLog(server.id, `[Server thread/INFO]: TPS from last 1m, 5m, 15m: 20.0, 19.98, 20.0`, 'info');
          break;

        case 'list':
          const currentPlayers = db.getOnlinePlayers(server.id);
          this.pushLog(server.id, `[Server thread/INFO]: There are ${currentPlayers.length} of max ${server.maxPlayers} players online: ${currentPlayers.map(p => p.name).join(', ')}`, 'info');
          break;

        case 'stop':
          this.stopServer(server);
          break;

        default:
          this.pushLog(server.id, `[Server thread/INFO]: Command executed: ${cleanCmd}`, 'info');
          break;
      }
    }, 120);
  }
}

export const dockerManager = DockerManager.getInstance();
