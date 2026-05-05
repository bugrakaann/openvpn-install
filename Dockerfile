ARG BASE_IMAGE=ubuntu:24.04
FROM ${BASE_IMAGE}

ENV DEBIAN_FRONTEND=noninteractive
ENV container docker

# Systemd needs this to run correctly in Docker
STOPSIGNAL SIGRTMIN+3

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
        iproute2 iptables curl procps systemd systemd-sysv \
        dnsutils jq ca-certificates gnupg \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20 LTS
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Create TUN device directory
RUN mkdir -p /dev/net

# Copy the OpenVPN install script
COPY openvpn-install.sh /opt/openvpn-install.sh
RUN chmod +x /opt/openvpn-install.sh

# Copy the admin panel
COPY panel/ /opt/panel/

# Build frontend separately (needs devDependencies like vite)
WORKDIR /opt/panel/frontend
COPY panel/frontend/package*.json ./
RUN npm install
COPY panel/frontend/ ./
# Vite izin hatasını çözmek için
RUN npx vite build

# Install backend dependencies (production only)
WORKDIR /opt/panel
RUN npm install --omit=dev

# Create systemd service for the admin panel
RUN printf '%s\n' \
    '[Unit]' \
    'Description=OpenVPN Admin Panel' \
    'After=network.target openvpn-server@server.service' \
    '' \
    '[Service]' \
    'Type=simple' \
    'Environment=HOME=/root' \
    'Environment=SCRIPT_PATH=/opt/openvpn-install.sh' \
    'Environment=PORT=3000' \
    'Environment=ADMIN_USER=admin' \
    'Environment=ADMIN_PASS=admin' \
    'Environment=SESSION_SECRET=change-me-in-production' \
    'WorkingDirectory=/opt/panel' \
    'ExecStart=/usr/bin/node /opt/panel/server.js' \
    'Restart=always' \
    'RestartSec=5' \
    'StandardOutput=journal+console' \
    'StandardError=journal+console' \
    '' \
    '[Install]' \
    'WantedBy=multi-user.target' \
    > /etc/systemd/system/openvpn-panel.service \
    && systemctl enable openvpn-panel.service

# Copy the server setup entrypoint
COPY panel/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create systemd service for the entrypoint (runs OpenVPN install on first boot)
RUN printf '%s\n' \
    '[Unit]' \
    'Description=OpenVPN Server Setup' \
    'After=network.target' \
    'Before=openvpn-panel.service' \
    '' \
    '[Service]' \
    'Type=oneshot' \
    'Environment=HOME=/root' \
    'WorkingDirectory=/root' \
    'ExecStart=/entrypoint.sh' \
    'RemainAfterExit=yes' \
    'StandardOutput=journal+console' \
    'StandardError=journal+console' \
    '' \
    '[Install]' \
    'WantedBy=multi-user.target' \
    > /etc/systemd/system/openvpn-setup.service \
    && systemctl enable openvpn-setup.service

EXPOSE 1194/udp 3000/tcp

STOPSIGNAL SIGRTMIN+3
CMD ["/sbin/init"]
