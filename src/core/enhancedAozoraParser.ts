import type {
  AozoraNode,
  ParsedAozoraDocument
} from '../types/aozora'

import { isSentenceEnd } from '../utils/textUtils'

type ParserState = {
  nodes: AozoraNode[]
  currentPosition: number
  text: string
  // スタック式の状態管理
  textSizeStack: Array<{ size: 'small' | 'large', nodes: AozoraNode[] }>
}

export const parseAozoraText = (text: string): ParsedAozoraDocument => {
  const state: ParserState = {
    nodes: [],
    currentPosition: 0,
    text,
    textSizeStack: []
  }
  
  while (state.currentPosition < state.text.length) {
    processNextToken(state)
  }
  
  // 未完了のスタックをフラッシュ
  flushStacks(state)
  
  return {
    nodes: state.nodes,
    metadata: {}
  }
}

const processNextToken = (state: ParserState): void => {
  const { text, currentPosition } = state
  
  // パイプ記号による明示的なルビ範囲指定をチェック
  if (text[currentPosition] === '｜') {
    if (processPipeRuby(state)) return
  }
  
  // 特殊命令タグをチェック ［＃...］
  if (text[currentPosition] === '［' && text[currentPosition + 1] === '＃') {
    if (processSpecialTag(state)) return
  }
  
  // 通常のルビ記法をチェック
  if (processNormalRuby(state)) return
  
  // 通常のテキストを処理
  processPlainText(state)
}

const processSpecialTag = (state: ParserState): boolean => {
  const { text, currentPosition } = state
  const tagEnd = text.indexOf('］', currentPosition)
  
  if (tagEnd === -1) return false
  
  const tagContent = text.substring(currentPosition + 2, tagEnd)
  
  // 傍点（emphasis dots） - 直前のテキストに適用
  const emphasisMatch = tagContent.match(/^「(.+?)」に傍点$/)
  if (emphasisMatch) {
    const targetText = emphasisMatch[1]
    
    // 直前のノードを確認して、対象テキストを探す
    const currentNodes = state.textSizeStack.length > 0
      ? state.textSizeStack[state.textSizeStack.length - 1].nodes
      : state.nodes
    
    if (currentNodes.length > 0) {
      const lastNode = currentNodes[currentNodes.length - 1]
      if (lastNode.type === 'text') {
        const textNode = lastNode as { type: 'text', content: string }
        const targetIndex = textNode.content.lastIndexOf(targetText)
        
        if (targetIndex !== -1) {
          // テキストノードから対象部分を切り出して傍点ノードに置き換え
          const beforeText = textNode.content.substring(0, targetIndex)
          const afterText = textNode.content.substring(targetIndex + targetText.length)
          
          // 元のテキストノードを更新または削除
          if (beforeText) {
            textNode.content = beforeText
          } else {
            currentNodes.pop()
          }
          
          // 傍点ノードを追加
          if (state.textSizeStack.length > 0) {
            state.textSizeStack[state.textSizeStack.length - 1].nodes.push({
              type: 'emphasis_dots',
              content: targetText,
              text: targetText
            })
          } else {
            state.nodes.push({
              type: 'emphasis_dots',
              content: targetText,
              text: targetText
            })
          }
          
          // 残りのテキストがあれば追加
          if (afterText) {
            addNode(state, { type: 'text', content: afterText })
          }
          
          state.currentPosition = tagEnd + 1
          return true
        }
      }
    }
    
    // 対象テキストが見つからない場合は、単独の傍点ノードとして追加
    addNode(state, {
      type: 'emphasis_dots',
      content: targetText,
      text: targetText
    })
    state.currentPosition = tagEnd + 1
    return true
  }
  
  // 見出し - 直前のテキストに適用
  const headingMatch = tagContent.match(/^「(.+?)」は(大|中|小)見出し$/)
  if (headingMatch) {
    const targetText = headingMatch[1]
    const levelMap = { '大': 'large', '中': 'medium', '小': 'small' } as const
    const level = levelMap[headingMatch[2] as '大' | '中' | '小']
    
    // 直前のノードを確認して、対象テキストを探す
    const currentNodes = state.textSizeStack.length > 0
      ? state.textSizeStack[state.textSizeStack.length - 1].nodes
      : state.nodes
    
    if (currentNodes.length > 0) {
      const lastNode = currentNodes[currentNodes.length - 1]
      if (lastNode.type === 'text') {
        const textNode = lastNode as { type: 'text', content: string }
        const targetIndex = textNode.content.lastIndexOf(targetText)
        
        if (targetIndex !== -1) {
          // テキストノードから対象部分を切り出して見出しノードに置き換え
          const beforeText = textNode.content.substring(0, targetIndex)
          const afterText = textNode.content.substring(targetIndex + targetText.length)
          
          // 元のテキストノードを更新または削除
          if (beforeText) {
            textNode.content = beforeText
          } else {
            currentNodes.pop()
          }
          
          // 見出しノードを追加
          if (state.textSizeStack.length > 0) {
            state.textSizeStack[state.textSizeStack.length - 1].nodes.push({
              type: 'heading',
              content: targetText,
              level
            })
          } else {
            state.nodes.push({
              type: 'heading',
              content: targetText,
              level
            })
          }
          
          // 残りのテキストがあれば追加
          if (afterText) {
            addNode(state, { type: 'text', content: afterText })
          }
          
          state.currentPosition = tagEnd + 1
          return true
        }
      }
    }
    
    // 対象テキストが見つからない場合は、単独の見出しノードとして追加
    addNode(state, {
      type: 'heading',
      content: targetText,
      level
    })
    state.currentPosition = tagEnd + 1
    return true
  }
  
  // 単純な見出しタグ
  if (tagContent === '中見出し' || tagContent === '大見出し' || tagContent === '小見出し') {
    // 見出し開始マーカー（内容は後続のテキスト）
    state.currentPosition = tagEnd + 1
    return true
  }
  
  if (tagContent === '中見出し終わり' || tagContent === '大見出し終わり' || tagContent === '小見出し終わり') {
    // 見出し終了マーカー
    state.currentPosition = tagEnd + 1
    return true
  }
  
  // テキストサイズ変更開始
  if (tagContent === '１段階小さな文字' || tagContent === '小さな文字') {
    state.textSizeStack.push({ size: 'small', nodes: [] })
    state.currentPosition = tagEnd + 1
    return true
  }
  
  // テキストサイズ変更終了
  if (tagContent === '小さな文字終わり') {
    const sizeContext = state.textSizeStack.pop()
    if (sizeContext) {
      addNode(state, {
        type: 'text_size',
        content: sizeContext.nodes,
        size: sizeContext.size
      })
    }
    state.currentPosition = tagEnd + 1
    return true
  }
  
  
  // 特殊文字の説明
  const specialCharMatch = tagContent.match(/^「(.+?)」.+?([0-9-]+)$/)
  if (specialCharMatch) {
    addNode(state, {
      type: 'special_char_note',
      char: specialCharMatch[1],
      description: tagContent,
      unicode: specialCharMatch[2]
    })
    state.currentPosition = tagEnd + 1
    return true
  }
  
  // 空タグ
  if (tagContent === '') {
    // 空タグは無視
    state.currentPosition = tagEnd + 1
    return true
  }
  
  return false
}

const processPipeRuby = (state: ParserState): boolean => {
  const { text, currentPosition } = state
  const rubyStart = currentPosition + 1
  const rubyOpenIndex = text.indexOf('《', rubyStart)
  
  if (rubyOpenIndex === -1) return false
  
  const rubyCloseIndex = text.indexOf('》', rubyOpenIndex)
  if (rubyCloseIndex === -1) return false
  
  const base = text.substring(rubyStart, rubyOpenIndex)
  const reading = text.substring(rubyOpenIndex + 1, rubyCloseIndex)
  
  addNode(state, {
    type: 'ruby',
    base,
    reading
  })
  
  state.currentPosition = rubyCloseIndex + 1
  return true
}

const processNormalRuby = (state: ParserState): boolean => {
  const { text, currentPosition } = state
  
  // 現在位置が《で始まる場合のみ処理
  if (text[currentPosition] !== '《') {
    return false
  }
  
  const rubyCloseIndex = text.indexOf('》', currentPosition)
  if (rubyCloseIndex === -1) return false
  
  const reading = text.substring(currentPosition + 1, rubyCloseIndex)
  
  // ルビの前の漢字を探す（最大10文字まで遡る）
  let baseStart = currentPosition - 1
  let kanjiCount = 0
  while (baseStart >= 0 && kanjiCount < 10 && isJapaneseChar(text[baseStart])) {
    baseStart--
    kanjiCount++
  }
  baseStart++
  
  if (baseStart < currentPosition) {
    const base = text.substring(baseStart, currentPosition)
    
    // 既に追加されているテキストから漢字部分を削除
    const currentNodes = state.textSizeStack.length > 0
      ? state.textSizeStack[state.textSizeStack.length - 1].nodes
      : state.nodes
    
    // 最後のテキストノードから base を削除
    if (currentNodes.length > 0 && currentNodes[currentNodes.length - 1].type === 'text') {
      const lastNode = currentNodes[currentNodes.length - 1] as { type: 'text', content: string }
      if (lastNode.content.endsWith(base)) {
        lastNode.content = lastNode.content.substring(0, lastNode.content.length - base.length)
        if (!lastNode.content) {
          currentNodes.pop()
        }
      }
    }
    
    addNode(state, {
      type: 'ruby',
      base,
      reading
    })
    
    state.currentPosition = rubyCloseIndex + 1
    return true
  }
  
  return false
}

const processPlainText = (state: ParserState): void => {
  const { text, currentPosition } = state
  
  // 1文字だけ進める（シンプルに）
  const char = text[currentPosition]
  addNode(state, { type: 'text', content: char })
  state.currentPosition++
}


const addNode = (state: ParserState, node: AozoraNode): void => {
  // スタックがある場合はスタックに追加
  if (state.textSizeStack.length > 0) {
    state.textSizeStack[state.textSizeStack.length - 1].nodes.push(node)
  } else {
    // 通常のノード追加
    if (node.type === 'text' && state.nodes.length > 0 &&
        state.nodes[state.nodes.length - 1].type === 'text') {
      // 連続するテキストノードは結合
      (state.nodes[state.nodes.length - 1] as { type: 'text', content: string }).content += node.content
    } else {
      state.nodes.push(node)
    }
  }
}

const flushStacks = (state: ParserState): void => {
  // 未完了のテキストサイズ変更をフラッシュ
  while (state.textSizeStack.length > 0) {
    const sizeContext = state.textSizeStack.pop()!
    state.nodes.push({
      type: 'text_size',
      content: sizeContext.nodes,
      size: sizeContext.size
    })
  }
}

const parseJapaneseNumber = (numStr: string): number => {
  return parseInt(
    numStr.replace(/[０-９]/g, (char) => 
      String.fromCharCode(char.charCodeAt(0) - 0xFEE0)
    )
  )
}

const isJapaneseChar = (char: string): boolean => {
  const code = char.charCodeAt(0)
  return (
    // CJK統合漢字
    (code >= 0x4e00 && code <= 0x9fff) ||
    // CJK統合漢字拡張A
    (code >= 0x3400 && code <= 0x4dbf)
  )
  // ひらがなとカタカナは除外（ルビは漢字にのみ適用）
}


// ノードを文の区切りで分割する関数
export const splitTextNodeAtSentence = (node: AozoraNode, remainingChars: number): { 
  beforeSplit: AozoraNode | null, 
  afterSplit: AozoraNode | null 
} => {
  if (node.type !== 'text') {
    return { beforeSplit: node, afterSplit: null }
  }
  
  const text = node.content
  if (text.length <= remainingChars) {
    return { beforeSplit: node, afterSplit: null }
  }
  
  // 残り文字数内で最後の文の終わりを探す
  let splitIndex = -1
  for (let i = Math.min(remainingChars, text.length - 1); i >= 0; i--) {
    if (isSentenceEnd(text.substring(0, i + 1))) {
      splitIndex = i + 1
      break
    }
  }
  
  // 文の終わりが見つからない場合は、文全体を見て最初の文の終わりを探す
  if (splitIndex === -1) {
    for (let i = 0; i < text.length; i++) {
      if (isSentenceEnd(text.substring(0, i + 1))) {
        splitIndex = i + 1
        break
      }
    }
  }
  
  // それでも見つからない場合は、分割しない（次のページへ全体を移動）
  if (splitIndex === -1) {
    // 文の終わりが存在しない場合は、全体を次のページへ
    return { beforeSplit: null, afterSplit: node }
  }
  
  const beforeText = text.substring(0, splitIndex)
  const afterText = text.substring(splitIndex)
  
  return {
    beforeSplit: beforeText ? { type: 'text', content: beforeText } : null,
    afterSplit: afterText ? { type: 'text', content: afterText } : null
  }
}
