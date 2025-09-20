import { describe, it, expect } from 'vitest'
import type { AozoraNode } from '../types/aozora'
import type { CharacterCapacity } from './readerCapacityCalculator'
import { divideIntoIntelligentPages } from './intelligentPageDivider'

describe('Intelligent Paging Demo', () => {
  const createCapacity = (total: number, rows: number = 10): CharacterCapacity => ({
    totalCharacters: total,
    rows,
    cols: total / rows,
    charactersPerRow: total / rows,
    charactersPerColumn: rows
  })

  it('demonstrates intelligent paging features', () => {
    // 実際の青空文庫風サンプルテキスト
    const sampleNodes: AozoraNode[] = [
      { type: 'heading', content: '吾輩は猫である', level: 'large' },
      { type: 'text', content: '\n' },
      { type: 'header', content: '夏目漱石', level: 1 },
      { type: 'text', content: '\n\n　吾輩は' },
      { type: 'ruby', base: '猫', reading: 'ねこ' },
      { type: 'text', content: 'である。名前はまだ' },
      { type: 'ruby', base: '無', reading: 'な' },
      { type: 'text', content: 'い。\n　どこで生れたかとんと' },
      { type: 'emphasis_dots', content: '見当', text: '見当' },
      { type: 'text', content: 'がつかぬ。何でも' },
      { type: 'emphasis', content: '薄暗い', level: 1 },
      { type: 'text', content: '所で' },
      { type: 'ruby', base: '鳴', reading: 'な' },
      { type: 'text', content: 'いていた事だけは記憶している。\n\n　吾輩はここで始めて人間という者を見た。' }
    ]

    const capacity = createCapacity(60, 10) // 60文字/ページ、10文字/列

    // インテリジェントページング
    const intelligentPages = divideIntoIntelligentPages(
      sampleNodes,
      capacity,
      true,
      {
        enableSemanticBoundaries: true,
        enableContentAwareCapacity: true,
        enableLookAhead: true,
        enableLineBreaking: true
      }
    )

    console.log('\n=== INTELLIGENT PAGING ===')
    intelligentPages.forEach((page, index) => {
      console.log(`Page ${index + 1}: ${page.totalCharacters} chars, ${page.lines.length} lines`)
      page.lines.forEach((line, lineIndex) => {
        console.log(`  Line ${lineIndex + 1}: "${line.text}" (${line.characterCount} chars)`)
      })
    })

    // ページングが動作することを確認
    expect(intelligentPages.length).toBeGreaterThan(0)

    // ページが正しく作成されていることを確認
    intelligentPages.forEach(page => {
      expect(page.lines.length).toBeGreaterThan(0)
      expect(page.totalCharacters).toBeGreaterThan(0)
    })
  })

  it('demonstrates content complexity-aware capacity adjustment', () => {
    // ルビと強調が多いコンテンツ
    const complexNodes: AozoraNode[] = [
      { type: 'text', content: 'この' },
      { type: 'ruby', base: '文書', reading: 'ぶんしょ' },
      { type: 'text', content: 'には' },
      { type: 'emphasis_dots', content: '多数', text: '多数' },
      { type: 'text', content: 'の' },
      { type: 'ruby', base: '複雑', reading: 'ふくざつ' },
      { type: 'text', content: 'な' },
      { type: 'ruby', base: '要素', reading: 'ようそ' },
      { type: 'text', content: 'が含まれています。' }
    ]

    // シンプルなコンテンツ
    const simpleNodes: AozoraNode[] = [
      { type: 'text', content: 'これはシンプルなテキストです。特別な要素は含まれていません。普通の文章です。' }
    ]

    const capacity = createCapacity(50, 10)

    const complexPages = divideIntoIntelligentPages(
      complexNodes,
      capacity,
      true,
      {
        enableSemanticBoundaries: true,
        enableContentAwareCapacity: true,
        enableLookAhead: false
      }
    )

    const simplePages = divideIntoIntelligentPages(
      simpleNodes,
      capacity,
      true,
      {
        enableSemanticBoundaries: true,
        enableContentAwareCapacity: true,
        enableLookAhead: false
      }
    )

    console.log('\n=== COMPLEX CONTENT PAGING ===')
    console.log(`Complex content generated ${complexPages.length} pages`)
    complexPages.forEach((page, index) => {
      console.log(`Page ${index + 1}: ${page.totalCharacters} chars (adjusted for complexity)`)
    })

    console.log('\n=== SIMPLE CONTENT PAGING ===')
    console.log(`Simple content generated ${simplePages.length} pages`)
    simplePages.forEach((page, index) => {
      console.log(`Page ${index + 1}: ${page.totalCharacters} chars (normal capacity)`)
    })

    // 基本的な動作確認
    expect(complexPages.length).toBeGreaterThan(0)
    expect(simplePages.length).toBeGreaterThan(0)

    // コンテンツの複雑度に応じてページング結果が異なることを示す
    const complexTotalText = complexNodes.map(n => n.type === 'text' ? n.content : n.type === 'ruby' ? n.base : n.type === 'emphasis_dots' ? n.text : '').join('')
    const simpleTotalText = simpleNodes.map(n => 'content' in n ? n.content : '').join('')

    console.log(`Complex text length: ${complexTotalText.length}`)
    console.log(`Simple text length: ${simpleTotalText.length}`)
  })
})