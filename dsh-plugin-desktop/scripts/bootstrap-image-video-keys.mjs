#!/usr/bin/env node
/**
 * dsh-image-video 凭证预检与自动引导。
 *
 * 同事 clone 本项目后首次 `yarn dev`,desktop 启动前跑这个脚本:
 *   1. 解析 dsh-plugin-desktop/cordis.patch.yml 的 `- id: image-video` 块,
 *      检查 `config.threerouter.apiKey` 是否仍是占位的 `''`;
 *   2. 空 → 顺序读 `~/.dsh/.env`、`~/.dsh/.eee` 两个候选文件,
 *      按 `THREEROUTER_MEDIA_API_KEY` → `THREEROUTER_API_KEY` 顺序找;
 *   3. 找到 → 用文本替换(不解析 YAML,保留注释/顺序)写回
 *      `cordis.patch.yml` 的 `threerouter.apiKey` 字段;
 *   4. 找不到 → 打印 banner 提示用户怎么手动填,exit 0 不阻断启动。
 *
 * 设计要点:
 *   - 跳过条件:`SKIP_IMAGE_VIDEO_BOOTSTRAP=1` 时整段跳过(给 CI 用);
 *   - 已填条件:`apiKey` 不是 `''` 时跳过,尊重用户手动覆盖;
 *   - 文件兼容:`~/.dsh/.env` 与 `~/.dsh/.eee` 二者取先存在且非空者,
 *     因为用户的 DSH 桌面安装版历史上把 .env 改名成了 .eee;
 *   - 优先级:`THREEROUTER_MEDIA_API_KEY`(图+视频统一入口)优先于
 *     `THREEROUTER_API_KEY`(纯 LLM 入口),与 threerouter provider 默认
 *     推荐用 media key 的实际场景一致;
 *   - 文本替换而非 YAML 解析:cordis.patch.yml 带注释、`- id: image-video`
 *     是 yaml 列表元素,YAML 序列化会丢注释、改 key 顺序,文本替换能
 *     精确保留原文件其余内容。
 *
 * 用法:
 *   node dsh-plugin-desktop/scripts/bootstrap-image-video-keys.mjs
 * 或已串到 yarn dev:
 *   yarn dev    // = yarn build && bootstrap-image-video-keys && lib/bin.js
 *
 * 退出码:0 = 不阻断(已填/已写入/没找到都走 banner);非 0 = 内部错误。
 *
 * @module dsh-plugin-desktop/scripts/bootstrap-image-video-keys
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const pkgDir = resolve(here, '..') // dsh-plugin-desktop
const repoRoot = resolve(pkgDir, '..') // 仓库根
const patchPath = join(pkgDir, 'cordis.patch.yml')

const c = (s) => `\x1b[${s}m`
const blue = (s) => `${c(36)}${s}${c(0)}`
const yellow = (s) => `${c(33)}${s}${c(0)}`
const red = (s) => `${c(31)}${s}${c(0)}`
const dim = (s) => `${c(2)}${s}${c(0)}`

/** 在 cordis.patch.yml 文本里定位 `- id: image-video` 块的字节起止。 */
function locateImageVideoBlock(text) {
  const idLineRe = /^[ \t]*- id: image-video[ \t]*$/m
  const idMatch = text.match(idLineRe)
  if (!idMatch) return null
  const blockStart = idMatch.index
  const afterId = text.slice(blockStart + idMatch[0].length)
  // 块终止:下一个不缩进的非空行(下一个 `- id: ...` 列表项或 `#` 注释)
  const blockEndRe = /^[ \t]*(?:- id: |#)/m
  const endMatch = afterId.match(blockEndRe)
  const blockEnd = endMatch ? blockStart + idMatch[0].length + endMatch.index : text.length
  return { blockStart, blockEnd, blockText: text.slice(blockStart, blockEnd) }
}

/**
 * 检查 image-video 块里的 threerouter.apiKey 当前状态。
 * @returns 'filled' | 'empty' | 'absent'
 */
function inspectApiKey(blockText) {
  // 占位: apiKey: ''
  const emptyRe = /threerouter:[ \t]*\n[ \t]+apiKey:[ \t]*''/
  if (emptyRe.test(blockText)) return 'empty'
  // 已填: apiKey: 'sk-xxx' 或 apiKey: "sk-xxx"
  const filledRe = /threerouter:[ \t]*\n[ \t]+apiKey:[ \t]*['"][^'"]+['"]/
  if (filledRe.test(blockText)) return 'filled'
  return 'absent'
}

/**
 * 把 key 写入 blockText 的 threerouter.apiKey 占位处。
 * YAML 单引号字符串里单引号要双写转义。
 */
function writeApiKey(blockText, key) {
  const escaped = key.replace(/'/g, "''")
  return blockText.replace(
    /(threerouter:[ \t]*\n[ \t]+apiKey:[ \t]*)''/,
    `$1'${escaped}'`,
  )
}

/**
 * 解析 .env 文件,返回 key→value 的对象(忽略注释与空行)。
 * 简化版:只支持 `KEY=value` 单行,不支持 export 前缀、不支持跨行。
 */
function parseEnvText(text) {
  const out = {}
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const m = line.match(/^(?:export[ \t]+)?([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    // 去掉两端匹配的引号
    if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) {
      v = v.slice(1, -1)
    }
    out[m[1]] = v
  }
  return out
}

/**
 * 找 ~/.dsh/.env 或 ~/.dsh/.eee 的第一个存在且非空者,返回 { path, env }。
 */
function loadHomeEnv() {
  const dshHome = join(homedir(), '.dsh')
  for (const name of ['.env', '.eee']) {
    const p = join(dshHome, name)
    if (!existsSync(p)) continue
    const txt = readFileSync(p, 'utf8')
    if (txt.trim().length === 0) continue
    return { path: p, env: parseEnvText(txt) }
  }
  return null
}

/**
 * 按优先级拿 key:THREEROUTER_MEDIA_API_KEY → THREEROUTER_API_KEY。
 */
function pickKey(envObj) {
  if (!envObj) return null
  for (const k of ['THREEROUTER_MEDIA_API_KEY', 'THREEROUTER_API_KEY']) {
    const v = envObj[k]
    if (v && v.trim().length > 0) return { key: v.trim(), from: k }
  }
  return null
}

function bannerUnfilled(homeEnvPath) {
  const lines = [
    '',
    `${yellow('⚠️  dsh-image-video threerouter.apiKey 还未配置')}`,
    '',
    `  • 桌面 profile 默认 provider 是 threerouter,首次跑 dev 需要给它一个 API Key`,
    `  • 引导脚本已自动尝试从 ${dim(homeEnvPath || '~/.dsh/.env / ~/.dsh/.eee')} 读`,
    `    ${dim('THREEROUTER_MEDIA_API_KEY 或 THREEROUTER_API_KEY')},但没找到`,
    '',
    `  ${blue('解法 A:在 ~/.dsh/.env 加一行')} ${dim('(推荐)')}`,
    `    THREEROUTER_MEDIA_API_KEY=sk-your-key-here`,
    `    然后再跑一次 ${blue('yarn dev')},脚本会自动写回 cordis.patch.yml`,
    '',
    `  ${blue('解法 B:直接编辑 cordis.patch.yml 第 36 行)')}`,
    `    file: ${dim(patchPath)}`,
    `    把 ${yellow("threerouter:")} 下面的 ${yellow("apiKey: ''")} 换成实际 key`,
    '',
    `  ${blue('解法 C:切到其它 provider(无需 media key)')}`,
    `    把 cordis.patch.yml 第 35 行 provider 改成 ${yellow('wanx')} 或 ${yellow('seedance')}`,
    `    并填对应块的 apiKey`,
    '',
    `  ${blue('跳过此检查:')} ${dim('SKIP_IMAGE_VIDEO_BOOTSTRAP=1 yarn dev')}`,
    '',
  ]
  console.log(lines.join('\n'))
}

function bannerWrote(key, fromKey, homeEnvPath) {
  const lines = [
    '',
    `${blue('✓')} dsh-image-video threerouter.apiKey 已自动从 ${yellow(homeEnvPath)} 的 ${yellow(fromKey)} 引导`,
    `  ${dim('key 长度:')} ${key.length} chars`,
    `  ${dim('写入:')} ${dim(patchPath)}`,
    `  ${dim('注意:git 会把 cordis.patch.yml 标 dirty;这是预期(每个开发者 key 不同)')}`,
    `  ${dim('建议把此文件加进 .git/info/exclude,或首次 commit 后不再改动')}`,
    '',
  ]
  console.log(lines.join('\n'))
}

function main() {
  // 1. 跳过开关(CI 用)
  if (process.env.SKIP_IMAGE_VIDEO_BOOTSTRAP === '1') {
    console.log(dim('[bootstrap] SKIP_IMAGE_VIDEO_BOOTSTRAP=1,跳过'))
    return 0
  }

  // 2. 读 patch
  if (!existsSync(patchPath)) {
    console.error(red(`[bootstrap] 找不到 ${patchPath}`))
    return 2
  }
  const text = readFileSync(patchPath, 'utf8')
  const located = locateImageVideoBlock(text)
  if (!located) {
    console.warn(yellow('[bootstrap] cordis.patch.yml 未发现 - id: image-video 块,跳过(可能尚未集成 dsh-image-video)'))
    return 0
  }

  // 3. 检查 apiKey
  const state = inspectApiKey(located.blockText)
  if (state === 'filled') {
    console.log(dim('[bootstrap] dsh-image-video threerouter.apiKey 已配置,跳过'))
    return 0
  }
  if (state === 'absent') {
    console.warn(yellow('[bootstrap] image-video 块里没找到 threerouter 节点,结构可能变了,请人工检查'))
    return 0
  }

  // 4. 从 ~/.dsh/.env 或 ~/.dsh/.eee 找 key
  const homeEnv = loadHomeEnv()
  const picked = homeEnv ? pickKey(homeEnv.env) : null
  if (!picked) {
    bannerUnfilled(homeEnv ? homeEnv.path : null)
    return 0
  }

  // 5. 写回
  const newBlock = writeApiKey(located.blockText, picked.key)
  if (newBlock === located.blockText) {
    // 理论上 inspectApiKey 已经是 'empty',但保留 defensive check
    console.warn(yellow('[bootstrap] 写入失败,blockText 未变化;请人工检查 cordis.patch.yml 结构'))
    return 0
  }
  const newText = text.slice(0, located.blockStart) + newBlock + text.slice(located.blockEnd)
  // 写之前确保目录存在(cordis.patch.yml 所在目录必然存在,但写一份临时备份仍稳)
  writeFileSync(patchPath, newText, 'utf8')
  bannerWrote(picked.key, picked.from, homeEnv.path)
  return 0
}

process.exit(main())