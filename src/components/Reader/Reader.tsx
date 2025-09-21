import React, { useEffect, useRef, useState, useMemo } from 'react'
import { flushSync } from 'react-dom'
import type { ParsedAozoraDocument, AozoraNode } from '../../types/aozora'
import { divideIntoIntelligentPages, type IntelligentPageOptions } from '../../utils/intelligentPageDivider'
import type { Page } from '../../utils/pageDivider'
import { bookmarkStorage } from '../../core/bookmarkStorage'
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
  intelligentPagingOptions?: IntelligentPageOptions
  enableWheelNavigation?: boolean
  fastNavigationMode?: boolean
  bookId?: string | null  // 本のID（ブックマーク保存用）
  initialPageIndex?: number  // 初期表示ページ（ブックマーク復元用）
  onPageChange?: (pageIndex: number) => void  // ページ変更時のコールバック
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
  intelligentPagingOptions,
  enableWheelNavigation = true,
  fastNavigationMode = true,
  bookId = null,
  initialPageIndex = 0,
  onPageChange,
}) => {
  const readerRef = useRef<HTMLDivElement>(null)
  const [visibleDimensions, setVisibleDimensions] = useState({ cols: 0, rows: 0 })
  const [pages, setPages] = useState<Page[]>([])
  const [currentPageIndex, setCurrentPageIndex] = useState(0)

  // 高速ナビゲーション用の状態
  const [targetPageIndex, setTargetPageIndex] = useState(0)
  const [isNavigating, setIsNavigating] = useState(false)

  // ブックマーク復元フラグ
  const [hasRestoredBookmark, setHasRestoredBookmark] = useState(false)

  // intelligentPagingOptionsをメモ化して無限レンダリングを防ぐ
  const memoizedIntelligentOptions = useMemo(
    () => intelligentPagingOptions || {
      enableSemanticBoundaries: false,
      enableContentAwareCapacity: false,
      enableLookAhead: false,
      enableLineBreaking: true,
      useCapacityBasedWrapping: true
    },
    [
      intelligentPagingOptions?.enableSemanticBoundaries,
      intelligentPagingOptions?.enableContentAwareCapacity,
      intelligentPagingOptions?.enableLookAhead,
      intelligentPagingOptions?.enableLineBreaking,
      intelligentPagingOptions?.useCapacityBasedWrapping
    ]
  )

  // ブックマークの自動保存
  useEffect(() => {
    if (bookId && pages.length > 0) {
      // ページ変更時にブックマークを保存
      bookmarkStorage.saveBookmark(bookId, currentPageIndex)

      // ページ変更コールバックを実行
      if (onPageChange) {
        onPageChange(currentPageIndex)
      }
    }
  }, [currentPageIndex, bookId, pages.length, onPageChange])

  // ブックマークの復元
  useEffect(() => {
    if (bookId && pages.length > 0 && !hasRestoredBookmark) {
      // 初回のみブックマークを復元
      const loadBookmark = async () => {
        const savedPageIndex = initialPageIndex || await bookmarkStorage.loadBookmark(bookId)
        if (savedPageIndex !== null && savedPageIndex >= 0 && savedPageIndex < pages.length) {
          setCurrentPageIndex(savedPageIndex)
          setTargetPageIndex(savedPageIndex)
        }
        setHasRestoredBookmark(true)
      }
      loadBookmark()
    }
  }, [bookId, pages.length, hasRestoredBookmark, initialPageIndex])

  // コンポーネントアンマウント時のクリーンアップ
  useEffect(() => {
    return () => {
      if (bookId) {
        // 最後の位置を即座に保存
        bookmarkStorage.saveBookmarkImmediate(bookId, currentPageIndex)
        // タイマーをクリーンアップ
        bookmarkStorage.cleanup(bookId)
      }
    }
  }, [bookId, currentPageIndex])

  useEffect(() => {
    if (fastNavigationMode && targetPageIndex === currentPageIndex && isNavigating) {
      setIsNavigating(false)
    }
  }, [fastNavigationMode, targetPageIndex, currentPageIndex, isNavigating])

  // 遅延レンダリング: targetPageIndexをcurrentPageIndexに同期
  useEffect(() => {
    if (!fastNavigationMode) {
      // 高速ナビゲーションが無効の場合は即座に同期
      setCurrentPageIndex(targetPageIndex)
      return
    }

    let syncTimer: number | null = null

    const syncPages = () => {
      flushSync(() => {
        setCurrentPageIndex(targetPageIndex)
        setIsNavigating(false)
      })
    }

    if (targetPageIndex !== currentPageIndex) {
      setIsNavigating(true)

      if (syncTimer !== null) {
        clearTimeout(syncTimer)
      }

      // 50ms後に同期 (150ms から高速化)
      syncTimer = window.setTimeout(syncPages, 50)
    } else {
      setIsNavigating(false)
    }

    return () => {
      if (syncTimer !== null) {
        clearTimeout(syncTimer)
      }
    }
  }, [targetPageIndex, currentPageIndex, fastNavigationMode])

  useEffect(() => {
    // const animateScroll = (element: HTMLElement, direction: 'left' | 'top', distance: number, duration: number = 200) => {
    //   const start = element[direction === 'left' ? 'scrollLeft' : 'scrollTop']
    //   const startTime = performance.now()
    //
    //   const animate = (currentTime: number) => {
    //     const elapsed = currentTime - startTime
    //     const progress = Math.min(elapsed / duration, 1)
    //
    //     // Adjustable strength easing (0.35 = 35% easing strength)
    //     const strength = 0.35
    //     const cubicProgress = progress < 0.5
    //       ? 4 * progress * progress * progress
    //       : 1 - Math.pow(-2 * progress + 2, 3) / 2
    //     const easeProgress = progress + (cubicProgress - progress) * strength
    //
    //     const currentPosition = start + (distance * easeProgress)
    //
    //     if (direction === 'left') {
    //       element.scrollLeft = currentPosition
    //     } else {
    //       element.scrollTop = currentPosition
    //     }
    //
    //     if (progress < 1) {
    //       requestAnimationFrame(animate)
    //     }
    //   }
    //
    //   requestAnimationFrame(animate)
    // }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!readerRef.current) return

      // const element = readerRef.current
      // const computedStyle = window.getComputedStyle(element)

      // 実際のフォントサイズとline-heightを取得
      // const actualFontSize = parseFloat(computedStyle.fontSize)
      // const actualLineHeight = parseFloat(computedStyle.lineHeight) || actualFontSize * lineHeight

      // パディングを考慮した実際の表示エリアサイズ
      // const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0
      // const paddingRight = parseFloat(computedStyle.paddingRight) || 0
      // const paddingTop = parseFloat(computedStyle.paddingTop) || 0
      // const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0

      // const visibleWidth = element.clientWidth - paddingLeft - paddingRight
      // const visibleHeight = element.clientHeight - paddingTop - paddingBottom

      if (verticalMode) {
        // 縦書きモード: 列幅で表示列数を計算
        // const colWidth = actualLineHeight
        // const cols = Math.floor(visibleWidth / colWidth)
        // const scrollAmount = cols * colWidth // 表示列数分スクロール（未使用）

        // 左右キーでページ移動（縦書きは右から左へ読む）
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          // 縦書きでは左キーで次のページへ
          if (fastNavigationMode) {
            if (targetPageIndex < pages.length - 1) {
              setTargetPageIndex(targetPageIndex + 1)
            }
          } else {
            if (currentPageIndex < pages.length - 1) {
              setCurrentPageIndex(currentPageIndex + 1)
            }
          }
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          // 縦書きでは右キーで前のページへ
          if (fastNavigationMode) {
            if (targetPageIndex > 0) {
              setTargetPageIndex(targetPageIndex - 1)
            }
          } else {
            if (currentPageIndex > 0) {
              setCurrentPageIndex(currentPageIndex - 1)
            }
          }
        }
      } else {
        // 横書きモード: 行高で表示行数を計算
        // const rowHeight = actualLineHeight
        // const rows = Math.floor(visibleHeight / rowHeight)
        // const scrollAmount = rows * rowHeight // 表示行数分スクロール（未使用）

        // 上下キーでページ移動
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          // 横書きでは上キーで前のページへ
          if (fastNavigationMode) {
            if (targetPageIndex > 0) {
              setTargetPageIndex(targetPageIndex - 1)
            }
          } else {
            if (currentPageIndex > 0) {
              setCurrentPageIndex(currentPageIndex - 1)
            }
          }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault()
          // 横書きでは下キーで次のページへ
          if (fastNavigationMode) {
            if (targetPageIndex < pages.length - 1) {
              setTargetPageIndex(targetPageIndex + 1)
            }
          } else {
            if (currentPageIndex < pages.length - 1) {
              setCurrentPageIndex(currentPageIndex + 1)
            }
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [verticalMode, fontSize, lineHeight, smoothScroll, currentPageIndex, targetPageIndex, pages.length, fastNavigationMode])

  // マウスホイールでのページナビゲーション (即座に反応)
  useEffect(() => {
    if (!enableWheelNavigation || !readerRef.current) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()

      const deltaY = e.deltaY

      if (verticalMode) {
        // 縦書きモード: 下スクロール = 次ページ、上スクロール = 前ページ
        if (fastNavigationMode) {
          if (deltaY > 0 && targetPageIndex < pages.length - 1) {
            setTargetPageIndex(targetPageIndex + 1)
          } else if (deltaY < 0 && targetPageIndex > 0) {
            setTargetPageIndex(targetPageIndex - 1)
          }
        } else {
          if (deltaY > 0 && currentPageIndex < pages.length - 1) {
            setCurrentPageIndex(currentPageIndex + 1)
          } else if (deltaY < 0 && currentPageIndex > 0) {
            setCurrentPageIndex(currentPageIndex - 1)
          }
        }
      } else {
        // 横書きモード: 下スクロール = 次ページ、上スクロール = 前ページ
        if (fastNavigationMode) {
          if (deltaY > 0 && targetPageIndex < pages.length - 1) {
            setTargetPageIndex(targetPageIndex + 1)
          } else if (deltaY < 0 && targetPageIndex > 0) {
            setTargetPageIndex(targetPageIndex - 1)
          }
        } else {
          if (deltaY > 0 && currentPageIndex < pages.length - 1) {
            setCurrentPageIndex(currentPageIndex + 1)
          } else if (deltaY < 0 && currentPageIndex > 0) {
            setCurrentPageIndex(currentPageIndex - 1)
          }
        }
      }
    }

    const element = readerRef.current
    element.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      element.removeEventListener('wheel', handleWheel)
    }
  }, [enableWheelNavigation, verticalMode, currentPageIndex, targetPageIndex, pages.length, fastNavigationMode])

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
      // パディングはページレベルで適用されるので、propの値を使用
      const remToPixel = actualFontSize || 16
      const paddingTopPx = paddingVertical * remToPixel
      const paddingBottomPx = paddingVertical * remToPixel
      const paddingLeftPx = paddingHorizontal * remToPixel
      const paddingRightPx = paddingHorizontal * remToPixel

      const visibleHeight = element.clientHeight - paddingTopPx - paddingBottomPx
      const visibleWidth = element.clientWidth - paddingLeftPx - paddingRightPx

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
  }, [verticalMode, fontSize, lineHeight, paddingVertical, paddingHorizontal])

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
      const calculatedPages = divideIntoIntelligentPages(
        document.nodes,
        capacity,
        verticalMode,
        memoizedIntelligentOptions
      )
      setPages(calculatedPages)

      // ページが再計算されたときはブックマーク復元フラグをリセット
      if (!hasRestoredBookmark) {
        setCurrentPageIndex(0)
        setTargetPageIndex(0)
      }
    }
  }, [document, verticalMode, visibleDimensions, fontSize, lineHeight, paddingVertical, paddingHorizontal, memoizedIntelligentOptions, hasRestoredBookmark])

  // ノードのレンダリング関数
  const renderNode = (node: AozoraNode, index: number): React.ReactElement | string => {
    switch (node.type) {
      case 'text':
        const text = node.content
        const parts = text.split('\n')

        const processTextPart = (part: string) => {
          if (verticalMode) {
            // ダッシュ記号の処理（U+2015 horizontal bar と U+FF0D full-width dash の両方に対応）
            const dashSegments = part.split(/([－―]+)/g)
            const processedDashSegments = dashSegments.map((segment, idx) => {
              if (/^[－―]+$/.test(segment)) {
                return <span key={idx} className="dash-line">{segment}</span>
              }
              return segment
            })

            // 省略記号の処理
            const result: (string | React.ReactElement)[] = []
            processedDashSegments.forEach((segment) => {
              if (typeof segment === 'string') {
                // 省略記号を縦書き用記号に変換
                result.push(segment
                  .replace(/…/g, '⋯')       // 横省略記号 → 縦省略記号
                  .replace(/‥/g, '・・')    // 2点省略記号 → 中点2つ
                  .replace(/\.\.\./g, '・・・') // ASCII 3つドット → 中点3つ
                )
              } else {
                result.push(segment)
              }
            })
            return result
          }
          return part
        }

        if (parts.length === 1) {
          const result = processTextPart(parts[0])
          if (Array.isArray(result)) {
            return <React.Fragment key={index}>{result}</React.Fragment>
          }
          return result
        }

        return (
          <React.Fragment key={index}>
            {parts.map((part, i) => (
              <React.Fragment key={i}>
                {part === '' ? '\u00A0' : processTextPart(part)}
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
        const level = Math.min(Math.max(node.level, 1), 6)
        const HeaderTag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
        return React.createElement(
          HeaderTag,
          { key: index },
          node.content
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

  const readerClass = `reader reader-${theme} ${verticalMode ? 'reader-vertical' : 'reader-horizontal'} ruby-${rubySize} ${fastNavigationMode && isNavigating ? 'fast-navigating' : ''}`

  const readerStyle: React.CSSProperties = {
    fontSize: `${fontSize}px`,
    lineHeight: lineHeight,
  }

  // 各ページのスタイル（パディングを含む）
  const pageStyle: React.CSSProperties = {
    padding: `${paddingVertical}rem ${paddingHorizontal}rem`,
  }

  // 仮想ページネーション: 3ページウィンドウのみレンダリング
  const renderPages = () => {
    if (pages.length === 0) {
      // ページがまだ計算されていない場合は元のノードを表示（パディング付き）
      return (
        <div className="page page-current" style={pageStyle}>
          <div className="page-content-wrapper">
            {document.nodes.map((node, index) => renderNode(node, index))}
          </div>
        </div>
      )
    }

    // 仮想ページネーション: 現在のページとその前後のみレンダリング
    const pagesToRender = []
    const prevPageIndex = currentPageIndex - 1
    const nextPageIndex = currentPageIndex + 1

    // 前のページ
    if (prevPageIndex >= 0 && prevPageIndex < pages.length) {
      pagesToRender.push({
        pageIndex: prevPageIndex,
        page: pages[prevPageIndex],
        className: 'page page-prev'
      })
    }

    // 現在のページ
    if (currentPageIndex >= 0 && currentPageIndex < pages.length) {
      pagesToRender.push({
        pageIndex: currentPageIndex,
        page: pages[currentPageIndex],
        className: 'page page-current'
      })
    }

    // 次のページ
    if (nextPageIndex >= 0 && nextPageIndex < pages.length) {
      pagesToRender.push({
        pageIndex: nextPageIndex,
        page: pages[nextPageIndex],
        className: 'page page-next'
      })
    }

    return pagesToRender.map(({ pageIndex, page, className }) => (
      <div
        key={pageIndex}
        className={className}
        data-page={pageIndex + 1}
        style={pageStyle}
      >
        <div className="page-content-wrapper">
          {page.lines.map((line, lineIndex) => {
            // Debug logging for ALL lines to understand what's happening
            console.log(`Line ${lineIndex}:`, {
              nodesLength: line.nodes.length,
              firstNodeType: line.nodes[0]?.type,
              firstNodeContent: line.nodes[0]?.type === 'text' ? JSON.stringify(line.nodes[0].content) : 'N/A',
              lineText: JSON.stringify(line.text),
              lineTextLength: line.text.length,
              trimmedLineText: line.text.trim(),
              trimmedLineTextLength: line.text.trim().length
            });

            // Check if this is a blank line (only contains nbsp)
            const isBlankLine = line.text === '\u00A0' &&
                               line.nodes.length === 1 &&
                               line.nodes[0].type === 'text' &&
                               line.nodes[0].content === '\u00A0'

            // Check if this line contains only whitespace/newlines
            // Also check line.text in case it's out of sync with nodes
            const isOnlyWhitespace = (line.nodes.length === 1 &&
                                     line.nodes[0].type === 'text' &&
                                     line.nodes[0].content.trim() === '') ||
                                    line.text.trim() === ''

            // Determine if this should be treated as a blank line
            const shouldBeBlank = isBlankLine || isOnlyWhitespace

            // Log decision for blank/whitespace lines
            if (line.text.trim() === '' || line.text === '\u00A0') {
              console.log(`  Decision: isBlankLine=${isBlankLine}, isOnlyWhitespace=${isOnlyWhitespace}, shouldBeBlank=${shouldBeBlank}, class="${shouldBeBlank ? 'blank-line' : ''}"`);
            }

            return (
              <div
                key={`${pageIndex}-line-${lineIndex}`}
                className={shouldBeBlank ? 'blank-line' : ''}
              >
                {shouldBeBlank ? (
                  // For blank lines, directly render the nbsp character
                  '\u00A0'
                ) : (
                  // For normal lines, render nodes as usual
                  line.nodes.map((node, nodeIndex) =>
                    renderNode(node, `${pageIndex}-${lineIndex}-${nodeIndex}` as any)
                  )
                )}
              </div>
            )
          })}
        </div>
      </div>
    ))
  }

  return (
    <>
      <div ref={readerRef} className={readerClass} style={{ ...readerStyle, position: 'relative', overflow: 'hidden' }}>
        {renderPages()}
      </div>
      {/* ページ情報を表示 */}
      {pages.length > 0 && (
        <div className="page-info">
          {(fastNavigationMode ? targetPageIndex : currentPageIndex) + 1} / {pages.length}
        </div>
      )}
    </>
  )
}
