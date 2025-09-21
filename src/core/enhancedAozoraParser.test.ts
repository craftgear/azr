import { describe, it, expect } from 'vitest'
import { parseAozoraText } from './enhancedAozoraParser'

// パーサーは文字単位で処理するため、連続するテキストノードをマージする
function mergeTextNodes(nodes: any[]): any[] {
  const merged: any[] = []
  
  for (const node of nodes) {
    if (node.type === 'text' && merged.length > 0 && merged[merged.length - 1].type === 'text') {
      merged[merged.length - 1].content += node.content
    } else if (node.type === 'text_size' && node.content) {
      merged.push({
        ...node,
        content: mergeTextNodes(node.content)
      })
    } else {
      merged.push(node)
    }
  }
  
  return merged
}

describe('enhancedAozoraParser', () => {
  describe('傍点（emphasis dots）', () => {
    it('should parse emphasis dots notation', () => {
      const input = 'みや［＃「みや」に傍点］'
      const result = parseAozoraText(input)
      const merged = mergeTextNodes(result.nodes)

      expect(merged).toHaveLength(1)
      expect(merged[0]).toEqual({
        type: 'emphasis_dots',
        content: 'みや',
        text: 'みや'
      })
    })

    it('should handle emphasis dots with surrounding text', () => {
      const input = 'これは重要［＃「重要」に傍点］なポイントです'
      const result = parseAozoraText(input)
      const merged = mergeTextNodes(result.nodes)

      expect(merged).toHaveLength(3)
      expect(merged[0]).toEqual({
        type: 'text',
        content: 'これは'
      })
      expect(merged[1]).toEqual({
        type: 'emphasis_dots',
        content: '重要',
        text: '重要'
      })
      expect(merged[2]).toEqual({
        type: 'text',
        content: 'なポイントです'
      })
    })
  })

  describe('テキストサイズ変更', () => {
    it('should parse text size change', () => {
      const input = '［＃１段階小さな文字］小さい文字［＃小さな文字終わり］'
      const result = parseAozoraText(input)
      const merged = mergeTextNodes(result.nodes)

      expect(merged).toHaveLength(1)
      expect(merged[0]).toEqual({
        type: 'text_size',
        content: [{
          type: 'text',
          content: '小さい文字'
        }],
        size: 'small'
      })
    })

    it('should handle nested content in text size', () => {
      const input = '［＃１段階小さな文字］漢字《かんじ》の説明［＃小さな文字終わり］'
      const result = parseAozoraText(input)
      const merged = mergeTextNodes(result.nodes)

      expect(merged).toHaveLength(1)
      expect(merged[0].type).toBe('text_size')
      const sizeNode = merged[0] as any
      // パーサーは漢字を先にテキストとして追加し、その後ルビノードを追加するため3つのノードになる
      expect(sizeNode.content).toHaveLength(3)
      expect(sizeNode.content[0]).toEqual({
        type: 'text',
        content: '漢字'
      })
      expect(sizeNode.content[1]).toEqual({
        type: 'ruby',
        base: '漢字',
        reading: 'かんじ'
      })
      expect(sizeNode.content[2]).toEqual({
        type: 'text',
        content: 'の説明'
      })
    })
  })

  describe('見出し（headings）', () => {
    it('should parse medium heading with content', () => {
      const input = '第一章［＃「第一章」は中見出し］'
      const result = parseAozoraText(input)

      expect(result.nodes).toHaveLength(1)
      expect(result.nodes[0]).toEqual({
        type: 'heading',
        content: '第一章',
        level: 'medium'
      })
    })

    it('should parse large heading', () => {
      const input = 'タイトル［＃「タイトル」は大見出し］'
      const result = parseAozoraText(input)

      expect(result.nodes).toHaveLength(1)
      expect(result.nodes[0]).toEqual({
        type: 'heading',
        content: 'タイトル',
        level: 'large'
      })
    })

    it('should parse small heading', () => {
      const input = '節［＃「節」は小見出し］'
      const result = parseAozoraText(input)

      expect(result.nodes).toHaveLength(1)
      expect(result.nodes[0]).toEqual({
        type: 'heading',
        content: '節',
        level: 'small'
      })
    })
  })


  describe('特殊文字説明', () => {
    it('should parse special character notation', () => {
      const input = '［＃「插」でつくりの縦棒が下に突き抜けている、第4水準2-13-28］'
      const result = parseAozoraText(input)

      expect(result.nodes).toHaveLength(1)
      expect(result.nodes[0].type).toBe('special_char_note')
      const charNode = result.nodes[0] as any
      expect(charNode.char).toBe('插')
      expect(charNode.description).toContain('つくりの縦棒')
      expect(charNode.unicode).toBe('2-13-28')
    })
  })

  describe('既存の機能との組み合わせ', () => {
    it('should handle ruby text', () => {
      const input = '団扇《うちわ》を持つ'
      const result = parseAozoraText(input)

      expect(result.nodes).toHaveLength(2)
      expect(result.nodes[0]).toEqual({
        type: 'ruby',
        base: '団扇',
        reading: 'うちわ'
      })
    })

    it('should handle pipe ruby notation', () => {
      const input = '｜これ全部《ぜんぶ》がルビ'
      const result = parseAozoraText(input)

      expect(result.nodes).toHaveLength(2)
      expect(result.nodes[0]).toEqual({
        type: 'ruby',
        base: 'これ全部',
        reading: 'ぜんぶ'
      })
    })

  })

  describe('複雑な組み合わせ', () => {
    it('should handle mixed formatting', () => {
      const input = '［＃「序の章」は中見出し］昔々《むかしむかし》、［＃「ある所」に傍点］に'
      const result = parseAozoraText(input)

      // ノードの種類を確認
      expect(result.nodes[0].type).toBe('heading')
      expect(result.nodes[0]).toHaveProperty('content', '序の章')

      // 傍点があることを確認
      const hasEmphasisDots = result.nodes.some(node => node.type === 'emphasis_dots')
      expect(hasEmphasisDots).toBe(true)

      // 最低限必要なノード数
      expect(result.nodes.length).toBeGreaterThanOrEqual(2)
    })

    it('should handle unclosed text size tags gracefully', () => {
      const input = '［＃１段階小さな文字］未完了のテキスト'
      const result = parseAozoraText(input)

      // スタックがフラッシュされる
      expect(result.nodes).toHaveLength(1)
      expect(result.nodes[0].type).toBe('text_size')
    })
  })
})
