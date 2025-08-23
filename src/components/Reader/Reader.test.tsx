import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Reader } from './Reader'
import type { ParsedAozoraDocument } from '../../types/aozora'

describe('Reader', () => {
  it('should show empty state when no document', () => {
    render(<Reader document={null} />)
    expect(screen.getByText('テキストを読み込んでください')).toBeDefined()
  })

  it('should render plain text', () => {
    const doc: ParsedAozoraDocument = {
      nodes: [
        { type: 'text', content: 'これはテストテキストです' }
      ],
      metadata: {}
    }
    render(<Reader document={doc} />)
    expect(screen.getByText('これはテストテキストです')).toBeDefined()
  })

  it('should render ruby text', () => {
    const doc: ParsedAozoraDocument = {
      nodes: [
        { type: 'ruby', base: '団扇', reading: 'うちわ' }
      ],
      metadata: {}
    }
    const { container } = render(<Reader document={doc} />)
    const ruby = container.querySelector('ruby')
    expect(ruby).toBeDefined()
    expect(ruby?.textContent).toContain('団扇')
    expect(ruby?.textContent).toContain('うちわ')
  })

  it('should apply vertical mode class', () => {
    const doc: ParsedAozoraDocument = {
      nodes: [{ type: 'text', content: 'テスト' }],
      metadata: {}
    }
    const { container } = render(<Reader document={doc} verticalMode={true} />)
    expect(container.querySelector('.page-vertical')).toBeDefined()
  })

  it('should apply dark theme class', () => {
    const doc: ParsedAozoraDocument = {
      nodes: [{ type: 'text', content: 'テスト' }],
      metadata: {}
    }
    const { container } = render(<Reader document={doc} theme="dark" />)
    expect(container.querySelector('.page-dark')).toBeDefined()
  })

  it('should apply custom font size', () => {
    const doc: ParsedAozoraDocument = {
      nodes: [{ type: 'text', content: 'テスト' }],
      metadata: {}
    }
    const { container } = render(<Reader document={doc} fontSize={20} />)
    const page = container.querySelector('.page') as HTMLElement
    expect(page?.style.fontSize).toBe('20px')
  })

  it('should render multiple nodes', () => {
    const doc: ParsedAozoraDocument = {
      nodes: [
        { type: 'text', content: '吾輩は' },
        { type: 'ruby', base: '猫', reading: 'ねこ' },
        { type: 'text', content: 'である。' }
      ],
      metadata: {}
    }
    const { container } = render(<Reader document={doc} />)
    const content = container.querySelector('.page-content')
    expect(content?.textContent).toContain('吾輩は')
    expect(container.querySelector('ruby')).toBeDefined()
    expect(content?.textContent).toContain('である。')
  })

  it('should handle newlines in text', () => {
    const doc: ParsedAozoraDocument = {
      nodes: [
        { type: 'text', content: '第一行\n第二行' }
      ],
      metadata: {}
    }
    const { container } = render(<Reader document={doc} />)
    expect(container.querySelector('br')).toBeDefined()
  })
})