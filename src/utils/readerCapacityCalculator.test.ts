import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getReaderDimensions,
  calculateVerticalCapacity,
  calculateHorizontalCapacity,
  calculateReaderCapacity,
  calculateExactCapacity,
  type ReaderDimensions
} from './readerCapacityCalculator'

describe('readerCapacityCalculator', () => {
  let mockElement: HTMLElement

  beforeEach(() => {
    mockElement = document.createElement('div')
    mockElement.className = 'reader'
    
    // デフォルトのスタイルを設定
    Object.defineProperty(mockElement, 'clientWidth', { value: 800, configurable: true })
    Object.defineProperty(mockElement, 'clientHeight', { value: 600, configurable: true })
    
    // getComputedStyleのモック
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      fontSize: '16px',
      lineHeight: '28.8px', // 16 * 1.8
      paddingTop: '32px',    // 2rem * 16px
      paddingBottom: '32px',
      paddingLeft: '48px',   // 3rem * 16px
      paddingRight: '48px',
      fontFamily: 'sans-serif'
    } as CSSStyleDeclaration)
  })

  describe('getReaderDimensions', () => {
    it('要素から正しく寸法情報を取得する', () => {
      const dimensions = getReaderDimensions(mockElement)
      
      expect(dimensions).toEqual({
        width: 800,
        height: 600,
        fontSize: 16,
        lineHeight: 28.8,
        paddingTop: 32,
        paddingBottom: 32,
        paddingLeft: 48,
        paddingRight: 48
      })
    })

    it('スタイルが未定義の場合はデフォルト値を使用する', () => {
      vi.spyOn(window, 'getComputedStyle').mockReturnValue({} as CSSStyleDeclaration)
      
      const dimensions = getReaderDimensions(mockElement)
      
      expect(dimensions.fontSize).toBe(16)
      expect(dimensions.lineHeight).toBe(28.8) // 16 * 1.8
      expect(dimensions.paddingTop).toBe(0)
      expect(dimensions.paddingBottom).toBe(0)
      expect(dimensions.paddingLeft).toBe(0)
      expect(dimensions.paddingRight).toBe(0)
    })
  })

  describe('calculateVerticalCapacity', () => {
    const dimensions: ReaderDimensions = {
      width: 800,
      height: 600,
      fontSize: 16,
      lineHeight: 28.8,
      paddingTop: 32,
      paddingBottom: 32,
      paddingLeft: 48,
      paddingRight: 48
    }

    it('縦書きモードで正しく文字数を計算する', () => {
      const capacity = calculateVerticalCapacity(dimensions)
      
      // 実際の表示エリア: 幅 = 800 - 48 - 48 = 704, 高さ = 600 - 32 - 32 = 536
      // 1列の幅 = 28.8px, 列数 = floor(704 / 28.8) = 24
      // 1文字の高さ = 16px, 1列の文字数 = floor(536 / 16) = 33
      // 総文字数 = 24 * 33 = 792
      
      expect(capacity.cols).toBe(24)
      expect(capacity.rows).toBe(33)
      expect(capacity.charactersPerColumn).toBe(33)
      expect(capacity.totalCharacters).toBe(792)
    })

    it('異なる文字幅比率で計算する', () => {
      const capacity = calculateVerticalCapacity(dimensions, 0.5)
      
      // 文字幅比率は縦書きモードでは列幅に影響しないため、結果は同じ
      expect(capacity.cols).toBe(24)
      expect(capacity.rows).toBe(33)
      expect(capacity.totalCharacters).toBe(792)
    })
  })

  describe('calculateHorizontalCapacity', () => {
    const dimensions: ReaderDimensions = {
      width: 800,
      height: 600,
      fontSize: 16,
      lineHeight: 28.8,
      paddingTop: 32,
      paddingBottom: 32,
      paddingLeft: 48,
      paddingRight: 48
    }

    it('横書きモードで日本語文字の場合', () => {
      const capacity = calculateHorizontalCapacity(dimensions, 1.0)
      
      // 実際の表示エリア: 幅 = 704, 高さ = 536
      // 1文字の幅 = 16 * 1.0 = 16px, 1行の文字数 = floor(704 / 16) = 44
      // 1行の高さ = 28.8px, 行数 = floor(536 / 28.8) = 18
      // 総文字数 = 44 * 18 = 792
      
      expect(capacity.charactersPerRow).toBe(44)
      expect(capacity.rows).toBe(18)
      expect(capacity.totalCharacters).toBe(792)
    })

    it('横書きモードで英数字の場合', () => {
      const capacity = calculateHorizontalCapacity(dimensions, 0.5)
      
      // 1文字の幅 = 16 * 0.5 = 8px, 1行の文字数 = floor(704 / 8) = 88
      // 行数 = 18（変わらず）
      // 総文字数 = 88 * 18 = 1584
      
      expect(capacity.charactersPerRow).toBe(88)
      expect(capacity.rows).toBe(18)
      expect(capacity.totalCharacters).toBe(1584)
    })
  })

  describe('calculateReaderCapacity', () => {
    it('縦書きモードで日本語文字の場合', () => {
      const capacity = calculateReaderCapacity(mockElement, true, 'japanese')
      
      expect(capacity.cols).toBe(24)
      expect(capacity.rows).toBe(33)
      expect(capacity.totalCharacters).toBe(792)
    })

    it('横書きモードで日本語文字の場合', () => {
      const capacity = calculateReaderCapacity(mockElement, false, 'japanese')
      
      expect(capacity.charactersPerRow).toBe(44)
      expect(capacity.rows).toBe(18)
      expect(capacity.totalCharacters).toBe(792)
    })

    it('横書きモードで英数字の場合', () => {
      const capacity = calculateReaderCapacity(mockElement, false, 'ascii')
      
      expect(capacity.charactersPerRow).toBe(88)
      expect(capacity.rows).toBe(18)
      expect(capacity.totalCharacters).toBe(1584)
    })

    it('横書きモードで混在テキストの場合', () => {
      const capacity = calculateReaderCapacity(mockElement, false, 'mixed')
      
      // 混在の場合は (1.0 + 0.5) / 2 = 0.75
      // 1文字の幅 = 16 * 0.75 = 12px, 1行の文字数 = floor(704 / 12) = 58
      expect(capacity.charactersPerRow).toBe(58)
      expect(capacity.rows).toBe(18)
      expect(capacity.totalCharacters).toBe(1044)
    })
  })

  describe('calculateExactCapacity', () => {
    it('Canvasを使用して実際のテキスト幅を測定する', () => {
      const mockContext = {
        measureText: vi.fn().mockReturnValue({ width: 160 }),
        font: ''
      }
      
      vi.spyOn(document, 'createElement').mockReturnValue({
        getContext: vi.fn().mockReturnValue(mockContext)
      } as any)
      
      const sampleText = '吾輩は猫である'
      const capacity = calculateExactCapacity(mockElement, sampleText, false)
      
      // 160px / 7文字 = 約22.86px/文字
      // 比率 = 22.86 / 16 = 約1.43
      // 1行の文字数 = floor(704 / 22.86) = 30
      expect(capacity.charactersPerRow).toBe(30)
      expect(capacity.rows).toBe(18)
    })

    it('Canvasが使用できない場合は推定値を返す', () => {
      vi.spyOn(document, 'createElement').mockReturnValue({
        getContext: vi.fn().mockReturnValue(null)
      } as any)
      
      const capacity = calculateExactCapacity(mockElement, '吾輩は猫である', true)
      
      // 混在モードのデフォルト値が返される
      expect(capacity.cols).toBe(24)
      expect(capacity.rows).toBe(33)
    })
  })

  describe('実際の使用例', () => {
    it('小さい画面での表示容量', () => {
      Object.defineProperty(mockElement, 'clientWidth', { value: 320 })
      Object.defineProperty(mockElement, 'clientHeight', { value: 480 })
      
      const capacity = calculateReaderCapacity(mockElement, true, 'japanese')
      
      // 実際の表示エリア: 幅 = 320 - 96 = 224, 高さ = 480 - 64 = 416
      // 列数 = floor(224 / 28.8) = 7
      // 1列の文字数 = floor(416 / 16) = 26
      // 総文字数 = 7 * 26 = 182
      
      expect(capacity.cols).toBe(7)
      expect(capacity.rows).toBe(26)
      expect(capacity.totalCharacters).toBe(182)
    })

    it('大きい画面での表示容量', () => {
      Object.defineProperty(mockElement, 'clientWidth', { value: 1920 })
      Object.defineProperty(mockElement, 'clientHeight', { value: 1080 })
      
      const capacity = calculateReaderCapacity(mockElement, true, 'japanese')
      
      // 実際の表示エリア: 幅 = 1920 - 96 = 1824, 高さ = 1080 - 64 = 1016
      // 列数 = floor(1824 / 28.8) = 63
      // 1列の文字数 = floor(1016 / 16) = 63
      // 総文字数 = 63 * 63 = 3969
      
      expect(capacity.cols).toBe(63)
      expect(capacity.rows).toBe(63)
      expect(capacity.totalCharacters).toBe(3969)
    })
  })
})