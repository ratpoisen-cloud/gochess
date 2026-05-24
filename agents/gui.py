import streamlit as st
import core
import os
from pathlib import Path
import subprocess

# --- CONFIGURATION ---
st.set_page_config(
    page_title="Poisen Agent Studio",
    page_icon="🔘",
    layout="wide",
    initial_sidebar_state="expanded"
)

# --- UTILS ---
def check_groq_status():
    if os.environ.get("GROQ_API_KEY"):
        return True
    env_path = Path(core.PROJECT_DIR) / ".env"
    if env_path.exists():
        content = env_path.read_text()
        if "GROQ_API_KEY=" in content:
            # Проверяем, что значение не пустое
            for line in content.splitlines():
                if line.startswith("GROQ_API_KEY=") and len(line.split("=", 1)[1].strip()) > 5:
                    return True
    return False

# --- MINIMALIST MONOCHROME STYLING ---
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');

    :root {
        --bg-color: #000000;
        --sidebar-bg: #0A0A0A;
        --card-bg: #111111;
        --text-main: #FFFFFF;
        --text-dim: #A0A0A0;
        --border: #222222;
        --accent: #FFFFFF;
        --hover: #1A1A1A;
    }

    .main {
        background-color: var(--bg-color);
        font-family: 'Inter', sans-serif;
        color: var(--text-main);
    }

    section[data-testid="stSidebar"] {
        background-color: var(--sidebar-bg) !important;
        border-right: 1px solid var(--border);
    }

    .card {
        background: var(--card-bg);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 1.5rem;
        height: auto;
        min-height: 280px;
        display: flex;
        flex-direction: column;
    }

    .stButton>button {
        background-color: var(--accent);
        color: #000000;
        border-radius: 4px;
        border: 1px solid var(--accent);
        padding: 0.5rem 1rem;
        font-weight: 500;
        width: 100%;
        transition: all 0.2s ease;
    }

    .stButton>button:hover {
        background-color: #E0E0E0;
    }

    .stTextInput>div>div>input, .stTextArea>div>textarea {
        background-color: #000000 !important;
        border: 1px solid var(--border) !important;
        border-radius: 4px !important;
        color: var(--text-main) !important;
    }

    .status-dot {
        height: 8px;
        width: 8px;
        border-radius: 50%;
        display: inline-block;
        margin-right: 8px;
    }
    .online { background-color: #FFFFFF; box-shadow: 0 0 8px rgba(255,255,255,0.4); }
    .offline { background-color: #333333; }

    .label {
        color: var(--text-dim);
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        margin-bottom: 0.8rem;
        display: block;
    }

    h1, h2, h3 {
        font-weight: 600 !important;
        letter-spacing: -0.02em !important;
    }

    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    header {background-color: transparent !important;}
    
    .block-container {
        padding-top: 1rem !important;
        padding-bottom: 2rem !important;
    }
    </style>
    """, unsafe_allow_html=True)

# --- APP STATE ---
if 'current_plan' not in st.session_state:
    plan_path = Path(core.PROJECT_DIR) / ".opencode" / "plan.md"
    st.session_state.current_plan = plan_path.read_text() if plan_path.exists() else ""

# --- SIDEBAR ---
with st.sidebar:
    st.markdown("<br><h2 style='text-align: center; font-size: 1.2rem;'>POISEN AGENT STUDIO</h2><br>", unsafe_allow_html=True)
    menu = st.radio("Меню", ["Пайплайн", "База данных", "Настройки"], label_visibility="collapsed")
    
    st.divider()
    
    # Кнопка запуска сервера
    server_online = core.check_server_port()
    if not server_online:
        if st.button("🚀 Запустить Dev-сервер"):
            if core.toggle_dev_server():
                st.toast("Запуск сервера...", icon="🚀")
                st.rerun()
            else:
                st.error("Не удалось запустить сервер")
    else:
        st.link_button("🌐 Открыть приложение", "http://localhost:5173/")

    st.markdown("<div style='position: fixed; bottom: 20px; width: 15%;'>", unsafe_allow_html=True)
    st.markdown("<span class='label'>Статус</span>", unsafe_allow_html=True)
    
    from tools.base import find_gemini
    gemini_ok = find_gemini() is not None
    st.markdown(f"<p style='font-size: 0.8rem;'><span class='status-dot {'online' if gemini_ok else 'offline'}'></span>Gemini CLI</p>", unsafe_allow_html=True)
    
    groq_ok = check_groq_status()
    st.markdown(f"<p style='font-size: 0.8rem;'><span class='status-dot {'online' if groq_ok else 'offline'}'></span>Groq Cloud</p>", unsafe_allow_html=True)
    
    st.caption(f"Проект: {os.path.basename(core.PROJECT_DIR)}")
    st.markdown("</div>", unsafe_allow_html=True)

# --- PIPELINE SECTION ---
if menu == "Пайплайн":
    st.markdown("<span class='label' style='margin-bottom: 2rem;'>Конвейер разработки</span>", unsafe_allow_html=True)
    
    # Горизонтальный пайплайн
    step1, step2, step3 = st.columns(3, gap="medium")
    
    with step1:
        st.markdown("<div class='card'>", unsafe_allow_html=True)
        st.markdown("<span class='label'>01. СТРАТЕГИЯ</span>", unsafe_allow_html=True)
        st.caption("Анализ задачи и создание пошагового плана. Использует Gemini для понимания контекста.")
        task = st.text_area("Задача", height=100, placeholder="Что строим?", key="task_input")
        if st.button("Создать план"):
            with st.spinner("Gemini..."):
                plan = core.get_architect_plan(task)
                st.session_state.current_plan = plan
                st.rerun()
        
        if st.session_state.current_plan:
            with st.expander("Открыть план.md", expanded=False):
                st.markdown(st.session_state.current_plan)
        st.markdown("</div>", unsafe_allow_html=True)

    with step2:
        st.markdown("<div class='card'>", unsafe_allow_html=True)
        st.markdown("<span class='label'>02. РЕАЛИЗАЦИЯ</span>", unsafe_allow_html=True)
        st.caption("Написание кода на основе плана. Модель автоматически обновляет файлы проекта.")
        providers = core.get_coder_providers()
        # Определяем индекс Groq для выбора по умолчанию
        provider_list = list(providers.keys())
        default_index = provider_list.index("groq") if "groq" in provider_list else 0
        
        provider = st.selectbox("Модель", options=provider_list, index=default_index, format_func=lambda x: x.upper())
        if st.button("Применить код"):
            if not st.session_state.current_plan:
                st.error("Нужен план")
            elif provider == "groq" and not groq_ok:
                st.error("Ключ Groq не найден.")
            else:
                with st.spinner("Кодинг..."):
                    result = core.run_coder_implementation(provider)
                    st.session_state.last_result = result
                    if result["success"]:
                        st.toast("Готово", icon="✅")
        
        if hasattr(st.session_state, 'last_result'):
            res = st.session_state.last_result
            st.markdown(f"<p style='font-size:0.8rem; color:{'#FFF' if res['tsc_status']=='OK' else '#FF453A'}'>TS: {res['tsc_status']}</p>", unsafe_allow_html=True)
            if res['applied_files']:
                with st.expander("Файлы", expanded=False):
                    st.caption(", ".join(res['applied_files']))
        st.markdown("</div>", unsafe_allow_html=True)

    with step3:
        st.markdown("<div class='card'>", unsafe_allow_html=True)
        st.markdown("<span class='label'>03. КОНТРОЛЬ</span>", unsafe_allow_html=True)
        st.caption("Проверка результата на соответствие дизайну и стандартам качества через Git Diff.")
        if st.button("Ревью дизайна"):
            with st.spinner("Анализ..."):
                review = core.get_designer_review()
                st.session_state.current_review = review
        
        if hasattr(st.session_state, 'current_review'):
            with st.expander("Результат ревью", expanded=True):
                st.markdown(st.session_state.current_review)
        st.markdown("</div>", unsafe_allow_html=True)

# --- DATABASE SECTION ---
elif menu == "База данных":
    st.markdown("<span class='label'>Инфраструктура</span>", unsafe_allow_html=True)
    st.title("Supabase")
    st.markdown("<div class='card'>", unsafe_allow_html=True)
    sql_query = st.text_area("SQL", height=150, placeholder="SELECT...")
    c1, c2 = st.columns([1, 4])
    with c1:
        if st.button("Run"):
            with st.spinner("..."):
                st.session_state.db_res = core.run_direct_sql(sql_query)
    with c2:
        if st.button("Tables"):
            with st.spinner("..."):
                st.session_state.db_res = core.get_supabase_tables()
    
    if hasattr(st.session_state, 'db_res'):
        st.divider()
        st.code(st.session_state.db_res, language="json")
    st.markdown("</div>", unsafe_allow_html=True)

# --- SETTINGS SECTION ---
elif menu == "Настройки":
    st.markdown("<span class='label'>Конфигурация</span>", unsafe_allow_html=True)
    st.title("Настройки")
    st.markdown("<div class='card'>", unsafe_allow_html=True)
    with st.form("setup"):
        u = st.text_input("Supabase URL", value=os.environ.get("VITE_SUPABASE_URL", ""))
        a = st.text_input("Anon Key", type="password", value=os.environ.get("VITE_SUPABASE_ANON_KEY", ""))
        s = st.text_input("Service Role Key", type="password")
        g = st.text_input("Groq API Key", type="password", value=os.environ.get("GROQ_API_KEY", ""))
        if st.form_submit_button("Сохранить"):
            core.save_env_config(u, a, s)
            # Дозаписываем Groq
            with open(Path(core.PROJECT_DIR) / ".env", "a") as f:
                f.write(f"\nGROQ_API_KEY={g}")
            st.success("Сохранено")
            st.rerun()
    st.markdown("</div>", unsafe_allow_html=True)

st.markdown("<br><p style='text-align: center; color: #222; font-size: 0.7rem;'>AI STUDIO v2.1 • MONOCHROME HORIZONTAL</p>", unsafe_allow_html=True)
