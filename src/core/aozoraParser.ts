import type { AozoraNode, ParsedAozoraDocument } from '../types/aozora'

// 字下げタグを処理する補助関数
const processIndentTags = (text: string): AozoraNode[] => {
  const nodes: AozoraNode[] = []
  let currentPosition = 0
  
  while (currentPosition < text.length) {
    // 字下げタグを探す
    const tagStart = text.indexOf('［＃', currentPosition)
    
    if (tagStart === -1) {
      // 残りのテキストを追加
      if (currentPosition < text.length) {
        const remaining = text.substring(currentPosition)
        if (remaining) {
          if (nodes.length > 0 && nodes[nodes.length - 1].type === 'text') {
            (nodes[nodes.length - 1] as { type: 'text', content: string }).content += remaining
          } else {
            nodes.push({ type: 'text', content: remaining })
          }
        }
      }
      break
    }
    
    // tagStartより前のテキストがあれば追加
    if (tagStart > currentPosition) {
      const beforeTag = text.substring(currentPosition, tagStart)
      if (beforeTag) {
        if (nodes.length > 0 && nodes[nodes.length - 1].type === 'text') {
          (nodes[nodes.length - 1] as { type: 'text', content: string }).content += beforeTag
        } else {
          nodes.push({ type: 'text', content: beforeTag })
        }
      }
    }
    
    // 字下げタグの終わりを探す
    const tagEnd = text.indexOf('］', tagStart)
    if (tagEnd === -1) {
      // 閉じタグがない場合は通常のテキストとして扱う
      const remaining = text.substring(tagStart)
      if (nodes.length > 0 && nodes[nodes.length - 1].type === 'text') {
        (nodes[nodes.length - 1] as { type: 'text', content: string }).content += remaining
      } else {
        nodes.push({ type: 'text', content: remaining })
      }
      break
    }
    
    // タグの内容を確認
    const tagContent = text.substring(tagStart + 2, tagEnd)
    const indentMatch = tagContent.match(/^([０-９0-9]+)字下げ$/)
    
    if (indentMatch) {
      // 全角数字を半角に変換
      const indentCount = parseInt(
        indentMatch[1].replace(/[０-９]/g, (char) => 
          String.fromCharCode(char.charCodeAt(0) - 0xFEE0)
        )
      )
      
      // 全角スペースを指定数分追加
      const spaces = '　'.repeat(indentCount)
      if (nodes.length > 0 && nodes[nodes.length - 1].type === 'text') {
        (nodes[nodes.length - 1] as { type: 'text', content: string }).content += spaces
      } else {
        nodes.push({ type: 'text', content: spaces })
      }
    } else {
      // 字下げタグでない場合は通常のテキストとして扱う
      const tagText = text.substring(tagStart, tagEnd + 1)
      if (nodes.length > 0 && nodes[nodes.length - 1].type === 'text') {
        (nodes[nodes.length - 1] as { type: 'text', content: string }).content += tagText
      } else {
        nodes.push({ type: 'text', content: tagText })
      }
    }
    
    currentPosition = tagEnd + 1
  }
  
  return nodes
}

export const parseAozoraText = (text: string): ParsedAozoraDocument => {
  const nodes: AozoraNode[] = []
  let currentPosition = 0
  
  while (currentPosition < text.length) {
    let processed = false
    
    // 字下げタグをチェック ［＃n字下げ］
    if (text[currentPosition] === '［' && text[currentPosition + 1] === '＃') {
      const tagEnd = text.indexOf('］', currentPosition)
      if (tagEnd !== -1) {
        const tagContent = text.substring(currentPosition + 2, tagEnd)
        const indentMatch = tagContent.match(/^([０-９0-9]+)字下げ$/)
        
        if (indentMatch) {
          // 全角数字を半角に変換
          const indentCount = parseInt(
            indentMatch[1].replace(/[０-９]/g, (char) => 
              String.fromCharCode(char.charCodeAt(0) - 0xFEE0)
            )
          )
          
          // 全角スペースを指定数分追加
          const spaces = '　'.repeat(indentCount)
          
          if (nodes.length > 0 && nodes[nodes.length - 1].type === 'text') {
            (nodes[nodes.length - 1] as { type: 'text', content: string }).content += spaces
          } else {
            nodes.push({
              type: 'text',
              content: spaces
            })
          }
          
          currentPosition = tagEnd + 1
          processed = true
          continue
        }
      }
    }
    
    if (processed) continue
    
    // パイプ記号による明示的なルビ範囲指定をチェック
    if (text[currentPosition] === '｜') {
      const rubyStart = currentPosition + 1
      const rubyOpenIndex = text.indexOf('《', rubyStart)
      
      if (rubyOpenIndex !== -1) {
        const rubyCloseIndex = text.indexOf('》', rubyOpenIndex)
        
        if (rubyCloseIndex !== -1) {
          const base = text.substring(rubyStart, rubyOpenIndex)
          const reading = text.substring(rubyOpenIndex + 1, rubyCloseIndex)
          
          nodes.push({
            type: 'ruby',
            base,
            reading
          })
          
          currentPosition = rubyCloseIndex + 1
          processed = true
          continue
        }
      }
      // パイプがあるが有効なルビ記法でない場合、パイプを通常のテキストとして扱う
    }
    
    if (processed) continue
    
    // 通常のルビ記法をチェック (漢字《読み》)
    const rubyOpenIndex = text.indexOf('《', currentPosition)
    
    if (rubyOpenIndex !== -1) {
      // パイプベースのルビかチェック（｜が《の前にあるか）
      const possiblePipeIndex = text.lastIndexOf('｜', rubyOpenIndex)
      const isPipeRuby = possiblePipeIndex !== -1 && possiblePipeIndex >= currentPosition
      
      if (!isPipeRuby) {
        const rubyCloseIndex = text.indexOf('》', rubyOpenIndex)
        
        if (rubyCloseIndex !== -1) {
          // ルビ開始記号の前のテキストを処理
          if (rubyOpenIndex > currentPosition) {
            // ルビ開始記号の直前から漢字を探す
            let baseStart = rubyOpenIndex - 1
            
            // 漢字の開始位置を探す（漢字、ひらがな、カタカナが続く限り遡る）
            while (baseStart >= currentPosition && isJapaneseChar(text[baseStart])) {
              baseStart--
            }
            baseStart++
            
            // baseStartより前にテキストがある場合
            if (baseStart > currentPosition) {
              const beforeText = text.substring(currentPosition, baseStart)
              if (beforeText) {
                // beforeTextに字下げタグが含まれているか確認し、処理する
                const processedNodes = processIndentTags(beforeText)
                nodes.push(...processedNodes)
              }
            }
            
            // ルビテキストを作成
            const base = text.substring(baseStart, rubyOpenIndex)
            const reading = text.substring(rubyOpenIndex + 1, rubyCloseIndex)
            
            if (base) {
              nodes.push({
                type: 'ruby',
                base,
                reading
              })
            } else {
              // baseが空の場合は通常のテキストとして扱う
              const content = text.substring(currentPosition, rubyCloseIndex + 1)
              nodes.push({
                type: 'text',
                content
              })
            }
          } else {
            // 直前に漢字がない場合（連続するルビなど）
            const reading = text.substring(rubyOpenIndex + 1, rubyCloseIndex)
            
            // 直前のノードがテキストノードで漢字を含む場合、それをベースとする
            if (nodes.length > 0 && nodes[nodes.length - 1].type === 'text') {
              const lastNode = nodes[nodes.length - 1] as { type: 'text', content: string }
              let baseStart = lastNode.content.length - 1
              
              while (baseStart >= 0 && isJapaneseChar(lastNode.content[baseStart])) {
                baseStart--
              }
              baseStart++
              
              if (baseStart < lastNode.content.length) {
                const base = lastNode.content.substring(baseStart)
                const remainingText = lastNode.content.substring(0, baseStart)
                
                // 最後のノードを更新
                if (remainingText) {
                  lastNode.content = remainingText
                } else {
                  nodes.pop()
                }
                
                nodes.push({
                  type: 'ruby',
                  base,
                  reading
                })
              }
            }
          }
          
          currentPosition = rubyCloseIndex + 1
          continue
        }
      }
    }
    
    // 通常のテキストを処理
    let nextSpecialChar = text.length
    const nextRubyOpen = text.indexOf('《', currentPosition)
    const nextPipe = text.indexOf('｜', currentPosition)
    const nextIndentTag = text.indexOf('［＃', currentPosition)
    
    if (nextRubyOpen !== -1) nextSpecialChar = Math.min(nextSpecialChar, nextRubyOpen)
    if (nextPipe !== -1) nextSpecialChar = Math.min(nextSpecialChar, nextPipe)
    if (nextIndentTag !== -1) nextSpecialChar = Math.min(nextSpecialChar, nextIndentTag)
    
    // 現在位置から次の特殊文字までのテキストを追加
    if (nextSpecialChar > currentPosition) {
      const content = text.substring(currentPosition, nextSpecialChar)
      if (content) {
        // 最後のノードがテキストノードの場合は結合
        if (nodes.length > 0 && nodes[nodes.length - 1].type === 'text') {
          (nodes[nodes.length - 1] as { type: 'text', content: string }).content += content
        } else {
          nodes.push({
            type: 'text',
            content
          })
        }
      }
      currentPosition = nextSpecialChar
      // 特殊文字の位置に移動したので、次のループで処理する
      continue
    } else if (nextSpecialChar === currentPosition) {
      // 既に特殊文字の位置にいる
      // 上のチェック（字下げ、パイプ、ルビ）で処理されなかった場合のみここに来る
      // つまり、特殊文字に見えるが有効なパターンではない
      const char = text[currentPosition]
      if (nodes.length > 0 && nodes[nodes.length - 1].type === 'text') {
        (nodes[nodes.length - 1] as { type: 'text', content: string }).content += char
      } else {
        nodes.push({
          type: 'text',
          content: char
        })
      }
      currentPosition++
    }
    
    // テキストの終わりに達した
    if (currentPosition >= text.length) {
      break
    }
  }
  
  return {
    nodes,
    metadata: {}
  }
}

// 日本語文字（漢字・ひらがな・カタカナ）かどうかをチェック
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