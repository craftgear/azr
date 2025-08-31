import { describe, it, expect } from 'vitest'
import {
  extractTextFromNode,
  countCharacters,
  normalizeLineCount,
  splitIntoLines,
  divideIntoPages,
  getNodesFromPage,
  type Line,
  type Page
} from './pageDivider'
import type { AozoraNode } from '../types/aozora'
import type { CharacterCapacity } from './readerCapacityCalculator'

describe('pageDivider', () => {
  describe('extractTextFromNode', () => {
    it('プレーンテキストから文字を抽出', () => {
      const node: AozoraNode = { type: 'text', content: '吾輩は猫である' }
      expect(extractTextFromNode(node)).toBe('吾輩は猫である')
    })

    it('ルビテキストから基底文字のみ抽出', () => {
      const node: AozoraNode = { type: 'ruby', base: '猫', reading: 'ねこ' }
      expect(extractTextFromNode(node)).toBe('猫')
    })

    it('傍点付きテキストから文字を抽出', () => {
      const node: AozoraNode = { 
        type: 'emphasis_dots', 
        content: '重要',
        text: '重要' 
      }
      expect(extractTextFromNode(node)).toBe('重要')
    })

    it('見出しから文字を抽出', () => {
      const node: AozoraNode = { 
        type: 'heading', 
        content: '第一章',
        level: 'large' 
      }
      expect(extractTextFromNode(node)).toBe('第一章')
    })

    it('テキストサイズ変更ノードから再帰的に抽出', () => {
      const node: AozoraNode = {
        type: 'text_size',
        size: 'large',
        content: [
          { type: 'text', content: '大きい' },
          { type: 'ruby', base: '文字', reading: 'もじ' }
        ]
      }
      expect(extractTextFromNode(node)).toBe('大きい文字')
    })

    it('ブロック字下げから再帰的に抽出', () => {
      const node: AozoraNode = {
        type: 'block_indent',
        indent: 2,
        content: [
          { type: 'text', content: '字下げ' },
          { type: 'text', content: 'テキスト' }
        ]
      }
      expect(extractTextFromNode(node)).toBe('字下げテキスト')
    })

    it('特殊文字注記から文字を抽出', () => {
      const node: AozoraNode = {
        type: 'special_char_note',
        char: '※',
        description: '米印'
      }
      expect(extractTextFromNode(node)).toBe('※')
    })
  })

  describe('countCharacters', () => {
    it('通常のテキストの文字数をカウント', () => {
      expect(countCharacters('吾輩は猫である')).toBe(7)
    })

    it('改行を除いてカウント', () => {
      expect(countCharacters('吾輩は\n猫である')).toBe(7)
      expect(countCharacters('一行目\n二行目\n三行目')).toBe(9)
    })

    it('空文字列は0を返す', () => {
      expect(countCharacters('')).toBe(0)
    })

    it('改行のみの文字列は0を返す', () => {
      expect(countCharacters('\n\n\n')).toBe(0)
    })
  })

  describe('normalizeLineCount', () => {
    const rowsPerColumn = 10

    it('文字数が行数未満の場合は行数を返す', () => {
      expect(normalizeLineCount(5, rowsPerColumn)).toBe(10)
      expect(normalizeLineCount(9, rowsPerColumn)).toBe(10)
    })

    it('文字数が行数と同じ場合は行数を返す', () => {
      expect(normalizeLineCount(10, rowsPerColumn)).toBe(10)
    })

    it('文字数が行数より多い場合は切り上げて行数を掛ける', () => {
      expect(normalizeLineCount(11, rowsPerColumn)).toBe(20)  // ceil(11/10) * 10 = 2 * 10
      expect(normalizeLineCount(15, rowsPerColumn)).toBe(20)  // ceil(15/10) * 10 = 2 * 10
      expect(normalizeLineCount(20, rowsPerColumn)).toBe(20)  // ceil(20/10) * 10 = 2 * 10
      expect(normalizeLineCount(21, rowsPerColumn)).toBe(30)  // ceil(21/10) * 10 = 3 * 10
    })

    it('0文字の場合は0を返す', () => {
      expect(normalizeLineCount(0, rowsPerColumn)).toBe(0)
    })
  })

  describe('splitIntoLines', () => {
    it('改行で行を分割', () => {
      const nodes: AozoraNode[] = [
        { type: 'text', content: '一行目\n二行目\n三行目' }
      ]
      
      const lines = splitIntoLines(nodes)
      
      expect(lines).toHaveLength(3)
      expect(lines[0].text).toBe('一行目')
      expect(lines[0].characterCount).toBe(3)
      expect(lines[1].text).toBe('二行目')
      expect(lines[1].characterCount).toBe(3)
      expect(lines[2].text).toBe('三行目')
      expect(lines[2].characterCount).toBe(3)
    })

    it('複数のノードを含む行を処理', () => {
      const nodes: AozoraNode[] = [
        { type: 'text', content: '吾輩は' },
        { type: 'ruby', base: '猫', reading: 'ねこ' },
        { type: 'text', content: 'である' }
      ]
      
      const lines = splitIntoLines(nodes)
      
      expect(lines).toHaveLength(1)
      expect(lines[0].text).toBe('吾輩は猫である')
      expect(lines[0].characterCount).toBe(7)
      expect(lines[0].nodes).toHaveLength(3)
    })

    it('改行を含む複数ノードを処理', () => {
      const nodes: AozoraNode[] = [
        { type: 'text', content: '第一行' },
        { type: 'ruby', base: '猫', reading: 'ねこ' },
        { type: 'text', content: '\n第二行' }
      ]
      
      const lines = splitIntoLines(nodes)
      
      expect(lines).toHaveLength(2)
      expect(lines[0].text).toBe('第一行猫')
      expect(lines[0].characterCount).toBe(4)
      expect(lines[1].text).toBe('第二行')
      expect(lines[1].characterCount).toBe(3)
    })

    it('空行を処理', () => {
      const nodes: AozoraNode[] = [
        { type: 'text', content: '一行目\n\n三行目' }
      ]
      
      const lines = splitIntoLines(nodes)
      
      expect(lines).toHaveLength(2)  // 空行は含まれない
      expect(lines[0].text).toBe('一行目')
      expect(lines[1].text).toBe('三行目')
    })

    it('特殊ノードを含む行を処理', () => {
      const nodes: AozoraNode[] = [
        { type: 'heading', content: '第一章', level: 'large' },
        { type: 'text', content: '\n本文開始' }
      ]
      
      const lines = splitIntoLines(nodes)
      
      expect(lines).toHaveLength(2)
      expect(lines[0].text).toBe('第一章')
      expect(lines[0].nodes[0].type).toBe('heading')
      expect(lines[1].text).toBe('本文開始')
    })
  })

  describe('divideIntoPages', () => {
    const createCapacity = (total: number, rows: number = 10): CharacterCapacity => ({
      totalCharacters: total,
      rows,
      cols: total / rows,
      charactersPerRow: total / rows,
      charactersPerColumn: rows
    })

    it('単純なテキストをページに分割', () => {
      const nodes: AozoraNode[] = [
        { type: 'text', content: '12345678901234567890' }  // 20文字
      ]
      
      const capacity = createCapacity(30, 10)  // 30文字/ページ、10文字/列
      const pages = divideIntoPages(nodes, capacity, true)
      
      expect(pages).toHaveLength(1)
      expect(pages[0].totalCharacters).toBe(20)  // ceil(20/10) * 10 = 20
      expect(pages[0].lines).toHaveLength(1)
    })

    it('複数行をページに分割', () => {
      const nodes: AozoraNode[] = [
        { type: 'text', content: '1234567890\n1234567890\n1234567890' }  // 各10文字の3行
      ]
      
      const capacity = createCapacity(30, 10)  // 30文字/ページ
      const pages = divideIntoPages(nodes, capacity, true)
      
      expect(pages).toHaveLength(1)
      expect(pages[0].totalCharacters).toBe(30)  // 10文字 * 3行 = 30
      expect(pages[0].lines).toHaveLength(3)
    })

    it('ページ容量を超える場合は複数ページに分割', () => {
      const nodes: AozoraNode[] = [
        { type: 'text', content: '1234567890\n1234567890\n1234567890\n1234567890' }  // 各10文字の4行
      ]
      
      const capacity = createCapacity(30, 10)  // 30文字/ページ
      const pages = divideIntoPages(nodes, capacity, true)
      
      expect(pages).toHaveLength(2)
      expect(pages[0].totalCharacters).toBe(30)  // 最初の3行
      expect(pages[0].lines).toHaveLength(3)
      expect(pages[1].totalCharacters).toBe(10)  // 最後の1行
      expect(pages[1].lines).toHaveLength(1)
    })

    it('短い行は行数に正規化', () => {
      const nodes: AozoraNode[] = [
        { type: 'text', content: '12345\n123\n12345678901234567890' }  // 5文字、3文字、20文字
      ]
      
      const capacity = createCapacity(40, 10)  // 40文字/ページ、10文字/列
      const pages = divideIntoPages(nodes, capacity, true)
      
      expect(pages).toHaveLength(1)
      // 5文字→10、3文字→10、20文字→20 = 合計40
      expect(pages[0].totalCharacters).toBe(40)
      expect(pages[0].lines).toHaveLength(3)
      expect(pages[0].lines[0].normalizedCount).toBe(10)
      expect(pages[0].lines[1].normalizedCount).toBe(10)
      expect(pages[0].lines[2].normalizedCount).toBe(20)
    })

    it('ルビを含むテキストのページ分割', () => {
      const nodes: AozoraNode[] = [
        { type: 'text', content: '吾輩は' },
        { type: 'ruby', base: '猫', reading: 'ねこ' },
        { type: 'text', content: 'である。\n名前はまだ無い。' }
      ]
      
      const capacity = createCapacity(20, 10)
      const pages = divideIntoPages(nodes, capacity, true)
      
      expect(pages).toHaveLength(1)
      expect(pages[0].lines).toHaveLength(2)
      expect(pages[0].lines[0].text).toBe('吾輩は猫である。')  // 8文字
      expect(pages[0].lines[1].text).toBe('名前はまだ無い。')  // 8文字
    })

    it('横書きモードでの分割', () => {
      const nodes: AozoraNode[] = [
        { type: 'text', content: '1234567890\n1234567890' }
      ]
      
      const capacity: CharacterCapacity = {
        totalCharacters: 40,
        rows: 2,  // 横書きでは行数
        cols: 20,  // 横書きでは1行の文字数
        charactersPerRow: 20,
        charactersPerColumn: 2
      }
      
      const pages = divideIntoPages(nodes, capacity, false)
      
      expect(pages).toHaveLength(1)
      // 横書きモードでは charactersPerRow (20) を基準に正規化
      expect(pages[0].lines[0].normalizedCount).toBe(20)  // 10文字 → 20
      expect(pages[0].lines[1].normalizedCount).toBe(20)  // 10文字 → 20
    })
  })

  describe('getNodesFromPage', () => {
    it('ページからノードを復元', () => {
      const page: Page = {
        lines: [
          {
            nodes: [
              { type: 'text', content: '一行目' },
              { type: 'ruby', base: '猫', reading: 'ねこ' }
            ],
            text: '一行目猫',
            characterCount: 4,
            normalizedCount: 10
          },
          {
            nodes: [
              { type: 'text', content: '二行目' }
            ],
            text: '二行目',
            characterCount: 3,
            normalizedCount: 10
          }
        ],
        totalCharacters: 20,
        startIndex: 0,
        endIndex: 2
      }
      
      const nodes = getNodesFromPage(page)
      
      expect(nodes).toHaveLength(4)  // 3つの元ノード + 1つの改行
      expect(nodes[0]).toEqual({ type: 'text', content: '一行目' })
      expect(nodes[1]).toEqual({ type: 'ruby', base: '猫', reading: 'ねこ' })
      expect(nodes[2]).toEqual({ type: 'text', content: '\n' })  // 改行が追加
      expect(nodes[3]).toEqual({ type: 'text', content: '二行目' })
    })

    it('単一行のページでは改行を追加しない', () => {
      const page: Page = {
        lines: [
          {
            nodes: [{ type: 'text', content: '単一行' }],
            text: '単一行',
            characterCount: 3,
            normalizedCount: 10
          }
        ],
        totalCharacters: 10,
        startIndex: 0,
        endIndex: 0
      }
      
      const nodes = getNodesFromPage(page)
      
      expect(nodes).toHaveLength(1)
      expect(nodes[0]).toEqual({ type: 'text', content: '単一行' })
    })
  })

  describe('統合テスト', () => {
    it('実際の青空文庫テキストをページ分割', () => {
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
        { type: 'text', content: 'がつかぬ。' }
      ]
      
      const capacity = createCapacity(50, 10)
      const pages = divideIntoPages(nodes, capacity, true)
      
      expect(pages.length).toBeGreaterThan(0)
      
      // 各ページの容量が制限内であることを確認
      pages.forEach(page => {
        expect(page.totalCharacters).toBeLessThanOrEqual(50)
      })
      
      // ページから復元したノードが改行を含むことを確認
      const firstPageNodes = getNodesFromPage(pages[0])
      const hasNewline = firstPageNodes.some(
        node => node.type === 'text' && node.content.includes('\n')
      )
      expect(hasNewline).toBe(true)
    })

    const createCapacity = (total: number, rows: number = 10): CharacterCapacity => ({
      totalCharacters: total,
      rows,
      cols: total / rows,
      charactersPerRow: total / rows,
      charactersPerColumn: rows
    })
  })
})