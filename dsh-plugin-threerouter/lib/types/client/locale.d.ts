/**
 * Threerouter client locale dictionary and namespace declaration.
 *
 * Extracted from the desktop advanced-shell so the Threerouter overlay can
 * register its own translations without depending on `dsh-plugin-desktop`.
 */
declare const threerouterZh: {
    readonly account: "Threerouter 1$ ≈ 30M token";
    readonly close: "关闭";
    readonly signInTitle: "登录 Threerouter 账号";
    readonly signIn: "登录";
    readonly signingIn: "登录中…";
    readonly email: "邮箱";
    readonly password: "密码";
    readonly enterCredentials: "请输入邮箱和密码";
    readonly createAccount: "注册账号";
    readonly apiKeyHint: "登录后自动申请并配置 API Key，默认使用 deepseek-v4-pro 模型。";
    readonly loggedInNotice: "已登录 Threerouter，API Key 已自动配置";
    readonly accountBalance: "账户余额";
    readonly apiKeyReady: "API Key 已就绪";
    readonly apiKeyNotCreated: "API Key 未创建";
    readonly quickModelSwitch: "快速切换模型";
    readonly shareInviteLink: "分享邀请链接";
    readonly signOut: "退出登录";
    readonly inviteCopied: "分享链接已复制到剪贴板";
    readonly openSessionFirst: "请先打开一个会话再切换模型";
};
export type ThreerouterKey = keyof typeof threerouterZh;
/** Combined zh/en bundle passed to `ctx.locale.register('threerouter', …)`. */
export declare const threerouterLocale: {
    zh: {
        readonly account: "Threerouter 1$ ≈ 30M token";
        readonly close: "关闭";
        readonly signInTitle: "登录 Threerouter 账号";
        readonly signIn: "登录";
        readonly signingIn: "登录中…";
        readonly email: "邮箱";
        readonly password: "密码";
        readonly enterCredentials: "请输入邮箱和密码";
        readonly createAccount: "注册账号";
        readonly apiKeyHint: "登录后自动申请并配置 API Key，默认使用 deepseek-v4-pro 模型。";
        readonly loggedInNotice: "已登录 Threerouter，API Key 已自动配置";
        readonly accountBalance: "账户余额";
        readonly apiKeyReady: "API Key 已就绪";
        readonly apiKeyNotCreated: "API Key 未创建";
        readonly quickModelSwitch: "快速切换模型";
        readonly shareInviteLink: "分享邀请链接";
        readonly signOut: "退出登录";
        readonly inviteCopied: "分享链接已复制到剪贴板";
        readonly openSessionFirst: "请先打开一个会话再切换模型";
    };
    en: {
        account: string;
        close: string;
        signInTitle: string;
        signIn: string;
        signingIn: string;
        email: string;
        password: string;
        enterCredentials: string;
        createAccount: string;
        apiKeyHint: string;
        loggedInNotice: string;
        accountBalance: string;
        apiKeyReady: string;
        apiKeyNotCreated: string;
        quickModelSwitch: string;
        shareInviteLink: string;
        signOut: string;
        inviteCopied: string;
        openSessionFirst: string;
    };
};
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        threerouter: ThreerouterKey;
    }
}
export {};
