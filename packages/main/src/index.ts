import 'reflect-metadata';
import type {AppInitConfig} from './AppInitConfig.js';
import {createModuleRunner} from './ModuleRunner.js';
import {disallowMultipleAppInstance} from './modules/SingleInstanceApp.js';
import {createWindowManagerModule} from './modules/WindowManager.js';
import {terminateAppOnLastWindowClose} from './modules/ApplicationTerminatorOnLastWindowClose.js';
import {hardwareAccelerationMode} from './modules/HardwareAccelerationModule.js';
import {autoUpdater} from './modules/AutoUpdater.js';
import {allowInternalOrigins} from './modules/BlockNotAllowdOrigins.js';
import {allowExternalUrls} from './modules/ExternalUrls.js';
import {DbModule} from './modules/DbModule.js';
import {AuthModule} from './modules/AuthModule.js';
import {BatchModule} from './modules/BatchModule.js';
import {AdTestModule} from './modules/AdTestModule.js';
import {PropertyOwnerModule} from './modules/PropertyOwnerModule.js';
import {AgencyModule} from './modules/AgencyModule.js';
import {CrawlerModule} from './modules/CrawlerModule.js';


export async function initApp(initConfig: AppInitConfig) {
  const moduleRunner = createModuleRunner()
     // IPC 핸들러를 가장 먼저 등록
    .init(createWindowManagerModule({initConfig, openDevTools: true})) // DevTools 항상 열기 (디버깅용)
    .init(disallowMultipleAppInstance())
    .init(terminateAppOnLastWindowClose())
    .init(hardwareAccelerationMode({enable: false}))
    .init(autoUpdater())
    .init(new DbModule())
    .init(new AuthModule())
    .init(new BatchModule())
    .init(new AdTestModule())
    .init(new PropertyOwnerModule())
    .init(new AgencyModule())
    .init(new CrawlerModule())

    // Install DevTools extension if needed
    // .init(chromeDevToolsExtension({extension: 'VUEJS3_DEVTOOLS'}))

    // Security
    .init(allowInternalOrigins(
      new Set(initConfig.renderer instanceof URL ? [initConfig.renderer.origin] : []),
    ))
    .init(allowExternalUrls(
      new Set(
        initConfig.renderer instanceof URL
          ? [
            'https://vite.dev',
            'https://developer.mozilla.org',
            'https://solidjs.com',
            'https://qwik.dev',
            'https://lit.dev',
            'https://react.dev',
            'https://preactjs.com',
            'https://www.typescriptlang.org',
            'https://vuejs.org',
          ]
          : [],
      )),
    );

  await moduleRunner;
}
