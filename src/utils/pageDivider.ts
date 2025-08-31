/**
 * テキストをページに分割する機能
 */

import type { AozoraNode } from '../types/aozora'
import type { CharacterCapacity } from './readerCapacityCalculator'

// ページ内の行
export type Line = {
  nodes: AozoraNode[]
  text: string  // 表示されるテキスト（タグを除く）
  characterCount: number  // 実際の文字数
  normalizedCount: number  // 正規化後の文字数（行数に合わせて調整）
}

// ページ
export type Page = {
  lines: Line[]
  totalCharacters: number  // ページ内の総文字数（正規化後）
  startIndex: number  // 元のnodes配列での開始インデックス
  endIndex: number  // 元のnodes配列での終了インデックス
}

/**
 * AozoraNodeから表示テキストを抽出（タグや注記を除く）
 */
export const extractTextFromNode = (node: AozoraNode): string => {
  switch (node.type) {
    case 'text':
      return node.content
    
    case 'ruby':
      // ルビは基底テキストのみカウント
      return node.base
    
    case 'emphasis_dots':
      return node.text
    
    case 'text_size':
      // 子ノードのテキストを再帰的に抽出
      return node.content.map(extractTextFromNode).join('')
    
    case 'heading':
      return node.content
    
    case 'block_indent':
      // 子ノードのテキストを再帰的に抽出
      return node.content.map(extractTextFromNode).join('')
    
    case 'special_char_note':
      // 特殊文字は1文字としてカウント
      return node.char
    
    case 'emphasis':
      return node.content
    
    case 'header':
      return node.content
    
    default:
      return ''
  }
}

/**
 * テキスト内の文字数をカウント（改行を除く）
 */
export const countCharacters = (text: string): number => {
  // 改行を除いた文字数をカウント
  return text.replace(/\n/g, '').length
}

/**
 * 行の文字数を正規化
 * - 行の文字数 < 行数: 行数として扱う
 * - 行の文字数 >= 行数: ceil(文字数/行数) * 行数
 */
export const normalizeLineCount = (
  charCount: number, 
  rowsPerColumn: number
): number => {
  if (charCount === 0) return 0
  
  if (charCount < rowsPerColumn) {
    return rowsPerColumn
  }
  
  // 文字数を行数で割って切り上げ、行数を掛ける
  const columns = Math.ceil(charCount / rowsPerColumn)
  return columns * rowsPerColumn
}

/**
 * AozoraNodeの配列を行に分割
 * 改行（\n）または異なるノード間の境界で分割
 */
export const splitIntoLines = (nodes: AozoraNode[]): Line[] => {
  const lines: Line[] = []
  let currentLineNodes: AozoraNode[] = []
  let currentLineText = ''
  
  for (const node of nodes) {
    if (node.type === 'text') {
      // テキストノードは改行で分割
      const parts = node.content.split('\n')
      
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) {
          // 改行があった場合、現在の行を確定
          if (currentLineNodes.length > 0 || currentLineText) {
            lines.push({
              nodes: [...currentLineNodes],
              text: currentLineText,
              characterCount: countCharacters(currentLineText),
              normalizedCount: 0  // 後で計算
            })
          }
          currentLineNodes = []
          currentLineText = ''
        }
        
        if (parts[i]) {
          const textNode: AozoraNode = { type: 'text', content: parts[i] }
          currentLineNodes.push(textNode)
          currentLineText += parts[i]
        }
      }
    } else {
      // その他のノードはそのまま現在の行に追加
      currentLineNodes.push(node)
      currentLineText += extractTextFromNode(node)
    }
  }
  
  // 最後の行を追加
  if (currentLineNodes.length > 0 || currentLineText) {
    lines.push({
      nodes: currentLineNodes,
      text: currentLineText,
      characterCount: countCharacters(currentLineText),
      normalizedCount: 0
    })
  }
  
  return lines
}

/**
 * テキストをページに分割
 * @param nodes - 分割対象のAozoraNode配列
 * @param capacity - ページの文字容量
 * @param verticalMode - 縦書きモードかどうか
 * @returns ページの配列
 */
export const divideIntoPages = (
  nodes: AozoraNode[],
  capacity: CharacterCapacity,
  verticalMode: boolean = true
): Page[] => {
  const pages: Page[] = []
  const lines = splitIntoLines(nodes)
  
  // 縦書きと横書きで行数の定義が異なる
  const rowsPerColumn = verticalMode ? capacity.rows : capacity.charactersPerRow
  const pageCapacity = capacity.totalCharacters
  
  // 各行の正規化文字数を計算
  lines.forEach(line => {
    line.normalizedCount = normalizeLineCount(line.characterCount, rowsPerColumn)
  })
  
  // ページに分割
  let currentPage: Page = {
    lines: [],
    totalCharacters: 0,
    startIndex: 0,
    endIndex: 0
  }
  
  let nodeIndex = 0
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // 行が見出しタイプのノードを含むかチェック
    const hasHeading = line.nodes.some(node => 
      node.type === 'heading' || 
      node.type === 'header'
    )
    
    // 見出しの場合、新しいページを開始（最初のページでない限り）
    if (hasHeading && currentPage.lines.length > 0) {
      // 現在のページを保存
      pages.push(currentPage)
      
      // 新しいページを開始
      currentPage = {
        lines: [line],
        totalCharacters: line.normalizedCount,
        startIndex: nodeIndex,
        endIndex: nodeIndex + line.nodes.length - 1
      }
    } else if (currentPage.totalCharacters + line.normalizedCount <= pageCapacity) {
      // 通常の行で、現在のページに収まる場合
      currentPage.lines.push(line)
      currentPage.totalCharacters += line.normalizedCount
      currentPage.endIndex = nodeIndex + line.nodes.length - 1
    } else {
      // ページが満杯なので、新しいページを開始
      if (currentPage.lines.length > 0) {
        pages.push(currentPage)
      }
      
      currentPage = {
        lines: [line],
        totalCharacters: line.normalizedCount,
        startIndex: nodeIndex,
        endIndex: nodeIndex + line.nodes.length - 1
      }
    }
    
    nodeIndex += line.nodes.length
  }
  
  // 最後のページを追加
  if (currentPage.lines.length > 0) {
    pages.push(currentPage)
  }
  
  return pages
}

/**
 * ページ内のノードを取得
 * @param page - ページ
 * @returns ページ内のすべてのAozoraNode
 */
export const getNodesFromPage = (page: Page): AozoraNode[] => {
  const nodes: AozoraNode[] = []
  
  for (let i = 0; i < page.lines.length; i++) {
    const line = page.lines[i]
    
    // 行のノードを追加
    nodes.push(...line.nodes)
    
    // 最後の行以外は改行を追加
    if (i < page.lines.length - 1) {
      nodes.push({ type: 'text', content: '\n' })
    }
  }
  
  return nodes
}