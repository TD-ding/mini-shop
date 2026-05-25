const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// JSON 文件存储路径
const DATA = {
  products: path.join(__dirname, 'data', 'products.json'),
  users: path.join(__dirname, 'data', 'users.json'),
  orders: path.join(__dirname, 'data', 'orders.json'),
  favorites: path.join(__dirname, 'data', 'favorites.json'),
};

// 内存 session 存储，key=token, value=userId
const sessions = new Map();
const MAX_QUANTITY = 99;

// 读取 JSON 文件，不存在时返回空数组（favorites 返回空对象）
function read(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); }
  catch { return file === DATA.favorites ? {} : []; }
}

function write(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// 生成 64 字符随机 session token
function genToken() {
  return crypto.randomBytes(32).toString('hex');
}

// --- 认证中间件 ---

// 验证登录状态：从 cookie 中提取 token，查找对应 userId
function auth(req, res, next) {
  const t = req.cookies.token;
  if (!t || !sessions.has(t)) return res.status(401).json({ error: '请先登录' });
  req.userId = sessions.get(t);
  next();
}

// 验证管理员权限：需登录 + 角色为 admin
function adminOnly(req, res, next) {
  const t = req.cookies.token;
  if (!t || !sessions.has(t)) return res.status(401).json({ error: '请先登录' });
  const userId = sessions.get(t);
  const user = read(DATA.users).find(u => u.id === userId);
  if (!user || user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  req.userId = userId;
  next();
}

// --- 认证 API：注册、登录、退出、获取当前用户 ---

app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
  if (username.length < 2 || username.length > 20) return res.status(400).json({ error: '用户名长度2-20个字符' });
  if (password.length < 6) return res.status(400).json({ error: '密码至少6个字符' });

  const users = read(DATA.users);
  if (users.find(u => u.username === username)) return res.status(400).json({ error: '用户名已存在' });

  const user = {
    id: Date.now(),
    username,
    password: bcrypt.hashSync(password, 10),
    role: 'user',
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  write(DATA.users, users);

  const t = genToken();
  sessions.set(t, user.id);
  res.cookie('token', t, { httpOnly: true, maxAge: 7 * 24 * 3600000 });
  res.json({ id: user.id, username: user.username, role: user.role });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });

  const users = read(DATA.users);
  const user = users.find(u => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(400).json({ error: '用户名或密码错误' });
  }

  const t = genToken();
  sessions.set(t, user.id);
  res.cookie('token', t, { httpOnly: true, maxAge: 7 * 24 * 3600000 });
  res.json({ id: user.id, username: user.username, role: user.role });
});

app.post('/api/auth/logout', (req, res) => {
  const t = req.cookies.token;
  if (t) sessions.delete(t);
  res.clearCookie('token');
  res.json({ message: '已退出登录' });
});

app.get('/api/auth/me', (req, res) => {
  const t = req.cookies.token;
  if (!t || !sessions.has(t)) return res.json(null);
  const userId = sessions.get(t);
  const user = read(DATA.users).find(u => u.id === userId);
  if (!user) return res.json(null);
  res.json({ id: user.id, username: user.username, role: user.role });
});

// --- 商品 API：公开读取，支持搜索/分类/排序 ---

app.get('/api/products', (req, res) => {
  let products = read(DATA.products);
  const { search, category, sort } = req.query;

  if (search) {
    const s = search.toLowerCase();
    products = products.filter(p =>
      p.name.toLowerCase().includes(s) || p.description.toLowerCase().includes(s)
    );
  }
  if (category && category !== '全部') {
    products = products.filter(p => p.category === category);
  }
  if (sort === 'asc') products.sort((a, b) => a.price - b.price);
  if (sort === 'desc') products.sort((a, b) => b.price - a.price);

  res.json(products);
});

app.get('/api/products/:id', (req, res) => {
  const product = read(DATA.products).find(p => p.id === Number(req.params.id));
  if (!product) return res.status(404).json({ error: '商品不存在' });
  res.json(product);
});

app.get('/api/categories', (req, res) => {
  const categories = [...new Set(read(DATA.products).map(p => p.category))];
  res.json(['全部', ...categories]);
});

// --- 收藏 API：登录用户可收藏/取消收藏商品 ---

app.get('/api/favorites', auth, (req, res) => {
  const favs = read(DATA.favorites);
  res.json(favs[req.userId] || []);
});

app.post('/api/favorites/:productId', auth, (req, res) => {
  const favs = read(DATA.favorites);
  const pid = Number(req.params.productId);
  if (!favs[req.userId]) favs[req.userId] = [];
  if (!favs[req.userId].includes(pid)) favs[req.userId].push(pid);
  write(DATA.favorites, favs);
  res.json(favs[req.userId]);
});

app.delete('/api/favorites/:productId', auth, (req, res) => {
  const favs = read(DATA.favorites);
  const pid = Number(req.params.productId);
  if (favs[req.userId]) {
    favs[req.userId] = favs[req.userId].filter(id => id !== pid);
  }
  write(DATA.favorites, favs);
  res.json(favs[req.userId] || []);
});

// --- 订单 API：下单时服务端验证商品价格和数量，防止客户端篡改 ---

app.post('/api/orders', auth, (req, res) => {
  const { name, phone, address, items } = req.body;
  if (!name || !phone || !address || !items?.length) {
    return res.status(400).json({ error: '请填写完整的收货信息' });
  }
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    return res.status(400).json({ error: '手机号格式不正确' });
  }

  const allProducts = read(DATA.products);
  const pMap = new Map(allProducts.map(p => [p.id, p]));
  let total = 0;
  const verified = [];

  for (const item of items) {
    const p = pMap.get(item.id);
    if (!p) return res.status(400).json({ error: `商品不存在（id: ${item.id}）` });
    if (!Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > MAX_QUANTITY) {
      return res.status(400).json({ error: '商品数量无效' });
    }
    total += p.price * item.quantity;
    verified.push({ id: p.id, name: p.name, price: p.price, quantity: item.quantity });
  }

  const orders = read(DATA.orders);
  const order = {
    id: Date.now(),
    userId: req.userId,
    name, phone, address,
    items: verified,
    total,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  orders.push(order);
  write(DATA.orders, orders);
  res.json({ message: '下单成功', order });
});

app.get('/api/orders', auth, (req, res) => {
  const orders = read(DATA.orders);
  const user = read(DATA.users).find(u => u.id === req.userId);
  res.json(user.role === 'admin' ? orders : orders.filter(o => o.userId === req.userId));
});

// --- 管理后台 API：商品 CRUD、订单状态管理、用户管理（仅管理员） ---

app.post('/api/admin/products', adminOnly, (req, res) => {
  const { name, price, category, description, image } = req.body;
  if (!name || price === null || price === undefined || !category) {
    return res.status(400).json({ error: '请填写商品名称、价格和分类' });
  }
  const products = read(DATA.products);
  const product = {
    id: Date.now(),
    name,
    price: Number(price),
    category,
    description: description || '',
    image: image || `https://picsum.photos/seed/${Date.now()}/400/300`,
  };
  products.push(product);
  write(DATA.products, products);
  res.json(product);
});

app.put('/api/admin/products/:id', adminOnly, (req, res) => {
  const products = read(DATA.products);
  const idx = products.findIndex(p => p.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: '商品不存在' });

  const { name, price, category, description, image } = req.body;
  if (name !== undefined) products[idx].name = name;
  if (price !== undefined) products[idx].price = Number(price);
  if (category !== undefined) products[idx].category = category;
  if (description !== undefined) products[idx].description = description;
  if (image !== undefined) products[idx].image = image;

  write(DATA.products, products);
  res.json(products[idx]);
});

app.delete('/api/admin/products/:id', adminOnly, (req, res) => {
  const products = read(DATA.products);
  const idx = products.findIndex(p => p.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: '商品不存在' });
  products.splice(idx, 1);
  write(DATA.products, products);
  res.json({ message: '已删除' });
});

// 订单状态流转：pending → paid → shipped → completed / cancelled


app.put('/api/admin/orders/:id/status', adminOnly, (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'paid', 'shipped', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: '无效的订单状态' });

  const orders = read(DATA.orders);
  const order = orders.find(o => o.id === Number(req.params.id));
  if (!order) return res.status(404).json({ error: '订单不存在' });
  order.status = status;
  write(DATA.orders, orders);
  res.json(order);
});

// 用户管理：管理员可切换角色，但不能操作自己

app.get('/api/admin/users', adminOnly, (req, res) => {
  const users = read(DATA.users).map(u => ({
    id: u.id, username: u.username, role: u.role, createdAt: u.createdAt,
  }));
  res.json(users);
});

app.put('/api/admin/users/:id/role', adminOnly, (req, res) => {
  const { role } = req.body;
  if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: '无效的角色' });

  const users = read(DATA.users);
  const user = users.find(u => u.id === Number(req.params.id));
  if (!user) return res.status(404).json({ error: '用户不存在' });
  if (user.id === req.userId) return res.status(400).json({ error: '不能修改自己的角色' });
  user.role = role;
  write(DATA.users, users);
  res.json({ id: user.id, username: user.username, role: user.role });
});

app.delete('/api/admin/users/:id', adminOnly, (req, res) => {
  const users = read(DATA.users);
  const idx = users.findIndex(u => u.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: '用户不存在' });
  if (users[idx].id === req.userId) return res.status(400).json({ error: '不能删除自己' });
  users.splice(idx, 1);
  write(DATA.users, users);
  res.json({ message: '已删除' });
});

// --- 初始化：首次启动自动创建默认管理员 ---

// 用户取消订单：仅允许取消自己的 pending/paid 状态订单
app.put('/api/orders/:id/cancel', auth, (req, res) => {
  const orders = read(DATA.orders);
  const order = orders.find(o => o.id === Number(req.params.id));
  if (!order) return res.status(404).json({ error: '订单不存在' });
  if (order.userId !== req.userId) return res.status(403).json({ error: '无权操作此订单' });
  if (order.status !== 'pending' && order.status !== 'paid') {
    return res.status(400).json({ error: '当前订单状态无法取消' });
  }
  order.status = 'cancelled';
  write(DATA.orders, orders);
  res.json(order);
});

function seedAdmin() {
  const users = read(DATA.users);
  if (!users.find(u => u.username === 'admin')) {
    users.push({
      id: 1,
      username: 'admin',
      password: bcrypt.hashSync('admin123', 10),
      role: 'admin',
      createdAt: new Date().toISOString(),
    });
    write(DATA.users, users);
    console.log('默认管理员: admin / admin123');
  }
}

seedAdmin();

// 仅在直接运行时启动服务器（被 require 时不启动，方便测试）
if (require.main === module) {
  app.listen(PORT, () => console.log(`服务器已启动：http://localhost:${PORT}`));
}

module.exports = app;
