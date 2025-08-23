import React from 'react'
import type { ParsedAozoraDocument, AozoraNode } from '../../types/aozora'
import './Reader.css'

type ReaderProps = {
  document: ParsedAozoraDocument | null
  verticalMode?: boolean
  fontSize?: number
  lineHeight?: number
  theme?: 'light' | 'dark'
  padding?: number
}

export const Reader: React.FC<ReaderProps> = ({
  document,
  verticalMode = true,
  fontSize = 16,
  lineHeight = 1.8,
  theme = 'light',
  padding = 2
}) => {
  // ノードをReact要素に変換
  const renderNode = (node: AozoraNode, index: number): React.ReactElement | string => {
    switch (node.type) {
      case 'text':
        // 改行を処理
        const parts = node.content.split('\n')
        if (parts.length === 1) {
          return parts[0]
        }
        return (
          <React.Fragment key={index}>
            {parts.map((part, i) => (
              <React.Fragment key={i}>
                {part}
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

  const readerClass = `reader reader-${theme} ${verticalMode ? 'reader-vertical' : 'reader-horizontal'}`
  const readerStyle: React.CSSProperties = {
    fontSize: `${fontSize}px`,
    lineHeight: lineHeight,
    padding: !verticalMode ? `${padding}rem` : undefined,
    '--reader-padding': `${padding}rem`
  } as React.CSSProperties

  return (
    <div className={readerClass} style={readerStyle}>
      <div className="reader-content">
        {document.nodes.map((node, index) => renderNode(node, index))}
      </div>
    </div>
  )
}