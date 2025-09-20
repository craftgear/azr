import React, { useEffect, useState } from 'react'
import type { LibraryBook, LibraryFilter } from '../../types/library'
import { libraryStorage } from '../../core/libraryStorage'
import './Library.css'

type LibraryProps = {
  onBookSelect: (book: LibraryBook) => void
  onClose: () => void
}

export const Library: React.FC<LibraryProps> = ({ onBookSelect, onClose }) => {
  const [books, setBooks] = useState<LibraryBook[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<LibraryFilter['sortBy']>('lastReadDate')
  const [sortOrder, setSortOrder] = useState<LibraryFilter['sortOrder']>('desc')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)

  useEffect(() => {
    loadBooks()
  }, [searchTerm, sortBy, sortOrder])

  const loadBooks = async () => {
    setIsLoading(true)
    try {
      const filter: LibraryFilter = {
        searchTerm,
        sortBy,
        sortOrder
      }
      console.log('Loading books with filter:', filter)
      const loadedBooks = await libraryStorage.getAllBooks(filter)
      console.log('Loaded books:', loadedBooks)
      console.log('Type of loadedBooks:', typeof loadedBooks)
      console.log('Is array?', Array.isArray(loadedBooks))
      setBooks(loadedBooks)
      console.log('Books state set')
    } catch (error) {
      console.error('Failed to load books:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = (book: LibraryBook, event: React.MouseEvent) => {
    event.stopPropagation()
    setDeleteTarget({ id: book.id, title: book.metadata.title || 'Untitled' })
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return

    try {
      await libraryStorage.deleteBook(deleteTarget.id)
      await loadBooks()
    } catch (error) {
      console.error('Failed to delete book:', error)
    } finally {
      setDeleteTarget(null)
    }
  }

  const cancelDelete = () => {
    setDeleteTarget(null)
  }

  const formatDate = (date?: Date) => {
    if (!date) return '未読'
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(new Date(date))
  }

  const formatProgress = (percent: number) => {
    if (percent === 0) return '未読'
    if (percent === 100) return '読了'
    return `${percent}%`
  }

  return (
    <div className="library-modal">
      <div className="library-container">
        <div className="library-header">
          <h2>ライブラリ</h2>
          <button className="library-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="library-controls">
          <input
            type="text"
            className="library-search"
            placeholder="タイトルまたは著者で検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <div className="library-sort">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as LibraryFilter['sortBy'])}
            >
              <option value="lastReadDate">最近読んだ順</option>
              <option value="addedDate">追加日順</option>
              <option value="title">タイトル順</option>
              <option value="author">著者順</option>
              <option value="progress">読書進捗順</option>
            </select>

            <button
              className="library-sort-order"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>

          <div className="library-view-toggle">
            <button
              className={viewMode === 'grid' ? 'active' : ''}
              onClick={() => setViewMode('grid')}
            >
              ⊞
            </button>
            <button
              className={viewMode === 'list' ? 'active' : ''}
              onClick={() => setViewMode('list')}
            >
              ☰
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="library-loading">読み込み中...</div>
        ) : books.length === 0 ? (
          <div className="library-empty">
            <p>ライブラリに本がありません</p>
            <p className="library-empty-hint">
              テキストファイルを開いて「ライブラリに保存」をクリックしてください
            </p>
          </div>
        ) : (
          <div className={`library-books library-${viewMode}`}>
            {books.map(book => (
              <div
                key={book.id}
                className="library-book"
                onClick={() => onBookSelect(book)}
              >
                {viewMode === 'grid' ? (
                  <>
                    <div className="library-book-thumbnail">
                      <div className="library-book-preview">
                        {book.metadata.thumbnail || '...'}
                      </div>
                      <div className="library-book-progress">
                        <div
                          className="library-book-progress-bar"
                          style={{ width: `${book.readingProgress.percentComplete}%` }}
                        />
                      </div>
                    </div>
                    <div className="library-book-info">
                      <h3 className="library-book-title">{book.metadata.title || 'Untitled'}</h3>
                      {book.metadata.author && (
                        <p className="library-book-author">{book.metadata.author}</p>
                      )}
                      <p className="library-book-date">
                        {formatDate(book.metadata.lastReadDate)}
                      </p>
                    </div>
                    <button
                      className="library-book-delete"
                      onClick={(e) => handleDelete(book, e)}
                    >
                      🗑
                    </button>
                  </>
                ) : (
                  <>
                    <div className="library-book-list-info">
                      <h3 className="library-book-title">{book.metadata.title || 'Untitled'}</h3>
                      {book.metadata.author && (
                        <span className="library-book-author">{book.metadata.author}</span>
                      )}
                    </div>
                    <div className="library-book-list-meta">
                      <span className="library-book-progress-text">
                        {formatProgress(book.readingProgress.percentComplete)}
                      </span>
                      <span className="library-book-date">
                        {formatDate(book.metadata.lastReadDate)}
                      </span>
                      <button
                        className="library-book-delete"
                        onClick={(e) => handleDelete(book, e)}
                      >
                        削除
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="library-footer">
          <p>{books.length} 冊の本</p>
        </div>
      </div>

      {/* 削除確認モーダル - Portalを使わずに高いz-indexで表示 */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto"
          style={{ zIndex: 2000 }}
        >
          <div className="flex min-h-full items-center justify-center p-4">
            {/* 背景のオーバーレイ */}
            <div
              className="fixed inset-0 bg-black bg-opacity-75 transition-opacity"
              onClick={cancelDelete}
            />

            {/* モーダルコンテンツ */}
            <div className="relative transform overflow-hidden rounded-lg bg-white shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
              {/* クローズボタン */}
              <button
                className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 z-10"
                onClick={cancelDelete}
              >
                ✕
              </button>

              <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                {/* アイコンとタイトル */}
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                    <h3 className="text-lg font-semibold leading-6 text-gray-900">
                      削除の確認
                    </h3>
                    <div className="mt-2">
                      {/* 本のタイトル */}
                      <div className="alert alert-warning">
                        <div>
                          <h3 className="font-bold">「{deleteTarget.title}」</h3>
                          <div className="text-xs">この本を削除しようとしています</div>
                        </div>
                      </div>

                      {/* 警告メッセージ */}
                      <p className="text-sm text-gray-500 mt-4">
                        この操作は取り消すことができません。本とその読書進捗がすべて削除されます。
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* アクションボタン */}
              <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 gap-2">
                <button
                  type="button"
                  className="btn btn-error w-full sm:w-auto"
                  onClick={confirmDelete}
                >
                  削除する
                </button>
                <button
                  type="button"
                  className="btn btn-outline w-full sm:w-auto"
                  onClick={cancelDelete}
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
