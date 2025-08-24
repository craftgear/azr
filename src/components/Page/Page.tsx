import React, { useEffect, useRef } from 'react'
import type { AozoraNode } from '../../types/aozora'
import './Page.css'

type PageProps = {
  nodes: AozoraNode[]
  verticalMode: boolean
  theme: 'light' | 'dark'
  fontSize: number
  lineHeight: number
  paddingVertical: number
  paddingHorizontal: number
  rubySize: 'small' | 'normal' | 'large'
  renderNode: (node: AozoraNode, index: number) => React.ReactElement | string
}

export const Page: React.FC<PageProps> = ({
  nodes,
  verticalMode,
  theme,
  fontSize,
  lineHeight,
  paddingVertical,
  paddingHorizontal,
  rubySize,
  renderNode
}) => {
  const pageRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  
  // デバッグ: コンテンツがビューポート内に収まっているか確認
  useEffect(() => {
    if (pageRef.current && contentRef.current) {
      const pageRect = pageRef.current.getBoundingClientRect()
      const contentRect = contentRef.current.getBoundingClientRect()
      
      const overflowHorizontal = contentRect.width > pageRect.width
      const overflowVertical = contentRect.height > pageRect.height
      
      // スクロール可能な範囲を確認
      const scrollWidth = contentRef.current.scrollWidth
      const scrollHeight = contentRef.current.scrollHeight
      const clientWidth = contentRef.current.clientWidth
      const clientHeight = contentRef.current.clientHeight
      
      if (overflowHorizontal || overflowVertical || scrollWidth > clientWidth || scrollHeight > clientHeight) {
        console.warn('⚠️ Page content overflow detected:', {
          verticalMode,
          pageSize: { width: pageRect.width, height: pageRect.height },
          contentSize: { width: contentRect.width, height: contentRect.height },
          scrollSize: { width: scrollWidth, height: scrollHeight },
          clientSize: { width: clientWidth, height: clientHeight },
          overflowHorizontal,
          overflowVertical,
          scrollOverflowH: scrollWidth > clientWidth,
          scrollOverflowV: scrollHeight > clientHeight,
          nodeCount: nodes.length,
          totalChars: nodes.reduce((sum, node) => {
            if (node.type === 'text') return sum + node.content.length
            if (node.type === 'ruby') return sum + node.base.length
            if (node.type === 'emphasis_dots') return sum + node.text.length
            return sum
          }, 0)
        })
      } else {
        console.log('✅ Page content fits within viewport:', {
          verticalMode,
          pageSize: { width: pageRect.width, height: pageRect.height },
          contentSize: { width: contentRect.width, height: contentRect.height },
          nodeCount: nodes.length
        })
      }
    }
  }, [nodes, verticalMode, fontSize, lineHeight, paddingVertical, paddingHorizontal])
  
  const pageClass = `page page-${theme} ${verticalMode ? 'page-vertical' : 'page-horizontal'} ruby-${rubySize}`
  
  const pageStyle: React.CSSProperties = {
    fontSize: `${fontSize}px`,
    lineHeight: lineHeight,
    padding: `${paddingVertical}rem ${paddingHorizontal}rem`,
    '--page-padding-vertical': `${paddingVertical}rem`,
    '--page-padding-horizontal': `${paddingHorizontal}rem`
  } as React.CSSProperties

  return (
    <div ref={pageRef} className={pageClass} style={pageStyle}>
      <div ref={contentRef} className="page-content">
        {nodes.map((node, index) => renderNode(node, index))}
      </div>
    </div>
  )
}