#!/usr/bin/env node
/**
 * bootstrap-image-video-keys.mjs 的单测。
 *
 * 用 node:test 覆盖六种行为:
 *   1. SKIP_IMAGE_VIDEO_BOOTSTRAP=1 时整段跳过,文件不变
 *   2. apiKey 已填 → 跳过,文件不变
 *   3. apiKey 空 + ~/.dsh/.eee 有 THREEROUTER_MEDIA_API_KEY → 写入
 *   4. ~/.dsh/.env 优先于 ~/.dsh/.eee
 *   5. THREEROUTER_MEDIA_API_KEY 优先于 THREEROUTER_API_KEY
 *   6. ~/.dsh/.env 与 ~/.dsh/.eee 都没找到 → exit 0,文件不变
 *
 * 每个 case 用一个临时 home 目录临时 patch 文件跑完即清,不影响真实
 * ~/.dsh 或仓库 cordis.patch.yml。
 *
 * 用法:node --test scripts/bootstrap-image-video-keys.spec.mjs
 *
 * @module dsh-plugin-desktop/scripts/bootstrap-image-video-keys.spec
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const script = resolve(here, 'bootstrap-image-video-keys.mjs')

/** 临时目录 + 临时 patch 文件 + 临时 home 目录的封装,跑完自动 rm。 */
function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'bsivk-'))
  const home = resolve(root, 'home')
  const patch = resolve(root, 'cordis.patch.yml')
  mkdirSync(home, { recursive: true })
  mkdirSync(join(home, '.dsh'), { recursive: true })
  // 写入一个最小 cordis.patch.yml,块结构跟生产一致
  writeFileSync(patch, [
    '# header comment that must be preserved',
    '- id: image-video',
    '  config:',
    "    provider: threerouter",
    '    threerouter:',
    "      apiKey: ''",
    "      baseURL: ''",
    '    wanx:',
    "      apiKey: ''",
    "      baseURL: ''",
    '    seedance:',
    "      apiKey: ''",
    "      baseURL: ''",
    "    defaultImageModel: ''",
    "    outputsDir: './outputs'",
    '',
    '# tail comment',
    '- id: web-runtime',
    '  config:',
    '    openBrowser: false',
    '',
  ].join('\n'), 'utf8')
  return {
    root,
    home,
    patch,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  }
}

/**
 * 跑一次 bootstrap,返回 { exitCode, stdout, stderr, patchText }。
 * 通过 HOME 环境变量劫持用户的 ~/.dsh 路径(脚本里是 homedir())。
 */
function runBootstrap(env) {
  const r = spawnSync('node', [script], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
  })
  // 脚本固定读 pkgDir/cordis.patch.yml;withFixture 已把 fixture.patch
  // 复制到这个位置,跑完会还原。测试断言只看这个文件,不受 TEST_PATCH 影响。
  const realPatch = resolve(here, '..', 'cordis.patch.yml')
  return {
    exitCode: r.status,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
    patchText: existsSync(realPatch) ? readFileSync(realPatch, 'utf8') : '',
  }
}

/**
 * 生成 env 对象:把 HOME 指向 fixture.home,把 patchPath 通过 patch arg 传
 * 给脚本(脚本固定读 pkgDir/cordis.patch.yml,所以这里要把 fixture.patch
 * 复制成 pkgDir/cordis.patch.yml 跑,跑完恢复)。
 *
 * 但破坏性太强,改用更稳的办法:让脚本支持 PATCH_PATH 覆盖。
 *
 * 实际上脚本当前没支持 PATCH_PATH,所以测试通过 setFixture 复制 patch
 * 到 pkgDir/cordis.patch.yml、跑完恢复来实现。
 */
function withFixture(fn) {
  const fix = makeFixture()
  const realPatch = resolve(here, '..', 'cordis.patch.yml')
  const original = readFileSync(realPatch, 'utf8')
  writeFileSync(realPatch, readFileSync(fix.patch, 'utf8'))
  try {
    fn(fix)
  } finally {
    writeFileSync(realPatch, original, 'utf8')
    fix.cleanup()
  }
}

test('SKIP_IMAGE_VIDEO_BOOTSTRAP=1 时跳过', () => {
  withFixture((fix) => {
    writeFileSync(join(fix.home, '.dsh', '.env'), 'THREEROUTER_API_KEY=sk-should-not-be-used\n')
    const r = runBootstrap({
      HOME: fix.home,
      SKIP_IMAGE_VIDEO_BOOTSTRAP: '1',
    })
    assert.equal(r.exitCode, 0, `exit=${r.exitCode}`)
    assert.match(r.stdout, /SKIP_IMAGE_VIDEO_BOOTSTRAP=1/)
    // 文件没被改
    assert.match(r.patchText, /apiKey: ''/)
  })
})

test('apiKey 已填 → 跳过,不读 env', () => {
  withFixture((fix) => {
    writeFileSync(join(fix.home, '.dsh', '.env'), 'THREEROUTER_API_KEY=sk-should-not-be-used\n')
    // 预先填好
    let txt = readFileSync(fix.patch, 'utf8')
    txt = txt.replace("threerouter:\n      apiKey: ''", "threerouter:\n      apiKey: 'sk-existed'")
    writeFileSync(fix.patch, txt)
    // 同步覆盖 real patch
    const realPatch = resolve(here, '..', 'cordis.patch.yml')
    writeFileSync(realPatch, txt)
    try {
      const r = runBootstrap({ HOME: fix.home })
      assert.equal(r.exitCode, 0)
      assert.match(r.stdout, /已配置/)
      assert.match(r.patchText, /apiKey: 'sk-existed'/)
      assert.doesNotMatch(r.patchText, /sk-should-not-be-used/)
    } finally {
      // realPatch 会被 withFixture 的 finally 还原
    }
  })
})

test('apiKey 空 + ~/.dsh/.eee 有 THREEROUTER_MEDIA_API_KEY → 写入', () => {
  withFixture((fix) => {
    writeFileSync(join(fix.home, '.dsh', '.eee'), [
      '# 注释',
      'THREEROUTER_API_KEY=sk-llm-only',
      'THREEROUTER_MEDIA_API_KEY=sk-media-key-1234',
      '',
    ].join('\n'))
    const r = runBootstrap({ HOME: fix.home })
    assert.equal(r.exitCode, 0)
    assert.match(r.stdout, /已自动从.*\.dsh\/\.eee.*THREEROUTER_MEDIA_API_KEY/)
    assert.match(r.patchText, /apiKey: 'sk-media-key-1234'/)
    // 其它字段没动
    assert.match(r.patchText, /provider: threerouter/)
    assert.match(r.patchText, /outputsDir: '\.\/outputs'/)
    assert.match(r.patchText, /# tail comment/)
    assert.match(r.patchText, /- id: web-runtime/)
  })
})

test('~/.dsh/.env 优先于 ~/.dsh/.eee', () => {
  withFixture((fix) => {
    writeFileSync(join(fix.home, '.dsh', '.env'), 'THREEROUTER_MEDIA_API_KEY=sk-from-env\n')
    writeFileSync(join(fix.home, '.dsh', '.eee'), 'THREEROUTER_MEDIA_API_KEY=sk-from-eee\n')
    const r = runBootstrap({ HOME: fix.home })
    assert.equal(r.exitCode, 0)
    assert.match(r.stdout, /已自动从.*\.dsh\/\.env/)
    assert.match(r.patchText, /apiKey: 'sk-from-env'/)
    assert.doesNotMatch(r.patchText, /sk-from-eee/)
  })
})

test('THREEROUTER_MEDIA_API_KEY 优先于 THREEROUTER_API_KEY', () => {
  withFixture((fix) => {
    writeFileSync(join(fix.home, '.dsh', '.env'), [
      'THREEROUTER_API_KEY=sk-llm-only',
      'THREEROUTER_MEDIA_API_KEY=sk-media',
      '',
    ].join('\n'))
    const r = runBootstrap({ HOME: fix.home })
    assert.equal(r.exitCode, 0)
    assert.match(r.patchText, /apiKey: 'sk-media'/)
    assert.doesNotMatch(r.patchText, /sk-llm-only/)
  })
})

test('~/.dsh/.env 与 ~/.dsh/.eee 都没找到 → exit 0,文件不变', () => {
  withFixture((fix) => {
    // 故意只在 ~/.dsh 下放一个不相关的 key
    writeFileSync(join(fix.home, '.dsh', '.env'), 'DASHSCOPE_API_KEY=sk-wanx-only\n')
    const r = runBootstrap({ HOME: fix.home })
    assert.equal(r.exitCode, 0)
    assert.match(r.stdout, /threerouter\.apiKey 还未配置/)
    assert.match(r.stdout, /解法 A/)
    assert.match(r.patchText, /apiKey: ''/) // 没动
  })
})

test('空 ~/.dsh/.env 视为不存在,跳过到 .eee', () => {
  withFixture((fix) => {
    writeFileSync(join(fix.home, '.dsh', '.env'), '')
    writeFileSync(join(fix.home, '.dsh', '.eee'), 'THREEROUTER_MEDIA_API_KEY=sk-fallback\n')
    const r = runBootstrap({ HOME: fix.home })
    assert.equal(r.exitCode, 0)
    assert.match(r.stdout, /已自动从.*\.eee/)
    assert.match(r.patchText, /apiKey: 'sk-fallback'/)
  })
})

test('~/.dsh 目录不存在时 → exit 0,banner 提示', () => {
  withFixture((fix) => {
    // 直接不创建 ~/.dsh(makeFixture 已经创建了,所以手动清掉)
    rmSync(join(fix.home, '.dsh'), { recursive: true, force: true })
    const r = runBootstrap({ HOME: fix.home })
    assert.equal(r.exitCode, 0)
    assert.match(r.stdout, /还未配置/)
    assert.match(r.patchText, /apiKey: ''/)
  })
})