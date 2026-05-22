# Mini Shop

小型全栈购物平台 — 用户注册登录、商品浏览与收藏、购物车下单、管理员商品增删改查 + 订单管理 + 用户管理。

## 技术栈

- **前端**: HTML / CSS / JavaScript（原生，无框架）
- **后端**: Node.js 18 + Express 4
- **认证**: Session Token（httpOnly Cookie）+ bcryptjs 密码哈希
- **数据存储**: JSON 文件
- **部署**: Docker + docker-compose

## 功能概览

### 商城前端
- 商品浏览（搜索、分类筛选、价格排序）
- 商品收藏（登录用户）
- 购物车（localStorage 持久化）
- 下单结算（收货信息、手机号验证）
- 订单查看与取消

### 登录/注册
- 用户名 + 密码注册（用户名 2-20 字符，密码 ≥ 6 字符）
- 登录态通过 httpOnly cookie 维持（7 天有效期）

### 管理后台
- 商品 CRUD（增删改查）
- 订单状态管理（待处理 → 已付款 → 已发货 → 已完成 / 已取消）
- 用户管理（角色切换、删除）

## 快速启动

```bash
# Docker
docker compose up -d

# 或直接运行
npm ci && npm start
```

访问 `http://localhost:3000`，默认管理员：`admin / admin123`

## 文档

- [前端文档](docs/frontend.md) — 商城页面结构与交互逻辑
- [后端文档](docs/backend.md) — API 路由、认证机制、数据结构
- [管理后台文档](docs/admin-frontend.md) — 管理面板功能说明
- [部署文档](docs/deployment.md) — Docker 配置、CI/CD、安全建议

## 开发过程

通过 A2A 协作开发工作流（Generator + Reviewer 双 Agent 迭代）完成：

| 轮次 | PR | 说明 |
|------|-----|------|
| 第1轮 | #6 | 初始版本：商品浏览、购物车、订单、管理员 CRUD |
| 第2轮 | #7 | 代码质量：XSS 防护、输入验证、路由整理 |
| 第3轮 | #8 | 用户体验：分类筛选、收藏功能、排序、订单取消 |
| 第4轮 | #9 | 功能增强：搜索框、收藏过滤、订单详情、角色标签 |
| 第5轮 | #10 | Bug 修复：订单显示顺序、样式微调 |
| Step 4 | - | Docker/CI 配置：Dockerfile、docker-compose、GitHub Actions |
| Step 5 | - | 文档生成：frontend.md、backend.md、admin-frontend.md、deployment.md |
