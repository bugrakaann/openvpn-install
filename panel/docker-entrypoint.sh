#!/bin/bash
set -e

echo "=== OpenVPN Server Setup ==="

# Create TUN device if it doesn't exist
if [ ! -c /dev/net/tun ]; then
    mkdir -p /dev/net
    mknod /dev/net/tun c 10 200
    chmod 600 /dev/net/tun
fi

echo "TUN device ready"

# Check if OpenVPN is already installed (persistent volume scenario)
if [ -f /etc/openvpn/server/server.conf ]; then
    echo "OpenVPN is already installed, skipping setup."
    echo "Starting OpenVPN service..."
    systemctl start openvpn-server@server || true
    exit 0
fi

# First-time installation
echo "Running OpenVPN install script..."
/opt/openvpn-install.sh install \
    --endpoint "${VPN_ENDPOINT:-$(curl -4s https://ifconfig.co)}" \
    --port "${VPN_PORT:-1194}" \
    --protocol "${VPN_PROTOCOL:-udp}" \
    --dns "${VPN_DNS:-cloudflare}" \
    --client "${VPN_FIRST_CLIENT:-client}" \
    --no-client-ipv6

echo "=== OpenVPN installation complete ==="
