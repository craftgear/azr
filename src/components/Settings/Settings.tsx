import React from 'react'
import './Settings.css'

export type ReaderSettings = {
  verticalMode: boolean
  fontSize: number
  lineHeight: number
  theme: 'light' | 'dark'
  paddingVertical: number
  paddingHorizontal: number
  rubySize: 'small' | 'normal' | 'large'
  smoothScroll: boolean
}

type SettingsProps = {
  settings: ReaderSettings
  onSettingsChange: (settings: ReaderSettings) => void
  isOpen: boolean
  onClose: () => void
}

export const Settings: React.FC<SettingsProps> = ({
  settings,
  onSettingsChange,
  isOpen,
  onClose
}) => {
  const handleChange = <K extends keyof ReaderSettings>(
    key: K,
    value: ReaderSettings[K]
  ) => {
    onSettingsChange({
      ...settings,
      [key]: value
    })
  }

  if (!isOpen) return null

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>表示設定</h2>
          <button
            className="settings-close"
            onClick={onClose}
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        <div className="settings-content">
          <div className="settings-group">
            <label className="settings-label">
              表示方向
            </label>
            <div className="settings-radio-group">
              <label className="settings-radio">
                <input
                  type="radio"
                  name="direction"
                  checked={!settings.verticalMode}
                  onChange={() => handleChange('verticalMode', false)}
                />
                <span>横書き</span>
              </label>
              <label className="settings-radio">
                <input
                  type="radio"
                  name="direction"
                  checked={settings.verticalMode}
                  onChange={() => handleChange('verticalMode', true)}
                />
                <span>縦書き</span>
              </label>
            </div>
          </div>

          <div className="settings-group">
            <label className="settings-label">
              テーマ
            </label>
            <div className="settings-radio-group">
              <label className="settings-radio">
                <input
                  type="radio"
                  name="theme"
                  checked={settings.theme === 'light'}
                  onChange={() => handleChange('theme', 'light')}
                />
                <span>ライト</span>
              </label>
              <label className="settings-radio">
                <input
                  type="radio"
                  name="theme"
                  checked={settings.theme === 'dark'}
                  onChange={() => handleChange('theme', 'dark')}
                />
                <span>ダーク</span>
              </label>
            </div>
          </div>

          <div className="settings-group">
            <label className="settings-label" htmlFor="fontSize">
              文字サイズ: {settings.fontSize}px
            </label>
            <input
              id="fontSize"
              type="range"
              min="12"
              max="32"
              value={settings.fontSize}
              onChange={(e) => handleChange('fontSize', Number(e.target.value))}
              className="settings-slider"
            />
          </div>

          <div className="settings-group">
            <label className="settings-label" htmlFor="lineHeight">
              行間: {settings.lineHeight}
            </label>
            <input
              id="lineHeight"
              type="range"
              min="1.2"
              max="2.4"
              step="0.1"
              value={settings.lineHeight}
              onChange={(e) => handleChange('lineHeight', Number(e.target.value))}
              className="settings-slider"
            />
          </div>

          <div className="settings-group">
            <label className="settings-label" htmlFor="paddingVertical">
              上下余白: {settings.paddingVertical}rem
            </label>
            <input
              id="paddingVertical"
              type="range"
              min="2"
              max="8"
              step="0.5"
              value={settings.paddingVertical}
              onChange={(e) => handleChange('paddingVertical', Number(e.target.value))}
              className="settings-slider"
            />
          </div>

          <div className="settings-group">
            <label className="settings-label" htmlFor="paddingHorizontal">
              左右余白: {settings.paddingHorizontal}rem
            </label>
            <input
              id="paddingHorizontal"
              type="range"
              min="2"
              max="8"
              step="0.5"
              value={settings.paddingHorizontal}
              onChange={(e) => handleChange('paddingHorizontal', Number(e.target.value))}
              className="settings-slider"
            />
          </div>

          <div className="settings-group">
            <label className="settings-label">
              ルビサイズ
            </label>
            <div className="settings-radio-group">
              <label className="settings-radio">
                <input
                  type="radio"
                  name="rubySize"
                  checked={settings.rubySize === 'small'}
                  onChange={() => handleChange('rubySize', 'small')}
                />
                <span>小</span>
              </label>
              <label className="settings-radio">
                <input
                  type="radio"
                  name="rubySize"
                  checked={settings.rubySize === 'normal'}
                  onChange={() => handleChange('rubySize', 'normal')}
                />
                <span>中</span>
              </label>
              <label className="settings-radio">
                <input
                  type="radio"
                  name="rubySize"
                  checked={settings.rubySize === 'large'}
                  onChange={() => handleChange('rubySize', 'large')}
                />
                <span>大</span>
              </label>
            </div>
          </div>

          <div className="settings-group">
            <label className="settings-label">
              スムーズスクロール
            </label>
            <div className="settings-radio-group">
              <label className="settings-radio">
                <input
                  type="radio"
                  name="smoothScroll"
                  checked={settings.smoothScroll}
                  onChange={() => handleChange('smoothScroll', true)}
                />
                <span>有効</span>
              </label>
              <label className="settings-radio">
                <input
                  type="radio"
                  name="smoothScroll"
                  checked={!settings.smoothScroll}
                  onChange={() => handleChange('smoothScroll', false)}
                />
                <span>無効</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}