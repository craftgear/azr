import React, { useEffect, useRef, useState } from 'react'
import type { ParsedAozoraDocument, AozoraNode } from '../../types/aozora'
import './Reader.css'

type ReaderProps = {
  document: ParsedAozoraDocument | null
  verticalMode?: boolean
  fontSize?: number
  lineHeight?: number
  theme?: 'light' | 'dark'
  rubySize?: 'small' | 'normal' | 'large'
}

export const Reader: React.FC<ReaderProps> = ({
  document,
  verticalMode = true,
  fontSize = 16,
  lineHeight = 1.8,
  theme = 'light',
  rubySize = 'normal',
}) => {
  const readerRef = useRef<HTMLDivElement>(null)
  const [visibleDimensions, setVisibleDimensions] = useState({ cols: 0, rows: 0 })

  useEffect(() => {
    const smoothScroll = (element: HTMLElement, direction: 'left' | 'top', distance: number, duration: number = 300) => {
      const start = element[direction === 'left' ? 'scrollLeft' : 'scrollTop']
      const startTime = performance.now()

      const animateScroll = (currentTime: number) => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)
        
        // easeInOutCubic easing function
        const easeProgress = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2

        const currentPosition = start + (distance * easeProgress)
        
        if (direction === 'left') {
          element.scrollLeft = currentPosition
        } else {
          element.scrollTop = currentPosition
        }

        if (progress < 1) {
          requestAnimationFrame(animateScroll)
        }
      }

      requestAnimationFrame(animateScroll)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!readerRef.current) return

      const scrollAmount = 100 // スクロール量

      if (verticalMode) {
        // 縦書きモード: 左右キーで横スクロール
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          smoothScroll(readerRef.current, 'left', -scrollAmount)
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          smoothScroll(readerRef.current, 'left', scrollAmount)
        }
      } else {
        // 横書きモード: 上下キーで縦スクロール
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          smoothScroll(readerRef.current, 'top', -scrollAmount)
        } else if (e.key === 'ArrowDown') {
          e.preventDefault()
          smoothScroll(readerRef.current, 'top', scrollAmount)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [verticalMode])

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

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={readerRef} className={readerClass} style={readerStyle}>
        {document.nodes.map((node, index) => renderNode(node, index))}
      </div>
      {/* 表示可能な列数と行数を表示するフローティングラベル */}
      {/* <div className="dimensions-label">
        {visibleDimensions.cols} × {visibleDimensions.rows}
      </div> */}
    </div>
  )
}