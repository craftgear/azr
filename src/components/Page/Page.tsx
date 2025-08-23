import React from 'react'
import type { AozoraNode } from '../../types/aozora'
import './Page.css'

type PageProps = {
  nodes: AozoraNode[]
  verticalMode: boolean
  theme: 'light' | 'dark'
  fontSize: number
  lineHeight: number
  rubySize: 'small' | 'normal' | 'large'
  renderNode: (node: AozoraNode, index: number) => React.ReactElement | string
}

export const Page: React.FC<PageProps> = ({
  nodes,
  verticalMode,
  theme,
  fontSize,
  lineHeight,
  rubySize,
  renderNode
}) => {
  const pageClass = `page page-${theme} ${verticalMode ? 'page-vertical' : 'page-horizontal'} ruby-${rubySize}`
  
  const pageStyle: React.CSSProperties = {
    fontSize: `${fontSize}px`,
    lineHeight: lineHeight
  }

  return (
    <div className={pageClass} style={pageStyle}>
      <div className="page-content">
        {nodes.map((node, index) => renderNode(node, index))}
      </div>
    </div>
  )
}