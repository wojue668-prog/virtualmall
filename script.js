// ============================================================
// VirtualMall 前台逻辑：商品展示 / 购物车 / 支付 / 订单
// 前端调用后端 API（server.js），数据持久化到 SQLite
// ============================================================

// ---------- 全局状态 ----------
let allProducts = [];   // 从 /api/products 获取
let currentPage = 'home';

// ---------- API 基础地址 ----------
const API_BASE = '';  // 同源部署，直接相对路径

// ---------- 分类（静态，与后台一致）----------
const CATEGORIES = [
  { key:'游戏充值',   emoji:'🎮' },
  { key:'流媒体会员', emoji:'🎬' },
  { key:'应用商店卡', emoji:'📱' },
  { key:'AI服务',     emoji:'🤖' },
  { key:'云存储',     emoji:'☁️' },
  { key:'音乐会员',   emoji:'🎵' },
  { key:'学习会员',   emoji:'📚' },
  { key:'礼品卡',     emoji:'💳' },
];

// ============================================================
// 初始化
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  loadProducts().then(() => {
    initHome();
    startAuto();
    const c = document.querySelector('.carousel');
    if (c) {
      c.addEventListener('mouseenter', stopAuto);
      c.addEventListener('mouseleave', startAuto);
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft')  changeSlide(-1);
    if (e.key === 'ArrowRight') changeSlide(1);
  });
});

// ============================================================
// API 调用：加载商品
// ============================================================
async function loadProducts() {
  try {
    const res  = await fetch('/api/products');
    const json = await res.json();
    if (json.success) {
      allProducts = json.data;
    } else {
      console.error('加载商品失败：', json.message);
      allProducts = [];
    }
  } catch (e) {
    console.error('API 请求失败：', e);
    allProducts = [];
  }
  updateCartCount();
}

// ============================================================
// 工具：获取商品 / 分类商品数
// ============================================================
function getProducts() {
  return allProducts;
}
function getCategoryCount(cat) {
  return allProducts.filter(p => p.category === cat).length;
}

// ============================================================
// 页面路由
// ============================================================
function goHome(){
  showPage('home');
  initHome();
}
function goProducts(){
  showPage('products');
  renderProductList();
}
function goCart(e){ if(e) e.preventDefault(); showPage('cart'); renderCart(); }
function goOrders(){ showPage('orders'); renderOrdersPage(); }

function showPage(name){
  ['home','products','detail','cart','checkout','pay','success','orders'].forEach(p => {
    const el = document.getElementById('page-' + p);
    if (el) el.style.display = p === name ? 'block' : 'none';
  });
  currentPage = name;
  window.scrollTo(0, 0);
}

// ============================================================
// 首页渲染
// ============================================================
function initHome(){
  // 分类
  const catDiv = document.getElementById('homeCategories');
  if (catDiv) {
    catDiv.innerHTML = CATEGORIES.map(c => `
      <a href="#" class="category-card" onclick="filterByCategory('${c.key}');return false;">
        <div class="category-icon">${c.emoji}</div>
        <h3>${c.key}</h3>
        <span class="category-count">${getCategoryCount(c.key)} 件商品</span>
      </a>`).join('');
  }
  // 热门商品（前6个）
  const prodDiv = document.getElementById('homeProducts');
  if (prodDiv) {
    prodDiv.innerHTML = allProducts.slice(0, 6).map(p => productCardHtml(p)).join('');
    bindProductCards(prodDiv);
  }
  updateCartCount();
  startCountdown();
}

function filterByCategory(cat){
  showPage('products');
  const sel = document.getElementById('productCategoryFilter');
  if (sel) sel.value = cat;
  renderProductList();
}

function productCardHtml(p){
  const badge = p.badge==='hot' ? '<div class="product-badge hot">热销</div>'
             : p.badge==='new' ? '<div class="product-badge new">新品</div>'
             : p.badge==='sale' ? '<div class="product-badge sale">促销</div>'
             : '<div class="product-badge" style="background:#eee;color:#999;">--</div>';
  const stars    = '★'.repeat(Math.floor(p.rating||5)) + '☆'.repeat(5 - Math.floor(p.rating||5));
  const discount = p.original_price ? Math.round(p.price / p.original_price * 10 * 10) / 10 + '折' : '';
  return `<div class="product-card" data-id="${p.id}">
    ${badge}
    <div class="product-image">${p.emoji}</div>
    <div class="product-info">
      <h3 class="product-name">${p.name}</h3>
      <p class="product-desc">${p.description}</p>
      <div class="product-rating"><span class="stars">${stars}</span><span class="rating-count">${(p.reviews||0).toLocaleString()} 评价</span></div>
      <div class="product-price">
        <span class="price-current">¥${p.price}</span>
        ${p.original_price ? `<span class="price-original">¥${p.original_price}</span><span class="price-discount">${discount}</span>` : ''}
      </div>
      <div class="product-sales">已售 ${(p.sales||0).toLocaleString()} 件</div>
      <button class="buy-btn" data-id="${p.id}">加入购物车</button>
    </div>
  </div>`;
}

function bindProductCards(container){
  container.querySelectorAll('.buy-btn').forEach(btn => {
    btn.addEventListener('click', function(e){ e.stopPropagation(); addToCart(parseInt(this.dataset.id)); });
  });
  container.querySelectorAll('.product-card').forEach(card => {
    card.style.cursor = 'pointer';
    card.addEventListener('click', function(){ viewProduct(parseInt(this.dataset.id)); });
  });
}

// ============================================================
// 商品列表
// ============================================================
function renderProductList(){
  const search = (document.getElementById('productSearchInput')||{}).value || '';
  const cat    = (document.getElementById('productCategoryFilter')||{}).value || '';
  let list = allProducts.slice();
  if (search) list = list.filter(p => p.name.includes(search) || p.description.includes(search));
  if (cat)    list = list.filter(p => p.category === cat);

  const grid  = document.getElementById('allProductsGrid');
  const empty = document.getElementById('productsEmpty');
  if (!list.length) {
    grid.innerHTML = '';
    if (empty) empty.style.display = 'block';
  } else {
    if (empty) empty.style.display = 'none';
    grid.innerHTML = list.map(p => productCardHtml(p)).join('');
    bindProductCards(grid);
  }
}

function searchProducts(){
  showPage('products');
  renderProductList();
}

// ============================================================
// 商品详情
// ============================================================
function viewProduct(id){
  const p = allProducts.find(x => x.id === id);
  if (!p) return;
  showPage('detail');

  const stars    = '★'.repeat(Math.floor(p.rating||5)) + '☆'.repeat(5 - Math.floor(p.rating||5));
  const discount = p.original_price ? Math.round(p.price / p.original_price * 10 * 10) / 10 + '折' : '';

  document.getElementById('detailContent').innerHTML = `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:32px; align-items:start;" class="detail-grid">
      <div style="background:#f7fafc; border-radius:16px; height:360px; display:flex; align-items:center; justify-content:center; font-size:120px;">${p.emoji}</div>
      <div>
        <div style="margin-bottom:12px;">${badgeSpan(p.badge)}</div>
        <h2 style="font-size:24px; margin-bottom:10px;">${p.name}</h2>
        <p style="color:#718096; margin-bottom:16px;">${p.description}</p>
        <div style="display:flex; align-items:baseline; gap:10px; margin-bottom:8px;">
          <span style="font-size:32px; font-weight:800; color:#e53e3e;">¥${p.price}</span>
          ${p.original_price ? `<span style="color:#a0aec0; text-decoration:line-through; font-size:16px;">¥${p.original_price}</span>
          <span style="background:#fff5f5; color:#e53e3e; padding:2px 8px; border-radius:4px; font-size:12px; font-weight:600;">${discount}</span>` : ''}
        </div>
        <div style="color:#718096; font-size:14px; margin-bottom:20px;">
          <span>⭐ ${stars}（${(p.reviews||0)} 评价）</span> &nbsp;|&nbsp; <span>已售 ${(p.sales||0).toLocaleString()}</span> &nbsp;|&nbsp; <span>分类：${p.category}</span>
        </div>
        <div style="display:flex; gap:12px; margin-top:24px;">
          <button onclick="addToCart(${p.id})" style="flex:1; padding:12px; border:2px solid #667eea; background:white; color:#667eea; border-radius:10px; font-size:15px; font-weight:600; cursor:pointer;">加入购物车</button>
          <button onclick="buyNow(${p.id})" style="flex:1; padding:12px; border:none; background:linear-gradient(135deg,#667eea,#764ba2); color:white; border-radius:10px; font-size:15px; font-weight:600; cursor:pointer;">立即购买</button>
        </div>
      </div>
    </div>`;
}

function badgeSpan(b){
  if (b === 'hot')  return '<span style="background:#fff5f5;color:#e53e3e;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;">🔥 热销</span>';
  if (b === 'new')  return '<span style="background:#ebf8ff;color:#3182ce;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;">✨ 新品</span>';
  if (b === 'sale') return '<span style="background:#fffff0;color:#d69e2e;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;">🏷️ 促销</span>';
  return '';
}
function buyNow(id){ addToCart(id); showPage('cart'); renderCart(); }

// ============================================================
// 购物车（仍用 localStorage，前台临时数据）
// ============================================================
function getCart(){ return JSON.parse(localStorage.getItem('vm_cart') || '[]'); }
function saveCart(cart){ localStorage.setItem('vm_cart', JSON.stringify(cart)); }

function addToCart(id){
  const cart = getCart();
  const exist = cart.find(i => i.id === id);
  if (exist) { exist.qty++; } else { cart.push({ id, qty: 1 }); }
  saveCart(cart);
  updateCartCount();
  showToast('已加入购物车 ✓');
}

function updateCartCount(){
  const el = document.getElementById('cartCount');
  if (!el) return;
  const total = getCart().reduce((s, i) => s + i.qty, 0);
  el.textContent = total;
  el.style.display = total > 0 ? 'inline-flex' : 'none';
}

function renderCart(){
  const cart     = getCart();
  const products  = allProducts;
  const el       = document.getElementById('cartContent');
  if (!cart.length) {
    el.innerHTML = '<div style="text-align:center;padding:60px 20px;color:#718096;"><div style="font-size:56px;margin-bottom:16px;">🛒</div><div style="font-size:16px;margin-bottom:8px;">购物车是空的</div><div style="font-size:13px;"><a href="#" onclick="goHome();return false;" style="color:#667eea;">去逛逛 →</a></div></div>';
    return;
  }

  let html = '<div style="background:white;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">';
  html += '<table style="width:100%;border-collapse:collapse;">';
  html += '<thead style="background:#f7fafc;"><tr>';
  html += '<th style="padding:12px 16px;text-align:left;font-size:13px;color:#718096;">商品</th>';
  html += '<th style="padding:12px 16px;text-align:center;font-size:13px;color:#718096;">单价</th>';
  html += '<th style="padding:12px 16px;text-align:center;font-size:13px;color:#718096;">数量</th>';
  html += '<th style="padding:12px 16px;text-align:center;font-size:13px;color:#718096;">小计</th>';
  html += '<th style="padding:12px 16px;text-align:center;font-size:13px;color:#718096;">操作</th>';
  html += '</tr></thead><tbody>';

  let total = 0;
  cart.forEach(item => {
    const p = products.find(x => x.id === item.id) || { emoji:'❓', name:'已下架商品', price:0 };
    const subtotal = p.price * item.qty;
    total += subtotal;
    html += `<tr style="border-bottom:1px solid #e2e8f0;">
      <td style="padding:14px 16px;"><div style="display:flex;align-items:center;gap:12px;">
        <div style="width:48px;height:48px;background:#f7fafc;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;">${p.emoji}</div>
        <span style="font-weight:600;font-size:14px;">${p.name}</span>
      </div></td>
      <td style="padding:14px 16px;text-align:center;font-weight:700;color:#e53e3e;font-size:15px;">¥${p.price}</td>
      <td style="padding:14px 16px;text-align:center;">
        <div style="display:inline-flex;align-items:center;gap:8px;">
          <button onclick="changeQty(${item.id},-1)" style="width:28px;height:28px;border:1px solid #e2e8f0;border-radius:6px;background:white;cursor:pointer;font-size:16px;">-</button>
          <span style="min-width:24px;text-align:center;font-size:14px;">${item.qty}</span>
          <button onclick="changeQty(${item.id},1)" style="width:28px;height:28px;border:1px solid #e2e8f0;border-radius:6px;background:white;cursor:pointer;font-size:16px;">+</button>
        </div>
      </td>
      <td style="padding:14px 16px;text-align:center;font-weight:700;font-size:15px;">¥${subtotal}</td>
      <td style="padding:14px 16px;text-align:center;"><button onclick="removeFromCart(${item.id})" style="padding:4px 12px;border:1px solid #e2e8f0;background:white;color:#e53e3e;border-radius:6px;cursor:pointer;font-size:12px;">删除</button></td>
    </tr>`;
  });

  html += '</tbody></table>';
  html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-top:1px solid #e2e8f0;flex-wrap:wrap;gap:12px;">
    <a href="#" onclick="goHome();return false;" style="font-size:14px;color:#667eea;">← 继续购物</a>
    <div style="display:flex;align-items:center;gap:16px;">
      <span style="font-size:14px;color:#718096;">合计：<strong style="font-size:22px;color:#e53e3e;">¥${total}</strong></span>
      <button onclick="goCheckout()" style="padding:10px 28px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">去结算</button>
    </div>
  </div>`;
  html += '</div>';
  el.innerHTML = html;
}

function changeQty(id, delta){
  const cart = getCart();
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) { removeFromCart(id); return; }
  saveCart(cart);
  renderCart();
  updateCartCount();
}

function removeFromCart(id){
  saveCart(getCart().filter(i => i.id !== id));
  renderCart();
  updateCartCount();
  showToast('已移除商品');
}

// ============================================================
// 结算 / 提交订单（调 API）
// ============================================================
function goCheckout(){
  if (!getCart().length) { showToast('购物车是空的','error'); return; }
  showPage('checkout');

  const products  = allProducts;
  const cart      = getCart();
  let total = 0;
  let rows  = '';
  cart.forEach(item => {
    const p = products.find(x => x.id === item.id) || { emoji:'❓', name:'已下架', price:0 };
    total += p.price * item.qty;
    rows += `<tr>
      <td style="padding:10px 12px;">${p.emoji} ${p.name} × ${item.qty}</td>
      <td style="padding:10px 12px;text-align:right;font-weight:700;">¥${p.price * item.qty}</td>
    </tr>`;
  });

  document.getElementById('checkoutContent').innerHTML = `
    <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:24px;">
      <div style="background:white;border-radius:12px;border:1px solid #e2e8f0;padding:24px;">
        <h3 style="margin-bottom:16px;font-size:16px;">📱 联系信息</h3>
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;color:#4a5568;">邮箱地址 *</label>
          <input id="buyerEmail" type="email" placeholder="用于接收商品链接" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;outline:none;box-sizing:border-box;">
        </div>
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;color:#4a5568;">手机号码（选填）</label>
          <input id="buyerPhone" type="tel" placeholder="用于短信通知" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;outline:none;box-sizing:border-box;">
        </div>
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;color:#4a5568;">备注</label>
          <textarea id="buyerNote" placeholder="特殊要求（选填）" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;outline:none;resize:vertical;min-height:60px;box-sizing:border-box;"></textarea>
        </div>
      </div>
      <div>
        <div style="background:white;border-radius:12px;border:1px solid #e2e8f0;padding:24px;margin-bottom:16px;">
          <h3 style="margin-bottom:16px;font-size:16px;">📋 订单摘要</h3>
          <table style="width:100%;font-size:14px;"><tbody>${rows}</tbody></table>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:12px 0;">
          <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:800;">
            <span>应付总额</span><span style="color:#e53e3e;">¥${total}</span>
          </div>
        </div>
        <button onclick="submitOrder()" style="width:100%;padding:14px;border:none;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;">提交订单并支付</button>
      </div>
    </div>`;
}

async function submitOrder(){
  const email = (document.getElementById('buyerEmail')||{}).value || '';
  if (!email || !email.includes('@')) { showToast('请输入有效的邮箱地址','error'); return; }
  const phone = (document.getElementById('buyerPhone')||{}).value || '';
  const note  = (document.getElementById('buyerNote')||{}).value || '';

  const cart     = getCart();
  const products = allProducts;
  const orderItems = cart.map(item => {
    const p = products.find(x => x.id === item.id) || { emoji:'❓', name:'已下架', price:0 };
    return { productId: item.id, name: p.name, emoji: p.emoji, qty: item.qty, price: p.price };
  });
  const total = orderItems.reduce((s, i) => s + i.price * i.qty, 0);

  try {
    const res  = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: orderItems, total, email, phone, note })
    });
    const json = await res.json();
    if (!json.success) { showToast('订单创建失败：' + json.message, 'error'); return; }

    // 保存当前订单 ID，清空购物车
    localStorage.setItem('vm_current_order', json.orderId);
    saveCart([]);
    updateCartCount();
    showPayPage(json.orderId, total, email);
  } catch (e) {
    showToast('网络错误，请重试','error');
  }
}

// ============================================================
// 支付页面（调 API 获取收款码）
// ============================================================
async function showPayPage(orderId, total, email){
  showPage('pay');

  // 获取收款码
  let qrAlipay = '', qrWechat = '';
  try {
    const resA = await fetch('/api/settings/qrcode?type=alipay');
    const jsonA = await resA.json();
    qrAlipay = jsonA.data || '';
  } catch(e) {}
  try {
    const resW = await fetch('/api/settings/qrcode?type=wechat');
    const jsonW = await resW.json();
    qrWechat = jsonW.data || '';
  } catch(e) {}

  const payUrl = qrAlipay || qrWechat || '';
  const qrHtml = payUrl
    ? `<img id="payQrImg" src="${payUrl}" style="width:220px;height:220px;border-radius:8px;border:1px solid #e2e8f0;">`
    : `<div id="payQrPlaceholder" style="width:220px;height:220px;background:#f7fafc;border-radius:8px;border:2px dashed #cbd5e0;display:flex;align-items:center;justify-content:center;font-size:14px;color:#a0aec0;text-align:center;padding:20px;box-sizing:border-box;">管理员尚未上传<br>收款二维码</div>`;

  document.getElementById('payContent').innerHTML = `
    <div style="background:white;border-radius:16px;border:1px solid #e2e8f0;padding:32px;text-align:center;">
      <div style="margin-bottom:20px;">
        <div style="font-size:48px;margin-bottom:12px;">📱</div>
        <h3 style="font-size:18px;margin-bottom:6px;">订单 ${orderId}</h3>
        <p style="font-size:14px;color:#718096;">应付金额：<strong style="font-size:24px;color:#e53e3e;">¥${total}</strong></p>
      </div>
      <div style="margin-bottom:20px;" id="payQrContainer">
        ${qrHtml}
      </div>
      <div style="margin-bottom:20px;">
        <div style="display:inline-flex;gap:8px;margin-bottom:12px;">
          <button id="payAlipayBtn" onclick="switchPayType('alipay')" style="padding:8px 20px;border-radius:8px;font-size:14px;cursor:pointer;border:1px solid #e2e8f0;background:#1677ff;color:white;">📒 支付宝</button>
          <button id="payWechatBtn" onclick="switchPayType('wechat')" style="padding:8px 20px;border-radius:8px;font-size:14px;cursor:pointer;border:1px solid #e2e8f0;background:white;color:#333;">💚 微信支付</button>
        </div>
        <p style="font-size:13px;color:#a0aec0;">请用对应App扫描二维码完成支付</p>
      </div>
      <div style="background:#f7fafc;border-radius:10px;padding:16px;margin-bottom:20px;text-align:left;">
        <p style="font-size:13px;color:#718096;margin-bottom:6px;">📧 商品将发送至：<strong>${email}</strong></p>
        <p style="font-size:13px;color:#718096;">支付完成后请点击下方按钮</p>
      </div>
      <button onclick="confirmPay('${orderId}')" style="padding:12px 40px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;">我已完成支付</button>
      <p style="font-size:12px;color:#a0aec0;margin-top:10px;">（点击即视为支付成功，将自动发货）</p>
    </div>`;

  // 保存当前收款码 URL，供切换用
  window._qrAlipay = qrAlipay;
  window._qrWechat = qrWechat;
}

async function switchPayType(type){
  const imgEl = document.getElementById('payQrImg');
  const phEl  = document.getElementById('payQrPlaceholder');
  const container = document.getElementById('payQrContainer');
  const url = type === 'alipay' ? (window._qrAlipay || '') : (window._qrWechat || '');

  if (url) {
    const imgHtml = `<img id="payQrImg" src="${url}" style="width:220px;height:220px;border-radius:8px;border:1px solid #e2e8f0;">`;
    container.innerHTML = imgHtml;
  } else {
    const label = type === 'alipay' ? '支付宝' : '微信';
    container.innerHTML = `<div id="payQrPlaceholder" style="width:220px;height:220px;background:#f7fafc;border-radius:8px;border:2px dashed #cbd5e0;display:flex;align-items:center;justify-content:center;font-size:14px;color:#a0aec0;text-align:center;padding:20px;box-sizing:border-box;">管理员尚未上传<br>${label}收款码</div>`;
  }

  document.getElementById('payAlipayBtn').style.background = type === 'alipay' ? '#1677ff' : 'white';
  document.getElementById('payAlipayBtn').style.color     = type === 'alipay' ? 'white'   : '#333';
  document.getElementById('payWechatBtn').style.background = type === 'wechat' ? '#07c160' : 'white';
  document.getElementById('payWechatBtn').style.color     = type === 'wechat' ? 'white'   : '#333';
}

// ============================================================
// 确认支付（调 API，后端自动发货）
// ============================================================
async function confirmPay(orderId){
  try {
    const res  = await fetch('/api/orders/' + orderId + '/pay', { method: 'POST' });
    const json = await res.json();
    if (!json.success) { showToast('支付失败：' + json.message, 'error'); return; }
    showSuccessPage(json.order);
  } catch (e) {
    showToast('网络错误，请重试', 'error');
  }
}

// ============================================================
// 支付成功 / 展示发货链接
// ============================================================
function showSuccessPage(order){
  showPage('success');
  const linksHtml = (order.links || []).map(l => `
    <div style="background:#f7fafc;border-radius:10px;padding:16px;margin-bottom:12px;text-align:left;">
      <div style="font-size:16px;margin-bottom:8px;">${l.emoji} <strong>${l.productName}</strong></div>
      ${l.link
        ? `<div style="margin-bottom:6px;"><span style="font-size:13px;color:#718096;">下载链接：</span><a href="${l.link}" target="_blank" style="color:#667eea;word-break:break-all;">${l.link}</a></div>
           ${l.pwd ? `<div style="margin-bottom:6px;font-size:13px;color:#718096;">提取码：<strong style="color:#2d3748;font-size:15px;">${l.pwd}</strong></div>` : ''}
           ${l.remark ? `<div style="font-size:12px;color:#718096;">备注：${l.remark}</div>` : ''}`
        : `<div style="color:#e53e3e;font-weight:600;">⚠️ ${l.remark}</div>`
      }
    </div>`).join('');

  document.getElementById('successContent').innerHTML = `
    <div style="text-align:center;">
      <div style="font-size:64px;margin-bottom:16px;">✅</div>
      <h2 style="font-size:22px;margin-bottom:8px;color:#38a169;">支付成功！</h2>
      <p style="color:#718096;margin-bottom:24px;">订单 ${order.id} 已支付，以下为您的商品信息</p>
    </div>
    <div style="background:white;border-radius:16px;border:1px solid #e2e8f0;padding:28px;margin-bottom:24px;">
      <h3 style="font-size:16px;margin-bottom:16px;">📦 商品信息</h3>
      ${linksHtml || '<p style="color:#718096;">暂无发货信息，请联系客服</p>'}
    </div>
    <div style="background:white;border-radius:16px;border:1px solid #e2e8f0;padding:20px;margin-bottom:24px;text-align:left;">
      <h3 style="font-size:15px;margin-bottom:12px;">📋 订单详情</h3>
      <p style="font-size:14px;color:#718096;margin-bottom:6px;">订单号：<strong>${order.id}</strong></p>
      <p style="font-size:14px;color:#718096;margin-bottom:6px;">邮箱：<strong>${order.email}</strong></p>
      <p style="font-size:14px;color:#718096;">金额：<strong style="color:#e53e3e;">¥${order.total}</strong></p>
    </div>
    <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
      <button onclick="goHome()" style="padding:10px 28px;border:1px solid #e2e8f0;background:white;border-radius:8px;font-size:14px;cursor:pointer;">返回首页</button>
      <button onclick="goOrders()" style="padding:10px 28px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;border-radius:8px;font-size:14px;cursor:pointer;">查看我的订单</button>
    </div>`;
}

// ============================================================
// 我的订单（调 API）
// ============================================================
async function renderOrdersPage(){
  const el = document.getElementById('ordersContent');
  try {
    const res  = await fetch('/api/orders');
    const json = await res.json();
    if (!json.success) { el.innerHTML = '<p style="color:#718096;">加载失败</p>'; return; }
    const orders = json.data || [];

    if (!orders.length) {
      el.innerHTML = '<div style="text-align:center;padding:60px 20px;color:#718096;"><div style="font-size:56px;margin-bottom:16px;">📋</div><div style="font-size:16px;">暂无订单</div><div style="font-size:13px;margin-top:8px;"><a href="#" onclick="goHome();return false;" style="color:#667eea;">去逛逛 →</a></div></div>';
      return;
    }

    el.innerHTML = '<div style="display:flex;flex-direction:column;gap:16px;">' +
      orders.map(o => {
        const statusLabel = o.status === 'pending' ? '待支付' : o.status === 'paid' ? '已支付' : o.status === 'shipped' ? '已发货' : '已完成';
        const statusColor = o.status === 'shipped' ? '#38a169' : o.status === 'paid' ? '#d69e2e' : '#718096';
        const itemsHtml = (o.items || []).map(it => `<div style="display:flex;align-items:center;gap:8px;font-size:14px;margin-bottom:4px;">${it.emoji} ${it.name} × ${it.qty} <span style="color:#e53e3e;font-weight:600;">¥${it.price * it.qty}</span></div>`).join('');
        const linksHtml = (o.links || []).length ? `<div style="margin-top:12px;padding:12px;background:#f7fafc;border-radius:8px;"><div style="font-size:13px;font-weight:600;margin-bottom:8px;">📦 发货信息：</div>${o.links.map(l => `<div style="font-size:13px;margin-bottom:4px;">${l.emoji} ${l.productName}：${l.link ? '<a href="' + l.link + '" style="color:#667eea;">' + l.link + '</a>' : '<span style="color:#e53e3e;">' + l.remark + '</span>'}${l.pwd ? ' <span style="color:#718096;">提取码：' + l.pwd + '</span>' : ''}</div>`).join('')}</div>` : '';
        return `<div style="background:white;border-radius:12px;border:1px solid #e2e8f0;padding:20px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
            <span style="font-size:14px;color:#718096;">订单号：${o.id}</span>
            <span style="font-size:13px;font-weight:600;color:${statusColor};">${statusLabel}</span>
          </div>
          ${itemsHtml}
          <div style="margin-top:8px;font-size:15px;font-weight:700;text-align:right;">合计：<span style="color:#e53e3e;">¥${o.total}</span></div>
          ${linksHtml}
        </div>`;
      }).join('') + '</div>';

  } catch (e) {
    el.innerHTML = '<p style="color:#718096;">网络错误，请刷新重试</p>';
  }
}

// ============================================================
// Toast 提示
// ============================================================
function showToast(msg, type = 'success'){
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); }
  const icons = { success:'✅', error:'❌', info:'ℹ️' };
  el.className = 'toast toast-' + type;
  el.innerHTML = (icons[type] || '✅') + ' ' + msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

// ============================================================
// 倒计时
// ============================================================
function startCountdown(){
  const el = document.getElementById('countdown');
  if (!el) return;
  function tick(){
    const now   = new Date();
    let   target = new Date(now.getFullYear(), now.getMonth(), 15, 0, 0, 0);
    if (now.getDate() >= 15) target = new Date(now.getFullYear(), now.getMonth() + 1, 15, 0, 0, 0);
    const diff = target - now;
    if (diff <= 0) { el.innerHTML = '<span style="font-size:14px;color:white;">活动进行中！</span>'; return; }
    const d = Math.floor(diff / 864e5);
    const h = Math.floor(diff % 864e5 / 36e5);
    const m = Math.floor(diff % 36e5 / 6e4);
    const s = Math.floor(diff % 6e4 / 1e3);
    el.innerHTML = `<span class="cd-item">${String(d).padStart(2,'0')}</span><span class="cd-sep">天</span><span class="cd-item">${String(h).padStart(2,'0')}</span><span class="cd-sep">:</span><span class="cd-item">${String(m).padStart(2,'0')}</span><span class="cd-sep">:</span><span class="cd-item">${String(s).padStart(2,'0')}</span>`;
  }
  tick();
  setInterval(tick, 1000);
}

// ============================================================
// 轮播
// ============================================================
let currentSlide  = 0;
const totalSlides  = 4;
let autoPlayTimer  = null;

function showSlide(i){
  document.querySelectorAll('.carousel-slide').forEach((s, n) => s.classList.toggle('active', n === i));
  document.querySelectorAll('.dot').forEach((d, n) => d.classList.toggle('active', n === i));
  currentSlide = i;
}
function changeSlide(d){ showSlide((currentSlide + d + totalSlides) % totalSlides); }
function goToSlide(i){ showSlide(i); }
function startAuto(){ stopAuto(); autoPlayTimer = setInterval(() => changeSlide(1), 4000); }
function stopAuto(){ clearInterval(autoPlayTimer); }
