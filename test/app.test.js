const request = require('supertest');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SERVER = path.join(__dirname, '..', 'server.js');

//备份原始数据，测试后恢复
const originals = {};
beforeAll(() => {
  for (const f of fs.readdirSync(DATA_DIR)) {
    originals[f] = fs.readFileSync(path.join(DATA_DIR, f), 'utf-8');
  }
});
afterAll(() => {
  for (const [f, content] of Object.entries(originals)) {
    fs.writeFileSync(path.join(DATA_DIR, f), content);
  }
});

// Helper: 获取 express app（不监听端口，避免 EADDRINUSE）
let app;
beforeAll(() => {
  // 重置数据到已知状态
  fs.writeFileSync(path.join(DATA_DIR, 'users.json'), '[]');
  fs.writeFileSync(path.join(DATA_DIR, 'orders.json'), '[]');
  fs.writeFileSync(path.join(DATA_DIR, 'favorites.json'), '{}');
  fs.writeFileSync(
    path.join(DATA_DIR, 'products.json'),
    JSON.stringify([
      { id: 1, name: '测试商品', price: 100, category: '测试', description: '用于测试', image: 'test.jpg' },
    ])
  );

  // 清除 require 缓存，重新加载 server
  delete require.cache[require.resolve(SERVER)];
  app = require(SERVER);
});

// --- 认证测试 ---
describe('Auth API', () => {
  test('注册新用户', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', password: '123456' });
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('testuser');
    expect(res.body.role).toBe('user');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  test('注册重复用户名失败', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', password: '123456' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('已存在');
  });

  test('注册参数校验 - 用户名太短', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'a', password: '123456' });
    expect(res.status).toBe(400);
  });

  test('注册参数校验 - 密码太短', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'validuser', password: '12' });
    expect(res.status).toBe(400);
  });

  test('登录成功', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: '123456' });
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('testuser');
  });

  test('登录失败 - 错误密码', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'wrong' });
    expect(res.status).toBe(400);
  });

  test('获取当前用户信息 - 已登录', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: '123456' });
    const cookie = loginRes.headers['set-cookie'][0].split(';')[0];

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('testuser');
  });

  test('获取当前用户信息 - 未登录', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  test('退出登录', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: '123456' });
    const cookie = loginRes.headers['set-cookie'][0].split(';')[0];

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
  });
});

// --- 商品测试 ---
describe('Products API', () => {
  test('获取商品列表', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('获取单个商品', async () => {
    const res = await request(app).get('/api/products/1');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('测试商品');
  });

  test('获取不存在的商品', async () => {
    const res = await request(app).get('/api/products/99999');
    expect(res.status).toBe(404);
  });

  test('搜索商品', async () => {
    const res = await request(app).get('/api/products?search=测试');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('按分类筛选', async () => {
    const res = await request(app).get('/api/products?category=测试');
    expect(res.status).toBe(200);
    expect(res.body.every(p => p.category === '测试')).toBe(true);
  });

  test('获取分类列表', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body).toContain('全部');
    expect(res.body).toContain('测试');
  });
});

// --- 订单测试 ---
describe('Orders API', () => {
  let cookie;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: '123456' });
    cookie = loginRes.headers['set-cookie'][0].split(';')[0];
  });

  test('下单成功', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Cookie', cookie)
      .send({
        name: '张三',
        phone: '13800138000',
        address: '北京市朝阳区',
        items: [{ id: 1, quantity: 2 }],
      });
    expect(res.status).toBe(200);
    expect(res.body.order.total).toBe(200);
    expect(res.body.order.items[0].price).toBe(100);
  });

  test('下单 - 服务端验证价格（忽略客户端传入的价格）', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Cookie', cookie)
      .send({
        name: '李四',
        phone: '13900139000',
        address: '上海市浦东新区',
        items: [{ id: 1, quantity: 1, price: 1 }], // 客户端传 price=1，服务端应为 100
      });
    expect(res.status).toBe(200);
    expect(res.body.order.items[0].price).toBe(100);
  });

  test('下单 - 手机号格式错误', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Cookie', cookie)
      .send({
        name: '王五',
        phone: '123',
        address: '广州市',
        items: [{ id: 1, quantity: 1 }],
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('手机号');
  });

  test('下单 - 商品不存在', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Cookie', cookie)
      .send({
        name: '赵六',
        phone: '13800138001',
        address: '深圳市',
        items: [{ id: 99999, quantity: 1 }],
      });
    expect(res.status).toBe(400);
  });

  test('下单 - 未登录', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({
        name: '孙七',
        phone: '13800138002',
        address: '成都市',
        items: [{ id: 1, quantity: 1 }],
      });
    expect(res.status).toBe(401);
  });

  test('获取订单列表', async () => {
    const res = await request(app)
      .get('/api/orders')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });
});

// --- 收藏测试 ---
describe('Favorites API', () => {
  let cookie;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: '123456' });
    cookie = loginRes.headers['set-cookie'][0].split(';')[0];
  });

  test('添加收藏', async () => {
    const res = await request(app)
      .post('/api/favorites/1')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body).toContain(1);
  });

  test('获取收藏列表', async () => {
    const res = await request(app)
      .get('/api/favorites')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body).toContain(1);
  });

  test('取消收藏', async () => {
    const res = await request(app)
      .delete('/api/favorites/1')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body).not.toContain(1);
  });

  test('未登录无法收藏', async () => {
    const res = await request(app).post('/api/favorites/1');
    expect(res.status).toBe(401);
  });
});
