import React from 'react'
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
    <div className={readerClass} style={readerStyle}>
      {document.nodes.map((node, index) => renderNode(node, index))}
    </div>
  )
}