#!/bin/bash
# SakhGO maintenance mode toggle
# Usage: sudo bash maintenance.sh [on|off|status]

FLAG=/home/alex/sakhgo/maintenance.flag

case "${1:-status}" in
  on)
    touch "$FLAG"
    nginx -t && systemctl reload nginx && echo "🔧 Техработы ВКЛЮЧЕНЫ" || { rm -f "$FLAG"; echo "❌ Ошибка"; exit 1; }
    ;;
  off)
    rm -f "$FLAG"
    nginx -t && systemctl reload nginx && echo "✅ Сайт работает normally" || echo "❌ Ошибка reload"
    ;;
  status|*)
    if [ -f "$FLAG" ]; then
      echo "🔧 Техработы: ВКЛЮЧЕНЫ"
    else
      echo "✅ Сайт: работает"
    fi
    ;;
esac
