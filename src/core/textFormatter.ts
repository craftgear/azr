import type { AozoraNode, ParsedAozoraDocument } from '../types/aozora'

// HTMLエスケープ
const escapeHTML = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// 改行を<br>タグに変換
const convertNewlines = (text: string): string => {
  return text.replace(/\n/g, '<br>')
}

// 単一のノードをHTMLに変換
export const formatNodeToHTML = (node: AozoraNode): string => {
  switch (node.type) {
    case 'text':
      return convertNewlines(escapeHTML(node.content))
    
    case 'ruby':
      const base = escapeHTML(node.base)
      const reading = escapeHTML(node.reading)
      return `<ruby>${base}<rt>${reading}</rt></ruby>`
    
    case 'header':
      const level = Math.min(Math.max(node.level, 1), 6)
      const content = escapeHTML(node.content)
      return `<h${level}>${content}</h${level}>`
    
    case 'emphasis':
      const emphasisContent = escapeHTML(node.content)
      const emphasisClass = `emphasis-${node.level}`
      return `<span class="${emphasisClass}">${emphasisContent}</span>`
    
    default:
      return ''
  }
}

export type FormatOptions = {
  wrapInDiv?: boolean
  className?: string
}

// ドキュメント全体をHTMLに変換
export const formatDocumentToHTML = (
  document: ParsedAozoraDocument,
  options: FormatOptions = {}
): string => {
  const { wrapInDiv = false, className = 'aozora-text' } = options
  
  const html = document.nodes
    .map(node => formatNodeToHTML(node))
    .join('')
  
  if (wrapInDiv) {
    return `<div class="${className}">${html}</div>`
  }
  
  return html
}

// Reactコンポーネント用のフォーマット関数
export const formatNodeToReact = (_node: AozoraNode, _index: number): React.ReactElement | string | null => {
  // この関数はReactコンポーネント内で実装される
  // ここではプレースホルダーとして定義
  throw new Error('formatNodeToReact should be implemented in React component')
}