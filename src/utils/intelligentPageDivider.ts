/**
 * インテリジェントなページ分割機能
 * セマンティック境界、コンテンツ複雑度、先読み最適化を考慮した高度なページング
 */

import type { AozoraNode } from '../types/aozora'
import type { CharacterCapacity } from './readerCapacityCalculator'
import { extractTextFromNode, splitIntoLines, countCharacters, type Page, type Line } from './pageDivider'

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
  useCapacityBasedWrapping?: boolean
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

// const SENTENCE_DELIMITERS = new Set(['。', '！', '？'])

const PARTICLE_HEAD_CHARS = new Set(['の', 'は', 'が', 'を', 'に', 'で', 'と', 'も', 'へ'])

const mergeVerticalSegments = (lines: Line[]): Line[] => {
  if (lines.length <= 1) {
    return lines
  }

  const merged: Line[] = []

  const cloneLine = (line: Line): Line => ({
    ...line,
    nodes: [...line.nodes]
  })

  for (const line of lines) {
    if (merged.length === 0) {
      merged.push(cloneLine(line))
      continue
    }

    const previous = merged[merged.length - 1]
    const firstChar = line.text?.[0]

    if (firstChar && PARTICLE_HEAD_CHARS.has(firstChar)) {
      previous.nodes = [...previous.nodes, ...line.nodes]
      previous.text = `${previous.text}${line.text}`
      previous.characterCount = countCharacters(previous.text)
      continue
    }

    merged.push(cloneLine(line))
  }

  return merged
}

export const calculateNormalizedCount = (text: string, charactersPerLine: number): number => {
  if (charactersPerLine <= 0) {
    return 0
  }

  const baseCount = countCharacters(text)
  
  // 特別ルール: 句点で終わる場合は句点も1文字として数える
  // （0文字として扱わない）
  const effectiveCount = baseCount
  
  if (effectiveCount <= 0) {
    return 0
  }

  // 何行（縦書きなら列）を占めるか計算
  const lines = Math.ceil(effectiveCount / charactersPerLine)
  return lines
}

// const createLineFromText = (text: string, charactersPerLine: number): Line => {
//   const node: AozoraNode = { type: 'text', content: text }
//   return {
//     nodes: [node],
//     text,
//     characterCount: countCharacters(text),
//     normalizedCount: calculateNormalizedCount(text, charactersPerLine)
//   }
// }

// const mergeContinuationPunctuation = (lines: Line[]): Line[] => {
//   const merged: Line[] = []
//
//   for (const line of lines) {
//     if (
//       merged.length > 0 &&
//       line.text === '。' &&
//       line.characterCount === 1
//     ) {
//       const previous = merged[merged.length - 1]
//       previous.nodes = [...previous.nodes, ...line.nodes]
//       previous.text += line.text
//       previous.characterCount += line.characterCount
//       previous.normalizedCount = 0
//       continue
//     }
//
//     merged.push(line)
//   }
//
//   return merged
// }

export const splitLineBySentences = (line: Line): Line[] => {
  if (!line.text || line.text.length === 0) {
    return [line]
  }

  const segments: Line[] = []
  const patterns = [
    '。',
    '」',
    '』', 
    '！',
    '？',
    '、'
  ]

  let currentNodes: AozoraNode[] = []
  let currentText = ''
  let nodeIndex = 0

  while (nodeIndex < line.nodes.length) {
    const node = line.nodes[nodeIndex]
    const nodeText = extractTextFromNode(node)
    
    // ルビノードの後に助詞が来るかチェック
    if (node.type === 'ruby' && nodeIndex + 1 < line.nodes.length) {
      const nextNode = line.nodes[nodeIndex + 1]
      if (nextNode.type === 'text' && nextNode.content) {
        const firstChar = nextNode.content[0]
        if (PARTICLE_HEAD_CHARS.has(firstChar)) {
          // ルビと助詞を一緒に保持
          currentNodes.push(node)
          currentText += nodeText
          nodeIndex++
          
          // 助詞を含む部分を処理
          let particleEnd = 1
          while (particleEnd < nextNode.content.length && 
                 PARTICLE_HEAD_CHARS.has(nextNode.content[particleEnd])) {
            particleEnd++
          }
          
          const particlePart = nextNode.content.slice(0, particleEnd)
          currentNodes.push({ type: 'text', content: particlePart })
          currentText += particlePart
          
          // 残りの部分を処理
          if (particleEnd < nextNode.content.length) {
            const remaining = nextNode.content.slice(particleEnd)
            
            // 区切り文字をチェック
            let foundPattern = false
            for (const pattern of patterns) {
              const idx = remaining.indexOf(pattern)
              if (idx !== -1) {
                // 区切り文字の前まで
                if (idx > 0) {
                  const beforePattern = remaining.slice(0, idx)
                  currentNodes.push({ type: 'text', content: beforePattern })
                  currentText += beforePattern
                }
                
                // 区切り文字を含めて現在のセグメントを終了
                currentNodes.push({ type: 'text', content: pattern })
                currentText += pattern
                
                segments.push({
                  text: currentText,
                  nodes: currentNodes,
                  characterCount: countCharacters(currentText),
                  normalizedCount: 0
                })
                
                currentNodes = []
                currentText = ''
                
                // 残りを次のセグメントへ
                if (idx + pattern.length < remaining.length) {
                  const afterPattern = remaining.slice(idx + pattern.length)
                  currentNodes.push({ type: 'text', content: afterPattern })
                  currentText += afterPattern
                }
                
                foundPattern = true
                break
              }
            }
            
            if (!foundPattern) {
              currentNodes.push({ type: 'text', content: remaining })
              currentText += remaining
            }
          }
          
          nodeIndex++
          continue
        }
      }
    }
    
    // 通常のテキストノードの処理
    if (node.type === 'text' && node.content) {
      let remaining = node.content
      let foundPattern = true
      
      while (foundPattern && remaining) {
        foundPattern = false
        for (const pattern of patterns) {
          const idx = remaining.indexOf(pattern)
          if (idx !== -1) {
            // 区切り文字の前まで
            if (idx > 0) {
              const beforePattern = remaining.slice(0, idx)
              currentNodes.push({ type: 'text', content: beforePattern })
              currentText += beforePattern
            }
            
            // 区切り文字を含めて現在のセグメントを終了
            currentNodes.push({ type: 'text', content: pattern })
            currentText += pattern
            
            segments.push({
              text: currentText,
              nodes: currentNodes,
              characterCount: countCharacters(currentText),
              normalizedCount: 0
            })
            
            currentNodes = []
            currentText = ''
            
            // 残りを処理
            remaining = remaining.slice(idx + pattern.length)
            foundPattern = true
            break
          }
        }
      }
      
      // 残りがある場合
      if (remaining) {
        currentNodes.push({ type: 'text', content: remaining })
        currentText += remaining
      }
    } else {
      // その他のノードはそのまま追加
      currentNodes.push(node)
      currentText += nodeText
    }
    
    nodeIndex++
  }

  // 最後のセグメントを追加
  if (currentNodes.length > 0) {
    segments.push({
      text: currentText,
      nodes: currentNodes,
      characterCount: countCharacters(currentText),
      normalizedCount: 0
    })
  }

  return segments.length > 0 ? segments : [line]
}

export const forceSplitLine = (line: Line, charactersPerLine: number): Line[] => {
  if (charactersPerLine <= 0 || !line.text) {
    return [line]
  }

  // シンプルな文字数ベースの分割
  const text = line.text
  const segments: Line[] = []
  let position = 0

  while (position < text.length) {
    let endPos = Math.min(position + charactersPerLine, text.length)

    // 句点特別ルール: charactersPerLineちょうどで切れて次が句点の場合
    if (endPos === position + charactersPerLine && endPos < text.length && text[endPos] === '。') {
      endPos++ // 句点を含める
    }

    const segmentText = text.slice(position, endPos)

    // ノードの再構築
    const segmentNodes: AozoraNode[] = []
    // let accumulatedLength = 0
    let nodeStartPos = 0

    for (const node of line.nodes) {
      const nodeText = extractTextFromNode(node)
      const nodeEndPos = nodeStartPos + nodeText.length

      // このノードがセグメントに関係するか
      if (nodeEndPos > position && nodeStartPos < position + segmentText.length) {
        if (node.type === 'text' && node.content) {
          // テキストノードの部分的な切り出し
          const startInNode = Math.max(0, position - nodeStartPos)
          const endInNode = Math.min(nodeText.length, position + segmentText.length - nodeStartPos)
          const partialContent = node.content.slice(startInNode, endInNode)

          if (partialContent) {
            segmentNodes.push({ type: 'text', content: partialContent })
          }
        } else {
          // ルビなどの特殊ノードは、完全に含まれる場合のみ追加
          if (nodeStartPos >= position && nodeEndPos <= position + segmentText.length) {
            segmentNodes.push(node)
          }
        }
      }

      nodeStartPos = nodeEndPos
      if (nodeStartPos >= position + segmentText.length) {
        break
      }
    }

    segments.push({
      text: segmentText,
      nodes: segmentNodes.length > 0 ? segmentNodes : [{ type: 'text', content: segmentText }],
      characterCount: countCharacters(segmentText),
      normalizedCount: calculateNormalizedCount(segmentText, charactersPerLine)
    })

    position = endPos
  }

  return segments.length > 0 ? segments : [line]
}

const divideVerticalLines = (
  lines: Line[],
  effectiveCapacity: CharacterCapacity,
  _options: IntelligentPageOptions,
  verticalMode: boolean
): Page[] => {
  const rowsPerColumn = Math.max(1, verticalMode ? effectiveCapacity.rows : effectiveCapacity.charactersPerRow)
  const pageCapacity = effectiveCapacity.totalCharacters
  const pages: Page[] = []

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

  let currentPage: Page = {
    lines: [],
    totalCharacters: 0,
    startIndex: 0,
    endIndex: 0
  }

  let nodeIndex = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const hasHeading = line.nodes.some(node =>
      node.type === 'heading' || node.type === 'header'
    )

    if (hasHeading && currentPage.lines.length > 0) {
      pages.push(currentPage)

      currentPage = {
        lines: [line],
        totalCharacters: line.normalizedCount,
        startIndex: nodeIndex,
        endIndex: nodeIndex + line.nodes.length - 1
      }
    } else if (currentPage.totalCharacters + line.normalizedCount <= pageCapacity) {
      currentPage.lines.push(line)
      currentPage.totalCharacters += line.normalizedCount
      currentPage.endIndex = nodeIndex + line.nodes.length - 1
    } else {
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

  if (currentPage.lines.length > 0) {
    pages.push(currentPage)
  }

  return pages
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
    enableSemanticBoundaries: false,
    enableContentAwareCapacity: false,
    enableLookAhead: false,
    enableLineBreaking: true,
    useCapacityBasedWrapping: true
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
    enableSemanticBoundaries: false,
    enableContentAwareCapacity: false,
    enableLookAhead: false,
    enableLineBreaking: true,
    useCapacityBasedWrapping: true
  }
): Page[] => {
  let effectiveCapacity = capacity
  if (options.enableContentAwareCapacity) {
    const complexity = calculateContentComplexity(nodes)
    effectiveCapacity = adjustCapacityForContent(capacity, complexity)
  }

  if (verticalMode) {
    const shouldDisableLineBreaking = !options.enableLineBreaking

    const maxCharsPerLine = shouldDisableLineBreaking
      ? undefined
      : Math.max(1, Math.floor(effectiveCapacity.totalCharacters * 0.6))

    const verticalLines = splitIntoLines(nodes, maxCharsPerLine)
    const processedLines = maxCharsPerLine && maxCharsPerLine > 1
      ? mergeVerticalSegments(verticalLines)
      : verticalLines
    if (verticalLines.length === 0) {
      return []
    }

    return divideVerticalLines(processedLines, effectiveCapacity, options, true)
  }

  // 横書きモード用の新しいアルゴリズム
  const charactersPerLine = Math.max(1, effectiveCapacity.charactersPerRow)
  const visibleLines = Math.max(1, effectiveCapacity.rows)

  const initialLines = splitIntoLines(nodes)
  if (initialLines.length === 0) return []

  const pages: Page[] = []
  let currentPage: Page = {
    lines: [],
    totalCharacters: 0,
    startIndex: 0,
    endIndex: 0
  }

  let nodeIndex = 0
  let remainingVisibleLines = visibleLines
  let lineQueue = [...initialLines]
  let queueIndex = 0

  while (queueIndex < lineQueue.length) {
    const line = lineQueue[queueIndex]
    const lineText = line.text
    const charCount = countCharacters(lineText)
    
    // この行が占める行数を計算
    // 句点特別ルール: 行末が句点で、ちょうど1文字オーバーの場合は1行とカウント
    let linesOccupied: number
    if (lineText.endsWith('。') && charCount === charactersPerLine + 1) {
      linesOccupied = 1
    } else {
      linesOccupied = Math.ceil(charCount / charactersPerLine)
    }
    
    if (linesOccupied <= remainingVisibleLines) {
      // 行が収まる場合
      if (linesOccupied > 1 && options.useCapacityBasedWrapping) {
        // 複数行にまたがる場合は分割して追加
        const segments = forceSplitLine(line, charactersPerLine)
        for (const segment of segments) {
          if (currentPage.lines.length === 0) {
            currentPage.startIndex = nodeIndex
          }
          currentPage.lines.push(segment)
          currentPage.totalCharacters += countCharacters(segment.text)
        }
      } else {
        // そのまま追加
        if (currentPage.lines.length === 0) {
          currentPage.startIndex = nodeIndex
        }
        currentPage.lines.push(line)
        currentPage.totalCharacters += charCount
      }
      
      currentPage.endIndex = nodeIndex + line.nodes.length - 1
      remainingVisibleLines -= linesOccupied
      nodeIndex += line.nodes.length
      queueIndex++
      
      // ページが満杯になった場合
      if (remainingVisibleLines <= 0 && queueIndex < lineQueue.length) {
        pages.push(currentPage)
        currentPage = {
          lines: [],
          totalCharacters: 0,
          startIndex: nodeIndex,
          endIndex: nodeIndex
        }
        remainingVisibleLines = visibleLines
      }
    } else {
      // 行が収まらない場合
      if (currentPage.lines.length === 0 && !options.useCapacityBasedWrapping) {
        // ページが空で分割オプションが無効な場合は強制的に追加
        currentPage.startIndex = nodeIndex
        currentPage.lines.push(line)
        currentPage.totalCharacters += charCount
        currentPage.endIndex = nodeIndex + line.nodes.length - 1
        nodeIndex += line.nodes.length
        queueIndex++
        
        pages.push(currentPage)
        currentPage = {
          lines: [],
          totalCharacters: 0,
          startIndex: nodeIndex,
          endIndex: nodeIndex
        }
        remainingVisibleLines = visibleLines
      } else if (options.useCapacityBasedWrapping) {
        // 文単位で分割を試みる
        const sentenceSegments = splitLineBySentences(line)
        
        if (sentenceSegments.length > 1) {
          // 文単位で分割できた場合、キューを更新
          lineQueue.splice(queueIndex, 1, ...sentenceSegments)
          continue
        }
        
        // 文単位で分割できない場合、強制分割
        const forcedSegments = forceSplitLine(line, charactersPerLine)
        if (forcedSegments.length > 1) {
          lineQueue.splice(queueIndex, 1, ...forcedSegments)
          continue
        }
        
        // それでも収まらない場合は次のページへ
        if (currentPage.lines.length > 0) {
          pages.push(currentPage)
          currentPage = {
            lines: [],
            totalCharacters: 0,
            startIndex: nodeIndex,
            endIndex: nodeIndex
          }
          remainingVisibleLines = visibleLines
        } else {
          // 空のページに強制追加
          currentPage.startIndex = nodeIndex
          currentPage.lines.push(line)
          currentPage.totalCharacters += charCount
          currentPage.endIndex = nodeIndex + line.nodes.length - 1
          nodeIndex += line.nodes.length
          queueIndex++
          
          pages.push(currentPage)
          currentPage = {
            lines: [],
            totalCharacters: 0,
            startIndex: nodeIndex,
            endIndex: nodeIndex
          }
          remainingVisibleLines = visibleLines
        }
      } else {
        // 現在のページを終了して次のページへ
        if (currentPage.lines.length > 0) {
          pages.push(currentPage)
          currentPage = {
            lines: [],
            totalCharacters: 0,
            startIndex: nodeIndex,
            endIndex: nodeIndex
          }
          remainingVisibleLines = visibleLines
        }
      }
    }
  }

  // 最後のページを追加
  if (currentPage.lines.length > 0) {
    pages.push(currentPage)
  }

  return pages
}
