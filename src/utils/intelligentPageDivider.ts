/**
 * インテリジェントなページ分割機能
 * セマンティック境界、コンテンツ複雑度、先読み最適化を考慮した高度なページング
 */

import type { AozoraNode } from '../types/aozora'
import type { CharacterCapacity } from './readerCapacityCalculator'
import { extractTextFromNode, splitIntoLines, type Page } from './pageDivider'

// セマンティック境界の種類と強度
export type SemanticBoundary = {
  position: number
  type: 'sentence' | 'paragraph' | 'dialogue' | 'clause' | 'heading'
  strength: number // 0.0-1.0の境界の強さ
  char?: string // 境界文字（。、！？など）
}

// コンテンツ複雑度指標
export type ContentComplexity = {
  rubyDensity: number // ルビの密度 (0.0-1.0)
  emphasisDensity: number // 強調文の密度
  specialCharDensity: number // 特殊文字の密度
  dialogueDensity: number // 会話文の密度
  overallScore: number // 総合複雑度スコア
}

// 最適な改ページポイント
export type OptimalBreakPoint = {
  position: number
  penalty: number // ペナルティスコア（低いほど良い）
  reason: string // 選択理由
}

// インテリジェントページング設定
export type IntelligentPageOptions = {
  enableSemanticBoundaries: boolean
  enableContentAwareCapacity: boolean
  enableLookAhead: boolean
  enableLineBreaking?: boolean
  lookAheadWindow?: number
  penaltyWeights?: {
    midSentence: number
    midParagraph: number
    farFromTarget: number
    contentComplexity: number
  }
}

// デフォルトのペナルティ重み
const DEFAULT_PENALTY_WEIGHTS = {
  midSentence: 1.0,
  midParagraph: 0.5,
  farFromTarget: 0.3,
  contentComplexity: 0.2
}

/**
 * テキスト内のセマンティック境界を検出
 */
export const detectSemanticBoundaries = (text: string): SemanticBoundary[] => {
  const boundaries: SemanticBoundary[] = []

  // 文の境界（句点、感嘆符、疑問符）
  const sentencePattern = /[。！？]/g
  let match
  while ((match = sentencePattern.exec(text)) !== null) {
    boundaries.push({
      position: match.index + 1,
      type: 'sentence',
      strength: 1.0,
      char: match[0]
    })
  }

  // 段落境界（二重改行）
  const paragraphPattern = /\n\s*\n/g
  while ((match = paragraphPattern.exec(text)) !== null) {
    boundaries.push({
      position: match.index + match[0].length,
      type: 'paragraph',
      strength: 0.8
    })
  }

  // 会話文の境界（「」）
  const dialogueOpenPattern = /「/g
  while ((match = dialogueOpenPattern.exec(text)) !== null) {
    boundaries.push({
      position: match.index,
      type: 'dialogue',
      strength: 0.6,
      char: '「'
    })
  }

  const dialogueClosePattern = /」/g
  while ((match = dialogueClosePattern.exec(text)) !== null) {
    boundaries.push({
      position: match.index + 1,
      type: 'dialogue',
      strength: 0.6,
      char: '」'
    })
  }

  // 節の境界（読点）- 弱い境界
  const clausePattern = /、/g
  while ((match = clausePattern.exec(text)) !== null) {
    boundaries.push({
      position: match.index + 1,
      type: 'clause',
      strength: 0.3,
      char: '、'
    })
  }

  // 位置でソート
  return boundaries.sort((a, b) => a.position - b.position)
}

/**
 * コンテンツの複雑度を計算
 */
export const calculateContentComplexity = (nodes: AozoraNode[]): ContentComplexity => {
  let totalCharacters = 0
  let rubyCount = 0
  let emphasisCount = 0
  let specialCharCount = 0
  let dialogueCount = 0

  const countNodes = (nodeArray: AozoraNode[]) => {
    for (const node of nodeArray) {
      const text = extractTextFromNode(node)
      totalCharacters += text.length

      switch (node.type) {
        case 'ruby':
          rubyCount += node.base.length
          break

        case 'emphasis_dots':
          emphasisCount += node.text.length
          break

        case 'emphasis':
          emphasisCount += node.content.length
          break

        case 'special_char_note':
          specialCharCount += 1
          break

        case 'text_size':
        case 'block_indent':
          if ('content' in node && Array.isArray(node.content)) {
            countNodes(node.content)
          }
          break

        case 'text':
          // 会話文の検出（「」の数をカウント）
          const dialogueMatches = text.match(/[「」]/g)
          if (dialogueMatches) {
            dialogueCount += dialogueMatches.length
          }
          break
      }
    }
  }

  countNodes(nodes)

  if (totalCharacters === 0) {
    return {
      rubyDensity: 0,
      emphasisDensity: 0,
      specialCharDensity: 0,
      dialogueDensity: 0,
      overallScore: 0
    }
  }

  const rubyDensity = rubyCount / totalCharacters
  const emphasisDensity = emphasisCount / totalCharacters
  const specialCharDensity = specialCharCount / totalCharacters
  const dialogueDensity = dialogueCount / totalCharacters

  // 総合スコア（重み付き平均）- プレーンテキストでも最小スコアを持つ
  const overallScore = Math.max(0.1,
    rubyDensity * 0.4 +
    emphasisDensity * 0.3 +
    specialCharDensity * 0.2 +
    dialogueDensity * 0.1
  )

  return {
    rubyDensity,
    emphasisDensity,
    specialCharDensity,
    dialogueDensity,
    overallScore
  }
}

/**
 * 最適な改ページポイントを見つける
 */
export const findOptimalBreakPoint = (
  nodes: AozoraNode[],
  targetPosition: number,
  _capacity: CharacterCapacity,
  options: IntelligentPageOptions = {
    enableSemanticBoundaries: true,
    enableContentAwareCapacity: true,
    enableLookAhead: true,
    enableLineBreaking: false
  }
): OptimalBreakPoint => {
  const penaltyWeights = { ...DEFAULT_PENALTY_WEIGHTS, ...options.penaltyWeights }

  // 全テキストを取得してセマンティック境界を検出
  const allText = nodes.map(extractTextFromNode).join('')
  const boundaries = options.enableSemanticBoundaries ? detectSemanticBoundaries(allText) : []

  // 見出しの位置を特別に検出
  let currentPosition = 0
  const headingPositions: number[] = []

  for (const node of nodes) {
    if (node.type === 'heading' || node.type === 'header') {
      headingPositions.push(currentPosition)
    }
    currentPosition += extractTextFromNode(node).length
  }

  // 見出しの直前を最優先候補とする
  for (const headingPos of headingPositions) {
    if (headingPos >= targetPosition * 0.5 && headingPos <= targetPosition * 1.5) {
      return {
        position: headingPos,
        penalty: 0.1,
        reason: 'heading'
      }
    }
  }

  // セマンティック境界から最適なポイントを選択
  let bestBreakPoint: OptimalBreakPoint = {
    position: targetPosition,
    penalty: 1.0,
    reason: 'fallback'
  }

  if (boundaries.length > 0) {
    for (const boundary of boundaries) {
      // ターゲット位置の前後50%の範囲で候補を検討
      const minPos = targetPosition * 0.3
      const maxPos = targetPosition * 1.5

      if (boundary.position >= minPos && boundary.position <= maxPos) {
        // 距離ペナルティ
        const distancePenalty = Math.abs(boundary.position - targetPosition) / targetPosition * penaltyWeights.farFromTarget

        // 境界タイプペナルティ（強い境界ほど低ペナルティ）
        const boundaryPenalty = (1 - boundary.strength) * penaltyWeights.midSentence

        const totalPenalty = distancePenalty + boundaryPenalty

        if (totalPenalty < bestBreakPoint.penalty) {
          bestBreakPoint = {
            position: boundary.position,
            penalty: totalPenalty,
            reason: boundary.type
          }
        }
      }
    }
  }

  return bestBreakPoint
}

/**
 * コンテンツの複雑度に基づいて容量を調整
 */
export const adjustCapacityForContent = (
  baseCapacity: CharacterCapacity,
  complexity: ContentComplexity
): CharacterCapacity => {
  // 複雑度に基づいて容量を調整（複雑なコンテンツは容量を減らす）
  // 最小スコア0.1を考慮して実際の複雑度を計算
  const actualComplexity = Math.max(0, complexity.overallScore - 0.1)
  const reductionFactor = 1 - (actualComplexity * 0.3) // 最大30%減

  const adjustedTotal = Math.floor(baseCapacity.totalCharacters * reductionFactor)
  const adjustedRows = Math.floor(baseCapacity.rows * reductionFactor)
  const adjustedCols = Math.floor(baseCapacity.cols * reductionFactor)

  return {
    totalCharacters: adjustedTotal,
    rows: adjustedRows,
    cols: adjustedCols,
    charactersPerRow: Math.floor(baseCapacity.charactersPerRow * reductionFactor),
    charactersPerColumn: Math.floor(baseCapacity.charactersPerColumn * reductionFactor)
  }
}

/**
 * インテリジェントページ分割のメイン関数
 */
export const divideIntoIntelligentPages = (
  nodes: AozoraNode[],
  capacity: CharacterCapacity,
  verticalMode: boolean = true,
  options: IntelligentPageOptions = {
    enableSemanticBoundaries: true,
    enableContentAwareCapacity: true,
    enableLookAhead: true,
    enableLineBreaking: false
  }
): Page[] => {
  const pages: Page[] = []

  // コンテンツ複雑度を計算して容量を調整
  let effectiveCapacity = capacity
  if (options.enableContentAwareCapacity) {
    const complexity = calculateContentComplexity(nodes)
    effectiveCapacity = adjustCapacityForContent(capacity, complexity)
  }

  // 行の最大文字数を計算（ページ容量の60%程度を目安）
  const maxCharsPerLine = options.enableLineBreaking
    ? Math.floor(effectiveCapacity.totalCharacters * 0.6)
    : undefined

  // 基本的な行分割を実行
  const lines = splitIntoLines(nodes, maxCharsPerLine)
  if (lines.length === 0) return []

  // 縦書きと横書きで行数の定義が異なる
  const rowsPerColumn = verticalMode ? effectiveCapacity.rows : effectiveCapacity.charactersPerRow
  const pageCapacity = effectiveCapacity.totalCharacters

  // 各行の正規化文字数を計算（既存のロジックを使用）
  lines.forEach(line => {
    const charCount = line.characterCount
    if (charCount === 0) {
      line.normalizedCount = 0
    } else if (charCount < rowsPerColumn) {
      line.normalizedCount = rowsPerColumn
    } else {
      const columns = Math.ceil(charCount / rowsPerColumn)
      line.normalizedCount = columns * rowsPerColumn
    }
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
      node.type === 'heading' || node.type === 'header'
    )

    // 見出しの場合、新しいページを開始（最初のページでない限り）
    if (hasHeading && currentPage.lines.length > 0) {
      pages.push(currentPage)

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
        // インテリジェント改ページを試行
        if (options.enableSemanticBoundaries || options.enableLookAhead) {
          // 現在のページの最適化は今回は基本実装のみ
          // 将来的にはここで改ページ位置の最適化を行う
        }

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