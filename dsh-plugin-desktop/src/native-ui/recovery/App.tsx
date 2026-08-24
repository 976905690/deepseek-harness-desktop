import {
  AlertTriangle, Archive, CheckCircle2, FilePenLine, FolderOpen, History, LifeBuoy,
  PackageX, Plug, Plus, Power, RefreshCw, RotateCcw, Stethoscope, Terminal, Undo2, Users,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert.tsx'
import { buttonVariants } from '../components/ui/button.tsx'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card.tsx'
import { ScrollArea } from '../components/ui/scroll-area.tsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs.tsx'
import { cn } from '../lib/utils.ts'
import { DesktopFrame } from '../shared/DesktopFrame.tsx'

const SCHEME = 'dsh-recovery:'
type Locale = 'en' | 'zh'
type RecoveryTab = 'plugins' | 'rollback' | 'profiles' | 'diagnostics'
type FailureStage = 'electron-ready' | 'shell-environment' | 'runtime-bootstrap' | 'profile-selection' | 'install-recovery' | 'profile-composition' | 'host-boot' | 'renderer-startup' | 'health-commit'

interface RecoveryBundle { readonly bundleId: string; readonly packageName: string; readonly status: 'active' | 'disabled'; readonly owner: 'core' | 'managed' | 'external'; readonly action: 'disable' | null }
interface RecoveryInstall { readonly recoveryId: string; readonly packageName: string; readonly packageVersion: string; readonly rollbackAvailable: boolean; readonly retryAvailable: boolean }
interface RecoverySnapshot { readonly profileName: string; readonly bundles: readonly RecoveryBundle[]; readonly pendingInstall?: RecoveryInstall }
interface RecoveryNotice { readonly tone: 'info' | 'success' | 'warning' | 'error'; readonly title: string; readonly body: string }
interface RecoveryProfile { readonly name: string; readonly current: boolean; readonly selectable: boolean }
interface RecoveryState {
  readonly locale: Locale
  readonly failureStage: FailureStage
  readonly failureDetail: string
  readonly requested?: boolean
  readonly snapshot?: RecoverySnapshot
  readonly snapshotError?: string
  readonly diagnostics: { readonly status: 'saving' | 'saved' | 'failed'; readonly filename?: string }
  readonly notice?: RecoveryNotice
  readonly busy: boolean
  readonly restartReady: boolean
  readonly activeTab: RecoveryTab
  readonly configurationAvailable: boolean
  readonly profiles?: readonly RecoveryProfile[]
  readonly profileActionToken?: string
  readonly terminalAvailable?: boolean
  readonly profileCreatorAvailable?: boolean
  readonly rollbackLastKnownGoodAvailable?: boolean
}

interface Copy {
  readonly title: string; readonly subtitle: string; readonly reason: string; readonly requestedMode: string; readonly requestedBody: string
  readonly currentProfile: string; readonly failureStage: string; readonly stageLabels: Readonly<Record<FailureStage, string>>; readonly tabs: Readonly<Record<RecoveryTab, string>>
  readonly recentInstall: string; readonly noProtectedInstall: string; readonly rollbackBody: string; readonly rollback: string; readonly retry: string; readonly retryBody: string
  readonly restoreLastSuccessful: string; readonly restoreLastSuccessfulBody: string; readonly plugins: string; readonly pluginsBody: string; readonly pluginsUnavailable: string
  readonly core: string; readonly managed: string; readonly external: string; readonly disabled: string; readonly disable: string
  readonly diagnostics: string; readonly savingDiagnostics: string; readonly diagnosticsSaved: string; readonly diagnosticsFailed: string; readonly saveDiagnostics: string; readonly showDiagnostics: string; readonly privacy: string
  readonly manualConfiguration: string; readonly manualConfigurationBody: string; readonly openSettingsDocument: string; readonly openProfilePatch: string; readonly openProfileManifest: string; readonly openProfileDirectory: string
  readonly profiles: string; readonly profilesBody: string; readonly profilesUnavailable: string; readonly switchProfile: string; readonly addProfile: string; readonly openTerminal: string
  readonly restart: string; readonly quit: string; readonly working: string
}

const COPY: Record<Locale, Copy> = {
  en: {
    title: 'DSH Desktop Recovery', subtitle: 'Inspect the startup reason, then choose one focused recovery workflow.', reason: 'Why Recovery opened', requestedMode: 'Opened from the restart menu', requestedBody: 'Ordinary startup is paused before the active Profile and plugin Host load.', currentProfile: 'Current Profile', failureStage: 'Failure stage',
    stageLabels: { 'electron-ready': 'Electron initialization', 'shell-environment': 'Shell environment', 'runtime-bootstrap': 'Desktop runtime preparation', 'profile-selection': 'Profile selection', 'install-recovery': 'Protected installation recovery', 'profile-composition': 'Plugin Profile composition', 'host-boot': 'Plugin Host startup', 'renderer-startup': 'Desktop interface startup', 'health-commit': 'Startup health confirmation' },
    tabs: { plugins: 'Plugin management', rollback: 'Rollback', profiles: 'Switch Profile', diagnostics: 'Diagnostics' }, recentInstall: 'Protected installation', noProtectedInstall: 'There is no protected installation waiting for rollback or retry.', rollbackBody: 'Restore the protected Profile files to their pre-install state. Plugin dependencies are synchronized separately.', rollback: 'Restore pre-install state', retry: 'Retry once', retryBody: 'Authorize one startup verification with the current installation. Another failure returns to Recovery.', restoreLastSuccessful: 'Restore last successful Profile', restoreLastSuccessfulBody: 'Restore the last healthy Profile selection and its latest successful configuration snapshot.', plugins: 'Plugin loading', pluginsBody: 'Disable a mutable plugin for the next start without uninstalling its files.', pluginsUnavailable: 'Plugin inventory is unavailable for this startup stage.', core: 'Built in', managed: 'Installed by Plugin Market', external: 'Installed another way', disabled: 'Disabled', disable: 'Disable', diagnostics: 'Diagnostic archive', savingDiagnostics: 'Saving a local diagnostic archive…', diagnosticsSaved: 'Diagnostics were saved locally and are never uploaded automatically.', diagnosticsFailed: 'Diagnostics could not be saved. You can retry the export.', saveDiagnostics: 'Export diagnostics', showDiagnostics: 'Show in folder', privacy: 'Archives may contain local paths, logs, system information, and crash-memory fragments. Review them before sharing.', manualConfiguration: 'Configuration files', manualConfigurationBody: 'Open only the active Profile paths validated by DSH Desktop.', openSettingsDocument: 'Open settings', openProfilePatch: 'Edit patch', openProfileManifest: 'Edit manifest', openProfileDirectory: 'Open folder', profiles: 'Available Profiles', profilesBody: 'Select another healthy Web Profile or create one before the plugin Host starts.', profilesUnavailable: 'Profile switching is unavailable for this startup stage.', switchProfile: 'Switch', addProfile: 'Add Profile', openTerminal: 'Open DSH Terminal', restart: 'Restart DSH Desktop', quit: 'Quit', working: 'Applying the recovery action…',
  },
  zh: {
    title: 'DSH Desktop 恢复助手', subtitle: '先确认进入恢复模式的原因，再选择一个明确的恢复流程。', reason: '进入恢复模式的原因', requestedMode: '从重启菜单主动进入', requestedBody: '普通启动已暂停，当前 Profile 和插件 Host 尚未加载。', currentProfile: '当前 Profile', failureStage: '失败阶段',
    stageLabels: { 'electron-ready': 'Electron 初始化', 'shell-environment': 'Shell 环境恢复', 'runtime-bootstrap': '桌面运行时准备', 'profile-selection': 'Profile 选择', 'install-recovery': '受保护安装恢复', 'profile-composition': '插件 Profile 组合', 'host-boot': '插件 Host 启动', 'renderer-startup': '桌面界面启动', 'health-commit': '启动健康状态确认' },
    tabs: { plugins: '插件管理', rollback: '回滚', profiles: '切换配置', diagnostics: '诊断' }, recentInstall: '受保护安装', noProtectedInstall: '当前没有等待回滚或重试的受保护安装。', rollbackBody: '把受保护的 Profile 文件恢复到安装前状态；插件依赖会单独重新同步。', rollback: '恢复安装前状态', retry: '仅重试一次', retryBody: '使用当前安装状态授权一次启动验证；如果仍然失败，会再次进入恢复模式。', restoreLastSuccessful: '恢复上次成功启动的 Profile', restoreLastSuccessfulBody: '恢复上次健康的 Profile 选择及其最近一次成功配置快照。', plugins: '插件加载', pluginsBody: '下次启动时跳过可管理插件，但不卸载其文件。', pluginsUnavailable: '当前启动阶段无法读取插件清单。', core: '内置组件', managed: '通过插件市场安装', external: '通过其他方式安装', disabled: '已禁用', disable: '禁用', diagnostics: '诊断包', savingDiagnostics: '正在保存本地诊断包…', diagnosticsSaved: '诊断信息已保存在本地，不会自动上传。', diagnosticsFailed: '无法保存诊断信息，可以重新尝试导出。', saveDiagnostics: '导出诊断', showDiagnostics: '在文件夹中显示', privacy: '诊断包可能包含本地路径、日志、系统信息和崩溃内存片段，分享前请先检查。', manualConfiguration: '配置文件', manualConfigurationBody: '只打开由 DSH Desktop 验证过的当前 Profile 路径。', openSettingsDocument: '打开设置', openProfilePatch: '编辑补丁', openProfileManifest: '编辑清单', openProfileDirectory: '打开目录', profiles: '可用 Profile', profilesBody: '在插件 Host 启动前切换到其他健康 Web Profile，或创建一个新 Profile。', profilesUnavailable: '当前启动阶段无法切换 Profile。', switchProfile: '切换', addProfile: '新增 Profile', openTerminal: '打开 DSH 终端', restart: '重新启动 DSH Desktop', quit: '退出', working: '正在执行恢复操作…',
  },
}

function decodeState(): RecoveryState | undefined {
  const encoded = new URLSearchParams(window.location.search).get('state')
  if (encoded === null || encoded.length > 512_000) return undefined
  try {
    const normalized = encoded.replaceAll('-', '+').replaceAll('_', '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const value: unknown = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), character => character.charCodeAt(0))))
    if (value !== null && typeof value === 'object') return value as RecoveryState
  } catch { /* Render the bounded fallback below. */ }
  return undefined
}
function href(action: string, id?: string, name?: string): string { const url = new URL(`${SCHEME}//${action}`); if (id !== undefined) url.searchParams.set('id', id); if (name !== undefined) url.searchParams.set('name', name); return url.href }
function Action({ action, children, className, icon, id, name, variant = 'outline' }: { readonly action: string; readonly children: ReactNode; readonly className?: string; readonly icon?: ReactNode; readonly id?: string; readonly name?: string; readonly variant?: 'default' | 'outline' | 'secondary' | 'destructive' }): JSX.Element { return <a className={cn(buttonVariants({ variant }), className)} href={href(action, id, name)}>{icon}{children}</a> }
function Notice({ notice }: { readonly notice: RecoveryNotice }): JSX.Element { return <Alert className={cn(notice.tone === 'success' && 'border-emerald-500/50', notice.tone === 'warning' && 'border-amber-500/60')} variant={notice.tone === 'error' ? 'destructive' : 'default'}>{notice.tone === 'success' ? <CheckCircle2 /> : <AlertTriangle />}<AlertTitle>{notice.title}</AlertTitle><AlertDescription>{notice.body}</AlertDescription></Alert> }
function PanelScroll({ children }: { readonly children: ReactNode }): JSX.Element { return <ScrollArea className="h-full pr-3"><div className="space-y-4 pb-2 pt-4">{children}</div></ScrollArea> }

function PluginsPanel({ copy, state }: { readonly copy: Copy; readonly state: RecoveryState }): JSX.Element {
  if (state.snapshot === undefined) return <PanelScroll><Alert variant="destructive"><AlertTriangle /><AlertTitle>{copy.plugins}</AlertTitle><AlertDescription>{state.snapshotError ?? copy.pluginsUnavailable}</AlertDescription></Alert></PanelScroll>
  return <PanelScroll><Card><CardHeader><CardTitle>{copy.plugins}</CardTitle><CardDescription>{copy.pluginsBody}</CardDescription></CardHeader><CardContent className="divide-y p-0">{state.snapshot.bundles.map(bundle => <div className="flex items-center justify-between gap-4 px-6 py-3" key={bundle.bundleId}><div className="min-w-0"><p className="truncate text-sm font-medium">{bundle.packageName}</p><p className="text-xs text-muted-foreground">{bundle.owner === 'core' ? copy.core : bundle.owner === 'managed' ? copy.managed : copy.external}</p></div><div className="flex shrink-0 items-center gap-2">{bundle.status === 'disabled' ? <span className="rounded-full bg-muted px-2 py-1 text-xs">{copy.disabled}</span> : null}{bundle.action === 'disable' ? <Action action="preview-disable" icon={<PackageX />} id={bundle.bundleId} variant="destructive">{copy.disable}</Action> : null}</div></div>)}</CardContent></Card></PanelScroll>
}
function RollbackPanel({ copy, state }: { readonly copy: Copy; readonly state: RecoveryState }): JSX.Element {
  const pending = state.snapshot?.pendingInstall
  return <PanelScroll><Card><CardHeader><CardTitle>{copy.recentInstall}</CardTitle><CardDescription>{pending === undefined ? copy.noProtectedInstall : `${pending.packageName}@${pending.packageVersion}`}</CardDescription></CardHeader>{pending === undefined ? null : <><CardContent className="space-y-2"><p className="text-sm text-muted-foreground">{copy.rollbackBody}</p>{pending.retryAvailable ? <p className="text-sm text-muted-foreground">{copy.retryBody}</p> : null}</CardContent><CardFooter className="flex-wrap justify-end gap-2">{pending.rollbackAvailable ? <Action action="preview-rollback" icon={<Undo2 />} id={pending.recoveryId} variant="default">{copy.rollback}</Action> : null}{pending.retryAvailable ? <Action action="preview-retry" icon={<RefreshCw />} id={pending.recoveryId}>{copy.retry}</Action> : null}</CardFooter></>}</Card>{state.rollbackLastKnownGoodAvailable && state.profileActionToken !== undefined ? <Card><CardHeader><CardTitle>{copy.restoreLastSuccessful}</CardTitle><CardDescription>{copy.restoreLastSuccessfulBody}</CardDescription></CardHeader><CardFooter className="justify-end pt-6"><Action action="rollback-last-known-good" icon={<RotateCcw />} id={state.profileActionToken} variant="default">{copy.restoreLastSuccessful}</Action></CardFooter></Card> : null}</PanelScroll>
}
function ProfilesPanel({ copy, state }: { readonly copy: Copy; readonly state: RecoveryState }): JSX.Element {
  if (state.profiles === undefined) return <PanelScroll><Alert variant="destructive"><AlertTriangle /><AlertTitle>{copy.profiles}</AlertTitle><AlertDescription>{copy.profilesUnavailable}</AlertDescription></Alert></PanelScroll>
  return <PanelScroll><Card><CardHeader><CardTitle>{copy.profiles}</CardTitle><CardDescription>{copy.profilesBody}</CardDescription></CardHeader><CardContent className="divide-y p-0">{state.profiles.map(profile => <div className="flex items-center justify-between gap-4 px-6 py-3" key={profile.name}><span className="min-w-0 truncate text-sm font-medium">{profile.name}</span>{profile.current ? <span className="rounded-full bg-muted px-2 py-1 text-xs">{copy.currentProfile}</span> : profile.selectable && state.profileActionToken !== undefined ? <Action action="switch-profile" id={state.profileActionToken} name={profile.name}>{copy.switchProfile}</Action> : null}</div>)}</CardContent>{state.profileCreatorAvailable ? <CardFooter className="justify-end pt-6"><Action action="open-profile-creator" icon={<Plus />}>{copy.addProfile}</Action></CardFooter> : null}</Card></PanelScroll>
}
function DiagnosticsPanel({ copy, state }: { readonly copy: Copy; readonly state: RecoveryState }): JSX.Element {
  return <PanelScroll><Card><CardHeader><CardTitle>{copy.diagnostics}</CardTitle><CardDescription>{state.diagnostics.status === 'saving' ? copy.savingDiagnostics : state.diagnostics.status === 'saved' ? copy.diagnosticsSaved : copy.diagnosticsFailed}</CardDescription></CardHeader><CardContent className="space-y-2">{state.diagnostics.filename === undefined ? null : <code className="block break-all rounded-lg bg-muted p-3 text-xs">{state.diagnostics.filename}</code>}<p className="text-xs text-muted-foreground">{copy.privacy}</p></CardContent><CardFooter className="flex-wrap justify-end gap-2"><Action action={state.diagnostics.status === 'saved' ? 'show-diagnostics' : 'export-diagnostics'} icon={<Archive />}>{state.diagnostics.status === 'saved' ? copy.showDiagnostics : copy.saveDiagnostics}</Action>{state.terminalAvailable ? <Action action="open-terminal" icon={<Terminal />}>{copy.openTerminal}</Action> : null}</CardFooter></Card>{state.configurationAvailable ? <Card><CardHeader><CardTitle>{copy.manualConfiguration}</CardTitle><CardDescription>{copy.manualConfigurationBody}</CardDescription></CardHeader><CardFooter className="flex-wrap gap-2 pt-6"><Action action="open-settings-document" icon={<FilePenLine />}>{copy.openSettingsDocument}</Action><Action action="open-profile-patch" icon={<FilePenLine />}>{copy.openProfilePatch}</Action><Action action="open-profile-manifest" icon={<FilePenLine />}>{copy.openProfileManifest}</Action><Action action="open-profile-directory" icon={<FolderOpen />}>{copy.openProfileDirectory}</Action></CardFooter></Card> : null}</PanelScroll>
}
function Reason({ copy, state }: { readonly copy: Copy; readonly state: RecoveryState }): JSX.Element {
  return <Card className={cn('shrink-0', state.requested === true ? 'border-border' : 'border-amber-500/50')}><CardContent className="flex gap-4 p-4"><div className="mt-0.5 shrink-0">{state.requested === true ? <LifeBuoy className="size-5 text-muted-foreground" /> : <AlertTriangle className="size-5 text-amber-500" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><h2 className="text-sm font-semibold">{copy.reason}</h2>{state.snapshot === undefined ? null : <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">{copy.currentProfile}: {state.snapshot.profileName}</span>}</div>{state.requested === true ? <><p className="mt-1 text-sm font-medium">{copy.requestedMode}</p><p className="mt-1 text-sm text-muted-foreground">{copy.requestedBody}</p></> : <><p className="mt-1 text-xs text-muted-foreground">{copy.failureStage}: {copy.stageLabels[state.failureStage]}</p><pre className="mt-2 max-h-20 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-2.5 text-xs leading-relaxed">{state.failureDetail}</pre></>}</div></CardContent></Card>
}

export function RecoveryApp(): JSX.Element {
  const state = decodeState()
  if (state === undefined) return <><DesktopFrame /><main className="dshNativeContent flex h-screen items-center justify-center p-6"><Alert variant="destructive"><AlertTriangle /><AlertTitle>DSH Desktop Recovery</AlertTitle><AlertDescription>The recovery state could not be read. Quit and start DSH Desktop again.</AlertDescription></Alert></main></>
  const copy = COPY[state.locale]
  return <><DesktopFrame /><main className={cn('dshNativeContent h-screen overflow-hidden p-5 sm:p-6', state.busy && 'pointer-events-none opacity-70')}><div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-4"><header className="shrink-0"><h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1><p className="mt-1 text-sm text-muted-foreground">{copy.subtitle}</p></header><Reason copy={copy} state={state} />{state.notice === undefined ? null : <Notice notice={state.notice} />}<Tabs defaultValue={state.activeTab}><TabsList className="w-full justify-start overflow-x-auto"><TabsTrigger value="plugins"><Plug />{copy.tabs.plugins}</TabsTrigger><TabsTrigger value="rollback"><History />{copy.tabs.rollback}</TabsTrigger><TabsTrigger value="profiles"><Users />{copy.tabs.profiles}</TabsTrigger><TabsTrigger value="diagnostics"><Stethoscope />{copy.tabs.diagnostics}</TabsTrigger></TabsList><TabsContent value="plugins"><PluginsPanel copy={copy} state={state} /></TabsContent><TabsContent value="rollback"><RollbackPanel copy={copy} state={state} /></TabsContent><TabsContent value="profiles"><ProfilesPanel copy={copy} state={state} /></TabsContent><TabsContent value="diagnostics"><DiagnosticsPanel copy={copy} state={state} /></TabsContent></Tabs><footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t pt-4">{state.busy ? <span className="mr-auto inline-flex items-center gap-2 text-sm text-muted-foreground"><RefreshCw className="size-4 animate-spin" />{copy.working}</span> : null}{state.restartReady || state.snapshot?.pendingInstall === undefined ? <Action action="restart" icon={<RotateCcw />} variant={state.restartReady ? 'default' : 'outline'}>{copy.restart}</Action> : null}<Action action="quit" icon={<Power />}>{copy.quit}</Action></footer></div></main></>
}
