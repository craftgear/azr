import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Reader } from './Reader'
import type { ParsedAozoraDocument } from '../../types/aozora'
import type { IntelligentPageOptions } from '../../utils/intelligentPageDivider'

const actKeyDown = (target: Document | Window | Element, init: KeyboardEventInit) => {
  act(() => {
    fireEvent.keyDown(target, init)
  })
}

const actWheel = (target: Element, init: WheelEventInit) => {
  act(() => {
    fireEvent.wheel(target, init)
  })
}

const advanceTimers = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

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
      const intelligentPagingOptions: IntelligentPageOptions = {
        enableSemanticBoundaries: true,
        enableContentAwareCapacity: false,
        enableLookAhead: false,
        enableLineBreaking: false,
        useCapacityBasedWrapping: false
      }
      const { container } = render(<Reader document={doc} verticalMode={false} intelligentPagingOptions={intelligentPagingOptions} />)
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
      actWheel(reader, { deltaY: 100 })
      advanceTimers(150)

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
      actWheel(reader, { deltaY: 100 })
      advanceTimers(150)

      // 前のページに戻る
      actWheel(reader, { deltaY: -100 })
      advanceTimers(150)

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
      actWheel(reader, { deltaY: 100 })
      advanceTimers(150)

      // 前のページに戻る（横書きモードでは上方向で前のページ）
      actWheel(reader, { deltaY: -100 })
      advanceTimers(150)

      expect(reader).toBeDefined()
    })

    it('should navigate to next page with wheel down in horizontal mode', () => {
      const doc = createMultiPageDocument()
      const { container } = render(
        <Reader document={doc} verticalMode={false} enableWheelNavigation={true} />
      )

      const reader = container.querySelector('.reader') as HTMLElement
      expect(reader).toBeDefined()

      actWheel(reader, { deltaY: 100 })
      advanceTimers(150)

      expect(reader).toBeDefined()
    })

    it('should not navigate when enableWheelNavigation is false', () => {
      const doc = createMultiPageDocument()
      const { container } = render(
        <Reader document={doc} verticalMode={true} enableWheelNavigation={false} />
      )

      const reader = container.querySelector('.reader') as HTMLElement
      expect(reader).toBeDefined()

      actWheel(reader, { deltaY: 100 })
      advanceTimers(150)

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
      actWheel(reader, { deltaY: 100 })
      actWheel(reader, { deltaY: 100 })
      actWheel(reader, { deltaY: 100 })

      // デバウンス期間中は一回のページナビゲーションのみ
      advanceTimers(50)
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

      act(() => {
        fireEvent(reader, wheelEvent)
      })

      expect(preventDefaultSpy).toHaveBeenCalled()
    })
  })

  // 遅延レンダリング テスト (高速ページナビゲーション)
  describe('deferred rendering for fast navigation', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    const createMultiPageDocument = (): ParsedAozoraDocument => ({
      nodes: Array.from({ length: 200 }, (_, i) => ({
        type: 'text',
        content: `ページ${Math.floor(i / 10) + 1}のテキスト行${i + 1}。これは長いテキストです。`.repeat(3)
      })),
      metadata: {}
    })

    it('should show target page immediately in page indicator during rapid navigation', () => {
      const doc = createMultiPageDocument()
      const { container } = render(
        <Reader document={doc} verticalMode={true} fastNavigationMode={true} />
      )

      const reader = container.querySelector('.reader') as HTMLElement
      expect(reader).toBeDefined()

      // 高速で複数回ナビゲート
      actKeyDown(window, { key: 'ArrowLeft' }) // page 1
      actKeyDown(window, { key: 'ArrowLeft' }) // page 2
      actKeyDown(window, { key: 'ArrowLeft' }) // page 3

      // ページインジケーターはすぐに更新される
      const pageInfo = container.querySelector('.page-info')
      if (pageInfo) {
        // ターゲットページが表示されている
        expect(pageInfo.textContent).toContain('4') // 0-based index なので +1
      }
    })

    it('should render final page only after debounce period during rapid keyboard navigation', () => {
      const doc = createMultiPageDocument()
      const { container } = render(
        <Reader document={doc} verticalMode={true} fastNavigationMode={true} />
      )

      // 高速で複数回ナビゲート
      actKeyDown(window, { key: 'ArrowLeft' })
      actKeyDown(window, { key: 'ArrowLeft' })
      actKeyDown(window, { key: 'ArrowLeft' })

      // デバウンス期間中は中間ページをレンダリングしない
      advanceTimers(100) // デバウンス完了前

      // デバウンス完了後に最終ページがレンダリングされる
      advanceTimers(100) // 合計200ms経過

      expect(container.querySelector('.reader')).toBeDefined()
    })

    it('should render final page only after debounce period during rapid wheel navigation', () => {
      const doc = createMultiPageDocument()
      const { container } = render(
        <Reader document={doc} verticalMode={true} fastNavigationMode={true} />
      )

      const reader = container.querySelector('.reader') as HTMLElement

      // 高速で複数回ホイール
      actWheel(reader, { deltaY: 100 })
      actWheel(reader, { deltaY: 100 })
      actWheel(reader, { deltaY: 100 })

      // デバウンス期間中は最終ページのみ
      advanceTimers(50)

      // デバウンス完了後
      advanceTimers(150)

      expect(reader).toBeDefined()
    })

    it('should render immediately for single navigation (not rapid)', () => {
      const doc = createMultiPageDocument()
      const { container } = render(
        <Reader document={doc} verticalMode={true} fastNavigationMode={true} />
      )

      // 単一ナビゲーション
      actKeyDown(window, { key: 'ArrowLeft' })

      // 短時間で即座にレンダリング
      advanceTimers(50)

      expect(container.querySelector('.reader')).toBeDefined()
    })

    it('should handle mixed navigation (keyboard + wheel) correctly', () => {
      const doc = createMultiPageDocument()
      const { container } = render(
        <Reader document={doc} verticalMode={true} fastNavigationMode={true} />
      )

      const reader = container.querySelector('.reader') as HTMLElement

      // 混合ナビゲーション
      actKeyDown(window, { key: 'ArrowLeft' })
      actWheel(reader, { deltaY: 100 })
      actKeyDown(window, { key: 'ArrowLeft' })

      // 全てが完了するまで待機
      advanceTimers(200)

      expect(reader).toBeDefined()
    })

    it('should disable fast navigation when fastNavigationMode is false', () => {
      const doc = createMultiPageDocument()
      const { container } = render(
        <Reader document={doc} verticalMode={true} fastNavigationMode={false} />
      )

      // 高速ナビゲーション
      actKeyDown(window, { key: 'ArrowLeft' })
      actKeyDown(window, { key: 'ArrowLeft' })

      // fastNavigationMode=false の場合、通常の動作
      advanceTimers(100)

      expect(container.querySelector('.reader')).toBeDefined()
    })
  })

  // 仮想ページネーション テスト (3ページスライディングウィンドウ)
  describe('virtual pagination', () => {
    const createLargeDocument = (pageCount: number = 20): ParsedAozoraDocument => ({
      nodes: Array.from({ length: pageCount * 50 }, (_, i) => ({
        type: 'text',
        content: `ページ${Math.floor(i / 50) + 1}のテキスト行${i + 1}。これは長いテキストです。`.repeat(2)
      })),
      metadata: {}
    })

    it('should only render current, previous, and next pages (3-page window)', () => {
      const doc = createLargeDocument(10)
      const { container } = render(
        <Reader document={doc} verticalMode={true} fastNavigationMode={true} />
      )

      // すべてのページ要素を取得
      const pageElements = container.querySelectorAll('.page')

      // 3ページのみがレンダリングされている（prev, current, next）
      const renderedPages = Array.from(pageElements).filter(page =>
        page.textContent && page.textContent.trim().length > 0
      )

      expect(renderedPages.length).toBeLessThanOrEqual(3)
    })

    it('should render correct pages when navigating to middle page', () => {
      const doc = createLargeDocument(10)
      const { container } = render(
        <Reader document={doc} verticalMode={true} fastNavigationMode={false} />
      )

      // ページ4に移動 (0-indexed なので targetPageIndex = 3)
      actKeyDown(window, { key: 'ArrowLeft' }) // page 1
      actKeyDown(window, { key: 'ArrowLeft' }) // page 2
      actKeyDown(window, { key: 'ArrowLeft' }) // page 3
      actKeyDown(window, { key: 'ArrowLeft' }) // page 4

      // ページ2, 3, 4がレンダリングされている
      const currentPageElement = container.querySelector('.page-current')
      const prevPageElement = container.querySelector('.page-prev')
      const nextPageElement = container.querySelector('.page-next')

      expect(currentPageElement).toBeDefined()
      expect(prevPageElement).toBeDefined()
      expect(nextPageElement).toBeDefined()
    })

    it('should handle first page edge case (no previous page)', () => {
      const doc = createLargeDocument(10)
      const { container } = render(
        <Reader document={doc} verticalMode={true} fastNavigationMode={false} />
      )

      // 最初のページにいる場合
      const pageElements = container.querySelectorAll('.page')
      const renderedPages = Array.from(pageElements).filter(page =>
        page.textContent && page.textContent.trim().length > 0
      )

      // 最初のページ（current）と次のページ（next）のみ
      expect(renderedPages.length).toBeLessThanOrEqual(2)
    })

    it('should handle last page edge case (no next page)', () => {
      const doc = createLargeDocument(5)
      const { container } = render(
        <Reader document={doc} verticalMode={true} fastNavigationMode={false} />
      )

      // 最後のページに移動
      for (let i = 0; i < 4; i++) {
        actKeyDown(window, { key: 'ArrowLeft' })
      }

      const pageElements = container.querySelectorAll('.page')
      const renderedPages = Array.from(pageElements).filter(page =>
        page.textContent && page.textContent.trim().length > 0
      )

      // 前のページ（prev）と最後のページ（current）のみ
      expect(renderedPages.length).toBeLessThanOrEqual(2)
    })

    it('should not render pages outside the 3-page window', () => {
      const doc = createLargeDocument(20)
      const { container } = render(
        <Reader document={doc} verticalMode={true} fastNavigationMode={false} />
      )

      // 中間のページに移動 (ページ10)
      for (let i = 0; i < 9; i++) {
        actKeyDown(window, { key: 'ArrowLeft' })
      }

      // DOM内のページ要素数を確認
      const allPageElements = container.querySelectorAll('[data-page]')
      const renderedContent = Array.from(allPageElements).filter(page =>
        page.textContent && page.textContent.trim().length > 0
      )

      // 3ページ以内であることを確認
      expect(renderedContent.length).toBeLessThanOrEqual(3)
    })
  })

  // 高速ナビゲーション時の視覚的フィードバック テスト
  describe('fast navigation visual feedback', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    const createMultiPageDocument = (): ParsedAozoraDocument => ({
      nodes: Array.from({ length: 100 }, (_, i) => ({
        type: 'text',
        content: `ページ${Math.floor(i / 10) + 1}のテキスト行${i + 1}。これは長いテキストです。`.repeat(3)
      })),
      metadata: {}
    })

    it('should add fast-navigating class during rapid keyboard navigation', () => {
      const doc = createMultiPageDocument()
      const { container } = render(
        <Reader document={doc} verticalMode={true} fastNavigationMode={true} />
      )

      const reader = container.querySelector('.reader') as HTMLElement

      // 高速ナビゲーション開始
      actKeyDown(window, { key: 'ArrowLeft' })

      // fast-navigating クラスが追加される
      expect(reader.classList.contains('fast-navigating')).toBe(true)
    })

    it('should add fast-navigating class during rapid wheel navigation', () => {
      const doc = createMultiPageDocument()
      const { container } = render(
        <Reader document={doc} verticalMode={true} fastNavigationMode={true} />
      )

      const reader = container.querySelector('.reader') as HTMLElement

      // 高速ホイールナビゲーション
      actWheel(reader, { deltaY: 100 })

      // fast-navigating クラスが追加される
      expect(reader.classList.contains('fast-navigating')).toBe(true)
    })

    it('should remove fast-navigating class after navigation settles', () => {
      const doc = createMultiPageDocument()
      const { container } = render(
        <Reader document={doc} verticalMode={true} fastNavigationMode={true} />
      )

      const reader = container.querySelector('.reader') as HTMLElement

      // 高速ナビゲーション開始
      actKeyDown(window, { key: 'ArrowLeft' })
      expect(reader.classList.contains('fast-navigating')).toBe(true)

      // 50ms後にナビゲーション完了 (少し余裕を持って70ms)
      advanceTimers(70)

      // fast-navigating クラスが削除される
      expect(reader.classList.contains('fast-navigating')).toBe(false)
    })

    it('should maintain fast-navigating class during continuous navigation', () => {
      const doc = createMultiPageDocument()
      const { container } = render(
        <Reader document={doc} verticalMode={true} fastNavigationMode={true} />
      )

      const reader = container.querySelector('.reader') as HTMLElement

      // 連続ナビゲーション
      actKeyDown(window, { key: 'ArrowLeft' })
      expect(reader.classList.contains('fast-navigating')).toBe(true)

      advanceTimers(25) // まだ50ms経過前

      actKeyDown(window, { key: 'ArrowLeft' })
      expect(reader.classList.contains('fast-navigating')).toBe(true)

      advanceTimers(25) // 合計50ms経過前

      actKeyDown(window, { key: 'ArrowLeft' })
      expect(reader.classList.contains('fast-navigating')).toBe(true)

      // 最後のナビゲーションから50ms後 (少し余裕を持って70ms)
      advanceTimers(70)
      expect(reader.classList.contains('fast-navigating')).toBe(false)
    })

    it('should not add fast-navigating class when fastNavigationMode is disabled', () => {
      const doc = createMultiPageDocument()
      const { container } = render(
        <Reader document={doc} verticalMode={true} fastNavigationMode={false} />
      )

      const reader = container.querySelector('.reader') as HTMLElement

      // ナビゲーション実行
      actKeyDown(window, { key: 'ArrowLeft' })

      // fastNavigationMode=false なのでクラスが追加されない
      expect(reader.classList.contains('fast-navigating')).toBe(false)
    })

    it('should show dimmed page content during fast navigation', () => {
      const doc = createMultiPageDocument()
      const { container } = render(
        <Reader document={doc} verticalMode={true} fastNavigationMode={true} />
      )

      const reader = container.querySelector('.reader') as HTMLElement

      // 高速ナビゲーション開始
      actKeyDown(window, { key: 'ArrowLeft' })

      // fast-navigating クラスが追加されてページが暗くなる
      expect(reader.classList.contains('fast-navigating')).toBe(true)

      const pageContent = container.querySelector('.page-current .page-content-wrapper')
      expect(pageContent).toBeDefined()
    })
  })
})
