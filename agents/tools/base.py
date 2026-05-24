import subprocess
import shutil
import os

GEMINI_PATHS = [
    "/Users/ratpoisen/.npm-global/bin/gemini",
    "/usr/local/bin/gemini",
    "/opt/homebrew/bin/gemini",
]

def find_gemini() -> str | None:
    for path in GEMINI_PATHS:
        if os.path.isfile(path) and os.access(path, os.X_OK):
            return path
    return shutil.which("gemini")

class GeminiCLITool:
    name: str = "Gemini CLI"
    description: str = "Вызов Gemini CLI для генерации текста"

    def _run(self, prompt: str) -> str:
        gemini_path = find_gemini()
        if not gemini_path:
            return "Ошибка: gemini CLI не найден. Установи: npm install -g @google-gemini/cli"

        result = subprocess.run(
            [gemini_path, "-p", prompt],
            input="", capture_output=True, text=True, timeout=300,
            cwd="/Users/ratpoisen/Documents/gochess_alternative",
            env={**os.environ, "PATH": f"/Users/ratpoisen/.npm-global/bin:{os.environ.get('PATH', '')}"}
        )
        if result.returncode != 0:
            return f"Ошибка gemini: {result.stderr.strip()}"
        return result.stdout.strip()
