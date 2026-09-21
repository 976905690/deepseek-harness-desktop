# Hypit 视频角色替换工作流

使用 ThreeRouter 的 MiniMax-H3 模型，把参考视频中的角色替换成指定人物。

## 前置条件

- Node.js ^22.19.0 或 >=24.0.0
- 全局安装 Hypit CLI：`npm install --global @hypit/hypit`
- ThreeRouter API Key（环境变量 `THREEROUTER_MEDIA_API_KEY`）

## 初始化

```bash
corepack yarn install --immutable
npx tsc -p packages/hypit-provider-threerouter/tsconfig.json
npx tsc -p packages/hypit-minimax-h3/tsconfig.json
npx tsc -p packages/hypit-wan3-video/tsconfig.json
```

`packages/*/dist/`、`.hypit/` 和 `hypit/assets/` 都在 `.gitignore` 中：前两者构建后自动生成，素材目录需要自己创建。

## 准备素材

创建 `hypit/assets/` 目录，放入两个文件（文件名可自定义，但需与 `main.svml` 中的引用一致）：

| 文件 | 说明 |
|------|------|
| `source-video.mp4` | 源视频（原片中的角色将被替换） |
| `reference-image.png` | 人物参考图（替换后的角色形象） |

`main.svml` 当前引用 `source-video.mp4` 和 `reference-image.png`，如使用其他文件名请同步修改。

## 生成视频

```bash
set -a; source ~/.dsh/.env; set +a
hypit build hypit/main.svrun --runtime hypit.runtime.json --follow
```

构建成功后导出：

```bash
hypit get <build-id> --output replacement.video \
  --workspace . --to outputs/replacement.mp4
```

## 修改人物和提示词

编辑 `hypit/main.svml`：

- `<media:Image>` 的 `src` 指向你的参考图
- `<text:Value id="direction">` 中的替换方向（男/女/动物等）

视频时长（`duration="15"`）、分辨率（`resolution="768P"`）也在这里调整。MiniMax-H3 支持 4-15 秒、`768P`/`2K`。

## 常见问题

**Build failed: every public asset host failed**

ThreeRouter 只接受公网 URL，Provider 会把本地素材先传到临时托管服务再提交。如果所有托管站都不通，通常是本机网络或防火墙问题，稍后重试。

**Build failed: media url unreachable**

参考图 URL 被上游模型机房屏蔽（常见于 Twitter/X CDN）。确保参考图是本地文件而不是外链。

**Runtime Worker stopped**

首次运行时正常，`hypit build` 会自动启动 Worker。如果报 ENOENT，先执行上面的初始化命令构建 `dist/`。
