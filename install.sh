#!/usr/bin/env bash
# 🧬 Tm3d · instalador — rede local tm3d-local-sim
set -e
cd "$(dirname "$0")"
PORTA="${1:-8791}"

echo ""
echo "  🧬 Tm3d · instalação da rede local (chainid 79999)"
echo "  ─────────────────────────────────────────────────"

# 1) Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "  ⚠️  Node.js não encontrado. Instalando…"
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update -qq && sudo apt-get install -y -qq nodejs
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y nodejs
  elif command -v apk >/dev/null 2>&1; then
    sudo apk add --no-cache nodejs
  else
    echo "  ❌ Instale o Node.js 18+ manualmente: https://nodejs.org"; exit 1
  fi
fi
echo "  ✅ Node $(node -v)"

# 2) systemd (opcional, servidores Linux)
if [ "$2" = "--service" ] && command -v systemctl >/dev/null 2>&1; then
  DIR="$(pwd)"
  sudo tee /etc/systemd/system/tm3d.service >/dev/null <<EOF
[Unit]
Description=Tm3d DApp - rede local tm3d-local-sim
After=network.target
[Service]
ExecStart=$(command -v node) $DIR/server.js $PORTA
WorkingDirectory=$DIR
Restart=always
Environment=NODE_ENV=production
[Install]
WantedBy=multi-user.target
EOF
  sudo systemctl daemon-reload && sudo systemctl enable --now tm3d
  echo "  ✅ Serviço systemd 'tm3d' ativo na porta $PORTA"
else
  echo "  ▶  Subindo o servidor (Ctrl+C para parar)…"
  echo "     Dica: para rodar como serviço:  bash install.sh $PORTA --service"
  echo "  ─────────────────────────────────────────────────"
  exec node server.js "$PORTA"
fi
