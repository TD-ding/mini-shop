# Mini Shop — 后端文档

## 技术栈

- **Runtime**: Node.js 18+
- **Framework**: Express 4.21
- **认证**: bcryptjs（密码哈希）+ cookie-parser（httpOnly cookie）+ crypto（session token）
- **存储**: JSON 文件（`data/` 目录）

## 项目结构

```
├── server.js          # 后端入口，包含所有 API 路由
├── package.json
├── data/
│   ├── products.json  # 商品数据
│   ├── users.json     # 用户数据（密码已哈希）
│   ├── orders.json    # 订单数据
│   └── favorites.json # 收藏数据（按 userId 索引）
├── public/            # 静态前端文件
│   ├── index.html
│   ├── login.html
│   ├── admin.html
│   ├── app.js
│   ├── admin.js
│   └── style.css
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 服务监听端口 |

## 数据存储

使用 JSON 文件存储，通过 `read(file)` / `write(file, data)` 读写：

- `products.json` — 商品数组，每个商品包含 `id, name, price, category, description, image`
- `users.json` — 用户数组，密码使用 bcrypt 哈希存储
- `orders.json` — 订单数组，每个订单包含商品快照（name, price, quantity）
- `favorites.json` — 对象，key 为 userId，value 为 productId 数组

## 认证机制

- **Session-based**：登录成功后生成 64 字符 hex token（`crypto.randomBytes(32)`）
- **Token 存储**：服务端存入 `sessions` Map（内存），客户端存入 httpOnly cookie
- **Cookie 配置**：`httpOnly: true, maxAge: 7天`
- **中间件**：
  - `auth` — 验证登录状态，提取 userId
  - `adminOnly` — 验证登录 + 管理员角色

## API 路由

### 认证 (`/api/auth`)

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/api/auth/register` | 公开 | 注册（用户名2-20字符，密码≥6字符） |
| POST | `/api/auth/login` | 公开 | 登录 |
| POST | `/api/auth/logout` | 公开 | 退出（清除 cookie + session） |
| GET | `/api/auth/me` | 公开 | 获取当前用户信息（未登录返回 null） |

### 商品 (`/api/products`)

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/products` | 公开 | 商品列表，支持 `search`, `category`, `sort` 查询参数 |
| GET | `/api/products/:id` | 公开 | 单个商品详情 |
| GET | `/api/categories` | 公开 | 分类列表 |

### 收藏 (`/api/favorites`)

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/favorites` | 登录 | 获取当前用户收藏列表 |
| POST | `/api/favorites/:productId` | 登录 | 添加收藏 |
| DELETE | `/api/favorites/:productId` | 登录 | 取消收藏 |

### 订单 (`/api/orders`)

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/api/orders` | 登录 | 创建订单（服务端验证价格和库存） |
| GET | `/api/orders` | 登录 | 用户订单（管理员可见全部） |
| PUT | `/api/orders/:id/cancel` | 登录 | 取消订单（仅 pending/paid 状态） |

### 管理后台 (`/api/admin`)

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/api/admin/products` | 管理员 | 添加商品 |
| PUT | `/api/admin/products/:id` | 管理员 | 编辑商品 |
| DELETE | `/api/admin/products/:id` | 管理员 | 删除商品 |
| PUT | `/api/admin/orders/:id/status` | 管理员 | 更新订单状态 |
| GET | `/api/admin/users` | 管理员 | 用户列表 |
| PUT | `/api/admin/users/:id/role` | 管理员 | 修改用户角色 |
| DELETE | `/api/admin/users/:id` | 管理员 | 删除用户 |

## 安全措施

- **密码哈希**：bcryptjs，salt rounds = 10
- **Session Token**：64 字符随机 hex，httpOnly cookie 防止 XSS 窃取
- **价格验证**：创建订单时服务端从 products.json 读取真实价格，忽略客户端传入的价格
- **数量校验**：整数，范围 1-99
- **手机号验证**：正则 `^1[3-9]\d{9}$`
- **角色校验**：管理后台所有接口需通过 `adminOnly` 中间件
- **自身保护**：管理员不能删除/修改自己

## 初始化

`seedAdmin()` 在首次启动时创建默认管理员：

- 用户名：`admin`
- 密码：`admin123`
- 角色：`admin`
