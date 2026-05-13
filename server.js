// ============================================================
// VirtualMall 后端服务器
// Node.js v24 + Express + 内置 SQLite (node:sqlite)
// 功能：商品管理、库存管理、订单管理、支付模拟、自动发货
// ============================================================

const express = require('express');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DATABASE_URL || path.join(__dirname, 'virtualmall.db');

// ---------- 中间件 ----------
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ---------- 数据库初始化 ----------
const db = new DatabaseSync(DB_PATH);
console.log('✅ 数据库连接成功：', DB_PATH);

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
  created_at TEXT DEFAULT (datetime('now','localtime'))
)`);

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

db.exec(`CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT DEFAULT ''
)`);

// 插入默认商品
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

// ---------- 工具：Promise 化 db ----------
function dbAll(sql, params = []) {
  const stmt = db.prepare(sql);
  const rows = stmt.all(...params);
  return Promise.resolve(rows);
}
function dbGet(sql, params = []) {
  const stmt = db.prepare(sql);
  const row = stmt.get(...params);
  return Promise.resolve(row);
}
function dbRun(sql, params = []) {
  const stmt = db.prepare(sql);
  const result = stmt.run(...params);
  return Promise.resolve({ lastID: result.lastInsertRowid, changes: result.changes });
}

// ============================================================
// API 接口
// ============================================================

// ----- 商品接口 -----
app.get('/api/products', async (req, res) => {
  try {
    const rows = await dbAll('SELECT * FROM products ORDER BY id ASC');
    res.json({ success: true, data: rows });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const row = await dbGet('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!row) return res.json({ success: false, message: '商品不存在' });
    res.json({ success: true, data: row });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/products', async (req, res) => {
  const { emoji, name, category, badge, description, price, original_price, sales, rating, reviews } = req.body;
  if (!name || !price) return res.json({ success: false, message: '名称和售价为必填项' });
  try {
    const result = await dbRun(
      `INSERT INTO products (emoji,name,category,badge,description,price,original_price,sales,rating,reviews) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [emoji||'📦', name, category||'', badge||'none', description||'', price, original_price||0, sales||0, rating||5, reviews||0]
    );
    res.json({ success: true, message: '商品添加成功', id: result.lastID });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

app.put('/api/products/:id', async (req, res) => {
  const { emoji, name, category, badge, description, price, original_price, sales, rating, reviews } = req.body;
  if (!name || !price) return res.json({ success: false, message: '名称和售价为必填项' });
  try {
    await dbRun(
      `UPDATE products SET emoji=?, name=?, category=?, badge=?, description=?, price=?, original_price=?, sales=?, rating=?, reviews=? WHERE id=?`,
      [emoji||'📦', name, category||'', badge||'none', description||'', price, original_price||0, sales||0, rating||5, reviews||0, req.params.id]
    );
    res.json({ success: true, message: '商品更新成功' });
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
    db.exec('BEGIN TRANSACTION');
    const stmt = db.prepare(`INSERT INTO inventory (product_id,link,pwd,remark) VALUES (?,?,?,?)`);
    let count = 0;
    lines.forEach(l => {
      stmt.run(product_id, l.link||'', l.pwd||'', l.remark||'');
      count++;
    });
    db.exec('COMMIT');
    res.json({ success: true, message: `成功导入 ${count} 条记录` });
  } catch(e) {
    db.exec('ROLLBACK');
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
  const id = 'VM' + Date.now();
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

app.post('/api/orders/:id/pay', async (req, res) => {
  const orderId = req.params.id;
  try {
    const order = await dbGet('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) return res.json({ success: false, message: '订单不存在' });
    if (order.status === 'shipped') return res.json({ success: true, message: '订单已发货', order });

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
    const updated = await dbGet('SELECT * FROM orders WHERE id = ?', [orderId]);
    updated.items = JSON.parse(updated.items);
    updated.links = JSON.parse(updated.links || '[]');
    res.json({ success: true, message: '支付成功，已自动发货', order: updated });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/orders/:id/ship', async (req, res) => {
  const orderId = req.params.id;
  try {
    const order = await dbGet('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) return res.json({ success: false, message: '订单不存在' });
    const items = JSON.parse(order.items);
    let links = order.links ? JSON.parse(order.links) : [];

    for (const item of items) {
      for (let n = 0; n < item.qty; n++) {
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

// ----- 设置接口 -----
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
    const products = await dbGet('SELECT COUNT(*) as cnt FROM products');
    const orders = await dbAll('SELECT * FROM orders WHERE created_at LIKE ?', [today + '%']);
    const shipped = orders.filter(o => o.status === 'shipped');
    const revenue = shipped.reduce((s, o) => s + o.total, 0);
    const inventory = await dbGet("SELECT COUNT(*) as cnt FROM inventory WHERE status='unused'");
    res.json({
      success: true,
      data: {
        products: products.cnt,
        orders: orders.length,
        revenue,
        inventory: inventory.cnt,
      }
    });
  } catch(e) { res.json({ success: false, message: e.message }); }
});

// ----- 重置数据接口 -----
app.post('/api/reset', async (req, res) => {
  try {
    // 清空所有数据
    db.exec('DELETE FROM products');
    db.exec('DELETE FROM inventory');
    db.exec('DELETE FROM orders');
    // 重新初始化默认商品
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
