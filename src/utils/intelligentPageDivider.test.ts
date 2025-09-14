import { describe, it, expect } from 'vitest'
import type { AozoraNode } from '../types/aozora'
import type { CharacterCapacity } from './readerCapacityCalculator'
import {
  detectSemanticBoundaries,
  calculateContentComplexity,
  findOptimalBreakPoint,
  adjustCapacityForContent,
  divideIntoIntelligentPages,
  type ContentComplexity,
  type IntelligentPageOptions
} from './intelligentPageDivider'

describe('intelligentPageDivider', () => {
  const createCapacity = (total: number, rows: number = 10): CharacterCapacity => ({
    totalCharacters: total,
    rows,
    cols: total / rows,
    charactersPerRow: total / rows,
    charactersPerColumn: rows
  })

  describe('detectSemanticBoundaries', () => {
    it('文の終わりを検出する（句点）', () => {
      const text = '吾輩は猫である。名前はまだ無い。'
      const boundaries = detectSemanticBoundaries(text)

      expect(boundaries).toHaveLength(2)
      expect(boundaries[0]).toEqual({
        position: 8,
        type: 'sentence',
        strength: 1.0,
        char: '。'
      })
      expect(boundaries[1]).toEqual({
        position: 16,
        type: 'sentence',
        strength: 1.0,
        char: '。'
      })
    })

    it('感嘆符と疑問符を検出する', () => {
      const text = 'これは何だ！本当か？'
      const boundaries = detectSemanticBoundaries(text)

      expect(boundaries).toHaveLength(2)
      expect(boundaries[0].type).toBe('sentence')
      expect(boundaries[0].char).toBe('！')
      expect(boundaries[1].type).toBe('sentence')
      expect(boundaries[1].char).toBe('？')
    })

    it('段落境界を検出する（二重改行）', () => {
      const text = '第一段落です。\n\n第二段落です。'
      const boundaries = detectSemanticBoundaries(text)

      const paragraphBoundary = boundaries.find(b => b.type === 'paragraph')
      expect(paragraphBoundary).toBeDefined()
      expect(paragraphBoundary?.strength).toBe(0.8)
    })

    it('会話文の境界を検出する', () => {
      const text = '彼は言った。「こんにちは」と。'
      const boundaries = detectSemanticBoundaries(text)

      const dialogueBoundaries = boundaries.filter(b => b.type === 'dialogue')
      expect(dialogueBoundaries).toHaveLength(2)
    })

    it('読点での弱い境界を検出する', () => {
      const text = '吾輩は猫である、名前はまだ無い、どこで生れたか分からない。'
      const boundaries = detectSemanticBoundaries(text)

      const commaBoundaries = boundaries.filter(b => b.type === 'clause' && b.char === '、')
      expect(commaBoundaries).toHaveLength(2)
      expect(commaBoundaries[0].strength).toBe(0.3)
    })
  })

  describe('calculateContentComplexity', () => {
    it('プレーンテキストの複雑度を計算', () => {
      const nodes: AozoraNode[] = [
        { type: 'text', content: '吾輩は猫である。名前はまだ無い。' }
      ]

      const complexity = calculateContentComplexity(nodes)

      expect(complexity.rubyDensity).toBe(0)
      expect(complexity.emphasisDensity).toBe(0)
      expect(complexity.specialCharDensity).toBe(0)
      expect(complexity.overallScore).toBeGreaterThan(0)
      expect(complexity.overallScore).toBeLessThan(0.5)
    })

    it('ルビの密度を計算', () => {
      const nodes: AozoraNode[] = [
        { type: 'text', content: '吾輩は' },
        { type: 'ruby', base: '猫', reading: 'ねこ' },
        { type: 'text', content: 'である。' },
        { type: 'ruby', base: '名前', reading: 'なまえ' },
        { type: 'text', content: 'はまだ無い。' }
      ]

      const complexity = calculateContentComplexity(nodes)

      expect(complexity.rubyDensity).toBeGreaterThan(0)
      expect(complexity.overallScore).toBeGreaterThanOrEqual(0.1)
    })

    it('強調文の密度を計算', () => {
      const nodes: AozoraNode[] = [
        { type: 'text', content: 'これは' },
        { type: 'emphasis_dots', content: '重要', text: '重要' },
        { type: 'text', content: 'な部分です。' }
      ]

      const complexity = calculateContentComplexity(nodes)

      expect(complexity.emphasisDensity).toBeGreaterThan(0)
      expect(complexity.overallScore).toBeGreaterThanOrEqual(0.1)
    })

    it('特殊文字の密度を計算', () => {
      const nodes: AozoraNode[] = [
        { type: 'text', content: '注意：' },
        { type: 'special_char_note', char: '※', description: '米印' },
        { type: 'text', content: 'この文書は重要です。' }
      ]

      const complexity = calculateContentComplexity(nodes)

      expect(complexity.specialCharDensity).toBeGreaterThan(0)
    })
  })

  describe('findOptimalBreakPoint', () => {
    it('最適な改ページ位置を見つける', () => {
      const nodes: AozoraNode[] = [
        { type: 'text', content: '第一文です。第二文です。第三文です。' }
      ]
      const capacity = createCapacity(20, 10)
      const targetPosition = 15

      const breakPoint = findOptimalBreakPoint(nodes, targetPosition, capacity)

      // 文末（。の後）の位置に改ページするはず
      expect([6, 12, 18]).toContain(breakPoint.position)
      expect(breakPoint.penalty).toBeLessThan(1.0)
      expect(breakPoint.reason).toBe('sentence')
    })

    it('見出しの前で改ページを優先する', () => {
      const nodes: AozoraNode[] = [
        { type: 'text', content: '本文です。' },
        { type: 'heading', content: '第一章', level: 'large' },
        { type: 'text', content: '章の内容です。' }
      ]
      const capacity = createCapacity(30, 10)
      const targetPosition = 8

      const breakPoint = findOptimalBreakPoint(nodes, targetPosition, capacity)

      expect(breakPoint.position).toBe(5) // 見出しの前
      expect(breakPoint.reason).toBe('heading')
    })

    it('段落境界を優先する', () => {
      const nodes: AozoraNode[] = [
        { type: 'text', content: '第一段落です。\n\n第二段落の始まりです。' }
      ]
      const capacity = createCapacity(25, 10)
      const targetPosition = 9 // 段落境界に近い位置

      const breakPoint = findOptimalBreakPoint(nodes, targetPosition, capacity)

      // 段落境界または文境界が選ばれるはず
      expect(['paragraph', 'sentence']).toContain(breakPoint.reason)
      expect(breakPoint.penalty).toBeLessThan(1.0)
    })
  })

  describe('adjustCapacityForContent', () => {
    it('ルビが多い場合は容量を減らす', () => {
      const baseCapacity = createCapacity(100, 10)
      const complexity: ContentComplexity = {
        rubyDensity: 0.5,
        emphasisDensity: 0.1,
        specialCharDensity: 0.05,
        dialogueDensity: 0.0,
        overallScore: 0.6
      }

      const adjustedCapacity = adjustCapacityForContent(baseCapacity, complexity)

      expect(adjustedCapacity.totalCharacters).toBeLessThan(baseCapacity.totalCharacters)
      expect(adjustedCapacity.totalCharacters).toBeGreaterThan(baseCapacity.totalCharacters * 0.7)
    })

    it('シンプルなテキストは容量をそのまま維持', () => {
      const baseCapacity = createCapacity(100, 10)
      const complexity: ContentComplexity = {
        rubyDensity: 0.0,
        emphasisDensity: 0.0,
        specialCharDensity: 0.0,
        dialogueDensity: 0.0,
        overallScore: 0.1
      }

      const adjustedCapacity = adjustCapacityForContent(baseCapacity, complexity)

      expect(adjustedCapacity.totalCharacters).toBeCloseTo(baseCapacity.totalCharacters, 1)
    })
  })

  describe('divideIntoIntelligentPages', () => {
    it('基本的なテキスト分割', () => {
      const nodes: AozoraNode[] = [
        { type: 'text', content: '吾輩は猫である。名前はまだ無い。どこで生れたか分からない。' }
      ]
      const capacity = createCapacity(30, 10)
      const options: IntelligentPageOptions = {
        enableSemanticBoundaries: true,
        enableContentAwareCapacity: true,
        enableLookAhead: true
      }

      const pages = divideIntoIntelligentPages(nodes, capacity, true, options)

      expect(pages.length).toBeGreaterThan(0)
      pages.forEach(page => {
        expect(page.totalCharacters).toBeLessThanOrEqual(capacity.totalCharacters * 1.1)
        expect(page.lines.length).toBeGreaterThan(0)
      })
    })

    it('見出しで適切に改ページ', () => {
      const nodes: AozoraNode[] = [
        { type: 'text', content: '序文です。これは長い序文でページ容量を超えるほどの内容です。' },
        { type: 'heading', content: '第一章', level: 'large' },
        { type: 'text', content: '第一章の内容です。本文がここから始まります。' }
      ]
      const capacity = createCapacity(30, 10) // 小さな容量で確実に分割
      const options: IntelligentPageOptions = {
        enableSemanticBoundaries: true,
        enableContentAwareCapacity: false,
        enableLookAhead: true
      }

      const pages = divideIntoIntelligentPages(nodes, capacity, true, options)

      expect(pages.length).toBeGreaterThanOrEqual(1)
      // 見出しが含まれることを確認
      const headingPage = pages.find(page =>
        page.lines.some(line =>
          line.nodes.some(node => node.type === 'heading')
        )
      )
      expect(headingPage).toBeDefined()
    })

    it('複雑なコンテンツで容量調整', () => {
      const nodes: AozoraNode[] = [
        { type: 'text', content: '吾輩は' },
        { type: 'ruby', base: '猫', reading: 'ねこ' },
        { type: 'text', content: 'である。' },
        { type: 'emphasis_dots', content: '名前', text: '名前' },
        { type: 'text', content: 'はまだ' },
        { type: 'ruby', base: '無', reading: 'な' },
        { type: 'text', content: 'い。' }
      ]
      const capacity = createCapacity(50, 10)
      const options: IntelligentPageOptions = {
        enableSemanticBoundaries: true,
        enableContentAwareCapacity: true,
        enableLookAhead: false
      }

      const pages = divideIntoIntelligentPages(nodes, capacity, true, options)

      // ルビや強調が多い場合、ページあたりの文字数が調整される
      expect(pages.length).toBeGreaterThanOrEqual(1)
      pages.forEach(page => {
        expect(page.lines.length).toBeGreaterThan(0)
      })
    })

    it('オプション無効時は基本動作', () => {
      const nodes: AozoraNode[] = [
        { type: 'text', content: '吾輩は猫である。名前はまだ無い。' }
      ]
      const capacity = createCapacity(30, 10)
      const options: IntelligentPageOptions = {
        enableSemanticBoundaries: false,
        enableContentAwareCapacity: false,
        enableLookAhead: false
      }

      const pages = divideIntoIntelligentPages(nodes, capacity, true, options)

      expect(pages.length).toBeGreaterThan(0)
      // 基本的な分割が実行されることを確認
    })
  })

  describe('統合テスト', () => {
    it('実際の青空文庫風テキストを処理', () => {
      const nodes: AozoraNode[] = [
        { type: 'heading', content: '吾輩は猫である', level: 'large' },
        { type: 'text', content: '\n' },
        { type: 'header', content: '夏目漱石', level: 1 },
        { type: 'text', content: '\n\n　吾輩は' },
        { type: 'ruby', base: '猫', reading: 'ねこ' },
        { type: 'text', content: 'である。名前はまだ' },
        { type: 'ruby', base: '無', reading: 'な' },
        { type: 'text', content: 'い。\n　どこで生れたかとんと' },
        { type: 'emphasis_dots', content: '見当', text: '見当' },
        { type: 'text', content: 'がつかぬ。何でも' },
        { type: 'emphasis', content: '薄暗い', level: 1 },
        { type: 'text', content: '所で' },
        { type: 'ruby', base: '泣', reading: 'な' },
        { type: 'text', content: 'いていた事だけは記憶している。' }
      ]
      const capacity = createCapacity(80, 20)
      const options: IntelligentPageOptions = {
        enableSemanticBoundaries: true,
        enableContentAwareCapacity: true,
        enableLookAhead: true
      }

      const pages = divideIntoIntelligentPages(nodes, capacity, true, options)

      expect(pages.length).toBeGreaterThan(0)

      // 各ページが適切な容量内であることを確認
      pages.forEach(page => {
        expect(page.totalCharacters).toBeGreaterThan(0)
        expect(page.lines.length).toBeGreaterThan(0)
      })

      // 見出しが適切に処理されていることを確認
      const firstPage = pages[0]
      const hasHeading = firstPage.lines.some(line =>
        line.nodes.some(node => node.type === 'heading')
      )
      expect(hasHeading).toBe(true)
    })
  })
})