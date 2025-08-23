import { describe, it, expect } from 'vitest'
import { parseAozoraText } from './aozoraParser'

describe('aozoraParser', () => {
  describe('parseAozoraText', () => {
    it('should parse plain text without annotations', () => {
      const input = 'これは普通のテキストです。'
      const result = parseAozoraText(input)
      
      expect(result.nodes).toHaveLength(1)
      expect(result.nodes[0]).toEqual({
        type: 'text',
        content: 'これは普通のテキストです。'
      })
    })

    it('should parse ruby text with 《》 notation', () => {
      const input = '団扇《うちわ》を持っている。'
      const result = parseAozoraText(input)
      
      expect(result.nodes).toHaveLength(2)
      expect(result.nodes[0]).toEqual({
        type: 'ruby',
        base: '団扇',
        reading: 'うちわ'
      })
      expect(result.nodes[1]).toEqual({
        type: 'text',
        content: 'を持っている。'
      })
    })

    it('should parse multiple ruby annotations', () => {
      const input = '昨日《きのう》、図書館《としょかん》へ行った。'
      const result = parseAozoraText(input)
      
      expect(result.nodes).toHaveLength(4)
      expect(result.nodes[0]).toEqual({
        type: 'ruby',
        base: '昨日',
        reading: 'きのう'
      })
      expect(result.nodes[1]).toEqual({
        type: 'text',
        content: '、'
      })
      expect(result.nodes[2]).toEqual({
        type: 'ruby',
        base: '図書館',
        reading: 'としょかん'
      })
      expect(result.nodes[3]).toEqual({
        type: 'text',
        content: 'へ行った。'
      })
    })

    it('should handle ruby notation with kanji groups', () => {
      const input = '吾輩《わがはい》は猫である。'
      const result = parseAozoraText(input)
      
      expect(result.nodes[0]).toEqual({
        type: 'ruby',
        base: '吾輩',
        reading: 'わがはい'
      })
    })

    it('should handle text with mixed content', () => {
      const input = 'これは普通のテキスト、団扇《うちわ》、そしてまた普通のテキスト。'
      const result = parseAozoraText(input)
      
      expect(result.nodes).toHaveLength(3)
      expect(result.nodes[0].type).toBe('text')
      expect(result.nodes[1].type).toBe('ruby')
      expect(result.nodes[2].type).toBe('text')
    })

    it('should handle empty ruby reading', () => {
      const input = '漢字《》'
      const result = parseAozoraText(input)
      
      expect(result.nodes).toHaveLength(1)
      expect(result.nodes[0]).toEqual({
        type: 'ruby',
        base: '漢字',
        reading: ''
      })
    })

    it('should handle text with only opening bracket', () => {
      const input = '漢字《reading'
      const result = parseAozoraText(input)
      
      // 閉じ括弧がない場合は通常のテキストとして扱う
      expect(result.nodes).toHaveLength(1)
      expect(result.nodes[0]).toEqual({
        type: 'text',
        content: '漢字《reading'
      })
    })

    it('should handle multi-line text', () => {
      const input = `第一行
第二行《だいにぎょう》
第三行`
      const result = parseAozoraText(input)
      
      expect(result.nodes).toHaveLength(3)
      expect(result.nodes[0]).toEqual({
        type: 'text',
        content: '第一行\n'
      })
      expect(result.nodes[1]).toEqual({
        type: 'ruby',
        base: '第二行',
        reading: 'だいにぎょう'
      })
      expect(result.nodes[2]).toEqual({
        type: 'text',
        content: '\n第三行'
      })
    })

    it('should handle consecutive ruby annotations without space', () => {
      const input = '漢字《かんじ》文字《もじ》'
      const result = parseAozoraText(input)
      
      expect(result.nodes).toHaveLength(2)
      expect(result.nodes[0]).toEqual({
        type: 'ruby',
        base: '漢字',
        reading: 'かんじ'
      })
      expect(result.nodes[1]).toEqual({
        type: 'ruby',
        base: '文字',
        reading: 'もじ'
      })
    })

    it('should handle special case with ｜ (pipe) for explicit base text', () => {
      const input = '｜これ全部《ぜんぶ》がルビ対象'
      const result = parseAozoraText(input)
      
      expect(result.nodes).toHaveLength(2)
      expect(result.nodes[0]).toEqual({
        type: 'ruby',
        base: 'これ全部',
        reading: 'ぜんぶ'
      })
      expect(result.nodes[1]).toEqual({
        type: 'text',
        content: 'がルビ対象'
      })
    })

    it('should handle indentation tag ［＃n字下げ］', () => {
      const input = '［＃３字下げ］これは３字下げのテキスト'
      const result = parseAozoraText(input)
      
      expect(result.nodes).toHaveLength(1)
      expect(result.nodes[0]).toEqual({
        type: 'text',
        content: '　　　これは３字下げのテキスト'
      })
    })

    it('should handle multiple indentation tags', () => {
      const input = '［＃２字下げ］第一行\n［＃４字下げ］第二行'
      const result = parseAozoraText(input)
      
      expect(result.nodes).toHaveLength(1)
      expect(result.nodes[0]).toEqual({
        type: 'text',
        content: '　　第一行\n　　　　第二行'
      })
    })

    it('should handle indentation tag with ruby', () => {
      const input = '［＃２字下げ］団扇《うちわ》を持つ'
      const result = parseAozoraText(input)
      
      expect(result.nodes).toHaveLength(3)
      expect(result.nodes[0]).toEqual({
        type: 'text',
        content: '　　'
      })
      expect(result.nodes[1]).toEqual({
        type: 'ruby',
        base: '団扇',
        reading: 'うちわ'
      })
      expect(result.nodes[2]).toEqual({
        type: 'text',
        content: 'を持つ'
      })
    })

    it('should not include pipe character in text when used for ruby', () => {
      const input = 'テキスト｜これ全部《ぜんぶ》ルビ'
      const result = parseAozoraText(input)
      
      expect(result.nodes).toHaveLength(3)
      expect(result.nodes[0]).toEqual({
        type: 'text',
        content: 'テキスト'  // パイプを含まない
      })
      expect(result.nodes[1]).toEqual({
        type: 'ruby',
        base: 'これ全部',
        reading: 'ぜんぶ'
      })
      expect(result.nodes[2]).toEqual({
        type: 'text',
        content: 'ルビ'
      })
    })
  })
})