import type { LibraryBook, LibraryFilter, BookMetadata, ReadingProgress } from '../types/library'
import type { ParsedAozoraDocument } from '../types/aozora'

const DB_NAME = 'AozoraLibrary'
const DB_VERSION = 2 // Increment version to trigger upgrade
const STORE_NAME = 'books'

class LibraryStorage {
  private db: IDBDatabase | null = null

  // IndexedDBを初期化
  async init(): Promise<void> {
    if (this.db) return // Already initialized
    
    return new Promise((resolve, reject) => {
      // console.log('Initializing IndexedDB...')
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        // console.error('Failed to open IndexedDB')
        reject(new Error('Failed to open IndexedDB'))
      }

      request.onsuccess = () => {
        this.db = request.result
        // console.log('IndexedDB initialized successfully')
        resolve()
      }

      request.onupgradeneeded = (event) => {
        // console.log('Database upgrade needed')
        const db = (event.target as IDBOpenDBRequest).result

        // booksストアを作成
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          // console.log('Creating books object store')
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
          
          // インデックスを作成
          store.createIndex('title', 'metadata.title', { unique: false })
          store.createIndex('author', 'metadata.author', { unique: false })
          store.createIndex('addedDate', 'metadata.addedDate', { unique: false })
          store.createIndex('lastReadDate', 'metadata.lastReadDate', { unique: false })
          // console.log('Object store created successfully')
        }
      }
    })
  }

  // 本を追加または更新（重複チェック付き）
  async addBook(document: ParsedAozoraDocument, metadata?: Partial<BookMetadata>): Promise<string> {
    if (!this.db) await this.init()

    const title = metadata?.title || this.extractTitle(document) || 'Untitled'
    console.log('Adding book with title:', title)
    
    // 同じタイトルの本が既に存在するかチェック
    const existingBook = await this.findBookByTitle(title)
    
    if (existingBook) {
      console.log('Book already exists, updating:', existingBook.id)
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
    
    console.log('Creating new book entry')

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
      console.log('Adding book to IndexedDB:', book.metadata.title)
      const request = store.add(book)

      request.onsuccess = () => {
        console.log('Book added successfully with ID:', id)
        resolve(id)
      }
      request.onerror = () => {
        console.error('Failed to add book to IndexedDB:', request.error)
        reject(new Error('Failed to add book'))
      }
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

      request.onsuccess = () => {
        const book = request.result
        if (!book) {
          resolve(null)
          return
        }
        
        // Dateオブジェクトを復元
        const restoredBook: LibraryBook = {
          ...book,
          metadata: {
            ...book.metadata,
            addedDate: new Date(book.metadata.addedDate),
            lastReadDate: book.metadata.lastReadDate ? new Date(book.metadata.lastReadDate) : undefined
          }
        }
        resolve(restoredBook)
      }
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

      request.onsuccess = () => {
        const book = request.result
        if (!book) {
          resolve(null)
          return
        }
        
        // Dateオブジェクトを復元
        const restoredBook: LibraryBook = {
          ...book,
          metadata: {
            ...book.metadata,
            addedDate: new Date(book.metadata.addedDate),
            lastReadDate: book.metadata.lastReadDate ? new Date(book.metadata.lastReadDate) : undefined
          }
        }
        resolve(restoredBook)
      }
      request.onerror = () => reject(new Error('Failed to get book'))
    })
  }

  // すべての本を取得
  async getAllBooks(filter?: LibraryFilter): Promise<LibraryBook[]> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction([STORE_NAME], 'readonly')
        const store = transaction.objectStore(STORE_NAME)
        
        transaction.onerror = () => {
          console.error('Transaction error:', transaction.error)
          reject(new Error('Transaction failed'))
        }
        
        let request: IDBRequest
        // Temporarily disable index usage to see if that's the issue
        // if (filter?.sortBy && filter.sortBy !== 'progress') {
        //   const index = store.index(filter.sortBy)
        //   request = index.getAll()
        // } else {
        request = store.getAll()
        // }

        request.onsuccess = () => {
        console.log('Raw books from IndexedDB:', request.result)
        let books: LibraryBook[] = request.result.map((book: LibraryBook) => ({
          ...book,
          metadata: {
            ...book.metadata,
            addedDate: new Date(book.metadata.addedDate),
            lastReadDate: book.metadata.lastReadDate ? new Date(book.metadata.lastReadDate) : undefined
          }
        }))
        console.log('Processed books:', books)

        // フィルタリング
        if (filter?.searchTerm) {
          const term = filter.searchTerm.toLowerCase()
          books = books.filter(book => 
            (book.metadata.title?.toLowerCase().includes(term) ?? false) ||
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
                compareValue = (a.metadata.title || '').localeCompare(b.metadata.title || '')
                break
              case 'author':
                compareValue = (a.metadata.author || '').localeCompare(b.metadata.author || '')
                break
              case 'addedDate':
                compareValue = new Date(a.metadata.addedDate).getTime() - new Date(b.metadata.addedDate).getTime()
                break
              case 'lastReadDate':
                const aDate = a.metadata.lastReadDate ? new Date(a.metadata.lastReadDate).getTime() : 0
                const bDate = b.metadata.lastReadDate ? new Date(b.metadata.lastReadDate).getTime() : 0
                compareValue = aDate - bDate
                break
              case 'progress':
                compareValue = a.readingProgress.percentComplete - b.readingProgress.percentComplete
                break
            }

            return filter.sortOrder === 'desc' ? -compareValue : compareValue
          })
        }

        console.log('Final books to return:', books)
        console.log('Number of books:', books.length)
        resolve(books)
      }

        request.onerror = () => {
          console.error('Failed to get all books:', request.error)
          reject(new Error('Failed to get all books'))
        }
      } catch (error) {
        console.error('Error in getAllBooks:', error)
        reject(error)
      }
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

  // データベースを削除して再作成（エラー修復用）
  async resetDatabase(): Promise<void> {
    if (this.db) {
      this.db.close()
      this.db = null
    }
    
    return new Promise((resolve, reject) => {
      const deleteRequest = indexedDB.deleteDatabase(DB_NAME)
      
      deleteRequest.onsuccess = async () => {
        console.log('Database deleted successfully')
        await this.init()
        resolve()
      }
      
      deleteRequest.onerror = () => {
        console.error('Failed to delete database')
        reject(new Error('Failed to delete database'))
      }
    })
  }

  // ヘルパーメソッド
  private generateId(): string {
    return `book_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private extractTitle(document: ParsedAozoraDocument): string | undefined {
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