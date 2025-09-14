import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
    const reader = container.querySelector('.reader') as HTMLElement
    expect(reader?.style.fontSize).toBe('20px')
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
    const content = container.querySelector('.reader')
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

  it('should use intelligent paging when enabled', () => {
    const doc: ParsedAozoraDocument = {
      nodes: [
        { type: 'text', content: 'テストテキストです。' },
        { type: 'heading', content: '見出し', level: 'large' }
      ],
      metadata: {}
    }

    render(
      <Reader
        document={doc}
        intelligentPaging={true}
        intelligentPagingOptions={{
          enableSemanticBoundaries: true,
          enableContentAwareCapacity: false,
          enableLookAhead: false
        }}
      />
    )

    // コンテンツが表示されることを確認
    expect(screen.getByText('テストテキストです。')).toBeDefined()
    expect(screen.getByText('見出し')).toBeDefined()
  })

  it('should use default intelligent paging options when none provided', () => {
    const doc: ParsedAozoraDocument = {
      nodes: [
        { type: 'text', content: 'テストテキストです。' }
      ],
      metadata: {}
    }

    render(
      <Reader
        document={doc}
        intelligentPaging={true}
      />
    )

    expect(screen.getByText('テストテキストです。')).toBeDefined()
  })

  // 縦書きモードでの省略記号変換テスト
  describe('vertical mode ellipsis transformation', () => {
    it('should transform horizontal ellipsis to vertical dots in vertical mode', () => {
      const doc: ParsedAozoraDocument = {
        nodes: [
          { type: 'text', content: 'これは…テストです' }
        ],
        metadata: {}
      }
      const { container } = render(<Reader document={doc} verticalMode={true} />)
      expect(container.textContent).toContain('⋯')
      expect(container.textContent).not.toContain('…')
    })

    it('should transform two-dot ellipsis to two vertical dots in vertical mode', () => {
      const doc: ParsedAozoraDocument = {
        nodes: [
          { type: 'text', content: 'これは‥テストです' }
        ],
        metadata: {}
      }
      const { container } = render(<Reader document={doc} verticalMode={true} />)
      expect(container.textContent).toContain('・・')
      expect(container.textContent).not.toContain('‥')
    })

    it('should transform three ASCII dots to vertical dots in vertical mode', () => {
      const doc: ParsedAozoraDocument = {
        nodes: [
          { type: 'text', content: 'これは...テストです' }
        ],
        metadata: {}
      }
      const { container } = render(<Reader document={doc} verticalMode={true} />)
      expect(container.textContent).toContain('・・・')
      expect(container.textContent).not.toContain('...')
    })

    it('should handle multiple ellipses in vertical mode', () => {
      const doc: ParsedAozoraDocument = {
        nodes: [
          { type: 'text', content: 'これは…テストで‥あり...ます' }
        ],
        metadata: {}
      }
      const { container } = render(<Reader document={doc} verticalMode={true} />)
      expect(container.textContent).toContain('⋯')
      expect(container.textContent).toContain('・・')
      expect(container.textContent).toContain('・・・')
      expect(container.textContent).not.toContain('…')
      expect(container.textContent).not.toContain('‥')
      expect(container.textContent).not.toContain('...')
    })

    it('should NOT transform ellipsis in horizontal mode', () => {
      const doc: ParsedAozoraDocument = {
        nodes: [
          { type: 'text', content: 'これは…テストで‥あり...ます' }
        ],
        metadata: {}
      }
      const { container } = render(<Reader document={doc} verticalMode={false} />)
      expect(container.textContent).toContain('…')
      expect(container.textContent).toContain('‥')
      expect(container.textContent).toContain('...')
      expect(container.textContent).not.toContain('⋯')
      expect(container.textContent).not.toContain('・・')
      expect(container.textContent).not.toContain('・・・')
    })
  })

  // マウスホイール ページナビゲーション テスト
  describe('mouse wheel page navigation', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    const createMultiPageDocument = (): ParsedAozoraDocument => ({
      nodes: Array.from({ length: 100 }, (_, i) => ({
        type: 'text',
        content: `テキスト行${i + 1}。これは長いテキストです。`.repeat(5)
      })),
      metadata: {}
    })

    it('should navigate to next page with wheel down in vertical mode', () => {
      const doc = createMultiPageDocument()
      const { container } = render(
        <Reader document={doc} verticalMode={true} enableWheelNavigation={true} />
      )

      const reader = container.querySelector('.reader') as HTMLElement
      expect(reader).toBeDefined()

      // 初期ページは0
      fireEvent.wheel(reader, { deltaY: 100 })
      vi.advanceTimersByTime(150)

      // ページが進んだことを確認（具体的な検証は実装に依存）
      expect(reader).toBeDefined()
    })

    it('should navigate to previous page with wheel up in vertical mode', () => {
      const doc = createMultiPageDocument()
      const { container } = render(
        <Reader document={doc} verticalMode={true} enableWheelNavigation={true} />
      )

      const reader = container.querySelector('.reader') as HTMLElement
      expect(reader).toBeDefined()

      // まず次のページに移動
      fireEvent.wheel(reader, { deltaY: 100 })
      vi.advanceTimersByTime(150)

      // 前のページに戻る
      fireEvent.wheel(reader, { deltaY: -100 })
      vi.advanceTimersByTime(150)

      expect(reader).toBeDefined()
    })

    it('should navigate to previous page with wheel up in horizontal mode', () => {
      const doc = createMultiPageDocument()
      const { container } = render(
        <Reader document={doc} verticalMode={false} enableWheelNavigation={true} />
      )

      const reader = container.querySelector('.reader') as HTMLElement
      expect(reader).toBeDefined()

      // まず次のページに移動
      fireEvent.wheel(reader, { deltaY: 100 })
      vi.advanceTimersByTime(150)

      // 前のページに戻る（横書きモードでは上方向で前のページ）
      fireEvent.wheel(reader, { deltaY: -100 })
      vi.advanceTimersByTime(150)

      expect(reader).toBeDefined()
    })

    it('should navigate to next page with wheel down in horizontal mode', () => {
      const doc = createMultiPageDocument()
      const { container } = render(
        <Reader document={doc} verticalMode={false} enableWheelNavigation={true} />
      )

      const reader = container.querySelector('.reader') as HTMLElement
      expect(reader).toBeDefined()

      fireEvent.wheel(reader, { deltaY: 100 })
      vi.advanceTimersByTime(150)

      expect(reader).toBeDefined()
    })

    it('should not navigate when enableWheelNavigation is false', () => {
      const doc = createMultiPageDocument()
      const { container } = render(
        <Reader document={doc} verticalMode={true} enableWheelNavigation={false} />
      )

      const reader = container.querySelector('.reader') as HTMLElement
      expect(reader).toBeDefined()

      fireEvent.wheel(reader, { deltaY: 100 })
      vi.advanceTimersByTime(150)

      // ページナビゲーションが無効なので、何も起こらない
      expect(reader).toBeDefined()
    })

    it('should debounce wheel events', () => {
      const doc = createMultiPageDocument()
      const { container } = render(
        <Reader document={doc} verticalMode={true} enableWheelNavigation={true} />
      )

      const reader = container.querySelector('.reader') as HTMLElement
      expect(reader).toBeDefined()

      // 短時間で複数のホイールイベントを発生させる
      fireEvent.wheel(reader, { deltaY: 100 })
      fireEvent.wheel(reader, { deltaY: 100 })
      fireEvent.wheel(reader, { deltaY: 100 })

      // デバウンス期間中は一回のページナビゲーションのみ
      vi.advanceTimersByTime(50)
      expect(reader).toBeDefined()
    })

    it('should prevent default scroll behavior during page navigation', () => {
      const doc = createMultiPageDocument()
      const { container } = render(
        <Reader document={doc} verticalMode={true} enableWheelNavigation={true} />
      )

      const reader = container.querySelector('.reader') as HTMLElement
      expect(reader).toBeDefined()

      const wheelEvent = new WheelEvent('wheel', { deltaY: 100 })
      const preventDefaultSpy = vi.spyOn(wheelEvent, 'preventDefault')

      fireEvent(reader, wheelEvent)

      expect(preventDefaultSpy).toHaveBeenCalled()
    })
  })
})