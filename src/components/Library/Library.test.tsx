import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { Library } from './Library'
import { libraryStorage } from '../../core/libraryStorage'
import type { LibraryBook } from '../../types/library'

// libraryStorageをモック
vi.mock('../../core/libraryStorage', () => ({
  libraryStorage: {
    init: vi.fn(),
    getAllBooks: vi.fn(),
    deleteBook: vi.fn()
  }
}))

describe('Library', () => {
  const mockOnBookSelect = vi.fn()
  const mockOnClose = vi.fn()

  const mockBooks: LibraryBook[] = [
    {
      id: 'book1',
      document: {
        nodes: [
          { type: 'text', content: '底本：「吾輩は猫である」新潮文庫' }
        ]
      },
      metadata: {
        title: '吾輩は猫である',
        author: '夏目漱石',
        addedDate: new Date('2024-01-01'),
        lastReadDate: new Date('2024-01-15'),
        thumbnail: '吾輩は猫である。名前はまだ無い...'
      },
      readingProgress: {
        lastPosition: 500,
        totalLength: 1000,
        percentComplete: 50
      }
    },
    {
      id: 'book2',
      document: {
        nodes: [
          { type: 'text', content: 'テキスト' }
        ]
      },
      metadata: {
        title: undefined, // タイトルなしのケース
        author: undefined,
        addedDate: new Date('2024-01-02'),
        thumbnail: undefined
      },
      readingProgress: {
        lastPosition: 0,
        totalLength: 500,
        percentComplete: 0
      }
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should load and display books on mount', async () => {
    vi.mocked(libraryStorage.getAllBooks).mockResolvedValue(mockBooks)

    render(<Library onBookSelect={mockOnBookSelect} onClose={mockOnClose} />)

    await waitFor(() => {
      expect(libraryStorage.getAllBooks).toHaveBeenCalled()
    })

    // タイトルがある本
    expect(screen.getByText('吾輩は猫である')).toBeDefined()
    expect(screen.getByText('夏目漱石')).toBeDefined()

    // タイトルがない本は'Untitled'と表示
    expect(screen.getByText('Untitled')).toBeDefined()
  })

  it('should handle empty library', async () => {
    vi.mocked(libraryStorage.getAllBooks).mockResolvedValue([])

    render(<Library onBookSelect={mockOnBookSelect} onClose={mockOnClose} />)

    await waitFor(() => {
      expect(screen.getByText('ライブラリに本がありません')).toBeDefined()
    })
  })

  it('should call onBookSelect when a book is clicked', async () => {
    vi.mocked(libraryStorage.getAllBooks).mockResolvedValue(mockBooks)

    render(<Library onBookSelect={mockOnBookSelect} onClose={mockOnClose} />)

    await waitFor(() => {
      expect(screen.getByText('吾輩は猫である')).toBeDefined()
    })

    const bookElement = screen.getByText('吾輩は猫である').closest('.library-book')
    fireEvent.click(bookElement!)

    expect(mockOnBookSelect).toHaveBeenCalledWith(mockBooks[0])
  })

  it('should filter books by search term', async () => {
    vi.mocked(libraryStorage.getAllBooks).mockResolvedValue(mockBooks)

    const { container } = render(<Library onBookSelect={mockOnBookSelect} onClose={mockOnClose} />)

    await waitFor(() => {
      expect(screen.getByText('吾輩は猫である')).toBeDefined()
    })

    const searchInput = container.querySelector('.library-search') as HTMLInputElement
    fireEvent.change(searchInput, { target: { value: '猫' } })

    await waitFor(() => {
      expect(libraryStorage.getAllBooks).toHaveBeenCalledWith({
        searchTerm: '猫',
        sortBy: 'lastReadDate',
        sortOrder: 'desc'
      })
    })
  })

  it('should delete a book when delete button is clicked', async () => {
    vi.mocked(libraryStorage.getAllBooks).mockResolvedValue(mockBooks)
    vi.mocked(libraryStorage.deleteBook).mockResolvedValue(undefined)

    render(<Library onBookSelect={mockOnBookSelect} onClose={mockOnClose} />)

    await waitFor(() => {
      expect(screen.getByText('吾輩は猫である')).toBeDefined()
    })

    const deleteButtons = screen.getAllByText('🗑')
    fireEvent.click(deleteButtons[0])

    // モーダルが表示されることを確認
    await waitFor(() => {
      expect(screen.getByText('削除の確認')).toBeDefined()
      expect(screen.getByText('「吾輩は猫である」')).toBeDefined()
    })

    // 削除ボタンをクリック
    const confirmButton = screen.getByRole('button', { name: /削除する/ })
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(libraryStorage.deleteBook).toHaveBeenCalledWith('book1')
    })
  })

  it('should close library when close button is clicked', () => {
    render(<Library onBookSelect={mockOnBookSelect} onClose={mockOnClose} />)

    const closeButton = screen.getByText('✕')
    fireEvent.click(closeButton)

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should handle undefined title in sorting', async () => {
    const booksWithUndefinedTitles: LibraryBook[] = [
      {
        ...mockBooks[0],
        id: 'book3',
        metadata: { ...mockBooks[0].metadata, title: 'ぼ' }
      },
      {
        ...mockBooks[1],
        metadata: { ...mockBooks[1].metadata, title: undefined }
      },
      {
        ...mockBooks[0],
        id: 'book4',
        metadata: { ...mockBooks[0].metadata, title: 'あ' }
      }
    ]

    vi.mocked(libraryStorage.getAllBooks).mockResolvedValue(booksWithUndefinedTitles)

    const { container } = render(<Library onBookSelect={mockOnBookSelect} onClose={mockOnClose} />)

    const sortSelect = container.querySelector('select') as HTMLSelectElement
    fireEvent.change(sortSelect, { target: { value: 'title' } })

    await waitFor(() => {
      expect(libraryStorage.getAllBooks).toHaveBeenCalledWith({
        searchTerm: '',
        sortBy: 'title',
        sortOrder: 'desc'
      })
    })
  })

  it('should format dates correctly', async () => {
    vi.mocked(libraryStorage.getAllBooks).mockResolvedValue(mockBooks)

    render(<Library onBookSelect={mockOnBookSelect} onClose={mockOnClose} />)

    await waitFor(() => {
      // 日付のフォーマットを確認
      expect(screen.getByText(/2024/)).toBeDefined()
    })
  })

  it('should show loading state initially', () => {
    vi.mocked(libraryStorage.getAllBooks).mockImplementation(
      () => new Promise(() => {}) // 永続的にpending
    )

    render(<Library onBookSelect={mockOnBookSelect} onClose={mockOnClose} />)

    expect(screen.getByText('読み込み中...')).toBeDefined()
  })

  it('should handle errors gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(libraryStorage.getAllBooks).mockRejectedValue(new Error('Failed to load'))

    render(<Library onBookSelect={mockOnBookSelect} onClose={mockOnClose} />)

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load books:', expect.any(Error))
    })

    consoleErrorSpy.mockRestore()
  })
})