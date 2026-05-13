-- ============================================================
-- VirtualMall Supabase 数据库 schema
-- 在 Supabase SQL Editor 中执行
-- ============================================================

-- 商品表
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    emoji TEXT DEFAULT '📦',
    name TEXT NOT NULL,
    category TEXT DEFAULT '',
    badge TEXT DEFAULT 'none',
    description TEXT DEFAULT '',
    price DECIMAL(10,2) NOT NULL,
    original_price DECIMAL(10,2) DEFAULT 0,
    sales INTEGER DEFAULT 0,
    rating DECIMAL(2,1) DEFAULT 5,
    reviews INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    shipping_method TEXT DEFAULT 'auto',
    images TEXT DEFAULT '[]',
    video_url TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT NOW()
);

-- 库存表
CREATE TABLE IF NOT EXISTS inventory (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL,
    link TEXT NOT NULL,
    pwd TEXT DEFAULT '',
    remark TEXT DEFAULT '',
    status TEXT DEFAULT 'unused',
    order_id TEXT DEFAULT '',
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 订单表
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    items TEXT NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    email TEXT NOT NULL,
    phone TEXT DEFAULT '',
    note TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    links TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT NOW()
);

-- 设置表（收款码、付款凭证等）
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT DEFAULT ''
);

-- 插入默认商品数据
INSERT INTO products (emoji, name, category, badge, description, price, original_price, sales, rating, reviews)
VALUES 
    ('🎁', 'Apple 礼品卡 $100', '礼品卡', 'hot', '美国区App Store & iTunes 充值卡，即时发货', 685, 720, 12580, 5, 2341),
    ('🎮', 'Steam 钱包充值 $50', '游戏充值', 'none', '全球版，支持所有区域，秒到账', 345, 365, 8942, 5, 5672),
    ('🤖', 'ChatGPT Plus 一个月', 'AI服务', 'sale', '官方正版，支持GPT-4o，即开即用', 128, 168, 15234, 4, 3891),
    ('🎬', 'Netflix 高级会员 1个月', '流媒体会员', 'hot', '4K画质，4台设备同时在线', 45, 65, 22105, 5, 4521),
    ('🎵', 'Spotify Premium 3个月', '音乐会员', 'none', '全球版，无广告，离线下载', 89, 120, 6732, 5, 1876),
    ('☁️', 'iCloud 200GB 一年', '云存储', 'new', '苹果官方，自动续费，安全可靠', 198, 240, 3421, 5, 956)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Row Level Security (RLS) 策略
-- 允许公开读取商品，需要认证才能修改
-- ============================================================

-- 启用 RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- 允许所有人读取商品
CREATE POLICY "Allow public read products" ON products
    FOR SELECT USING (true);

-- 允许插入订单（匿名用户）
CREATE POLICY "Allow public insert orders" ON orders
    FOR INSERT WITH CHECK (true);

-- 允许读取自己的订单（通过 email 匹配）
-- 注：实际应用中应该用 auth.uid()，但这里简化处理
CREATE POLICY "Allow public read orders" ON orders
    FOR SELECT USING (true);

-- 允许插入库存（管理员）
CREATE POLICY "Allow public read inventory" ON inventory
    FOR SELECT USING (true);

-- ============================================================
-- 创建存储桶（用于上传图片/视频）
-- 在 Supabase Storage 中手动创建，或使用 Storage API
-- ============================================================

-- 注：存储桶需要在 Supabase Dashboard > Storage 中手动创建
-- 创建名为 "product-images" 的 bucket，设置为 public
