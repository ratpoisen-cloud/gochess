#!/usr/bin/env python3
import sys
import os
import subprocess
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich import box
import questionary

from tools.architect_tool import ArchitectTool
from tools.designer_tool import DesignerTool
from tools.ollama_tool import OllamaTool, PROVIDERS

PROJECT_DIR = "/Users/ratpoisen/Documents/gochess_alternative"
console = Console()

BANNER = """
  ╔══════════════════════════════════════════╗
  ║         🤖 GoChess Agent Team           ║
  ║                                          ║
  ║   🏛️  Architect → 💻 Coder → 🎨 Designer ║
  ║                                          ║
  ║     Ollama + Groq + Gemini CLI           ║
  ╚══════════════════════════════════════════╝
"""

CODER_PROVIDER_VAR = "_LAST_CODER_PROVIDER"

def get_last_provider():
    return os.environ.get(CODER_PROVIDER_VAR, "groq")

PRESS_ENTER = "\n[dim]⏎ Нажми Enter, чтобы продолжить...[/dim]"

def pause():
    if sys.stdin.isatty():
        console.input(PRESS_ENTER)

def check_ollama():
    try:
        import httpx
        resp = httpx.get("http://localhost:11434/api/tags", timeout=5)
        models = resp.json().get("models", [])
        if models:
            return f"✅ Ollama: {models[0]['name']} (+{len(models)-1})"
        return "⚠️  Ollama работает, но нет моделей"
    except Exception:
        return "❌ Ollama не запущен"

def check_groq():
    key = os.environ.get("GROQ_API_KEY")
    if not key:
        try:
            env_path = Path(PROJECT_DIR) / ".env.local"
            for line in env_path.read_text().splitlines() if env_path.exists() else []:
                if line.startswith("GROQ_API_KEY="):
                    key = line.split("=", 1)[1].strip().strip("\"'")
                    break
        except Exception:
            pass
    if key:
        return "✅ Groq: ключ есть"
    return "❌ Groq: нет ключа (GROQ_API_KEY)"

def check_gemini():
    from tools.base import find_gemini
    path = find_gemini()
    return f"✅ Gemini CLI: {path}" if path else "❌ Gemini CLI не найден"

def check_git():
    result = subprocess.run(["git", "status"], capture_output=True, text=True, cwd=PROJECT_DIR)
    return "✅ Git: OK" if result.returncode == 0 else "❌ Git: не в репозитории"

def check_tsc():
    result = subprocess.run(
        ["npx", "tsc", "--noEmit"],
        capture_output=True, text=True, cwd=PROJECT_DIR
    )
    if result.returncode == 0:
        return "✅ TypeScript: ошибок нет"
    errors = (result.stdout + result.stderr)[:500]
    return f"⚠️  TypeScript: {result.returncode} ошибки(ок)\n{errors}"

def show_status():
    console.clear()
    console.print(Panel(BANNER, style="green", box=box.HEAVY))
    t = Table(box=box.SIMPLE, show_header=False)
    t.add_column(style="bold")
    t.add_column()
    t.add_row("🔌 Сервисы:", "")
    t.add_row("", check_ollama())
    t.add_row("", check_groq())
    t.add_row("", check_gemini())
    t.add_row("", check_git())
    t.add_section()
    t.add_row("📦 Проект:", "")
    t.add_row("", check_tsc())
    console.print(t)
    console.print()

def run_architect(task: str):
    console.print("[bold green]🏛️  Архитектор: генерация плана...[/bold green]")
    with console.status("[green]Gemini CLI пишет план...[/green]"):
        result = ArchitectTool()._run(task)
    console.print(f"[green]✅ План готов[/green]")
    plan_path = Path(PROJECT_DIR) / ".opencode" / "plan.md"
    if plan_path.exists():
        console.print(Panel(plan_path.read_text()[:2000], title="plan.md", box=box.HEAVY))
    return result

def run_coder(provider: str | None = None):
    if provider is None:
        provider = get_last_provider()

    cfg = PROVIDERS[provider]
    label = f"{provider.upper()} ({cfg['default_model']})"
    console.print(f"[bold blue]💻 Кодер: реализация через {label}...[/bold blue]")
    tool = OllamaTool(provider=provider)
    with console.status(f"[blue]{provider} генерирует код...[/blue]"):
        result = tool.implement_from_plan()
    if result is None or result.startswith("⚠️"):
        console.print(f"[red]{result}[/red]")
        return result

    applied = tool.apply_code_blocks(result)
    if applied:
        console.print(f"[green]✅ Применено файлов:[/green]")
        for f in applied:
            console.print(f"   📄 {f}")
    else:
        console.print("[yellow]⚠️  Не удалось извлечь файлы из ответа модели[/yellow]")
        console.print(Panel(result[:2000], title="Ответ модели", box=box.HEAVY))

    console.print("\n[bold]🔍 Проверка TypeScript...[/bold]")
    tsc = subprocess.run(
        ["npx", "tsc", "--noEmit"],
        capture_output=True, text=True, cwd=PROJECT_DIR
    )
    if tsc.returncode == 0:
        console.print("[green]✅ TypeScript: ошибок нет[/green]")
    else:
        errors = (tsc.stdout + tsc.stderr)[:2000]
        console.print(f"[red]⚠️  TypeScript: {tsc.returncode} ошибки(ок):[/red]")
        console.print(errors)
    return result

def run_designer():
    console.print("[bold magenta]🎨 Дизайнер: ревью UI...[/bold magenta]")
    with console.status("[magenta]Gemini CLI ревьюит...[/magenta]"):
        result = DesignerTool()._run()
    console.print(f"[green]✅ Ревью готов[/green]")
    review_path = Path(PROJECT_DIR) / ".opencode" / "review.md"
    if review_path.exists():
        console.print(Panel(review_path.read_text()[:2000], title="review.md", box=box.HEAVY))
    return result

def select_provider() -> str:
    provider = questionary.select(
        "Какой провайдер для кода?",
        choices=[
            questionary.Choice(
                title=f"🖥️  Ollama  — {PROVIDERS['ollama']['description']}",
                value="ollama"
            ),
            questionary.Choice(
                title=f"☁️  Groq — {PROVIDERS['groq']['description']}",
                value="groq"
            ),
        ],
        default=get_last_provider(),
        qmark="→"
    ).ask()
    if provider:
        os.environ[CODER_PROVIDER_VAR] = provider
    return provider or "groq"

def run_full_cycle(task: str):
    console.clear()
    console.print(Panel("[bold]🏗️  ПОЛНЫЙ ЦИКЛ: Архитектор → Кодер → Дизайнер[/bold]", box=box.HEAVY, style="green"))
    console.print(f"[white]Задача:[/white] [yellow]{task}[/yellow]\n")

    run_architect(task)
    pause()
    provider = select_provider()
    run_coder(provider)
    pause()
    run_designer()

    console.print(Panel("[bold green]✅ ВСЕ ШАГИ ЗАВЕРШЕНЫ[/bold green]", box=box.HEAVY, style="green"))

def main():
    if len(sys.argv) > 1:
        if any(a.startswith("--") for a in sys.argv[1:]):
            from run import main as run_main
            run_main()
            return
        if not sys.stdin.isatty():
            from run import main as run_main
            run_main()
            return
        task = " ".join(sys.argv[1:])
        run_full_cycle(task)
        return

    while True:
        show_status()

        provider_label = get_last_provider().upper()
        choice = questionary.select(
            "Выбери действие:",
            choices=[
                "🏗️  Полный цикл (Plan → Code → Review)",
                "🏛️  Только Архитектор (план)",
                f"💻  Только Кодер [{provider_label}]",
                "🎨  Только Дизайнер (ревью)",
                "🔍  Проверить TypeScript",
                "👤  Сменить провайдера кода",
                "🌐  Poisen Agent Studio (Web UI)",
                "🚪  Выход",
            ],
            qmark="→"
        ).ask()

        if choice is None or choice == "🚪  Выход":
            console.print("[yellow]До свидания![/yellow]")
            break

        elif choice == "🏗️  Полный цикл (Plan → Code → Review)":
            task = questionary.text("Опиши задачу:").ask()
            if task:
                run_full_cycle(task)

        elif choice == "🏛️  Только Архитектор (план)":
            task = questionary.text("Опиши задачу:").ask()
            if task:
                run_architect(task)
                pause()

        elif choice and choice.startswith("💻  Только Кодер"):
            provider = get_last_provider()
            run_coder(provider)
            pause()

        elif choice == "🎨  Только Дизайнер (ревью)":
            run_designer()
            pause()

        elif choice == "🔍  Проверить TypeScript":
            check_tsc()
            pause()

        elif choice == "👤  Сменить провайдера кода":
            select_provider()
            pause()

        elif choice == "🌐  Poisen Agent Studio (Web UI)":
            console.clear()
            console.print("[bold green]Запуск Poisen Agent Studio... (Streamlit)[/bold green]")
            subprocess.Popen(
                [sys.executable, "-m", "streamlit", "run", "agents/studio_ui.py"],
                cwd=PROJECT_DIR,
            )
            console.print("[dim]Streamlit запущен в фоне. Открой http://localhost:8501[/dim]")
            pause()

if __name__ == "__main__":
    main()
