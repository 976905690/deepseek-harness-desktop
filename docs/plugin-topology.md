# DSH Desktop 插件拓扑与加载链路

[English](plugin-topology.en.md) | 中文

> 给同事的一份"看图说话"。把 `dsh-image-video` 这类插件在桌面项目里的真实拓扑、加载顺序、凭证怎么填，讲清楚。本文档默认你已经读过 [plugin-development.md](plugin-development.md) 与 [architecture.md](architecture.md)。

## 一、结论先放这里

**整个项目里只有一份 `dsh-image-video`，没有任何"两份"或者"两份并存"的情况**。它长这样：

| 维度 | 值 |
|---|---|
| 路径 | `./dsh-image-video/`（仓库根的同级目录） |
| 来源 | Git 子模块，仓库 `.gitmodules` 指向 `https://github.com/ihero3/dsh-image-video.git` |
| 形态 | 独立 npm 包（`name: dsh-image-video`, `version: 0.3.0`），同时也是 Yarn workspace |
| 构建 | 插件自带 `tsdown` 构建产物 `lib/index.js` + 类型声明 `lib/types/index.d.ts` |
| 注册入口 | 插件自带的 `cordis.patch.yml` 用 `- insert: image-video` 把自己挂进 DSH profile |
| 在 desktop 里的位置 | 由桌面插件 `dsh-plugin-desktop/cordis.patch.yml` 用 `- id: image-video` 覆盖 config（让用户填 key），互不冲突 |

**默认 provider 是 `threerouter`，不是 `wanx`**——桌面 profile 和插件 patch 两处都明确写 `provider: threerouter`。你之前看到/用了 `wanx`，只可能是手动传参或把 key 填到了 `wanx` 那一栏。

## 二、为什么会有"两份"的错觉

你之前调用 `provider: "wanx"`，并且从 `~/.dsh/.env` 取 `DASHSCOPE_API_KEY`——这用的是 **DSH 安装目录内置的旧版 image-video**，跟你当前 clone 的这个桌面项目**没有代码共享**：

| 来源 | 位置 | Provider 联合类型 | 默认 provider |
|---|---|---|---|
| DSH 安装版（旧） | `~/.dsh/.../dsh-image-video`（跟你的桌面项目无关） | `'bxinle' \| 'wanx' \| 'seedance'` | 视 profile 而定，常配 wanx |
| Desktop 项目独立插件 | `./dsh-image-video/`（git submodule + Yarn workspace） | `'threerouter' \| 'wanx' \| 'seedance'` | `threerouter`（两处 patch 都明确写） |

`deepseek-harness/dsh-image-video` 这个目录**在当前仓库里根本不存在**（`find deepseek-harness -maxdepth 2 -name "dsh-image-video"` 返回空）——你之前调用的"另一份"是 DSH 安装版，不是这个项目的子模块。

## 三、同事 clone 后插件是怎么被自动加载的

加载链路分五步，每一步都已经在仓库里**写好**：

1. **Git 子模块拉源码**
   - `.gitmodules` 声明：
     ```
     [submodule "dsh-image-video"]
         path = dsh-image-video
         url = https://github.com/ihero3/dsh-image-video.git
     ```
   - `git submodule update --init --recursive` 拉取
   - 根 `package.json#scripts.dev` 第一行就是这个命令

2. **Yarn workspace 链接**
   - 根 `package.json#workspaces` 包含 `dsh-image-video`
   - `corepack yarn install --immutable` 把子模块源码软链进 root `node_modules`

3. **构建 dsh-image-video 子模块产物**
   - **`dsh-image-video/.gitignore` 把 `lib/` 排除**——构建产物**不进 git**，submodule 只拉源码
   - 同事 clone 后 `lib/index.js` 是不存在的
   - 修复：根 `package.json#scripts` 把 `yarn workspace dsh-image-video build` 加进了 `build` / `dev` / `package:dir` / `dist:*` 所有需要加载它的命令的最前面
   - 也就是说：同事只要按下面的"启动命令"跑，**不需要手动 cd 进子模块 build**

3. **插件自注册到 DSH profile**
   - `dsh-image-video/package.json#dsh.bundle.patch = ./cordis.patch.yml`
   - 该 `cordis.patch.yml` 用 `- insert: image-video` 在 profile 根上新增一行（不覆盖任何已有插件行）
   - 默认 `provider: threerouter`，threerouter/wanx/seedance 三个块的 apiKey 留空（由用户在桌面 profile 覆盖）

4. **桌面 profile 覆盖 config（让用户填 key）**
   - `dsh-plugin-desktop/cordis.patch.yml` 第 33 行：
     ```yaml
     - id: image-video
       config:
         provider: threerouter
         threerouter:
           apiKey: ''
           baseURL: ''
         ...
     ```
   - 注释明确写：
     > The entry itself is registered by dsh-image-video's bundle patch; this row only overrides config so updating the plugin via `git pull` won't conflict.
   - 这样 `git pull` 升级插件不会冲突；用户填 key 也只动桌面这一份 patch

## 四、threerouter 的 API Key 怎么填

桌面 profile 留空只是约定——实际首次跑 `yarn dev` 时，`dsh-image-video` 加载会因为 `resolveActiveProvider` 抛"未配置 API Key"。我们加了一个**自动引导脚本**：

### 自动路径（推荐）

`scripts/bootstrap-image-video-keys.mjs` 在 `yarn dev` 启动前自动跑：

1. 解析 `cordis.patch.yml` 的 `image-video` 块
2. 如果 `threerouter.apiKey` 仍是占位的 `''`：
   - 顺序读 `~/.dsh/.env` → `~/.dsh/.eee`（兼容用户把 `.env` 改名成 `.eee` 的历史）
   - 按 `THREEROUTER_MEDIA_API_KEY` → `THREEROUTER_API_KEY` 顺序找
   - 找到 → 写回 `cordis.patch.yml` 的 `threerouter.apiKey`（保留注释和顺序）
   - 找不到 → 打印 banner 提示，不阻断启动（exit 0）
3. 如果 `threerouter.apiKey` 已经填了 → 跳过，尊重用户手动覆盖

### 手动路径

**方法 A：在 `~/.dsh/.env` 加一行**（推荐）

```sh
THREEROUTER_MEDIA_API_KEY=sk-your-key-here
```

然后跑一次 `yarn dev`，脚本会自动写回 `cordis.patch.yml`。

**方法 B：直接编辑 `cordis.patch.yml` 第 36 行**

把：

```yaml
threerouter:
  apiKey: ''
  baseURL: ''
```

改成：

```yaml
threerouter:
  apiKey: 'sk-your-key-here'
  baseURL: ''
```

**方法 C：切到其它 provider**

把 `cordis.patch.yml` 第 35 行 `provider: threerouter` 改成 `wanx` 或 `seedance`，再填对应块的 `apiKey`。

### 跳过引导

CI 跑或者不想自动改 `cordis.patch.yml` 时：

```sh
SKIP_IMAGE_VIDEO_BOOTSTRAP=1 yarn dev
```

### 同事首次 clone 的完整命令

```sh
git clone <repo>
cd deepseek-harness-desktop
git submodule update --init --recursive
corepack yarn install --immutable
corepack yarn dev
```

`yarn dev` 会自动按以下顺序跑：
1. `git submodule update --init --recursive`（再确认子模块都拉到）
2. `yarn workspace dsh-image-video build`（生成 `lib/index.js`）
3. `yarn workspace dsh-community-market build`
4. `yarn workspace dsh-plugin-desktop dev`（内部跑 `yarn run build && node scripts/bootstrap-image-video-keys.mjs && node lib/bin.js`）
5. `bootstrap` 脚本自动从 `~/.dsh/.env` 读 `THREEROUTER_MEDIA_API_KEY` / `THREEROUTER_API_KEY` 写进 `cordis.patch.yml`
6. Electron GUI 启动

### 关于 `cordis.patch.yml` 会被标 dirty

这是**预期行为**：每个开发者的 API Key 不一样，文件被脚本写入后 `git status` 会标 dirty。建议：

- 把 `cordis.patch.yml` 加入 `.git/info/exclude`（仓库内本地生效，不影响团队）
- 或者在第一次 `git add cordis.patch.yml && git commit` 后不再改动这个文件
- 不要把带真实 key 的 `cordis.patch.yml` 推到远端

## 五、版本升级时怎么办

`dsh-image-video` 是独立 npm 包，有自己的 version（当前 `0.3.0`）。`yarn workspace dsh-image-video build` 在子模块内独立打版。要升级：

```sh
cd dsh-image-video
git pull        # 拉新版本
yarn install    # 装新依赖
yarn build      # 重新构建 lib/index.js
cd ..
yarn dev        # 重启桌面
```

桌面仓库**不需要**改任何东西，submodule pin 的更新和桌面行为变化在 commit 上保持独立（见 [AGENTS.md §提交约定](../AGENTS.md)）。

## 六、相关文档

- [plugin-development.md](plugin-development.md) — 怎么写一个新插件
- [plugin-ecosystem.md](plugin-ecosystem.md) — 插件生态高层愿景
- [architecture.md](architecture.md) — 整体架构
- [AGENTS.md §Prerequisites and setup](../AGENTS.md) — Yarn 4 + Corepack + 子模块初始化约定
- `dsh-image-video/README.md` — 插件自身的完整文档