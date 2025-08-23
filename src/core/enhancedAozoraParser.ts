import type { 
  AozoraNode, 
  ParsedAozoraDocument,
  TextSize,
  BlockIndent,
  EmphasisDots,
  Heading,
  SpecialCharNote 
} from '../types/aozora'

type ParserState = {
  nodes: AozoraNode[]
  currentPosition: number
  text: string
  // スタック式の状態管理
  textSizeStack: Array<{ size: 'small' | 'large', nodes: AozoraNode[] }>
  blockIndentStack: Array<{ indent: number, nodes: AozoraNode[] }>
}

export const parseAozoraText = (text: string): ParsedAozoraDocument => {
  const state: ParserState = {
    nodes: [],
    currentPosition: 0,
    text,
    textSizeStack: [],
    blockIndentStack: []
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
      : state.blockIndentStack.length > 0
      ? state.blockIndentStack[state.blockIndentStack.length - 1].nodes
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
          } else if (state.blockIndentStack.length > 0) {
            state.blockIndentStack[state.blockIndentStack.length - 1].nodes.push({
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
  
  // 見出し
  const headingMatch = tagContent.match(/^「(.+?)」は(大|中|小)見出し$/)
  if (headingMatch) {
    const content = headingMatch[1]
    const levelMap = { '大': 'large', '中': 'medium', '小': 'small' } as const
    addNode(state, {
      type: 'heading',
      content,
      level: levelMap[headingMatch[2] as '大' | '中' | '小']
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
  
  // ブロック字下げ開始
  const blockIndentStartMatch = tagContent.match(/^ここから([０-９0-9]+)字下げ$/)
  if (blockIndentStartMatch) {
    const indentCount = parseJapaneseNumber(blockIndentStartMatch[1])
    state.blockIndentStack.push({ indent: indentCount, nodes: [] })
    state.currentPosition = tagEnd + 1
    return true
  }
  
  // ブロック字下げ終了
  if (tagContent === 'ここで字下げ終わり') {
    const indentContext = state.blockIndentStack.pop()
    if (indentContext) {
      addNode(state, {
        type: 'block_indent',
        content: indentContext.nodes,
        indent: indentContext.indent
      })
    }
    state.currentPosition = tagEnd + 1
    return true
  }
  
  // 単純な字下げ（字下げ後のテキストはルビを含む可能性があるため続けて処理）
  const simpleIndentMatch = tagContent.match(/^([０-９0-9]+)字下げ$/)
  if (simpleIndentMatch) {
    const indentCount = parseJapaneseNumber(simpleIndentMatch[1])
    const spaces = '　'.repeat(indentCount)
    addNode(state, { type: 'text', content: spaces })
    state.currentPosition = tagEnd + 1
    // 字下げの後のテキストを処理するためtrueを返さない
    // これにより次のトークン処理が続行される
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
  const rubyOpenIndex = text.indexOf('《', currentPosition)
  
  if (rubyOpenIndex === -1 || rubyOpenIndex !== currentPosition) {
    // 現在位置にルビ開始がない場合
    if (rubyOpenIndex > currentPosition) {
      // 前方にルビがある場合、漢字を探す
      const possiblePipeIndex = text.lastIndexOf('｜', rubyOpenIndex)
      if (possiblePipeIndex >= currentPosition) return false
      
      const rubyCloseIndex = text.indexOf('》', rubyOpenIndex)
      if (rubyCloseIndex === -1) return false
      
      // ルビの前の漢字を探す
      let baseStart = rubyOpenIndex - 1
      while (baseStart >= currentPosition && isJapaneseChar(text[baseStart])) {
        baseStart--
      }
      baseStart++
      
      if (baseStart < rubyOpenIndex) {
        // baseStartより前のテキストを処理
        if (baseStart > currentPosition) {
          const beforeText = text.substring(currentPosition, baseStart)
          processTextSegment(state, beforeText)
        }
        
        const base = text.substring(baseStart, rubyOpenIndex)
        const reading = text.substring(rubyOpenIndex + 1, rubyCloseIndex)
        
        addNode(state, {
          type: 'ruby',
          base,
          reading
        })
        
        state.currentPosition = rubyCloseIndex + 1
        return true
      }
    }
  }
  
  return false
}

const processPlainText = (state: ParserState): void => {
  const { text, currentPosition } = state
  
  // ルビの前の漢字をチェック
  const nextRubyOpen = text.indexOf('《', currentPosition)
  if (nextRubyOpen !== -1 && nextRubyOpen > currentPosition) {
    // パイプがないルビの場合、漢字を探す必要がある
    const possiblePipeIndex = text.lastIndexOf('｜', nextRubyOpen)
    if (possiblePipeIndex < currentPosition) {
      // パイプがないので、漢字を探す
      let baseStart = nextRubyOpen - 1
      while (baseStart >= currentPosition && isJapaneseChar(text[baseStart])) {
        baseStart--
      }
      baseStart++
      
      if (baseStart < nextRubyOpen) {
        // baseStartより前のテキストを処理
        if (baseStart > currentPosition) {
          const beforeText = text.substring(currentPosition, baseStart)
          processTextSegment(state, beforeText)
          state.currentPosition = baseStart
        }
        return // ルビ処理は次のループで行われる
      }
    }
  }
  
  // 次の特殊文字を探す
  let nextSpecialChar = text.length
  const nextPipe = text.indexOf('｜', currentPosition)
  const nextTag = text.indexOf('［＃', currentPosition)
  
  if (nextRubyOpen !== -1) nextSpecialChar = Math.min(nextSpecialChar, nextRubyOpen)
  if (nextPipe !== -1) nextSpecialChar = Math.min(nextSpecialChar, nextPipe)
  if (nextTag !== -1) nextSpecialChar = Math.min(nextSpecialChar, nextTag)
  
  if (nextSpecialChar > currentPosition) {
    const content = text.substring(currentPosition, nextSpecialChar)
    if (content) {
      processTextSegment(state, content)
    }
    state.currentPosition = nextSpecialChar
  } else {
    // 1文字だけ進める
    const char = text[currentPosition]
    addNode(state, { type: 'text', content: char })
    state.currentPosition++
  }
}

const processTextSegment = (state: ParserState, text: string): void => {
  // テキストセグメント内の特殊タグとルビを再帰的に処理
  const tempState: ParserState = {
    nodes: [],
    currentPosition: 0,
    text,
    textSizeStack: [],
    blockIndentStack: []
  }
  
  while (tempState.currentPosition < tempState.text.length) {
    // 特殊タグをチェック
    if (tempState.text[tempState.currentPosition] === '［' && 
        tempState.text[tempState.currentPosition + 1] === '＃') {
      if (processSpecialTag(tempState)) {
        continue
      }
    }
    
    // ルビをチェック
    if (processNormalRuby(tempState)) {
      continue
    }
    
    // 通常テキストを処理
    const nextSpecial = Math.min(
      tempState.text.indexOf('［＃', tempState.currentPosition) === -1 ? tempState.text.length : tempState.text.indexOf('［＃', tempState.currentPosition),
      tempState.text.indexOf('《', tempState.currentPosition) === -1 ? tempState.text.length : tempState.text.indexOf('《', tempState.currentPosition)
    )
    
    if (nextSpecial > tempState.currentPosition) {
      const content = tempState.text.substring(tempState.currentPosition, nextSpecial)
      if (content) {
        addNode(tempState, { type: 'text', content })
      }
      tempState.currentPosition = nextSpecial
    } else {
      // 1文字進める
      const char = tempState.text[tempState.currentPosition]
      addNode(tempState, { type: 'text', content: char })
      tempState.currentPosition++
    }
  }
  
  // 処理済みノードを親ステートに追加
  tempState.nodes.forEach(node => addNode(state, node))
}

const addNode = (state: ParserState, node: AozoraNode): void => {
  // スタックがある場合はスタックに追加
  if (state.textSizeStack.length > 0) {
    state.textSizeStack[state.textSizeStack.length - 1].nodes.push(node)
  } else if (state.blockIndentStack.length > 0) {
    state.blockIndentStack[state.blockIndentStack.length - 1].nodes.push(node)
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
  
  // 未完了のブロック字下げをフラッシュ
  while (state.blockIndentStack.length > 0) {
    const indentContext = state.blockIndentStack.pop()!
    state.nodes.push({
      type: 'block_indent',
      content: indentContext.nodes,
      indent: indentContext.indent
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
    // ひらがな
    (code >= 0x3040 && code <= 0x309f) ||
    // カタカナ
    (code >= 0x30a0 && code <= 0x30ff) ||
    // CJK統合漢字拡張A
    (code >= 0x3400 && code <= 0x4dbf)
  )
}