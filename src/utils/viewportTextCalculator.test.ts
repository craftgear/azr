import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  calculateCharactersPerLine,
  calculateVisibleLines,
  calculateViewportCapacity,
  measureTextWidth,
  calculateJapaneseCharactersPerLine,
  calculateResponsiveFontSize,
  calculateTotalPages,
  calculateCurrentPage,
  toPixels,
  getRootFontSize
} from './viewportTextCalculator'

describe('viewportTextCalculator', () => {
  describe('toPixels', () => {
    it('should return number value as-is', () => {
      expect(toPixels(16)).toBe(16)
      expect(toPixels(24)).toBe(24)
    })

    it('should convert rem to pixels', () => {
      expect(toPixels({ value: 1, unit: 'rem' }, 16)).toBe(16)
      expect(toPixels({ value: 1.5, unit: 'rem' }, 16)).toBe(24)
      expect(toPixels({ value: 2, unit: 'rem' }, 20)).toBe(40)
    })

    it('should convert em to pixels using parent font size', () => {
      expect(toPixels({ value: 1, unit: 'em' }, 16, 20)).toBe(20)
      expect(toPixels({ value: 1.5, unit: 'em' }, 16, 20)).toBe(30)
      expect(toPixels({ value: 2, unit: 'em' }, 16, 24)).toBe(48)
    })

    it('should use base font size for em when parent not provided', () => {
      expect(toPixels({ value: 1, unit: 'em' }, 16)).toBe(16)
      expect(toPixels({ value: 2, unit: 'em' }, 20)).toBe(40)
    })

    it('should handle px unit', () => {
      expect(toPixels({ value: 24, unit: 'px' })).toBe(24)
      expect(toPixels({ value: 32, unit: 'px' }, 16)).toBe(32)
    })

    it('should default to px when unit not specified', () => {
      expect(toPixels({ value: 24 })).toBe(24)
    })
  })

  describe('getRootFontSize', () => {
    let originalDocument: any
    let originalWindow: any

    beforeEach(() => {
      originalDocument = global.document
      originalWindow = global.window
    })

    afterEach(() => {
      global.document = originalDocument
      global.window = originalWindow
    })

    it('should return 16 when document is undefined', () => {
      global.document = undefined as any
      expect(getRootFontSize()).toBe(16)
    })

    it('should get computed font size from document', () => {
      global.document = {
        documentElement: {} as HTMLElement
      } as Document
      global.window = {
        getComputedStyle: vi.fn().mockReturnValue({
          fontSize: '20px'
        })
      } as any
      
      expect(getRootFontSize()).toBe(20)
    })

    it('should return 16 as fallback for invalid font size', () => {
      global.document = {
        documentElement: {} as HTMLElement
      } as Document
      global.window = {
        getComputedStyle: vi.fn().mockReturnValue({
          fontSize: 'invalid'
        })
      } as any
      
      expect(getRootFontSize()).toBe(16)
    })
  })
  describe('calculateCharactersPerLine', () => {
    it('should calculate characters per line for horizontal mode', () => {
      const result = calculateCharactersPerLine(800, 16, {
        top: 20,
        right: 20,
        bottom: 20,
        left: 20
      })
      // (800 - 20 - 20) / 16 = 760 / 16 = 47.5 → 47
      expect(result).toBe(47)
    })

    it('should handle rem units', () => {
      const result = calculateCharactersPerLine(
        800,
        { value: 1, unit: 'rem' },
        {
          top: { value: 1.25, unit: 'rem' },
          right: { value: 1.25, unit: 'rem' },
          bottom: { value: 1.25, unit: 'rem' },
          left: { value: 1.25, unit: 'rem' }
        },
        0,
        'horizontal',
        16
      )
      // fontSize: 1rem = 16px
      // padding: 1.25rem = 20px each
      // (800 - 20 - 20) / 16 = 47.5 → 47
      expect(result).toBe(47)
    })

    it('should handle em units', () => {
      const result = calculateCharactersPerLine(
        600,
        { value: 1.5, unit: 'em' },
        {
          top: { value: 1, unit: 'em' },
          right: { value: 1, unit: 'em' },
          bottom: { value: 1, unit: 'em' },
          left: { value: 1, unit: 'em' }
        },
        0,
        'horizontal',
        20
      )
      // fontSize: 1.5em * 20 = 30px
      // padding: 1em * 20 = 20px each (uses base font size)
      // (600 - 20 - 20) / 30 = 18.67 → 18
      expect(result).toBe(18)
    })

    it('should calculate characters per line for vertical mode', () => {
      const result = calculateCharactersPerLine(600, 20, {
        top: 10,
        right: 10,
        bottom: 10,
        left: 10
      }, 0, 'vertical')
      // 縦書きでは width - top - bottom
      // (600 - 10 - 10) / 20 = 580 / 20 = 29
      expect(result).toBe(29)
    })

    it('should handle letter spacing', () => {
      const result = calculateCharactersPerLine(500, 20, {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      }, 2)
      // 500 / (20 + 2) = 500 / 22 = 22.7 → 22
      expect(result).toBe(22)
    })

    it('should return 0 for invalid font size', () => {
      const result = calculateCharactersPerLine(800, 0)
      expect(result).toBe(0)
    })

    it('should handle no padding', () => {
      const result = calculateCharactersPerLine(400, 20)
      expect(result).toBe(20)
    })
  })

  describe('calculateVisibleLines', () => {
    it('should calculate visible lines for horizontal mode', () => {
      const result = calculateVisibleLines(600, 24, {
        top: 20,
        right: 20,
        bottom: 20,
        left: 20
      })
      // (600 - 20 - 20) / 24 = 560 / 24 = 23.3 → 23
      expect(result).toBe(23)
    })

    it('should handle rem units', () => {
      const result = calculateVisibleLines(
        600,
        { value: 1.5, unit: 'rem' },
        {
          top: { value: 1.25, unit: 'rem' },
          right: { value: 1.25, unit: 'rem' },
          bottom: { value: 1.25, unit: 'rem' },
          left: { value: 1.25, unit: 'rem' }
        },
        'horizontal',
        16
      )
      // lineHeight: 1.5rem = 24px
      // padding: 1.25rem = 20px each
      // (600 - 20 - 20) / 24 = 23.3 → 23
      expect(result).toBe(23)
    })

    it('should calculate visible lines for vertical mode', () => {
      const result = calculateVisibleLines(800, 30, {
        top: 10,
        right: 10,
        bottom: 10,
        left: 10
      }, 'vertical')
      // 縦書きでは height - left - right
      // (800 - 10 - 10) / 30 = 780 / 30 = 26
      expect(result).toBe(26)
    })

    it('should return 0 for invalid line height', () => {
      const result = calculateVisibleLines(600, 0)
      expect(result).toBe(0)
    })

    it('should handle no padding', () => {
      const result = calculateVisibleLines(480, 24)
      expect(result).toBe(20)
    })
  })

  describe('calculateViewportCapacity', () => {
    it('should calculate total viewport capacity', () => {
      const result = calculateViewportCapacity(
        { width: 800, height: 600 },
        { fontSize: 16, lineHeight: 24 },
        { top: 20, right: 20, bottom: 20, left: 20 }
      )
      
      expect(result.charactersPerLine).toBe(47)
      expect(result.visibleLines).toBe(23)
      expect(result.totalCharacters).toBe(47 * 23)
      expect(result.usableWidth).toBe(760)
      expect(result.usableHeight).toBe(560)
    })

    it('should handle mixed units', () => {
      const result = calculateViewportCapacity(
        { width: 800, height: 600 },
        { 
          fontSize: { value: 1, unit: 'rem' },
          lineHeight: { value: 1.5, unit: 'rem' }
        },
        { 
          top: { value: 2, unit: 'em' },
          right: 20,
          bottom: { value: 2, unit: 'em' },
          left: 20
        },
        'horizontal',
        16
      )
      
      // fontSize: 1rem = 16px
      // lineHeight: 1.5rem = 24px
      // padding top/bottom: 2em * 16 = 32px, left/right: 20px
      expect(result.charactersPerLine).toBe(47) // (800-20-20)/16
      expect(result.visibleLines).toBe(22) // (600-32-32)/24
      expect(result.usableWidth).toBe(760)
      expect(result.usableHeight).toBe(536)
    })

    it('should handle vertical mode', () => {
      const result = calculateViewportCapacity(
        { width: 600, height: 800 },
        { fontSize: 20, lineHeight: 20 },
        { top: 10, right: 10, bottom: 10, left: 10 },
        'vertical'
      )
      
      expect(result.charactersPerLine).toBe(29)
      expect(result.visibleLines).toBe(39)
      expect(result.totalCharacters).toBe(29 * 39)
    })

    it('should handle letter spacing', () => {
      const result = calculateViewportCapacity(
        { width: 500, height: 400 },
        { fontSize: 20, lineHeight: 30, letterSpacing: 2 }
      )
      
      expect(result.charactersPerLine).toBe(22)
      expect(result.visibleLines).toBe(13)
      expect(result.totalCharacters).toBe(22 * 13)
    })
  })

  describe('measureTextWidth', () => {
    let originalDocument: any

    beforeEach(() => {
      originalDocument = global.document
    })

    afterEach(() => {
      global.document = originalDocument
    })

    it('should return estimated width when document is undefined', () => {
      global.document = undefined as any
      const width = measureTextWidth('test', 'sans-serif', 16)
      expect(width).toBe(4 * 16 * 0.5)
    })

    it('should measure text width using canvas', () => {
      const mockContext = {
        font: '',
        measureText: vi.fn().mockReturnValue({ width: 100 })
      }
      
      global.document = {
        createElement: vi.fn().mockReturnValue({
          getContext: vi.fn().mockReturnValue(mockContext)
        })
      } as any
      
      const width = measureTextWidth('test text', 'Arial', 20)
      
      expect(mockContext.font).toBe('20px Arial')
      expect(mockContext.measureText).toHaveBeenCalledWith('test text')
      expect(width).toBe(100)
    })

    it('should handle canvas context failure', () => {
      global.document = {
        createElement: vi.fn().mockReturnValue({
          getContext: vi.fn().mockReturnValue(null)
        })
      } as any
      
      const width = measureTextWidth('test', 'sans-serif', 16)
      expect(width).toBe(4 * 16 * 0.5)
    })
  })

  describe('calculateJapaneseCharactersPerLine', () => {
    it('should calculate Japanese characters per line', () => {
      const result = calculateJapaneseCharactersPerLine(800, 20, {
        top: 20,
        right: 20,
        bottom: 20,
        left: 20
      })
      // (800 - 20 - 20) / 20 = 760 / 20 = 38
      expect(result).toBe(38)
    })

    it('should handle vertical mode', () => {
      const result = calculateJapaneseCharactersPerLine(600, 24, {
        top: 10,
        right: 10,
        bottom: 10,
        left: 10
      }, 'vertical')
      // (600 - 10 - 10) / 24 = 580 / 24 = 24.16 → 24
      expect(result).toBe(24)
    })

    it('should return 0 for invalid font size', () => {
      const result = calculateJapaneseCharactersPerLine(800, 0)
      expect(result).toBe(0)
    })
  })

  describe('calculateResponsiveFontSize', () => {
    it('should calculate font size for target characters', () => {
      const result = calculateResponsiveFontSize(
        { width: 800, height: 600 },
        40,
        { top: 20, right: 20, bottom: 20, left: 20 }
      )
      // (800 - 20 - 20) / 40 = 760 / 40 = 19
      expect(result).toBe(19)
    })

    it('should handle vertical mode', () => {
      const result = calculateResponsiveFontSize(
        { width: 600, height: 800 },
        30,
        { top: 10, right: 10, bottom: 10, left: 10 },
        'vertical'
      )
      // (600 - 10 - 10) / 30 = 580 / 30 = 19.3 → 19
      expect(result).toBe(19)
    })

    it('should return default for invalid target', () => {
      const result = calculateResponsiveFontSize(
        { width: 800, height: 600 },
        0
      )
      expect(result).toBe(16)
    })
  })

  describe('calculateTotalPages', () => {
    it('should calculate total pages', () => {
      const result = calculateTotalPages(1000, 250)
      expect(result).toBe(4)
    })

    it('should round up for partial pages', () => {
      const result = calculateTotalPages(1001, 250)
      expect(result).toBe(5)
    })

    it('should return 0 for invalid characters per page', () => {
      const result = calculateTotalPages(1000, 0)
      expect(result).toBe(0)
    })

    it('should handle exact division', () => {
      const result = calculateTotalPages(1000, 100)
      expect(result).toBe(10)
    })
  })

  describe('calculateCurrentPage', () => {
    it('should calculate current page from scroll position', () => {
      const result = calculateCurrentPage(1500, 600)
      expect(result).toBe(3)
    })

    it('should return page 1 for position 0', () => {
      const result = calculateCurrentPage(0, 600)
      expect(result).toBe(1)
    })

    it('should return 1 for invalid page height', () => {
      const result = calculateCurrentPage(1000, 0)
      expect(result).toBe(1)
    })

    it('should handle exact page boundaries', () => {
      const result = calculateCurrentPage(600, 600)
      expect(result).toBe(2)
    })
  })
})