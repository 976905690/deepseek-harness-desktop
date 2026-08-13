# DeepSeek Harness 桌面端

[English](README.md) | 中文

桌面应用负责监管现有的回环 Web Host；窗口关闭后，系统托盘继续持有 Host 的生命周期。

## 开发

安装依赖后，使用单一桌面开发命令。该命令会先构建 Host 与客户端包、Web 前端和 Electron main 进程，再启动应用：

```sh
pnpm run dev:desktop
```

关闭窗口会隐藏窗口。通过托盘菜单恢复窗口或退出应用。显式退出会等待 Host 进程停止，并在 Host 的有界宽限期结束后升级终止行为。

桌面应用只接受 `dsh web` 为 `127.0.0.1` 或 `localhost` 输出的就绪 URL。页面导航限制在该来源；HTTP 和 HTTPS 链接交给系统浏览器打开。

原生窗口外观按宿主平台区分。macOS 使用无边框内嵌标题栏、交通灯和侧栏 vibrancy；收起侧栏宽 88px，其中的控件水平居中，最上方控件在交通灯下方与展开态 logo 行对齐。Windows 保留系统边框、阴影、缩放与 Snap 行为以及 Windows 11 圆角，同时用隐藏标题栏把原生窗口按钮放入 Session header 首行；Windows 侧栏不预留交通灯区域。该行的空白部分可拖动，控件仍可点击；没有 Session header 时，常驻拖拽带覆盖同一行。Windows acrylic 和 macOS vibrancy 只透过侧栏，会话区与详情区保持不透明。Linux 使用无边框窗口和不透明侧栏降级样式。

## 已知限制

首个桌面装配使用回环 HTTP Host。renderer 和 Host 协议保持不变，因此后续可替换为 GUI 架构预留的 IPC carrier，而无需改动产品功能。

打包目前只为本机平台生成未封装应用。签名安装包、随包 Node 运行时和完整的生产依赖 staging tree 属于独立的发布工作。

## 模型体验

桌面壳不会增加模型可见输入。复用的 Web profile 继续持有现有的 Web 运行时上下文。
