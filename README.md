# dsh-git-ui

[![npm version](https://img.shields.io/npm/v/dsh-git-ui)](https://www.npmjs.com/package/dsh-git-ui)
[![license](https://img.shields.io/npm/l/dsh-git-ui)](LICENSE)

DSH Web UI 的 Git 面板（Git panel）插件，提供 IDEA 风格的版本控制体验：

- **变更管理**：工作区状态、暂存/取消暂存、按 hunk 或按改动块暂存、丢弃改动、跟踪/忽略未跟踪文件。
- **行级 Diff 查看器**：side-by-side / unified 双视图、忽略空白策略、词/字符高亮、软换行、字号调节、行内编辑与恢复。
- **提交**：普通提交、amend、按文件/按 hunk 部分提交；**AI 提交计划**（用 DSH 子代理分析改动并规划成多个 Conventional Commits 组后自动执行）。
- **历史**：`git log --graph` 提交图、提交详情、文件历史、两分支对比、与工作区对比。
- **分支**：新建/切换/重命名/删除分支、远程分支检出与拉取。
- **合并冲突**：冲突定位、左右两侧一键取舍、手动编辑、保存并标记已解决。
- **远程**：远程仓库管理、推送（含 `--force-with-lease`、`--follow-tags`、推送前预览）、抓取、拉取（merge/rebase 策略）。
- **Stash / Rebase / Tag**：暂存栈管理、交互式 rebase（pick/reword/squash/fixup/drop）、轻量/附注标签。
- **其它**：Git 配置查看与编辑、文件树浏览/编辑/新建/删除、changelist、AI 更新 `.gitignore`。

宿主端用系统 `git` 可执行文件在指定工作区完成本地操作；客户端是浏览器插件。

## 前置条件

- 已安装 DeepSeek Harness，且 `dsh web`（或 `dsh --profile web`）能正常启动并打开浏览器界面。
- 机器上装有 `git`（在 PATH 中，或用配置指定完整路径）。
- pnpm ≥ 9（DSH 的 profile 使用 pnpm 管理依赖）。

## 安装

### 第一步：安装

#### 方式 1：npm 源（推荐）

包发布到 npm registry 后，一行安装：

```powershell
dsh plugin --profile web add dsh-git-ui
```

#### 方式 2：GitHub 源

```powershell
dsh plugin --profile web add github:giiiiiithub/git-ui
```

> 仓库内已提交 `lib/` 构建产物，git 源安装时无需现场构建。

#### 方式 3：本地源码（开发调试）

- `Windows: dsh plugin --profile web add "file:C:/path/to/git-ui"`
- `macOS:   dsh plugin --profile web add "file:/path/to/git-ui"`
- `Linux:   dsh plugin --profile web add "file:~/git-ui"`

### 第二步：重启服务

插件含宿主端代码，**必须重启 dsh web 进程**才会加载：

```powershell
dsh web
```

> 自 0.1.0 起插件自带 `dsh.bundle`，`dsh plugin add` 会自动把插件登记进 profile 的加载层，
> 无需再手动编辑 `cordis.patch.yml`。

### 第三步：验证

刷新浏览器页面，会话头部出现 **Git** 按钮即安装成功。点击展开面板，选择工作区目录即可使用。

## 卸载

1. 移除依赖：
   ```powershell
   dsh plugin --profile web remove dsh-git-ui
   ```
   或手动：在 profile 目录执行 `pnpm remove dsh-git-ui`。
2. 重启 dsh web 服务，刷新页面后 Git 面板按钮消失即卸载完成。

## 配置

默认值可在 profile 的 `cordis.patch.yml` 里按 id 定点覆盖（bundle 层之后应用）：

```yaml
- id: git-ui
  config:
    gitPath: git    # git 可执行文件路径；默认在 PATH 中查找 "git"
```

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `gitPath` | `git`（PATH 查找） | `git` 可执行文件路径 |

## 构建（仅供贡献者）

```powershell
npm run bundle     # tsc --noEmit && tsdown && node scripts/wrap-client.mjs
```

输出到 `lib/`：宿主端 `index.mjs` / `typert.mjs` / `remote.mjs`，客户端 `client.js`。
