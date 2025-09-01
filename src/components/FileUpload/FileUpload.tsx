import React, { useRef, useEffect, useState } from 'react'
import './FileUpload.css'

type FileUploadProps = {
  onFileSelect: (file: File) => void
  accept?: string
  disabled?: boolean
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  accept = '.txt',
  disabled = false
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    // Tauriのファイルドロップイベントをリッスン
    const handleTauriFileDrop = async (event: any) => {
      console.log('Tauri file drop event:', event)
      
      if (event.payload && event.payload.paths && event.payload.paths.length > 0) {
        const filePath = event.payload.paths[0]
        
        // Tauriの場合、ファイルパスから内容を読み込む必要がある
        try {
          if (window.__TAURI__?.fs) {
            // Tauri FSを使用してファイルを読み込む
            const contents = await window.__TAURI__.fs.readTextFile(filePath)
            const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'file.txt'
            const blob = new Blob([contents], { type: 'text/plain' })
            const file = new File([blob], fileName, { type: 'text/plain' })
            onFileSelect(file)
            setIsDragging(false)
          }
        } catch (error) {
          console.error('Failed to read dropped file:', error)
          // エラーハンドリング
          setIsDragging(false)
        }
      }
    }

    // Tauri環境かチェック
    if (window.__TAURI__) {
      const { listen } = window.__TAURI__.event
      let unlisten: any
      
      listen('tauri://file-drop', handleTauriFileDrop).then((unlistenFn: any) => {
        unlisten = unlistenFn
      })
      
      // ドラッグオーバーイベントもリッスン
      let unlistenHover: any
      listen('tauri://file-drop-hover', () => {
        setIsDragging(true)
      }).then((fn: any) => {
        unlistenHover = fn
      })
      
      let unlistenCancelled: any
      listen('tauri://file-drop-cancelled', () => {
        setIsDragging(false)
      }).then((fn: any) => {
        unlistenCancelled = fn
      })
      
      return () => {
        if (unlisten) unlisten()
        if (unlistenHover) unlistenHover()
        if (unlistenCancelled) unlistenCancelled()
      }
    }
  }, [onFileSelect])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      onFileSelect(file)
    }
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(false)
    
    // ブラウザ環境でのファイルドロップ処理
    if (!window.__TAURI__) {
      const file = event.dataTransfer.files[0]
      if (file && file.type === 'text/plain') {
        onFileSelect(file)
      }
    }
    // Tauri環境では上記のイベントリスナーが処理する
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(true)
  }
  
  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(false)
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="file-upload-container">
      <div
        className={`file-upload-dropzone ${disabled ? 'disabled' : ''} ${isDragging ? 'dragging' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleClick()
          }
        }}
      >
        <svg 
          className="file-upload-icon" 
          width="48" 
          height="48" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <p className="file-upload-text">
          クリックまたはドラッグ＆ドロップで<br />
          青空文庫形式のテキストファイルを選択
        </p>
        <p className="file-upload-hint">
          対応形式: .txt (UTF-8, Shift_JIS)
        </p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        disabled={disabled}
        className="file-upload-input"
        aria-label="ファイルを選択"
      />
    </div>
  )
}