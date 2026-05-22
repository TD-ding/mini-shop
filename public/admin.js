let currentUser = null;

async function api(url, options = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json', ...options.headers }, credentials: 'include', ...options });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '请求失败');
  return data;
}

function showToast(msg, type = 'success') {
  const t = document.createElement('div'); t.className = `toast ${type}`; t.textContent = msg;
  document.getElementById('toast-container').appendChild(t); setTimeout(() => t.remove(), 3000);
}

function formatDate(iso) {
  if (!iso) return '-'; const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

const statusMap = { pending: '待处理', paid: '已付款', shipped: '已发货', completed: '已完成', cancelled: '已取消' };

async function checkAuth() {
  try {
    const user = await api('/api/auth/me');
    if (!user || user.role !== 'admin') { window.location.href = '/login.html'; return; }
    currentUser = user;
  } catch { window.location.href = '/login.html'; }
}

const navItems = document.querySelectorAll('.admin-nav-item[data-section]');
navItems.forEach(item => {
  item.addEventListener('click', () => {
    navItems.forEach(n => n.classList.remove('active')); item.classList.add('active');
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    document.getElementById(`section-${item.dataset.section}`).classList.add('active');
    loadSection(item.dataset.section);
  });
});
document.getElementById('back-to-shop').addEventListener('click', () => { window.location.href = '/'; });

function loadSection(section) { if (section === 'products') loadProducts(); else if (section === 'orders') loadOrders(); else if (section === 'users') loadUsers(); }

async function loadProducts() {
  const products = await api('/api/products');
  document.getElementById('products-tbody').innerHTML = products.map(p => `<tr>
    <td>${p.id}</td><td><img src="${p.image}" alt="" style="width:50px;height:36px;object-fit:cover;border-radius:4px;"></td>
    <td>${p.name}</td><td>${p.category}</td><td>¥${p.price}</td>
    <td class="table-actions"><button class="btn btn-sm btn-outline" onclick="editProduct(${p.id})">编辑</button><button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.id})">删除</button></td>
  </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:#999;">暂无商品</td></tr>';
}

const productModal = document.getElementById('product-modal');
const productForm = document.getElementById('product-form');
document.getElementById('add-product-btn').addEventListener('click', () => {
  document.getElementById('product-modal-title').textContent = '添加商品'; productForm.reset(); document.getElementById('pf-id').value = ''; productModal.classList.add('active');
});
document.getElementById('product-modal-close').addEventListener('click', () => productModal.classList.remove('active'));
productModal.addEventListener('click', e => { if (e.target === productModal) productModal.classList.remove('active'); });

productForm.addEventListener('submit', async e => {
  e.preventDefault();
  const id = document.getElementById('pf-id').value;
  const body = { name: document.getElementById('pf-name').value.trim(), price: parseFloat(document.getElementById('pf-price').value), category: document.getElementById('pf-category').value.trim(), description: document.getElementById('pf-desc').value.trim(), image: document.getElementById('pf-image').value.trim() };
  try {
    if (id) { await api(`/api/admin/products/${id}`, { method: 'PUT', body: JSON.stringify(body) }); showToast('商品已更新'); }
    else { await api('/api/admin/products', { method: 'POST', body: JSON.stringify(body) }); showToast('商品已添加'); }
    productModal.classList.remove('active'); loadProducts();
  } catch (err) { showToast(err.message, 'error'); }
});

window.editProduct = async function(id) {
  const products = await api('/api/products'); const p = products.find(x => x.id === id); if (!p) return;
  document.getElementById('product-modal-title').textContent = '编辑商品';
  document.getElementById('pf-id').value = p.id; document.getElementById('pf-name').value = p.name;
  document.getElementById('pf-price').value = p.price; document.getElementById('pf-category').value = p.category;
  document.getElementById('pf-desc').value = p.description || ''; document.getElementById('pf-image').value = p.image || '';
  productModal.classList.add('active');
};

window.deleteProduct = async function(id) {
  if (!confirm('确定要删除这个商品吗？')) return;
  try { await api(`/api/admin/products/${id}`, { method: 'DELETE' }); showToast('已删除'); loadProducts(); } catch (err) { showToast(err.message, 'error'); }
};

async function loadOrders() {
  const orders = await api('/api/orders');
  document.getElementById('orders-tbody').innerHTML = orders.map(o => `<tr>
    <td>${o.id}</td><td>${o.userId}</td><td>${o.name}</td><td>¥${o.total}</td>
    <td><span class="status-badge ${o.status}">${statusMap[o.status] || o.status}</span></td><td>${formatDate(o.createdAt)}</td>
    <td class="table-actions"><button class="btn btn-sm btn-outline" onclick="viewOrder(${o.id})">详情</button>
    <select onchange="updateOrderStatus(${o.id}, this.value)" class="btn btn-sm btn-outline" style="padding:5px 8px;">
    ${Object.entries(statusMap).map(([k, v]) => `<option value="${k}" ${o.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></td>
  </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;color:#999;">暂无订单</td></tr>';
}

window.updateOrderStatus = async function(id, status) {
  try { await api(`/api/admin/orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }); showToast('状态已更新'); loadOrders(); } catch (err) { showToast(err.message, 'error'); }
};

const orderDetailModal = document.getElementById('order-detail-modal');
document.getElementById('order-detail-close').addEventListener('click', () => orderDetailModal.classList.remove('active'));
orderDetailModal.addEventListener('click', e => { if (e.target === orderDetailModal) orderDetailModal.classList.remove('active'); });

window.viewOrder = async function(id) {
  const orders = await api('/api/orders'); const o = orders.find(x => x.id === id); if (!o) return;
  document.getElementById('order-detail-body').innerHTML = `
    <p><strong>订单号：</strong>${o.id}</p><p><strong>收货人：</strong>${o.name}</p>
    <p><strong>手机号：</strong>${o.phone}</p><p><strong>地址：</strong>${o.address}</p>
    <p><strong>状态：</strong><span class="status-badge ${o.status}">${statusMap[o.status]}</span></p>
    <p><strong>时间：</strong>${formatDate(o.createdAt)}</p>
    <h3 style="margin:16px 0 8px;font-size:0.95rem;">商品列表</h3>
    ${o.items.map(i => `<div class="order-item"><span>${i.name} × ${i.quantity}</span><span>¥${(i.price * i.quantity).toFixed(2)}</span></div>`).join('')}
    <div class="order-item" style="font-weight:700;border-top:1px solid var(--border);padding-top:8px;margin-top:8px;"><span>合计</span><span>¥${o.total.toFixed(2)}</span></div>`;
  orderDetailModal.classList.add('active');
};

async function loadUsers() {
  const users = await api('/api/admin/users');
  document.getElementById('users-tbody').innerHTML = users.map(u => `<tr>
    <td>${u.id}</td><td>${u.username}</td>
    <td><span class="status-badge ${u.role === 'admin' ? 'admin' : 'user'}">${u.role === 'admin' ? '管理员' : '普通用户'}</span></td>
    <td>${formatDate(u.createdAt)}</td>
    <td class="table-actions"><button class="btn btn-sm btn-outline" onclick="toggleRole(${u.id}, '${u.role === 'admin' ? 'user' : 'admin'}')">${u.role === 'admin' ? '设为用户' : '设为管理员'}</button>
    ${u.id !== currentUser.id ? `<button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id})">删除</button>` : ''}</td>
  </tr>`).join('');
}

window.toggleRole = async function(id, role) {
  try { await api(`/api/admin/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }); showToast('角色已更新'); loadUsers(); } catch (err) { showToast(err.message, 'error'); }
};

window.deleteUser = async function(id) {
  if (!confirm('确定要删除该用户吗？')) return;
  try { await api(`/api/admin/users/${id}`, { method: 'DELETE' }); showToast('用户已删除'); loadUsers(); } catch (err) { showToast(err.message, 'error'); }
};

(async () => { await checkAuth(); loadProducts(); })();
