#!/usr/bin/env node
/**
 * 本地开发热加载脚本(仅本地开发用,已加入 .gitignore,不会入库)。
 *
 * 行为:
 *   1. 校验 dsh-community-market/lib 已构建(desktop 运行时依赖它)。
 *   2. 图标缺失则补一次生成(用 node,无需 yarn/corepack)。
 *   3. 启动 tsdown --watch:监听 src/*.ts,增量重打 lib/*.js(含 host/bin/client/preload)。
 *   4. 启动 vite build --watch:监听 src/native-ui,重打 lib/native-ui。
 *   5. 等 lib/main.js 就绪后启动 Electron;首次启动后给 4s 静默期让首轮构建完成。
 *   6. 此后监听 lib 顶层 .js 变化 → 800ms 去抖 → 优雅重启 Electron:
 *        发 SIGTERM → 等进程退出(≤7s,app 自身最多 5s 释放 Host/端口/单实例锁)
 *        → 仍未退出则 SIGKILL → 再等 1.2s 让系统回收 loopback 端口 → 起新进程。
 *
 * 用法(仓库根目录):
 *   node dsh-plugin-desktop/scripts/dev-watch.mjs
 * 或(已配好本地 scripts 后):
 *   corepack yarn dev:watch
 *
 * 退出:Ctrl-C 会杀掉所有子进程。
 */
import { spawn } from 'node:child_process'
import { existsSync, readdirSync, watch } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const pkgDir = resolve(here, '..') // dsh-plugin-desktop
const repoRoot = resolve(pkgDir, '..') // 仓库根
const libDir = resolve(pkgDir, 'lib')
const buildDir = resolve(pkgDir, 'build')
const marketLib = resolve(repoRoot, 'dsh-community-market/lib')
const mainJs = resolve(libDir, 'main.js')
// Yarn 4 node-modules linker 可能将 .bin/ hoist 到 root 而非 pkgDir,
// 依次检查 pkgDir → repoRoot,取第一个存在的路径。
function resolveBin(name) {
  for (const dir of [pkgDir, repoRoot]) {
    const p = resolve(dir, 'node_modules/.bin', name)
    if (existsSync(p)) return p
  }
  return resolve(pkgDir, 'node_modules/.bin', name) // 返回默认路径(让 existsSync 报错)
}
const tsdownBin = resolveBin('tsdown')
const viteBin = resolveBin('vite')
const electronBin = resolveBin('electron')

// dsh-image-video submodule: 有独立 tsdown 配置,dev-watch 默认不监听它,
// 改了 src 不会自动重打 lib/index.js,容易忘。这里额外起一个 watcher。
// lib/ 被 .gitignore,git pull 后可能不存在,需在 Electron 启动前同步构建。
const imageVideoDir = resolve(repoRoot, 'dsh-image-video')
const imageVideoLib = resolve(imageVideoDir, 'lib')
const imageVideoIndexJs = resolve(imageVideoLib, 'index.js')
const imageVideoTsdown = resolveBin('tsdown') // 复用 resolveBin 兼容 root hoist

const c = s => `\x1b[${s}m`
const log = (...a) => console.log(`${c(36)}[dev-watch]${c(0)}`, ...a)
const warn = (...a) => console.error(`${c(33)}[dev-watch]${c(0)}`, ...a)
const err = (...a) => console.error(`${c(31)}[dev-watch]${c(0)}`, ...a)

const children = []
function spawnWatcher(cmd, args, cwd, label) {
  log(`${label}: ${cmd} ${args.join(' ')}`)
  const p = spawn(cmd, args, { cwd, stdio: 'inherit', env: process.env, shell: process.platform === 'win32' })
  p.once('exit', code => { log(`${label} 退出 (code=${code})`); children.splice(children.indexOf(p), 1) })
  p.once('error', e => err(`${label} 启动失败:`, e.message))
  children.push(p)
  return p
}

// 用 node 跑图标生成脚本(不依赖 yarn/corepack)
async function ensureIcons() {
  const iconFiles = ['app-icon-mac.png', 'app-icon.png', 'tray-icon.svg', 'tray-icon-blue.png']
  const missing = iconFiles.filter(f => !existsSync(join(buildDir, f)))
  if (missing.length === 0) { log('图标已存在,跳过生成'); return }
  for (const s of ['generate-mac-app-icon.mjs', 'generate-tray-icons.mjs']) {
    await new Promise((res, rej) => {
      const p = spawn('node', [join('scripts', s)], { cwd: pkgDir, stdio: 'inherit', env: process.env })
      p.once('exit', code => code === 0 ? res() : rej(new Error(`${s} exited ${code}`)))
      p.once('error', rej)
    })
  }
  log('图标已补齐')
}

function checkMarket() {
  if (existsSync(marketLib) && readdirSync(marketLib).length > 0) { log('market 工作区已构建'); return true }
  err('dsh-community-market/lib 不存在。请先执行一次: corepack yarn dev')
  return false
}

function waitForMain(maxMs = 120000) {
  return new Promise((res) => {
    if (existsSync(mainJs)) { log('lib/main.js 已就绪'); return res(true) }
    log('等待 tsdown 首轮打包 lib/main.js ...')
    const t0 = Date.now()
    const iv = setInterval(() => {
      if (existsSync(mainJs)) { clearInterval(iv); log('lib/main.js 已就绪'); res(true) }
      else if (Date.now() - t0 > maxMs) { clearInterval(iv); warn('等待超时,仍尝试启动 Electron'); res(false) }
    }, 600)
  })
}

// dsh-image-video/lib/index.js 被 .gitignore,git pull 后可能不存在。
// 同步构建确保文件就绪后再启动 Electron,杜绝 ERR_MODULE_NOT_FOUND 启动竞态。
async function ensureImageVideoBuilt() {
  if (existsSync(imageVideoIndexJs)) { log('dsh-image-video lib/index.js 已就绪'); return }
  log('dsh-image-video/lib/index.js 不存在,执行首次构建 ...')
  if (!existsSync(tsdownBin)) { err('找不到 tsdown,请先 corepack yarn install'); return }
  const ok = await new Promise(resolve => {
    const p = spawn(tsdownBin, [], { cwd: imageVideoDir, stdio: 'inherit', env: process.env, shell: process.platform === 'win32' })
    p.once('exit', code => resolve(code === 0))
    p.once('error', () => resolve(false))
  })
  if (ok && existsSync(imageVideoIndexJs)) log('dsh-image-video 首次构建完成')
  else err('dsh-image-video 构建失败,后续 Electron 可能报 ERR_MODULE_NOT_FOUND')
}

// --- Electron 生命周期 ---
let electronP = null
let restartTimer = null
let restarting = false
let pendingRestart = false
let armed = false // 首轮构建静默期标志,避免初始 68 个文件写入触发重启风暴

function startElectron() {
  if (!existsSync(electronBin)) { err('找不到 node_modules/.bin/electron,无法启动桌面窗口'); return }
  log('启动 Electron ...')
  electronP = spawn(electronBin, [mainJs], {
    cwd: pkgDir,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  })
  electronP.once('exit', (code, signal) => {
    log(`Electron 退出 (code=${code} signal=${signal})`)
    electronP = null
  })
  electronP.once('error', e => err('Electron 启动失败:', e.message))
}

/** 优雅停止旧 Electron:SIGTERM → 等退出(≤7s)→ SIGKILL → 额外 grace 1.2s 让端口/锁释放。 */
async function stopElectron() {
  const p = electronP
  if (!p) return
  electronP = null
  p.removeAllListeners('exit')
  log('发送 SIGTERM 给旧 Electron,等待优雅退出 ...')
  const exited = await new Promise(resolve => {
    let done = false
    const finish = v => { if (!done) { done = true; resolve(v) } }
    p.once('exit', () => finish(true))
    // app 自身优雅关闭最多 5s(DESKTOP_SHUTDOWN_TIMEOUT_MS),给 7s 余量
    setTimeout(() => finish(false), 7000)
  })
  if (exited) {
    log('旧 Electron 已退出')
  } else {
    warn('旧 Electron 7s 未退出,SIGKILL 强杀')
    try { process.kill(p.pid, 'SIGKILL') } catch {}
    await new Promise(r => setTimeout(r, 300))
  }
  // 额外等待:让系统回收 loopback 端口、释放单实例锁,避免新进程 EADDRINUSE / 锁冲突
  log('等待 1.2s 让端口与单实例锁释放 ...')
  await new Promise(r => setTimeout(r, 1200))
}

async function doRestart() {
  if (restarting) { pendingRestart = true; return }
  restarting = true
  log('重启 Electron ...')
  await stopElectron()
  startElectron()
  restarting = false
  if (pendingRestart) {
    pendingRestart = false
    log('重启期间又有新的代码变更,再次重启')
    setTimeout(() => { void doRestart() }, 200)
  }
}

function scheduleRestart(reason) {
  if (!armed) { log(`(${reason},首轮构建静默期,忽略)`); return }
  log(`检测到 ${reason},800ms 后去抖重启 Electron`)
  clearTimeout(restartTimer)
  restartTimer = setTimeout(() => { void doRestart() }, 800)
}

// Ctrl-C 清理
function cleanup() {
  log('退出中,清理子进程 ...')
  clearTimeout(restartTimer)
  for (const p of children) { try { process.kill(p.pid) } catch {} }
  if (electronP) { try { process.kill(electronP.pid, 'SIGTERM') } catch {} }
  process.exit(0)
}
process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

// --- 主流程 ---
if (!checkMarket()) process.exit(1)
await ensureIcons()

if (!existsSync(tsdownBin)) { err('找不到 tsdown,请先 corepack yarn install'); process.exit(1) }
if (!existsSync(viteBin)) { err('找不到 vite,请先 corepack yarn install'); process.exit(1) }

// 先同步构建 dsh-image-video(如果 lib/ 不存在),避免 Electron 启动时 ERR_MODULE_NOT_FOUND
await ensureImageVideoBuilt()

// 启动 watcher(各自做首轮打包,然后持续监听)
spawnWatcher(tsdownBin, ['--watch'], pkgDir, 'tsdown')
spawnWatcher(viteBin, ['build', '--watch', '--config', 'vite.native-ui.config.ts'], pkgDir, 'vite')
// dsh-image-video 的 tsdown --watch 首轮会清空再重写 lib/index.js,
// 若与 Electron 启动同时跑会产生竞态(文件被清空时 Electron 导入 → ERR_MODULE_NOT_FOUND)。
// 延迟到静默期后启动,确保 Electron 用的是 ensureImageVideoBuilt() 已构建好的文件。

// 等 lib/main.js 就绪后启动 Electron(dsh-image-video 已在上方同步构建完毕)
await waitForMain()
startElectron()

// 首轮构建静默期:tsdown/vite 首次会写 68+ 个文件,期间忽略 lib 变化,避免启动即重启
setTimeout(() => {
  armed = true
  log('首轮构建静默期结束,文件监听已就绪。改任意 src 代码将自动重打并重启 Electron。')
  // 静默期后启动 dsh-image-video watcher:改 src 自动重打 lib/index.js
  if (existsSync(imageVideoTsdown)) {
    spawnWatcher(imageVideoTsdown, ['--watch'], imageVideoDir, 'tsdown:image-video')
  } else {
    log('dsh-image-video 未安装 tsdown,跳过其 watcher;改 src 后需手动 corepack yarn build')
  }
}, 4000)

// 监听 lib 顶层 .js 变化 → 去抖重启 Electron
// (lib/native-ui 是子目录,非 recursive 不会触发;client.js 变化也重启,因为 host 会缓存 client bundle)
try {
  const watcher = watch(libDir, (_event, filename) => {
    if (!filename || !filename.endsWith('.js')) return
    scheduleRestart(`lib/${filename}`)
  })
  watcher.once('error', e => warn('lib 文件监听出错:', e.message))
} catch (e) {
  warn('无法监听 lib 目录:', e.message, '— 改完代码需手动重启 Electron')
}

// 监听 dsh-image-video/lib 变化 → 也触发 Electron 重启
// (桌面 host 运行时 require 该 submodule 的 lib/index.js,重打后需重启才生效)
if (existsSync(imageVideoLib)) {
  try {
    const ivWatcher = watch(imageVideoLib, (_event, filename) => {
      if (!filename || !filename.endsWith('.js')) return
      scheduleRestart(`dsh-image-video/lib/${filename}`)
    })
    ivWatcher.once('error', e => warn('dsh-image-video/lib 文件监听出错:', e.message))
  } catch (e) {
    warn('无法监听 dsh-image-video/lib 目录:', e.message)
  }
}

log('热加载已就绪。Ctrl-C 退出。')
