import type { BrowserWindowConstructorOptions } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const MAIN_WINDOW_DEFAULT_WIDTH = 1080
export const MAIN_WINDOW_DEFAULT_HEIGHT = 720
export const MAIN_WINDOW_MIN_WIDTH = 800
export const MAIN_WINDOW_MIN_HEIGHT = 600

export function createMainWindowOptions(
  preloadPath: string,
  platformName = process.platform,
): BrowserWindowConstructorOptions {
  let iconPath = path.join(__dirname, '../renderer/romantsy.png')
  if (!fs.existsSync(iconPath)) {
    iconPath = path.join(__dirname, '../../public/romantsy.png')
  }

  return {
    width: MAIN_WINDOW_DEFAULT_WIDTH,
    height: MAIN_WINDOW_DEFAULT_HEIGHT,
    minWidth: MAIN_WINDOW_MIN_WIDTH,
    minHeight: MAIN_WINDOW_MIN_HEIGHT,
    title: 'Romantsy-Note',
    titleBarStyle: platformName === 'darwin' ? 'hidden' : 'default',
    backgroundColor: '#1a1a2e',
    icon: iconPath,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  }
}
