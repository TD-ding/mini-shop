let currentUser = null;
let allProducts = [];
let cart = JSON.parse(localStorage.getItem('cart') || '[]');
let favoriteIds = [];
let currentSort = 'default';
let currentCategory = '全部';
let currentSearch = '';
let showFavoritesOnly = false;
let submitting = false;

const statusMap = { pending: '待处理', paid: '已付款', shipped: '已发货', completed: '已完成', cancelled: '已取消' };

function esc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'include',
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '请求失败');
  return data;
}

function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.getElementById('toast-container').appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function saveCart() { localStorage.setItem('cart', JSON.stringify(cart)); }

async function checkAuth() {
  try { currentUser = await api('/api/auth/me'); } catch { currentUser = null; }
  updateAuthUI();
}

function updateAuthUI() {
  const area = document.getElementById('auth-area');
  if (currentUser) {
    const roleClass = currentUser.role === 'admin' ? 'admin' : 'user';
    const roleLabel = currentUser.role === 'admin' ? '管理员' : '用户';
    area.innerHTML = `
      <div class="user-info">
        <span>${currentUser.username}</span>
        <span class="role-tag ${roleClass}">${roleLabel}</span>
        ${currentUser.role === 'admin' ? '<a href="/admin.html" class="btn btn-sm btn-warning">管理后台</a>' : ''}
      </div>
      <button class="btn btn-sm btn-outline" id="logout-btn">退出</button>`;
    document.getElementById('logout-btn').addEventListener('click', logout);
  } else {
    area.innerHTML = `<a href="/login.html?redirect=' + encodeURIComponent(location.pathname) + '" class="btn btn-sm btn-primary">登录 / 注册</a>`;
  }
}

async function logout() {
  await api('/api/auth/logout', { method: 'POST' });
  currentUser = null;
  favoriteIds = [];
  updateAuthUI();
  showToast('已退出登录', 'info');
}

function switchPage(page) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === `page-${page}`));
  if (page === 'cart') renderCart();
  else if (page === 'orders') loadOrders();
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => switchPage(btn.dataset.page));
});

async function loadProducts() {
  allProducts = await api('/api/products');
  renderFilteredProducts();
}

async function loadCategories() {
  const categories = await api('/api/categories');
  const bar = document.getElementById('category-bar');
  bar.innerHTML = '<button class="fav-filter-btn" id="fav-filter-btn">❤️ 仅看收藏</button>' +
    categories.map(c => `<button class="cat-btn${c === currentCategory ? ' active' : ''}" data-cat="${c}">${c}</button>`).join('');

  bar.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentCategory = btn.dataset.cat;
      bar.querySelectorAll('.cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === currentCategory));
      renderFilteredProducts();
    });
  });

  document.getElementById('fav-filter-btn').addEventListener('click', () => {
    if (!currentUser) return showToast('请先登录', 'error');
    showFavoritesOnly = !showFavoritesOnly;
    document.getElementById('fav-filter-btn').classList.toggle('active', showFavoritesOnly);
    renderFilteredProducts();
  });
}

function renderFilteredProducts() {
  let filtered = [...allProducts];
  if (currentSearch) {
    const s = currentSearch.toLowerCase();
    filtered = filtered.filter(p => p.name.toLowerCase().includes(s) || p.description.toLowerCase().includes(s));
  }
  if (currentCategory && currentCategory !== '全部') filtered = filtered.filter(p => p.category === currentCategory);
  if (showFavoritesOnly) filtered = filtered.filter(p => favoriteIds.includes(p.id));
  if (currentSort === 'asc') filtered.sort((a, b) => a.price - b.price);
  if (currentSort === 'desc') filtered.sort((a, b) => b.price - a.price);
  renderProducts(filtered);
}

function renderProducts(products) {
  const grid = document.getElementById('product-grid');
  if (!products.length) { grid.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div>没有找到商品</div>'; return; }

  grid.innerHTML = products.map(p => {
    const isFav = favoriteIds.includes(p.id);
    return `<div class="product-card" data-id="${p.id}">
      <img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">
      <div class="card-body">
        <span class="card-category">${esc(p.category)}</span>
        <div class="card-title">${esc(p.name)}</div>
        <div class="card-footer">
          <span class="price">${p.price}</span>
          <div class="card-actions">
            <button class="fav-btn" data-fav="${p.id}">${isFav ? '❤️' : '🤍'}</button>
            <button class="btn btn-sm btn-primary" data-add="${p.id}">加入购物车</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');

  grid.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('[data-add]') || e.target.closest('[data-fav]')) return;
      openDetail(Number(card.dataset.id));
    });
  });
  grid.querySelectorAll('[data-add]').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); addToCart(Number(btn.dataset.add)); }));
  grid.querySelectorAll('[data-fav]').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); toggleFavorite(Number(btn.dataset.fav)); }));
}

const searchInput = document.getElementById('search-input');
const searchClear = document.getElementById('search-clear');
searchInput.addEventListener('input', () => { currentSearch = searchInput.value.trim(); searchClear.classList.toggle('hidden', !currentSearch); renderFilteredProducts(); });
searchClear.addEventListener('click', () => { searchInput.value = ''; currentSearch = ''; searchClear.classList.add('hidden'); renderFilteredProducts(); });

document.querySelectorAll('.sort-btn').forEach(btn => {
  btn.addEventListener('click', () => { currentSort = btn.dataset.sort; document.querySelectorAll('.sort-btn').forEach(b => b.classList.toggle('active', b.dataset.sort === currentSort)); renderFilteredProducts(); });
});

async function loadFavorites() {
  if (!currentUser) { favoriteIds = []; return; }
  try { favoriteIds = await api('/api/favorites'); } catch { favoriteIds = []; }
}

async function toggleFavorite(productId) {
  if (!currentUser) return showToast('请先登录', 'error');
  try {
    if (favoriteIds.includes(productId)) { favoriteIds = await api(`/api/favorites/${productId}`, { method: 'DELETE' }); showToast('已取消收藏', 'info'); }
    else { favoriteIds = await api(`/api/favorites/${productId}`, { method: 'POST' }); showToast('已收藏'); }
    renderFilteredProducts();
  } catch (err) { showToast(err.message, 'error'); }
}

function addToCart(productId) {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;
  const item = cart.find(c => c.id === productId);
  if (item) { if (item.quantity >= 99) return showToast('最多购买99件', 'error'); item.quantity++; }
  else { cart.push({ id: productId, quantity: 1 }); }
  saveCart(); updateCartCount(); showToast(`已添加 ${product.name}`);
}

function updateCartCount() { document.getElementById('cart-count').textContent = cart.reduce((s, c) => s + c.quantity, 0); }

function renderCart() {
  const container = document.getElementById('cart-content');
  if (!cart.length) { container.innerHTML = '<div class="empty-state"><div class="empty-icon">🛒</div>购物车是空的</div>'; return; }
  const pMap = new Map(allProducts.map(p => [p.id, p]));
  let total = 0;
  container.innerHTML = cart.map((item, idx) => {
    const p = pMap.get(item.id); if (!p) return '';
    const itemTotal = p.price * item.quantity; total += itemTotal;
    return `<div class="cart-item">
      <img src="${esc(p.image)}" alt="${esc(p.name)}">
      <div class="cart-item-info"><div class="name">${esc(p.name)}</div><div class="unit-price">¥${p.price} / 件</div></div>
      <div class="qty-control"><button data-qty-minus="${idx}">-</button><span>${item.quantity}</span><button data-qty-plus="${idx}">+</button></div>
      <span class="item-total">¥${itemTotal.toFixed(2)}</span>
      <button class="remove-btn" data-remove="${idx}">&times;</button>
    </div>`;
  }).join('') + `<div class="cart-footer"><span class="cart-total">合计：¥${total.toFixed(2)}</span><button class="btn btn-primary" id="checkout-btn">去结算</button></div>`;

  container.querySelectorAll('[data-qty-minus]').forEach(btn => btn.addEventListener('click', () => { const i = Number(btn.dataset.qtyMinus); if (cart[i].quantity > 1) cart[i].quantity--; saveCart(); updateCartCount(); renderCart(); }));
  container.querySelectorAll('[data-qty-plus]').forEach(btn => btn.addEventListener('click', () => { const i = Number(btn.dataset.qtyPlus); if (cart[i].quantity < 99) cart[i].quantity++; saveCart(); updateCartCount(); renderCart(); }));
  container.querySelectorAll('[data-remove]').forEach(btn => btn.addEventListener('click', () => { cart.splice(Number(btn.dataset.remove), 1); saveCart(); updateCartCount(); renderCart(); }));
  document.getElementById('checkout-btn').addEventListener('click', () => { if (!currentUser) { showToast('请先登录', 'error'); setTimeout(() => window.location.href = '/login.html?redirect=' + encodeURIComponent(location.pathname), 1200); return; } openCheckout(); });
}

const detailModal = document.getElementById('detail-modal');
document.getElementById('detail-close').addEventListener('click', () => detailModal.classList.remove('active'));
detailModal.addEventListener('click', e => { if (e.target === detailModal) detailModal.classList.remove('active'); });

function openDetail(id) {
  const p = allProducts.find(x => x.id === id); if (!p) return;
  document.getElementById('detail-title').textContent = p.name;
  document.getElementById('detail-img').src = p.image;
  document.getElementById('detail-category').textContent = p.category;
  document.getElementById('detail-desc').textContent = p.description;
  document.getElementById('detail-price').textContent = `¥${p.price}`;
  document.getElementById('detail-add-cart').onclick = () => { addToCart(p.id); detailModal.classList.remove('active'); };
  const favBtn = document.getElementById('detail-fav-btn');
  favBtn.textContent = favoriteIds.includes(p.id) ? '❤️ 已收藏' : '🤍 收藏';
  favBtn.onclick = async () => { await toggleFavorite(p.id); favBtn.textContent = favoriteIds.includes(p.id) ? '❤️ 已收藏' : '🤍 收藏'; };
  detailModal.classList.add('active');
}

const checkoutModal = document.getElementById('checkout-modal');
document.getElementById('modal-close').addEventListener('click', () => checkoutModal.classList.remove('active'));
checkoutModal.addEventListener('click', e => { if (e.target === checkoutModal) checkoutModal.classList.remove('active'); });

function openCheckout() {
  const pMap = new Map(allProducts.map(p => [p.id, p])); let total = 0;
  const summary = cart.map(item => { const p = pMap.get(item.id); if (!p) return ''; const sub = p.price * item.quantity; total += sub; return `<div class="summary-item"><span>${esc(p.name)} × ${item.quantity}</span><span>¥${sub.toFixed(2)}</span></div>`; }).join('');
  document.getElementById('order-summary').innerHTML = summary + `<div class="summary-total"><span>合计</span><span>¥${total.toFixed(2)}</span></div>`;
  document.getElementById('checkout-form').reset();
  checkoutModal.classList.add('active');
}

document.getElementById('checkout-form').addEventListener('submit', async e => {
  e.preventDefault(); if (submitting) return; submitting = true;
  try {
    await api('/api/orders', { method: 'POST', body: JSON.stringify({ name: document.getElementById('order-name').value.trim(), phone: document.getElementById('order-phone').value.trim(), address: document.getElementById('order-address').value.trim(), items: cart }) });
    cart = []; saveCart(); updateCartCount(); checkoutModal.classList.remove('active'); showToast('下单成功！'); switchPage('orders');
  } catch (err) { showToast(err.message, 'error'); } finally { submitting = false; }
});

async function loadOrders() {
  if (!currentUser) { document.getElementById('orders-content').innerHTML = '<div class="empty-state"><div class="empty-icon">🔐</div>请先登录查看订单</div>'; return; }
  try { const orders = await api('/api/orders'); renderOrders(orders); } catch (err) { document.getElementById('orders-content').innerHTML = `<div class="empty-state">${err.message}</div>`; }
}

function renderOrders(orders) {
  const container = document.getElementById('orders-content');
  if (!orders.length) { container.innerHTML = '<div class="empty-state"><div class="empty-icon">📦</div>暂无订单</div>'; return; }
  container.innerHTML = [...orders].reverse().map(o => `<div class="order-card">
    <div class="order-header"><span class="order-id">订单号：${o.id}</span><div class="order-header-actions"><span class="status-badge ${o.status}">${statusMap[o.status] || o.status}</span></div>
    <div class="order-items">${o.items.map(i => `<div class="order-item"><span>${esc(i.name)} × ${i.quantity}</span><span>¥${(i.price * i.quantity).toFixed(2)}</span></div>`).join('')}</div>
    <div class="order-footer"><span>${formatDate(o.createdAt)}</span><span class="order-total">¥${o.total.toFixed(2)}</span></div>
  </div>`).join('');
}


window.cancelOrder = async function(id) {
  if (!confirm('确定要取消这个订单吗？')) return;
  try {
    await api(`/api/orders/${id}/cancel`, { method: 'PUT' });
    showToast('订单已取消', 'info');
    loadOrders();
  } catch (err) { showToast(err.message, 'error'); }
};

(async () => {
  await checkAuth();
  await loadCategories();
  await loadFavorites();
  await loadProducts();
  updateCartCount();
})();
