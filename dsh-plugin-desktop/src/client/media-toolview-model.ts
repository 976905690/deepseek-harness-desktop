/**
 * 桌面媒体 toolview 纯逻辑模型：从工具调用块推导内嵌媒体视图状态。
 * 独立于 React 组件（无 DOM / react 依赖），可在 node 环境单测。
 *
 * 数据来源：dsh-image-video 工具 output 的 presentationMeta（UI-only）经
 * tool/result 事件持久化到 ToolResultNode.meta。媒体字节经插件侧 /outputs
 * 只读路由加载（渲染进程与 webServer 同源，相对 URL 即可命中）。
 *
 * @module dsh-plugin-desktop/client/media-toolview-model
 */

/** 内嵌媒体视图状态。 */
export type MediaViewState =
  | { kind: 'running' }
  | {
      kind: 'media'
      src: string
      localPath: string
      prompt?: string
      /** 实际使用的模型名（presentationMeta.model，插件自报）。 */
      model?: string
      /** 生成模式（presentationMeta.mode），展示时经 mediaModeLabel 转中文。 */
      mode?: string
      /** 提交传输方式（presentationMeta.transport）：async=网关异步任务，sync=同步单次提交。 */
      transport?: string
      /** 物理提交次数（presentationMeta.submitAttempts）：正常恒为 1。 */
      submitAttempts?: number
      /** 后处理链路（presentationMeta.postprocess，如品牌水印）。 */
      postprocess?: string[]
      /** 透明告知（presentationMeta.notes）：时长被丢弃、候选回退链等。 */
      notes?: string[]
    }
  | { kind: 'unavailable' }

/** 模式枚举 → 卡片中文文案（未知值原样展示）。 */
export function mediaModeLabel(mode: string | undefined): string | undefined {
  if (!mode) return undefined
  if (mode === 'image-to-video') return '图生视频'
  if (mode === 'text-to-video') return '文生视频'
  if (mode === 'image-to-image') return '图生图'
  if (mode === 'text-to-image') return '文生图'
  return mode
}

/**
 * 从工具调用块推导媒体视图状态。
 * 未结算（RunningToolCall，无 kind 字段）→ running；已结算且 meta 携带
 * 非空 localPath 字符串 → media（src 指向 /outputs/<文件名>）；其余
 * （历史会话无 meta、meta 结构不符）→ unavailable，由组件回退文件行展示。
 * model/mode/notes 为插件事务透明字段（2026-09 起携带），缺省或类型不符时
 * 逐字段省略，不影响媒体本体渲染（历史会话的 meta 无这些字段，卡片自然退化）。
 * @param block - 上游工具调用块（unknown，结构未知），按 `in` 收窄探测
 *   kind/meta，避免对上游判别联合做强类型约束（RunningToolCall 无公共字段）。
 */
export function mediaViewFromBlock(block: unknown): MediaViewState {
  if (typeof block !== 'object' || block === null) return { kind: 'running' }
  if (!('kind' in block) || typeof block.kind !== 'string') return { kind: 'running' }
  if (!('meta' in block) || typeof block.meta !== 'object' || block.meta === null) {
    return { kind: 'unavailable' }
  }
  const meta = block.meta as {
    localPath?: unknown
    prompt?: unknown
    model?: unknown
    mode?: unknown
    transport?: unknown
    submitAttempts?: unknown
    postprocess?: unknown
    notes?: unknown
  }
  const { localPath, prompt } = meta
  if (typeof localPath !== 'string' || localPath === '') return { kind: 'unavailable' }
  const model = typeof meta.model === 'string' && meta.model !== '' ? meta.model : undefined
  const mode = typeof meta.mode === 'string' && meta.mode !== '' ? meta.mode : undefined
  const transport = typeof meta.transport === 'string' && meta.transport !== '' ? meta.transport : undefined
  const submitAttempts = typeof meta.submitAttempts === 'number' && Number.isInteger(meta.submitAttempts) && meta.submitAttempts >= 0
    ? meta.submitAttempts
    : undefined
  const postprocess = Array.isArray(meta.postprocess)
    ? meta.postprocess.filter((p): p is string => typeof p === 'string' && p !== '')
    : undefined
  const notes = Array.isArray(meta.notes)
    ? meta.notes.filter((n): n is string => typeof n === 'string' && n !== '')
    : undefined
  return {
    kind: 'media',
    src: `/outputs/${encodeURIComponent(mediaBasename(localPath))}`,
    localPath,
    ...(typeof prompt === 'string' && prompt !== '' ? { prompt } : {}),
    ...(model ? { model } : {}),
    ...(mode ? { mode } : {}),
    ...(transport ? { transport } : {}),
    ...(submitAttempts !== undefined ? { submitAttempts } : {}),
    ...(postprocess !== undefined && postprocess.length > 0 ? { postprocess } : {}),
    ...(notes !== undefined && notes.length > 0 ? { notes } : {}),
  }
}

/**
 * 取路径的最后一段（兼容 Windows 反斜杠与 POSIX 斜杠）。
 * 渲染进程无 node:path，meta.localPath 来自宿主端（Windows 盘符路径），
 * 必须在客户端侧自行解析文件名。
 * @param path - 本地文件路径。
 */
export function mediaBasename(path: string): string {
  const at = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return at === -1 ? path : path.slice(at + 1)
}
