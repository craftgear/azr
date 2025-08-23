import type { LibraryBook, LibraryFilter, BookMetadata, ReadingProgress } from '../types/library'
import type { ParsedAozoraDocument } from '../types/aozora'

const DB_NAME = 'AozoraLibrary'
const DB_VERSION = 1
const STORE_NAME = 'books'

class LibraryStorage {
  private db: IDBDatabase | null = null

  // IndexedDBを初期化
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'))
      }

      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // booksストアを作成
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
          
          // インデックスを作成
          store.createIndex('title', 'metadata.title', { unique: false })
          store.createIndex('author', 'metadata.author', { unique: false })
          store.createIndex('addedDate', 'metadata.addedDate', { unique: false })
          store.createIndex('lastReadDate', 'metadata.lastReadDate', { unique: false })
        }
      }
    })
  }

  // 本を追加または更新（重複チェック付き）
  async addBook(document: ParsedAozoraDocument, metadata?: Partial<BookMetadata>): Promise<string> {
    if (!this.db) await this.init()

    const title = metadata?.title || this.extractTitle(document) || 'Untitled'
    
    // 同じタイトルの本が既に存在するかチェック
    const existingBook = await this.findBookByTitle(title)
    
    if (existingBook) {
      // 既存の本を更新
      const updatedBook: LibraryBook = {
        ...existingBook,
        document,
        metadata: {
          ...existingBook.metadata,
          lastReadDate: new Date(),
          fileSize: JSON.stringify(document).length,
          thumbnail: this.generateThumbnail(document)
        }
      }
      
      await this.updateBook(existingBook.id, updatedBook)
      return existingBook.id
    }

    // 新規追加
    const id = this.generateId()
    const book: LibraryBook = {
      id,
      document,
      metadata: {
        title,
        author: metadata?.author || this.extractAuthor(document),
        addedDate: new Date(),
        lastReadDate: undefined,
        fileSize: JSON.stringify(document).length,
        thumbnail: this.generateThumbnail(document),
        tags: metadata?.tags || []
      },
      readingProgress: {
        lastPosition: 0,
        totalLength: this.calculateTotalLength(document),
        percentComplete: 0,
        bookmarks: [],
        readingTime: 0
      }
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.add(book)

      request.onsuccess = () => resolve(id)
      request.onerror = () => reject(new Error('Failed to add book'))
    })
  }

  // タイトルで本を検索
  private async findBookByTitle(title: string): Promise<LibraryBook | null> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const index = store.index('title')
      const request = index.get(title)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(new Error('Failed to find book by title'))
    })
  }

  // 本を取得
  async getBook(id: string): Promise<LibraryBook | null> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(id)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(new Error('Failed to get book'))
    })
  }

  // すべての本を取得
  async getAllBooks(filter?: LibraryFilter): Promise<LibraryBook[]> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      
      let request: IDBRequest
      if (filter?.sortBy && filter.sortBy !== 'progress') {
        const index = store.index(filter.sortBy)
        request = index.getAll()
      } else {
        request = store.getAll()
      }

      request.onsuccess = () => {
        let books: LibraryBook[] = request.result

        // フィルタリング
        if (filter?.searchTerm) {
          const term = filter.searchTerm.toLowerCase()
          books = books.filter(book => 
            book.metadata.title.toLowerCase().includes(term) ||
            (book.metadata.author?.toLowerCase().includes(term) ?? false)
          )
        }

        if (filter?.tags && filter.tags.length > 0) {
          books = books.filter(book =>
            filter.tags!.some(tag => book.metadata.tags?.includes(tag))
          )
        }

        // ソート
        if (filter?.sortBy) {
          books.sort((a, b) => {
            let compareValue = 0
            
            switch (filter.sortBy) {
              case 'title':
                compareValue = a.metadata.title.localeCompare(b.metadata.title)
                break
              case 'author':
                compareValue = (a.metadata.author || '').localeCompare(b.metadata.author || '')
                break
              case 'addedDate':
                compareValue = a.metadata.addedDate.getTime() - b.metadata.addedDate.getTime()
                break
              case 'lastReadDate':
                const aDate = a.metadata.lastReadDate?.getTime() || 0
                const bDate = b.metadata.lastReadDate?.getTime() || 0
                compareValue = aDate - bDate
                break
              case 'progress':
                compareValue = a.readingProgress.percentComplete - b.readingProgress.percentComplete
                break
            }

            return filter.sortOrder === 'desc' ? -compareValue : compareValue
          })
        }

        resolve(books)
      }

      request.onerror = () => reject(new Error('Failed to get all books'))
    })
  }

  // 本を更新
  async updateBook(id: string, updates: Partial<LibraryBook>): Promise<void> {
    if (!this.db) await this.init()

    const book = await this.getBook(id)
    if (!book) throw new Error('Book not found')

    const updatedBook: LibraryBook = {
      ...book,
      ...updates,
      metadata: {
        ...book.metadata,
        ...(updates.metadata || {})
      },
      readingProgress: {
        ...book.readingProgress,
        ...(updates.readingProgress || {})
      }
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(updatedBook)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(new Error('Failed to update book'))
    })
  }

  // 読書進捗を更新
  async updateReadingProgress(id: string, progress: Partial<ReadingProgress>): Promise<void> {
    const book = await this.getBook(id)
    if (!book) throw new Error('Book not found')

    await this.updateBook(id, {
      readingProgress: {
        ...book.readingProgress,
        ...progress,
        percentComplete: progress.lastPosition 
          ? Math.round((progress.lastPosition / book.readingProgress.totalLength) * 100)
          : book.readingProgress.percentComplete
      },
      metadata: {
        ...book.metadata,
        lastReadDate: new Date()
      }
    })
  }

  // 本を削除
  async deleteBook(id: string): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(new Error('Failed to delete book'))
    })
  }

  // すべての本を削除
  async clearLibrary(): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.clear()

      request.onsuccess = () => resolve()
      request.onerror = () => reject(new Error('Failed to clear library'))
    })
  }

  // ヘルパーメソッド
  private generateId(): string {
    return `book_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private extractTitle(document: ParsedAozoraDocument): string | undefined {
    // ドキュメントから最初の見出しを探してタイトルとする
    const headingNode = document.nodes.find(node => node.type === 'heading')
    if (headingNode && 'content' in headingNode) {
      return headingNode.content as string
    }
    
    // メタデータにタイトルがあれば使用
    return document.metadata?.title
  }

  private extractAuthor(document: ParsedAozoraDocument): string | undefined {
    return document.metadata?.author
  }

  private generateThumbnail(document: ParsedAozoraDocument): string {
    // 最初の100文字程度をサムネイルテキストとして返す
    let text = ''
    for (const node of document.nodes) {
      if (node.type === 'text' && 'content' in node) {
        text += node.content
        if (text.length > 100) break
      }
    }
    return text.slice(0, 100)
  }

  private calculateTotalLength(document: ParsedAozoraDocument): number {
    // ドキュメントの総文字数を計算
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
}

// シングルトンインスタンスをエクスポート
export const libraryStorage = new LibraryStorage()