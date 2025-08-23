import { describe, it, expect, beforeEach, vi } from 'vitest'
import { settingsStorage } from './settingsStorage'
import type { ReaderSettings } from '../components/Settings/Settings'

describe('settingsStorage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('loadSettings', () => {
    it('デフォルト設定を返す（localStorage が空の場合）', () => {
      const settings = settingsStorage.loadSettings()
      
      expect(settings).toEqual({
        verticalMode: true,
        fontSize: 16,
        lineHeight: 1.8,
        theme: 'light',
        padding: 2,
        rubySize: 'normal'
      })
    })

    it('保存された設定を読み込む', () => {
      const savedSettings: ReaderSettings = {
        verticalMode: false,
        fontSize: 20,
        lineHeight: 2.0,
        theme: 'dark',
        padding: 3,
        rubySize: 'large'
      }
      
      localStorage.setItem('readerSettings', JSON.stringify(savedSettings))
      
      const settings = settingsStorage.loadSettings()
      expect(settings).toEqual(savedSettings)
    })

    it('無効なJSON形式の場合はデフォルト設定を返す', () => {
      localStorage.setItem('readerSettings', 'invalid json')
      
      const settings = settingsStorage.loadSettings()
      
      expect(settings).toEqual({
        verticalMode: true,
        fontSize: 16,
        lineHeight: 1.8,
        theme: 'light',
        padding: 2,
        rubySize: 'normal'
      })
    })

    it('部分的な設定の場合はデフォルト値で補完する', () => {
      const partialSettings = {
        fontSize: 24,
        theme: 'dark'
      }
      
      localStorage.setItem('readerSettings', JSON.stringify(partialSettings))
      
      const settings = settingsStorage.loadSettings()
      
      expect(settings).toEqual({
        verticalMode: true,
        fontSize: 24,
        lineHeight: 1.8,
        theme: 'dark',
        padding: 2,
        rubySize: 'normal'
      })
    })
  })

  describe('saveSettings', () => {
    it('設定をlocalStorageに保存する', () => {
      const settings: ReaderSettings = {
        verticalMode: false,
        fontSize: 18,
        lineHeight: 2.2,
        theme: 'dark',
        padding: 1.5,
        rubySize: 'small'
      }
      
      settingsStorage.saveSettings(settings)
      
      const saved = localStorage.getItem('readerSettings')
      expect(saved).toBeTruthy()
      expect(JSON.parse(saved!)).toEqual(settings)
    })

    it('localStorageエラーをハンドリングする', () => {
      const settings: ReaderSettings = {
        verticalMode: true,
        fontSize: 16,
        lineHeight: 1.8,
        theme: 'light',
        padding: 2,
        rubySize: 'normal'
      }
      
      // localStorage.setItemをモック化してエラーを投げる
      const originalSetItem = localStorage.setItem
      localStorage.setItem = vi.fn(() => {
        throw new Error('QuotaExceededError')
      })
      
      // エラーがスローされないことを確認
      expect(() => settingsStorage.saveSettings(settings)).not.toThrow()
      
      // 元に戻す
      localStorage.setItem = originalSetItem
    })
  })
})