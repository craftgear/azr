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
  paddingVertical?: number
  paddingHorizontal?: number
  rubySize?: 'small' | 'normal' | 'large'
  onScrollPositionChange?: (position: number) => void
  initialScrollPosition?: number
  isNavigationVisible?: boolean
}

export const Reader: React.FC<ReaderProps> = ({
  document,
  verticalMode = true,
  fontSize = 16,
  lineHeight = 1.8,
  theme = 'light',
  paddingVertical = 2,
  paddingHorizontal = 2,
  rubySize = 'normal',
  onScrollPositionChange,
  initialScrollPosition = 0,
  isNavigationVisible = true
}) => {
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

  // 設定変更前の読書位置を保持
  const prevTotalPagesRef = useRef(totalPages)
  const currentPageProgressRef = useRef(0) // 現在のページ進捗を保持

  // 設定が変更されたときに現在の進捗を保存
  useEffect(() => {
    if (totalPages > 0) {
      currentPageProgressRef.current = currentPage / totalPages
    }
  }, [fontSize, lineHeight, paddingVertical, paddingHorizontal, verticalMode, rubySize])

  // ページ分割計算（文章の区切りを考慮）
  const paginatedNodes = useMemo(() => {
    if (!document) return []
    
    // 文の終わりを検出する関数
    const isSentenceEnd = (text: string): boolean => {
      const sentenceEnders = ['。', '！', '？', '」', '』', '）', '.', '!', '?', '、']
      return sentenceEnders.some(ender => text.endsWith(ender))
    }
    
    // ノードを文の区切りで分割する関数
    const splitTextNodeAtSentence = (node: AozoraNode, remainingChars: number): { 
      beforeSplit: AozoraNode | null, 
      afterSplit: AozoraNode | null 
    } => {
      if (node.type !== 'text') {
        return { beforeSplit: node, afterSplit: null }
      }
      
      const text = node.content
      if (text.length <= remainingChars) {
        return { beforeSplit: node, afterSplit: null }
      }
      
      // 残り文字数内で最後の文の終わりを探す
      let splitIndex = -1
      for (let i = Math.min(remainingChars, text.length - 1); i >= 0; i--) {
        if (isSentenceEnd(text.substring(0, i + 1))) {
          splitIndex = i + 1
          break
        }
      }
      
      // 文の終わりが見つからない場合は、句読点で区切る
      if (splitIndex === -1) {
        const punctuation = ['、', '，', ',', '；', ';', '：', ':']
        for (let i = Math.min(remainingChars, text.length - 1); i >= 0; i--) {
          if (punctuation.includes(text[i])) {
            splitIndex = i + 1
            break
          }
        }
      }
      
      // それでも見つからない場合は、残り文字数で強制的に区切る
      if (splitIndex === -1) {
        splitIndex = Math.min(remainingChars, text.length)
      }
      
      const beforeText = text.substring(0, splitIndex)
      const afterText = text.substring(splitIndex)
      
      return {
        beforeSplit: beforeText ? { type: 'text', content: beforeText } : null,
        afterSplit: afterText ? { type: 'text', content: afterText } : null
      }
    }
    
    // ページ分割処理
    const pages: AozoraNode[][] = []
    let currentPageNodes: AozoraNode[] = []
    let currentPageCharCount = 0
    let pendingNode: AozoraNode | null = null
    
    // 1ページあたりの目安文字数（フォントサイズと画面サイズから推定）
    const paddingVerticalPx = paddingVertical * 16 * 2
    const paddingHorizontalPx = paddingHorizontal * 16 * 2
    
    // より正確な計算: ナビゲーションバーの高さも考慮
    const navHeight = 80 // ナビゲーションバーの高さ（px）
    const availableHeight = windowSize.height - paddingVerticalPx - navHeight
    const availableWidth = windowSize.width - paddingHorizontalPx
    
    const charsPerPage = verticalMode 
      ? Math.floor(availableHeight / fontSize) * Math.floor(availableWidth / (fontSize * lineHeight))
      : Math.floor(availableHeight / (fontSize * lineHeight)) * Math.floor(availableWidth / fontSize)
    
    // 安全マージン: 計算値の90%を使用してオーバーフローを防ぐ
    const safeCharsPerPage = Math.floor(charsPerPage * 0.9)
    const maxCharsPerPage = Math.max(100, safeCharsPerPage)
    
    console.log('Page calculation:', {
      verticalMode,
      windowSize,
      fontSize,
      lineHeight,
      paddingVertical,
      paddingHorizontal,
      rubySize,
      charsPerPage,
      maxCharsPerPage,
      totalNodes: document.nodes.length
    })
    
    for (let i = 0; i < document.nodes.length; i++) {
      let node = pendingNode || document.nodes[i]
      pendingNode = null
      
      // ノードの文字数を計算
      let nodeCharCount = 0
      if (node.type === 'text') {
        nodeCharCount = node.content.length
      } else if (node.type === 'ruby') {
        nodeCharCount = node.base.length
      } else if (node.type === 'emphasis_dots') {
        nodeCharCount = node.text.length
      } else if (node.type === 'heading') {
        nodeCharCount = node.content.length + 20
      }
      
      // 見出しは常に新しいページから始める（ページに何か入っている場合）
      if (node.type === 'heading' && currentPageNodes.length > 0 && currentPageCharCount > 0) {
        pages.push([...currentPageNodes])
        currentPageNodes = []
        currentPageCharCount = 0
      }
      
      // ページに収まるか確認
      if (currentPageCharCount + nodeCharCount > maxCharsPerPage && currentPageNodes.length > 0) {
        // テキストノードの場合、文の区切りで分割を試みる
        if (node.type === 'text') {
          const remainingChars = maxCharsPerPage - currentPageCharCount
          const { beforeSplit, afterSplit } = splitTextNodeAtSentence(node, remainingChars)
          
          if (beforeSplit) {
            currentPageNodes.push(beforeSplit)
          }
          
          // 現在のページを確定
          pages.push([...currentPageNodes])
          currentPageNodes = []
          currentPageCharCount = 0
          
          // 残りを次のページへ
          if (afterSplit) {
            pendingNode = afterSplit
            i-- // 同じインデックスを再処理
          }
        } else {
          // テキスト以外のノードは分割しない
          pages.push([...currentPageNodes])
          currentPageNodes = [node]
          currentPageCharCount = nodeCharCount
        }
      } else {
        // 現在のページに追加
        currentPageNodes.push(node)
        currentPageCharCount += nodeCharCount
      }
    }
    
    // 最後のページを追加
    if (currentPageNodes.length > 0) {
      pages.push(currentPageNodes)
    }
    
    // ページ数を更新
    setTotalPages(Math.max(1, pages.length))
    
    return pages
  }, [document, verticalMode, fontSize, lineHeight, paddingVertical, paddingHorizontal, windowSize, rubySize])

  // ページ再計算時に読書位置を維持
  useEffect(() => {
    if (prevTotalPagesRef.current > 0 && totalPages > 0 && prevTotalPagesRef.current !== totalPages) {
      // 保存された進捗または現在の進捗から新しいページ位置を計算
      const readingProgress = currentPageProgressRef.current || (currentPage / prevTotalPagesRef.current)
      const newPage = Math.round(readingProgress * totalPages)
      const validNewPage = Math.min(Math.max(0, newPage), totalPages - 1)
      
      console.log('Recalculating page position:', {
        oldPages: prevTotalPagesRef.current,
        newPages: totalPages,
        progress: readingProgress,
        oldPage: currentPage,
        newPage: validNewPage
      })
      
      setCurrentPage(validNewPage)
    }
    prevTotalPagesRef.current = totalPages
  }, [totalPages]) // currentPageを依存から削除して無限ループを防ぐ

  // 現在のページのノード
  const currentPageNodes = useMemo(() => {
    if (paginatedNodes.length === 0) return []
    const validPage = Math.min(currentPage, paginatedNodes.length - 1)
    return paginatedNodes[validPage] || []
  }, [paginatedNodes, currentPage])

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
  }, [verticalMode, goToNextPage, goToPreviousPage])

  // 初期ページ位置を設定
  useEffect(() => {
    if (initialScrollPosition > 0) {
      // initialScrollPositionをページ番号として扱う
      const pageNumber = Math.floor(initialScrollPosition)
      if (pageNumber >= 0 && pageNumber < totalPages) {
        setCurrentPage(pageNumber)
      }
    }
  }, [document, initialScrollPosition, totalPages])

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

  return (
    <div className="reader-pagination">
      <Page
        nodes={currentPageNodes}
        verticalMode={verticalMode}
        theme={theme}
        fontSize={fontSize}
        lineHeight={lineHeight}
        paddingVertical={paddingVertical}
        paddingHorizontal={paddingHorizontal}
        rubySize={rubySize}
        renderNode={renderNode}
      />
      
      {/* ページナビゲーション */}
      <div className={`page-navigation ${isNavigationVisible ? 'nav-visible' : 'nav-hidden'}`}>
        <button 
          onClick={goToNextPage}
          disabled={currentPage === totalPages - 1}
          className="page-nav-button page-nav-prev"
          aria-label="次のページ"
        >
          {verticalMode ? '←' : '↑'}
        </button>
        
        <span className="page-indicator">
          {currentPage + 1} / {totalPages}
        </span>
        
        <button 
          onClick={goToPreviousPage}
          disabled={currentPage === 0}
          className="page-nav-button page-nav-next"
          aria-label="前のページ"
        >
          {verticalMode ? '→' : '↓'}
        </button>
      </div>
    </div>
  )
}