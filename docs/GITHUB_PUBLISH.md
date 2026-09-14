# 发布到 GitHub

> 仓库已经在 GitHub 上。本文保留初期 Bundle / ZIP 发布步骤，不是现在克隆仓库的推荐方式。日常请直接 `git clone https://github.com/dongyuan21/melo-game-creative-studio.git`，产品说明见根目录 README。

当前交付同时提供源码 ZIP 和保留提交历史的 Git Bundle。

## 推荐：从 Git Bundle 建仓

```bash
git clone -b main melo-game-creative-studio-phase1-v0.1.4.bundle melo-game-creative-studio
cd melo-game-creative-studio
git remote set-url origin git@github.com:dongyuan21/melo-game-creative-studio.git
git push -u origin main --follow-tags
```

前提是在 GitHub 账号 `dongyuan21` 下先创建一个空仓库 `melo-game-creative-studio`，不要勾选自动生成 README、License 或 `.gitignore`。

## 使用源码 ZIP

解压后：

```bash
cd melo-game-creative-studio-phase1-v0.1.4
git init -b main
git add .
git commit -m "feat: bootstrap Melo Game Creative Studio phase one"
git remote add origin git@github.com:dongyuan21/melo-game-creative-studio.git
git push -u origin main
```

源码 ZIP 不包含 `.git`，Git Bundle 包含完整提交历史。

## 也可以让脚本创建并推送仓库

解压源码 ZIP 或从 Git Bundle 克隆后，确保已经执行 `gh auth login`，然后运行：

```bash
./scripts/publish-github.sh dongyuan21 melo-game-creative-studio public
```

脚本会复用已存在仓库；仓库不存在时，通过 GitHub CLI 创建后推送 `main` 与全部版本标签。
