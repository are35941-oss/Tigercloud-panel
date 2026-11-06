#!/usr/bin/env bash
# ==============================================================================
# ObsidianNode - Central Management Hub (Panel) Installer
# Modeled after Pterodactyl Panel Architecture
# Target OS: Ubuntu 22.04 / 24.04 LTS & Debian 11 / 12
# ==============================================================================
# Usage:
#   chmod +x install-panel.sh
#   sudo ./install-panel.sh
# ==============================================================================

set -euo pipefail

# ANSI Palette
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

INSTALL_DIR="/opt/minecraft-panel"
DATA_DIR="/var/lib/minecraft-panel/servers"
SERVICE_NAME="mc-panel"
PANEL_PORT=3000
NODE_MAJOR=20

print_banner() {
    clear || true
    echo -e "${CYAN}${BOLD}"
    cat << "EOF"
  ___  _         _     _ _             ___                 _ 
 / _ \| |__  ___(_) __| (_) __ _ _ __ | _ \__ _ _ _  ___ | |
| (_) | '_ \(_-<| |/ _` | |/ _` | '_ \|  _/ _` | ' \/ -_)| |
 \___/|_.__/__/_/_|\__,_|_|\__,_|_| |_|_| \__,_|_||_\___||_|
      ENTERPRISE MINECRAFT CENTRAL CONTROL PANEL INSTALLER
EOF
    echo -e "${NC}"
    echo -e "${BLUE}==================================================================${NC}"
    echo -e "  Central Panel Deployment | Multi-Node Routing & Management Hub"
    echo -e "${BLUE}==================================================================${NC}"
    echo ""
}

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be executed as root. Use: sudo ./install-panel.sh"
        exit 1
    fi
}

check_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$ID
        log_info "Detected OS: $NAME ($VERSION)"
        if [[ "$OS" != "ubuntu" && "$OS" != "debian" ]]; then
            log_warn "This installer is targeted for Ubuntu 22.04/24.04 and Debian 11/12."
            read -r -p "Continue anyway? [y/N]: " confirm
            if [[ ! "$confirm" =~ ^[Yy]$ ]]; then exit 1; fi
        fi
    else
        log_error "/etc/os-release not found."
        exit 1
    fi
}

collect_inputs() {
    echo ""
    echo -e "${BOLD}--- Central Panel Configuration ---${NC}"
    SERVER_IP=$(curl -s -4 ifconfig.me || curl -s -4 icanhazip.com || echo "127.0.0.1")
    read -r -p "Enter Panel FQDN or Public IP [$SERVER_IP]: " DOMAIN_INPUT
    DOMAIN_NAME=${DOMAIN_INPUT:-$SERVER_IP}

    USE_SSL="no"
    ADMIN_EMAIL="admin@$DOMAIN_NAME"
    if [[ "$DOMAIN_NAME" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        log_info "IP specified. HTTP reverse proxy will be configured."
    else
        read -r -p "Configure Let's Encrypt SSL for $DOMAIN_NAME? [Y/n]: " SSL_INPUT
        if [[ ! "$SSL_INPUT" =~ ^[Nn]$ ]]; then
            USE_SSL="yes"
            read -r -p "Enter administrator email for Certbot: " ADMIN_EMAIL
        fi
    fi

    read -r -p "Enter Super Admin Username [admin]: " ADMIN_USER
    ADMIN_USER=${ADMIN_USER:-admin}

    while true; do
        read -r -s -p "Enter Super Admin Password [min 8 characters]: " ADMIN_PASS
        echo ""
        if [[ ${#ADMIN_PASS} -ge 8 ]]; then break; else log_warn "Password must be >= 8 characters."; fi
    done

    JWT_SECRET=$(head /dev/urandom | tr -dc A-Za-z0-9 | head -c 48 ; echo '')
    echo ""
}

install_dependencies() {
    log_info "Updating package lists and installing core dependencies..."
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y ca-certificates curl gnupg lsb-release wget git jq ufw nginx openssl software-properties-common

    if [[ "$USE_SSL" == "yes" ]]; then
        log_info "Installing Certbot with Nginx plugin..."
        apt-get install -y certbot python3-certbot-nginx
    fi

    # Node.js 20 LTS
    if ! command -v node &> /dev/null || [[ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt "$NODE_MAJOR" ]]; then
        log_info "Installing Node.js $NODE_MAJOR LTS from NodeSource..."
        curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash -
        apt-get install -y nodejs
    fi
    log_success "Core dependencies ready (Node $(node -v), Nginx $(nginx -v 2>&1 | cut -d'/' -f2))."
}

setup_codebase() {
    log_info "Deploying codebase into $INSTALL_DIR..."
    mkdir -p "$INSTALL_DIR" "$DATA_DIR" "$INSTALL_DIR/data"

    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if [[ -f "$SCRIPT_DIR/package.json" && -f "$SCRIPT_DIR/server.ts" ]]; then
        cp -r "$SCRIPT_DIR/"* "$INSTALL_DIR/" || true
    fi

    cd "$INSTALL_DIR"

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

    log_info "Installing npm packages and building production bundle..."
    npm install --production=false
    npm run build
    log_success "Central Panel bundle compiled."
}

configure_nginx() {
    log_info "Configuring Nginx reverse proxy with WebSocket stream headers..."
    NGINX_CONF="/etc/nginx/sites-available/${SERVICE_NAME}.conf"

    cat > "$NGINX_CONF" << EOF
map \$http_upgrade \$connection_upgrade {
    default upgrade;
    '' close;
}

server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN_NAME};
    client_max_body_size 512M;

    location / {
        proxy_pass http://127.0.0.1:${PANEL_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
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
        log_info "Obtaining Let's Encrypt certificate..."
        certbot --nginx -d "$DOMAIN_NAME" --non-interactive --agree-tos -m "$ADMIN_EMAIL" --redirect || {
            log_warn "SSL certificate issuance encountered an issue. HTTP proxy remains active."
        }
    fi
    log_success "Nginx proxy configured."
}

setup_systemd() {
    log_info "Registering ${SERVICE_NAME}.service..."
    cat > "/etc/systemd/system/${SERVICE_NAME}.service" << EOF
[Unit]
Description=ObsidianNode Central Management Panel
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
Environment=NODE_ENV=production
EnvironmentFile=${INSTALL_DIR}/.env
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=mc-panel
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable "${SERVICE_NAME}"
    systemctl restart "${SERVICE_NAME}"
    log_success "Systemd service '${SERVICE_NAME}' active and running."
}

setup_firewall() {
    log_info "Configuring UFW Firewall for Panel..."
    if command -v ufw &> /dev/null; then
        ufw allow 22/tcp comment "SSH" || true
        ufw allow 80/tcp comment "HTTP Panel" || true
        ufw allow 443/tcp comment "HTTPS Panel" || true
        echo "y" | ufw enable || true
        log_success "Firewall configured (Ports 22, 80, 443 allowed)."
    fi
}

print_summary() {
    echo ""
    echo -e "${GREEN}${BOLD}==================================================================${NC}"
    echo -e "${GREEN}${BOLD}   🎉 Central Management Panel (mc-panel) Installed Successfully! ${NC}"
    echo -e "${GREEN}${BOLD}==================================================================${NC}"
    echo ""
    echo -e "  ${BOLD}Panel URL:${NC}       http://${DOMAIN_NAME} (or https://${DOMAIN_NAME})"
    echo -e "  ${BOLD}Admin User:${NC}      ${ADMIN_USER}"
    echo -e "  ${BOLD}Admin Password:${NC}  ${ADMIN_PASS}"
    echo ""
    echo -e "  ${BOLD}Next Step: Connect Remote Daemon Nodes${NC}"
    echo -e "    Run ${CYAN}install-node.sh${NC} on your remote VPS game nodes to link them"
    echo -e "    with this central panel via the Node Secret Key."
    echo ""
    echo -e "  ${BOLD}Panel Commands:${NC}"
    echo -e "    - Service Logs:   ${CYAN}journalctl -u ${SERVICE_NAME} -f${NC}"
    echo -e "    - Service Status: ${CYAN}systemctl status ${SERVICE_NAME}${NC}"
    echo -e "    - Restart Panel:  ${CYAN}systemctl restart ${SERVICE_NAME}${NC}"
    echo ""
    echo -e "${BLUE}==================================================================${NC}"
}

main() {
    print_banner
    check_root
    check_os
    collect_inputs
    install_dependencies
    setup_codebase
    configure_nginx
    setup_systemd
    setup_firewall
    print_summary
}

main "$@"
