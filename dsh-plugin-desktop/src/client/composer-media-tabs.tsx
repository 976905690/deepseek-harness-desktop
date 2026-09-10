/**
 * 桌面 composer 媒体模式 tab：工具行内「文本 / 图片 / 视频」分段切换 +
 * 参数下拉组（advanced / extended 外壳定制，compatibility 不接入）。
 *
 * 注册在 `conversation.input.left` list slot（owner InputZone）——上游契约把
 * 该座位定义为「工具行 + 按钮旁的小常驻控件」，且 hero 与会话两种 composer
 * variant 都渲染工具行，因此 tab 组在首页和会话内均可见。上游 css modules
 * 的 `.select` 芯片即原生 `<select>`，这里沿用同一设计语言（appearance:none
 * + 内联 chevron + `--dsw-*` 主题 token）。
 *
 * 参数生效机制（与 dsh-image-video 的 runtime-defaults 模块配套）：
 *   - 下拉变更立即 POST 同源 `/image-video/defaults`（插件回环路由，仅写内存
 *     运行时覆盖值，不落盘、不触发宿主重启）；
 *   - 生成工具按「工具显式参数 > 运行时覆盖值 > settings 持久值」取参；
 *   - 挂载时 GET 回显当前覆盖值；插件重载后运行时值清空，回落 settings。
 *
 * 文本模式不渲染参数组：聊天模型继续使用上游右侧模型选择器
 * （conversation.input.model seat），桌面不做覆盖。
 *
 * 下拉的模型/尺寸/比例取值必须与 dsh-image-video src/runtime-defaults.ts 的
 * 白名单一致（该处为协议校验源，此处为展示源），改动需两仓同步；模型下拉
 * 额外按 settings 的三个生成服务商分组（组名对齐 settings 的服务商文案），
 * host 端 runtime-defaults.ts 的 model→provider 映射键与本处选项一一对应：
 * 选中某服务商分组下的模型后，生成工具自动路由到该服务商（用其凭证）。
 *
 * @module dsh-plugin-desktop/client/composer-media-tabs
 */

import { useEffect, useState } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// 仅拉类型面（'conversation.input.left' slot augment），不导入具名类型；
// 配合 tsconfig.client.json 的 skipLibCheck（与 media-toolview 相同的理由）。
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'

/** defaults 回环路由（dsh-image-video DEFAULTS_ROUTE_PATH；渲染进程同源直呼）。 */
const DEFAULTS_ROUTE = '/image-video/defaults'

/** 下拉选项：value 为协议值（'' = 自动，跟随 settings），label 为展示文案。 */
interface SelectOption {
  value: string
  label: string
}

/** 分组下拉项（optgroup）：组头文案 = settings 里的服务商名，模型归属显性化。 */
interface SelectGroup {
  label: string
  options: ReadonlyArray<SelectOption>
}

/** 下拉内容：扁平项或服务商分组（分组内不得再嵌套）。 */
type SelectContent = SelectOption | SelectGroup

/** 「自动」占位项：清除运行时覆盖，回落 settings 持久值。 */
const AUTO_OPTION: SelectOption = { value: '', label: '自动' }

/** 服务商分组头（与 settings「图片与视频生成」的服务商文案逐字一致）。 */
const PROVIDER_GROUPS = {
  threerouter: 'Threerouter',
  wanx: '万象（阿里云百炼）',
  seedance: 'Seedance 2.5（火山引擎）',
} as const

/**
 * 图像模型预设（'' = 跟随 settings/provider 默认）。按服务商分组：
 * Threerouter 是统一路由入口（内置默认 wan2.1-image），万象直连阿里云百炼，
 * Seedance 直连火山引擎。与 host 端 IMAGE_MODEL_PROVIDER 映射键一一对应。
 */
const IMAGE_MODEL_OPTIONS: ReadonlyArray<SelectContent> = [
  AUTO_OPTION,
  {
    label: PROVIDER_GROUPS.threerouter,
    options: [{ value: 'wan2.1-image', label: 'Wan 2.1 图像' }],
  },
  {
    label: PROVIDER_GROUPS.wanx,
    options: [{ value: 'wanx2.1-t2i-turbo', label: 'Wanx 2.1 Turbo' }],
  },
  {
    label: PROVIDER_GROUPS.seedance,
    options: [
      { value: 'doubao-seedream-3-0-t2i-250415', label: 'Seedream 3.0' },
      { value: 'doubao-seedream-4-0-250828', label: 'Seedream 4.0' },
    ],
  },
]

/**
 * 视频模型预设。wan2.2-t2v-plus 是 Threerouter 的内置默认视频模型（万象直连
 * 的默认亦为同款）；为避免同一模型 id 在两个分组重复导致选中歧义，仅列在
 * Threerouter 组下。与 host 端 VIDEO_MODEL_PROVIDER 映射键一一对应。
 */
const VIDEO_MODEL_OPTIONS: ReadonlyArray<SelectContent> = [
  AUTO_OPTION,
  {
    label: PROVIDER_GROUPS.threerouter,
    options: [{ value: 'wan2.2-t2v-plus', label: 'Wan 2.2 Plus' }],
  },
  {
    label: PROVIDER_GROUPS.seedance,
    options: [
      { value: 'doubao-seedance-1-0-pro-250428', label: 'Seedance 1.0 Pro' },
      { value: 'doubao-seedance-1-0-lite-t2v-250428', label: 'Seedance 1.0 Lite' },
    ],
  },
]

/** 图像尺寸预设：label 为比例，value 为尺寸串（host 白名单校验）。 */
const IMAGE_SIZE_OPTIONS: ReadonlyArray<SelectOption> = [
  AUTO_OPTION,
  { value: '1024*1024', label: '1:1' },
  { value: '1152*864', label: '4:3' },
  { value: '864*1152', label: '3:4' },
  { value: '1280*720', label: '16:9' },
  { value: '720*1280', label: '9:16' },
]

/** 视频宽高比预设。 */
const VIDEO_ASPECT_OPTIONS: ReadonlyArray<SelectOption> = [
  AUTO_OPTION,
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '1:1', label: '1:1' },
]

/** 视频时长预设（秒；1-10 上限与工具强制规范一致）。 */
const VIDEO_DURATION_OPTIONS: ReadonlyArray<SelectOption> = [
  AUTO_OPTION,
  { value: '3', label: '3 秒' },
  { value: '4', label: '4 秒' },
  { value: '5', label: '5 秒' },
  { value: '6', label: '6 秒' },
  { value: '8', label: '8 秒' },
  { value: '10', label: '10 秒' },
]

/** 图片风格预设：host 端映射英文提示词后缀（对所有服务商通用）。 */
const IMAGE_STYLE_OPTIONS: ReadonlyArray<SelectOption> = [
  AUTO_OPTION,
  { value: 'photo', label: '摄影' },
  { value: 'illustration', label: '插画' },
  { value: '3d', label: '3D 渲染' },
  { value: 'anime', label: '动漫' },
  { value: 'ink', label: '水墨' },
]

/** GET /image-video/defaults 响应视图（null = 未覆盖）。 */
interface DefaultsView {
  imageModel: string | null
  imageSize: string | null
  imageStyle: string | null
  videoModel: string | null
  videoAspectRatio: string | null
  videoDuration: number | null
}

/** 图像组下拉状态（'' = 自动）。 */
interface ImageSelection {
  model: string
  size: string
  style: string
}

/** 视频组下拉状态（duration 为字符串，POST 时转数字）。 */
interface VideoSelection {
  model: string
  aspect: string
  duration: string
}

type MediaMode = 'text' | 'image' | 'video'

const MODE_LABELS: Record<MediaMode, string> = {
  text: '文本',
  image: '图片',
  video: '视频',
}

/** 读取当前运行时覆盖值；webServer 未挂载（非桌面宿主）时返回 undefined。 */
async function readDefaults(): Promise<DefaultsView | undefined> {
  try {
    const res = await fetch(DEFAULTS_ROUTE)
    return res.ok ? (await res.json() as DefaultsView) : undefined
  } catch {
    return undefined
  }
}

/** 写入运行时覆盖值；失败静默——tab 选择仍是本地 UI 状态，不影响输入。 */
async function writeDefaults(patch: Record<string, string | number>): Promise<void> {
  try {
    await fetch(DEFAULTS_ROUTE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
  } catch {
    // 非桌面宿主（无 webServer）或回环路由未注册：静默忽略
  }
}

/** owner 传参的本地结构视图（InputZone）——tab 组是常驻控件，不消费会话态。 */
interface ComposerMediaTabsProps {
  session: unknown
  input: unknown
}

/** 单个参数下拉：label 文字 + 原生 select（appearance:none 芯片样式）。 */
function ComposerSelect(props: {
  label: string
  value: string
  options: ReadonlyArray<SelectContent>
  onChange: (value: string) => void
}) {
  return (
    <label className="dshDesktopComposerField">
      <span className="dshDesktopComposerFieldLabel">{props.label}</span>
      <select
        value={props.value}
        onChange={(event) => { props.onChange(event.target.value) }}
      >
        {props.options.map((item) => 'options' in item ? (
          <optgroup key={item.label} label={item.label}>
            {item.options.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </optgroup>
        ) : (
          <option key={item.value} value={item.value}>{item.label}</option>
        ))}
      </select>
    </label>
  )
}

/**
 * 工具行媒体模式 tab：分段切换（文本/图片/视频）+ 当前模式的参数下拉组。
 * 文本模式仅显示分段控件本身（聊天模型用右侧上游模型选择器）。
 */
function ComposerMediaTabs(_: ComposerMediaTabsProps) {
  const [mode, setMode] = useState<MediaMode>('text')
  const [image, setImage] = useState<ImageSelection>({ model: '', size: '', style: '' })
  const [video, setVideo] = useState<VideoSelection>({ model: '', aspect: '', duration: '' })

  // 挂载时回显 host 端当前运行时覆盖值（其他入口写入的也能看到）
  useEffect(() => {
    let cancelled = false
    readDefaults().then((view) => {
      if (cancelled || view === undefined) return
      setImage({
        model: view.imageModel ?? '',
        size: view.imageSize ?? '',
        style: view.imageStyle ?? '',
      })
      setVideo({
        model: view.videoModel ?? '',
        aspect: view.videoAspectRatio ?? '',
        duration: view.videoDuration === null || view.videoDuration === undefined ? '' : String(view.videoDuration),
      })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const updateImage = (patch: Partial<ImageSelection>): void => {
    setImage((prev) => {
      const next = { ...prev, ...patch }
      void writeDefaults({ imageModel: next.model, imageSize: next.size, imageStyle: next.style })
      return next
    })
  }

  const updateVideo = (patch: Partial<VideoSelection>): void => {
    setVideo((prev) => {
      const next = { ...prev, ...patch }
      // duration：'' = 自动（host 归一化 null），数字串转整数
      void writeDefaults({
        videoModel: next.model,
        videoAspectRatio: next.aspect,
        videoDuration: next.duration === '' ? '' : Number(next.duration),
      })
      return next
    })
  }

  return (
    <div className="dshDesktopComposerMedia" data-mode={mode}>
      <div className="dshDesktopComposerSeg" role="tablist" aria-label="生成模式">
        {(['text', 'image', 'video'] as const).map((entry) => (
          <button
            key={entry}
            type="button"
            role="tab"
            aria-selected={mode === entry}
            className="dshDesktopComposerSegBtn"
            data-active={mode === entry}
            onClick={() => { setMode(entry) }}
          >
            {MODE_LABELS[entry]}
          </button>
        ))}
      </div>
      {mode === 'image' && (
        <div className="dshDesktopComposerParams">
          <ComposerSelect
            label="模型"
            value={image.model}
            options={IMAGE_MODEL_OPTIONS}
            onChange={(model) => { updateImage({ model }) }}
          />
          <ComposerSelect
            label="比例"
            value={image.size}
            options={IMAGE_SIZE_OPTIONS}
            onChange={(size) => { updateImage({ size }) }}
          />
          <ComposerSelect
            label="风格"
            value={image.style}
            options={IMAGE_STYLE_OPTIONS}
            onChange={(style) => { updateImage({ style }) }}
          />
        </div>
      )}
      {mode === 'video' && (
        <div className="dshDesktopComposerParams">
          <ComposerSelect
            label="模型"
            value={video.model}
            options={VIDEO_MODEL_OPTIONS}
            onChange={(model) => { updateVideo({ model }) }}
          />
          <ComposerSelect
            label="比例"
            value={video.aspect}
            options={VIDEO_ASPECT_OPTIONS}
            onChange={(aspect) => { updateVideo({ aspect }) }}
          />
          <ComposerSelect
            label="时长"
            value={video.duration}
            options={VIDEO_DURATION_OPTIONS}
            onChange={(duration) => { updateVideo({ duration }) }}
          />
        </div>
      )}
    </div>
  )
}

/**
 * tab 组样式。选择器全部锚定自有 `dshDesktopComposerMedia` 命名空间，不触碰
 * 上游 css modules；颜色沿用上游 InputBar 工具行的 `--dsw-*` token（分段容器
 * 与 hover 底、主/次级文字），深浅主题自动跟随。select 芯片照抄上游
 * `.select` 的做法：appearance:none + 内联 chevron SVG。
 */
const COMPOSER_MEDIA_TABS_STYLES = `
.dshDesktopComposerMedia { display: flex; align-items: center; gap: 10px; min-width: 0; }
.dshDesktopComposerSeg {
  display: inline-flex; align-items: center; flex: none; padding: 2px;
  border-radius: 999px; background: var(--dsw-alias-interactive-bg-hover);
}
.dshDesktopComposerSegBtn {
  padding: 2px 10px; border: none; border-radius: 999px; background: transparent;
  color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px;
  line-height: 18px; font-weight: 500; white-space: nowrap; cursor: pointer;
}
.dshDesktopComposerSegBtn:hover { color: var(--dsw-alias-label-primary); }
.dshDesktopComposerSegBtn[data-active='true'] {
  background: var(--dsw-alias-button-info-fill); color: #fff; font-weight: 600;
}
.dshDesktopComposerParams { display: flex; align-items: center; gap: 6px; min-width: 0; }
.dshDesktopComposerField { display: inline-flex; align-items: center; gap: 2px; min-width: 0; }
.dshDesktopComposerFieldLabel {
  flex: none; color: var(--dsw-alias-label-secondary);
  font-size: 12px; line-height: 18px;
}
.dshDesktopComposerField select {
  max-width: 150px; height: 24px; padding: 0 18px 0 4px; border: none;
  border-radius: 6px; outline: none; background-color: transparent;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%2381858C' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 3px center;
  background-size: 12px 12px; color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 12px; line-height: 18px; font-weight: 500;
  white-space: nowrap; text-overflow: ellipsis; cursor: pointer; appearance: none;
}
.dshDesktopComposerField select:hover { background-color: var(--dsw-alias-interactive-bg-hover); }
.dshDesktopComposerField select:focus-visible { box-shadow: 0 0 0 1px var(--dsw-alias-button-info-fill); }
`

function installComposerMediaTabsStyles(): () => void {
  const style = document.createElement('style')
  style.dataset.plugin = 'dsh-plugin-desktop'
  style.dataset.pluginCss = 'dsh-plugin-desktop/composer-media-tabs'
  style.textContent = COMPOSER_MEDIA_TABS_STYLES
  document.head.appendChild(style)
  return () => { style.remove() }
}

/**
 * 注册桌面 composer 媒体模式 tab。`ctx.slots.inject` 的控制器归属调用方
 * fiber，插件卸载时随 apply fiber 自动级联注销（与 media-toolview /
 * hero-brand 一致）；全局样式经 ctx.effect 挂载并随 disposer 卸载。
 * @param ctx - 浏览器 Cordis 上下文。
 */
export function applyComposerMediaTabs(ctx: ClientContext): void {
  ctx.slots.inject('conversation.input.left', () => ctx.slots.register(
    { name: 'conversation.input.left', id: 'dsh-desktop-media-tabs', order: 100, label: '生成模式' },
    ComposerMediaTabs,
  ))
  ctx.effect(
    () => installComposerMediaTabsStyles(),
    'dsh-plugin-desktop: composer media tabs styles',
  )
}
