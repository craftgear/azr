import { describe, it, expect } from 'vitest'
import { formatNodeToHTML, formatDocumentToHTML } from './textFormatter'
import type { AozoraNode, ParsedAozoraDocument } from '../types/aozora'

describe('textFormatter', () => {
  describe('formatNodeToHTML', () => {
    it('should format plain text node', () => {
      const node: AozoraNode = {
        type: 'text',
        content: 'これは普通のテキストです。'
      }
      const html = formatNodeToHTML(node)
      expect(html).toBe('これは普通のテキストです。')
    })

    it('should format ruby text node', () => {
      const node: AozoraNode = {
        type: 'ruby',
        base: '団扇',
        reading: 'うちわ'
      }
      const html = formatNodeToHTML(node)
      expect(html).toBe('<ruby>団扇<rt>うちわ</rt></ruby>')
    })

    it('should escape HTML in text content', () => {
      const node: AozoraNode = {
        type: 'text',
        content: '<script>alert("XSS")</script>'
      }
      const html = formatNodeToHTML(node)
      expect(html).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;')
    })

    it('should escape HTML in ruby base and reading', () => {
      const node: AozoraNode = {
        type: 'ruby',
        base: '<b>漢字</b>',
        reading: '<i>かんじ</i>'
      }
      const html = formatNodeToHTML(node)
      expect(html).toBe('<ruby>&lt;b&gt;漢字&lt;/b&gt;<rt>&lt;i&gt;かんじ&lt;/i&gt;</rt></ruby>')
    })

    it('should preserve newlines in text', () => {
      const node: AozoraNode = {
        type: 'text',
        content: '第一行\n第二行\n第三行'
      }
      const html = formatNodeToHTML(node)
      expect(html).toBe('第一行<br>第二行<br>第三行')
    })
  })

  describe('formatDocumentToHTML', () => {
    it('should format entire document', () => {
      const doc: ParsedAozoraDocument = {
        nodes: [
          { type: 'text', content: '吾輩は' },
          { type: 'ruby', base: '猫', reading: 'ねこ' },
          { type: 'text', content: 'である。' }
        ],
        metadata: {}
      }
      const html = formatDocumentToHTML(doc)
      expect(html).toBe('吾輩は<ruby>猫<rt>ねこ</rt></ruby>である。')
    })

    it('should wrap document in div with class', () => {
      const doc: ParsedAozoraDocument = {
        nodes: [
          { type: 'text', content: 'テキスト' }
        ],
        metadata: {}
      }
      const html = formatDocumentToHTML(doc, { wrapInDiv: true })
      expect(html).toBe('<div class="aozora-text">テキスト</div>')
    })

    it('should handle empty document', () => {
      const doc: ParsedAozoraDocument = {
        nodes: [],
        metadata: {}
      }
      const html = formatDocumentToHTML(doc)
      expect(html).toBe('')
    })

    it('should format document with multiple lines', () => {
      const doc: ParsedAozoraDocument = {
        nodes: [
          { type: 'text', content: '第一行\n' },
          { type: 'ruby', base: '第二行', reading: 'だいにぎょう' },
          { type: 'text', content: '\n第三行' }
        ],
        metadata: {}
      }
      const html = formatDocumentToHTML(doc)
      expect(html).toBe('第一行<br><ruby>第二行<rt>だいにぎょう</rt></ruby><br>第三行')
    })
  })
})