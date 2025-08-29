/**
 * ビューポート内に表示可能な文字数を計算するモジュール
 */

export type Unit = 'px' | 'rem' | 'em'

export type ValueWithUnit = {
  value: number
  unit?: Unit
}

export type ViewportDimensions = {
  width: number
  height: number
}

export type FontMetrics = {
  fontSize: number | ValueWithUnit
  lineHeight: number | ValueWithUnit
  letterSpacing?: number | ValueWithUnit
  fontFamily?: string
}

export type LayoutMode = 'horizontal' | 'vertical'

export type PaddingConfig = {
  top: number | ValueWithUnit
  right: number | ValueWithUnit
  bottom: number | ValueWithUnit
  left: number | ValueWithUnit
}

export type ViewportTextMetrics = {
  charactersPerLine: number
  visibleLines: number
  totalCharacters: number
  usableWidth: number
  usableHeight: number
}

/**
 * rem/emをピクセルに変換
 */
export const toPixels = (
  value: number | ValueWithUnit,
  baseFontSize: number = 16,
  parentFontSize?: number
): number => {
  if (typeof value === 'number') {
    return value
  }
  
  const unit = value.unit || 'px'
  
  switch (unit) {
    case 'rem':
      return value.value * baseFontSize
    case 'em':
      return value.value * (parentFontSize || baseFontSize)
    case 'px':
    default:
      return value.value
  }
}

/**
 * ルート要素のフォントサイズを取得
 */
export const getRootFontSize = (): number => {
  if (typeof document === 'undefined') {
    return 16 // デフォルト値
  }
  
  const rootElement = document.documentElement
  const fontSize = window.getComputedStyle(rootElement).fontSize
  return parseFloat(fontSize) || 16
}

/**
 * 1行に表示可能な文字数を計算
 */
export const calculateCharactersPerLine = (
  viewportWidth: number,
  fontSize: number | ValueWithUnit,
  padding: PaddingConfig = { top: 0, right: 0, bottom: 0, left: 0 },
  letterSpacing: number | ValueWithUnit = 0,
  mode: LayoutMode = 'horizontal',
  baseFontSize?: number
): number => {
  const rootSize = baseFontSize || getRootFontSize()
  const fontSizePx = toPixels(fontSize, rootSize)
  const letterSpacingPx = toPixels(letterSpacing, rootSize, fontSizePx)
  
  const paddingLeft = toPixels(padding.left, rootSize)
  const paddingRight = toPixels(padding.right, rootSize)
  const paddingTop = toPixels(padding.top, rootSize)
  const paddingBottom = toPixels(padding.bottom, rootSize)
  
  const usableWidth = mode === 'horizontal' 
    ? viewportWidth - paddingLeft - paddingRight
    : viewportWidth - paddingTop - paddingBottom
    
  const effectiveCharWidth = fontSizePx + letterSpacingPx
  
  if (effectiveCharWidth <= 0) return 0
  
  return Math.floor(usableWidth / effectiveCharWidth)
}

/**
 * 表示可能な行数を計算
 */
export const calculateVisibleLines = (
  viewportHeight: number,
  lineHeight: number | ValueWithUnit,
  padding: PaddingConfig = { top: 0, right: 0, bottom: 0, left: 0 },
  mode: LayoutMode = 'horizontal',
  baseFontSize?: number
): number => {
  const rootSize = baseFontSize || getRootFontSize()
  const lineHeightPx = toPixels(lineHeight, rootSize)
  
  const paddingTop = toPixels(padding.top, rootSize)
  const paddingBottom = toPixels(padding.bottom, rootSize)
  const paddingLeft = toPixels(padding.left, rootSize)
  const paddingRight = toPixels(padding.right, rootSize)
  
  const usableHeight = mode === 'horizontal'
    ? viewportHeight - paddingTop - paddingBottom
    : viewportHeight - paddingLeft - paddingRight
    
  if (lineHeightPx <= 0) return 0
  
  return Math.floor(usableHeight / lineHeightPx)
}

/**
 * ビューポート内の表示可能文字数を計算
 */
export const calculateViewportCapacity = (
  viewport: ViewportDimensions,
  fontMetrics: FontMetrics,
  padding: PaddingConfig = { top: 0, right: 0, bottom: 0, left: 0 },
  mode: LayoutMode = 'horizontal',
  baseFontSize?: number
): ViewportTextMetrics => {
  const rootSize = baseFontSize || getRootFontSize()
  
  const charactersPerLine = calculateCharactersPerLine(
    viewport.width,
    fontMetrics.fontSize,
    padding,
    fontMetrics.letterSpacing || 0,
    mode,
    rootSize
  )
  
  const visibleLines = calculateVisibleLines(
    viewport.height,
    fontMetrics.lineHeight,
    padding,
    mode,
    rootSize
  )
  
  const paddingLeft = toPixels(padding.left, rootSize)
  const paddingRight = toPixels(padding.right, rootSize)
  const paddingTop = toPixels(padding.top, rootSize)
  const paddingBottom = toPixels(padding.bottom, rootSize)
  
  const usableWidth = mode === 'horizontal'
    ? viewport.width - paddingLeft - paddingRight
    : viewport.width - paddingTop - paddingBottom
    
  const usableHeight = mode === 'horizontal'
    ? viewport.height - paddingTop - paddingBottom
    : viewport.height - paddingLeft - paddingRight
  
  return {
    charactersPerLine,
    visibleLines,
    totalCharacters: charactersPerLine * visibleLines,
    usableWidth,
    usableHeight
  }
}

/**
 * テキストを測定用のcanvas要素を使って実際の幅を計算
 */
export const measureTextWidth = (
  text: string,
  fontFamily: string = 'sans-serif',
  fontSize: number = 16
): number => {
  if (typeof document === 'undefined') {
    // サーバーサイドやテスト環境では概算値を返す
    return text.length * fontSize * 0.5
  }
  
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  
  if (!context) {
    return text.length * fontSize * 0.5
  }
  
  context.font = `${fontSize}px ${fontFamily}`
  const metrics = context.measureText(text)
  
  return metrics.width
}

/**
 * 日本語文字の平均幅を考慮した文字数計算
 */
export const calculateJapaneseCharactersPerLine = (
  viewportWidth: number,
  fontSize: number | ValueWithUnit,
  padding: PaddingConfig = { top: 0, right: 0, bottom: 0, left: 0 },
  mode: LayoutMode = 'horizontal',
  baseFontSize?: number
): number => {
  const rootSize = baseFontSize || getRootFontSize()
  const fontSizePx = toPixels(fontSize, rootSize)
  
  const paddingLeft = toPixels(padding.left, rootSize)
  const paddingRight = toPixels(padding.right, rootSize)
  const paddingTop = toPixels(padding.top, rootSize)
  const paddingBottom = toPixels(padding.bottom, rootSize)
  
  const usableWidth = mode === 'horizontal'
    ? viewportWidth - paddingLeft - paddingRight
    : viewportWidth - paddingTop - paddingBottom
  
  // 日本語フォントは通常正方形（全角）
  // ひらがな・カタカナ・漢字は fontSize とほぼ同じ幅
  const japaneseCharWidth = fontSizePx
  
  if (japaneseCharWidth <= 0) return 0
  
  return Math.floor(usableWidth / japaneseCharWidth)
}

/**
 * レスポンシブな文字サイズを計算
 */
export const calculateResponsiveFontSize = (
  viewport: ViewportDimensions,
  targetCharactersPerLine: number,
  padding: PaddingConfig = { top: 0, right: 0, bottom: 0, left: 0 },
  mode: LayoutMode = 'horizontal',
  baseFontSize?: number
): number => {
  const rootSize = baseFontSize || getRootFontSize()
  
  const paddingLeft = toPixels(padding.left, rootSize)
  const paddingRight = toPixels(padding.right, rootSize)
  const paddingTop = toPixels(padding.top, rootSize)
  const paddingBottom = toPixels(padding.bottom, rootSize)
  
  const usableWidth = mode === 'horizontal'
    ? viewport.width - paddingLeft - paddingRight
    : viewport.width - paddingTop - paddingBottom
  
  if (targetCharactersPerLine <= 0) return 16
  
  return Math.floor(usableWidth / targetCharactersPerLine)
}

/**
 * スクロール可能なコンテンツの総ページ数を計算
 */
export const calculateTotalPages = (
  totalCharacters: number,
  charactersPerPage: number
): number => {
  if (charactersPerPage <= 0) return 0
  return Math.ceil(totalCharacters / charactersPerPage)
}

/**
 * 現在のページ番号を計算
 */
export const calculateCurrentPage = (
  scrollPosition: number,
  pageHeight: number
): number => {
  if (pageHeight <= 0) return 1
  return Math.floor(scrollPosition / pageHeight) + 1
}