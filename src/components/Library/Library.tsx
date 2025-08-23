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

  const handleDelete = async (id: string, event: React.MouseEvent) => {
    event.stopPropagation()
    if (confirm('この本を削除してもよろしいですか？')) {
      try {
        await libraryStorage.deleteBook(id)
        await loadBooks()
      } catch (error) {
        console.error('Failed to delete book:', error)
      }
    }
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

        {console.log('Rendering - isLoading:', isLoading, 'books:', books, 'books.length:', books.length)}
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
                      onClick={(e) => handleDelete(book.id, e)}
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
                        onClick={(e) => handleDelete(book.id, e)}
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
    </div>
  )
}