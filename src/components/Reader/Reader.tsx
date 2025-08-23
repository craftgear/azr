import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import type { ParsedAozoraDocument, AozoraNode } from '../../types/aozora'
import { Page } from '../Page/Page'
import './Reader.css'

type ReaderProps = {
  document: ParsedAozoraDocument | null
  verticalMode?: boolean
  fontSize?: number
  lineHeight?: number
  theme?: 'light' | 'dark'
  padding?: number
  rubySize?: 'small' | 'normal' | 'large'
  paginationMode?: boolean
  onScrollPositionChange?: (position: number) => void
  initialScrollPosition?: number
}

export const Reader: React.FC<ReaderProps> = ({
  document,
  verticalMode = true,
  fontSize = 16,
  lineHeight = 1.8,
  theme = 'light',
  padding = 2,
  rubySize = 'normal',
  paginationMode = true,
  onScrollPositionChange,
  initialScrollPosition = 0
}) => {
  const readerRef = useRef<HTMLDivElement>(null)
  const lastScrollPosition = useRef(0)
  const scrollTimeout = useRef<NodeJS.Timeout | undefined>()
  const [currentPage, setCurrentPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  // ウィンドウサイズの追跡（ページ再計算用）
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight })
  
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight })
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // ページ分割計算
  const paginatedNodes = useMemo(() => {
    if (!document || !paginationMode) return []
    
    // 文字数ベースでページ分割（簡易版）
    const pages: AozoraNode[][] = []
    let currentPageNodes: AozoraNode[] = []
    let currentPageCharCount = 0
    
    // 1ページあたりの目安文字数（フォントサイズと画面サイズから推定）
    const charsPerPage = verticalMode 
      ? Math.floor((windowSize.height - 100) / fontSize) * Math.floor((windowSize.width - 100) / (fontSize * lineHeight))
      : Math.floor((windowSize.height - 200) / (fontSize * lineHeight)) * Math.floor((windowSize.width - 100) / fontSize)
    
    const maxCharsPerPage = Math.max(100, charsPerPage) // 最低100文字
    
    console.log('Page calculation:', {
      verticalMode,
      windowSize,
      fontSize,
      lineHeight,
      charsPerPage,
      maxCharsPerPage,
      totalNodes: document.nodes.length
    })
    
    document.nodes.forEach((node) => {
      // ノードの文字数を概算
      let nodeCharCount = 0
      if (node.type === 'text') {
        nodeCharCount = node.content.length
      } else if (node.type === 'ruby') {
        nodeCharCount = node.base.length
      } else if (node.type === 'emphasis_dots') {
        nodeCharCount = node.text.length
      } else if (node.type === 'heading') {
        nodeCharCount = node.content.length + 20 // 見出しは余白を考慮
      }
      
      // ページに収まるか確認
      if (currentPageCharCount + nodeCharCount > maxCharsPerPage && currentPageNodes.length > 0) {
        // 新しいページを開始
        pages.push([...currentPageNodes])
        currentPageNodes = [node]
        currentPageCharCount = nodeCharCount
      } else {
        // 現在のページに追加
        currentPageNodes.push(node)
        currentPageCharCount += nodeCharCount
      }
    })
    
    // 最後のページを追加
    if (currentPageNodes.length > 0) {
      pages.push(currentPageNodes)
    }
    
    // ページ数を更新
    setTotalPages(Math.max(1, pages.length))
    
    return pages
  }, [document, paginationMode, verticalMode, fontSize, lineHeight, windowSize])

  // 現在のページのノード
  const currentPageNodes = useMemo(() => {
    if (!paginationMode || paginatedNodes.length === 0) return []
    const validPage = Math.min(currentPage, paginatedNodes.length - 1)
    return paginatedNodes[validPage] || []
  }, [paginationMode, paginatedNodes, currentPage])

  // ページナビゲーション
  const goToNextPage = useCallback(() => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(prev => prev + 1)
      if (onScrollPositionChange) {
        onScrollPositionChange(currentPage + 1)
      }
    }
  }, [currentPage, totalPages, onScrollPositionChange])

  const goToPreviousPage = useCallback(() => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1)
      if (onScrollPositionChange) {
        onScrollPositionChange(currentPage - 1)
      }
    }
  }, [currentPage, onScrollPositionChange])

  // キーボードナビゲーション
  useEffect(() => {
    if (!paginationMode) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          if (verticalMode) {
            goToNextPage() // 縦書きでは左が次
          } else {
            goToPreviousPage()
          }
          e.preventDefault()
          break
        case 'ArrowRight':
          if (verticalMode) {
            goToPreviousPage() // 縦書きでは右が前
          } else {
            goToNextPage()
          }
          e.preventDefault()
          break
        case 'ArrowUp':
          if (!verticalMode) {
            goToPreviousPage()
            e.preventDefault()
          }
          break
        case 'ArrowDown':
          if (!verticalMode) {
            goToNextPage()
            e.preventDefault()
          }
          break
        case ' ':
          if (e.shiftKey) {
            goToPreviousPage()
          } else {
            goToNextPage()
          }
          e.preventDefault()
          break
        case 'PageUp':
          goToPreviousPage()
          e.preventDefault()
          break
        case 'PageDown':
          goToNextPage()
          e.preventDefault()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [paginationMode, verticalMode, goToNextPage, goToPreviousPage])

  // 初期スクロール位置を設定（ページモードの場合はページ番号として扱う）
  useEffect(() => {
    if (paginationMode && initialScrollPosition > 0) {
      // initialScrollPositionをページ番号として扱う
      const pageNumber = Math.floor(initialScrollPosition)
      if (pageNumber >= 0 && pageNumber < totalPages) {
        setCurrentPage(pageNumber)
      }
    } else if (readerRef.current && initialScrollPosition > 0 && !paginationMode) {
      if (verticalMode) {
        readerRef.current.scrollLeft = initialScrollPosition
      } else {
        readerRef.current.scrollTop = initialScrollPosition
      }
    }
  }, [document, initialScrollPosition, verticalMode, paginationMode, totalPages])

  // スクロール位置の変更を通知（デバウンス付き）
  const handleScroll = useCallback(() => {
    if (!readerRef.current || !onScrollPositionChange) return

    const currentPosition = verticalMode 
      ? readerRef.current.scrollLeft 
      : readerRef.current.scrollTop

    // 位置が変わった場合のみ更新
    if (Math.abs(currentPosition - lastScrollPosition.current) > 10) {
      lastScrollPosition.current = currentPosition

      // デバウンス処理
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current)
      }
      
      scrollTimeout.current = setTimeout(() => {
        onScrollPositionChange(currentPosition)
      }, 500) // 500ms後に保存
    }
  }, [verticalMode, onScrollPositionChange])

  useEffect(() => {
    const reader = readerRef.current
    if (!reader) return

    reader.addEventListener('scroll', handleScroll)
    return () => {
      reader.removeEventListener('scroll', handleScroll)
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current)
      }
    }
  }, [handleScroll])
  // ノードをReact要素に変換
  const renderNode = (node: AozoraNode, index: number): React.ReactElement | string => {
    switch (node.type) {
      case 'text':
        // 改行を処理
        const parts = node.content.split('\n')
        
        const processTextPart = (text: string) => {
          // 縦書きモードで連続するハイフンまたはダッシュを検出
          if (verticalMode && /[-—－ー─]{2,}/.test(text)) {
            // 連続するダッシュ記号を特別な処理
            const segments = text.split(/([-—－ー─]{2,})/g)
            return segments.map((segment, idx) => {
              if (/^[-—－ー─]{2,}$/.test(segment)) {
                // 連続するダッシュを縦線として表示
                return <span key={idx} className="dash-line">{segment}</span>
              }
              return segment
            })
          }
          return text
        }
        
        if (parts.length === 1) {
          return processTextPart(parts[0])
        }
        
        return (
          <React.Fragment key={index}>
            {parts.map((part, i) => (
              <React.Fragment key={i}>
                {processTextPart(part)}
                {i < parts.length - 1 && <br />}
              </React.Fragment>
            ))}
          </React.Fragment>
        )
      
      case 'ruby':
        return (
          <ruby key={index}>
            {node.base}
            <rt>{node.reading}</rt>
          </ruby>
        )
      
      // 傍点（emphasis dots）
      case 'emphasis_dots':
        return (
          <span key={index} className="emphasis-dots">
            {node.text}
          </span>
        )
      
      // テキストサイズ変更
      case 'text_size':
        return (
          <span key={index} className={`text-size-${node.size}`}>
            {node.content.map((child, i) => renderNode(child, i))}
          </span>
        )
      
      // 見出し
      case 'heading':
        const HeadingClass = `heading-${node.level}`
        if (node.level === 'large') {
          return <h2 key={index} className={HeadingClass}>{node.content}</h2>
        } else if (node.level === 'medium') {
          return <h3 key={index} className={HeadingClass}>{node.content}</h3>
        } else {
          return <h4 key={index} className={HeadingClass}>{node.content}</h4>
        }
      
      // ブロック字下げ
      case 'block_indent':
        return (
          <div 
            key={index} 
            className="block-indent"
            style={{ paddingLeft: `${node.indent}em` }}
          >
            {node.content.map((child, i) => renderNode(child, i))}
          </div>
        )
      
      // 特殊文字説明（ツールチップとして表示）
      case 'special_char_note':
        return (
          <span 
            key={index}
            className="special-char"
            title={node.description}
          >
            {node.char}
          </span>
        )
      
      case 'header':
        const HeaderTag = `h${Math.min(Math.max(node.level, 1), 6)}` as keyof JSX.IntrinsicElements
        return (
          <HeaderTag key={index}>
            {node.content}
          </HeaderTag>
        )
      
      case 'emphasis':
        return (
          <span key={index} className={`emphasis emphasis-${node.level}`}>
            {node.content}
          </span>
        )
      
      default:
        return ''
    }
  }

  if (!document) {
    return (
      <div className="reader-empty">
        <p>テキストを読み込んでください</p>
      </div>
    )
  }

  // ページモード
  if (paginationMode) {
    return (
      <div className="reader-pagination">
        <Page
          nodes={currentPageNodes}
          verticalMode={verticalMode}
          theme={theme}
          fontSize={fontSize}
          lineHeight={lineHeight}
          rubySize={rubySize}
          renderNode={renderNode}
        />
        
        {/* ページナビゲーション */}
        <div className="page-navigation">
          <button 
            onClick={goToPreviousPage}
            disabled={currentPage === 0}
            className="page-nav-button page-nav-prev"
            aria-label="前のページ"
          >
            {verticalMode ? '→' : '↑'}
          </button>
          
          <span className="page-indicator">
            {currentPage + 1} / {totalPages}
          </span>
          
          <button 
            onClick={goToNextPage}
            disabled={currentPage === totalPages - 1}
            className="page-nav-button page-nav-next"
            aria-label="次のページ"
          >
            {verticalMode ? '←' : '↓'}
          </button>
        </div>
      </div>
    )
  }

  // スクロールモード（従来の実装）
  const readerClass = `reader reader-${theme} ${verticalMode ? 'reader-vertical' : 'reader-horizontal'} ruby-${rubySize}`
  const readerStyle: React.CSSProperties = {
    fontSize: `${fontSize}px`,
    lineHeight: lineHeight,
    padding: !verticalMode ? `${padding}rem` : undefined,
    '--reader-padding': `${padding}rem`
  } as React.CSSProperties

  return (
    <div className={readerClass} style={readerStyle} ref={readerRef}>
      <div className="reader-content">
        {document.nodes.map((node, index) => renderNode(node, index))}
      </div>
    </div>
  )
}