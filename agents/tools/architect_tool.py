from pathlib import Path
from .base import GeminiCLITool
from .context import build_system_prompt, PROJECT_DIR

class ArchitectTool(GeminiCLITool):
    name: str = "Architect"
    description: str = (
        "Анализирует задачу и создаёт детальный план разработки. "
        "Сохраняет план в .opencode/plan.md. "
        "Указывает какие файлы менять, порядок действий, архитектурные решения."
    )

    def _run(self, task: str) -> str:
        format_instructions = (
            "НАПИШИ ПЛАН В ФОРМАТЕ:\n"
            "## План\n"
            "### 1. Архитектура\n"
            "(краткое описание решения)\n\n"
            "### 2. Файлы для изменения\n"
            "(список файлов с путями)\n\n"
            "### 3. Порядок действий\n"
            "(пошагово, что делать)\n\n"
            "### 4. Ключевые решения\n"
            "(важные архитектурные моменты)\n\n"
            "### 5. Проверка\n"
            "(что проверить после реализации)"
        )

        prompt = build_system_prompt(
            role="Senior Architect",
            task=task,
            extra=format_instructions,
        )

        result = super()._run(prompt)

        plan_path = Path(PROJECT_DIR) / ".opencode" / "plan.md"
        plan_path.parent.mkdir(parents=True, exist_ok=True)
        plan_path.write_text(result)

        return f"✅ План сохранён в .opencode/plan.md\n\n{result}"
