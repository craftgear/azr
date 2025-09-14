/**
 * 長い行のためのインテリジェント改行システム
 * 日本語の禁則処理（kinsoku）と複数レベルの改行戦略を実装
 */

import type { AozoraNode } from '../types/aozora'

// 改行されたラインの型定義（拡張）
export type BrokenLine = {
  nodes: AozoraNode[]
  text: string
  characterCount: number
  normalizedCount: number
  isContinuation?: boolean
  continuationIndex?: number
  totalParts?: number
}

// 改行の優先度レベル
export enum BreakPriority {
  SENTENCE = 1,    // 文末（。！？）
  CLAUSE = 2,      // 句読点（、）
  DIALOGUE = 3,    // 会話境界（」「）
  PARTICLE = 4,    // 助詞境界
  KINSOKU = 5,     // 禁則処理を守った文字境界
  FORCED = 6       // 強制改行
}

// 改行候補位置
type BreakCandidate = {
  position: number
  priority: BreakPriority
  penalty: number
  char: string
}

// 日本語禁則処理文字定義
const KINSOKU_START_CHARS = new Set([
  // 行頭禁止文字
  '、', '。', '，', '．', '・', '：', '；', '？', '！',
  '」', '』', '】', '〕', '）', '｝', '〉', '》',
  '］', '｝', '〟'
])

const KINSOKU_END_CHARS = new Set([
  // 行末禁止文字
  '「', '『', '【', '〔', '（', '｛', '〈', '《',
  '［', '｛', '〝'
])

// 助詞・助動詞（改行候補文字）
const PARTICLES = new Set([
  'は', 'が', 'を', 'に', 'で', 'と', 'の', 'から', 'まで',
  'より', 'へ', 'だけ', 'しか', 'でも', 'さえ', 'こそ',
  'ば', 'と', 'ても', 'でも', 'ながら', 'つつ', 'て', 'で'
])

/**
 * テキスト内の改行候補位置を検出
 */
export const findBreakCandidates = (text: string): BreakCandidate[] => {
  const candidates: BreakCandidate[] = []

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const nextChar = i + 1 < text.length ? text[i + 1] : ''

    // 文末の改行候補
    if ('。！？'.includes(char)) {
      candidates.push({
        position: i + 1,
        priority: BreakPriority.SENTENCE,
        penalty: 0.1,
        char: char
      })
    }
    // 句読点の改行候補
    else if (char === '、') {
      candidates.push({
        position: i + 1,
        priority: BreakPriority.CLAUSE,
        penalty: 0.3,
        char: char
      })
    }
    // 会話境界の改行候補
    else if (char === '」' && nextChar !== '、') {
      candidates.push({
        position: i + 1,
        priority: BreakPriority.DIALOGUE,
        penalty: 0.2,
        char: char
      })
    }
    else if (char === '「') {
      candidates.push({
        position: i,
        priority: BreakPriority.DIALOGUE,
        penalty: 0.2,
        char: char
      })
    }
    // 助詞の改行候補
    else if (PARTICLES.has(char)) {
      candidates.push({
        position: i + 1,
        priority: BreakPriority.PARTICLE,
        penalty: 0.5,
        char: char
      })
    }
    // 禁則処理を考慮した文字境界
    else if (i > 0 && !KINSOKU_START_CHARS.has(nextChar) && !KINSOKU_END_CHARS.has(char)) {
      candidates.push({
        position: i + 1,
        priority: BreakPriority.KINSOKU,
        penalty: 0.8,
        char: char
      })
    }
  }

  // 優先度とペナルティでソート
  return candidates.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority
    }
    return a.penalty - b.penalty
  })
}

/**
 * 最適な改行位置を選択
 */
export const selectBreakPoint = (
  text: string,
  maxLength: number,
  candidates: BreakCandidate[]
): number => {
  // まず理想的な長さ範囲の候補を探す
  const idealRange = {
    min: Math.floor(maxLength * 0.7), // 70%以上
    max: maxLength
  }

  // 理想的な範囲内で最も優先度の高い改行候補を探す
  for (const candidate of candidates) {
    if (candidate.position >= idealRange.min && candidate.position <= idealRange.max) {
      return candidate.position
    }
  }

  // 理想的な範囲に候補がない場合、最大長以内で最も遅い位置を探す
  let bestPosition = 0
  for (const candidate of candidates) {
    if (candidate.position <= maxLength && candidate.position > bestPosition) {
      bestPosition = candidate.position
    }
  }

  if (bestPosition > 0) {
    return bestPosition
  }

  // どうしても見つからない場合、強制的に最大長で切る（禁則処理考慮）
  let forcedPosition = maxLength
  while (forcedPosition > 0 && KINSOKU_START_CHARS.has(text[forcedPosition])) {
    forcedPosition--
  }
  while (forcedPosition < text.length - 1 && KINSOKU_END_CHARS.has(text[forcedPosition - 1])) {
    forcedPosition++
    if (forcedPosition >= maxLength) break
  }

  return Math.max(1, forcedPosition) // 最低1文字は含む
}

/**
 * 長い行を複数の行に分割
 */
export const breakLongLine = (
  originalText: string,
  originalNodes: AozoraNode[],
  maxLength: number
): BrokenLine[] => {
  if (originalText.length <= maxLength) {
    // 改行不要の場合
    return [{
      nodes: originalNodes,
      text: originalText,
      characterCount: originalText.length,
      normalizedCount: 0, // 後で計算される
      isContinuation: false,
      continuationIndex: 0,
      totalParts: 1
    }]
  }

  const lines: BrokenLine[] = []
  let remainingText = originalText
  let processedLength = 0
  let partIndex = 0

  while (remainingText.length > 0) {
    if (remainingText.length <= maxLength) {
      // 最後の部分
      const correspondingNodes = extractNodesForTextRange(
        originalNodes,
        processedLength,
        processedLength + remainingText.length
      )

      lines.push({
        nodes: correspondingNodes,
        text: remainingText,
        characterCount: remainingText.length,
        normalizedCount: 0,
        isContinuation: partIndex > 0,
        continuationIndex: partIndex,
        totalParts: 0 // 後で設定
      })
      break
    }

    // 改行候補を検索
    const textSegment = remainingText.substring(0, maxLength + 50) // 少し余裕を持って検索
    const candidates = findBreakCandidates(textSegment)
    const breakPoint = selectBreakPoint(remainingText, maxLength, candidates)

    const segmentText = remainingText.substring(0, breakPoint)
    const correspondingNodes = extractNodesForTextRange(
      originalNodes,
      processedLength,
      processedLength + breakPoint
    )

    lines.push({
      nodes: correspondingNodes,
      text: segmentText,
      characterCount: segmentText.length,
      normalizedCount: 0,
      isContinuation: partIndex > 0,
      continuationIndex: partIndex,
      totalParts: 0 // 後で設定
    })

    remainingText = remainingText.substring(breakPoint)
    processedLength += breakPoint
    partIndex++
  }

  // 総分割数を設定
  const totalParts = lines.length
  lines.forEach(line => {
    line.totalParts = totalParts
  })

  return lines
}

/**
 * テキスト範囲に対応するノードを抽出
 * 複雑な実装が必要だが、まずは簡単な版から
 */
const extractNodesForTextRange = (
  nodes: AozoraNode[],
  startPos: number,
  endPos: number
): AozoraNode[] => {
  // 簡単な実装：テキストの範囲に基づいて新しいテキストノードを作成
  // より高度な実装では、ルビや強調などの構造を保持する必要がある

  let currentPos = 0
  const resultNodes: AozoraNode[] = []

  for (const node of nodes) {
    if (node.type === 'text') {
      const nodeText = node.content
      const nodeStart = currentPos
      const nodeEnd = currentPos + nodeText.length

      if (nodeEnd <= startPos) {
        // このノードは範囲より前
        currentPos = nodeEnd
        continue
      }

      if (nodeStart >= endPos) {
        // このノードは範囲より後
        break
      }

      // このノードは範囲と重複している
      const extractStart = Math.max(0, startPos - nodeStart)
      const extractEnd = Math.min(nodeText.length, endPos - nodeStart)
      const extractedText = nodeText.substring(extractStart, extractEnd)

      if (extractedText) {
        resultNodes.push({
          type: 'text',
          content: extractedText
        })
      }

      currentPos = nodeEnd
    } else {
      // ノード内のテキストを取得（簡略化）
      const nodeText = extractTextFromNode(node)
      const nodeStart = currentPos
      const nodeEnd = currentPos + nodeText.length

      if (nodeStart >= startPos && nodeEnd <= endPos) {
        // ノード全体が範囲内
        resultNodes.push(node)
      }
      // より複雑な部分抽出は将来の改善で対応

      currentPos = nodeEnd
    }
  }

  return resultNodes
}

/**
 * ノードからテキストを抽出（pageDividerからコピー）
 */
const extractTextFromNode = (node: AozoraNode): string => {
  switch (node.type) {
    case 'text':
      return node.content
    case 'ruby':
      return node.base
    case 'emphasis_dots':
      return node.text
    case 'text_size':
      return node.content.map(extractTextFromNode).join('')
    case 'heading':
      return node.content
    case 'block_indent':
      return node.content.map(extractTextFromNode).join('')
    case 'special_char_note':
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
 * 行の配列に改行処理を適用
 */
export const applyLineBreaking = (
  lines: { nodes: AozoraNode[], text: string }[],
  maxCharsPerLine: number
): BrokenLine[] => {
  const result: BrokenLine[] = []

  for (const line of lines) {
    const brokenLines = breakLongLine(line.text, line.nodes, maxCharsPerLine)
    result.push(...brokenLines)
  }

  return result
}