-- ============================================================
-- VirtualMall 变体功能：Supabase 表结构变更
-- 在 Supabase SQL Editor 中执行
-- ============================================================

-- 1. products 表添加 variants 字段（JSON 格式存储变体配置）
ALTER TABLE products ADD COLUMN IF NOT EXISTS variants TEXT DEFAULT '{}';

-- 2. inventory 表添加变体值字段
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS variant1_value TEXT DEFAULT '';
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS variant2_value TEXT DEFAULT '';

-- 3. 验证字段添加成功
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'products' AND column_name = 'variants';

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'inventory' 
  AND column_name IN ('variant1_value', 'variant2_value');

-- ============================================================
-- 完成！可以看到上述查询返回新增的字段信息
-- ============================================================
