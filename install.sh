#!/usr/bin/env bash
# ==============================================================================
# ObsidianNode - Minecraft Server Hosting Control Panel
# Automated One-Click VPS Installer for Ubuntu 22.04 / 24.04 LTS & Debian 11 / 12
# ==============================================================================
# Usage:
#   chmod +x install.sh
#   sudo ./install.sh
# ==============================================================================

set -euo pipefail

# Visual color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m' # No Color

INSTALL_DIR="/opt/minecraft-panel"
DATA_DIR="/var/lib/minecraft-panel/servers"
SERVICE_NAME="minecraft-panel"
PANEL_PORT=3000
NODE_MAJOR=20

# If invoked with node agent flags, route to node bootstrapper
for arg in "$@"; do
    if [[ "$arg" == "--token" || "$arg" == *"--token="* || "$arg" == "--node-id" || "$arg" == *"--node-id="* || "$arg" == "--node" || "$arg" == "--daemon" ]]; then
        SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        if [[ -f "${SCRIPT_DIR}/install-node.sh" ]]; then
            exec bash "${SCRIPT_DIR}/install-node.sh" "$@"
        fi
    fi
done

print_banner() {
    clear || true
    echo -e "${CYAN}${BOLD}"
    cat << "EOF"
  ___  _         _     _ _             _  _          _      
 / _ \| |__  ___(_) __| (_) __ _ _ __ | \| |___   __| |___  
| (_) | '_ \(_-<| |/ _` | |/ _` | '_ \| .` / _ \ / _` / -_) 
 \___/|_.__/__/_/_|\__,_|_|\__,_|_| |_|_|\_\___/ \__,_\___| 
      MINECRAFT CLUSTER & VPS CONTROL PANEL INSTALLER
EOF
    echo -e "${NC}"
    echo -e "${BLUE}==================================================================${NC}"
    echo -e "  Automated Production Installer | Docker Virtualization & WebSocket"
    echo -e "${BLUE}==================================================================${NC}"
    echo ""
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This installer must be run as root. Please run with: sudo ./install.sh"
        exit 1
    fi
}

check_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$ID
        VER=$VERSION_ID
        log_info "Detected Operating System: $NAME ($VERSION)"
        if [[ "$OS" != "ubuntu" && "$OS" != "debian" ]]; then
            log_warn "This script is optimized for Ubuntu 22.04/24.04 and Debian 11/12."
            read -r -p "Do you wish to proceed anyway? [y/N]: " confirm
            if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
    else
        log_error "Cannot detect operating system. /etc/os-release not found."
        exit 1
    fi
}

collect_inputs() {
    echo ""
    echo -e "${BOLD}--- Configuration Parameters ---${NC}"

    # Server Domain or IP
    SERVER_IP=$(curl -s -4 ifconfig.me || curl -s -4 icanhazip.com || echo "127.0.0.1")
    read -r -p "Enter Domain Name or VPS Public IP [$SERVER_IP]: " DOMAIN_INPUT
    DOMAIN_NAME=${DOMAIN_INPUT:-$SERVER_IP}

    # SSL Selection
    USE_SSL="no"
    ADMIN_EMAIL="admin@$DOMAIN_NAME"
    if [[ "$DOMAIN_NAME" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        log_info "IP address provided. Self-signed SSL / HTTP reverse proxy will be configured."
    else
        read -r -p "Enable Let's Encrypt Automated SSL for $DOMAIN_NAME? [Y/n]: " SSL_INPUT
        if [[ "$SSL_INPUT" =~ ^[Nn]$ ]]; then
            USE_SSL="no"
        else
            USE_SSL="yes"
            read -r -p "Enter email for SSL certificate renewal alerts: " ADMIN_EMAIL
        fi
    fi

    # Panel Admin Credentials
    read -r -p "Enter Panel Admin Username [admin]: " ADMIN_USER
    ADMIN_USER=${ADMIN_USER:-admin}

    while true; do
        read -r -s -p "Enter Panel Admin Password [min 8 chars]: " ADMIN_PASS
        echo ""
        if [[ ${#ADMIN_PASS} -ge 8 ]]; then
            break
        else
            log_warn "Password must be at least 8 characters long."
        fi
    done

    JWT_SECRET=$(head /dev/urandom | tr -dc A-Za-z0-9 | head -c 48 ; echo '')
    echo ""
}

install_system_dependencies() {
    log_info "Updating system packages and repositories..."
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
        nginx \
        openssl \
        tar \
        unzip \
        software-properties-common

    # Install Certbot
    if [[ "$USE_SSL" == "yes" ]]; then
        log_info "Installing Certbot for Let's Encrypt SSL..."
        apt-get install -y certbot python3-certbot-nginx
    fi

    log_success "Base dependencies installed."
}

install_docker() {
    if command -v docker &> /dev/null; then
        log_info "Docker is already installed ($(docker --version)). Ensuring service is active..."
    else
        log_info "Installing Docker Engine and Containerd..."
        install -m 0755 -d /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/$OS/gpg -o /etc/apt/keyrings/docker.asc
        chmod a+r /etc/apt/keyrings/docker.asc

        echo \
          "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/$OS \
          $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
          tee /etc/apt/sources.list.d/docker.list > /dev/null

        apt-get update -y
        apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    fi

    systemctl enable docker
    systemctl start docker
    log_success "Docker Engine verified and running."

    log_info "Pre-pulling optimized Minecraft server image (itzg/minecraft-server:latest)..."
    docker pull itzg/minecraft-server:latest || log_warn "Could not pre-pull image now; Docker will pull on first server creation."
}

install_nodejs() {
    if command -v node &> /dev/null && [[ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -ge "$NODE_MAJOR" ]]; then
        log_info "Node.js is already installed ($(node -v))."
    else
        log_info "Installing Node.js $NODE_MAJOR LTS from NodeSource..."
        curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash -
        apt-get install -y nodejs
    fi
    log_success "Node.js $(node -v) and npm $(npm -v) are ready."
}

setup_directories_and_code() {
    log_info "Setting up directories in $INSTALL_DIR and $DATA_DIR..."
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$DATA_DIR"
    mkdir -p "$INSTALL_DIR/data"

    # If script is run inside the repository root
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if [[ -f "$SCRIPT_DIR/package.json" && -f "$SCRIPT_DIR/server.ts" ]]; then
        log_info "Copying panel source files from current directory..."
        cp -r "$SCRIPT_DIR/"* "$INSTALL_DIR/" || true
        cp "$SCRIPT_DIR/.env.example" "$INSTALL_DIR/.env" 2>/dev/null || true
    else
        log_info "Setting up panel codebase in $INSTALL_DIR..."
        # If deploying from standalone, repository can be pulled
    fi

    cd "$INSTALL_DIR"

    # Create production .env configuration
    cat > "$INSTALL_DIR/.env" << EOF
PORT=${PANEL_PORT}
NODE_ENV=production
DATA_DIR=${DATA_DIR}
JWT_SECRET=${JWT_SECRET}
ADMIN_USER=${ADMIN_USER}
ADMIN_PASS=${ADMIN_PASS}
APP_URL=http://${DOMAIN_NAME}
ENABLE_DOCKER=true
EOF

    log_info "Installing npm packages and building production assets..."
    npm install --production=false
    npm run build

    log_success "ObsidianNode built successfully."
}

configure_nginx() {
    log_info "Configuring Nginx reverse proxy with WebSocket support..."

    NGINX_CONF="/etc/nginx/sites-available/minecraft-panel.conf"
    
    cat > "$NGINX_CONF" << EOF
map \$http_upgrade \$connection_upgrade {
    default upgrade;
    '' close;
}

server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN_NAME};

    client_max_body_size 256M;

    location / {
        proxy_pass http://127.0.0.1:${PANEL_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # WebSocket timeouts for persistent console connection
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
EOF

    ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default

    nginx -t
    systemctl restart nginx

    if [[ "$USE_SSL" == "yes" ]]; then
        log_info "Provisioning Let's Encrypt SSL certificate for $DOMAIN_NAME..."
        certbot --nginx -d "$DOMAIN_NAME" --non-interactive --agree-tos -m "$ADMIN_EMAIL" --redirect || {
            log_warn "Certbot automated setup encountered an issue. HTTP reverse proxy is still active."
        }
    fi

    log_success "Nginx reverse proxy configured."
}

setup_systemd() {
    log_info "Creating and enabling systemd service ($SERVICE_NAME)..."

    SYSTEMD_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
    
    cat > "$SYSTEMD_FILE" << EOF
[Unit]
Description=ObsidianNode Minecraft Server Hosting Panel
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
Environment=NODE_ENV=production
EnvironmentFile=${INSTALL_DIR}/.env
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=minecraft-panel

# Hardening & File limits
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable "${SERVICE_NAME}"
    systemctl restart "${SERVICE_NAME}"

    log_success "Systemd service '${SERVICE_NAME}' active and enabled on boot."
}

setup_firewall() {
    log_info "Configuring UFW Firewall..."
    if command -v ufw &> /dev/null; then
        ufw allow 22/tcp comment "SSH" || true
        ufw allow 80/tcp comment "HTTP Panel" || true
        ufw allow 443/tcp comment "HTTPS Panel" || true
        ufw allow 25565:25600/tcp comment "Minecraft TCP Port Range" || true
        ufw allow 25565:25600/udp comment "Minecraft UDP / Geyser" || true
        echo "y" | ufw enable || true
        log_success "Firewall rules applied (SSH, HTTP/S, 25565-25600 allowed)."
    fi
}

print_summary() {
    echo ""
    echo -e "${GREEN}${BOLD}==================================================================${NC}"
    echo -e "${GREEN}${BOLD}      🎉 ObsidianNode Installation Completed Successfully!        ${NC}"
    echo -e "${GREEN}${BOLD}==================================================================${NC}"
    echo ""
    echo -e "  ${BOLD}Panel URL:${NC}       http://${DOMAIN_NAME} (or https://${DOMAIN_NAME})"
    echo -e "  ${BOLD}Admin User:${NC}      ${ADMIN_USER}"
    echo -e "  ${BOLD}Admin Password:${NC}  ${ADMIN_PASS}"
    echo ""
    echo -e "  ${BOLD}Install Directory:${NC} ${INSTALL_DIR}"
    echo -e "  ${BOLD}Server Storage:${NC}    ${DATA_DIR}"
    echo ""
    echo -e "  ${BOLD}Useful Management Commands:${NC}"
    echo -e "    - View Live Logs:   ${CYAN}journalctl -u ${SERVICE_NAME} -f${NC}"
    echo -e "    - Restart Service:  ${CYAN}systemctl restart ${SERVICE_NAME}${NC}"
    echo -e "    - Check Status:     ${CYAN}systemctl status ${SERVICE_NAME}${NC}"
    echo -e "    - View Containers:  ${CYAN}docker ps${NC}"
    echo ""
    echo -e "${BLUE}==================================================================${NC}"
}

main() {
    print_banner
    check_root
    check_os
    collect_inputs
    install_system_dependencies
    install_docker
    install_nodejs
    setup_directories_and_code
    configure_nginx
    setup_systemd
    setup_firewall
    print_summary
}

main "$@"
