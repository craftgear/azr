import { describe, it, expect } from 'vitest'
import type { ParsedAozoraDocument } from '../types/aozora'

// タイトル抽出ロジックをテスト用に再現
const extractTitle = (document: ParsedAozoraDocument): string | undefined => {
  // 底本情報からタイトルを抽出（これが最優先）
  const textNodes = document.nodes.filter(node => node.type === 'text' && 'content' in node)
  for (let i = textNodes.length - 1; i >= 0; i--) {
    const content = textNodes[i].content as string
    const match = content.match(/底本：「(.+?)」/)
    if (match && match[1]) {
      // 副題などを除去（括弧内のテキストを削除）
      const title = match[1].replace(/[\(（].+?[\)）]/g, '').trim()
      if (title) return title
    }
  }
  
  // 底本が見つからない場合はメタデータを使用
  return document.metadata?.title
}

describe('タイトル抽出', () => {
  it('見出しがあっても底本がなければundefinedを返す', () => {
    const doc: ParsedAozoraDocument = {
      nodes: [
        { type: 'heading', content: '吾輩は猫である', level: 'large' },
        { type: 'text', content: '夏目漱石' }
      ],
      metadata: {}
    }
    
    expect(extractTitle(doc)).toBeUndefined()
  })

  it('底本情報からタイトルを抽出する', () => {
    const doc: ParsedAozoraDocument = {
      nodes: [
        { type: 'text', content: '本文がここにある' },
        { type: 'text', content: '底本：「吾輩は猫である」新潮文庫、新潮社' }
      ],
      metadata: {}
    }
    
    expect(extractTitle(doc)).toBe('吾輩は猫である')
  })

  it('底本情報から副題を除去してタイトルを抽出する', () => {
    const doc: ParsedAozoraDocument = {
      nodes: [
        { type: 'text', content: '本文' },
        { type: 'text', content: '底本：「もみの木は残った（上）」新潮文庫' }
      ],
      metadata: {}
    }
    
    expect(extractTitle(doc)).toBe('もみの木は残った')
  })

  it('全角括弧の副題も除去する', () => {
    const doc: ParsedAozoraDocument = {
      nodes: [
        { type: 'text', content: '本文' },
        { type: 'text', content: '底本：「作品集（完全版）」出版社' }
      ],
      metadata: {}
    }
    
    expect(extractTitle(doc)).toBe('作品集')
  })

  it('底本を優先する（見出しがあっても）', () => {
    const doc: ParsedAozoraDocument = {
      nodes: [
        { type: 'heading', content: '見出しタイトル', level: 'large' },
        { type: 'text', content: '底本：「正しいタイトル」出版社' }
      ],
      metadata: {}
    }
    
    expect(extractTitle(doc)).toBe('正しいタイトル')
  })

  it('メタデータのタイトルをフォールバックとして使用する', () => {
    const doc: ParsedAozoraDocument = {
      nodes: [
        { type: 'text', content: '本文のみ' }
      ],
      metadata: {
        title: 'メタデータタイトル'
      }
    }
    
    expect(extractTitle(doc)).toBe('メタデータタイトル')
  })

  it('複数の底本情報がある場合は最後のものを使用する', () => {
    const doc: ParsedAozoraDocument = {
      nodes: [
        { type: 'text', content: '底本：「間違ったタイトル」' },
        { type: 'text', content: '本文' },
        { type: 'text', content: '底本：「正しいタイトル」出版社' }
      ],
      metadata: {}
    }
    
    expect(extractTitle(doc)).toBe('正しいタイトル')
  })

  it('底本情報が不完全な場合は無視する', () => {
    const doc: ParsedAozoraDocument = {
      nodes: [
        { type: 'text', content: '底本：不完全な情報' },
        { type: 'text', content: '底本「括弧なし」' }
      ],
      metadata: {
        title: 'フォールバック'
      }
    }
    
    expect(extractTitle(doc)).toBe('フォールバック')
  })

  it('タイトルが見つからない場合はundefinedを返す', () => {
    const doc: ParsedAozoraDocument = {
      nodes: [
        { type: 'text', content: '本文のみ' }
      ],
      metadata: {}
    }
    
    expect(extractTitle(doc)).toBeUndefined()
  })

  it('実際の青空文庫フォーマットからタイトルを抽出する', () => {
    const doc: ParsedAozoraDocument = {
      nodes: [
        { type: 'text', content: '本文...' },
        { type: 'text', content: `底本：「こころ」新潮文庫、新潮社
　　　1969（昭和44）年4月15日発行
　　　1989（平成元）年6月5日85刷改版` }
      ],
      metadata: {}
    }
    
    expect(extractTitle(doc)).toBe('こころ')
  })
})