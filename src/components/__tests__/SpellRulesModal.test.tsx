import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import SpellRulesModal from '@/components/SpellRulesModal'
import { SPELL_DETAILS } from '@/components/board/SpellInfoPanel'
import { SPELL_ORDER } from '@/lib/spellMeta'

describe('SpellRulesModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders nothing while closed', () => {
    render(<SpellRulesModal isOpen={false} onClose={() => {}} />)
    expect(screen.queryByText('Магия: Правила')).toBeNull()
  })

  it('states that taking the king is the only way to win', () => {
    render(<SpellRulesModal isOpen onClose={() => {}} />)
    expect(screen.getByText('Победа — только взятие короля')).toBeTruthy()
    expect(screen.getByText(/единственный способ закончить партию/)).toBeTruthy()
  })

  it('says plainly that check does not exist', () => {
    render(<SpellRulesModal isOpen onClose={() => {}} />)
    expect(screen.getByText('Шаха не существует')).toBeTruthy()
    expect(screen.getByText(/оставляют вашего короля под ударом, разрешены/)).toBeTruthy()
  })

  it('warns that the mine blows on the caster next turn', () => {
    render(<SpellRulesModal isOpen onClose={() => {}} />)
    expect(screen.getByText(/Взрыв срабатывает не под тем, кто наступил/)).toBeTruthy()
  })

  it('lists every spell with its codex description', () => {
    render(<SpellRulesModal isOpen onClose={() => {}} />)
    for (const spell of SPELL_ORDER) {
      expect(screen.getByText(SPELL_DETAILS[spell].name)).toBeTruthy()
      expect(screen.getByText(SPELL_DETAILS[spell].desc)).toBeTruthy()
    }
  })

  it('labels the spell types the way the engine splits them', () => {
    render(<SpellRulesModal isOpen onClose={() => {}} />)
    expect(screen.getAllByText('свободное').length).toBe(3)
    expect(screen.getAllByText('завершает ход').length).toBe(6)
  })

  it('shows charges per colour, not one shared number', () => {
    const { container } = render(<SpellRulesModal isOpen onClose={() => {}} />)
    const text = container.textContent || ''
    // White-only spells have nothing for black, and vice versa.
    expect(text).toContain('чёрным нет')
    expect(text).toContain('белым нет')
    expect(text.match(/заряды:/g)?.length).toBe(9)
  })

  it('dims the spells the other side cannot use', () => {
    const { container } = render(
      <SpellRulesModal isOpen onClose={() => {}} playerColor="w" />
    )
    // Only shadowGrave and mirage are black-only, so two tiles dim for white.
    expect(container.querySelectorAll('.opacity-45').length).toBe(2)
  })

  it('dims nothing when no colour is known', () => {
    const { container } = render(<SpellRulesModal isOpen onClose={() => {}} />)
    expect(container.querySelectorAll('.opacity-45').length).toBe(0)
  })

  it('closes from the button', () => {
    const onClose = vi.fn()
    render(<SpellRulesModal isOpen onClose={onClose} />)
    fireEvent.click(screen.getByText('Понятно'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})