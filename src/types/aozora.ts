export type RubyText = {
  type: 'ruby'
  base: string
  reading: string
}

export type PlainText = {
  type: 'text'
  content: string
}

// 傍点（emphasis dots）
export type EmphasisDots = {
  type: 'emphasis_dots'
  content: string
  text: string  // 傍点を付ける対象のテキスト
}

// テキストサイズ変更
export type TextSize = {
  type: 'text_size'
  content: AozoraNode[]
  size: 'small' | 'large'  // 1段階小さな文字 or 大きな文字
  level?: number  // サイズレベル（将来の拡張用）
}

// 見出し
export type Heading = {
  type: 'heading'
  content: string
  level: 'large' | 'medium' | 'small'  // 大見出し、中見出し、小見出し
}

// ブロック字下げ
export type BlockIndent = {
  type: 'block_indent'
  content: AozoraNode[]
  indent: number  // 字下げの文字数
  style?: 'normal' | 'hanging'  // 通常字下げ or ぶら下げ
}

// ブロック字下げ開始タグ（空行として表示）
export type BlockIndentStart = {
  type: 'block_indent_start'
  indent: number  // 字下げの文字数
}

// ブロック字下げ終了タグ（空行として表示）
export type BlockIndentEnd = {
  type: 'block_indent_end'
}

// 特殊文字説明（レンダリングはせず、注記として保持）
export type SpecialCharNote = {
  type: 'special_char_note'
  char: string
  description: string
  unicode?: string
}

export type Emphasis = {
  type: 'emphasis'
  content: string
  level: number
}

export type Header = {
  type: 'header'
  content: string
  level: number
}

export type AozoraNode =
  | RubyText
  | PlainText
  | EmphasisDots
  | TextSize
  | Heading
  | BlockIndent
  | BlockIndentStart
  | BlockIndentEnd
  | SpecialCharNote
  | Emphasis
  | Header

export type ParsedAozoraDocument = {
  nodes: AozoraNode[]
  metadata: {
    title?: string
    author?: string
    encoding?: string
  }
}