import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { bookmarkStorage } from './bookmarkStorage'
import { libraryStorage } from './libraryStorage'

// Mock libraryStorage
vi.mock('./libraryStorage', () => ({
  libraryStorage: {
    updateReadingProgress: vi.fn(),
    getBook: vi.fn()
  }
}))

describe('BookmarkStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    bookmarkStorage.cleanup()
  })

  describe('saveBookmark', () => {
    it('デバウンスされた保存を行う', async () => {
      const bookId = 'test-book-1'
      const pageIndex = 5

      // ブックマーク保存を実行
      await bookmarkStorage.saveBookmark(bookId, pageIndex)

      // まだ保存されていないことを確認
      expect(libraryStorage.updateReadingProgress).not.toHaveBeenCalled()

      // 500ms進める
      vi.advanceTimersByTime(500)

      // 保存されたことを確認
      expect(libraryStorage.updateReadingProgress).toHaveBeenCalledTimes(1)
      expect(libraryStorage.updateReadingProgress).toHaveBeenCalledWith(bookId, {
        lastPosition: pageIndex
      })
    })

    it('連続した保存呼び出しをデバウンスする', async () => {
      const bookId = 'test-book-1'

      // 複数回連続で保存を呼び出す
      await bookmarkStorage.saveBookmark(bookId, 1)
      vi.advanceTimersByTime(100)
      await bookmarkStorage.saveBookmark(bookId, 2)
      vi.advanceTimersByTime(100)
      await bookmarkStorage.saveBookmark(bookId, 3)

      // まだ保存されていないことを確認
      expect(libraryStorage.updateReadingProgress).not.toHaveBeenCalled()

      // 500ms進める（最後の呼び出しから）
      vi.advanceTimersByTime(500)

      // 最後の値で一度だけ保存されたことを確認
      expect(libraryStorage.updateReadingProgress).toHaveBeenCalledTimes(1)
      expect(libraryStorage.updateReadingProgress).toHaveBeenCalledWith(bookId, {
        lastPosition: 3
      })
    })

    it('エラー時もエラーハンドリングを行う', async () => {
      const bookId = 'test-book-1'
      const pageIndex = 5
      const error = new Error('Save failed')

      vi.mocked(libraryStorage.updateReadingProgress).mockRejectedValue(error)

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      await bookmarkStorage.saveBookmark(bookId, pageIndex)
      vi.advanceTimersByTime(500)

      // エラーが適切に処理されることを待つ
      await vi.runAllTimersAsync()

      expect(consoleError).toHaveBeenCalledWith('Failed to save bookmark:', error)
      consoleError.mockRestore()
    })
  })

  describe('loadBookmark', () => {
    it('保存されたブックマークを読み込む', async () => {
      const bookId = 'test-book-1'
      const mockBook = {
        id: bookId,
        readingProgress: {
          lastPosition: 10,
          totalLength: 100,
          percentComplete: 10
        }
      }

      vi.mocked(libraryStorage.getBook).mockResolvedValue(mockBook as any)

      const result = await bookmarkStorage.loadBookmark(bookId)

      expect(libraryStorage.getBook).toHaveBeenCalledWith(bookId)
      expect(result).toBe(10)
    })

    it('ブックマークが存在しない場合は0を返す', async () => {
      const bookId = 'test-book-1'
      const mockBook = {
        id: bookId,
        readingProgress: {
          totalLength: 100,
          percentComplete: 0
        }
      }

      vi.mocked(libraryStorage.getBook).mockResolvedValue(mockBook as any)

      const result = await bookmarkStorage.loadBookmark(bookId)

      expect(result).toBe(0)
    })

    it('本が存在しない場合はnullを返す', async () => {
      const bookId = 'non-existent-book'

      vi.mocked(libraryStorage.getBook).mockResolvedValue(null)

      const result = await bookmarkStorage.loadBookmark(bookId)

      expect(result).toBe(null)
    })

    it('エラー時はnullを返す', async () => {
      const bookId = 'test-book-1'
      const error = new Error('Load failed')

      vi.mocked(libraryStorage.getBook).mockRejectedValue(error)

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await bookmarkStorage.loadBookmark(bookId)

      expect(result).toBe(null)
      expect(consoleError).toHaveBeenCalledWith('Failed to load bookmark:', error)

      consoleError.mockRestore()
    })
  })

  describe('saveBookmarkImmediate', () => {
    it('即座に保存を実行する', async () => {
      const bookId = 'test-book-1'
      const pageIndex = 7

      await bookmarkStorage.saveBookmarkImmediate(bookId, pageIndex)

      // 即座に保存されたことを確認
      expect(libraryStorage.updateReadingProgress).toHaveBeenCalledTimes(1)
      expect(libraryStorage.updateReadingProgress).toHaveBeenCalledWith(bookId, {
        lastPosition: pageIndex
      })
    })

    it('既存のデバウンスタイマーをクリアする', async () => {
      const bookId = 'test-book-1'

      // デバウンス保存を開始
      await bookmarkStorage.saveBookmark(bookId, 5)

      // 即座保存を実行
      await bookmarkStorage.saveBookmarkImmediate(bookId, 10)

      // 即座に保存されたことを確認
      expect(libraryStorage.updateReadingProgress).toHaveBeenCalledTimes(1)
      expect(libraryStorage.updateReadingProgress).toHaveBeenCalledWith(bookId, {
        lastPosition: 10
      })

      // タイマーを進めても追加の保存が行われないことを確認
      vi.advanceTimersByTime(500)
      expect(libraryStorage.updateReadingProgress).toHaveBeenCalledTimes(1)
    })

    it('エラー時もエラーハンドリングを行う', async () => {
      const bookId = 'test-book-1'
      const pageIndex = 5
      const error = new Error('Immediate save failed')

      vi.mocked(libraryStorage.updateReadingProgress).mockRejectedValue(error)

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      await bookmarkStorage.saveBookmarkImmediate(bookId, pageIndex)

      expect(consoleError).toHaveBeenCalledWith('Failed to save bookmark immediately:', error)

      consoleError.mockRestore()
    })
  })

  describe('cleanup', () => {
    it('特定の本のタイマーをクリアする', async () => {
      const bookId1 = 'test-book-1'
      const bookId2 = 'test-book-2'

      // 2つの本でデバウンス保存を開始
      await bookmarkStorage.saveBookmark(bookId1, 5)
      await bookmarkStorage.saveBookmark(bookId2, 10)

      // book1のタイマーをクリア
      bookmarkStorage.cleanup(bookId1)

      // タイマーを進める
      vi.advanceTimersByTime(500)

      // book2のみ保存されたことを確認
      expect(libraryStorage.updateReadingProgress).toHaveBeenCalledTimes(1)
      expect(libraryStorage.updateReadingProgress).toHaveBeenCalledWith(bookId2, {
        lastPosition: 10
      })
    })

    it('すべてのタイマーをクリアする', async () => {
      const bookId1 = 'test-book-1'
      const bookId2 = 'test-book-2'

      // 2つの本でデバウンス保存を開始
      await bookmarkStorage.saveBookmark(bookId1, 5)
      await bookmarkStorage.saveBookmark(bookId2, 10)

      // すべてのタイマーをクリア
      bookmarkStorage.cleanup()

      // タイマーを進める
      vi.advanceTimersByTime(500)

      // 何も保存されていないことを確認
      expect(libraryStorage.updateReadingProgress).not.toHaveBeenCalled()
    })
  })
})