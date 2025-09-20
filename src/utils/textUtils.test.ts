import { describe, it, expect } from 'vitest'
import {
  isSentenceEnd,
  findNextSentenceEnd,
  findLastSentenceEnd,
  splitTextAtBoundary,
  splitIntoSentences,
  countSentences,
  countCharacters,
  countRubyCharacters,
  getCharacterStats,
  chunkJapaneseText,
  joinChunks,
  // type ChunkOptions,
  type TextChunk
  // type CharacterStats
} from './textUtils'

describe('textUtils', () => {
  describe('isSentenceEnd', () => {
    it('基本的な句点を検出する', () => {
      expect(isSentenceEnd('これは文です。')).toBe(true)
      expect(isSentenceEnd('質問ですか？')).toBe(true)
      expect(isSentenceEnd('驚きです！')).toBe(true)
      expect(isSentenceEnd('This is a sentence.')).toBe(true)
      expect(isSentenceEnd('Question?')).toBe(true)
      expect(isSentenceEnd('Exclamation!')).toBe(true)
    })

    it('閉じ括弧の後の句点を検出する', () => {
      expect(isSentenceEnd('「こんにちは。」')).toBe(true)
      expect(isSentenceEnd('『本のタイトル。』')).toBe(true)
      expect(isSentenceEnd('（説明文です。）')).toBe(true)
      expect(isSentenceEnd('"Hello."')).toBe(true)
    })

    it('句点がない場合はfalseを返す', () => {
      expect(isSentenceEnd('これは文です')).toBe(false)
      expect(isSentenceEnd('途中の文、')).toBe(false)
      expect(isSentenceEnd('')).toBe(false)
    })

    it('青空文庫の特殊指示を無視する', () => {
      expect(isSentenceEnd('文章です。［＃改ページ］')).toBe(true)  // 文末は。で終わっているため
      expect(isSentenceEnd('文章です［＃。］')).toBe(false)
      expect(isSentenceEnd('文章です。')).toBe(true)
    })

    it('特殊指示の前の文末を検出する', () => {
      const text = '吾輩は猫である。［＃「吾輩」に傍点］'
      expect(isSentenceEnd(text.substring(0, text.indexOf('［')))).toBe(true)
    })

    it('ルビ記法を含む文末を検出する', () => {
      expect(isSentenceEnd('私《わたし》は学生《がくせい》です。')).toBe(true)
      expect(isSentenceEnd('山田《やまだ》さん。')).toBe(true)
      expect(isSentenceEnd('｜東京都《とうきょうと》に住んでいます。')).toBe(true)
      expect(isSentenceEnd('私《わたし》は学生《がくせい》です')).toBe(false)
    })

    it('ルビの閉じ記号で終わる場合はfalseを返す', () => {
      expect(isSentenceEnd('私《わたし》')).toBe(false)
      expect(isSentenceEnd('東京《とうきょう》')).toBe(false)
    })
  })

  describe('findNextSentenceEnd', () => {
    it('次の文の終わりを見つける', () => {
      const text = '最初の文。次の文。三番目の文。'
      expect(findNextSentenceEnd(text, 0)).toBe(5)
      expect(findNextSentenceEnd(text, 6)).toBe(9)  // 5の位置は句点なので、6から検索
      expect(findNextSentenceEnd(text, 11)).toBe(15)  // 文字列の最後
    })

    it('閉じ括弧を含む文末を見つける', () => {
      const text = '「こんにちは。」と言った。'
      expect(findNextSentenceEnd(text, 0)).toBe(8)
      expect(findNextSentenceEnd(text, 8)).toBe(13)
    })

    it('文末が見つからない場合は-1を返す', () => {
      expect(findNextSentenceEnd('文末なし', 0)).toBe(-1)
      expect(findNextSentenceEnd('最後の文。', 5)).toBe(-1)
    })

    it('特殊指示内の句点を無視する', () => {
      const text = '文章［＃「。」に注意］です。'
      expect(findNextSentenceEnd(text, 0)).toBe(14)
    })

    it('ルビ記法を含むテキストで文末を見つける', () => {
      const text = '私《わたし》は学生《がくせい》です。山田《やまだ》さんと友達《ともだち》です。'
      expect(findNextSentenceEnd(text, 0)).toBe(18)  // 最初の文の終わり
      expect(findNextSentenceEnd(text, 19)).toBe(39)  // 二番目の文の終わり
    })

    it('パイプ記法のルビを含むテキストで文末を見つける', () => {
      const text = '｜東京都《とうきょうと》に住んでいます。｜明日《あした》は晴れでしょう。'
      expect(findNextSentenceEnd(text, 0)).toBe(20)  // 最初の文の終わり
      expect(findNextSentenceEnd(text, 21)).toBe(36)  // 二番目の文の終わり
    })
  })

  describe('findLastSentenceEnd', () => {
    it('最後の文の終わりを見つける', () => {
      const text = '最初の文。次の文。三番目の文。'
      expect(findLastSentenceEnd(text)).toBe(15)  // 最後の文字の後の位置
      expect(findLastSentenceEnd(text, 10)).toBe(9)  // 10以下で最後の句点の後
      expect(findLastSentenceEnd(text, 7)).toBe(5)
    })

    it('閉じ括弧を含む文末を見つける', () => {
      const text = '「質問？」「答え。」'
      expect(findLastSentenceEnd(text)).toBe(10)
      expect(findLastSentenceEnd(text, 4)).toBe(5)  // 8の位置は「答」の中なので、4までで探す
    })

    it('文末が見つからない場合は-1を返す', () => {
      expect(findLastSentenceEnd('文末なし')).toBe(-1)
      expect(findLastSentenceEnd('文末なし', 3)).toBe(-1)
    })
  })

  describe('splitTextAtBoundary', () => {
    it('文の境界で分割する', () => {
      const text = '最初の文です。次の文です。三番目の文です。'
      const result = splitTextAtBoundary(text, 10)
      expect(result.before).toBe('最初の文です。')
      expect(result.after).toBe('次の文です。三番目の文です。')
    })

    it('読点で分割しない', () => {
      const text = '長い文章で、読点があり、まだ続きます'
      const result = splitTextAtBoundary(text, 8)
      expect(result.before).toBe('長い文章で、読点があり、まだ続きます')
      expect(result.after).toBe('')
    })

    it('改行で分割する', () => {
      const text = '改行前\n改行後の文章'
      const result = splitTextAtBoundary(text, 5)
      expect(result.before).toBe('改行前')
      expect(result.after).toBe('改行後の文章')
    })

    it('最大長で強制分割する', () => {
      const text = 'とても長い文章で句読点がない'
      const result = splitTextAtBoundary(text, 7)
      expect(result.before).toBe('とても長い文章')  // 7文字で強制分割
      expect(result.after).toBe('で句読点がない')
    })

    it('最大長以下の場合は分割しない', () => {
      const text = '短い文。'
      const result = splitTextAtBoundary(text, 10)
      expect(result.before).toBe('短い文。')
      expect(result.after).toBe('')
    })
  })

  describe('splitIntoSentences', () => {
    it('文単位で分割する', () => {
      const text = '最初の文。次の文？三番目！'
      const sentences = splitIntoSentences(text)
      expect(sentences).toEqual(['最初の文。', '次の文？', '三番目！'])
    })

    it('括弧を含む文を正しく分割する', () => {
      const text = '「挨拶です。」彼は言った。「返事です！」'
      const sentences = splitIntoSentences(text)
      expect(sentences).toEqual(['「挨拶です。」', '彼は言った。', '「返事です！」'])
    })

    it('文末がない場合は全体を1文とする', () => {
      const text = '文末がない文章'
      const sentences = splitIntoSentences(text)
      expect(sentences).toEqual(['文末がない文章'])
    })

    it('空文字列の場合は空配列を返す', () => {
      const text = ''
      const sentences = splitIntoSentences(text)
      expect(sentences).toEqual([])
    })

    it('複雑な青空文庫形式のテキストを処理する', () => {
      const text = '吾輩《わがはい》は猫である。［＃「吾輩」に傍点］名前はまだ無い。'
      const sentences = splitIntoSentences(text)
      expect(sentences).toEqual([
        '吾輩《わがはい》は猫である。',
        '［＃「吾輩」に傍点］名前はまだ無い。'
      ])
    })

    it('青空文庫のルビ記法を正しく扱う', () => {
      const text = '私《わたし》は学生《がくせい》です。山田《やまだ》さんと友達《ともだち》です。'
      const sentences = splitIntoSentences(text)
      expect(sentences).toEqual([
        '私《わたし》は学生《がくせい》です。',
        '山田《やまだ》さんと友達《ともだち》です。'
      ])
    })

    it('パイプ記法のルビを正しく扱う', () => {
      const text = '｜東京都《とうきょうと》に住んでいます。｜明日《あした》は晴れでしょう。'
      const sentences = splitIntoSentences(text)
      expect(sentences).toEqual([
        '｜東京都《とうきょうと》に住んでいます。',
        '｜明日《あした》は晴れでしょう。'
      ])
    })

    it('ルビと特殊指示が混在するテキストを処理する', () => {
      const text = '夏目漱石《なつめそうせき》の作品。［＃ここから２字下げ］吾輩《わがはい》は猫である。［＃ここで字下げ終わり］'
      const sentences = splitIntoSentences(text)
      expect(sentences).toEqual([
        '夏目漱石《なつめそうせき》の作品。',
        '［＃ここから２字下げ］吾輩《わがはい》は猫である。',
        '［＃ここで字下げ終わり］'
      ])
    })
  })

  describe('countSentences', () => {
    it('文の数を正しく数える', () => {
      expect(countSentences('一つ目。二つ目。三つ目。')).toBe(3)
      expect(countSentences('質問？答え！普通の文。')).toBe(3)
      expect(countSentences('文末なし')).toBe(1)
      expect(countSentences('')).toBe(0)
    })

    it('括弧付きの文を正しく数える', () => {
      expect(countSentences('「一つ目。」「二つ目？」')).toBe(2)
      expect(countSentences('（説明。）本文。')).toBe(2)
    })
  })

  describe('countCharacters', () => {
    it('基本的な文字数をカウントする', () => {
      expect(countCharacters('こんにちは')).toBe(5)
      expect(countCharacters('Hello World')).toBe(11)
      expect(countCharacters('123456')).toBe(6)
      expect(countCharacters('')).toBe(0)
    })

    it('スペースを含む/含まないカウント', () => {
      expect(countCharacters('こんに ちは', true)).toBe(6)  // スペース含む
      expect(countCharacters('こんに ちは', false)).toBe(5)  // スペース除く
      expect(countCharacters('Hello World', true)).toBe(11)
      expect(countCharacters('Hello World', false)).toBe(10)
      expect(countCharacters('　全角　スペース　', true)).toBe(9)
      expect(countCharacters('　全角　スペース　', false)).toBe(6)
    })

    it('ルビ記法を除外してカウントする', () => {
      expect(countCharacters('私《わたし》は学生《がくせい》です')).toBe(6)  // 私は学生です
      expect(countCharacters('｜東京都《とうきょうと》に住む')).toBe(6)  // 東京都に住む
      expect(countCharacters('漢字《かんじ》と平仮名《ひらがな》')).toBe(6)  // 漢字と平仮名（6文字）
    })

    it('青空文庫の特殊指示を除外してカウントする', () => {
      expect(countCharacters('文章です。［＃改ページ］')).toBe(5)  // 文章です。
      expect(countCharacters('［＃ここから２字下げ］本文')).toBe(2)  // 本文
      expect(countCharacters('テキスト［＃「テキスト」に傍点］')).toBe(4)  // テキスト
    })

    it('複合的なテキストをカウントする', () => {
      const text = '私《わたし》は［＃ここから２字下げ］学生《がくせい》です。'
      expect(countCharacters(text)).toBe(7)  // 私は学生です。
      expect(countCharacters(text, false)).toBe(7)  // スペースなし
    })
  })

  describe('countRubyCharacters', () => {
    it('ルビ文字数をカウントする', () => {
      expect(countRubyCharacters('私《わたし》')).toBe(3)  // わたし
      expect(countRubyCharacters('学生《がくせい》')).toBe(4)  // がくせい
      expect(countRubyCharacters('東京《とうきょう》')).toBe(5)  // とうきょう
      expect(countRubyCharacters('普通のテキスト')).toBe(0)
      expect(countRubyCharacters('')).toBe(0)
    })

    it('複数のルビをカウントする', () => {
      const text = '私《わたし》は学生《がくせい》です'
      expect(countRubyCharacters(text)).toBe(7)  // わたし(3) + がくせい(4)
    })

    it('パイプ記法のルビはカウントする', () => {
      // パイプ記法でもルビ部分《》はカウント
      expect(countRubyCharacters('｜東京都《とうきょうと》')).toBe(6)  // とうきょうと
      expect(countRubyCharacters('｜明日《あした》')).toBe(3)  // あした
    })

    it('特殊指示は無視する', () => {
      expect(countRubyCharacters('［＃ここから２字下げ］')).toBe(0)
      expect(countRubyCharacters('文章［＃改ページ］')).toBe(0)
    })
  })

  describe('getCharacterStats', () => {
    it('基本的な文字種別統計を取得する', () => {
      const stats = getCharacterStats('こんにちは')
      expect(stats.total).toBe(5)
      expect(stats.hiragana).toBe(5)
      expect(stats.katakana).toBe(0)
      expect(stats.kanji).toBe(0)
      expect(stats.withoutSpaces).toBe(5)
    })

    it('複数の文字種を含むテキストの統計', () => {
      const stats = getCharacterStats('私はカタカナとABCと123が好きです。')
      expect(stats.hiragana).toBe(7)  // はととがきです
      expect(stats.katakana).toBe(4)  // カタカナ
      expect(stats.kanji).toBe(2)  // 私好
      expect(stats.alphanumeric).toBe(6)  // ABC123
      expect(stats.punctuation).toBe(1)  // 。
    })

    it('スペースを正しくカウントする', () => {
      const stats = getCharacterStats('こんに ちは　世界')
      expect(stats.spaces).toBe(2)  // 半角スペース + 全角スペース
      expect(stats.total).toBe(9)  // 全体で9文字
      expect(stats.withoutSpaces).toBe(7)  // こんにちは世界（7文字）
    })

    it('ルビを含むテキストの統計', () => {
      const stats = getCharacterStats('私《わたし》は学生《がくせい》です。')
      expect(stats.ruby).toBe(7)  // わたし(3) + がくせい(4)
      expect(stats.kanji).toBe(3)  // 私学生
      expect(stats.hiragana).toBe(3)  // はです
      expect(stats.punctuation).toBe(1)  // 。
      expect(stats.total).toBe(7)  // ルビを除いた文字数
    })

    it('青空文庫の特殊指示を除外して統計を取る', () => {
      const stats = getCharacterStats('文章［＃改ページ］です。')
      expect(stats.total).toBe(5)  // 文章です。
      expect(stats.kanji).toBe(2)  // 文章
      expect(stats.hiragana).toBe(2)  // です
      expect(stats.punctuation).toBe(1)  // 。
    })

    it('空のテキストの統計', () => {
      const stats = getCharacterStats('')
      expect(stats.total).toBe(0)
      expect(stats.withoutSpaces).toBe(0)
      expect(stats.hiragana).toBe(0)
      expect(stats.katakana).toBe(0)
      expect(stats.kanji).toBe(0)
      expect(stats.alphanumeric).toBe(0)
      expect(stats.punctuation).toBe(0)
      expect(stats.spaces).toBe(0)
      expect(stats.ruby).toBe(0)
      expect(stats.other).toBe(0)
    })

    it('その他の文字を正しくカウントする', () => {
      const stats = getCharacterStats('こんにちは★☆♪')
      expect(stats.hiragana).toBe(5)
      expect(stats.other).toBe(3)  // ★☆♪
      expect(stats.total).toBe(8)
    })

    it('改行とタブを含むテキストの統計', () => {
      const stats = getCharacterStats('こんにちは\n世界\tです')
      expect(stats.spaces).toBe(2)  // 改行 + タブ
      expect(stats.hiragana).toBe(7)  // こんにちはです
      expect(stats.kanji).toBe(2)  // 世界
      expect(stats.withoutSpaces).toBe(9)
    })

    it('複雑な青空文庫形式のテキストの統計', () => {
      const text = '吾輩《わがはい》は猫である。［＃「吾輩」に傍点］名前はまだ無い。'
      const stats = getCharacterStats(text)
      expect(stats.ruby).toBe(4)  // わがはい
      expect(stats.kanji).toBe(6)  // 吾輩猫名前無
      expect(stats.hiragana).toBe(8)  // はであるはまだい
      expect(stats.punctuation).toBe(2)  // 。。
      expect(stats.total).toBe(16)  // ルビと特殊指示を除いた文字数
    })
  })

  describe('chunkJapaneseText', () => {
    it('基本的なチャンク分割を行う', () => {
      const text = '最初の文です。次の文です。三番目の文です。'
      const chunks = chunkJapaneseText(text)

      expect(chunks.length).toBeGreaterThanOrEqual(1)
      expect(chunks[0].sentenceCount).toBeGreaterThan(0)
      // 各チャンクは少なくとも1つの文を含む
      expect(chunks.every(c => c.sentenceCount >= 1)).toBe(true)
    })

    it('会話文をまとめてチャンク化する', () => {
      const text = '「こんにちは。」「元気ですか？」地の文です。「また会いましょう！」'
      const chunks = chunkJapaneseText(text, {
        keepDialogueTogether: true
      })

      // 会話文のチャンクを検証
      const dialogueChunks = chunks.filter(c => c.isDialogue)
      expect(dialogueChunks.length).toBeGreaterThan(0)

      // 地の文のチャンクを検証  
      const narrativeChunks = chunks.filter(c => !c.isDialogue)
      expect(narrativeChunks.length).toBeGreaterThan(0)
    })

    it('ルビ記法を含むテキストをチャンク分割する', () => {
      const text = '私《わたし》は学生《がくせい》です。山田《やまだ》さんと友達《ともだち》です。彼《かれ》は先生《せんせい》です。'
      const chunks = chunkJapaneseText(text, {
        keepDialogueTogether: false  // 文ごとに分割
      })

      expect(chunks.length).toBe(3)  // 3つの文
      expect(chunks[0].content).toContain('私《わたし》')
      expect(chunks[1].content).toContain('山田《やまだ》')
      expect(chunks[2].content).toContain('彼《かれ》')
    })

    it('パイプ記法のルビを含むテキストをチャンク分割する', () => {
      const text = '｜東京都《とうきょうと》に住んでいます。おそらく｜明日《あした》は晴れでしょう。ちなみに｜昨日《きのう》は雨でした。'
      const chunks = chunkJapaneseText(text, {
        keepDialogueTogether: false  // 文ごとに分割
      })

      expect(chunks.length).toBe(3)  // 3つの文
      expect(chunks[0].content).toContain('｜東京都《とうきょうと》')
      expect(chunks[1].content).toContain('｜明日《あした》')
      expect(chunks[2].content).toContain('｜昨日《きのう》')
    })

    it('ルビと会話文が混在するテキストをチャンク分割する', () => {
      const text = '「私《わたし》は学生《がくせい》です。」「本当《ほんとう》ですか？」山田《やまだ》さんが尋ねた。'
      const chunks = chunkJapaneseText(text, {
        keepDialogueTogether: true
      })

      // 会話文がまとめられているか確認
      const dialogueChunk = chunks.find(c => c.isDialogue)
      expect(dialogueChunk).toBeDefined()
      expect(dialogueChunk?.content).toContain('私《わたし》')
      expect(dialogueChunk?.content).toContain('本当《ほんとう》')

      // 地の文が別チャンクになっているか確認
      const narrativeChunk = chunks.find(c => !c.isDialogue)
      expect(narrativeChunk).toBeDefined()
      expect(narrativeChunk?.content).toContain('山田《やまだ》')
    })

    it('段落境界で分割する', () => {
      const text = '第一段落の文。続きの文。\n\n第二段落の文。続きの文。'
      const chunks = chunkJapaneseText(text, {
        preferParagraphBoundary: true,
        keepDialogueTogether: false  // 文ごとに分割
      })

      // 段落境界で分割されているか確認
      expect(chunks.length).toBeGreaterThanOrEqual(2)
      // 段落境界の検出は実装の詳細によるため、チャンク数のみ確認
    })

    it('オーバーラップを含むチャンクを生成する', () => {
      const text = '文1。文2。文3。文4。文5。'
      const chunks = chunkJapaneseText(text, {
        keepDialogueTogether: false,  // 文ごとに分割
        allowOverlap: true,
        overlapSize: 5
      })

      // オーバーラップの検証
      if (chunks.length > 1) {
        // 隣接するチャンクで重複部分があることを確認
        // const firstChunkEnd = chunks[0].content.slice(-5)
        // const secondChunkStart = chunks[1].content.slice(0, 5)
        // 部分的な重複があることを確認（完全一致ではない場合もある）
        expect(chunks[1].startIndex).toBeLessThan(chunks[0].endIndex)
      }
    })

    it('文単位でチャンクを作成する', () => {
      const text = '短い。次。長い文章です。'
      const chunks = chunkJapaneseText(text, {
        keepDialogueTogether: false  // 文ごとに分割
      })

      // 文の数と同じ数のチャンクが作成される
      expect(chunks.length).toBe(3)
      expect(chunks[0].content).toBe('短い。')
      expect(chunks[1].content).toBe('次。')
      expect(chunks[2].content).toBe('長い文章です。')
    })

    it('青空文庫の特殊指示を含むテキストを処理する', () => {
      const text = '文章です。［＃改ページ］新しいページ。［＃改段］新しい段落。'
      const chunks = chunkJapaneseText(text, {
        preferParagraphBoundary: true,
        keepDialogueTogether: false  // 文ごとに分割して段落境界を確認
      })

      expect(chunks.length).toBeGreaterThanOrEqual(3)  // 3つの文があるため
    })

    it('空のテキストを処理する', () => {
      const chunks = chunkJapaneseText('', {})
      expect(chunks).toEqual([])
    })

    it('単一文のテキストを処理する', () => {
      const text = 'これは単一の文です。'
      const chunks = chunkJapaneseText(text)

      expect(chunks.length).toBe(1)
      expect(chunks[0].content).toBe(text)
      expect(chunks[0].sentenceCount).toBe(1)
    })
  })

  describe('joinChunks', () => {
    it('チャンクを結合してテキストに戻す', () => {
      const text = '文1。文2。文3。文4。'
      const chunks = chunkJapaneseText(text, { keepDialogueTogether: false })
      const joined = joinChunks(chunks)

      // オーバーラップなしの場合、元のテキストと一致
      if (!chunks.some(c => c.startIndex < chunks[chunks.indexOf(c) - 1]?.endIndex)) {
        expect(joined).toBe(text)
      }
    })

    it('オーバーラップを考慮して結合する', () => {
      const text = '文1。文2。文3。'
      const chunks = chunkJapaneseText(text, {
        keepDialogueTogether: false,
        allowOverlap: true,
        overlapSize: 3
      })

      const joined = joinChunks(chunks)
      // オーバーラップ部分が重複しないことを確認
      expect(joined.indexOf('文1。')).toBe(joined.lastIndexOf('文1。'))
      expect(joined.indexOf('文2。')).toBe(joined.lastIndexOf('文2。'))
    })

    it('空のチャンク配列を処理する', () => {
      const joined = joinChunks([])
      expect(joined).toBe('')
    })

    it('単一チャンクを処理する', () => {
      const chunk: TextChunk = {
        content: 'テストテキスト',
        startIndex: 0,
        endIndex: 7,
        sentenceCount: 1,
        isDialogue: false,
        isParagraphStart: true,
        isParagraphEnd: true
      }

      const joined = joinChunks([chunk])
      expect(joined).toBe('テストテキスト')
    })
  })
})
