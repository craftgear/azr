// Tauri API型定義
declare global {
  interface Window {
    __TAURI__?: {
      fs: {
        readTextFile: (path: string) => Promise<string>
      }
      event: {
        listen: (event: string, handler: (event: any) => void) => Promise<() => void>
      }
    }
  }
}

export {}