import React, { useState, useEffect } from 'react'
import { Reader } from './components/Reader/Reader'
import { FileUpload } from './components/FileUpload/FileUpload'
import { Settings, type ReaderSettings } from './components/Settings/Settings'
import { Library } from './components/Library/Library'
import { parseAozoraText } from './core/enhancedAozoraParser'
import { readTextFile } from './utils/fileHelpers'
import { libraryStorage } from './core/libraryStorage'
import type { ParsedAozoraDocument } from './types/aozora'
import type { LibraryBook } from './types/library'
import './App.css'

const App: React.FC = () => {
  const [document, setDocument] = useState<ParsedAozoraDocument | null>(null)
  const [currentBookId, setCurrentBookId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isLibraryOpen, setIsLibraryOpen] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [initialScrollPosition, setInitialScrollPosition] = useState(0)
  const [savedNotification, setSavedNotification] = useState(false)
  const [settings, setSettings] = useState<ReaderSettings>({
    verticalMode: true,
    fontSize: 16,
    lineHeight: 1.8,
    theme: 'light',
    padding: 2
  })

  const handleFileSelect = async (file: File) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const text = await readTextFile(file)
      const parsedDocument = parseAozoraText(text)
      setDocument(parsedDocument)
      setFileName(file.name)
      
      // 自動的にライブラリに保存
      try {
        const bookId = await libraryStorage.addBook(parsedDocument, {
          title: file.name.replace(/\.[^/.]+$/, '') || 'Untitled'
        })
        setCurrentBookId(bookId)
        console.log('自動保存完了:', bookId)
        
        // 保存完了通知を表示
        setSavedNotification(true)
        setTimeout(() => setSavedNotification(false), 3000)
      } catch (saveErr) {
        console.error('自動保存エラー:', saveErr)
        // 保存に失敗してもドキュメントは表示する
        setCurrentBookId(null)
      }
    } catch (err) {
      setError('ファイルの読み込みに失敗しました。')
      console.error('ファイル読み込みエラー:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // 手動保存機能は削除（自動保存のため不要）

  const handleBookSelect = async (book: LibraryBook) => {
    setDocument(book.document)
    setCurrentBookId(book.id)
    setIsLibraryOpen(false)
    setFileName(book.metadata.title)
    setInitialScrollPosition(book.readingProgress.lastPosition || 0)
  }

  const handleNewFile = () => {
    setDocument(null)
    setError(null)
    setCurrentBookId(null)
    setFileName(null)
  }

  const handleScrollPositionChange = async (position: number) => {
    if (!currentBookId || !document) return
    
    try {
      await libraryStorage.updateReadingProgress(currentBookId, {
        lastPosition: position
      })
    } catch (err) {
      console.error('進捗更新エラー:', err)
    }
  }

  return (
    <div className={`app app-${settings.theme}`}>
      <header className="app-header">
        <h1 className="app-title">青空文庫リーダー</h1>
        <div className="app-header-actions">
          <button
            className="app-button"
            onClick={() => setIsLibraryOpen(true)}
            aria-label="ライブラリを開く"
          >
            📚 ライブラリ
          </button>
          {document && (
            <>
              <button
                className="app-button"
                onClick={() => setIsSettingsOpen(true)}
                aria-label="設定を開く"
              >
                ⚙️ 設定
              </button>
              <button
                className="app-button"
                onClick={handleNewFile}
                aria-label="新しいファイルを開く"
              >
                📁 新規
              </button>
            </>
          )}
        </div>
      </header>

      <main className="app-main">
        {isLoading && (
          <div className="app-loading">
            <p>読み込み中...</p>
          </div>
        )}

        {error && (
          <div className="app-error">
            <p>{error}</p>
            <button onClick={() => setError(null)}>閉じる</button>
          </div>
        )}

        {savedNotification && (
          <div className="app-notification">
            📚 ライブラリに保存しました
          </div>
        )}

        {!document && !isLoading && (
          <div className="app-upload">
            <FileUpload
              onFileSelect={handleFileSelect}
              disabled={isLoading}
            />
          </div>
        )}

        {document && !isLoading && (
          <Reader
            document={document}
            verticalMode={settings.verticalMode}
            fontSize={settings.fontSize}
            lineHeight={settings.lineHeight}
            theme={settings.theme}
            padding={settings.padding}
            onScrollPositionChange={handleScrollPositionChange}
            initialScrollPosition={initialScrollPosition}
          />
        )}
      </main>

      <Settings
        settings={settings}
        onSettingsChange={setSettings}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {isLibraryOpen && (
        <Library
          onBookSelect={handleBookSelect}
          onClose={() => setIsLibraryOpen(false)}
        />
      )}
    </div>
  )
}

export default App