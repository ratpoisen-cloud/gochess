#!/usr/bin/env python3
import sys
import os
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from tools.architect_tool import ArchitectTool
from tools.designer_tool import DesignerTool
from tools.coder_tool import CoderTool

PROJECT_DIR = "/Users/ratpoisen/Documents/gochess_alternative"

def run_all(task: str, provider: str = "groq"):
    print("\n" + "=" * 60)
    print(f"   🏗️  GoChess Agent Team [{provider.upper()}]")
    print("=" * 60 + "\n")

    print("🟢 Шаг 1/3: Архитектор — генерация плана...")
    ArchitectTool()._run(task)
    print(f"   ✅ План готов: {Path(PROJECT_DIR) / '.opencode' / 'plan.md'}\n")

    print("🟢 Шаг 2/3: Кодер — реализация по плану...")
    result = CoderTool()._run(provider)
    print(f"   {result}\n")

    print("🟢 Шаг 3/3: Дизайнер — ревью UI...")
    review = DesignerTool()._run()
    print(f"   ✅ Ревью готово: {Path(PROJECT_DIR) / '.opencode' / 'review.md'}\n")

    print("=" * 60)
    print("   ✅ ВСЕ ШАГИ ЗАВЕРШЕНЫ")
    print("=" * 60)

def main():
    if len(sys.argv) < 2:
        print("Использование:")
        print("  python agents/run.py \"задача\"           # полный цикл (Groq, по умолч.)")
        print("  python agents/run.py --local \"задача\"   # полный цикл (Ollama local)")
        print("  python agents/run.py --plan \"задача\"    # только архитектор")
        print("  python agents/run.py --code              # только кодер (Groq)")
        print("  python agents/run.py --code --local      # только кодер (Ollama local)")
        print("  python agents/run.py --review            # только дизайнер")
        return

    args = sys.argv[1:]

    if args[0] == "--plan":
        task = " ".join(args[1:]) or "Нет задачи"
        print(ArchitectTool()._run(task))

    elif args[0] == "--code":
        provider = "ollama" if "--local" in args else "groq"
        print(CoderTool()._run(provider))

    elif args[0] == "--review":
        print(DesignerTool()._run())

    elif args[0] == "--local":
        task = " ".join(args[1:]) or "Нет задачи"
        run_all(task, provider="ollama")

    else:
        task = " ".join(args)
        provider = "ollama" if "--local" in args else "groq"
        run_all(task, provider)

if __name__ == "__main__":
    main()
