import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Footer from '@/components/Footer'

interface SessionFile {
  name: string
  path: string
}

interface Session {
  timestamp: string
  provider: string
  plan: string
  applied_files: string[]
  tsc_status: string | null
  tsc_detail: string | null
  error: string | null
}

export default function AgentLogsPage() {
  const [sessions, setSessions] = useState<SessionFile[]>([])
  const [selected, setSelected] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/.opencode/sessions/index.json')
      .then((r) => r.json())
      .then((list: SessionFile[]) => {
        setSessions(list)
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [])

  const loadSession = async (name: string) => {
    try {
      const r = await fetch(`/.opencode/sessions/${name}`)
      setSelected(await r.json())
    } catch {
      setSelected(null)
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-bg">
      <header className="px-[var(--space-24)] py-[var(--space-32)] bg-bg">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between">
          <Link to="/">
            <img
              src={`${import.meta.env.BASE_URL || '/'}logo/gochess_wordmark_dark.svg`}
              alt="GoChess"
              className="h-[28px] w-auto"
            />
          </Link>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-[var(--space-24)] py-[var(--space-48)] flex-1 w-full">
        <p className="text-text-secondary text-[var(--font-size-xs)] mb-[var(--space-24)]">
          После каждого запуска агента сессия сохраняется в
          {' '}<code className="text-[var(--accent-brand)]">.opencode/sessions/</code>.
          Если сессии не отображаются — запусти агента (Groq/Ollama) хотя бы один раз.
        </p>

        {loading && (
          <p className="text-text-secondary">Загрузка...</p>
        )}

        {!loading && sessions.length === 0 && (
          <div className="bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-8)] p-[var(--space-24)] text-center">
            <p className="text-text-secondary text-[var(--font-size-sm)] mb-[var(--space-12)]">
              Нет сохранённых сессий
            </p>
            <p className="text-text-secondary text-[var(--font-size-xs)]">
              Запусти <code className="text-[var(--accent-brand)]">python agents/run.py --code</code>
              {' '}чтобы создать первую сессию
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-[var(--space-24)]">
          {sessions.length > 0 && (
            <div className="lg:col-span-1">
              <h2 className="text-[var(--font-size-sm)] font-semibold mb-[var(--space-12)] text-text">
                Сессии
              </h2>
              <div className="space-y-[var(--space-8)]">
                {sessions.map((s) => (
                  <button
                    key={s.name}
                    onClick={() => loadSession(s.name)}
                    className="w-full text-left p-[var(--space-12)] rounded-[var(--radius-8)] border border-[var(--border)] bg-[var(--bg)] text-[var(--font-size-xs)] text-text-secondary hover:border-[var(--accent-brand)] transition-colors"
                  >
                    {s.name.replace('.json', '')}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="lg:col-span-2">
            {selected ? (
              <div className="space-y-[var(--space-16)]">
                <div className="bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-8)] p-[var(--space-20)]">
                  <h2 className="text-[var(--font-size-sm)] font-semibold mb-[var(--space-12)] text-text">
                    Детали сессии
                  </h2>
                  <table className="w-full text-[var(--font-size-xs)]">
                    <tbody>
                      <tr>
                        <td className="text-text-secondary py-1 pr-4 w-[120px]">Время</td>
                        <td className="text-text">{selected.timestamp}</td>
                      </tr>
                      <tr>
                        <td className="text-text-secondary py-1 pr-4">Провайдер</td>
                        <td className="text-text">{selected.provider}</td>
                      </tr>
                      <tr>
                        <td className="text-text-secondary py-1 pr-4">Файлов изменено</td>
                        <td className="text-text">{selected.applied_files.length}</td>
                      </tr>
                      <tr>
                        <td className="text-text-secondary py-1 pr-4">TypeScript</td>
                        <td className={selected.tsc_status === 'ok' ? 'text-[var(--success)]' : 'text-[var(--danger)]'}>
                          {selected.tsc_status === 'ok' ? 'Ошибок нет' : 'Ошибки'}
                        </td>
                      </tr>
                      {selected.error && (
                        <tr>
                          <td className="text-text-secondary py-1 pr-4">Ошибка</td>
                          <td className="text-[var(--danger)]">{selected.error}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {selected.applied_files.length > 0 && (
                  <div className="bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-8)] p-[var(--space-20)]">
                    <h2 className="text-[var(--font-size-sm)] font-semibold mb-[var(--space-12)] text-text">
                      Изменённые файлы
                    </h2>
                    <ul className="space-y-[var(--space-4)]">
                      {selected.applied_files.map((f, i) => (
                        <li key={i} className="text-[var(--font-size-xs)] text-text flex items-center gap-[var(--space-8)]">
                          <span className="text-[var(--accent-brand)]">📄</span>
                          <code className="text-[var(--accent-brand)]">{f}</code>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selected.tsc_detail && selected.tsc_status !== 'ok' && (
                  <div className="bg-[var(--bg)] border border-[var(--danger)] rounded-[var(--radius-8)] p-[var(--space-20)]">
                    <h2 className="text-[var(--font-size-sm)] font-semibold mb-[var(--space-12)] text-[var(--danger)]">
                      Ошибки TypeScript
                    </h2>
                    <pre className="text-[var(--font-size-xs)] text-text-secondary whitespace-pre-wrap font-mono">
                      {selected.tsc_detail}
                    </pre>
                  </div>
                )}

                <div className="bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-8)] p-[var(--space-20)]">
                  <h2 className="text-[var(--font-size-sm)] font-semibold mb-[var(--space-12)] text-text">
                    План
                  </h2>
                  <pre className="text-[var(--font-size-xs)] text-text-secondary whitespace-pre-wrap font-mono max-h-[400px] overflow-y-auto">
                    {selected.plan}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-8)] p-[var(--space-24)] flex items-center justify-center min-h-[300px]">
                <p className="text-text-secondary text-[var(--font-size-sm)]">
                  Выберите сессию слева
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
