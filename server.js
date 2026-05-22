const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'mini-shop-secret-change-in-production';

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const dataDir = path.join(__dirname, 'data');

function readJSON(file) {
  const fp = path.join(dataDir, file);
  if (!fs.existsSync(fp)) return [];
  try { return JSON.parse(fs.readFileSync(fp, 'utf-8')); }
  catch { return []; }
}

function writeJSON(file, data) {
  fs.writeFileSync(path.join(dataDir, file), JSON.stringify(data, null, 2), 'utf-8');
}

function auth(req, res, next) {
  const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '请先登录' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.clearCookie('token');
    res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  next();
}

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });
  next();
});

// ========== Auth ==========

app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '请填写用户名和密码' });
  if (username.length < 3 || username.length > 20) return res.status(400).json({ error: '用户名需3-20个字符' });
  if (!/^[\w一-龥]+$/.test(username)) return res.status(400).json({ error: '用户名只能包含字母、数字、下划线和中文' });
  if (password.length < 6) return res.status(400).json({ error: '密码至少6个字符' });

  const users = readJSON('users.json');
  if (users.find(u => u.username === username)) return res.status(400).json({ error: '用户名已存在' });

  const hashed = bcrypt.hashSync(password, 10);
  const user = { id: Date.now(), username, password: hashed, role: 'user', createdAt: new Date().toISOString() };
  users.push(user);
  writeJSON('users.json', users);

  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 3600 * 1000 });
  res.json({ message: '注册成功', user: { id: user.id, username: user.username, role: user.role } });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '请填写用户名和密码' });

  const users = readJSON('users.json');
  const user = users.find(u => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.password)) return res.status(400).json({ error: '用户名或密码错误' });

  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 3600 * 1000 });
  res.json({ message: '登录成功', user: { id: user.id, username: user.username, role: user.role } });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: '已退出登录' });
});

app.get('/api/me', auth, (req, res) => {
  const users = readJSON('users.json');
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json({ id: user.id, username: user.username, role: user.role, createdAt: user.createdAt });
});

// ========== Products ==========

app.get('/api/products', (req, res) => {
  res.json(readJSON('products.json'));
});

app.get('/api/categories', (req, res) => {
  const products = readJSON('products.json');
  res.json([...new Set(products.map(p => p.category))]);
});

app.post('/api/products', auth, adminOnly, (req, res) => {
  const { name, price, category, image, description } = req.body;
  if (!name || price == null || !category) return res.status(400).json({ error: '请填写商品名称、价格和分类' });
  if (price <= 0) return res.status(400).json({ error: '价格必须大于0' });

  const products = readJSON('products.json');
  const product = {
    id: Date.now(),
    name: String(name).slice(0, 100),
    price: Number(price),
    category: String(category).slice(0, 30),
    image: String(image || 'https://picsum.photos/seed/default/400/300'),
    description: String(description || '').slice(0, 500)
  };
  products.push(product);
  writeJSON('products.json', products);
  res.json({ message: '商品添加成功', product });
});

app.put('/api/products/:id', auth, adminOnly, (req, res) => {
  const id = Number(req.params.id);
  const products = readJSON('products.json');
  const idx = products.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ error: '商品不存在' });

  const { name, price, category, image, description } = req.body;
  if (name !== undefined) products[idx].name = String(name).slice(0, 100);
  if (price !== undefined) {
    if (price <= 0) return res.status(400).json({ error: '价格必须大于0' });
    products[idx].price = Number(price);
  }
  if (category !== undefined) products[idx].category = String(category).slice(0, 30);
  if (image !== undefined) products[idx].image = String(image);
  if (description !== undefined) products[idx].description = String(description).slice(0, 500);

  writeJSON('products.json', products);
  res.json({ message: '商品更新成功', product: products[idx] });
});

app.delete('/api/products/:id', auth, adminOnly, (req, res) => {
  const id = Number(req.params.id);
  const products = readJSON('products.json');
  const filtered = products.filter(p => p.id !== id);
  if (filtered.length === products.length) return res.status(404).json({ error: '商品不存在' });
  writeJSON('products.json', filtered);
  res.json({ message: '商品已删除' });
});

// ========== Orders ==========

const MAX_QUANTITY = 99;

app.post('/api/orders', auth, (req, res) => {
  const { name, phone, address, items } = req.body;
  if (!name || !phone || !address || !items?.length) return res.status(400).json({ error: '请填写完整的收货信息' });
  if (!/^1[3-9]\d{9}$/.test(phone)) return res.status(400).json({ error: '手机号格式不正确' });

  const allProducts = readJSON('products.json');
  const pMap = new Map(allProducts.map(p => [p.id, p]));
  let total = 0;
  const verified = [];
  for (const item of items) {
    const p = pMap.get(item.id);
    if (!p) return res.status(400).json({ error: `商品不存在（id: ${item.id}）` });
    if (!Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > MAX_QUANTITY) return res.status(400).json({ error: '商品数量无效' });
    total += p.price * item.quantity;
    verified.push({ id: p.id, name: p.name, price: p.price, quantity: item.quantity });
  }

  const orders = readJSON('orders.json');
  const order = { id: Date.now(), userId: req.user.id, name, phone, address, items: verified, total, status: 'pending', createdAt: new Date().toISOString() };
  orders.push(order);
  writeJSON('orders.json', orders);
  res.json({ message: '下单成功', order });
});

app.get('/api/orders', auth, (req, res) => {
  const orders = readJSON('orders.json');
  if (req.user.role === 'admin') return res.json(orders);
  res.json(orders.filter(o => o.userId === req.user.id));
});

app.put('/api/orders/:id/status', auth, (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;
  const validStatuses = ['pending', 'shipped', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: '无效的订单状态' });

  const orders = readJSON('orders.json');
  const order = orders.find(o => o.id === id);
  if (!order) return res.status(404).json({ error: '订单不存在' });

  // Regular users can only cancel their own pending orders
  if (req.user.role !== 'admin') {
    if (order.userId !== req.user.id) return res.status(403).json({ error: '无权操作此订单' });
    if (status !== 'cancelled') return res.status(403).json({ error: '用户只能取消订单' });
    if (order.status !== 'pending') return res.status(400).json({ error: '只能取消待发货订单' });
  }

  order.status = status;
  writeJSON('orders.json', orders);
  res.json({ message: '订单状态已更新', order });
});

// ========== Admin: Users ==========

app.get('/api/users', auth, adminOnly, (req, res) => {
  const users = readJSON('users.json').map(u => ({ id: u.id, username: u.username, role: u.role, createdAt: u.createdAt }));
  res.json(users);
});

app.delete('/api/users/:id', auth, adminOnly, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: '不能删除自己' });
  const users = readJSON('users.json');
  const filtered = users.filter(u => u.id !== id);
  if (filtered.length === users.length) return res.status(404).json({ error: '用户不存在' });
  writeJSON('users.json', filtered);
  res.json({ message: '用户已删除' });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`服务器已启动：http://localhost:${PORT}`);
});
