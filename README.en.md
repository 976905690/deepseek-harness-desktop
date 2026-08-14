<h1 align="center">DeepSeek Harness Desktop</h1>

<p align="center">
  <a href="https://github.com/anywhere-labs/deepseek-harness-desktop"><img src="https://img.shields.io/github/stars/anywhere-labs/deepseek-harness-desktop?style=flat&amp;label=%E2%98%85&amp;color=08C" alt="GitHub stars"></a>
  <img src="https://img.shields.io/badge/Electron-Desktop-47848F?style=flat&amp;logo=electron&amp;logoColor=white" alt="Electron desktop application">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2EA44F?style=flat" alt="MIT License"></a>
  <a href="https://discord.gg/TJeGqKRNM"><img src="https://img.shields.io/badge/Discord-5865F2?style=flat&amp;logo=discord&amp;logoColor=white" alt="Join Discord"></a>
  <img src="https://img.shields.io/badge/macOS%20%7C%20Windows-4493F8?style=flat-square" alt="Supported platforms: macOS and Windows">
</p>

<p align="center"><sub><a href="README.md">中文</a> · English</sub></p>

<p align="center">
  <strong>An Electron desktop app built on the official DeepSeek Harness</strong><br>
  DeepSeek officially provides a local Web UI launched from the command line. This project adds an Electron desktop shell on top of the official DeepSeek Harness, handling startup and management of the local Harness service so users can get started without configuring Node.js or running commands.
</p>

<a id="run"></a>

<h3 align="center"><a href="https://www.deepseekdesktop.com"><ins>Download Desktop</ins></a></h3>

<p align="center">
  <img src="assets/desktop-preview.png" alt="DeepSeek Harness Desktop preview" width="100%">
</p>

## Features

<table>
  <tr>
    <td width="50%" valign="top">
      <h3>Desktop</h3>
      <p>Bring the official DeepSeek Harness local Web UI to a native desktop application. The app starts and manages the local Harness service, integrates the system tray and desktop window, and requires no Node.js installation or command-line setup.</p>
    </td>
    <td width="50%" valign="top">
      <h3>Mobile Remote Control <img src="https://img.shields.io/badge/COMING_SOON-F59E0B?style=flat-square" alt="Coming Soon"></h3>
      <p>Connect to Desktop from iOS and Android to start tasks, monitor Agent progress, and send follow-ups from your phone.</p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>Plugin Marketplace <img src="https://img.shields.io/badge/COMING_SOON-F59E0B?style=flat-square" alt="Coming Soon"></h3>
      <p>Harness follows an “everything is a plugin” architecture. The desktop marketplace will make it easy to discover, install, update, and manage plugins for models, tools, interfaces, and workflows.</p>
    </td>
    <td width="50%" valign="top">
      <h3>Channels <img src="https://img.shields.io/badge/COMING_SOON-F59E0B?style=flat-square" alt="Coming Soon"></h3>
      <p>Connect WeChat, Feishu, Discord, WhatsApp, and other IM channels to start tasks, receive progress updates, and continue conversations from the apps you already use.</p>
    </td>
  </tr>
</table>

## Relationship to the Official Project

This project is built on [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness).

The core capabilities, plugin system, and Web UI come from the official DeepSeek Harness project. This project primarily provides:

- Electron desktop packaging
- Local service lifecycle management
- Desktop window and system tray integration
- macOS and Windows installer builds and releases
- Interface adaptations for desktop environments

If you prefer to run Harness from the command line or contribute to its core functionality, refer to the official repository first.

<a id="run-from-source"></a>

## Development

The desktop application is located in:

```text
apps/desktop
```

Install the dependencies and start the desktop application:

```sh
pnpm install
pnpm run dev:desktop
```

## Community

Choose whichever platform you prefer to discuss usage, plugin development, and project updates.

<table>
  <thead>
    <tr>
      <th align="center">WeChat Group</th>
      <th align="center">QQ Group</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center"><img src="assets/community-wechat-group.png" alt="DeepSeek Harness Desktop WeChat group QR code" width="180" height="180"></td>
      <td align="center"><img src="assets/community-qq-group.jpg" alt="DeepSeek Harness Desktop QQ group QR code" width="180" height="180"></td>
    </tr>
  </tbody>
</table>

Discord: [Join the DeepSeek Harness Desktop community](https://discord.gg/TJeGqKRNM)

## License

This project is licensed under the [MIT License](LICENSE).

> This is a community desktop edition built on DeepSeek Harness. It is not an official DeepSeek product.
