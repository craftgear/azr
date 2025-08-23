import React, { useState } from 'react'
import { Reader } from './components/Reader/Reader'
import { FileUpload } from './components/FileUpload/FileUpload'
import { Settings, type ReaderSettings } from './components/Settings/Settings'
import { parseAozoraText } from './core/enhancedAozoraParser'
import { readTextFile } from './utils/fileHelpers'
import type { ParsedAozoraDocument } from './types/aozora'
import './App.css'

const App: React.FC = () => {
  const [document, setDocument] = useState<ParsedAozoraDocument | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
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
    } catch (err) {
      setError('ファイルの読み込みに失敗しました。')
      console.error('ファイル読み込みエラー:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleNewFile = () => {
    setDocument(null)
    setError(null)
  }

  return (
    <div className={`app app-${settings.theme}`}>
      <header className="app-header">
        <h1 className="app-title">青空文庫リーダー</h1>
        <div className="app-header-actions">
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
          />
        )}
      </main>

      <Settings
        settings={settings}
        onSettingsChange={setSettings}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  )
}

export default App