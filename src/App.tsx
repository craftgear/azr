import React, { useState, useEffect, useCallback } from 'react'
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
  const [settings, setSettings] = useState<ReaderSettings>({
    verticalMode: true,
    fontSize: 16,
    lineHeight: 1.8,
    theme: 'light',
    padding: 2
  })

  // 最後に開いた本を読み込む
  useEffect(() => {
    const loadLastBook = async () => {
      try {
        const lastBookId = localStorage.getItem('lastOpenedBookId')
        if (lastBookId) {
          setIsLoading(true)
          const book = await libraryStorage.getBook(lastBookId)
          if (book) {
            setDocument(book.document)
            setCurrentBookId(book.id)
            
            // タイトルを抽出（底本優先）
            let title: string | undefined
            const textNodes = book.document.nodes.filter(node => node.type === 'text' && 'content' in node)
            for (let i = textNodes.length - 1; i >= 0; i--) {
              const content = textNodes[i].content as string
              const match = content.match(/底本：「(.+?)」/)
              if (match && match[1]) {
                title = match[1].replace(/[\(（].+?[\)）]/g, '').trim()
                if (title) break
              }
            }
            
            // フォールバック
            if (!title) {
              title = book.metadata.title || 'Untitled'
            }
            
            setFileName(title)
            setInitialScrollPosition(book.readingProgress.lastPosition || 0)
          }
          setIsLoading(false)
        }
      } catch (err) {
        console.error('最後の本の読み込みエラー:', err)
        setIsLoading(false)
      }
    }
    
    loadLastBook()
  }, [])

  // 開いた本のIDを保存
  const saveLastOpenedBook = useCallback((bookId: string) => {
    localStorage.setItem('lastOpenedBookId', bookId)
  }, [])

  const handleFileSelect = async (file: File) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const text = await readTextFile(file)
      const parsedDocument = parseAozoraText(text)
      setDocument(parsedDocument)
      
      // ドキュメントからタイトルを抽出
      let title: string | undefined
      
      // 底本情報からタイトルを抽出（最優先）
      const textNodes = parsedDocument.nodes.filter(node => node.type === 'text' && 'content' in node)
      for (let i = textNodes.length - 1; i >= 0; i--) {
        const content = textNodes[i].content as string
        const match = content.match(/底本：「(.+?)」/)
        if (match && match[1]) {
          // 副題などを除去（括弧内のテキストを削除）
          title = match[1].replace(/[\(（].+?[\)）]/g, '').trim()
          if (title) break
        }
      }
      
      // 底本が見つからない場合のフォールバック
      if (!title) {
        // メタデータをチェック
        title = parsedDocument.metadata?.title
        
        // 最後の手段としてファイル名を使用
        if (!title) {
          title = file.name.replace(/\.[^/.]+$/, '') || 'Untitled'
        }
      }
      
      console.log('抽出されたタイトル:', title)
      setFileName(title)
      
      // 自動的にライブラリに保存
      try {
        const bookId = await libraryStorage.addBook(parsedDocument, {
          title: title
        })
        setCurrentBookId(bookId)
        saveLastOpenedBook(bookId)
        console.log('自動保存完了:', bookId)
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
    saveLastOpenedBook(book.id)
    setIsLibraryOpen(false)
    
    // タイトルを抽出（底本優先）
    let title: string | undefined
    const textNodes = book.document.nodes.filter(node => node.type === 'text' && 'content' in node)
    for (let i = textNodes.length - 1; i >= 0; i--) {
      const content = textNodes[i].content as string
      const match = content.match(/底本：「(.+?)」/)
      if (match && match[1]) {
        title = match[1].replace(/[\(（].+?[\)）]/g, '').trim()
        if (title) break
      }
    }
    
    // フォールバック
    if (!title) {
      title = book.metadata.title || 'Untitled'
    }
    
    setFileName(title)
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
        <h1 className="app-title">{fileName || ''}</h1>
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