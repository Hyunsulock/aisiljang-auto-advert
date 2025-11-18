import {initApp} from '@app/main';
import {fileURLToPath} from 'node:url';

if (process.env.NODE_ENV === 'development' || process.env.PLAYWRIGHT_TEST === 'true' || !!process.env.CI) {
  function showAndExit(...args) {
    console.error(...args);
    process.exit(1);
  }

  process.on('uncaughtException', showAndExit);
  process.on('unhandledRejection', showAndExit);
}

// noinspection JSIgnoredPromiseFromCall
/**
 * We resolve '@app/renderer' and '@app/preload'
 * here and not in '@app/main'
 * to observe good practices of modular design.
 * This allows fewer dependencies and better separation of concerns in '@app/main'.
 * Thus,
 * the main module remains simplistic and efficient
 * as it receives initialization instructions rather than direct module imports.
 */

// Preload 경로 결정 - 항상 import.meta.resolve 사용 (estate-advert 방식)
const getPreloadPath = () => {
  return fileURLToPath(import.meta.resolve('@app/preload/exposed.mjs'));
};

const getRendererPath = () => {
  if (process.env.MODE === 'development' && !!process.env.VITE_DEV_SERVER_URL) {
    return new URL(process.env.VITE_DEV_SERVER_URL);
  } else {
    return {
      path: fileURLToPath(import.meta.resolve('@app/renderer')),
    };
  }
};

const preloadPath = getPreloadPath();
const rendererPath = getRendererPath();

console.log('📍 Preload path:', preloadPath);
console.log('📍 Renderer path:', rendererPath);

// 파일 존재 여부 확인
import { existsSync } from 'node:fs';
if (existsSync(preloadPath)) {
  console.log('✅ Preload file exists');
} else {
  console.error('❌ Preload file NOT found at:', preloadPath);
}

initApp(
  {
    renderer: rendererPath,
    preload: {
      path: preloadPath,
    },
  },
);
