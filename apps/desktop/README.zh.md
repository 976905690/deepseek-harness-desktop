# DeepSeek Harness 桌面端

[English](README.md) | 中文

桌面应用负责监管现有的回环 Web Host；窗口关闭后，系统托盘继续持有 Host 的生命周期。

## 开发

先构建一次仓库，再启动 Electron：

```sh
pnpm run build
pnpm run dev:desktop
```

关闭窗口会隐藏窗口。通过托盘菜单恢复窗口或退出应用。显式退出会等待 Host 进程停止，并在 Host 的有界宽限期结束后升级终止行为。

桌面应用只接受 `dsh web` 为 `127.0.0.1` 或 `localhost` 输出的就绪 URL。页面导航限制在该来源；HTTP 和 HTTPS 链接交给系统浏览器打开。

原生窗口采用无边框设计。macOS 保留交通灯按钮并为侧边栏启用 vibrancy；Windows 保留标题栏覆盖按钮并使用 acrylic。客户端会避让原生标题栏，只让侧边栏半透明，同时保持会话区和详情区不透明。Linux 使用相同的无边框布局，侧边栏降级为不透明样式。

## 已知限制

首个桌面装配使用回环 HTTP Host。renderer 和 Host 协议保持不变，因此后续可替换为 GUI 架构预留的 IPC carrier，而无需改动产品功能。

打包目前只为本机平台生成未封装应用。签名安装包、随包 Node 运行时和完整的生产依赖 staging tree 属于独立的发布工作。

## 模型体验

桌面壳不会增加模型可见输入。复用的 Web profile 继续持有现有的 Web 运行时上下文。
