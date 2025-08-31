import React, { useEffect, useRef, useState, useMemo } from 'react'
import type { ParsedAozoraDocument, AozoraNode } from '../../types/aozora'
import { calculateReaderCapacity } from '../../utils/readerCapacityCalculator'
import { divideIntoPages, getNodesFromPage, type Page } from '../../utils/pageDivider'
import './Reader.css'

type ReaderProps = {
  document: ParsedAozoraDocument | null
  verticalMode?: boolean
  fontSize?: number
  lineHeight?: number
  theme?: 'light' | 'dark'
  rubySize?: 'small' | 'normal' | 'large'
  smoothScroll?: boolean
  paddingVertical?: number
  paddingHorizontal?: number
}

export const Reader: React.FC<ReaderProps> = ({
  document,
  verticalMode = true,
  fontSize = 16,
  lineHeight = 1.8,
  theme = 'light',
  rubySize = 'normal',
  smoothScroll = true,
  paddingVertical = 2,
  paddingHorizontal = 3,
}) => {
  const readerRef = useRef<HTMLDivElement>(null)
  const [visibleDimensions, setVisibleDimensions] = useState({ cols: 0, rows: 0 })
  const [pages, setPages] = useState<Page[]>([])
  const [currentPageIndex, setCurrentPageIndex] = useState(0)

  useEffect(() => {
    const animateScroll = (element: HTMLElement, direction: 'left' | 'top', distance: number, duration: number = 200) => {
      const start = element[direction === 'left' ? 'scrollLeft' : 'scrollTop']
      const startTime = performance.now()

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)

        // Adjustable strength easing (0.35 = 35% easing strength)
        const strength = 0.35
        const cubicProgress = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2
        const easeProgress = progress + (cubicProgress - progress) * strength

        const currentPosition = start + (distance * easeProgress)

        if (direction === 'left') {
          element.scrollLeft = currentPosition
        } else {
          element.scrollTop = currentPosition
        }

        if (progress < 1) {
          requestAnimationFrame(animate)
        }
      }

      requestAnimationFrame(animate)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!readerRef.current) return

      const element = readerRef.current
      const computedStyle = window.getComputedStyle(element)

      // 実際のフォントサイズとline-heightを取得
      const actualFontSize = parseFloat(computedStyle.fontSize)
      const actualLineHeight = parseFloat(computedStyle.lineHeight) || actualFontSize * lineHeight

      // パディングを考慮した実際の表示エリアサイズ
      const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0
      const paddingRight = parseFloat(computedStyle.paddingRight) || 0
      const paddingTop = parseFloat(computedStyle.paddingTop) || 0
      const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0

      const visibleWidth = element.clientWidth - paddingLeft - paddingRight
      const visibleHeight = element.clientHeight - paddingTop - paddingBottom

      if (verticalMode) {
        // 縦書きモード: 列幅で表示列数を計算
        const colWidth = actualLineHeight
        const cols = Math.floor(visibleWidth / colWidth)
        const scrollAmount = cols * colWidth // 表示列数分スクロール

        // 左右キーでページ移動（縦書きは右から左へ読む）
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          // 縦書きでは左キーで次のページへ
          if (currentPageIndex < pages.length - 1) {
            setCurrentPageIndex(currentPageIndex + 1)
            element.scrollLeft = 0  // スクロール位置をリセット
          }
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          // 縦書きでは右キーで前のページへ
          if (currentPageIndex > 0) {
            setCurrentPageIndex(currentPageIndex - 1)
            element.scrollLeft = 0  // スクロール位置をリセット
          }
        }
      } else {
        // 横書きモード: 行高で表示行数を計算
        const rowHeight = actualLineHeight
        const rows = Math.floor(visibleHeight / rowHeight)
        const scrollAmount = rows * rowHeight // 表示行数分スクロール

        // 上下キーでページ移動
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          // 横書きでは上キーで前のページへ
          if (currentPageIndex > 0) {
            setCurrentPageIndex(currentPageIndex - 1)
            element.scrollTop = 0  // スクロール位置をリセット
          }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault()
          // 横書きでは下キーで次のページへ
          if (currentPageIndex < pages.length - 1) {
            setCurrentPageIndex(currentPageIndex + 1)
            element.scrollTop = 0  // スクロール位置をリセット
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [verticalMode, fontSize, lineHeight, smoothScroll, currentPageIndex, pages.length])

  // 表示可能な行数と列数を計算
  useEffect(() => {
    const calculateVisibleDimensions = () => {
      if (!readerRef.current) return

      const element = readerRef.current
      const computedStyle = window.getComputedStyle(element)

      // 実際のフォントサイズとline-heightを取得
      const actualFontSize = parseFloat(computedStyle.fontSize)
      const actualLineHeight = parseFloat(computedStyle.lineHeight) || actualFontSize * lineHeight

      // パディングを考慮した実際の表示エリアサイズ
      const paddingTop = parseFloat(computedStyle.paddingTop) || 0
      const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0
      const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0
      const paddingRight = parseFloat(computedStyle.paddingRight) || 0

      const visibleHeight = element.clientHeight - paddingTop - paddingBottom
      const visibleWidth = element.clientWidth - paddingLeft - paddingRight

      if (verticalMode) {
        // 縦書きモード: 文字は縦に並ぶ
        const charHeight = actualFontSize // 縦書き時、1文字の高さ = フォントサイズ
        const colWidth = actualLineHeight // 縦書き時の列幅

        const rows = Math.floor(visibleHeight / charHeight)
        const cols = Math.floor(visibleWidth / colWidth)

        setVisibleDimensions({ cols, rows })
      } else {
        // 横書きモード: 文字は横に並ぶ
        const charWidth = actualFontSize * 0.5 // 平均的な文字幅（概算）
        const rowHeight = actualLineHeight

        const cols = Math.floor(visibleWidth / charWidth)
        const rows = Math.floor(visibleHeight / rowHeight)

        setVisibleDimensions({ cols, rows })
      }
    }

    calculateVisibleDimensions()

    // リサイズとスクロールイベントに対応
    const handleResize = () => calculateVisibleDimensions()
    window.addEventListener('resize', handleResize)

    // フォントサイズやモードが変更された時も再計算
    const observer = new ResizeObserver(calculateVisibleDimensions)
    if (readerRef.current) {
      observer.observe(readerRef.current)
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      observer.disconnect()
    }
  }, [verticalMode, fontSize, lineHeight])

  // ドキュメントと表示容量に基づいてページを計算
  useEffect(() => {
    if (!document || !readerRef.current) return

    // パディングを考慮した容量計算
    // readerの全体サイズからページのパディングを引いた実際の表示領域を計算
    const readerElement = readerRef.current
    const computedStyle = window.getComputedStyle(readerElement)
    
    // 実際のフォントサイズとline-heightを取得
    const actualFontSize = parseFloat(computedStyle.fontSize) || fontSize
    const actualLineHeight = parseFloat(computedStyle.lineHeight) || actualFontSize * lineHeight
    
    // パディングをピクセルに変換（1rem = 16px として計算）
    const remToPixel = parseFloat(computedStyle.fontSize) || 16
    const paddingTopPx = paddingVertical * remToPixel
    const paddingBottomPx = paddingVertical * remToPixel
    const paddingLeftPx = paddingHorizontal * remToPixel
    const paddingRightPx = paddingHorizontal * remToPixel
    
    // 実際の表示可能エリア
    const visibleWidth = readerElement.clientWidth - paddingLeftPx - paddingRightPx
    const visibleHeight = readerElement.clientHeight - paddingTopPx - paddingBottomPx
    
    // カスタム容量を計算
    let capacity
    if (verticalMode) {
      const charHeight = actualFontSize
      const colWidth = actualLineHeight
      const rows = Math.floor(visibleHeight / charHeight)
      const cols = Math.floor(visibleWidth / colWidth)
      capacity = {
        totalCharacters: rows * cols,
        rows,
        cols,
        charactersPerRow: cols,
        charactersPerColumn: rows
      }
    } else {
      const charWidth = actualFontSize * 1.0  // 日本語文字の幅
      const rowHeight = actualLineHeight
      const charactersPerRow = Math.floor(visibleWidth / charWidth)
      const rows = Math.floor(visibleHeight / rowHeight)
      capacity = {
        totalCharacters: charactersPerRow * rows,
        rows,
        cols: charactersPerRow,
        charactersPerRow,
        charactersPerColumn: rows
      }
    }

    if (capacity.totalCharacters > 0) {
      const calculatedPages = divideIntoPages(
        document.nodes,
        capacity,
        verticalMode
      )
      setPages(calculatedPages)
      setCurrentPageIndex(0)
    }
  }, [document, verticalMode, visibleDimensions, fontSize, lineHeight, paddingVertical, paddingHorizontal])

  // ノードのレンダリング関数
  const renderNode = (node: AozoraNode, index: number): React.ReactElement | string => {
    switch (node.type) {
      case 'text':
        const text = node.content
        const parts = text.split('\n')

        const processTextPart = (part: string) => {
          if (verticalMode) {
            const segments = part.split(/([―]+)/g)
            return segments.map((segment, idx) => {
              if (/^―+$/.test(segment)) {
                return <span key={idx} className="dash-line">{segment}</span>
              }
              return segment
            })
          }
          return part
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

      case 'emphasis_dots':
        return (
          <span key={index} className="emphasis-dots">
            {node.text}
          </span>
        )

      case 'text_size':
        return (
          <span key={index} className={`text-size-${node.size}`}>
            {node.content.map((child, i) => renderNode(child, i))}
          </span>
        )

      case 'heading':
        const HeadingClass = `heading-${node.level}`
        if (node.level === 'large') {
          return <h2 key={index} className={HeadingClass}>{node.content}</h2>
        } else if (node.level === 'medium') {
          return <h3 key={index} className={HeadingClass}>{node.content}</h3>
        } else {
          return <h4 key={index} className={HeadingClass}>{node.content}</h4>
        }

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

  const readerClass = `reader reader-${theme} ${verticalMode ? 'reader-vertical' : 'reader-horizontal'} ruby-${rubySize}`

  const readerStyle: React.CSSProperties = {
    fontSize: `${fontSize}px`,
    lineHeight: lineHeight,
  }

  // 各ページのスタイル（パディングを含む）
  const pageStyle: React.CSSProperties = {
    padding: `${paddingVertical}rem ${paddingHorizontal}rem`,
  }

  // ページのセンタリングが必要かチェック
  const shouldCenterPage = (page: Page, pageCapacity: number): boolean => {
    // ページの容量使用率を計算
    const capacityUsage = page.totalCharacters / pageCapacity
    
    // 見出しのみのページかチェック
    const hasOnlyHeadings = page.lines.every(line => 
      line.nodes.every(node => 
        node.type === 'heading' || 
        node.type === 'header' ||
        node.type === 'text' && node.content.trim() === ''
      )
    )
    
    // センタリング条件：
    // 1. 見出しのみのページ
    // 2. 容量の50%未満しか使用していないページ
    // 3. 1行しかないページ
    return hasOnlyHeadings || capacityUsage < 0.5 || page.lines.length === 1
  }

  // ページをレンダリング
  const renderPages = () => {
    if (pages.length === 0) {
      // ページがまだ計算されていない場合は元のノードを表示（パディング付き）
      return (
        <div className="page page-current" style={pageStyle}>
          {document.nodes.map((node, index) => renderNode(node, index))}
        </div>
      )
    }

    // 各ページをdiv.pageでラップ
    return pages.map((page, pageIndex) => {
      const pageNodes = getNodesFromPage(page)
      // ページ容量を計算（最後に計算された容量を使用）
      const pageCapacity = verticalMode ? 
        visibleDimensions.cols * visibleDimensions.rows : 
        visibleDimensions.cols * visibleDimensions.rows
      const shouldCenter = shouldCenterPage(page, pageCapacity || 100)
      
      // センタリング用のクラスを追加
      const pageClasses = [
        'page',
        pageIndex === currentPageIndex ? 'page-current' : '',
        shouldCenter ? 'page-centered' : ''
      ].filter(Boolean).join(' ')
      
      return (
        <div 
          key={pageIndex} 
          className={pageClasses}
          data-page={pageIndex + 1}
          style={pageStyle}
        >
          {shouldCenter ? (
            <div className="page-content-wrapper">
              {pageNodes.map((node, nodeIndex) => 
                renderNode(node, `${pageIndex}-${nodeIndex}` as any)
              )}
            </div>
          ) : (
            pageNodes.map((node, nodeIndex) => 
              renderNode(node, `${pageIndex}-${nodeIndex}` as any)
            )
          )}
        </div>
      )
    })
  }

  return (
    <>
      <div ref={readerRef} className={readerClass} style={readerStyle}>
        {renderPages()}
      </div>
      {/* ページ情報を表示 */}
      {pages.length > 0 && (
        <div className="page-info">
          {currentPageIndex + 1} / {pages.length}
        </div>
      )}
    </>
  )
}
