from pathlib import Path

PROJECT_DIR = "/Users/ratpoisen/Documents/gochess_alternative"

CONTEXT_FILES = [
    "GEMINI.md",
    "PROJECT_CONTEXT.md",
    ".opencode/conventions.md",
    ".opencode/lessons.md",
]

LABELS = {
    "GEMINI.md": "ПРАВИЛА ПРОЕКТА (GEMINI.md)",
    "PROJECT_CONTEXT.md": "КОНТЕКСТ ПРОЕКТА (PROJECT_CONTEXT.md)",
    ".opencode/conventions.md": "КОНВЕНЦИИ ПРОЕКТА (conventions.md)",
    ".opencode/lessons.md": "ПРОШЛЫЕ ОШИБКИ (lessons.md)",
}


def build_gemini_context() -> str:
    parts = []
    for rel_path in CONTEXT_FILES:
        full_path = Path(PROJECT_DIR) / rel_path
        if full_path.exists():
            content = full_path.read_text().strip()
            label = LABELS.get(rel_path, rel_path)
            parts.append(f"=== {label} ===\n{content}")
    return "\n\n".join(parts)


def build_system_prompt(role: str, task: str, extra: str = "") -> str:
    context = build_gemini_context()
    lines = [
        f"Ты {role} шахматного приложения GoChess.",
        f"Рабочая директория: {PROJECT_DIR}",
        "",
        context,
    ]
    if extra:
        lines.extend(["", extra])
    lines.extend([
        "",
        "ЗАДАЧА:",
        task,
    ])
    return "\n".join(lines)
