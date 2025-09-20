import { libraryStorage } from './libraryStorage'

/**
 * ブックマークの保存と読み込みを管理するサービス
 */
class BookmarkStorage {
  // デバウンス用のタイマー
  private saveTimers: Map<string, NodeJS.Timeout> = new Map()

  /**
   * 指定された本のブックマーク位置を保存
   */
  async saveBookmark(bookId: string, pageIndex: number): Promise<void> {
    // 既存のタイマーがあればクリア
    const existingTimer = this.saveTimers.get(bookId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // デバウンス処理（500ms後に保存）
    const timer = setTimeout(async () => {
      try {
        await libraryStorage.updateReadingProgress(bookId, {
          lastPosition: pageIndex
        })
        this.saveTimers.delete(bookId)
      } catch (error) {
        console.error('Failed to save bookmark:', error)
      }
    }, 500)

    this.saveTimers.set(bookId, timer)
  }

  /**
   * 指定された本のブックマーク位置を取得
   */
  async loadBookmark(bookId: string): Promise<number | null> {
    try {
      const book = await libraryStorage.getBook(bookId)
      if (book && book.readingProgress) {
        return book.readingProgress.lastPosition || 0
      }
      return null
    } catch (error) {
      console.error('Failed to load bookmark:', error)
      return null
    }
  }

  /**
   * 即座にブックマークを保存（デバウンスなし）
   */
  async saveBookmarkImmediate(bookId: string, pageIndex: number): Promise<void> {
    // 既存のタイマーがあればクリア
    const existingTimer = this.saveTimers.get(bookId)
    if (existingTimer) {
      clearTimeout(existingTimer)
      this.saveTimers.delete(bookId)
    }

    try {
      await libraryStorage.updateReadingProgress(bookId, {
        lastPosition: pageIndex
      })
    } catch (error) {
      console.error('Failed to save bookmark immediately:', error)
    }
  }

  /**
   * クリーンアップ（コンポーネントのアンマウント時に呼ぶ）
   */
  cleanup(bookId?: string): void {
    if (bookId) {
      const timer = this.saveTimers.get(bookId)
      if (timer) {
        clearTimeout(timer)
        this.saveTimers.delete(bookId)
      }
    } else {
      // すべてのタイマーをクリア
      this.saveTimers.forEach(timer => clearTimeout(timer))
      this.saveTimers.clear()
    }
  }
}

export const bookmarkStorage = new BookmarkStorage()