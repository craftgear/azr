import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { libraryStorage } from './libraryStorage'
import type { ParsedAozoraDocument } from '../types/aozora'
import type { LibraryBook } from '../types/library'

// Fake IndexedDB for testing
import 'fake-indexeddb/auto'

describe('LibraryStorage Integration Tests', () => {
  // サンプルドキュメント
  const createSampleDocument = (title?: string): ParsedAozoraDocument => ({
    nodes: [
      { type: 'text', content: '本文の内容' },
      { type: 'text', content: title ? `底本：「${title}」新潮文庫` : 'テキスト' }
    ],
    metadata: title ? { title } : undefined
  })

  beforeEach(async () => {
    // データベースを初期化
    await libraryStorage.init()
  })

  afterEach(async () => {
    // クリーンアップ
    try {
      await libraryStorage.clearLibrary()
    } catch (err) {
      // エラーを無視
    }
  })

  describe('Database Initialization', () => {
    it('should initialize database successfully', async () => {
      await expect(libraryStorage.init()).resolves.not.toThrow()
    })

    it('should handle multiple init calls gracefully', async () => {
      await libraryStorage.init()
      await libraryStorage.init()
      // Should not throw
      await expect(libraryStorage.getAllBooks()).resolves.toBeDefined()
    })
  })

  describe('Book Addition and Retrieval', () => {
    it('should add a book and retrieve it', async () => {
      const doc = createSampleDocument('テストタイトル')
      
      const bookId = await libraryStorage.addBook(doc)
      expect(bookId).toBeDefined()
      expect(typeof bookId).toBe('string')
      
      const book = await libraryStorage.getBook(bookId)
      expect(book).toBeDefined()
      expect(book?.metadata.title).toBe('テストタイトル')
    })

    it('should extract title from 底本 section', async () => {
      const doc = createSampleDocument('吾輩は猫である')
      
      const bookId = await libraryStorage.addBook(doc)
      const book = await libraryStorage.getBook(bookId)
      
      expect(book?.metadata.title).toBe('吾輩は猫である')
    })

    it('should handle books without title', async () => {
      const doc: ParsedAozoraDocument = {
        nodes: [{ type: 'text', content: '本文のみ' }]
      }
      
      const bookId = await libraryStorage.addBook(doc)
      const book = await libraryStorage.getBook(bookId)
      
      expect(book).toBeDefined()
      expect(book?.metadata.title).toBe('Untitled')
    })

    it('should update existing book with same title', async () => {
      const doc1 = createSampleDocument('同じタイトル')
      const doc2 = createSampleDocument('同じタイトル')
      doc2.nodes.push({ type: 'text', content: '追加のコンテンツ' })
      
      const bookId1 = await libraryStorage.addBook(doc1)
      const bookId2 = await libraryStorage.addBook(doc2)
      
      // 同じIDが返される
      expect(bookId2).toBe(bookId1)
      
      // 内容が更新されている
      const book = await libraryStorage.getBook(bookId1)
      expect(book?.document.nodes.length).toBe(3)
    })
  })

  describe('Get All Books', () => {
    it('should return empty array when no books', async () => {
      const books = await libraryStorage.getAllBooks()
      expect(Array.isArray(books)).toBe(true)
      expect(books).toHaveLength(0)
    })

    it('should return all added books', async () => {
      await libraryStorage.addBook(createSampleDocument('本1'))
      await libraryStorage.addBook(createSampleDocument('本2'))
      await libraryStorage.addBook(createSampleDocument('本3'))
      
      const books = await libraryStorage.getAllBooks()
      expect(books).toHaveLength(3)
      
      const titles = books.map(b => b.metadata.title).sort()
      expect(titles).toEqual(['本1', '本2', '本3'])
    })

    it('should handle Date objects correctly', async () => {
      const bookId = await libraryStorage.addBook(createSampleDocument('テスト'))
      
      // 読書進捗を更新
      await libraryStorage.updateReadingProgress(bookId, {
        lastPosition: 100
      })
      
      const books = await libraryStorage.getAllBooks()
      expect(books).toHaveLength(1)
      
      const book = books[0]
      expect(book.metadata.addedDate).toBeInstanceOf(Date)
      expect(book.metadata.lastReadDate).toBeInstanceOf(Date)
    })

    it('should filter books by search term', async () => {
      await libraryStorage.addBook(createSampleDocument('吾輩は猫である'))
      await libraryStorage.addBook(createSampleDocument('坊っちゃん'))
      await libraryStorage.addBook(createSampleDocument('雪国'))
      
      const books = await libraryStorage.getAllBooks({
        searchTerm: '猫'
      })
      
      expect(books).toHaveLength(1)
      expect(books[0].metadata.title).toBe('吾輩は猫である')
    })

    it('should handle undefined titles in filter', async () => {
      const doc: ParsedAozoraDocument = {
        nodes: [{ type: 'text', content: 'コンテンツ' }]
      }
      await libraryStorage.addBook(doc)
      await libraryStorage.addBook(createSampleDocument('タイトルあり'))
      
      const books = await libraryStorage.getAllBooks({
        searchTerm: 'タイトル'
      })
      
      expect(books).toHaveLength(1)
      expect(books[0].metadata.title).toBe('タイトルあり')
    })

    it('should sort books correctly', async () => {
      await libraryStorage.addBook(createSampleDocument('ぼ'))
      await libraryStorage.addBook(createSampleDocument('あ'))
      await libraryStorage.addBook(createSampleDocument('ん'))
      
      const books = await libraryStorage.getAllBooks({
        sortBy: 'title',
        sortOrder: 'asc'
      })
      
      expect(books[0].metadata.title).toBe('あ')
      expect(books[1].metadata.title).toBe('ぼ')
      expect(books[2].metadata.title).toBe('ん')
    })

    it('should handle sorting with undefined titles', async () => {
      const docNoTitle: ParsedAozoraDocument = {
        nodes: [{ type: 'text', content: 'no title' }]
      }
      
      await libraryStorage.addBook(docNoTitle)
      await libraryStorage.addBook(createSampleDocument('ある'))
      
      const books = await libraryStorage.getAllBooks({
        sortBy: 'title',
        sortOrder: 'asc'
      })
      
      // Untitled should come after
      expect(books).toHaveLength(2)
      expect(books[0].metadata.title).toBe('Untitled')
      expect(books[1].metadata.title).toBe('ある')
    })
  })

  describe('Reading Progress', () => {
    it('should update reading progress', async () => {
      const bookId = await libraryStorage.addBook(createSampleDocument('本'))
      
      await libraryStorage.updateReadingProgress(bookId, {
        lastPosition: 500
      })
      
      const book = await libraryStorage.getBook(bookId)
      expect(book?.readingProgress.lastPosition).toBe(500)
      expect(book?.metadata.lastReadDate).toBeInstanceOf(Date)
    })

    it('should calculate percent complete correctly', async () => {
      const doc = createSampleDocument('本')
      // 総文字数を計算可能にする
      doc.nodes = [
        { type: 'text', content: '0'.repeat(1000) } // 1000文字
      ]
      
      const bookId = await libraryStorage.addBook(doc)
      
      await libraryStorage.updateReadingProgress(bookId, {
        lastPosition: 500
      })
      
      const book = await libraryStorage.getBook(bookId)
      expect(book?.readingProgress.percentComplete).toBe(50)
    })
  })

  describe('Book Deletion', () => {
    it('should delete a book', async () => {
      const bookId = await libraryStorage.addBook(createSampleDocument('削除する本'))
      
      let book = await libraryStorage.getBook(bookId)
      expect(book).toBeDefined()
      
      await libraryStorage.deleteBook(bookId)
      
      book = await libraryStorage.getBook(bookId)
      expect(book).toBeNull()
    })

    it('should clear all books', async () => {
      await libraryStorage.addBook(createSampleDocument('本1'))
      await libraryStorage.addBook(createSampleDocument('本2'))
      
      let books = await libraryStorage.getAllBooks()
      expect(books).toHaveLength(2)
      
      await libraryStorage.clearLibrary()
      
      books = await libraryStorage.getAllBooks()
      expect(books).toHaveLength(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid book ID gracefully', async () => {
      const book = await libraryStorage.getBook('invalid-id')
      expect(book).toBeNull()
    })

    it('should handle update for non-existent book', async () => {
      await expect(
        libraryStorage.updateReadingProgress('invalid-id', { lastPosition: 100 })
      ).rejects.toThrow('Book not found')
    })

    it('should handle delete for non-existent book', async () => {
      // Should not throw, just complete
      await expect(
        libraryStorage.deleteBook('invalid-id')
      ).resolves.not.toThrow()
    })
  })

  describe('Title Extraction', () => {
    it('should extract title with parentheses removal', async () => {
      const doc: ParsedAozoraDocument = {
        nodes: [
          { type: 'text', content: '底本：「もみの木は残った（上）」新潮文庫' }
        ]
      }
      
      const bookId = await libraryStorage.addBook(doc)
      const book = await libraryStorage.getBook(bookId)
      
      expect(book?.metadata.title).toBe('もみの木は残った')
    })

    it('should handle full-width parentheses', async () => {
      const doc: ParsedAozoraDocument = {
        nodes: [
          { type: 'text', content: '底本：「作品集（完全版）」出版社' }
        ]
      }
      
      const bookId = await libraryStorage.addBook(doc)
      const book = await libraryStorage.getBook(bookId)
      
      expect(book?.metadata.title).toBe('作品集')
    })

    it('should use metadata title as fallback', async () => {
      const doc: ParsedAozoraDocument = {
        nodes: [{ type: 'text', content: '本文' }],
        metadata: { title: 'メタデータタイトル' }
      }
      
      const bookId = await libraryStorage.addBook(doc, {
        title: 'カスタムタイトル'
      })
      const book = await libraryStorage.getBook(bookId)
      
      expect(book?.metadata.title).toBe('カスタムタイトル')
    })
  })

  describe('Concurrency and Performance', () => {
    it('should handle concurrent book additions', async () => {
      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(libraryStorage.addBook(createSampleDocument(`本${i}`)))
      }
      
      const bookIds = await Promise.all(promises)
      expect(bookIds).toHaveLength(10)
      expect(new Set(bookIds).size).toBe(10) // All unique IDs
      
      const books = await libraryStorage.getAllBooks()
      expect(books).toHaveLength(10)
    })

    it('should handle large documents', async () => {
      const largeDoc: ParsedAozoraDocument = {
        nodes: []
      }
      
      // 大きなドキュメントを作成
      for (let i = 0; i < 1000; i++) {
        largeDoc.nodes.push({
          type: 'text',
          content: `これは${i}番目のノードです。`.repeat(10)
        })
      }
      
      const bookId = await libraryStorage.addBook(largeDoc, {
        title: '大きな本'
      })
      
      const book = await libraryStorage.getBook(bookId)
      expect(book).toBeDefined()
      expect(book?.document.nodes).toHaveLength(1000)
    })
  })
})