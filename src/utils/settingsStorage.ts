import type { ReaderSettings } from '../components/Settings/Settings'

const SETTINGS_KEY = 'readerSettings'

const DEFAULT_SETTINGS: ReaderSettings = {
  verticalMode: true,
  fontSize: 16,
  lineHeight: 1.8,
  theme: 'light',
  paddingVertical: 2,
  paddingHorizontal: 2,
  rubySize: 'normal',
  smoothScroll: true
}

export const settingsStorage = {
  /**
   * 設定を読み込む
   */
  loadSettings(): ReaderSettings {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY)
      if (!saved) {
        return DEFAULT_SETTINGS
      }
      
      const parsed = JSON.parse(saved)
      
      // 旧形式からの移行処理
      if ('padding' in parsed && !('paddingVertical' in parsed)) {
        parsed.paddingVertical = parsed.padding
        parsed.paddingHorizontal = parsed.padding
        delete parsed.padding
      }
      
      // デフォルト値で補完
      return {
        ...DEFAULT_SETTINGS,
        ...parsed
      }
    } catch (error) {
      console.error('設定の読み込みエラー:', error)
      return DEFAULT_SETTINGS
    }
  },

  /**
   * 設定を保存する
   */
  saveSettings(settings: ReaderSettings): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch (error) {
      console.error('設定の保存エラー:', error)
    }
  }
}