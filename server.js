// ============================================================
// VirtualMall 后端服务器 (Supabase 版)
// Node.js v18+ + Express + @supabase/supabase-js + multer
// ============================================================

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ========== Supabase 初始化 ==========
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ 缺少 Supabase 环境变量！');
  console.error('   请设置 SUPABASE_URL 和 SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
console.log('✅ Supabase 连接成功：', SUPABASE_URL);

// ========== 确保 uploads 目录存在 ==========
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  console.log('✅ 创建 uploads 目录：', UPLOADS_DIR);
}

// ========== multer 配置 ==========
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '';
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'images') {
      const allowed = /\.(jpeg|jpg|png|gif|webp|bmp)$/i;
      cb(null, allowed.test(file.originalname));
    } else if (file.fieldname === 'video') {
      const allowed = /\.(mp4|webm|ogg|mov|avi)$/i;
      cb(null, allowed.test(file.originalname));
    } else {
      cb(new Error('不支持的字段：' + file.fieldname));
    }
  }
}).fields([
  { name: 'images', maxCount: 5 },
  { name: 'video', maxCount: 1 }
]);

// ---------- 中间件 ----------
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(__dirname));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ============================================================
// API 接口
// ============================================================

// ----- 商品接口 -----
app.get('/api/products', async (req, res) => {
  try {
    const { data: rows, error } = await supabase
      .from('products')
      .select(`*, inventory!product_id(status)`)
      .order('id', { ascending: true });

    if (error) return res.json({ success: false, message: error.message });

    const result = rows.map(r => {
      // 计算每个商品的可用库存数量
      const stockCount = (r.inventory || []).filter(inv => inv.status === 'unused').length;
      const { inventory, ...rest } = r;
      try { rest.images = JSON.parse(rest.images || '[]'); } catch(e) { rest.images = []; }
      return { ...rest, stock_count: stockCount };
    });

    res.json({ success: true, data: result });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

app.get('/api/products/active', async (req, res) => {
  try {
    const { data: rows, error } = await supabase
      .from('products')
      .select(`*, inventory!product_id(status)`)
      .eq('status', 'active')
      .order('id', { ascending: true });

    if (error) return res.json({ success: false, message: error.message });

    const result = rows.map(r => {
      const stockCount = (r.inventory || []).filter(inv => inv.status === 'unused').length;
      const { inventory, ...rest } = r;
      try { rest.images = JSON.parse(rest.images || '[]'); } catch(e) { rest.images = []; }
      return { ...rest, stock_count: stockCount };
    });

    res.json({ success: true, data: result });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const { data: row, error } = await supabase
      .from('products')
      .select(`*, inventory!product_id(status)`)
      .eq('id', req.params.id)
      .single();

    if (error) return res.json({ success: false, message: '商品不存在' });
    if (!row) return res.json({ success: false, message: '商品不存在' });

    const stockCount = (row.inventory || []).filter(inv => inv.status === 'unused').length;
    const { inventory, ...rest } = row;
    try { rest.images = JSON.parse(rest.images || '[]'); } catch(e) { rest.images = []; }
    rest.stock_count = stockCount;

    res.json({ success: true, data: rest });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

// POST /api/products - 支持文件上传
app.post('/api/products', upload, async (req, res) => {
  try {
    const { emoji, name, category, badge, description, price, original_price, sales, rating, reviews, shipping_method } = req.body;
    if (!name || !price) return res.json({ success: false, message: '名称和售价为必填项' });

    const imagePaths = (req.files && req.files['images'] || []).map(f => '/uploads/' + f.filename);
    const videoPath = (req.files && req.files['video'] || [])[0] ? '/uploads/' + req.files['video'][0].filename : (req.body.video_url || '');

    const { data, error } = await supabase
      .from('products')
      .insert([{
        emoji: emoji || '📦',
        name,
        category: category || '',
        badge: badge || 'none',
        description: description || '',
        price,
        original_price: original_price || 0,
        sales: sales || 0,
        rating: rating || 5,
        reviews: reviews || 0,
        status: 'active',
        shipping_method: shipping_method || 'auto',
        images: JSON.stringify(imagePaths),
        video_url: videoPath
      }])
      .select()
      .single();

    if (error) return res.json({ success: false, message: error.message });
    res.json({ success: true, message: '商品添加成功', id: data.id });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

// PUT /api/products/:id - 支持文件上传
app.put('/api/products/:id', upload, async (req, res) => {
  try {
    const { emoji, name, category, badge, description, price, original_price, sales, rating, reviews, shipping_method } = req.body;
    if (!name || !price) return res.json({ success: false, message: '名称和售价为必填项' });

    let imagePaths = [];
    if (req.body.existing_images) {
      try { imagePaths = JSON.parse(req.body.existing_images); } catch(e) { imagePaths = []; }
    } else {
      const { data: existing } = await supabase
        .from('products')
        .select('images')
        .eq('id', req.params.id)
        .single();
      try { imagePaths = JSON.parse((existing && existing.images) || '[]'); } catch(e) { imagePaths = []; }
    }

    const newImages = (req.files && req.files['images'] || []).map(f => '/uploads/' + f.filename);
    imagePaths = imagePaths.concat(newImages).slice(0, 5);

    let videoPath = '';
    if (req.files && req.files['video'] && req.files['video'][0]) {
      videoPath = '/uploads/' + req.files['video'][0].filename;
    } else if (req.body.video_url !== undefined) {
      videoPath = req.body.video_url || '';
    } else {
      const { data: existing } = await supabase
        .from('products')
        .select('video_url')
        .eq('id', req.params.id)
        .single();
      videoPath = existing ? (existing.video_url || '') : '';
    }

    const { error } = await supabase
      .from('products')
      .update({
        emoji: emoji || '📦',
        name,
        category: category || '',
        badge: badge || 'none',
        description: description || '',
        price,
        original_price: original_price || 0,
        sales: sales || 0,
        rating: rating || 5,
        reviews: reviews || 0,
        shipping_method: shipping_method || 'auto',
        images: JSON.stringify(imagePaths),
        video_url: videoPath
      })
      .eq('id', req.params.id);

    if (error) return res.json({ success: false, message: error.message });
    res.json({ success: true, message: '商品更新成功' });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

app.put('/api/products/:id/toggle-status', async (req, res) => {
  try {
    const { data: product, error } = await supabase
      .from('products')
      .select('status')
      .eq('id', req.params.id)
      .single();

    if (error || !product) return res.json({ success: false, message: '商品不存在' });
    const newStatus = product.status === 'active' ? 'disabled' : 'active';

    const { error: updateError } = await supabase
      .from('products')
      .update({ status: newStatus })
      .eq('id', req.params.id);

    if (updateError) return res.json({ success: false, message: updateError.message });
    const action = newStatus === 'active' ? '上架' : '下架';
    res.json({ success: true, message: `商品已${action}`, status: newStatus });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', req.params.id);

    if (error) return res.json({ success: false, message: error.message });
    res.json({ success: true, message: '商品已删除' });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

// ----- 库存接口 -----
app.get('/api/inventory', async (req, res) => {
  const { product_id, status } = req.query;
  try {
    let query = supabase
      .from('inventory')
      .select('*')
      .order('id', { ascending: true });

    if (product_id) query = query.eq('product_id', product_id);
    if (status) query = query.eq('status', status);

    const { data: rows, error } = await query;
    if (error) return res.json({ success: false, message: error.message });
    res.json({ success: true, data: rows });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/inventory', async (req, res) => {
  const { product_id, link, pwd, remark } = req.body;
  if (!product_id || !link) return res.json({ success: false, message: '商品ID和链接为必填项' });
  try {
    const { data, error } = await supabase
      .from('inventory')
      .insert([{ product_id, link, pwd: pwd || '', remark: remark || '' }])
      .select()
      .single();

    if (error) return res.json({ success: false, message: error.message });
    res.json({ success: true, message: '库存添加成功', id: data.id });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/inventory/batch', async (req, res) => {
  const { product_id, lines } = req.body;
  if (!product_id || !lines || !lines.length) return res.json({ success: false, message: '参数不完整' });
  try {
    const records = lines.map(l => ({
      product_id,
      link: l.link || '',
      pwd: l.pwd || '',
      remark: l.remark || ''
    }));

    const { data, error } = await supabase
      .from('inventory')
      .insert(records)
      .select();

    if (error) return res.json({ success: false, message: error.message });
    res.json({ success: true, message: `成功导入 ${records.length} 条记录` });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

app.delete('/api/inventory/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('inventory')
      .delete()
      .eq('id', req.params.id);

    if (error) return res.json({ success: false, message: error.message });
    res.json({ success: true, message: '库存已删除' });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

// ----- 订单接口 -----
app.post('/api/orders', async (req, res) => {
  const { items, total, email, phone, note } = req.body;
  if (!items || !total || !email) return res.json({ success: false, message: '参数不完整' });
  const id = 'VM' + Date.now() + crypto.randomBytes(2).toString('hex').toUpperCase();
  try {
    const { error } = await supabase
      .from('orders')
      .insert([{
        id,
        items: JSON.stringify(items),
        total,
        email,
        phone: phone || '',
        note: note || '',
        status: 'pending'
      }]);

    if (error) return res.json({ success: false, message: error.message });
    res.json({ success: true, message: '订单创建成功', orderId: id });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

app.get('/api/orders', async (req, res) => {
  const { status, search } = req.query;
  try {
    let query = supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (search) {
      query = query.or(`id.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data: rows, error } = await query;
    if (error) return res.json({ success: false, message: error.message });

    rows.forEach(r => {
      try { r.items = JSON.parse(r.items); r.links = r.links ? JSON.parse(r.links) : []; } catch(e) {}
    });
    res.json({ success: true, data: rows });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

// 支付接口 - 真实流程：需要上传付款凭证
app.post('/api/orders/:id/pay', async (req, res) => {
  const orderId = req.params.id;
  const { proof } = req.body || {};
  try {
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error || !order) return res.json({ success: false, message: '订单不存在' });
    if (order.status === 'shipped') return res.json({ success: true, message: '订单已发货', order });

    if (!proof) {
      return res.json({ success: false, message: '请上传付款凭证后再提交。付款后请点击"我已完成支付"并上传截图。' });
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: 'pending_confirmation' })
      .eq('id', orderId);

    if (updateError) return res.json({ success: false, message: updateError.message });

    if (proof && proof.length > 100) {
      const { error: settingsError } = await supabase
        .from('settings')
        .upsert([{ key: 'proof_' + orderId, value: proof }], { onConflict: 'key' });
      if (settingsError) console.error('保存付款凭证失败:', settingsError.message);
    }

    const { data: updated, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (fetchError) return res.json({ success: false, message: fetchError.message });
    updated.items = JSON.parse(updated.items || '[]');
    updated.links = updated.links ? JSON.parse(updated.links) : [];
    res.json({ success: true, message: '付款凭证已提交，等待商家确认', order: updated });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/orders/:id/confirm-payment', async (req, res) => {
  const orderId = req.params.id;
  try {
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error || !order) return res.json({ success: false, message: '订单不存在' });
    if (order.status !== 'pending_confirmation') return res.json({ success: false, message: '订单状态不正确' });

    const items = JSON.parse(order.items || '[]');
    const links = [];

    for (const item of items) {
      for (let n = 0; n < item.qty; n++) {
        const { data: inv } = await supabase
          .from('inventory')
          .select('*')
          .eq('product_id', item.productId || item.product_id)
          .eq('status', 'unused')
          .limit(1)
          .single();

        if (inv) {
          const { error: updateInvError } = await supabase
            .from('inventory')
            .update({ status: 'used', order_id: orderId, used_at: new Date().toISOString() })
            .eq('id', inv.id);

          if (updateInvError) console.error('更新库存失败:', updateInvError.message);
          links.push({ productName: item.name, emoji: item.emoji, link: inv.link, pwd: inv.pwd, remark: inv.remark || '' });
        } else {
          links.push({ productName: item.name, emoji: item.emoji, link: '', pwd: '', remark: '库存不足，请联系客服处理' });
        }
      }
    }

    const { error: updateOrderError } = await supabase
      .from('orders')
      .update({ status: 'shipped', links: JSON.stringify(links) })
      .eq('id', orderId);

    if (updateOrderError) return res.json({ success: false, message: updateOrderError.message });
    res.json({ success: true, message: '付款已确认，已发货' });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/orders/:id/ship', async (req, res) => {
  const orderId = req.params.id;
  try {
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error || !order) return res.json({ success: false, message: '订单不存在' });

    let links = order.links ? JSON.parse(order.links) : [];
    const items = JSON.parse(order.items || '[]');

    for (const item of items) {
      const alreadyHas = links.filter(l => l.productName === item.name).length;
      for (let n = alreadyHas; n < item.qty; n++) {
        const { data: inv } = await supabase
          .from('inventory')
          .select('*')
          .eq('product_id', item.productId || item.product_id)
          .eq('status', 'unused')
          .limit(1)
          .single();

        if (inv) {
          const { error: updateInvError } = await supabase
            .from('inventory')
            .update({ status: 'used', order_id: orderId, used_at: new Date().toISOString() })
            .eq('id', inv.id);

          if (updateInvError) console.error('更新库存失败:', updateInvError.message);
          links.push({ productName: item.name, emoji: item.emoji, link: inv.link, pwd: inv.pwd, remark: inv.remark || '' });
        }
      }
    }

    const { error: updateOrderError } = await supabase
      .from('orders')
      .update({ status: 'shipped', links: JSON.stringify(links) })
      .eq('id', orderId);

    if (updateOrderError) return res.json({ success: false, message: updateOrderError.message });
    res.json({ success: true, message: '手动发货完成' });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

app.delete('/api/orders/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', req.params.id);

    if (error) return res.json({ success: false, message: error.message });
    res.json({ success: true, message: '订单已删除' });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

// ----- 配置接口 -----
app.get('/api/config', async (req, res) => {
  res.json({
    stripePublicKey: process.env.STRIPE_PUBLIC_KEY || '',
  });
});

// ----- 设置接口（收款码等） -----
app.post('/api/settings/qrcode', async (req, res) => {
  const { type, data } = req.body;
  if (!type || !data) return res.json({ success: false, message: '参数不完整' });
  try {
    const { error } = await supabase
      .from('settings')
      .upsert([{ key: 'qr_' + type, value: data }], { onConflict: 'key' });

    if (error) return res.json({ success: false, message: error.message });
    res.json({ success: true, message: '收款码已保存' });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

app.get('/api/settings/qrcode', async (req, res) => {
  const { type } = req.query;
  try {
    const { data: row, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'qr_' + type)
      .single();

    if (error) return res.json({ success: true, data: '' });
    res.json({ success: true, data: row ? row.value : '' });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

// ----- 统计接口 -----
app.get('/api/stats', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const { count: productsCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .then(r => ({ count: r.count || 0 }));

    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .like('created_at', today + '%');

    const shipped = (orders || []).filter(o => o.status === 'shipped');
    const revenue = shipped.reduce((s, o) => s + o.total, 0);

    const { count: inventoryCount } = await supabase
      .from('inventory')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'unused')
      .then(r => ({ count: r.count || 0 }));

    res.json({
      success: true,
      data: { products: productsCount, orders: (orders || []).length, revenue, inventory: inventoryCount }
    });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

// ----- 重置数据接口 -----
app.post('/api/reset', async (req, res) => {
  try {
    await supabase.from('products').delete().neq('id', 0);
    await supabase.from('inventory').delete().neq('id', 0);
    await supabase.from('orders').delete().neq('id', 0);

    const defaults = [
      { emoji: '🎁', name: 'Apple 礼品卡 $100', category: '礼品卡', badge: 'hot', description: '美国区App Store & iTunes 充值卡，即时发货', price: 685, original_price: 720, sales: 12580, rating: 5, reviews: 2341 },
      { emoji: '🎮', name: 'Steam 钱包充值 $50', category: '游戏充值', badge: 'none', description: '全球版，支持所有区域，秒到账', price: 345, original_price: 365, sales: 8942, rating: 5, reviews: 5672 },
      { emoji: '🤖', name: 'ChatGPT Plus 一个月', category: 'AI服务', badge: 'sale', description: '官方正版，支持GPT-4o，即开即用', price: 128, original_price: 168, sales: 15234, rating: 4, reviews: 3891 },
      { emoji: '🎬', name: 'Netflix 高级会员 1个月', category: '流媒体会员', badge: 'hot', description: '4K画质，4台设备同时在线', price: 45, original_price: 65, sales: 22105, rating: 5, reviews: 4521 },
      { emoji: '🎵', name: 'Spotify Premium 3个月', category: '音乐会员', badge: 'none', description: '全球版，无广告，离线下载', price: 89, original_price: 120, sales: 6732, rating: 5, reviews: 1876 },
      { emoji: '☁️', name: 'iCloud 200GB 一年', category: '云存储', badge: 'new', description: '苹果官方，自动续费，安全可靠', price: 198, original_price: 240, sales: 3421, rating: 5, reviews: 956 },
    ];

    const { error } = await supabase.from('products').insert(defaults);
    if (error) return res.json({ success: false, message: error.message });

    res.json({ success: true, message: '数据已重置，默认商品已恢复' });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

// ---------- 启动服务器 ----------
app.listen(PORT, () => {
  console.log('\n🚀 VirtualMall 后端服务器启动成功！(Supabase 版)');
  console.log('   前台地址： http://localhost:' + PORT);
  console.log('   管理后台： http://localhost:' + PORT + '/admin-dashboard.html');
  console.log('   按 Ctrl+C 停止服务器\n');
});
