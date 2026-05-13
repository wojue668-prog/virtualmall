// ============================================================
// VirtualMall 后端服务器
// Node.js v18+ + Express + better-sqlite3 + multer
// ============================================================

const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DATABASE_URL || path.join(__dirname, 'virtualmall.db');

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

// ---------- 数据库初始化 ----------
let db;
try {
  db = new Database(DB_PATH);
  console.log('✅ 数据库连接成功：', DB_PATH);
} catch (err) {
  console.error('❌ 数据库连接失败：', err.message);
  process.exit(1);
}

// ---------- 创建/迁移表 ----------
try {
  // 商品表
  db.exec(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emoji TEXT DEFAULT '📦',
    name TEXT NOT NULL,
    category TEXT DEFAULT '',
    badge TEXT DEFAULT 'none',
    description TEXT DEFAULT '',
    price REAL NOT NULL,
    original_price REAL DEFAULT 0,
    sales INTEGER DEFAULT 0,
    rating REAL DEFAULT 5,
    reviews INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    shipping_method TEXT DEFAULT 'auto',
    images TEXT DEFAULT '[]',
    video_url TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);

  // 迁移：添加 images 列（忽略已存在错误）
  try { db.exec(`ALTER TABLE products ADD COLUMN images TEXT DEFAULT '[]'`); } catch(e) {}
  // 迁移：添加 video_url 列
  try { db.exec(`ALTER TABLE products ADD COLUMN video_url TEXT DEFAULT ''`); } catch(e) {}

  // 库存表
  db.exec(`CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    link TEXT NOT NULL,
    pwd TEXT DEFAULT '',
    remark TEXT DEFAULT '',
    status TEXT DEFAULT 'unused',
    order_id TEXT DEFAULT '',
    used_at TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);

  // 订单表
  db.exec(`CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    items TEXT NOT NULL,
    total REAL NOT NULL,
    email TEXT NOT NULL,
    phone TEXT DEFAULT '',
    note TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    links TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);

  // 设置表
  db.exec(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT DEFAULT ''
  )`);
} catch (err) {
  console.error('❌ 创建表失败：', err.message);
}

// ---------- 插入默认商品（仅当表为空时）----------
const countRow = db.prepare('SELECT COUNT(*) as cnt FROM products').get();
if (countRow.cnt === 0) {
  const defaults = [
    ['🎁','Apple 礼品卡 $100','礼品卡','hot','美国区App Store & iTunes 充值卡，即时发货',685,720,12580,5,2341],
    ['🎮','Steam 钱包充值 $50','游戏充值','none','全球版，支持所有区域，秒到账',345,365,8942,5,5672],
    ['🤖','ChatGPT Plus 一个月','AI服务','sale','官方正版，支持GPT-4o，即开即用',128,168,15234,4,3891],
    ['🎬','Netflix 高级会员 1个月','流媒体会员','hot','4K画质，4台设备同时在线',45,65,22105,5,4521],
    ['🎵','Spotify Premium 3个月','音乐会员','none','全球版，无广告，离线下载',89,120,6732,5,1876],
    ['☁️','iCloud 200GB 一年','云存储','new','苹果官方，自动续费，安全可靠',198,240,3421,5,956],
  ];
  const insertStmt = db.prepare(
    `INSERT INTO products (emoji,name,category,badge,description,price,original_price,sales,rating,reviews) VALUES (?,?,?,?,?,?,?,?,?,?)`
  );
  defaults.forEach(d => insertStmt.run(...d));
  console.log('✅ 默认商品数据已初始化');
}

// ---------- Promise 化 db 操作（兼容原有异步代码）----------
function dbAll(sql, params = []) {
  return new Promise((resolve) => {
    resolve(db.prepare(sql).all(...params));
  });
}
function dbGet(sql, params = []) {
  return new Promise((resolve) => {
    resolve(db.prepare(sql).get(...params));
  });
}
function dbRun(sql, params = []) {
  return new Promise((resolve) => {
    const result = db.prepare(sql).run(...params);
    resolve({ lastID: result.lastInsertRowid, changes: result.changes });
  });
}

// ============================================================
// API 接口
// ============================================================

// ----- 商品接口 -----
app.get('/api/products', async (req, res) => {
  try {
    const rows = await dbAll(`SELECT p.*,
      (SELECT COUNT(*) FROM inventory WHERE product_id = p.id AND status = 'unused') as stock_count
      FROM products p ORDER BY p.id ASC`);
    rows.forEach(r => { try { r.images = JSON.parse(r.images || '[]'); } catch(e) { r.images = []; } });
    res.json({ success: true, data: rows });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

app.get('/api/products/active', async (req, res) => {
  try {
    const rows = await dbAll(`SELECT p.*,
      (SELECT COUNT(*) FROM inventory WHERE product_id = p.id AND status = 'unused') as stock_count
      FROM products p WHERE p.status = 'active' ORDER BY p.id ASC`);
    rows.forEach(r => { try { r.images = JSON.parse(r.images || '[]'); } catch(e) { r.images = []; } });
    res.json({ success: true, data: rows });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const row = await dbGet(`SELECT p.*,
      (SELECT COUNT(*) FROM inventory WHERE product_id = p.id AND status = 'unused') as stock_count
      FROM products p WHERE p.id = ?`, [req.params.id]);
    if (!row) return res.json({ success: false, message: '商品不存在' });
    try { row.images = JSON.parse(row.images || '[]'); } catch(e) { row.images = []; }
    res.json({ success: true, data: row });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

// POST /api/products - 支持文件上传
app.post('/api/products', upload, async (req, res) => {
  try {
    const { emoji, name, category, badge, description, price, original_price, sales, rating, reviews, shipping_method } = req.body;
    if (!name || !price) return res.json({ success: false, message: '名称和售价为必填项' });

    // 处理上传的图片
    const imagePaths = (req.files && req.files['images'] || []).map(f => '/uploads/' + f.filename);
    // 处理上传的视频
    const videoPath = (req.files && req.files['video'] || [])[0] ? '/uploads/' + req.files['video'][0].filename : (req.body.video_url || '');

    const result = await dbRun(
      `INSERT INTO products (emoji,name,category,badge,description,price,original_price,sales,rating,reviews,status,shipping_method,images,video_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        emoji||'📦', name, category||'', badge||'none', description||'', price, original_price||0, sales||0, rating||5, reviews||0,
        'active', shipping_method||'auto',
        JSON.stringify(imagePaths),
        videoPath
      ]
    );
    res.json({ success: true, message: '商品添加成功', id: result.lastID });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

// PUT /api/products/:id - 支持文件上传
app.put('/api/products/:id', upload, async (req, res) => {
  try {
    const { emoji, name, category, badge, description, price, original_price, sales, rating, reviews, shipping_method } = req.body;
    if (!name || !price) return res.json({ success: false, message: '名称和售价为必填项' });

    // 已有图片：来自前端表单（可能已被用户删除部分）
    let imagePaths = [];
    if (req.body.existing_images) {
      try { imagePaths = JSON.parse(req.body.existing_images); } catch(e) { imagePaths = []; }
    } else {
      const existing = await dbGet('SELECT images FROM products WHERE id = ?', [req.params.id]);
      try { imagePaths = JSON.parse(existing.images || '[]'); } catch(e) { imagePaths = []; }
    }

    // 追加新上传的图片（最多5张）
    const newImages = (req.files && req.files['images'] || []).map(f => '/uploads/' + f.filename);
    imagePaths = imagePaths.concat(newImages).slice(0, 5);

    // 视频处理
    let videoPath = '';
    if (req.files && req.files['video'] && req.files['video'][0]) {
      videoPath = '/uploads/' + req.files['video'][0].filename;
    } else if (req.body.video_url !== undefined) {
      videoPath = req.body.video_url || '';
    } else {
      const existing = await dbGet('SELECT video_url FROM products WHERE id = ?', [req.params.id]);
      videoPath = existing.video_url || '';
    }

    await dbRun(
      `UPDATE products SET emoji=?, name=?, category=?, badge=?, description=?, price=?, original_price=?, sales=?, rating=?, reviews=?, shipping_method=?, images=?, video_url=? WHERE id=?`,
      [emoji||'📦', name, category||'', badge||'none', description||'', price, original_price||0, sales||0, rating||5, reviews||0, shipping_method||'auto', JSON.stringify(imagePaths), videoPath, req.params.id]
    );
    res.json({ success: true, message: '商品更新成功' });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

app.put('/api/products/:id/toggle-status', async (req, res) => {
  try {
    const product = await dbGet('SELECT status FROM products WHERE id = ?', [req.params.id]);
    if (!product) return res.json({ success: false, message: '商品不存在' });
    const newStatus = product.status === 'active' ? 'disabled' : 'active';
    await dbRun('UPDATE products SET status = ? WHERE id = ?', [newStatus, req.params.id]);
    const action = newStatus === 'active' ? '上架' : '下架';
    res.json({ success: true, message: `商品已${action}`, status: newStatus });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    await dbRun('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '商品已删除' });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

// ----- 库存接口 -----
app.get('/api/inventory', async (req, res) => {
  const { product_id, status } = req.query;
  let sql = 'SELECT * FROM inventory WHERE 1=1';
  const params = [];
  if (product_id) { sql += ' AND product_id = ?'; params.push(product_id); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY id ASC';
  try {
    const rows = await dbAll(sql, params);
    res.json({ success: true, data: rows });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/inventory', async (req, res) => {
  const { product_id, link, pwd, remark } = req.body;
  if (!product_id || !link) return res.json({ success: false, message: '商品ID和链接为必填项' });
  try {
    const result = await dbRun(
      `INSERT INTO inventory (product_id,link,pwd,remark) VALUES (?,?,?,?)`,
      [product_id, link, pwd||'', remark||'']
    );
    res.json({ success: true, message: '库存添加成功', id: result.lastID });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/inventory/batch', async (req, res) => {
  const { product_id, lines } = req.body;
  if (!product_id || !lines || !lines.length) return res.json({ success: false, message: '参数不完整' });
  try {
    db.prepare('BEGIN TRANSACTION').run();
    const stmt = db.prepare(`INSERT INTO inventory (product_id,link,pwd,remark) VALUES (?,?,?,?)`);
    let count = 0;
    lines.forEach(l => {
      stmt.run(product_id, l.link||'', l.pwd||'', l.remark||'');
      count++;
    });
    db.prepare('COMMIT').run();
    res.json({ success: true, message: `成功导入 ${count} 条记录` });
  } catch(e) {
    db.prepare('ROLLBACK').run();
    res.json({ success: false, message: e.message });
  }
});

app.delete('/api/inventory/:id', async (req, res) => {
  try {
    await dbRun('DELETE FROM inventory WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '库存已删除' });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

// ----- 订单接口 -----
app.post('/api/orders', async (req, res) => {
  const { items, total, email, phone, note } = req.body;
  if (!items || !total || !email) return res.json({ success: false, message: '参数不完整' });
  const id = 'VM' + Date.now() + crypto.randomBytes(2).toString('hex').toUpperCase();
  try {
    await dbRun(
      `INSERT INTO orders (id,items,total,email,phone,note,status) VALUES (?,?,?,?,?,?,?)`,
      [id, JSON.stringify(items), total, email, phone||'', note||'', 'pending']
    );
    res.json({ success: true, message: '订单创建成功', orderId: id });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

app.get('/api/orders', async (req, res) => {
  const { status, search } = req.query;
  let sql = 'SELECT * FROM orders WHERE 1=1';
  const params = [];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (search) { sql += ' AND (id LIKE ? OR email LIKE ?)'; params.push('%'+search+'%', '%'+search+'%'); }
  sql += ' ORDER BY created_at DESC';
  try {
    const rows = await dbAll(sql, params);
    rows.forEach(r => { try { r.items = JSON.parse(r.items); r.links = r.links ? JSON.parse(r.links) : []; } catch(e) {} });
    res.json({ success: true, data: rows });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

// 支付接口 - 真实流程：需要上传付款凭证
app.post('/api/orders/:id/pay', async (req, res) => {
  const orderId = req.params.id;
  const { proof } = req.body || {};
  try {
    const order = await dbGet('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) return res.json({ success: false, message: '订单不存在' });
    if (order.status === 'shipped') return res.json({ success: true, message: '订单已发货', order });

    // 必须有付款凭证，进入待确认状态
    if (!proof) {
      return res.json({ success: false, message: '请上传付款凭证后再提交。付款后请点击"我已完成支付"并上传截图。' });
    }

    await dbRun(`UPDATE orders SET status='pending_confirmation' WHERE id=?`, [orderId]);
    if (proof && proof.length > 100) {
      await dbRun(
        `INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
        ['proof_' + orderId, proof]
      );
    }
    const updated = await dbGet('SELECT * FROM orders WHERE id = ?', [orderId]);
    updated.items = JSON.parse(updated.items);
    updated.links = updated.links ? JSON.parse(updated.links) : [];
    res.json({ success: true, message: '付款凭证已提交，等待商家确认', order: updated });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/orders/:id/confirm-payment', async (req, res) => {
  const orderId = req.params.id;
  try {
    const order = await dbGet('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) return res.json({ success: false, message: '订单不存在' });
    if (order.status !== 'pending_confirmation') return res.json({ success: false, message: '订单状态不正确' });

    const items = JSON.parse(order.items);
    const links = [];

    for (const item of items) {
      for (let n = 0; n < item.qty; n++) {
        const inv = await dbGet(
          `SELECT * FROM inventory WHERE product_id = ? AND status = 'unused' LIMIT 1`,
          [item.productId || item.product_id]
        );
        if (inv) {
          await dbRun(`UPDATE inventory SET status='used', order_id=?, used_at=datetime('now','localtime') WHERE id=?`, [orderId, inv.id]);
          links.push({ productName: item.name, emoji: item.emoji, link: inv.link, pwd: inv.pwd, remark: inv.remark || '' });
        } else {
          links.push({ productName: item.name, emoji: item.emoji, link: '', pwd: '', remark: '库存不足，请联系客服处理' });
        }
      }
    }

    await dbRun(`UPDATE orders SET status='shipped', links=? WHERE id=?`, [JSON.stringify(links), orderId]);
    res.json({ success: true, message: '付款已确认，已发货' });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/orders/:id/ship', async (req, res) => {
  const orderId = req.params.id;
  try {
    const order = await dbGet('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) return res.json({ success: false, message: '订单不存在' });

    let links = order.links ? JSON.parse(order.links) : [];
    const items = JSON.parse(order.items);

    for (const item of items) {
      const alreadyHas = links.filter(l => l.productName === item.name).length;
      for (let n = alreadyHas; n < item.qty; n++) {
        const inv = await dbGet(
          `SELECT * FROM inventory WHERE product_id = ? AND status = 'unused' LIMIT 1`,
          [item.productId || item.product_id]
        );
        if (inv) {
          await dbRun(`UPDATE inventory SET status='used', order_id=?, used_at=datetime('now','localtime') WHERE id=?`, [orderId, inv.id]);
          links.push({ productName: item.name, emoji: item.emoji, link: inv.link, pwd: inv.pwd, remark: inv.remark || '' });
        }
      }
    }

    await dbRun(`UPDATE orders SET status='shipped', links=? WHERE id=?`, [JSON.stringify(links), orderId]);
    res.json({ success: true, message: '手动发货完成' });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

app.delete('/api/orders/:id', async (req, res) => {
  try {
    await dbRun('DELETE FROM orders WHERE id = ?', [req.params.id]);
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
    await dbRun(
      `INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
      ['qr_' + type, data]
    );
    res.json({ success: true, message: '收款码已保存' });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

app.get('/api/settings/qrcode', async (req, res) => {
  const { type } = req.query;
  try {
    const row = await dbGet('SELECT value FROM settings WHERE key = ?', ['qr_' + type]);
    res.json({ success: true, data: row ? row.value : '' });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

// ----- 统计接口 -----
app.get('/api/stats', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const products = await dbGet('SELECT COUNT(*) as cnt FROM products WHERE status = "active"');
    const orders = await dbAll('SELECT * FROM orders WHERE created_at LIKE ?', [today + '%']);
    const shipped = orders.filter(o => o.status === 'shipped');
    const revenue = shipped.reduce((s, o) => s + o.total, 0);
    const inventory = await dbGet("SELECT COUNT(*) as cnt FROM inventory WHERE status='unused'");
    res.json({
      success: true,
      data: { products: products.cnt, orders: orders.length, revenue, inventory: inventory.cnt }
    });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

// ----- 重置数据接口 -----
app.post('/api/reset', async (req, res) => {
  try {
    await dbRun('DELETE FROM products');
    await dbRun('DELETE FROM inventory');
    await dbRun('DELETE FROM orders');
    const defaults = [
      ['🎁','Apple 礼品卡 $100','礼品卡','hot','美国区App Store & iTunes 充值卡，即时发货',685,720,12580,5,2341],
      ['🎮','Steam 钱包充值 $50','游戏充值','none','全球版，支持所有区域，秒到账',345,365,8942,5,5672],
      ['🤖','ChatGPT Plus 一个月','AI服务','sale','官方正版，支持GPT-4o，即开即用',128,168,15234,4,3891],
      ['🎬','Netflix 高级会员 1个月','流媒体会员','hot','4K画质，4台设备同时在线',45,65,22105,5,4521],
      ['🎵','Spotify Premium 3个月','音乐会员','none','全球版，无广告，离线下载',89,120,6732,5,1876],
      ['☁️','iCloud 200GB 一年','云存储','new','苹果官方，自动续费，安全可靠',198,240,3421,5,956],
    ];
    const stmt = db.prepare(`INSERT INTO products (emoji,name,category,badge,description,price,original_price,sales,rating,reviews) VALUES (?,?,?,?,?,?,?,?,?,?)`);
    defaults.forEach(d => stmt.run(...d));
    res.json({ success: true, message: '数据已重置，默认商品已恢复' });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

// ---------- 启动服务器 ----------
app.listen(PORT, () => {
  console.log('\n🚀 VirtualMall 后端服务器启动成功！');
  console.log('   前台地址： http://localhost:' + PORT);
  console.log('   管理后台： http://localhost:' + PORT + '/admin-dashboard.html');
  console.log('   按 Ctrl+C 停止服务器\n');
});
