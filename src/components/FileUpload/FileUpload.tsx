import React, { useRef } from 'react'
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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      onFileSelect(file)
    }
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    
    const file = event.dataTransfer.files[0]
    if (file && file.type === 'text/plain') {
      onFileSelect(file)
    }
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="file-upload-container">
      <div
        className={`file-upload-dropzone ${disabled ? 'disabled' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
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