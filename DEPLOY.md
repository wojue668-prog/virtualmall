# VirtualMall 部署指南

## 本地启动
```bash
cd C:\Users\Admin\WorkBuddy\2026-05-12-task-14
node server.js
# 访问 http://localhost:3000
```

## 云端部署（Render.com 免费）

### 第一步：推送到 GitHub
1. 打开 https://github.com → 登录 → `New repository`
2. 仓库名填 `virtualmall`，选择 **Public**，点 `Create repository`
3. 在项目目录打开 CMD，执行：
```bash
cd C:\Users\Admin\WorkBuddy\2026-05-12-task-14
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/你的用户名/virtualmall.git
git push -u origin main
```
（如果没有 git，先去 https://git-scm.com/ 安装）

### 第二步：部署到 Render
1. 打开 https://render.com → 注册/登录（用 GitHub 账号授权最方便）
2. 点 `New +` → `Web Service`
3. 选择刚创建的 `virtualmall` 仓库 → `Connect`
4. 配置：
   - **Name**: `virtualmall`（随意）
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: 选 `Free`
5. 点 `Create Web Service`，等待 2-3 分钟部署完成
6. 部署成功后会得到一个地址，类似：`https://virtualmall-xxxx.onrender.com`

### ⚠️ 重要限制（免费版）
- **SQLite 文件无法持久化**：Render 免费版每次重启会重置文件系统，数据库会丢失
- **解决方案（方案A测试阶段）**：
  - 每次部署后手动重新添加商品和库存（后台管理页面操作）
  - 或者升级到付费版（~$7/月）支持磁盘持久化
- **正式运营（方案B）建议**：换用 PostgreSQL（Render 提供免费 PostgreSQL 实例）

### 第三步：配置环境变量（可选）
在 Render 的 Web Service 页面 → `Environment` → `Add Environment Variable`：
- `PORT`: 不用填，Render 自动注入
- `DATABASE_URL`: 如果用 PostgreSQL 才需要

## 方案B（正式运营）前置准备
1. 申请支付宝/微信支付商户号（需要营业执照）
2. 将 SQLite 迁移到 PostgreSQL
3. 配置真实支付回调接口
4. 升级 Render 付费版 或 购买 VPS（阿里云/腾讯云 ~$5/月）

## 管理后台地址
部署后访问：`https://你的地址.onrender.com/admin-dashboard.html`
