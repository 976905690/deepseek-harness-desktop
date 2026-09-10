/**
 * 桌面自有 hero 品牌区：blank-session 首屏标题与 logo 替换（advanced/extended）。
 *
 * 上游 hero 标题 "Into the Unknown"（t('hero.headline')）与 Preview 徽章
 * （t('hero.preview')）由 HeroShell 硬编码渲染，没有 slot；locale runtime
 * 对重复 (ns, locale) 注册会抛错（conversation 命名空间已被上游占用），
 * 因此文案无法经 locale 替换。方案：
 *
 * 1. 注册 `conversation.hero.brand.mark`（上游仅提供 fallback 鱼 logo、自身
 *    未注册，single slot 桌面注册一次合法），渲染「DeepSeek 鱼 + Threerouter
 *    品牌块 + 桌面标题」整行，替代 fallback；
 * 2. 全局 CSS 隐藏上游 `_headlineText` / `_previewBadge`，并把 headline 的
 *    三列 grid（34px/auto/auto）收为单 auto 列，让品牌行自然撑开。类名用
 *    后缀匹配锚定，依赖上游 css modules 编译契约 `[hash]_[local]`（
 *    tsdown.client.ts lightningcss pattern，local 名保留在后）；`:has` 限定
 *    含 `_fishHitbox` 的 headline，避免误伤 ContextMeter / ApprovalPanel
 *    的同名 headline 类。
 *
 * 两段 logo 均内联：DeepSeek 鱼从上游 ui-primitives FishLogo.tsx 原样抄录；
 * Threerouter logo 用 dsh-plugin-threerouter/src/assets/logo.webp 的 base64
 * data URI（60×60 官方品牌图）。不做跨包引用：`@deepseek-ai/*` 跨包值导入
 * 需登记在 tsdown external 并由 shell 模块表解析（ui-primitives 即平台
 * 模块，见 platform.ts PLATFORM_MODULES）；跨包引用 dsh-plugin-threerouter
 * 会连带整个 client 插件入口。上游类型一律 type-only import，构建后擦除，
 * 不进 client bundle。
 *
 * 仅在 advanced / extended 桌面外壳接入；compatibility 模式保持上游默认
 * 客户端（无桌面覆盖）。
 *
 * @module dsh-plugin-desktop/client/hero-brand
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// 仅拉类型面（'conversation.hero.brand.mark' slot augment），不导入具名类型；
// 配合 tsconfig.client.json 的 skipLibCheck（与 media-toolview 相同的理由）。
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'

/** 桌面品牌标题（替换上游 hero.headline / hero.preview 文案）。 */
const HERO_TITLE = 'Deepseek Harness for Threerouter image/video'

/**
 * Threerouter 官方 logo（dsh-plugin-threerouter/src/assets/logo.webp，
 * 60×60）的 base64 data URI。经 [Convert]::ToBase64String 与源文件逐字节
 * 核对；内联避免跨包引用（理由见文件头注释）。
 */
const THREEROUTER_LOGO_DATA_URI =
  'data:image/webp;base64,UklGRtYDAABXRUJQVlA4IMoDAABwEwCdASo8ADwAPpE6mUoloyIhqhZroLASCWwAuzMExaeq+bHVP8N+CeCsMNXm9S22T8wHnGejPzquo+9AD9gOt1fcZlveQ8PtDTOu8SXiPmoJMF6hMDkbUsRd6ISE0AtUPNwDauzRJ+mDpnFk3rrY4pxSrDaP3zlKLwM01O/PvX+kYW/NwUnDg1gLTRRaZYwiBLqE6PLrkmaCTYwn2/eXXK7YAAD+/qsPy7lPm3kbvBEvXMhBrT9LESGXmuHKN9DdNL8R6LM9k7tJVtJKs76e1xF83UycdH8mpjrXs1ToihpgwbHtwA7AFratV31a3kHRKYkNQzs69otRVsj+t7i9hXfbWGxwBqd4G5zIA6C3SDGHL3InC4Xo78Bi11PlJYC7tsb5wofqp8KFBx4kuZPjApuR7o9HaHNvng7P1ShL6lc4A+ZPC8pfqqql5HCoYj5e6KG1/xgSR5j0e5P822wdIE3L8qIWMED35k75Mq7l+t0dKliyg+MtvS21tRoI7gIXiqEy7B40i5pVIu/qP/8j6UmlHiK9uQvxyByl/svY9tueRVMJrYm5rez8L8wt9fol4FFDv8mEz2+Ln7NzFfP/Wm04LmJHF+6sx9QlEQiJCl8BIvCV/6EIO5/g5ScrXtSdAMNcYt0DnQIgCMznPCCrzab0efi6hAU3EV/pAAGE/JeLQMtkeNK+Dvst3uzf9xaIn8ZHY4AXQEUM0bTQZixWWG0eVQUZbmyObmd6xwH3/8+bK8qjmvBchOWKWTt0e6DPXS58AfE+gTRWW5y02W/OmkUXWOnPTcmXZRqgYdTjM0kp3fMl0d/Mw5mcjTSJdKv1RRqvq6Dtb3+zqWiIJc5AQ2TyHqr/HLwgTusOcMciI1SkQm4lWs+1VijW0FwM6xOwkSAnNYvBqvkyvgv6iJmMGYnIZaN72ujrhHVt3IYR30yqo/zwloUpF28hE7WTXLTSNZ0f86PeEgRbbZf1HN/wLeS2FrRg6gjk7rGLIkrz7FD7S7ygkW8w4hk989ZUZ1hJIOyHtcRnZaVjNLI7mAE63yNsD1+tcVC8dgp626bXQ/XoM0o+5zF1IuPu/Fd1YZK3csl2RQgfnAGYo1XhONVR2wAyrKAbJwoYHoSvrBSl2WScC/B7Nf+XCXHGkX1h8qHp5VSUimMjgIOU/eD5ISpji8B0lHuApRjcN/dWepmsZuoJRN+3qO7JrwrBTDjeQeXDckKu0We/DJ7sZAagWyxcYRZFjPFlYheRd32JyETf0HezMlqwL9mqNm5aiWCGaxWVBMUVJSyMQAAA'

/** owner 传参的本地结构视图（HeroBrandMarkOwnerProps），避免具名类型依赖。 */
interface HeroBrandProps {
  size?: number | undefined
  className?: string | undefined
}

/**
 * DeepSeek 鱼 logo：从上游 ui-primitives FishLogo.tsx 原样内联（figma
 * fillGeometry 精确提取的单条 path，native 23.16x17.04）。fill 沿用
 * currentColor，继承上游 `.headline` 墨色；className 透传上游 `css.fish`，
 * 保留 `.fishHitbox:hover` 的游动动画。
 */
function DeepseekWhaleMark({ size, className }: { size: number; className?: string | undefined }) {
  return (
    <svg
      width={size}
      height={(size * 17.04) / 23.16}
      className={className}
      viewBox="0 0 23.16 17.04"
      fill="none"
      aria-hidden="true"
    >
      <path d="M22.9168 1.43018C22.6713 1.31018 22.5658 1.53918 22.4223 1.65519C22.3733 1.69269 22.3318 1.74169 22.2903 1.78669C21.9317 2.1697 21.5127 2.42121 20.9657 2.39121C20.1657 2.34621 19.4827 2.59771 18.8787 3.20973C18.7502 2.45521 18.3236 2.0047 17.6746 1.71569C17.3351 1.56568 16.9916 1.41518 16.7536 1.08867C16.5876 0.856163 16.5421 0.597155 16.4591 0.341647C16.4061 0.187643 16.3536 0.0301382 16.1761 0.00363739C15.9836 -0.0263635 15.9081 0.135141 15.8326 0.270145C15.5306 0.822162 15.4136 1.43018 15.4251 2.0462C15.4516 3.43174 16.0366 4.53527 17.1991 5.3203C17.3311 5.4103 17.3651 5.5003 17.3236 5.63181C17.2441 5.90231 17.1501 6.16482 17.0671 6.43533C17.0141 6.60784 16.9351 6.64584 16.7501 6.57033C16.1121 6.30383 15.5611 5.90931 15.074 5.4328C14.2475 4.63328 13.5 3.75075 12.568 3.05973C12.349 2.89822 12.13 2.74822 11.9034 2.60522C10.9524 1.68169 12.028 0.923165 12.277 0.833162C12.5375 0.739159 12.3675 0.41615 11.5259 0.42015C10.6844 0.42365 9.91439 0.705658 8.93286 1.08117C8.78935 1.13767 8.63835 1.17867 8.48384 1.21267C7.59332 1.04367 6.66829 1.00617 5.70226 1.11517C3.88321 1.31768 2.43016 2.1777 1.36213 3.64575C0.0790928 5.4103 -0.222916 7.41536 0.146595 9.50642C0.535106 11.7105 1.66014 13.535 3.38869 14.9616C5.18125 16.4406 7.24581 17.1657 9.60138 17.0266C11.0319 16.9441 12.6245 16.7526 14.421 15.2321C14.874 15.4576 15.3496 15.5476 16.1381 15.6151C16.7456 15.6716 17.3306 15.5851 17.7836 15.4911C18.4931 15.3411 18.4441 14.6841 18.1876 14.5636C16.1081 13.595 16.5646 13.9891 16.1496 13.67C17.2061 12.42 18.8202 10.1979 19.3182 7.17235C19.3672 6.83834 19.4297 6.36783 19.4222 6.09732C19.4182 5.93231 19.4562 5.86831 19.6447 5.84931C20.1657 5.78931 20.6712 5.64681 21.1357 5.3913C22.4833 4.65528 23.0268 3.44624 23.1548 1.9972C23.1738 1.77569 23.1508 1.54668 22.9168 1.43018ZM11.1749 14.4736C9.15936 12.889 8.18184 12.3675 7.77832 12.39C7.40081 12.4125 7.46881 12.8445 7.55182 13.126C7.63882 13.404 7.75182 13.5955 7.91033 13.8396C8.01983 14.0011 8.09533 14.2411 7.80083 14.4216C7.15181 14.8231 6.02327 14.2866 5.97027 14.2601C4.65673 13.4865 3.5587 12.4655 2.78467 11.069C2.03715 9.72493 1.60314 8.28289 1.53164 6.74384C1.51264 6.37233 1.62214 6.24082 1.99215 6.17332C2.47916 6.08332 2.98118 6.06432 3.46769 6.13582C5.52476 6.43633 7.27581 7.35586 8.74385 8.8129C9.58188 9.64243 10.2159 10.634 10.8689 11.6025C11.5634 12.631 12.3105 13.611 13.262 14.4146C13.598 14.6961 13.866 14.9101 14.1225 15.0681C13.349 15.1546 12.058 15.1731 11.1749 14.4746L11.1749 14.4736ZM12.141 8.25988C12.141 8.09488 12.273 7.96338 12.439 7.96338C12.4765 7.96338 12.5105 7.97088 12.541 7.98188C12.5825 7.99688 12.6205 8.01938 12.6505 8.05338C12.7035 8.10588 12.7335 8.18088 12.7335 8.25988C12.7335 8.42489 12.6015 8.55639 12.4355 8.55639C12.2695 8.55639 12.141 8.42489 12.141 8.25988ZM15.1415 9.79893C14.949 9.87793 14.7565 9.94544 14.5715 9.95294C14.2845 9.96794 13.9715 9.85143 13.8015 9.70893C13.5375 9.48742 13.3485 9.36342 13.2695 8.97691C13.2355 8.8119 13.2545 8.55639 13.2845 8.40989C13.3525 8.09438 13.277 7.89187 13.0545 7.70787C12.8735 7.55786 12.643 7.51636 12.39 7.51636C12.2955 7.51636 12.209 7.47486 12.1445 7.44136C12.039 7.38886 11.9519 7.25735 12.035 7.09585C12.0615 7.04335 12.19 6.91584 12.22 6.89334C12.5635 6.69784 12.9595 6.76184 13.326 6.90834C13.6655 7.04735 13.9225 7.30236 14.292 7.66287C14.6695 8.09838 14.7375 8.21838 14.9525 8.54539C15.1225 8.8009 15.277 9.06341 15.3831 9.36392C15.4471 9.55142 15.3641 9.70493 15.1415 9.79893Z" fill="currentColor" />
    </svg>
  )
}

/**
 * Threerouter 品牌 logo：官方 logo.webp（data URI 内联，理由见文件头注释）。
 * 装饰性图示，alt 置空并 aria-hidden，避免读屏器与标题重复播报。
 */
function ThreerouterTileMark({ size }: { size: number }) {
  return (
    <img
      src={THREEROUTER_LOGO_DATA_URI}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
    />
  )
}

/**
 * hero 品牌行：双 logo + 桌面标题。标题字号/字重/颜色继承上游 `.headline`
 * （26px/32px/wt500/--dsw-alias-label-primary），长标题允许换行。
 */
function HeroBrandMark({ size = 34, className }: HeroBrandProps) {
  return (
    <span className="dshDesktopHeroBrand">
      <DeepseekWhaleMark size={size} className={className} />
      <ThreerouterTileMark size={28} />
      <span className="dshDesktopHeroBrandTitle">{HERO_TITLE}</span>
    </span>
  )
}

/**
 * hero 品牌区覆盖样式。选择器契约见文件头注释：上游 css modules 编译为
 * `[hash]_[local]`，后缀匹配是稳定锚点；样式元素带 dataset 标记，随
 * disposer 卸载。
 */
const HERO_BRAND_STYLES = `
[class$='_headlineText'], [class$='_previewBadge'] { display: none; }
[class$='_headline']:has(> [class$='_fishHitbox']) { grid-template-columns: auto; }
[class$='_headline'] > [class$='_fishHitbox'] { min-width: 0; max-width: 100%; }
.dshDesktopHeroBrand { display: inline-flex; align-items: center; gap: 10px; max-width: 100%; min-width: 0; }
`

function installHeroBrandStyles(): () => void {
  const style = document.createElement('style')
  style.dataset.plugin = 'dsh-plugin-desktop'
  style.dataset.pluginCss = 'dsh-plugin-desktop/hero-brand'
  style.textContent = HERO_BRAND_STYLES
  document.head.appendChild(style)
  return () => { style.remove() }
}

/**
 * 注册桌面 hero 品牌区覆盖。`ctx.slots.inject` 的控制器归属调用方 fiber，
 * 插件卸载时随 apply fiber 自动级联注销（与 media-toolview 一致）；全局
 * 样式经 ctx.effect 挂载并随 disposer 卸载。
 * @param ctx - 浏览器 Cordis 上下文。
 */
export function applyHeroBrand(ctx: ClientContext): void {
  ctx.slots.inject('conversation.hero.brand.mark', function* () {
    yield ctx.slots.register({ name: 'conversation.hero.brand.mark' }, HeroBrandMark)
  })
  ctx.effect(
    () => installHeroBrandStyles(),
    'dsh-plugin-desktop: hero brand styles',
  )
}
