#!/usr/bin/env python3
import sys
from crewai import Agent, Task, Crew, Process
from tools.architect_tool import ArchitectTool
from tools.coder_tool import CoderTool
from tools.designer_tool import DesignerTool

architect = Agent(
    role="Architect",
    goal="Анализировать задачи и создавать детальные планы для GoChess",
    backstory="Senior архитектор с 10+ годами опыта в React/TypeScript. "
              "Специализируюсь на шахматных приложениях и пиксельном дизайне.",
    tools=[ArchitectTool()],
    verbose=True,
)

coder = Agent(
    role="Coder",
    goal="Реализовывать код по плану архитектора через OpenCode desktop",
    backstory="Разработчик GoChess, знающий каждый файл проекта. "
              "Работаю через OpenCode desktop с локальными open-source моделями.",
    tools=[CoderTool()],
    verbose=True,
)

designer = Agent(
    role="UI Designer",
    goal="Проверять UI на соответствие пиксельной монохромной теме",
    backstory="Пиксельный дизайнер, хранитель CSS-переменных и визуальной "
              "консистентности. Слежу за монохромной эстетикой проекта.",
    tools=[DesignerTool()],
    verbose=True,
)

task_input = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "Нет задачи"

analyze = Task(
    description=f"Проанализируй задачу и создай план разработки.\nЗадача: {task_input}",
    agent=architect,
    expected_output="План разработки в .opencode/plan.md",
)

implement = Task(
    description="Реализуй код по плану используя OpenCode desktop",
    agent=coder,
    expected_output="Код написан, TypeScript проверен",
)

review = Task(
    description="Проверь UI на соответствие пиксельной монохромной теме",
    agent=designer,
    expected_output="Ревью дизайна в .opencode/review.md",
)

crew = Crew(
    agents=[architect, coder, designer],
    tasks=[analyze, implement, review],
    process=Process.sequential,
    verbose=True,
)

def run_crew(task_input: str = ""):
    print("\n" + "=" * 60)
    print("   🏗️  CrewAI: GoChess Agent Team")
    print("=" * 60 + "\n")

    analyze.description = f"Проанализируй задачу и создай план разработки.\nЗадача: {task_input}"
    result = crew.kickoff()

    print("\n" + "=" * 60)
    print("   ✅ РАБОТА ЗАВЕРШЕНА")
    print("=" * 60)
    print(f"\n📄 План: .opencode/plan.md")
    print(f"📄 Ревью: .opencode/review.md")
    print(f"\nРезультат:\n{result}")

if __name__ == "__main__":
    run_crew(task_input)
