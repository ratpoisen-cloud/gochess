from .ollama_tool import OllamaTool


class CoderTool:
    name: str = "Coder"
    description: str = "Реализует план через Ollama или Groq. Логирует сессию в .opencode/sessions/."

    def _run(self, provider: str = "ollama") -> str:
        tool = OllamaTool(provider=provider)
        return tool.implement_from_plan()
