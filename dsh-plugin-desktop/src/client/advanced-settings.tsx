/**
 * 桌面自有高级设置对话框：把上游散落在 hero 与 composer 的两个会话级设置
 * 收进一个 Modal，入口是 composer 工具行（`conversation.input.left`）的
 * 「高级设置」图标按钮（lucide Settings2，aria-label/title 走 locale，
 * advanced / extended 外壳定制，compatibility 不接入）。
 *
 * 行为语义忠实复刻上游（用户要求「跟原来一样，只是收纳整理」）：
 *   - Agent 预设（上游 hero 的 Standard mode chip）：调
 *     `api.agentPresets.select`，仅 blank 会话可切换、立即生效；roster 经
 *     `api.agentPresets.list` 加载，默认值回落 isDefault ?? 首项（与上游
 *     ui-agent-preset seat-store 同一语义）。会话开始后锁定并提示。
 *   - 访问模式（上游 composer 的 Workspace Write 按钮）：经会话
 *     `/permission <id>` 命令切换，Full access 需 RiskConfirmation 勾选
 *     确认（文案复用上游 conversation locale 的 access.confirm.* 五键）。
 *     数据源 `useProjection('permissions')`，capability 缺席时整行隐藏。
 *
 * 上游控件遮蔽：
 *   - hero chip：`conversation.hero.agentPreset` 是 single slot，上游注册
 *     无显式 id（默认同 id）；桌面以 priority -1（lowest renders，同 id
 *     不同 priority 合法遮蔽）注册 null 条目替代其渲染。
 *   - composer 触发按钮：全局 CSS 按 aria-label 前缀隐藏（zh「访问模式，」
 *     / en「Access mode」双语锚定，locales.ts 'input.accessMode'）。
 *
 * `@deepseek-ai/dsh-client-ui-primitives` 值导入说明：ui-primitives 是上游
 * shell 的平台模块（platform.ts PLATFORM_MODULES 冻结进模块表），tsdown
 * client 构建将其列为 external，运行时 require 由 shell 载入的冻结模块表
 * 解析——桌面 bundle 不内联副本，与上游共享单一实例。
 *
 * 上游类型一律 type-only import，构建后擦除；组件 props 用本地结构视图。
 * type-only `import type {}` 仅拉类型面（slot / locale / projection
 * augment），配合 tsconfig.client.json 的 skipLibCheck（与 media-toolview
 * 相同的理由：上游该入口的声明把上游构建时才合并进场的 augment 引为约束）。
 *
 * @module dsh-plugin-desktop/client/advanced-settings
 */

import { useEffect, useState } from 'react'
import { Settings2 } from 'lucide-react'
import { Modal, RiskConfirmation } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ClientContext, ISessions, SessionId, UseProjection } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle, IApiClient } from '@deepseek-ai/dsh-api-remotes/client'
import type { PermissionSelect as PermissionSelectValue } from '@deepseek-ai/dsh-permission-presets/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'

/** 桌面高级设置 locale 命名空间。 */
export const DESKTOP_ADVANCED_LOCALE_NAMESPACE = 'desktop.advanced'

const zh = {
  open: '高级设置',
  title: '高级设置',
  close: '关闭',
  presetLabel: 'Agent 预设',
  presetStandard: '标准模式',
  presetCode: 'PTC 模式',
  presetMinimal: '极简模式',
  presetCordis: '创造模式',
  presetHint: '切换后对该会话立即生效；之后再开的新会话回到部署默认预设。',
  presetLocked: '会话已开始，所用预设在其启动时固定，不可切换。',
  presetEmpty: '当前部署未配置可选预设。',
  accessLabel: '访问模式',
  accessHint: '控制该会话中 Agent 的文件与命令访问级别。',
} as const

export type DesktopAdvancedLocaleKey = keyof typeof zh

const en: Record<DesktopAdvancedLocaleKey, string> = {
  open: 'Advanced settings',
  title: 'Advanced settings',
  close: 'Close',
  presetLabel: 'Agent preset',
  presetStandard: 'Standard mode',
  presetCode: 'PTC mode',
  presetMinimal: 'Minimal mode',
  presetCordis: 'Creator mode',
  presetHint: 'Applies to this session immediately; new sessions start from the deployment default again.',
  presetLocked: 'This session has started. The preset it began with is fixed and cannot be switched.',
  presetEmpty: 'This deployment does not compose any selectable presets.',
  accessLabel: 'Access mode',
  accessHint: 'Controls the file and command access level for the Agent in this session.',
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'desktop.advanced': DesktopAdvancedLocaleKey }
}

/** 内置 agent preset 的 locale 显示键（trust=system 且 id 命中时走文案）。 */
const BUILT_IN_PRESET_LABEL_KEYS: Record<string, DesktopAdvancedLocaleKey> = {
  standard: 'presetStandard',
  code: 'presetCode',
  minimal: 'presetMinimal',
  cordis: 'presetCordis',
}

/** agent preset 条目的本地结构视图（api.agentPresets.list 返回元素子集）。 */
interface PresetDisplay {
  id: string
  trust: string
  name?: string | undefined
}

/** preset 展示文案：内置系统预设走 locale，其余用部署配置名或 id。 */
function presetDisplayText(preset: PresetDisplay, t: TranslateNS<'desktop.advanced'>): string {
  const key = preset.trust === 'system' ? BUILT_IN_PRESET_LABEL_KEYS[preset.id] : undefined
  if (key !== undefined) return t(key)
  return preset.name ?? preset.id
}

/** 错误对象取消息（与上游 promptError 展示同思路）。 */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** 完全访问的机器名（与上游 PermissionSelect 同值）。 */
const FULL_ACCESS = 'danger-full-access'

/**
 * 展示变换：kebab-case 机器名渲染为 Title Case（workspace-write →
 * Workspace Write）；非 kebab 的部署配置名原样透传。完全访问固定覆盖为
 * 产品文案 Full access（与上游 PermissionSelect.displayName/optionLabel
 * 同语义）。
 */
function displayName(name: string): string {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) return name
  return name.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

function optionLabel(option: PermissionSelectValue['options'][number]): string {
  return option.value === FULL_ACCESS ? 'Full access' : displayName(option.name)
}

/** hero chip 遮蔽条目：渲染 null，让上游 priority 0 的 chip 被 priority -1 压住。 */
function NullSlotEntry(): null {
  return null
}

/** owner 传参的本地结构视图（框架注入 standard kit + locale + inject 工厂产物）。 */
interface AdvancedSettingsEntryProps {
  sessionId: SessionId
  useProjection: UseProjection
  t: TranslateNS<'desktop.advanced'>
  conversationT: TranslateNS<'conversation'>
  api: Pick<IApiClient, 'agentPresets'>
  sessions: Pick<ISessions, 'list' | 'noteAgentPreset' | 'binding'>
}

/**
 * 工具行触发按钮 + 条件挂载的对话框。open 时才挂载 dialog，其内部状态
 * （roster 加载、乐观 pick、确认勾选）每次打开自动复位。
 */
function AdvancedSettingsEntry(props: AdvancedSettingsEntryProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className="dshDesktopAdvancedTrigger"
        aria-label={props.t('open')}
        title={props.t('open')}
        onClick={() => { setOpen(true) }}
      >
        <Settings2 aria-hidden="true" />
      </button>
      {open && (
        <AdvancedSettingsDialog
          {...props}
          onClose={() => { setOpen(false) }}
        />
      )}
    </>
  )
}

interface AdvancedSettingsDialogProps extends AdvancedSettingsEntryProps {
  onClose: () => void
}

/**
 * 高级设置对话框主体：Agent 预设 select + 访问模式 select + 完全访问
 * 风险确认。presetError 行只承载预设链路失败；访问模式失败与上游一致
 * （静默恢复，不发 toast）。
 */
function AdvancedSettingsDialog(props: AdvancedSettingsDialogProps) {
  const { sessionId, useProjection, t, conversationT, api, sessions } = props

  // 会话是否仍为 blank（预设切换仅限会话启动前，与上游 seat-store 同语义）。
  // 模态打开期间 blank 不会翻转（用户必须先关闭对话框才能发送首条消息），
  // 读快照即可，不订阅。
  const sessionBlank = sessions.list.getSnapshot().byId[sessionId]?.blank ?? true

  // host 计算的访问模式投影（undefined = capability 缺席 → 整行隐藏）。
  const permissions = useProjection('permissions')

  const [presetOptions, setPresetOptions] = useState<Array<{ id: string; label: string }>>([])
  const [presetCurrent, setPresetCurrent] = useState<string | null>(null)
  const [presetFallback, setPresetFallback] = useState('')
  const [presetError, setPresetError] = useState<string | null>(null)
  const [presetBusy, setPresetBusy] = useState(false)
  const [permissionPick, setPermissionPick] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)

  // 挂载加载部署预设 roster（同一 API、同一 fallback，见上游 seat-store）。
  useEffect(() => {
    let cancelled = false
    api.agentPresets.list({}).then((response) => {
      if (cancelled) return
      if (!response.result.ok) {
        setPresetError(response.result.error.message)
        return
      }
      const presets = response.result.value.presets.filter((preset) => preset.broken === undefined)
      const fallback = presets.find((preset) => preset.isDefault)?.id ?? presets[0]?.id ?? ''
      setPresetOptions(presets.map((preset) => ({ id: preset.id, label: presetDisplayText(preset, t) })))
      setPresetFallback(fallback)
      setPresetCurrent(sessions.list.getSnapshot().byId[sessionId]?.agentPreset ?? fallback)
    }).catch((error: unknown) => {
      if (!cancelled) setPresetError(messageOf(error))
    })
    return () => { cancelled = true }
  }, [api, sessionId, sessions, t])

  /** 切换预设：blank 会话立即生效；失败回落部署默认并展示错误。 */
  const applyPreset = (id: string): void => {
    if (!sessionBlank || presetBusy || id === presetCurrent) return
    setPresetBusy(true)
    setPresetError(null)
    api.agentPresets.select({ sessionId, agentPreset: id }).then((response) => {
      if (!response.result.ok) throw new Error(response.result.error.message)
      const applied = response.result.value.agentPreset
      setPresetCurrent(applied)
      sessions.noteAgentPreset(sessionId, applied)
    }).catch((error: unknown) => {
      setPresetCurrent(presetFallback)
      setPresetError(messageOf(error))
    }).finally(() => { setPresetBusy(false) })
  }

  // 访问模式：乐观 pick（string id）与提交语义照抄上游 PermissionSelect。
  const permissionValue = permissionPick ?? permissions?.currentValue
  const accessOptions = permissions === undefined
    ? []
    : permissions.options.filter((option) => option.value !== 'custom')

  const commandPermission = (line: string): Promise<boolean> => {
    const session = sessions.binding(sessionId)?.session
    if (session === undefined) return Promise.resolve(false)
    return session.command(line).then((result) => result.ok && result.value.matched)
  }

  const submitPermission = (id: string): void => {
    setPermissionPick(id)
    void commandPermission(`/permission ${id}`)
      .catch(() => false)
      .then(() => { setPermissionPick(null) })
  }

  const choosePermission = (id: string): void => {
    if (id === permissions?.currentValue) return
    if (id === FULL_ACCESS) {
      setAcknowledged(false)
      setConfirmation(id)
      return
    }
    submitPermission(id)
  }

  const closeConfirmation = (): void => {
    setAcknowledged(false)
    setConfirmation(null)
  }

  const confirmFullAccess = (): void => {
    if (!acknowledged || confirmation === null) return
    const id = confirmation
    closeConfirmation()
    submitPermission(id)
  }

  return (
    <Modal
      open
      onClose={() => { if (confirmation === null) props.onClose() }}
      title={t('title')}
      closeLabel={t('close')}
    >
      <div className="dshDesktopAdvancedBody">
        <label className="dshDesktopAdvancedField">
          <span className="dshDesktopAdvancedFieldLabel">{t('presetLabel')}</span>
          <select
            value={presetCurrent ?? ''}
            disabled={!sessionBlank || presetBusy || presetOptions.length === 0}
            onChange={(event) => { applyPreset(event.target.value) }}
          >
            {presetOptions.length === 0
              ? <option value="">{t('presetEmpty')}</option>
              : presetOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
          </select>
          <span className="dshDesktopAdvancedHint">
            {sessionBlank ? t('presetHint') : t('presetLocked')}
          </span>
        </label>
        {presetError !== null && <p className="dshDesktopAdvancedError">{presetError}</p>}
        {permissions !== undefined && (
          <label className="dshDesktopAdvancedField">
            <span className="dshDesktopAdvancedFieldLabel">{t('accessLabel')}</span>
            <select
              value={permissionValue ?? ''}
              disabled={permissionPick !== null || confirmation !== null}
              onChange={(event) => { choosePermission(event.target.value) }}
            >
              {accessOptions.map((option) => (
                <option key={option.value} value={option.value}>{optionLabel(option)}</option>
              ))}
            </select>
            <span className="dshDesktopAdvancedHint">{t('accessHint')}</span>
          </label>
        )}
      </div>
      <RiskConfirmation
        open={confirmation !== null}
        title={conversationT('access.confirm.title')}
        description={conversationT('access.confirm.description')}
        acknowledgeLabel={conversationT('access.confirm.acknowledge')}
        cancelLabel={conversationT('access.confirm.cancel')}
        confirmLabel={conversationT('access.confirm.enable')}
        acknowledged={acknowledged}
        onAcknowledgedChange={setAcknowledged}
        onCancel={closeConfirmation}
        onConfirm={confirmFullAccess}
      />
    </Modal>
  )
}

/**
 * 样式。唯一的全局规则是隐藏上游 Workspace Write 触发按钮（aria-label
 * 前缀锚定，zh/en 双语）；其余全部锚定自有 `dshDesktopAdvanced*` 命名
 * 空间，不触碰上游 css modules。select 芯片沿用 composer 参数下拉的同一
 * 设计语言（appearance:none + 内联 chevron + `--dsw-*` token）。
 */
const ADVANCED_SETTINGS_STYLES = `
[aria-label^='访问模式'], [aria-label^='Access mode'] { display: none; }
.dshDesktopAdvancedTrigger {
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; padding: 0; border: none; border-radius: 7px;
  background: transparent; color: var(--dsw-alias-label-secondary);
  font: inherit; cursor: pointer;
}
.dshDesktopAdvancedTrigger svg { width: 14px; height: 14px; stroke-width: 1.8; }
.dshDesktopAdvancedTrigger:hover {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-interactive-bg-hover);
}
.dshDesktopAdvancedBody { display: flex; flex-direction: column; gap: 16px; }
.dshDesktopAdvancedField { display: flex; flex-direction: column; gap: 6px; }
.dshDesktopAdvancedFieldLabel {
  color: var(--dsw-alias-label-primary); font-size: 13px; line-height: 20px; font-weight: 500;
}
.dshDesktopAdvancedField select {
  width: 100%; box-sizing: border-box; height: 32px; padding: 0 30px 0 10px;
  border: none; border-radius: 8px; outline: none;
  background-color: var(--dsw-alias-interactive-bg-hover);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%2381858C' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 9px center;
  background-size: 12px 12px; color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 13px; line-height: 20px; font-weight: 500;
  cursor: pointer; appearance: none;
}
.dshDesktopAdvancedField select:disabled { opacity: 0.5; cursor: default; }
.dshDesktopAdvancedField select:focus-visible { box-shadow: 0 0 0 1px var(--dsw-alias-button-info-fill); }
.dshDesktopAdvancedHint { color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }
.dshDesktopAdvancedError { margin: 0; color: var(--dsw-alias-label-error); font-size: 12px; line-height: 18px; }
`

function installAdvancedSettingsStyles(): () => void {
  const style = document.createElement('style')
  style.dataset.plugin = 'dsh-plugin-desktop'
  style.dataset.pluginCss = 'dsh-plugin-desktop/advanced-settings'
  style.textContent = ADVANCED_SETTINGS_STYLES
  document.head.appendChild(style)
  return () => { style.remove() }
}

/**
 * 注册桌面高级设置对话框。`ctx.slots.inject` 的控制器归属调用方 fiber，
 * 插件卸载时随 apply fiber 自动级联注销（与 composer-media-tabs 一致）；
 * 全局样式与 locale 字典经 ctx.effect 挂载并随 disposer 卸载。
 * @param ctx - 浏览器 Cordis 上下文。
 */
export function applyAdvancedSettings(ctx: ClientContext): void {
  const api = (ctx.get('connection') as ConnectionHandle).api
  const sessions = ctx.sessions
  const t = ctx.locale.bind(DESKTOP_ADVANCED_LOCALE_NAMESPACE)
  const conversationT = ctx.locale.bind('conversation')
  ctx.effect(
    () => ctx.locale.register(DESKTOP_ADVANCED_LOCALE_NAMESPACE, { zh, en }),
    'dsh-plugin-desktop: advanced settings dictionaries',
  )
  ctx.effect(
    () => installAdvancedSettingsStyles(),
    'dsh-plugin-desktop: advanced settings styles',
  )
  // 遮蔽上游 hero 的 agent preset chip（single slot，同 id 不同 priority
  // 合法遮蔽；-1 = lowest renders）。
  ctx.slots.inject('conversation.hero.agentPreset', () => ctx.slots.register(
    { name: 'conversation.hero.agentPreset', priority: -1 },
    NullSlotEntry,
  ))
  ctx.slots.inject('conversation.input.left', () => ctx.slots.register(
    {
      name: 'conversation.input.left',
      id: 'dsh-desktop-advanced-settings',
      order: 110,
      label: () => t('open'),
      locale: DESKTOP_ADVANCED_LOCALE_NAMESPACE,
      inject: () => ({
        api,
        sessions,
        conversationT,
      }),
    },
    AdvancedSettingsEntry,
  ))
}
