import subprocess
from pathlib import Path
from .base import GeminiCLITool
from .context import build_system_prompt, PROJECT_DIR

class DesignerTool(GeminiCLITool):
    name: str = "UI Designer"
    description: str = (
        "Проверяет UI-код на соответствие пиксельной монохромной теме. "
        "Анализирует изменения и пишет ревью в .opencode/review.md."
    )

    def _run(self, _=None) -> str:
        git_diff = subprocess.run(
            ["git", "diff", "--name-only"],
            capture_output=True, text=True,
            cwd=PROJECT_DIR
        ).stdout

        changed_files = git_diff.strip() or "нет отслеживаемых изменений (не git?)"

        extra = (
            f"Проверь изменения на соответствие пиксельной монохромной теме.\n\n"
            f"ИЗМЕНЁННЫЕ ФАЙЛЫ:\n{changed_files}\n\n"
            "Напиши ревью в формате:\n"
            "## Ревью дизайна\n"
            "### ✅ Что хорошо\n"
            "### ❌ Что нужно исправить\n"
            "### 💡 Рекомендации\n\n"
            "Сохрани в .opencode/review.md"
        )

        prompt = build_system_prompt(
            role="UI Designer",
            task=extra,
        )

        result = super()._run(prompt)

        review_path = Path(PROJECT_DIR) / ".opencode" / "review.md"
        review_path.parent.mkdir(parents=True, exist_ok=True)
        review_path.write_text(result)

        print(f"\n📝 Ревью сохранено в .opencode/review.md\n")
        return result
