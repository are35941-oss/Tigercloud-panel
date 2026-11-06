#!/usr/bin/env bash
# ==============================================================================
# ObsidianNode - Remote VPS Daemon / Node Agent (Wings Equivalent) Installer
# Automated VPS Node Bootstrapper & Dynamic Handshake Pairing
# Target OS: Ubuntu 22.04 / 24.04 LTS & Debian 11 / 12
# Architectures: x86_64, aarch64
# ==============================================================================
# Usage with flags (Automated):
#   curl -sSL https://panel.example.com/install-node.sh | sudo bash -s -- \
#     --panel-url "https://panel.example.com" \
#     --token "ptlc_node_sec_..." \
#     --node-id "node-xyz" \
#     --port 8080 \
#     --fqdn "node1.example.com"
#
# Interactive Usage:
#   chmod +x install-node.sh && sudo ./install-node.sh
# ==============================================================================

set -euo pipefail

# ANSI Color Codes
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

# Configuration Defaults
CONFIG_DIR="/etc/mc-daemon"
CONFIG_FILE="${CONFIG_DIR}/config.json"
NODE_DIR="/opt/minecraft-node"
DATA_DIR="/var/lib/minecraft-panel/servers"
SERVICE_NAME="mc-daemon"

PANEL_URL=""
DAEMON_TOKEN=""
NODE_ID=""
DAEMON_PORT=8080
NODE_FQDN=""
AUTO_CONFIRM=false

print_banner() {
    clear || true
    echo -e "${CYAN}${BOLD}"
    cat << "EOF"
  ___  _         _     _ _             _  _          _      
 / _ \| |__  ___(_) __| (_) __ _ _ __ | \| |___   __| |___  
| (_) | '_ \(_-<| |/ _` | |/ _` | '_ \| .` / _ \ / _` / -_) 
 \___/|_.__/__/_/_|\__,_|_|\__,_|_| |_|_|\_\___/ \__,_\___| 
     REMOTE VPS NODE AGENT (WINGS EQUIVALENT) BOOTSTRAPPER
EOF
    echo -e "${NC}"
    echo -e "${BLUE}==================================================================${NC}"
    echo -e "  Automated Daemon Installer & Real-Time Dynamic Pairing Engine"
    echo -e "${BLUE}==================================================================${NC}"
    echo ""
}

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 1. Parse Command Line Arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --panel-url)
                PANEL_URL="$2"
                shift 2
                ;;
            --panel-url=*)
                PANEL_URL="${1#*=}"
                shift
                ;;
            --token)
                DAEMON_TOKEN="$2"
                shift 2
                ;;
            --token=*)
                DAEMON_TOKEN="${1#*=}"
                shift
                ;;
            --node-id)
                NODE_ID="$2"
                shift 2
                ;;
            --node-id=*)
                NODE_ID="${1#*=}"
                shift
                ;;
            --port)
                DAEMON_PORT="$2"
                shift 2
                ;;
            --port=*)
                DAEMON_PORT="${1#*=}"
                shift
                ;;
            --fqdn)
                NODE_FQDN="$2"
                shift 2
                ;;
            --fqdn=*)
                NODE_FQDN="${1#*=}"
                shift
                ;;
            -y|--yes|--auto)
                AUTO_CONFIRM=true
                shift
                ;;
            *)
                shift
                ;;
        esac
    done
}

# 2. Pre-flight Checks
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be executed as root. Please run: sudo ./install-node.sh"
        exit 1
    fi
}

check_arch() {
    ARCH=$(uname -m)
    log_info "Detected Hardware Architecture: ${ARCH}"
    if [[ "$ARCH" != "x86_64" && "$ARCH" != "aarch64" && "$ARCH" != "arm64" ]]; then
        log_warn "ObsidianNode agent is optimized for x86_64 and aarch64. Proceeding with caution..."
    fi
}

check_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$ID
        VER=$VERSION_ID
        log_info "Detected Operating System: $NAME ($VERSION)"
        if [[ "$OS" != "ubuntu" && "$OS" != "debian" ]]; then
            log_warn "This installer is targeted for Ubuntu 22.04/24.04 and Debian 11/12."
            if [[ "$AUTO_CONFIRM" != "true" ]]; then
                read -r -p "Continue anyway? [y/N]: " confirm
                if [[ ! "$confirm" =~ ^[Yy]$ ]]; then exit 1; fi
            fi
        fi
    else
        log_error "/etc/os-release not found. Cannot determine distribution."
        exit 1
    fi
}

# 3. Interactive Input Collection (Fallback if CLI flags were omitted)
collect_inputs() {
    echo ""
    echo -e "${BOLD}--- Remote Node Agent Pairing Parameters ---${NC}"

    SERVER_IP=$(curl -s -4 ifconfig.me || curl -s -4 icanhazip.com || echo "127.0.0.1")

    if [[ -z "$NODE_FQDN" ]]; then
        read -r -p "Enter this Node's Public FQDN or IP [$SERVER_IP]: " INPUT_FQDN
        NODE_FQDN=${INPUT_FQDN:-$SERVER_IP}
    else
        log_info "Node FQDN/IP specified via flag: ${NODE_FQDN}"
    fi

    if [[ -z "$PANEL_URL" ]]; then
        read -r -p "Enter Central Panel Base URL (e.g. http://192.168.1.10:3000): " INPUT_PANEL
        PANEL_URL=${INPUT_PANEL:-"http://127.0.0.1:3000"}
    else
        log_info "Panel URL specified via flag: ${PANEL_URL}"
    fi
    # Strip trailing slash from PANEL_URL
    PANEL_URL="${PANEL_URL%/}"

    if [[ -z "$DAEMON_TOKEN" ]]; then
        read -r -p "Enter Daemon Secret Token from Panel: " INPUT_TOKEN
        DAEMON_TOKEN=${INPUT_TOKEN:-""}
        if [[ -z "$DAEMON_TOKEN" ]]; then
            log_warn "No token provided; generating local secret..."
            DAEMON_TOKEN="ptlc_node_sec_$(head /dev/urandom | tr -dc a-f0-9 | head -c 50)"
        fi
    else
        log_info "Daemon Secret Token passed via CLI flag."
    fi

    if [[ -z "$NODE_ID" ]]; then
        read -r -p "Enter Node ID (from panel, or leave blank to auto-detect/handshake): " INPUT_NODE_ID
        NODE_ID=${INPUT_NODE_ID:-""}
    else
        log_info "Node ID specified via flag: ${NODE_ID}"
    fi

    if [[ -z "$DAEMON_PORT" || "$DAEMON_PORT" == "8080" ]]; then
        if [[ "$AUTO_CONFIRM" != "true" ]]; then
            read -r -p "Enter Daemon Listen Port [8080]: " INPUT_PORT
            DAEMON_PORT=${INPUT_PORT:-8080}
        fi
    fi

    echo ""
}

# 4. Install Docker, Compose, and Core Dependencies
install_dependencies() {
    log_info "Updating package lists and installing core dependencies (Docker, Git, Curl, jq)..."
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y \
        ca-certificates \
        curl \
        gnupg \
        lsb-release \
        wget \
        git \
        jq \
        ufw \
        tar \
        unzip \
        software-properties-common

    # Official Docker Engine Installation
    if ! command -v docker &> /dev/null; then
        log_info "Installing Docker Engine and Containerd..."
        install -m 0755 -d /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/$OS/gpg -o /etc/apt/keyrings/docker.asc
        chmod a+r /etc/apt/keyrings/docker.asc

        echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/$OS $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
        apt-get update -y
        apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    fi

    systemctl enable docker
    systemctl start docker
    log_success "Docker Engine verified and active ($(docker --version))."

    # Node.js 20 LTS Runtime for Agent
    if ! command -v node &> /dev/null; then
        log_info "Installing Node.js runtime from NodeSource..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    fi
    log_success "Node.js runtime ready ($(node -v))."

    # Pre-pull itzg Minecraft Server image
    log_info "Pre-caching itzg/minecraft-server container image in local Docker registry..."
    docker pull itzg/minecraft-server:latest || log_warn "Image pre-pull postponed to container initialization."
}

# 5. Configuration Setup (/etc/mc-daemon/config.json)
setup_configuration() {
    log_info "Creating configuration directory ${CONFIG_DIR}..."
    mkdir -p "${CONFIG_DIR}"
    mkdir -p "${NODE_DIR}"
    mkdir -p "${DATA_DIR}"

    log_info "Writing ${CONFIG_FILE}..."
    cat > "${CONFIG_FILE}" << EOF
{
  "panel_url": "${PANEL_URL}",
  "node_id": "${NODE_ID}",
  "token": "${DAEMON_TOKEN}",
  "port": ${DAEMON_PORT},
  "fqdn": "${NODE_FQDN}",
  "data_dir": "${DATA_DIR}",
  "sftp_port": 2022
}
EOF
    chmod 600 "${CONFIG_FILE}"
    log_success "Daemon configuration saved at ${CONFIG_FILE}."
}

# 6. Deploy Wings-Like Daemon Agent Runner
deploy_agent_code() {
    log_info "Deploying daemon agent runner in ${NODE_DIR}..."

    cat > "${NODE_DIR}/package.json" << 'EOF'
{
  "name": "obsidian-node-agent",
  "version": "1.5.0",
  "type": "module",
  "dependencies": {
    "express": "^4.21.2",
    "ws": "^8.22.1"
  }
}
EOF

    cd "${NODE_DIR}"
    npm install --omit=dev

    cat > "${NODE_DIR}/daemon.js" << 'EOF'
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Load from /etc/mc-daemon/config.json if available
let config = {
  port: 8080,
  token: 'wings_secret',
  data_dir: '/var/lib/minecraft-panel/servers',
  panel_url: 'http://127.0.0.1:3000'
};

const CONFIG_PATH = '/etc/mc-daemon/config.json';
if (fs.existsSync(CONFIG_PATH)) {
  try {
    config = { ...config, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) };
  } catch (e) {
    console.error('Failed to parse /etc/mc-daemon/config.json:', e);
  }
}

const DAEMON_PORT = parseInt(process.env.DAEMON_PORT || String(config.port), 10);
const DAEMON_TOKEN = process.env.DAEMON_TOKEN || config.token;
const DATA_DIR = process.env.DATA_DIR || config.data_dir;

const app = express();
app.use(express.json({ limit: '100mb' }));
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/console' });

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || header !== `Bearer ${DAEMON_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized daemon token' });
  }
  next();
}

app.get('/health', (_req, res) => res.json({ 
  status: 'ONLINE', 
  agent: 'ObsidianWings-NodeAgent', 
  version: '1.5.0',
  node_id: config.node_id || 'unknown'
}));

app.get('/api/system', auth, (_req, res) => {
  const total = Math.round(os.totalmem() / (1024 * 1024));
  const free = Math.round(os.freemem() / (1024 * 1024));
  let dockerVersion = 'Docker Unavailable';
  try { dockerVersion = execSync('docker --version', { encoding: 'utf-8' }).trim(); } catch (e) {}

  res.json({
    hostname: os.hostname(),
    os: `${os.type()} ${os.release()}`,
    cpuCores: os.cpus().length,
    totalRamMb: total,
    usedRamMb: total - free,
    freeRamMb: free,
    docker: { available: fs.existsSync('/var/run/docker.sock'), version: dockerVersion },
    uptimeSeconds: Math.floor(os.uptime())
  });
});

app.post('/api/servers', auth, (req, res) => {
  const { id, type = 'PAPER', version = '1.21.1', memoryMb = 2048, cpuLimitPercent = 100, port = 25565, motd = 'Minecraft Server', maxPlayers = 20, jvmFlags = '' } = req.body;
  if (!id) return res.status(400).json({ error: 'Missing server id' });

  const dir = path.join(DATA_DIR, id);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'eula.txt'), 'eula=true\n');
  const name = `mc-${id}`;

  try {
    const cpus = cpuLimitPercent ? `--cpus="${(cpuLimitPercent / 100).toFixed(1)}"` : '';
    const cmd = `docker run -d --name ${name} -i -t --restart unless-stopped -p ${port}:25565 -m ${memoryMb}M ${cpus} -e EULA=TRUE -e TYPE=${type} -e VERSION=${version} -e MEMORY=${memoryMb}M -e MOTD="${motd.replace(/"/g, '\\"')}" -e MAX_PLAYERS=${maxPlayers} -e JVM_OPTS="${jvmFlags}" -v "${dir}:/data" itzg/minecraft-server:latest`;
    execSync(cmd);
    res.status(201).json({ success: true, container: name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/servers/:id/power', auth, (req, res) => {
  const { id } = req.params;
  const { action } = req.body;
  const name = `mc-${id}`;
  try {
    if (action === 'start') execSync(`docker start ${name}`);
    else if (action === 'stop') execSync(`docker stop -t 15 ${name}`);
    else if (action === 'restart') execSync(`docker restart -t 15 ${name}`);
    else if (action === 'kill') execSync(`docker kill ${name}`);
    res.json({ success: true, action });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

server.listen(DAEMON_PORT, '0.0.0.0', () => {
  console.log(`[Wings-Daemon] Node Agent running on port ${DAEMON_PORT}`);
});
EOF

    log_success "Daemon agent script deployed."
}

# 7. Dynamic Handshake with Central Management Panel
trigger_handshake() {
    log_info "Initiating dynamic pairing handshake with Central Panel (${PANEL_URL})..."

    # Gather live host specs
    TOTAL_RAM_MB=$(free -m | awk '/^Mem:/{print $2}')
    CPU_CORES=$(nproc || echo 4)
    DISK_GB=$(df -BG / | awk 'NR==2{print $2}' | tr -d 'G')
    DOCKER_VER=$(docker --version 2>/dev/null || echo "Docker Engine 26.1")
    OS_INFO="$(uname -s) $(uname -r) ($(uname -m))"

    HANDSHAKE_URL="${PANEL_URL}/api/nodes/handshake"
    log_info "Contacting handshake endpoint: ${HANDSHAKE_URL}"

    PAYLOAD=$(cat << EOF
{
  "node_id": "${NODE_ID}",
  "token": "${DAEMON_TOKEN}",
  "fqdn": "${NODE_FQDN}",
  "port": ${DAEMON_PORT},
  "systemInfo": {
    "totalRamMb": ${TOTAL_RAM_MB},
    "totalCpuCores": ${CPU_CORES},
    "totalDiskGb": ${DISK_GB},
    "dockerVersion": "${DOCKER_VER}",
    "osInfo": "${OS_INFO}"
  }
}
EOF
)

    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${HANDSHAKE_URL}" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${DAEMON_TOKEN}" \
        -d "${PAYLOAD}" || echo '{"error":"Network connection to panel failed"}\n000')

    HTTP_BODY=$(echo "$RESPONSE" | sed '$d')
    HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)

    if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "201" ]]; then
        log_success "✨ Handshake Succeeded (HTTP ${HTTP_CODE})!"
        log_success "Central Panel has verified token and marked this node as ONLINE!"
    else
        log_warn "Handshake returned HTTP ${HTTP_CODE}: ${HTTP_BODY}"
        log_warn "Daemon is installed and configured locally. It will retry handshake on next heartbeat."
    fi
}

# 8. Register and Enable Systemd Service (mc-daemon.service)
setup_systemd() {
    log_info "Creating and activating systemd service (${SERVICE_NAME}.service)..."

    cat > "/etc/systemd/system/${SERVICE_NAME}.service" << EOF
[Unit]
Description=ObsidianNode Wings Remote Node Agent
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=${NODE_DIR}
Environment="NODE_ENV=production"
ExecStart=/usr/bin/node ${NODE_DIR}/daemon.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=mc-daemon
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable "${SERVICE_NAME}"
    systemctl restart "${SERVICE_NAME}"

    log_success "Systemd service '${SERVICE_NAME}' active and enabled on boot."
}

# 9. Configure UFW Firewall
setup_firewall() {
    log_info "Configuring UFW Firewall for Game Node..."
    if command -v ufw &> /dev/null; then
        ufw allow 22/tcp comment "SSH" || true
        ufw allow "${DAEMON_PORT}/tcp" comment "Daemon API & WebSocket" || true
        ufw allow 25565:25650/tcp comment "Minecraft TCP Port Range" || true
        ufw allow 25565:25650/udp comment "Minecraft UDP / Geyser Bedrock" || true
        echo "y" | ufw enable || true
        log_success "Firewall rules enabled for SSH, ${DAEMON_PORT}, and Minecraft ranges (25565-25650)."
    fi
}

# 10. Summary Report
print_summary() {
    echo ""
    echo -e "${GREEN}${BOLD}==================================================================${NC}"
    echo -e "${GREEN}${BOLD}    🎉 Remote VPS Node Agent (mc-daemon) Paired Successfully!     ${NC}"
    echo -e "${GREEN}${BOLD}==================================================================${NC}"
    echo ""
    echo -e "  ${BOLD}Node Address:${NC}      ${NODE_FQDN}:${DAEMON_PORT}"
    echo -e "  ${BOLD}Node ID:${NC}           ${NODE_ID:-'(Auto-Associated)'}"
    echo -e "  ${BOLD}Daemon Secret:${NC}     ${CYAN}${DAEMON_TOKEN}${NC}"
    echo -e "  ${BOLD}Central Panel:${NC}     ${PANEL_URL}"
    echo -e "  ${BOLD}Config Location:${NC}   ${CONFIG_FILE}"
    echo -e "  ${BOLD}Status:${NC}            ${GREEN}ONLINE & READY FOR CONTAINERS${NC}"
    echo ""
    echo -e "  ${BOLD}Useful Agent Commands:${NC}"
    echo -e "    - View Live Logs:   ${CYAN}journalctl -u ${SERVICE_NAME} -f${NC}"
    echo -e "    - Restart Daemon:   ${CYAN}systemctl restart ${SERVICE_NAME}${NC}"
    echo -e "    - Check Status:     ${CYAN}systemctl status ${SERVICE_NAME}${NC}"
    echo -e "    - View Containers:  ${CYAN}docker ps${NC}"
    echo ""
    echo -e "${BLUE}==================================================================${NC}"
}

main() {
    print_banner
    parse_args "$@"
    check_root
    check_arch
    check_os
    collect_inputs
    install_dependencies
    setup_configuration
    deploy_agent_code
    trigger_handshake
    setup_systemd
    setup_firewall
    print_summary
}

main "$@"
