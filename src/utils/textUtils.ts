/**
 * テキスト処理のユーティリティ関数
 */

// 文の終わりを示す文字
const SENTENCE_ENDINGS = ['。', '！', '？', '.', '!', '?'] as const
// 閉じ括弧（文末に続く可能性がある）
const CLOSING_BRACKETS = ['」', '』', '）', '"', ')'] as const
// 読点（文の区切り）
const COMMAS = ['、', '，', ','] as const
// その他の区切り文字
const OTHER_PUNCTUATION = ['；', ';', '：', ':'] as const

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
