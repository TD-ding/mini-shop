# Mini Shop — 前端文档（商城主页）

## 技术栈

- Vanilla HTML / CSS / JavaScript（无框架）
- 样式文件：`public/style.css`
- 页面入口：`public/index.html`
- 业务逻辑：`public/app.js`

## 页面结构

### 1. 商城主页 (`index.html`)

单页应用，通过按钮切换三个视图：

| 视图 | 容器 ID | 说明 |
|------|---------|------|
| 商品列表 | `#page-products` | 默认视图，展示商品网格 |
| 购物车 | `#page-cart` | 购物车内容与结算 |
| 订单列表 | `#page-orders` | 当前用户的订单历史 |

### 2. 登录/注册页 (`login.html`)

双标签页表单，支持登录和注册，注册时需确认密码。

### 3. 弹窗 (Modal)

| 弹窗 ID | 用途 |
|---------|------|
| `#detail-modal` | 商品详情查看 |
| `#checkout-modal` | 订单结算（填写收货信息） |

## 核心功能

### 用户认证

- `checkAuth()` 通过 `GET /api/auth/me` 获取当前登录用户
- 登录态通过 httpOnly cookie 维持，前端无需手动管理 token
- 未登录时显示「登录/注册」按钮，已登录显示用户名和角色标签
- 管理员角色额外显示「管理后台」入口按钮

### 商品浏览

- `loadProducts()` 从 `/api/products` 加载全量商品
- `loadCategories()` 从 `/api/categories` 加载分类列表，渲染分类按钮栏
- 支持三种筛选条件（可叠加）：
  - **搜索**：按名称/描述模糊匹配
  - **分类**：按分类名过滤
  - **收藏**：仅显示已收藏商品（需登录）
- 支持排序：默认 / 价格升序 / 价格降序
- 点击商品卡片打开详情弹窗

### 收藏

- `loadFavorites()` 从 `GET /api/favorites` 加载当前用户收藏列表
- `toggleFavorite(productId)` 切换收藏/取消收藏
- 收藏按钮在商品卡片和详情弹窗中均可操作

### 购物车

- 数据存储在 `localStorage`，格式：`[{ id, quantity }]`
- `addToCart()` — 添加商品，已有则数量 +1（上限 99）
- `renderCart()` — 渲染购物车列表，支持增减数量、删除单品
- 结算时弹出 checkout modal，填写收货人/手机/地址后提交

### 订单

- `loadOrders()` 从 `GET /api/orders` 获取用户订单
- 管理员可看到所有用户订单
- 支持取消 pending/paid 状态的订单

## XSS 防护

所有动态渲染的用户输入通过 `esc()` 函数进行 HTML 实体转义：

```javascript
function esc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
```

## Toast 通知

`showToast(msg, type)` 在页面右上角显示浮动通知，3 秒后自动消失。type 支持 `success`、`error`、`info`。
