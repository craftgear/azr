/**
 * リーダー要素に表示可能な文字数を計算する
 */

export type ReaderDimensions = {
  width: number
  height: number
  fontSize: number
  lineHeight: number
  paddingTop: number
  paddingBottom: number
  paddingLeft: number
  paddingRight: number
}

export type CharacterCapacity = {
  totalCharacters: number
  rows: number
  cols: number
  charactersPerRow: number
  charactersPerColumn: number
}

/**
 * 日本語文字の幅を推定（フォントサイズに対する比率）
 * 等幅フォントの場合、日本語文字は通常フォントサイズと同じ幅
 */
const JAPANESE_CHAR_WIDTH_RATIO = 1.0

/**
 * 英数字の平均幅を推定（フォントサイズに対する比率）
 */
const ASCII_CHAR_WIDTH_RATIO = 0.5

/**
 * div.reader要素から寸法情報を取得
 */
export const getReaderDimensions = (element: HTMLElement): ReaderDimensions => {
  const computedStyle = window.getComputedStyle(element)
  
  const fontSize = parseFloat(computedStyle.fontSize) || 16
  const lineHeight = parseFloat(computedStyle.lineHeight) || fontSize * 1.8
  
  return {
    width: element.clientWidth,
    height: element.clientHeight,
    fontSize,
    lineHeight,
    paddingTop: parseFloat(computedStyle.paddingTop) || 0,
    paddingBottom: parseFloat(computedStyle.paddingBottom) || 0,
    paddingLeft: parseFloat(computedStyle.paddingLeft) || 0,
    paddingRight: parseFloat(computedStyle.paddingRight) || 0
  }
}

/**
 * 縦書きモードでの表示可能文字数を計算
 */
export const calculateVerticalCapacity = (
  dimensions: ReaderDimensions,
  charWidthRatio: number = JAPANESE_CHAR_WIDTH_RATIO
): CharacterCapacity => {
  const { width, height, fontSize, lineHeight, paddingTop, paddingBottom, paddingLeft, paddingRight } = dimensions
  
  // 実際の表示可能エリア
  const visibleWidth = width - paddingLeft - paddingRight
  const visibleHeight = height - paddingTop - paddingBottom
  
  // 縦書きでは、文字は縦に並び、列は右から左へ
  const charHeight = fontSize
  const colWidth = lineHeight
  
  // 各列に表示可能な文字数（行数）
  const charactersPerColumn = Math.floor(visibleHeight / charHeight)
  
  // 表示可能な列数
  const cols = Math.floor(visibleWidth / colWidth)
  
  // 総文字数
  const totalCharacters = charactersPerColumn * cols
  
  return {
    totalCharacters,
    rows: charactersPerColumn,
    cols,
    charactersPerRow: cols,
    charactersPerColumn
  }
}

/**
 * 横書きモードでの表示可能文字数を計算
 */
export const calculateHorizontalCapacity = (
  dimensions: ReaderDimensions,
  charWidthRatio: number = JAPANESE_CHAR_WIDTH_RATIO
): CharacterCapacity => {
  const { width, height, fontSize, lineHeight, paddingTop, paddingBottom, paddingLeft, paddingRight } = dimensions
  
  // 実際の表示可能エリア
  const visibleWidth = width - paddingLeft - paddingRight
  const visibleHeight = height - paddingTop - paddingBottom
  
  // 横書きでは、文字は横に並び、行は上から下へ
  const charWidth = fontSize * charWidthRatio
  const rowHeight = lineHeight
  
  // 各行に表示可能な文字数
  const charactersPerRow = Math.floor(visibleWidth / charWidth)
  
  // 表示可能な行数
  const rows = Math.floor(visibleHeight / rowHeight)
  
  // 総文字数
  const totalCharacters = charactersPerRow * rows
  
  return {
    totalCharacters,
    rows,
    cols: charactersPerRow,
    charactersPerRow,
    charactersPerColumn: rows
  }
}

/**
 * リーダー要素に表示可能な文字数を計算
 * @param element - div.reader要素
 * @param verticalMode - 縦書きモード（true）か横書きモード（false）
 * @param charType - 'japanese' | 'mixed' | 'ascii'
 * @returns 表示可能な文字数情報
 */
export const calculateReaderCapacity = (
  element: HTMLElement,
  verticalMode: boolean = true,
  charType: 'japanese' | 'mixed' | 'ascii' = 'japanese'
): CharacterCapacity => {
  const dimensions = getReaderDimensions(element)
  
  // 文字タイプに応じた幅の比率を決定
  let charWidthRatio: number
  switch (charType) {
    case 'japanese':
      charWidthRatio = JAPANESE_CHAR_WIDTH_RATIO
      break
    case 'ascii':
      charWidthRatio = ASCII_CHAR_WIDTH_RATIO
      break
    case 'mixed':
      // 混在の場合は平均的な値を使用
      charWidthRatio = (JAPANESE_CHAR_WIDTH_RATIO + ASCII_CHAR_WIDTH_RATIO) / 2
      break
    default:
      charWidthRatio = JAPANESE_CHAR_WIDTH_RATIO
  }
  
  if (verticalMode) {
    return calculateVerticalCapacity(dimensions, charWidthRatio)
  } else {
    return calculateHorizontalCapacity(dimensions, charWidthRatio)
  }
}

/**
 * 実際のテキストを測定して正確な文字数を計算
 * Canvas APIを使用してテキストの実際の幅を測定
 */
export const calculateExactCapacity = (
  element: HTMLElement,
  sampleText: string,
  verticalMode: boolean = true
): CharacterCapacity => {
  const dimensions = getReaderDimensions(element)
  const { fontSize } = dimensions
  
  // Canvas要素を作成してテキストの幅を測定
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  
  if (!context) {
    // Canvasが使用できない場合は推定値を返す
    return calculateReaderCapacity(element, verticalMode, 'mixed')
  }
  
  // フォントスタイルを設定
  const computedStyle = window.getComputedStyle(element)
  const fontFamily = computedStyle.fontFamily || 'sans-serif'
  context.font = `${fontSize}px ${fontFamily}`
  
  // サンプルテキストの平均文字幅を計算
  const textWidth = context.measureText(sampleText).width
  const avgCharWidth = textWidth / sampleText.length
  const charWidthRatio = avgCharWidth / fontSize
  
  if (verticalMode) {
    return calculateVerticalCapacity(dimensions, charWidthRatio)
  } else {
    return calculateHorizontalCapacity(dimensions, charWidthRatio)
  }
}