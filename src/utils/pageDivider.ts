/**
 * テキストをページに分割する機能
 */

import type { AozoraNode } from '../types/aozora'
// import type { CharacterCapacity } from './readerCapacityCalculator'
import { applyLineBreaking /* , type BrokenLine */ } from './lineBreaker'

// ページ内の行
export type Line = {
  nodes: AozoraNode[]
  text: string  // 表示されるテキスト（タグを除く）
  characterCount: number  // 実際の文字数
  normalizedCount: number  // 正規化後の文字数（行数に合わせて調整）
  isContinuation?: boolean  // 長い行の継続部分かどうか
  continuationIndex?: number  // 継続部分のインデックス
  totalParts?: number  // 総分割数
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
 * AozoraNodeの配列を行に分割
 * 改行（\n）または異なるノード間の境界で分割
 * maxCharsPerLineが指定された場合、長い行を自動分割
 */
export const splitIntoLines = (nodes: AozoraNode[], maxCharsPerLine?: number): Line[] => {
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
            // 通常の行を追加
            lines.push({
              nodes: [...currentLineNodes],
              text: currentLineText,
              characterCount: countCharacters(currentLineText),
              normalizedCount: 0  // 後で計算
            })
          } else {
            // 空行の場合、ノンブレーキングスペースを含む行を作成
            const blankNode: AozoraNode = { type: 'text', content: '\u00A0' }
            lines.push({
              nodes: [blankNode],
              text: '\u00A0',
              characterCount: 1,
              normalizedCount: 0
            })
          }
          currentLineNodes = []
          currentLineText = ''
        }

        if (parts[i]) {
          const textNode: AozoraNode = { type: 'text', content: parts[i] }
          currentLineNodes.push(textNode)
          currentLineText += parts[i]
        } else if (i === 0 && parts.length > 1) {
          // 先頭が空の場合（テキストが改行で始まる場合）
          // 何もしない - 次の i > 0 の処理で空行が作られる
        }
        // 空のパート（連続改行の中間）の場合は何もしない
        // 次のループで空行として処理される
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

  // 長い行の分割処理を適用
  if (maxCharsPerLine && maxCharsPerLine > 0) {
    const brokenLines = applyLineBreaking(lines, maxCharsPerLine)

    // BrokenLineからLineに変換
    return brokenLines.map(brokenLine => ({
      nodes: brokenLine.nodes,
      text: brokenLine.text,
      characterCount: brokenLine.characterCount,
      normalizedCount: brokenLine.normalizedCount,
      isContinuation: brokenLine.isContinuation,
      continuationIndex: brokenLine.continuationIndex,
      totalParts: brokenLine.totalParts
    }))
  }

  return lines
}


