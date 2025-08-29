/**
 * テキスト処理のユーティリティ関数
 */

// 文の終わりを示す文字
const SENTENCE_ENDINGS = ['。', '！', '？', '.', '!', '?'] as const
// 閉じ括弧（文末に続く可能性がある）
const CLOSING_BRACKETS = ['」', '』', '）', '"', ')', '】', '］'] as const
// 読点（文の区切り）
const COMMAS = ['、', '，', ','] as const
// その他の区切り文字
const OTHER_PUNCTUATION = ['；', ';', '：', ':', '…', '‥', '・・・', '...'] as const
// 開き括弧
const OPENING_BRACKETS = ['「', '『', '（', '"', '(', '【', '［'] as const

/**
 * 指定位置が青空文庫の特殊指示（［＃...］）の内部かどうかを判定
 */
const isInsideSpecialInstruction = (text: string, index: number): boolean => {
  // 現在位置より前で最後の［＃を探す
  let lastOpenIndex = -1
  for (let i = index - 1; i >= 0; i--) {
    if (text[i] === '［' && i + 1 < text.length && text[i + 1] === '＃') {
      lastOpenIndex = i
      break
    }
  }

  // ［＃が見つからない場合は、特殊指示の外
  if (lastOpenIndex === -1) {
    return false
  }

  // ［＃の後に］があるかチェック
  for (let i = lastOpenIndex + 2; i < index; i++) {
    if (text[i] === '］') {
      // 既に閉じられているので、特殊指示の外
      return false
    }
  }

  // ［＃の後、現在位置までに］がない場合は、特殊指示の内部
  return true
}

/**
 * テキストが文の終わりで終わっているかを判定
 */
export const isSentenceEnd = (text: string): boolean => {
  if (!text || text.length === 0) return false

  // 特殊指示で終わっている場合はスキップ
  if (text.endsWith('］')) {
    // ［＃で始まる特殊指示かチェック
    const lastOpenIndex = text.lastIndexOf('［＃')
    if (lastOpenIndex !== -1 && lastOpenIndex < text.lastIndexOf('］')) {
      // 特殊指示で終わっているので、その前の文字をチェック
      const beforeInstruction = text.substring(0, lastOpenIndex).trim()
      if (beforeInstruction) {
        return isSentenceEnd(beforeInstruction)
      }
      return false
    }
  }

  const lastChar = text[text.length - 1]

  // 句点で終わる（特殊指示の外）
  if (SENTENCE_ENDINGS.includes(lastChar as any) && !isInsideSpecialInstruction(text, text.length - 1)) {
    return true
  }

  // 閉じ括弧で終わる（その前に句点がある場合）
  if (CLOSING_BRACKETS.includes(lastChar as any) && text.length > 1) {
    const prevChar = text[text.length - 2]
    if (SENTENCE_ENDINGS.includes(prevChar as any) && !isInsideSpecialInstruction(text, text.length - 2)) {
      return true
    }
  }

  return false
}


/**
 * テキスト内で次の文の終わり位置を検索
 * @param text 検索対象のテキスト
 * @param startIndex 検索開始位置（デフォルト: 0）
 * @returns 文の終わり位置（見つからない場合は-1）
 */
export const findNextSentenceEnd = (text: string, startIndex: number = 0): number => {
  for (let i = startIndex; i < text.length; i++) {
    // 特殊指示の内部はスキップ
    if (isInsideSpecialInstruction(text, i)) {
      continue
    }

    const char = text[i]

    // 句点の場合
    if (SENTENCE_ENDINGS.includes(char as any)) {
      // 次の文字を確認
      let nextIndex = i + 1

      // 閉じ括弧が続く場合はそれも含める
      while (nextIndex < text.length) {
        const nextChar = text[nextIndex]
        if (CLOSING_BRACKETS.includes(nextChar as any) && !isInsideSpecialInstruction(text, nextIndex)) {
          nextIndex++
        } else {
          break
        }
      }

      return nextIndex
    }
  }

  return -1
}

/**
 * テキスト内で最後の文の終わり位置を検索（後ろから検索）
 * @param text 検索対象のテキスト
 * @param maxIndex 検索終了位置（デフォルト: テキスト末尾）
 * @returns 文の終わり位置（見つからない場合は-1）
 */
export const findLastSentenceEnd = (text: string, maxIndex?: number): number => {
  const endIndex = maxIndex !== undefined ? Math.min(maxIndex, text.length - 1) : text.length - 1

  for (let i = endIndex; i >= 0; i--) {
    // 特殊指示の内部はスキップ
    if (isInsideSpecialInstruction(text, i)) {
      continue
    }

    const char = text[i]

    // 句点の場合
    if (SENTENCE_ENDINGS.includes(char as any)) {
      // 次の文字を確認
      let nextIndex = i + 1

      // 閉じ括弧が続く場合はそれも含める
      while (nextIndex < text.length && nextIndex <= endIndex + 1) {
        const nextChar = text[nextIndex]
        if (CLOSING_BRACKETS.includes(nextChar as any) && !isInsideSpecialInstruction(text, nextIndex)) {
          nextIndex++
        } else {
          break
        }
      }

      return nextIndex
    }

    // 閉じ括弧だけの場合（前に句点がある場合のみ有効）
    if (CLOSING_BRACKETS.includes(char as any) && i > 0) {
      const prevChar = text[i - 1]
      if (SENTENCE_ENDINGS.includes(prevChar as any) && !isInsideSpecialInstruction(text, i - 1)) {
        return i + 1
      }
    }
  }

  return -1
}

/**
 * テキストを適切な位置で分割
 * 優先順位: 文の終わり > 読点 > 改行 > スペース
 * @param text 分割対象のテキスト
 * @param maxLength 最大文字数
 * @returns { before: 前半部分, after: 後半部分 }
 */
export const splitTextAtBoundary = (
  text: string,
  maxLength: number
): { before: string; after: string } => {
  if (text.length <= maxLength) {
    return { before: text, after: '' }
  }

  let splitIndex = -1

  // 1. 文の終わりを探す
  splitIndex = findLastSentenceEnd(text, maxLength - 1)

  // 2. 文の終わりが見つからない場合は、読点で区切る
  if (splitIndex === -1) {
    for (let i = Math.min(maxLength - 1, text.length - 1); i >= 0; i--) {
      if (COMMAS.includes(text[i] as any) && !isInsideSpecialInstruction(text, i)) {
        splitIndex = i + 1
        break
      }
    }
  }

  // 3. それでも見つからない場合は、その他の句読点で区切る
  if (splitIndex === -1) {
    for (let i = Math.min(maxLength - 1, text.length - 1); i >= 0; i--) {
      if (OTHER_PUNCTUATION.includes(text[i] as any) && !isInsideSpecialInstruction(text, i)) {
        splitIndex = i + 1
        break
      }
    }
  }

  // 4. それでも見つからない場合は、改行で区切る
  if (splitIndex === -1) {
    for (let i = Math.min(maxLength - 1, text.length - 1); i >= 0; i--) {
      if (text[i] === '\n') {
        splitIndex = i + 1
        break
      }
    }
  }

  // 5. それでも見つからない場合は、スペースで区切る
  if (splitIndex === -1) {
    for (let i = Math.min(maxLength - 1, text.length - 1); i >= 0; i--) {
      if (text[i] === ' ' || text[i] === '　') {
        splitIndex = i + 1
        break
      }
    }
  }

  // 6. 最終手段：maxLengthで強制的に区切る
  if (splitIndex === -1) {
    splitIndex = maxLength
  }

  return {
    before: text.substring(0, splitIndex).trim(),
    after: text.substring(splitIndex).trim()
  }
}

/**
 * テキストを文単位で分割
 * @param text 分割対象のテキスト
 * @returns 文の配列
 */
export const splitIntoSentences = (text: string): string[] => {
  const sentences: string[] = []
  let currentPos = 0

  while (currentPos < text.length) {
    const nextEnd = findNextSentenceEnd(text, currentPos)

    if (nextEnd === -1) {
      // 文の終わりが見つからない場合は残り全部を1文とする
      const remaining = text.substring(currentPos).trim()
      if (remaining) {
        sentences.push(remaining)
      }
      break
    }

    const sentence = text.substring(currentPos, nextEnd).trim()
    if (sentence) {
      sentences.push(sentence)
    }
    currentPos = nextEnd
  }

  return sentences
}

/**
 * テキスト内の文の数を数える
 */
export const countSentences = (text: string): number => {
  return splitIntoSentences(text).length
}

/**
 * テキスト内の文字数を数える（ルビを除く）
 * @param text カウント対象のテキスト
 * @param includeSpaces スペースを含めるかどうか
 * @returns 文字数
 */
export const countCharacters = (text: string, includeSpaces: boolean = true): number => {
  if (!text) return 0
  
  // ルビ記法を除去
  let cleanText = text
  // 標準のルビ記法《...》を除去
  cleanText = cleanText.replace(/《[^》]*》/g, '')
  // パイプ記法の｜を除去
  cleanText = cleanText.replace(/｜/g, '')
  // 青空文庫の特殊指示［＃...］を除去
  cleanText = cleanText.replace(/［＃[^］]*］/g, '')
  
  if (!includeSpaces) {
    // スペース、タブ、改行を除去
    cleanText = cleanText.replace(/[\s\u3000]/g, '')
  }
  
  return cleanText.length
}

/**
 * テキスト内の文字数を数える（ルビのみ）
 * @param text カウント対象のテキスト
 * @returns ルビ文字数
 */
export const countRubyCharacters = (text: string): number => {
  if (!text) return 0
  
  let rubyCount = 0
  
  // 標準のルビ記法《...》の中身をカウント
  const rubyMatches = text.match(/《([^》]*)》/g)
  if (rubyMatches) {
    rubyMatches.forEach(match => {
      rubyCount += match.slice(1, -1).length  // 《》を除いた文字数
    })
  }
  
  return rubyCount
}

/**
 * テキストの文字種別統計を取得
 * @param text 分析対象のテキスト
 * @returns 文字種別ごとの文字数
 */
export type CharacterStats = {
  total: number           // 総文字数
  withoutSpaces: number   // スペースを除いた文字数
  hiragana: number        // ひらがな
  katakana: number        // カタカナ
  kanji: number          // 漢字
  alphanumeric: number   // 英数字
  punctuation: number    // 句読点
  spaces: number         // スペース
  ruby: number          // ルビ文字数
  other: number         // その他
}

export const getCharacterStats = (text: string): CharacterStats => {
  if (!text) {
    return {
      total: 0,
      withoutSpaces: 0,
      hiragana: 0,
      katakana: 0,
      kanji: 0,
      alphanumeric: 0,
      punctuation: 0,
      spaces: 0,
      ruby: 0,
      other: 0
    }
  }
  
  // ルビを先にカウントして除去
  const rubyCount = countRubyCharacters(text)
  
  // クリーンなテキストを取得（ルビと特殊指示を除去）
  let cleanText = text
  cleanText = cleanText.replace(/《[^》]*》/g, '')
  cleanText = cleanText.replace(/｜/g, '')
  cleanText = cleanText.replace(/［＃[^］]*］/g, '')
  
  const stats: CharacterStats = {
    total: cleanText.length,
    withoutSpaces: 0,
    hiragana: 0,
    katakana: 0,
    kanji: 0,
    alphanumeric: 0,
    punctuation: 0,
    spaces: 0,
    ruby: rubyCount,
    other: 0
  }
  
  for (const char of cleanText) {
    const code = char.charCodeAt(0)
    
    // スペース（半角・全角）
    if (char === ' ' || char === '　' || char === '\t' || char === '\n' || char === '\r') {
      stats.spaces++
    }
    // ひらがな
    else if (code >= 0x3040 && code <= 0x309f) {
      stats.hiragana++
      stats.withoutSpaces++
    }
    // カタカナ
    else if (code >= 0x30a0 && code <= 0x30ff) {
      stats.katakana++
      stats.withoutSpaces++
    }
    // 漢字
    else if ((code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf)) {
      stats.kanji++
      stats.withoutSpaces++
    }
    // 英数字
    else if ((code >= 0x0030 && code <= 0x0039) || // 数字
             (code >= 0x0041 && code <= 0x005a) || // 大文字
             (code >= 0x0061 && code <= 0x007a)) { // 小文字
      stats.alphanumeric++
      stats.withoutSpaces++
    }
    // 句読点
    else if (SENTENCE_ENDINGS.includes(char as any) || 
             COMMAS.includes(char as any) ||
             OTHER_PUNCTUATION.includes(char as any)) {
      stats.punctuation++
      stats.withoutSpaces++
    }
    // その他
    else {
      stats.other++
      stats.withoutSpaces++
    }
  }
  
  return stats
}

/**
 * 日本語テキストを適切な単位でチャンク分割する
 * @param text 分割対象のテキスト
 * @param options チャンク分割のオプション
 * @returns チャンクの配列
 */
export type ChunkOptions = {
  // 段落境界を優先するか
  preferParagraphBoundary?: boolean
  // 会話文をまとめるか
  keepDialogueTogether?: boolean
  // チャンクの重複を許可するか（文脈保持用）
  allowOverlap?: boolean
  // 重複サイズ（文字数）
  overlapSize?: number
}

export type TextChunk = {
  content: string
  startIndex: number
  endIndex: number
  sentenceCount: number
  isDialogue: boolean
  isParagraphStart: boolean
  isParagraphEnd: boolean
}

/**
 * テキストが会話文かどうかを判定
 */
const isDialogue = (text: string): boolean => {
  const trimmed = text.trim()
  if (!trimmed) return false
  
  // 開き括弧で始まり閉じ括弧で終わる
  return OPENING_BRACKETS.some(open => {
    if (!trimmed.startsWith(open)) return false
    
    // 対応する閉じ括弧を探す
    const pairs: Record<string, string> = {
      '「': '」',
      '『': '』',
      '（': '）',
      '"': '"',
      '(': ')',
      '【': '】',
      '［': '］'
    }
    
    const expectedClose = pairs[open]
    if (!expectedClose) return false
    
    return trimmed.endsWith(expectedClose) || 
           trimmed.endsWith(expectedClose + '。') ||
           trimmed.endsWith(expectedClose + '！') ||
           trimmed.endsWith(expectedClose + '？')
  })
}

/**
 * 段落の境界を検出
 */
const findParagraphBoundaries = (text: string): number[] => {
  const boundaries: number[] = [0]
  
  // 連続する改行を段落境界とする
  const doubleNewlinePattern = /\n\s*\n/g
  let match
  while ((match = doubleNewlinePattern.exec(text)) !== null) {
    boundaries.push(match.index + match[0].length)
  }
  
  // 青空文庫の特殊指示による段落区切り
  const specialBreakPattern = /［＃改ページ］|［＃改段］|［＃改行］/g
  while ((match = specialBreakPattern.exec(text)) !== null) {
    boundaries.push(match.index + match[0].length)
  }
  
  boundaries.push(text.length)
  return [...new Set(boundaries)].sort((a, b) => a - b)
}

/**
 * 日本語テキストを文単位でチャンク分割
 */
export const chunkJapaneseText = (
  text: string,
  options: ChunkOptions = {}
): TextChunk[] => {
  const {
    preferParagraphBoundary = true,
    keepDialogueTogether = true,
    allowOverlap = false,
    overlapSize = 50
  } = options
  
  const chunks: TextChunk[] = []
  const sentences = splitIntoSentences(text)
  
  if (sentences.length === 0) return []
  
  const paragraphBoundaries = preferParagraphBoundary ? findParagraphBoundaries(text) : []
  
  // 文ごとにチャンクを作成
  let currentIndex = 0
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i]
    const sentenceStart = text.indexOf(sentence, currentIndex)
    const sentenceEnd = sentenceStart + sentence.length
    
    // 段落境界のチェック
    const isParagraphStart = paragraphBoundaries.some(
      boundary => boundary <= sentenceStart && 
      (i === 0 || text.indexOf(sentences[i - 1], 0) + sentences[i - 1].length < boundary)
    )
    
    const isParagraphEnd = paragraphBoundaries.some(
      boundary => boundary > sentenceStart && boundary <= sentenceEnd
    ) || i === sentences.length - 1
    
    // 会話文のグループ化
    if (keepDialogueTogether && i > 0) {
      const prevChunk = chunks[chunks.length - 1]
      const currentIsDialogue = isDialogue(sentence)
      const prevIsDialogue = prevChunk && prevChunk.isDialogue
      
      // 同じタイプ（会話文同士または地の文同士）なら前のチャンクに追加
      if (currentIsDialogue === prevIsDialogue && !isParagraphStart) {
        prevChunk.content += sentence
        prevChunk.endIndex = sentenceEnd
        prevChunk.sentenceCount++
        prevChunk.isParagraphEnd = isParagraphEnd
        currentIndex = sentenceEnd
        continue
      }
    }
    
    // 新しいチャンクを作成
    const chunk: TextChunk = {
      content: sentence,
      startIndex: sentenceStart,
      endIndex: sentenceEnd,
      sentenceCount: 1,
      isDialogue: isDialogue(sentence),
      isParagraphStart,
      isParagraphEnd
    }
    
    chunks.push(chunk)
    currentIndex = sentenceEnd
  }
  
  // オーバーラップ処理
  if (allowOverlap && overlapSize > 0 && chunks.length > 1) {
    const overlappedChunks: TextChunk[] = []
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = { ...chunks[i] }
      
      // 前のチャンクから文を追加
      if (i > 0) {
        const prevChunk = chunks[i - 1]
        const prevSentences = splitIntoSentences(prevChunk.content)
        let overlapContent = ''
        let overlapLength = 0
        
        // 前のチャンクの最後の文から、overlapSizeに達するまで追加
        for (let j = prevSentences.length - 1; j >= 0 && overlapLength < overlapSize; j--) {
          overlapContent = prevSentences[j] + overlapContent
          overlapLength += prevSentences[j].length
        }
        
        if (overlapContent) {
          chunk.content = overlapContent + chunk.content
          chunk.startIndex = Math.max(0, chunk.startIndex - overlapLength)
        }
      }
      
      overlappedChunks.push(chunk)
    }
    
    return overlappedChunks
  }
  
  return chunks
}

/**
 * チャンクを結合してテキストに戻す
 */
export const joinChunks = (chunks: TextChunk[]): string => {
  if (chunks.length === 0) return ''
  
  // オーバーラップを考慮して結合
  let result = chunks[0].content
  let lastEndIndex = chunks[0].endIndex
  
  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i]
    
    // オーバーラップ部分をスキップ
    if (chunk.startIndex < lastEndIndex) {
      const overlap = lastEndIndex - chunk.startIndex
      const nonOverlapContent = chunk.content.substring(overlap)
      result += nonOverlapContent
    } else {
      result += chunk.content
    }
    
    lastEndIndex = chunk.endIndex
  }
  
  return result
}
