import subprocess
import shutil
import os
import signal
from pathlib import Path

# Глобальная переменная для хранения процесса сервера
_dev_server_process = None

def toggle_dev_server() -> bool:
    """Запускает или останавливает dev-сервер (npm run dev)"""
    global _dev_server_process
    
    # Проверяем, не запущен ли он уже (по порту 5173 для Vite)
    import socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    result = sock.connect_ex(('127.0.0.1', 5173))
    sock.close()
    
    if result == 0:
        # Порт занят, сервер запущен. 
        # В рамках этого демо-оркестратора мы просто сообщим что он онлайн.
        return True
    
    try:
        # Запускаем в фоновом режиме
        _dev_server_process = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=PROJECT_DIR,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            preexec_fn=os.setsid # Чтобы процесс не умер вместе с оркестратором
        )
        return True
    except Exception:
        return False

def check_server_port() -> bool:
    """Проверяет, отвечает ли порт 5173"""
    import socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(0.5)
    result = sock.connect_ex(('127.0.0.1', 5173))
    sock.close()
    return result == 0

from tools.base import find_gemini
from tools.architect_tool import ArchitectTool
from tools.designer_tool import DesignerTool
from tools.ollama_tool import OllamaTool, PROVIDERS

PROJECT_DIR = "/Users/ratpoisen/Documents/gochess_alternative"

def get_coder_providers():
    return PROVIDERS

def run_coder_implementation(provider: str) -> dict:
    """Запускает реализацию кода через выбранного провайдера (Ollama/Groq)"""
    try:
        tool = OllamaTool(provider=provider)
        code_output = tool.implement_from_plan()
        
        if code_output.startswith("⚠️"):
            return {"success": False, "message": code_output}
            
        applied_files = tool.apply_code_blocks(code_output)
        
        # Проверка TS
        tsc_result = subprocess.run(
            ["npx", "tsc", "--noEmit"],
            capture_output=True, text=True, cwd=PROJECT_DIR
        )
        
        return {
            "success": True, 
            "applied_files": applied_files,
            "tsc_status": "OK" if tsc_result.returncode == 0 else "Errors Found",
            "tsc_output": tsc_result.stdout[:2000] if tsc_result.returncode != 0 else ""
        }
    except Exception as e:
        return {"success": False, "message": str(e)}

def run_gemini(prompt: str) -> str:
    gemini_path = find_gemini()
    if not gemini_path:
        return "Ошибка: gemini CLI не найден. Установи: npm install -g @google-gemini/cli"

    # Добавляем инструкцию, чтобы Gemini не пытался использовать инструменты, 
    # а просто возвращал текст плана или ревью.
    system_instruction = "Ты — специализированный модуль генерации текста. НЕ используй инструменты (read_file, write_file и т.д.). Просто верни запрошенный текст в формате Markdown."
    full_prompt = f"{system_instruction}\n\nЗАДАЧА:\n{prompt}"

    try:
        result = subprocess.run(
            [gemini_path, "-p", full_prompt],
            input="", capture_output=True, text=True, timeout=300,
            cwd=PROJECT_DIR,
            env={**os.environ, "PATH": f"/Users/ratpoisen/.npm-global/bin:{os.environ.get('PATH', '')}"}
        )
        if result.returncode != 0:
            return f"Ошибка gemini: {result.stderr.strip()}"
        return result.stdout.strip()
    except subprocess.TimeoutExpired:
        return "Ошибка: Превышено время ожидания (300 сек). Gemini не ответил вовремя."
    except Exception as e:
        return f"Критическая ошибка: {str(e)}"

def get_supabase_tables() -> str:
    """Получает список таблиц напрямую через SQL запрос"""
    sql = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
    return run_direct_sql(sql)

def run_direct_sql(sql: str) -> str:
    """Выполняет SQL запрос через функцию exec_sql в Supabase"""
    import json
    env_path = Path(PROJECT_DIR) / ".env"
    config = {}
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                config[k.strip()] = v.strip()
    
    url = config.get("SUPABASE_URL")
    key = config.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        return "Ошибка: Ключи не найдены в .env."

    try:
        # Вызываем нашу новую RPC функцию exec_sql
        payload = json.dumps({"query": sql})
        cmd = [
            "curl", "-s",
            "-X", "POST", f"{url}/rest/v1/rpc/exec_sql",
            "-H", f"apikey: {key}",
            "-H", f"Authorization: Bearer {key}",
            "-H", "Content-Type: application/json",
            "-d", payload
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        # Пытаемся красиво отформатировать JSON
        try:
            data = json.loads(result.stdout)
            return json.dumps(data, indent=2, ensure_ascii=False)
        except:
            return result.stdout.strip() or "Запрос выполнен (нет данных)"
            
    except Exception as e:
        return f"Ошибка при выполнении запроса: {str(e)}"

def get_architect_plan(task: str) -> str:
    """Генерирует архитектурный план"""
    from tools.context import build_gemini_context

    tables = get_supabase_tables()
    context = build_gemini_context()
    
    prompt = f"""Ты Senior Architect шахматного приложения GoChess.
Рабочая директория: {PROJECT_DIR}

{context}

ТЕКУЩАЯ СХЕМА БД:
{tables}

ЗАДАЧА:
{task}

Создай детальный план в .opencode/plan.md.

ФОРМАТ ПЛАНА:
## План
### 1. Архитектура
### 2. Файлы для изменения
### 3. Порядок действий
### 4. Ключевые решения
### 5. Проверка
"""
    result = run_gemini(prompt)
    
    plan_path = Path(PROJECT_DIR) / ".opencode" / "plan.md"
    plan_path.parent.mkdir(parents=True, exist_ok=True)
    plan_path.write_text(result)
    return result

def get_designer_review() -> str:
    """Генерирует ревью дизайна по git diff"""
    from tools.context import build_gemini_context

    git_diff = subprocess.run(
        ["git", "diff", "--name-only"],
        capture_output=True, text=True,
        cwd=PROJECT_DIR
    ).stdout

    changed_files = git_diff.strip() or "нет отслеживаемых изменений"
    context = build_gemini_context()
    
    prompt = f"""Ты UI Designer шахматного приложения GoChess.
Рабочая директория: {PROJECT_DIR}

{context}

Проверь изменения на соответствие пиксельной монохромной теме.

ИЗМЕНЁННЫЕ ФАЙЛЫ:
{changed_files}

Напиши ревью в формате:
## Ревью дизайна
### ✅ Что хорошо
### ❌ Что нужно исправить
### 💡 Рекомендации

Сохрани в .opencode/review.md
"""
    result = run_gemini(prompt)
    
    review_path = Path(PROJECT_DIR) / ".opencode" / "review.md"
    review_path.parent.mkdir(parents=True, exist_ok=True)
    review_path.write_text(result)
    return result

def save_env_config(url: str, anon_key: str, secret_key: str) -> bool:
    """Сохраняет все ключи в .env файл и очищает URL"""
    # Очистка URL от хвостиков
    clean_url = url.split("/rest/v1")[0].rstrip("/")
    
    env_content = f"""# Supabase Configuration
VITE_SUPABASE_URL={clean_url}
VITE_SUPABASE_ANON_KEY={anon_key}

# Backend / Orchestrator Keys
SUPABASE_URL={clean_url}
SUPABASE_ANON_KEY={anon_key}
SUPABASE_SERVICE_ROLE_KEY={secret_key}
SUPABASE_PUBLISHABLE_KEY={secret_key}  # Для совместимости с MCP
"""
    try:
        env_path = Path(PROJECT_DIR) / ".env"
        env_path.write_text(env_content)
        return True
    except Exception:
        return False

def check_direct_connection() -> dict:
    """Проверяет связь напрямую через curl (без MCP)"""
    import json
    env_path = Path(PROJECT_DIR) / ".env"
    if not env_path.exists():
        return {"success": False, "message": "Файл .env не найден"}
    
    # Загрузка ключей из .env
    config = {}
    for line in env_path.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            config[k.strip()] = v.strip()
    
    url = config.get("SUPABASE_URL")
    key = config.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        return {"success": False, "message": "Ключи не найдены в .env"}

    # Тестовый запрос к OpenAPI спецификации Supabase
    try:
        cmd = [
            "curl", "-s", "-o", "/dev/null", "-w", "%{http_code}",
            "-X", "GET", f"{url}/rest/v1/",
            "-H", f"apikey: {key}",
            "-H", f"Authorization: Bearer {key}"
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        status_code = result.stdout.strip()
        
        if status_code == "200":
            return {"success": True, "message": "Прямое соединение с Supabase API установлено!"}
        else:
            return {"success": False, "message": f"Ошибка соединения: HTTP {status_code}"}
    except Exception as e:
        return {"success": False, "message": f"Ошибка при выполнении проверки: {str(e)}"}
