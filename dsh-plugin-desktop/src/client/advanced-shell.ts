import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import type {} from './contracts.ts'
import type { DesktopClientEnvironment } from './environment.ts'
import { AdvancedFrame } from './AdvancedFrame.tsx'
import { DesktopLayoutState } from './layout-state.ts'
import { provideDesktopLayout } from './layout-service.ts'
import { installDesktopOwnedStyles } from './styles.ts'
import { ThreerouterAuthUI } from './threerouter-auth-ui.tsx'
import { ThreerouterSidebar } from './threerouter-sidebar.tsx'
import { DesktopThemePresenter } from './theme-presenter.ts'

const threerouterZh = {
  account: 'Threerouter 账户',
  close: '关闭',
  signInTitle: '登录 Threerouter 账号',
  signIn: '登录',
  signingIn: '登录中…',
  email: '邮箱',
  password: '密码',
  enterCredentials: '请输入邮箱和密码',
  createAccount: '注册账号',
  apiKeyHint: '登录后自动申请并配置 API Key，默认使用 deepseek-v4-pro 模型。',
  loggedInNotice: '已登录 Threerouter，API Key 已自动配置',
  accountBalance: '账户余额',
  apiKeyReady: 'API Key 已就绪',
  apiKeyNotCreated: 'API Key 未创建',
  quickModelSwitch: '快速切换模型',
  shareInviteLink: '分享邀请链接',
  signOut: '退出登录',
  inviteCopied: '分享链接已复制到剪贴板',
  openSessionFirst: '请先打开一个会话再切换模型',
} as const

type ThreerouterKey = keyof typeof threerouterZh

const threerouterEn = {
  account: 'Threerouter account',
  close: 'Close',
  signInTitle: 'Sign in to your Threerouter account',
  signIn: 'Sign in',
  signingIn: 'Signing in…',
  email: 'Email',
  password: 'Password',
  enterCredentials: 'Please enter your email and password.',
  createAccount: 'Create an account',
  apiKeyHint: 'Your API key is configured automatically after sign-in. The default model is deepseek-v4-pro.',
  loggedInNotice: 'Signed in to Threerouter. API key configured automatically.',
  accountBalance: 'Account balance',
  apiKeyReady: 'API key ready',
  apiKeyNotCreated: 'API key not created',
  quickModelSwitch: 'Quick model switch',
  shareInviteLink: 'Share invite link',
  signOut: 'Sign out',
  inviteCopied: 'Invite link copied to clipboard',
  openSessionFirst: 'Please open a session before switching models',
} satisfies Record<ThreerouterKey, string>

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    threerouter: ThreerouterKey
  }
}

/**
 * Provide the advanced layout service and own the desktop root slot.
 * @param ctx - active browser Cordis context.
 * @param environment - validated mode and platform marker.
 */
export function applyAdvancedShell(ctx: ClientContext, environment: DesktopClientEnvironment): void {
  if (environment.mode !== 'advanced') {
    throw new Error(`dsh-plugin-desktop: advanced shell received mode ${JSON.stringify(environment.mode)}`)
  }

  const desktopLayout = new DesktopLayoutState()
  ctx.effect(
    () => provideDesktopLayout(ctx, desktopLayout),
    'desktop: layout service',
  )

  ctx.effect(() => {
    document.body.dataset.dshDesktopMode = 'advanced'
    document.body.dataset.dshDesktopPlatform = environment.platform
    document.body.dataset.dshDesktopMaterial = environment.material
    const removeStyles = installDesktopOwnedStyles()
    return () => {
      removeStyles()
      delete document.body.dataset.dshDesktopMode
      delete document.body.dataset.dshDesktopPlatform
      delete document.body.dataset.dshDesktopMaterial
    }
  }, 'desktop: advanced shell styles')

  ctx.effect(() => {
    const presenter = new DesktopThemePresenter()
    presenter.apply(ctx.theme.getTheme())
    const off = ctx.on('theme/change', snapshot => { presenter.apply(snapshot) })
    return () => {
      off()
      presenter.dispose()
    }
  }, 'desktop: theme presenter')

  ctx.effect(() => ctx.slots.register({
    name: 'root',
    children: {
      'sidebar': { kind: 'single', scope: 'root' },
      'conversation': { kind: 'single', scope: 'session-maybe' },
      'details': { kind: 'single', scope: 'session' },
      'shell.overlay': { kind: 'list', scope: 'root' },
    },
    inject: () => ({ layout: desktopLayout, platform: environment.platform, windowTitle: environment.windowTitle }),
  }, AdvancedFrame), 'desktop: advanced root slot')

  // Threerouter-branded sidebar (replaces upstream SidebarRoot).
  // Priority -1 shadows the upstream priority 0 registration (lowest renders).
  // Children slots are NOT re-declared — the upstream plugin owns those; we
  // only consume them via renderSlot().
  ctx.effect(() => {
    const injectProps = () => ({
      startSession: (workspaceId?: string) => { (ctx.workspaces as any).startSession(workspaceId) },
      toggleSidebar: () => { ctx.layout.toggleSidebar() },
      version: environment.version,
    })
    return (ctx.slots.register as any)({
      name: 'sidebar',
      priority: -1,
      locale: 'sidebar',
      inject: injectProps,
    }, ThreerouterSidebar)
  }, 'desktop: threerouter sidebar')

  ctx.effect(() => {
    const disposeLocale = ctx.locale.register('threerouter', { zh: threerouterZh, en: threerouterEn })
    const disposeSlot = ctx.slots.register({
      name: 'shell.overlay',
      id: 'threerouter-auth-ui',
      locale: 'threerouter',
      inject: () => ({
        connection: ctx.get('connection')!,
        sessions: ctx.get('sessions')!,
        platform: environment.platform,
        version: environment.version,
      }),
    }, ThreerouterAuthUI)
    return () => {
      disposeSlot()
      disposeLocale()
    }
  }, 'desktop: threerouter auth UI')
}