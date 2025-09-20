import { describe, it, expect } from 'vitest'
import {
  extractTextFromNode,
  countCharacters,
  splitIntoLines
  // type Line,
  // type Page
} from './pageDivider'
import type { AozoraNode } from '../types/aozora'
// import type { CharacterCapacity } from './readerCapacityCalculator'

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
})