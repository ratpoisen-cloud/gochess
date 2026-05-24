import sys
import os
import subprocess
import signal
import time
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import streamlit as st

from tools.architect_tool import ArchitectTool
from tools.ollama_tool import OllamaTool, PROVIDERS
from tools.designer_tool import DesignerTool
from orchestrator import check_ollama, check_groq, check_gemini, check_git, check_tsc

PROJECT_DIR = Path(__file__).resolve().parent.parent

st.set_page_config(
    page_title="Poisen Agent Studio",
    layout="wide",
    initial_sidebar_state="expanded", # You can click the arrow to collapse
)

st.markdown("""
<style>
    /* Скрываем только кнопку Deploy и футер */
    footer {visibility: hidden;}
    .stDeployButton {display: none;}

    /* Минималистичный macOS дизайн */
    .stApp { 
        background-color: #050607; 
        color: #e8e8d8;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    
    h1, h2, h3, h4, h5, h6, p, span, label { 
        color: #e8e8d8 !important; 
    }

    /* Стилизация текстового поля */
    .stTextArea textarea { 
        background-color: #0a0c0e !important; 
        color: #e8e8d8 !important; 
        border: 1px solid rgba(163, 193, 143, 0.2) !important; 
        border-radius: 8px !important;
        padding: 12px !important;
        font-size: 14px !important;
    }
    .stTextArea textarea:focus {
        border-color: #a3c18f !important;
        box-shadow: 0 0 0 1px #a3c18f !important;
    }

    /* Стилизация кнопок */
    .stButton > button { 
        width: 100% !important;
        background-color: transparent !important;
        border: 1px solid rgba(163, 193, 143, 0.2) !important;
        color: #e8e8d8 !important;
        border-radius: 8px !important;
        font-weight: 500 !important;
        padding: 8px 16px !important;
        transition: all 0.2s ease !important;
    }
    .stButton > button:hover {
        border-color: #a3c18f !important;
        background-color: rgba(163, 193, 143, 0.1) !important;
    }

    /* Подсвеченные статусы (светящиеся точки) */
    .status-item {
        display: flex;
        align-items: center;
        margin-bottom: 8px;
        font-size: 14px;
        color: rgba(232, 232, 216, 0.8);
    }
    .status-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        margin-right: 12px;
    }
    .dot-green { 
        background-color: #7eb87e; 
        box-shadow: 0 0 8px rgba(126, 184, 126, 0.6); 
    }
    .dot-red { 
        background-color: #c15a5a; 
        box-shadow: 0 0 8px rgba(193, 90, 90, 0.6); 
    }
    .dot-gray { 
        background-color: #555555; 
    }

    /* Разделители */
    hr {
        border-color: rgba(163, 193, 143, 0.1) !important;
        margin: 1.5rem 0 !important;
    }
</style>
""", unsafe_allow_html=True)

if "vite_process" not in st.session_state:
    st.session_state.vite_process = None

providers_order = ["groq", "ollama"]

def status_html(label, is_ok, is_optional=False):
    if is_ok:
        color = "dot-green"
    elif is_optional:
        color = "dot-gray"
    else:
        color = "dot-red"
    return f'<div class="status-item"><span class="status-dot {color}"></span>{label}</div>'

with st.sidebar:
    st.markdown("### Poisen Agent Studio")
    st.markdown("<div style='margin-bottom: 24px; color: rgba(232, 232, 216, 0.5); font-size: 12px;'>Панель управления</div>", unsafe_allow_html=True)

    provider = st.selectbox(
        "Провайдер",
        options=providers_order,
        format_func=lambda x: x.upper(),
        label_visibility="collapsed"
    )
    
    st.markdown("<div style='margin-top: 24px; margin-bottom: 12px; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(232,232,216,0.6);'>Статус системы</div>", unsafe_allow_html=True)
    
    groq_ok = check_groq().startswith("✅")
    st.markdown(status_html("Groq API", groq_ok), unsafe_allow_html=True)

    gemini_ok = check_gemini().startswith("✅")
    st.markdown(status_html("Gemini CLI", gemini_ok), unsafe_allow_html=True)

    git_ok = check_git().startswith("✅")
    st.markdown(status_html("Git", git_ok), unsafe_allow_html=True)

    ollama_ok = check_ollama().startswith("✅")
    st.markdown(status_html("Ollama", ollama_ok, is_optional=(provider != "ollama")), unsafe_allow_html=True)

    st.markdown("<div style='margin-top: 32px; margin-bottom: 12px; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(232,232,216,0.6);'>Локальный сервер</div>", unsafe_allow_html=True)
    
    server_running = st.session_state.vite_process is not None
    server_toggle = st.toggle("Vite Development Server", value=server_running)

    if server_toggle and not server_running:
        with st.spinner("Запуск..."):
            proc = subprocess.Popen(
                ["npm", "run", "dev"],
                cwd=str(PROJECT_DIR),
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            st.session_state.vite_process = proc
            time.sleep(1.5)
            subprocess.Popen(["open", "http://localhost:5173"])
            st.rerun()
    elif not server_toggle and server_running:
        proc = st.session_state.vite_process
        os.kill(proc.pid, signal.SIGTERM)
        st.session_state.vite_process = None
        st.rerun()

    if server_running:
        if st.button("Открыть в браузере", key="open_vite"):
            subprocess.Popen(["open", "http://localhost:5173"])

    st.markdown("<div style='margin-top: 32px; margin-bottom: 12px; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(232,232,216,0.6);'>База данных (Supabase)</div>", unsafe_allow_html=True)
    
    if st.button("Сгенерировать типы TS"):
        with st.spinner("Генерация..."):
            result = subprocess.run(
                ["npx", "supabase", "gen", "types", "--lang=typescript"],
                cwd=str(PROJECT_DIR),
                capture_output=True, text=True, timeout=60,
            )
            if result.returncode == 0:
                st.code(result.stdout, language="typescript")
            else:
                st.error("Ошибка генерации типов")

    if st.button("Синхронизировать БД"):
        with st.spinner("Синхронизация..."):
            result = subprocess.run(
                ["npx", "supabase", "db", "push"],
                cwd=str(PROJECT_DIR),
                capture_output=True, text=True, timeout=120,
            )
            if result.returncode == 0:
                st.success("База данных успешно синхронизирована")
            else:
                st.error("Ошибка синхронизации БД")

    st.markdown("<div style='margin-top: 32px; margin-bottom: 12px; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(232,232,216,0.6);'>GitHub</div>", unsafe_allow_html=True)
    
    commit_msg = st.text_input("Сообщение коммита", placeholder="Update styles...", label_visibility="collapsed")
    if st.button("Сохранить и отправить (Push)"):
        if not commit_msg.strip():
            st.error("Введите сообщение коммита")
        else:
            with st.spinner("Отправка в репозиторий..."):
                try:
                    subprocess.run(["git", "add", "."], cwd=str(PROJECT_DIR), check=True)
                    subprocess.run(["git", "commit", "-m", commit_msg], cwd=str(PROJECT_DIR), check=True)
                    push_res = subprocess.run(["git", "push"], cwd=str(PROJECT_DIR), capture_output=True, text=True)
                    
                    if push_res.returncode == 0:
                        st.success("Изменения успешно отправлены")
                    else:
                        st.error(f"Ошибка Push: {push_res.stderr}")
                except subprocess.CalledProcessError as e:
                    st.error("Нет изменений для коммита или ошибка Git")

st.markdown("<h2 style='font-weight: 600; font-size: 24px; margin-bottom: 4px;'>Конвейер разработки</h2>", unsafe_allow_html=True)
st.markdown("<p style='color: rgba(232, 232, 216, 0.6); margin-bottom: 32px; font-size: 14px;'>Управление задачами и генерацией кода</p>", unsafe_allow_html=True)

task = st.text_area(
    "Задача",
    height=140,
    placeholder="Опишите задачу для архитектора и кодера...",
    label_visibility="collapsed"
)

st.markdown("<div style='margin-top: 32px; margin-bottom: 12px; font-weight: 600;'>💬 Прямой промпт</div>", unsafe_allow_html=True)

direct_prompt = st.text_area(
    "Прямой промпт",
    height=200,
    placeholder="Напиши промпт напрямую для Groq/Ollama...",
    label_visibility="collapsed",
    key="direct_prompt",
)

if st.button("🚀 Отправить промпт", use_container_width=True):
    if not direct_prompt.strip():
        st.error("Введите промпт")
    else:
        with st.spinner(f"Думает {provider.upper()}..."):
            try:
                tool = OllamaTool(provider=provider)
                result = tool.generate(direct_prompt)
                if result:
                    st.markdown("---")
                    st.markdown(result)
                else:
                    st.error("Модель не ответила")
            except Exception as e:
                st.error(f"Ошибка: {e}")

st.divider()

col1, col2, col3 = st.columns(3)

with col1:
    if st.button("Архитектор (План)"):
        if not task.strip():
            st.error("Введите задачу")
        else:
            with st.spinner("Генерация плана..."):
                try:
                    result = ArchitectTool()._run(task)
                    st.markdown(result)
                except Exception as e:
                    st.error(f"Ошибка: {e}")

with col2:
    if st.button("Кодер (Реализация)"):
        plan_path = PROJECT_DIR / ".opencode" / "plan.md"
        if not plan_path.exists():
            st.error("Сначала создайте план")
        else:
            with st.spinner(f"Работает {provider.upper()}..."):
                try:
                    tool = OllamaTool(provider=provider)
                    result = tool.implement_from_plan()
                    st.code(result if result else "Нет ответа", language="text")
                except Exception as e:
                    st.error(f"Ошибка: {e}")

with col3:
    if st.button("Дизайнер (Ревью)"):
        with st.spinner("Проверка дизайна..."):
            try:
                result = DesignerTool()._run()
                st.markdown(result)
            except Exception as e:
                st.error(f"Ошибка: {e}")

st.markdown("<div style='margin-top: 24px;'></div>", unsafe_allow_html=True)

if st.button("Проверить TypeScript"):
    with st.spinner("Проверка типов..."):
        result = check_tsc()
        if "ошибок нет" in result:
            st.success("TypeScript: Ошибок нет")
        else:
            st.error(result)
