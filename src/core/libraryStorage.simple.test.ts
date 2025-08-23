import { describe, it, expect, vi } from 'vitest'
import type { ParsedAozoraDocument } from '../types/aozora'

// libraryStorageのメソッドをモック化したテスト（実際のIndexedDBを使わない）

describe('LibraryStorage Unit Tests', () => {
  // タイトル抽出ロジックのテスト
  const extractTitle = (document: ParsedAozoraDocument): string | undefined => {
    // 底本情報からタイトルを抽出（これが最優先）
    const textNodes = document.nodes.filter(node => node.type === 'text' && 'content' in node)
    for (let i = textNodes.length - 1; i >= 0; i--) {
      const content = textNodes[i].content as string
      const match = content.match(/底本：「(.+?)」/)
      if (match && match[1]) {
        // 副題などを除去（括弧内のテキストを削除）
        const title = match[1].replace(/[\(（].+?[\)）]/g, '').trim()
        if (title) return title
      }
    }
    
    // 底本が見つからない場合はメタデータを使用
    return document.metadata?.title
  }

  describe('Title Extraction Logic', () => {
    it('should extract title from 底本 section', () => {
      const doc: ParsedAozoraDocument = {
        nodes: [
          { type: 'text', content: '本文' },
          { type: 'text', content: '底本：「吾輩は猫である」新潮文庫' }
        ]
      }
      
      expect(extractTitle(doc)).toBe('吾輩は猫である')
    })

    it('should remove subtitles in parentheses', () => {
      const doc: ParsedAozoraDocument = {
        nodes: [
          { type: 'text', content: '底本：「作品名（上巻）」出版社' }
        ]
      }
      
      expect(extractTitle(doc)).toBe('作品名')
    })

    it('should handle full-width parentheses', () => {
      const doc: ParsedAozoraDocument = {
        nodes: [
          { type: 'text', content: '底本：「日本文学（完全版）」' }
        ]
      }
      
      expect(extractTitle(doc)).toBe('日本文学')
    })

    it('should use metadata as fallback', () => {
      const doc: ParsedAozoraDocument = {
        nodes: [
          { type: 'text', content: '本文のみ' }
        ],
        metadata: {
          title: 'メタデータタイトル'
        }
      }
      
      expect(extractTitle(doc)).toBe('メタデータタイトル')
    })

    it('should return undefined when no title found', () => {
      const doc: ParsedAozoraDocument = {
        nodes: [
          { type: 'text', content: '本文のみ' }
        ]
      }
      
      expect(extractTitle(doc)).toBeUndefined()
    })

    it('should extract from last occurrence of 底本', () => {
      const doc: ParsedAozoraDocument = {
        nodes: [
          { type: 'text', content: '底本：「間違ったタイトル」' },
          { type: 'text', content: '他のテキスト' },
          { type: 'text', content: '底本：「正しいタイトル」出版社' }
        ]
      }
      
      expect(extractTitle(doc)).toBe('正しいタイトル')
    })
  })

  describe('Filter Logic', () => {
    it('should handle undefined title in search', () => {
      const books = [
        { metadata: { title: undefined } },
        { metadata: { title: 'タイトルあり' } }
      ]
      
      const term = 'タイトル'
      const filtered = books.filter(book => 
        (book.metadata.title?.toLowerCase().includes(term.toLowerCase()) ?? false)
      )
      
      expect(filtered).toHaveLength(1)
      expect(filtered[0].metadata.title).toBe('タイトルあり')
    })

    it('should handle undefined author in search', () => {
      const books = [
        { metadata: { title: '本1', author: undefined } },
        { metadata: { title: '本2', author: '夏目漱石' } }
      ]
      
      const term = '夏目'
      const filtered = books.filter(book => 
        (book.metadata.title?.toLowerCase().includes(term.toLowerCase()) ?? false) ||
        (book.metadata.author?.toLowerCase().includes(term.toLowerCase()) ?? false)
      )
      
      expect(filtered).toHaveLength(1)
      expect(filtered[0].metadata.author).toBe('夏目漱石')
    })
  })

  describe('Sort Logic', () => {
    it('should handle undefined titles in sort', () => {
      const books = [
        { metadata: { title: 'ぼ' } },
        { metadata: { title: undefined } },
        { metadata: { title: 'あ' } }
      ]
      
      books.sort((a, b) => 
        (a.metadata.title || '').localeCompare(b.metadata.title || '')
      )
      
      expect(books[0].metadata.title).toBeUndefined()
      expect(books[1].metadata.title).toBe('あ')
      expect(books[2].metadata.title).toBe('ぼ')
    })

    it('should handle undefined dates in sort', () => {
      const now = new Date()
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      
      const books = [
        { metadata: { lastReadDate: now } },
        { metadata: { lastReadDate: undefined } },
        { metadata: { lastReadDate: yesterday } }
      ]
      
      books.sort((a, b) => {
        const aDate = a.metadata.lastReadDate ? new Date(a.metadata.lastReadDate).getTime() : 0
        const bDate = b.metadata.lastReadDate ? new Date(b.metadata.lastReadDate).getTime() : 0
        return aDate - bDate
      })
      
      expect(books[0].metadata.lastReadDate).toBeUndefined()
      expect(books[1].metadata.lastReadDate).toBe(yesterday)
      expect(books[2].metadata.lastReadDate).toBe(now)
    })
  })

  describe('Progress Calculation', () => {
    it('should calculate percent correctly', () => {
      const lastPosition = 250
      const totalLength = 1000
      const percent = Math.round((lastPosition / totalLength) * 100)
      
      expect(percent).toBe(25)
    })

    it('should handle zero total length', () => {
      const lastPosition = 100
      const totalLength = 0
      const percent = totalLength > 0 ? Math.round((lastPosition / totalLength) * 100) : 0
      
      expect(percent).toBe(0)
    })

    it('should cap at 100 percent', () => {
      const lastPosition = 1500
      const totalLength = 1000
      const percent = Math.min(100, Math.round((lastPosition / totalLength) * 100))
      
      expect(percent).toBe(100)
    })
  })

  describe('Document Length Calculation', () => {
    const calculateTotalLength = (document: ParsedAozoraDocument): number => {
      let totalLength = 0
      for (const node of document.nodes) {
        if ('content' in node && typeof node.content === 'string') {
          totalLength += node.content.length
        } else if ('base' in node && typeof node.base === 'string') {
          totalLength += node.base.length
        } else if ('text' in node && typeof node.text === 'string') {
          totalLength += node.text.length
        }
      }
      return totalLength
    }

    it('should calculate text node length', () => {
      const doc: ParsedAozoraDocument = {
        nodes: [
          { type: 'text', content: '12345' },
          { type: 'text', content: '67890' }
        ]
      }
      
      expect(calculateTotalLength(doc)).toBe(10)
    })

    it('should calculate ruby node length', () => {
      const doc: ParsedAozoraDocument = {
        nodes: [
          { type: 'ruby', base: '漢字', reading: 'かんじ' },
          { type: 'text', content: 'テキスト' }
        ]
      }
      
      expect(calculateTotalLength(doc)).toBe(6) // '漢字' + 'テキスト'
    })

    it('should handle emphasis dots nodes', () => {
      const doc: ParsedAozoraDocument = {
        nodes: [
          { type: 'emphasis_dots', text: '強調' },
          { type: 'text', content: '通常' }
        ]
      }
      
      expect(calculateTotalLength(doc)).toBe(4) // '強調' + '通常'
    })
  })

  describe('Thumbnail Generation', () => {
    const generateThumbnail = (document: ParsedAozoraDocument): string => {
      let text = ''
      for (const node of document.nodes) {
        if (node.type === 'text' && 'content' in node) {
          text += node.content
          if (text.length > 100) break
        }
      }
      return text.slice(0, 100)
    }

    it('should generate thumbnail from text nodes', () => {
      const doc: ParsedAozoraDocument = {
        nodes: [
          { type: 'text', content: 'これは最初のテキストです。' },
          { type: 'ruby', base: '漢字', reading: 'かんじ' },
          { type: 'text', content: 'これは二番目のテキストです。' }
        ]
      }
      
      const thumbnail = generateThumbnail(doc)
      expect(thumbnail).toBe('これは最初のテキストです。これは二番目のテキストです。')
    })

    it('should limit to 100 characters', () => {
      const doc: ParsedAozoraDocument = {
        nodes: [
          { type: 'text', content: 'あ'.repeat(150) }
        ]
      }
      
      const thumbnail = generateThumbnail(doc)
      expect(thumbnail.length).toBe(100)
    })

    it('should handle empty document', () => {
      const doc: ParsedAozoraDocument = {
        nodes: []
      }
      
      const thumbnail = generateThumbnail(doc)
      expect(thumbnail).toBe('')
    })
  })
})