#!/bin/bash

# Путь к проекту (жестко заданный)
PROJECT_DIR="/Users/ratpoisen/Documents/gochess_alternative"
cd "$PROJECT_DIR" || exit 1

# Цвета для вывода
GREEN='\033[0;32m'
NC='\033[0m' # No Color

clear
echo -e "${GREEN}=======================================${NC}"
echo -e "${GREEN}   Poisen Agent Studio (CLI Launcher)  ${NC}"
echo -e "${GREEN}=======================================${NC}"
echo ""

# Проверяем, запущен ли уже Vite сервер на порту 5173
if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚡ Vite сервер уже работает."
else
    echo "🚀 Запуск Vite сервера в фоне..."
    npm run dev > .opencode/vite.log 2>&1 &
    VITE_PID=$!
    echo "✅ Vite запущен (PID: $VITE_PID). Откройте http://localhost:5173"
fi

echo ""
echo "🤖 Запуск Оркестратора..."
sleep 1

# Активируем виртуальное окружение, если оно есть (раскомментируй если нужно)
# source venv/bin/activate

# Запускаем питон-скрипт оркестратора
python3 agents/orchestrator.py

# Действия при выходе из оркестратора
echo ""
echo -e "${GREEN}Оркестратор завершил работу.${NC}"

# Если мы запускали Vite в этом скрипте, спросим, нужно ли его убить
if [ ! -z "$VITE_PID" ]; then
    read -p "Остановить локальный сервер Vite (y/n)? " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]
    then
        kill $VITE_PID
        echo "🛑 Vite сервер остановлен."
    else
        echo "⚡ Vite сервер продолжает работать в фоне."
    fi
fi

echo "Можно закрыть окно терминала."
sleep 2
