import httpx
import os
import re
import json
import subprocess
from datetime import datetime
from pathlib import Path

PROJECT_DIR = "/Users/ratpoisen/Documents/gochess_alternative"

SESSIONS_DIR = Path(PROJECT_DIR) / ".opencode" / "sessions"
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)

PROVIDERS = {
    "ollama": {
        "base_url": os.environ.get("OLLAMA_HOST", "http://localhost:11434"),
        "default_model": "qwen2.5-coder:1.5b",
        "needs_key": False,
        "description": "Локально (Ollama) — бесплатно, слабее",
    },
    "groq": {
        "base_url": "https://api.groq.com/openai/v1",
        "default_model": "qwen/qwen3-32b",
        "needs_key": True,
        "description": "Облачно (Groq) — бесплатно, Qwen3 32B",
    },
}


class OllamaTool:
    def __init__(self, provider: str = "ollama", model: str | None = None):
        if provider not in PROVIDERS:
            raise ValueError(f"Неизвестный провайдер: {provider}. Доступны: {list(PROVIDERS.keys())}")

        cfg = PROVIDERS[provider]
        self.provider = provider
        self.base_url = cfg["base_url"].rstrip("/")
        self.model = model or cfg["default_model"]
        self.api_key = None

        if cfg["needs_key"]:
            self.api_key = os.environ.get("GROQ_API_KEY") or self._load_from_env()
            if not self.api_key:
                raise ValueError(
                    f"GROQ_API_KEY не найден. Добавь в .env.local:\n"
                    f"GROQ_API_KEY=твой_ключ"
                )

    def _load_from_env(self) -> str | None:
        for env_file in [".env", ".env.local"]:
            env_path = Path(PROJECT_DIR) / env_file
            if env_path.exists():
                for line in env_path.read_text().splitlines():
                    if line.startswith("GROQ_API_KEY="):
                        return line.split("=", 1)[1].strip().strip("\"'")
        return None

    def _call(self, messages: list[dict], system: str | None = None) -> str | None:
        if system:
            messages = [{"role": "system", "content": system}] + messages

        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.2,
        }

        if self.provider == "ollama":
            payload["stream"] = False
            payload["options"] = {"num_ctx": 32768}
            url = f"{self.base_url}/api/chat"
        else:
            payload["max_completion_tokens"] = 4096
            url = f"{self.base_url}/chat/completions"

        try:
            import json as _json
            print(f"[Groq Debug] POST {url}, size={len(_json.dumps(payload))} bytes, follow_redirects=False")
            resp = httpx.request("POST", url, json=payload, headers=headers, timeout=300, follow_redirects=False)
            resp.raise_for_status()
            data = resp.json()

            if self.provider == "ollama":
                return data.get("message", {}).get("content")
            else:
                return data.get("choices", [{}])[0].get("message", {}).get("content")

        except httpx.HTTPError as e:
            return f"[{self.provider} HTTP Error] {e}"
        except Exception as e:
            return f"[{self.provider} Error] {e}"

    def generate(self, prompt: str, system: str | None = None) -> str | None:
        return self._call([{"role": "user", "content": prompt}], system)

    def _get_repo_map(self) -> str:
        src = Path(PROJECT_DIR) / "src"
        files = []
        for p in sorted(src.rglob("*")):
            if p.is_file() and p.suffix in (".ts", ".tsx", ".css"):
                rel = p.relative_to(PROJECT_DIR)
                files.append(f"  {rel}")
        return "## Структура src/:\n" + "\n".join(files)

    def _build_context(self, plan: str) -> str:
        parts = []

        conv_path = Path(PROJECT_DIR) / ".opencode" / "conventions.md"
        if conv_path.exists():
            parts.append(conv_path.read_text())

        lessons_path = Path(PROJECT_DIR) / ".opencode" / "lessons.md"
        if lessons_path.exists():
            parts.append(lessons_path.read_text())

        repo_map = self._get_repo_map()
        parts.append(repo_map)

        parts.append(f"## План разработки:\n{plan}")

        return "\n\n---\n\n".join(parts)

    def _save_session(self, session: dict):
        ts = datetime.now().strftime("%Y-%m-%d-%H%M%S")
        filename = f"{ts}.json"
        path = SESSIONS_DIR / filename
        path.write_text(json.dumps(session, ensure_ascii=False, indent=2))

        index_path = SESSIONS_DIR / "index.json"
        existing = []
        if index_path.exists():
            try:
                existing = json.loads(index_path.read_text())
            except (json.JSONDecodeError, Exception):
                existing = []
        existing.insert(0, {"name": filename, "path": f".opencode/sessions/{filename}"})
        index_path.write_text(json.dumps(existing, ensure_ascii=False, indent=2))

        return str(path)

    def implement_from_plan(self) -> str:
        plan_path = Path(PROJECT_DIR) / ".opencode" / "plan.md"
        if not plan_path.exists():
            return "⚠️ Нет плана. Сначала запусти Архитектора."

        plan = plan_path.read_text()
        model_display = f"{self.provider}/{self.model}"

        context = self._build_context(plan)

        system = (
            "Ты Senior Fullstack разработчик React + TypeScript + Tailwind CSS.\n"
            "Твоя задача — реализовать план разработки шахматного приложения GoChess.\n"
            "Ниже — полный контекст проекта: конвенции, уроки из прошлых ошибок, "
            "структура файлов и план разработки.\n"
            "СТРОГО соблюдай все правила. Не повторяй прошлых ошибок.\n"
            "Пиши ТОЛЬКО код. Без комментариев и пояснений в ответе.\n"
            "Формат для каждого файла:\n"
            "```file:src/путь/к/файлу.tsx\nкод файла\n```"
        )

        prompt = (
            f"{context}\n\n"
            "Верни полный код всех изменяемых файлов в формате ```file:src/путь/к/файлу```."
        )

        session = {
            "timestamp": datetime.now().isoformat(),
            "provider": model_display,
            "plan": plan,
            "context_preview": context[:500],
            "response": None,
            "applied_files": [],
            "tsc_status": None,
            "error": None,
        }

        result = self.generate(prompt, system)
        if result is None:
            session["error"] = "Модель не ответила"
            self._save_session(session)
            return "❌ Модель не ответила"
        if result.startswith("[") and "Error" in result:
            session["error"] = result
            self._save_session(session)
            return f"⚠️ {model_display}: {result}"

        session["response"] = result

        applied = self.apply_code_blocks(result)
        session["applied_files"] = applied

        tsc = subprocess.run(
            ["npx", "tsc", "--noEmit"],
            capture_output=True, text=True,
            cwd=PROJECT_DIR
        )
        if tsc.returncode == 0:
            tsc_status = "ok"
            tsc_detail = "Ошибок нет"
        else:
            tsc_status = "error"
            tsc_detail = (tsc.stdout + tsc.stderr)[:2000]
        session["tsc_status"] = tsc_status
        session["tsc_detail"] = tsc_detail

        log_path = self._save_session(session)

        latest_path = SESSIONS_DIR / "latest.json"
        latest_path.write_text(json.dumps(session, ensure_ascii=False, indent=2))

        output = f"✅ {model_display}: применено {len(applied)} файлов\n"
        for f in applied:
            output += f"   📄 {f}\n"
        if tsc.returncode == 0:
            output += "✅ TypeScript: ошибок нет"
        else:
            output += f"⚠️ TypeScript: {tsc.returncode} ошибки(ок)"
        output += f"\n📋 Лог сессии: {log_path}"

        return output

    def apply_code_blocks(self, text: str) -> list[str]:
        pattern = r"```file:([^\n]+)\n(.*?)```"
        matches = re.findall(pattern, text, re.DOTALL)
        applied = []
        for filepath, code in matches:
            full_path = Path(PROJECT_DIR) / filepath.lstrip("/")
            full_path.parent.mkdir(parents=True, exist_ok=True)
            full_path.write_text(code.strip())
            applied.append(filepath)
        return applied
