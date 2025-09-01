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
        paddingVertical: 2,
        paddingHorizontal: 2,
        rubySize: 'normal',
        smoothScroll: true
      })
    })

    it('保存された設定を読み込む', () => {
      const savedSettings: ReaderSettings = {
        verticalMode: false,
        fontSize: 20,
        lineHeight: 2.0,
        theme: 'dark',
        paddingVertical: 3,
        paddingHorizontal: 3,
        rubySize: 'large',
        smoothScroll: false
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
        paddingVertical: 2,
        paddingHorizontal: 2,
        rubySize: 'normal',
        smoothScroll: true
      })
    })

    it('旧形式のpadding設定を移行する', () => {
      const oldSettings = {
        verticalMode: false,
        fontSize: 20,
        lineHeight: 2.0,
        theme: 'dark',
        padding: 3,
        rubySize: 'large'
      }
      
      localStorage.setItem('readerSettings', JSON.stringify(oldSettings))
      
      const settings = settingsStorage.loadSettings()
      
      expect(settings).toEqual({
        verticalMode: false,
        fontSize: 20,
        lineHeight: 2.0,
        theme: 'dark',
        paddingVertical: 3,
        paddingHorizontal: 3,
        rubySize: 'large',
        smoothScroll: true
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
        paddingVertical: 2,
        paddingHorizontal: 2,
        rubySize: 'normal',
        smoothScroll: true
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
        paddingVertical: 1.5,
        paddingHorizontal: 1.5,
        rubySize: 'small',
        smoothScroll: true
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
        paddingVertical: 2,
        paddingHorizontal: 2,
        rubySize: 'normal',
        smoothScroll: true
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