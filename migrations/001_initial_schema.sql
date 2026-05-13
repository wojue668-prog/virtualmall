-- =====================================================
-- 迁移: 001_initial_schema.sql
-- 描述: 创建虚拟商品电商数据库初始结构
-- 数据库类型: SQLite 3.x
-- =====================================================

-- 启用外键约束
PRAGMA foreign_keys = ON;

-- =====================================================
-- 1. 商品分类表
-- =====================================================
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 2. 商品表
-- =====================================================
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  original_price DECIMAL(10,2),
  stock INTEGER DEFAULT -1,
  sales INTEGER DEFAULT 0,
  image TEXT,
  is_virtual INTEGER DEFAULT 1,
  delivery_type TEXT CHECK(delivery_type IN ('auto','manual')) DEFAULT 'auto',
  status INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- =====================================================
-- 3. 虚拟商品密钥表
-- =====================================================
CREATE TABLE IF NOT EXISTS product_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  key_code TEXT NOT NULL,
  is_used INTEGER DEFAULT 0,
  order_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  used_at DATETIME,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

-- =====================================================
-- 4. 用户表
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  nickname TEXT,
  phone TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME
);

-- =====================================================
-- 5. 管理员表
-- =====================================================
CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT CHECK(role IN ('super_admin','admin','editor')) DEFAULT 'admin',
  last_login DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 6. 订单表
-- =====================================================
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT NOT NULL UNIQUE,
  user_id INTEGER,
  total_amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT,
  payment_status TEXT CHECK(payment_status IN ('pending','paid','failed','refunded')) DEFAULT 'pending',
  payment_time DATETIME,
  transaction_id TEXT,
  email TEXT NOT NULL,
  status TEXT CHECK(status IN ('pending','processing','completed','cancelled')) DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- =====================================================
-- 7. 订单商品表
-- =====================================================
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER DEFAULT 1,
  price DECIMAL(10,2) NOT NULL,
  key_sent TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- =====================================================
-- 8. 支付通知日志表
-- =====================================================
CREATE TABLE IF NOT EXISTS payment_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  notification_data TEXT NOT NULL,
  verification_status TEXT CHECK(verification_status IN ('pending','verified','invalid')) DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 9. 邮件发送日志表
-- =====================================================
CREATE TABLE IF NOT EXISTS email_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT CHECK(status IN ('pending','sent','failed')) DEFAULT 'pending',
  error_message TEXT,
  sent_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- =====================================================
-- 插入初始数据
-- =====================================================

-- 插入商品分类
INSERT OR IGNORE INTO categories (name, slug, icon, sort_order) VALUES
('游戏充值', 'game-recharge', '🎮', 1),
('流媒体', 'streaming', '🎬', 2),
('应用商店卡', 'app-store', '🛒', 3),
('AI服务', 'ai-services', '🤖', 4),
('云存储', 'cloud-storage', '☁️', 5),
('音乐会员', 'music', '🎵', 6),
('学习会员', 'education', '📚', 7),
('礼品卡', 'gift-cards', '🎁', 8);

-- 插入管理员账号 (密码: admin123456，实际部署请修改)
INSERT OR IGNORE INTO admin_users (username, password, email, role) VALUES
('admin', '$2y$10$YourHashedPasswordHere', 'admin@example.com', 'super_admin');

-- 插入示例商品
INSERT OR IGNORE INTO products (category_id, name, description, price, original_price, stock, sales, image, is_virtual, delivery_type, status) VALUES
(1, 'Steam钱包充值卡 $50', '全球通用Steam钱包充值码', 299.00, 350.00, 100, 156, 'steam-50.png', 1, 'auto', 1),
(1, 'PlayStation Network $20', 'PSN充值码，即时到账', 149.00, 160.00, 50, 89, 'psn-20.png', 1, 'auto', 1),
(2, 'Netflix 1个月会员', 'Netflix土耳其区账号', 25.00, 30.00, -1, 234, 'netflix.png', 1, 'auto', 1),
(2, 'Spotify Premium 3个月', 'Spotify土耳其区会员', 45.00, 60.00, -1, 167, 'spotify.png', 1, 'auto', 1),
(3, 'Apple Gift Card $25', '苹果礼品卡，全球通用', 179.00, 199.00, 200, 312, 'apple-gc.png', 1, 'auto', 1),
(4, 'ChatGPT Plus 1个月', 'ChatGPT Plus会员代开通', 98.00, 120.00, -1, 445, 'chatgpt.png', 1, 'manual', 1);

-- 插入示例密钥
INSERT OR IGNORE INTO product_keys (product_id, key_code, is_used) VALUES
(1, 'STEAM-XXXX-XXXX-XXXX-XXXX', 0),
(1, 'STEAM-YYYY-YYYY-YYYY-YYYY', 0),
(2, 'PSN-ABCD-EFGH-IJKL-MNOP', 0),
(3, 'NF-ACCOUNT-001:password123', 0),
(5, 'APPLE-GC-1234-5678-9012', 0);

-- =====================================================
-- 创建索引
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
CREATE INDEX IF NOT EXISTS idx_product_keys_product_used ON product_keys(product_id, is_used);
CREATE INDEX IF NOT EXISTS idx_orders_order_no ON orders(order_no);

-- =====================================================
-- 创建触发器：自动生成订单号
-- =====================================================
CREATE TRIGGER IF NOT EXISTS trigger_generate_order_no 
AFTER INSERT ON orders
WHEN NEW.order_no IS NULL OR NEW.order_no = ''
BEGIN
  UPDATE orders 
  SET order_no = 'ORD' || strftime('%Y%m%d', 'now') || substr('000000' || abs(random()), -6, 6)
  WHERE id = NEW.id;
END;

-- =====================================================
-- 创建视图：订单详情
-- =====================================================
CREATE VIEW IF NOT EXISTS order_details AS
SELECT 
    o.id AS order_id,
    o.order_no,
    o.email,
    o.total_amount,
    o.payment_status,
    o.status AS order_status,
    o.created_at AS order_date,
    p.name AS product_name,
    oi.quantity,
    oi.price AS unit_price,
    oi.key_sent
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
LEFT JOIN products p ON oi.product_id = p.id;

-- 完成迁移
SELECT 'Migration 001_initial_schema applied successfully!' AS message;
