# Mini Shop — 部署文档

## 快速启动

### 方式一：Docker Compose（推荐）

```bash
# 1. 克隆仓库
git clone https://github.com/TD-ding/mini-shop.git
cd mini-shop

# 2. 创建环境配置（可选，默认端口 3000）
cp .env.example .env

# 3. 启动服务
docker compose up -d

# 4. 访问
# 商城主页：http://localhost:3000
# 管理后台：http://localhost:3000/admin.html
# 默认管理员：admin / admin123
```

### 方式二：直接运行

```bash
# 1. 克隆仓库
git clone https://github.com/TD-ding/mini-shop.git
cd mini-shop

# 2. 安装依赖
npm ci

# 3. 启动
npm start

# 开发模式（文件变化自动重启）
npm run dev
```

## Docker 配置说明

### Dockerfile

- 基础镜像：`node:18-alpine`
- 非 root 用户运行（uid/gid 1001）
- 内置健康检查：每 30 秒请求 `/api/products`
- 生产依赖安装：`npm ci --only=production`

### docker-compose.yml

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 端口映射 | `${PORT:-3000}:3000` | 可通过 .env 自定义端口 |
| 数据卷 | `./data:/app/data` | 持久化商品/用户/订单数据 |
| 环境文件 | `.env` | 加载环境变量 |
| 重启策略 | `unless-stopped` | 异常退出自动重启 |
| 健康检查 | wget `/api/products` | 30s 间隔，3s 超时，3 次重试 |

### .dockerignore

排除 `node_modules`、`.git`、`.github`、`docs`、`*.md`、`.env` 文件，减小镜像体积。

## 环境变量

| 变量 | 默认值 | 必需 | 说明 |
|------|--------|------|------|
| `PORT` | `3000` | 否 | 服务监听端口 |

## CI/CD

### GitHub Actions (`.github/workflows/ci.yml`)

- **触发条件**：push/PR 到 `master` 分支
- **流程**：
  1. Checkout 代码
  2. Node.js 18 环境 + npm 缓存
  3. `npm ci` 安装依赖
  4. 启动服务 + 健康检查（curl `/api/products`）

## 数据目录

```
data/
├── products.json   # 商品数据
├── users.json      # 用户数据（首次启动自动创建 admin）
├── orders.json     # 订单数据
└── favorites.json  # 收藏数据
```

**备份**：直接复制 `data/` 目录即可。

**注意事项**：
- 数据为 JSON 文件存储，适合小型/演示场景，生产环境建议替换为数据库
- sessions 存储在内存中，服务重启后需重新登录
- Docker 部署时 `data/` 目录已挂载为卷，数据不会因容器销毁而丢失

## 安全建议（生产环境）

- 修改默认管理员密码
- 使用反向代理（Nginx）启用 HTTPS
- 将 `data/` 替换为持久化数据库（SQLite/PostgreSQL）
- 将 session 存储替换为 Redis 或数据库
- 添加速率限制中间件
