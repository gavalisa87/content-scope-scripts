import { join, relative } from 'node:path'
import { statSync } from 'node:fs'

// path helpers
const ROOT = new URL('..', import.meta.url).pathname
const BUILD = join(ROOT, 'build')
const APPLE_BUILD = join(ROOT, 'Sources/ContentScopeScripts/dist')
const CSS_OUTPUT_SIZE = 512000
const CSS_OUTPUT_SIZE_CHROME = CSS_OUTPUT_SIZE * 1.4 // 40% larger for Chrome MV2 due to base64 encoding

const checks = {
    android: [
        { kind: 'maxFileSize', value: CSS_OUTPUT_SIZE, path: join(BUILD, 'android/contentScope.js') }
    ],
    chrome: [
        { kind: 'maxFileSize', value: CSS_OUTPUT_SIZE_CHROME, path: join(BUILD, 'chrome/inject.js') }
    ],
    'chrome-mv3': [
        { kind: 'maxFileSize', value: CSS_OUTPUT_SIZE, path: join(BUILD, 'chrome-mv3/inject.js') }
    ],
    firefox: [
        { kind: 'maxFileSize', value: CSS_OUTPUT_SIZE, path: join(BUILD, 'firefox/inject.js') }
    ],
    integration: [
        { kind: 'maxFileSize', value: CSS_OUTPUT_SIZE, path: join(BUILD, 'integration/contentScope.js') }
    ],
    windows: [
        { kind: 'maxFileSize', value: CSS_OUTPUT_SIZE, path: join(BUILD, 'windows/contentScope.js') }
    ],
    apple: [
        { kind: 'maxFileSize', value: CSS_OUTPUT_SIZE, path: join(APPLE_BUILD, 'contentScope.js') }
    ]
}

describe('checks', () => {
    for (const [platformName, platformChecks] of Object.entries(checks)) {
        for (const check of platformChecks) {
            if (check.kind === 'maxFileSize') {
                const localPath = relative(ROOT, check.path)
                it(`${platformName}: '${localPath}' is smaller than ${check.value}`, () => {
                    const stats = statSync(check.path)
                    expect(stats.size).toBeLessThan(check.value)
                })
            }
        }
    }
})