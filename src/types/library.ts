import type { ParsedAozoraDocument } from './aozora'

export type LibraryBook = {
  id: string
  document: ParsedAozoraDocument
  metadata: BookMetadata
  readingProgress: ReadingProgress
  userNotes?: UserNotes
}

export type BookMetadata = {
  title: string
  author?: string
  addedDate: Date
  lastReadDate?: Date
  fileSize?: number
  thumbnail?: string  // 最初のページのプレビュー
  tags?: string[]
}

export type ReadingProgress = {
  lastPosition: number  // スクロール位置またはページ番号
  totalLength: number   // 全体の長さ
  percentComplete: number
  bookmarks?: Bookmark[]
  readingTime?: number  // 累計読書時間（分）
}

export type Bookmark = {
  id: string
  position: number
  note?: string
  createdAt: Date
}

export type UserNotes = {
  highlights?: Highlight[]
  annotations?: Annotation[]
}

export type Highlight = {
  id: string
  startPosition: number
  endPosition: number
  text: string
  color?: string
  createdAt: Date
}

export type Annotation = {
  id: string
  position: number
  note: string
  createdAt: Date
}

export type LibraryFilter = {
  searchTerm?: string
  tags?: string[]
  sortBy?: 'title' | 'author' | 'addedDate' | 'lastReadDate' | 'progress'
  sortOrder?: 'asc' | 'desc'
}

export type LibraryStats = {
  totalBooks: number
  completedBooks: number
  totalReadingTime: number
  favoriteGenres?: string[]
}