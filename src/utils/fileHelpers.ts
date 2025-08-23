// 文字エンコーディングを検出してテキストを読み取る
export const readTextFile = async (file: File): Promise<string> => {
  // まずUTF-8として読み込みを試みる
  try {
    const text = await file.text()
    // 文字化けのチェック（簡易的）
    if (!hasGarbledText(text)) {
      return text
    }
  } catch (error) {
    console.warn('UTF-8での読み込みに失敗:', error)
  }

  // Shift_JISとして読み込みを試みる
  try {
    const buffer = await file.arrayBuffer()
    const decoder = new TextDecoder('shift_jis')
    const text = decoder.decode(buffer)
    return text
  } catch (error) {
    console.error('Shift_JISでの読み込みに失敗:', error)
    // 最終的にUTF-8として強制的に読み込む
    return await file.text()
  }
}

// 文字化けを簡易的にチェック
const hasGarbledText = (text: string): boolean => {
  // 一般的な文字化けパターンをチェック
  const garbledPatterns = [
    /[\ufffd]/g, // 置換文字
    /[�]/g, // 不明な文字
  ]
  
  return garbledPatterns.some(pattern => pattern.test(text))
}

// ファイル名から拡張子を取得
export const getFileExtension = (filename: string): string => {
  const lastDot = filename.lastIndexOf('.')
  if (lastDot === -1) return ''
  return filename.substring(lastDot + 1).toLowerCase()
}

// ファイルが対応形式かチェック
export const isValidTextFile = (file: File): boolean => {
  const validExtensions = ['txt', 'text']
  const extension = getFileExtension(file.name)
  return validExtensions.includes(extension) || file.type === 'text/plain'
}