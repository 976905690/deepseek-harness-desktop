# DeepSeek Harness Desktop

[中文](README.md) | English

DeepSeek Harness, packaged as a ready-to-use desktop application.

DeepSeek officially provides a local Web UI launched from the command line. This project adds an Electron desktop shell on top of the official DeepSeek Harness, handling startup and management of the local Harness service so users can get started without configuring Node.js or running commands.

<a id="run"></a>

## Download

| Platform | Availability |
| --- | --- |
| macOS Apple Silicon | Supported |
| macOS Intel | Planned |
| Windows x64 | Supported |

Visit [deepseekdesktop.com](https://deepseekdesktop.com) to download the latest version.

## Preview

<p align="center">
  <img src="assets/desktop-preview.png" alt="DeepSeek Harness Desktop preview" width="100%">
</p>

## Features

- Packages DeepSeek Harness as a native desktop application
- Automatically starts and manages the local Harness service
- Does not require users to install Node.js or run commands manually
- Supports running from the system tray
- Optimizes the window and interface for macOS and Windows
- Preserves the official Harness plugin system and local Web UI
- Keeps application data and the Harness service running locally

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
