import type { LibraryBook, LibraryFilter, BookMetadata, ReadingProgress } from '../types/library'
import type { ParsedAozoraDocument } from '../types/aozora'

const DB_NAME = 'AozoraLibrary'
const DB_VERSION = 2 // Increment version to trigger upgrade
const STORE_NAME = 'books'

// モジュールレベルの状態
let db: IDBDatabase | null = null

// IndexedDBを初期化
const init = async (): Promise<void> => {
  if (db) return // Already initialized

  return new Promise((resolve, reject) => {
    // console.log('Initializing IndexedDB...')
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      // console.error('Failed to open IndexedDB')
      reject(new Error('Failed to open IndexedDB'))
    }

    request.onsuccess = () => {
      db = request.result
      // console.log('IndexedDB initialized successfully')
      resolve()
    }

    request.onupgradeneeded = (event) => {
      // console.log('Database upgrade needed')
      const database = (event.target as IDBOpenDBRequest).result

      // booksストアを作成
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        // console.log('Creating books object store')
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' })

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

// タイトルで本を検索
const findBookByTitle = async (title: string): Promise<LibraryBook | null> => {
  if (!db) await init()

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], 'readonly')
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

// ヘルパー関数
const generateId = (): string => {
  return `book_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

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

const extractAuthor = (document: ParsedAozoraDocument): string | undefined => {
  return document.metadata?.author
}

const generateThumbnail = (document: ParsedAozoraDocument): string => {
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

const calculateTotalLength = (document: ParsedAozoraDocument): number => {
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

// 本を追加または更新（重複チェック付き）
const addBook = async (document: ParsedAozoraDocument, metadata?: Partial<BookMetadata>): Promise<string> => {
  if (!db) await init()

  const title = metadata?.title || extractTitle(document) || 'Untitled'

  // 同じタイトルの本が既に存在するかチェック
  const existingBook = await findBookByTitle(title)

  if (existingBook) {
    // 既存の本を更新
    const updatedBook: LibraryBook = {
      ...existingBook,
      document,
      metadata: {
        ...existingBook.metadata,
        lastReadDate: new Date(),
        fileSize: JSON.stringify(document).length,
        thumbnail: generateThumbnail(document)
      }
    }

    await updateBook(existingBook.id, updatedBook)
    return existingBook.id
  }

  // 新規追加
  const id = generateId()
  const book: LibraryBook = {
    id,
    document,
    metadata: {
      title,
      author: metadata?.author || extractAuthor(document),
      addedDate: new Date(),
      lastReadDate: undefined,
      fileSize: JSON.stringify(document).length,
      thumbnail: generateThumbnail(document),
      tags: metadata?.tags || []
    },
    readingProgress: {
      lastPosition: 0,
      totalLength: calculateTotalLength(document),
      percentComplete: 0,
      bookmarks: [],
      readingTime: 0
    }
  }

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.add(book)

    request.onsuccess = () => {
      resolve(id)
    }
    request.onerror = () => {
      reject(new Error('Failed to add book'))
    }
  })
}

// 本を取得
const getBook = async (id: string): Promise<LibraryBook | null> => {
  if (!db) await init()

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], 'readonly')
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
const getAllBooks = async (filter?: LibraryFilter): Promise<LibraryBook[]> => {
  if (!db) await init()

  return new Promise((resolve, reject) => {
    try {
      const transaction = db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)

      transaction.onerror = () => {
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
        let books: LibraryBook[] = request.result.map((book: LibraryBook) => ({
          ...book,
          metadata: {
            ...book.metadata,
            addedDate: new Date(book.metadata.addedDate),
            lastReadDate: book.metadata.lastReadDate ? new Date(book.metadata.lastReadDate) : undefined
          }
        }))

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

        resolve(books)
      }

      request.onerror = () => {
        reject(new Error('Failed to get all books'))
      }
    } catch (error) {
      reject(error)
    }
  })
}

// 本を更新
const updateBook = async (id: string, updates: Partial<LibraryBook>): Promise<void> => {
  if (!db) await init()

  const book = await getBook(id)
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
    const transaction = db!.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.put(updatedBook)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(new Error('Failed to update book'))
  })
}

// 読書進捗を更新
const updateReadingProgress = async (id: string, progress: Partial<ReadingProgress>): Promise<void> => {
  const book = await getBook(id)
  if (!book) throw new Error('Book not found')

  await updateBook(id, {
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
const deleteBook = async (id: string): Promise<void> => {
  if (!db) await init()

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(id)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(new Error('Failed to delete book'))
  })
}

// すべての本を削除
const clearLibrary = async (): Promise<void> => {
  if (!db) await init()

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.clear()

    request.onsuccess = () => resolve()
    request.onerror = () => reject(new Error('Failed to clear library'))
  })
}

// データベースを削除して再作成（エラー修復用）
const resetDatabase = async (): Promise<void> => {
  if (db) {
    db.close()
    db = null
  }

  return new Promise((resolve, reject) => {
    const deleteRequest = indexedDB.deleteDatabase(DB_NAME)

    deleteRequest.onsuccess = async () => {
      await init()
      resolve()
    }

    deleteRequest.onerror = () => {
      reject(new Error('Failed to delete database'))
    }
  })
}

// エクスポート用のオブジェクト
export const libraryStorage = {
  init,
  addBook,
  getBook,
  getAllBooks,
  updateBook,
  updateReadingProgress,
  deleteBook,
  clearLibrary,
  resetDatabase,
  extractTitle
}
