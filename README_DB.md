# 📚 虚拟商品商城 - 数据库迁移与自动发货系统

## 🎯 系统概述

本系统为 SQLite 数据库提供：
- ✅ **版本化迁移管理**（类似 Git，跟踪所有数据库变更）
- ✅ **一键更新同步**（运行 `npm run migrate` 即可）
- ✅ **自动发货功能**（支付成功后自动发送密钥到邮箱）
- ✅ **支付验证机制**（防止伪造支付通知）

---

## 📁 文件结构

```
C:\Users\Admin\WorkBuddy\2026-05-12-task-14\
├── migrations/               # 迁移文件目录
│   └── 001_initial_schema.sql   # 初始数据库结构
├── virtualmall.db            # SQLite 数据库文件
├── migrate.js                # 迁移运行脚本
├── auto-deliver.js           # 自动发货模块
├── server.js                 # 后端服务器
├── package.json              # 项目配置（已添加 migrate 命令）
└── README_DB.md             # 本文档
```

---

## 🚀 快速开始

### 1️⃣ 初始化数据库（首次运行）

```bash
# 进入项目目录
cd C:\Users\Admin\WorkBuddy\2026-05-12-task-14

# 运行迁移（会自动创建所有表）
npm run migrate
```

**输出示例：**
```
🚀 开始数据库迁移...

📊 已应用迁移数: 0

📋 待应用迁移: 1 个
   - 001_initial_schema.sql

📄 正在应用迁移: 001_initial_schema.sql
✅ 迁移完成: 001_initial_schema.sql

🎉 所有迁移应用成功！
```

---

### 2️⃣ 查看数据库

```bash
# 使用 SQLite 命令行工具
sqlite3 virtualmall.db

# 查看所有表
.tables

# 查看商品分类
SELECT * FROM categories;

# 查看商品
SELECT * FROM products;

# 退出
.quit
```

或使用 **DB Browser for SQLite**（图形化工具）：
- 下载：https://sqlitebrowser.org/
- 打开 `virtualmall.db` 文件即可可视化操作

---

## 🔄 后续如何更新同步？

### 场景：你需要修改数据库结构（例如：添加"优惠券"功能）

#### 步骤1：创建新的迁移文件

在 `migrations/` 目录下创建新文件，**文件名必须以数字开头**，例如：
- `002_add_coupons.sql`
- `003_add_user_address.sql`
- `004_modify_orders_table.sql`

**示例：`002_add_coupons.sql`**
```sql
-- 添加优惠券表
CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  discount_amount DECIMAL(10,2) NOT NULL,
  min_order_amount DECIMAL(10,2) DEFAULT 0,
  start_date DATETIME,
  end_date DATETIME,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入示例优惠券
INSERT OR IGNORE INTO coupons (code, discount_amount, min_order_amount) 
VALUES ('WELCOME10', 10.00, 50.00);
```

#### 步骤2：运行迁移

```bash
npm run migrate
```

**输出示例：**
```
🚀 开始数据库迁移...

📊 已应用迁移数: 1

📋 待应用迁移: 1 个
   - 002_add_coupons.sql

📄 正在应用迁移: 002_add_coupons.sql
✅ 迁移完成: 002_add_coupons.sql

🎉 所有迁移应用成功！
```

#### 步骤3：验证更新

```bash
sqlite3 virtualmall.db "SELECT * FROM coupons;"
```

---

## 🔁 如何回滚？（可选）

如果需要撤销某个迁移，手动执行：

```bash
# 1. 手动删除表或列（SQLite 不支持 DROP COLUMN 除非3.35+）
sqlite3 virtualmall.db "DROP TABLE IF EXISTS coupons;"

# 2. 从迁移记录中删除
sqlite3 virtualmall.db "DELETE FROM migrations WHERE filename = '002_add_coupons.sql';"
```

> **提示**：建议在迁移文件中同时编写"向上迁移"和"向下回滚"的 SQL。

---

## 📧 自动发货功能

### 工作流程

```
客户下单 → 选择商品 → 支付成功 → Webhook 通知 → 
验证支付真实性 → 触发 autoDeliver() → 分配密钥 → 发送邮件 → 
更新订单状态为"已完成"
```

### 如何使用

#### 1. 在 `server.js` 中添加支付成功回调路由

```javascript
const { handlePaymentSuccess } = require('./auto-deliver.js');

// 支付成功回调（以 Stripe 为例）
app.post('/webhook/stripe', async (req, res) => {
  const { order_no, transaction_id } = req.body;
  
  try {
    // 验证支付真实性（检查签名、金额等）
    // ... 验证逻辑 ...
    
    // 触发自动发货
    await handlePaymentSuccess(order_no, transaction_id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ 支付处理失败:', error);
    res.status(500).json({ error: error.message });
  }
});
```

#### 2. 手动测试自动发货

```bash
# 测试订单ID=1 的自动发货
node auto-deliver.js 1
```

---

## 🔒 安全配置

### 1. 管理员密码

**重要**：默认管理员密码是明文存储的，生产环境必须 hash！

```javascript
// 使用 bcrypt 加密密码
const bcrypt = require('bcrypt');
const hashedPassword = await bcrypt.hash('admin123456', 10);

// 更新数据库
db.run('UPDATE admin_users SET password = ? WHERE username = "admin"', [hashedPassword]);
```

### 2. 隐藏管理后台入口

**前端不显示管理员登录链接**，只在特定 URL 访问：
- `https://yoursite.com/admin-8f3a9c/` （随机字符串）
- 或 `https://admin.yoursite.com/`

### 3. 验证支付通知

在 `handlePaymentSuccess()` 中添加：
```javascript
// 验证支付平台签名
function verifySignature(data, signature) {
  const expected = crypto
    .createHmac('sha256', 'your_secret_key')
    .update(JSON.stringify(data))
    .digest('hex');
  
  return expected === signature;
}
```

---

## 📊 数据库表结构说明

| 表名 | 功能 | 关键字段 |
|--------|------|----------|
| `categories` | 商品分类 | `name`, `slug` |
| `products` | 商品信息 | `price`, `stock`, `delivery_type` |
| `product_keys` | 虚拟商品密钥 | `key_code`, `is_used` |
| `users` | 用户表 | `email`, `password` |
| `admin_users` | 管理员表 | `username`, `role` |
| `orders` | 订单表 | `order_no`, `payment_status` |
| `order_items` | 订单商品 | `product_id`, `key_sent` |
| `payment_notifications` | 支付通知日志 | `verification_status` |
| `email_logs` | 邮件发送日志 | `recipient`, `status` |
| `migrations` | 迁移记录（自动创建） | `filename`, `applied_at` |

---

## 🛠️ 常用命令

```bash
# 运行迁移
npm run migrate

# 查看数据库
sqlite3 virtualmall.db

# 备份数据库
copy virtualmall.db virtualmall_backup_2026-05-13.db

# 测试自动发货
node auto-deliver.js <order_id>

# 查看迁移历史
sqlite3 virtualmall.db "SELECT * FROM migrations;"
```

---

## 💡 最佳实践

1. **每次修改数据库前**，先创建新的迁移文件
2. **不要手动修改** `virtualmall.db`，总是通过迁移脚本
3. **提交迁移文件到 Git**，方便团队协作
4. **定期备份** 数据库文件
5. **测试环境先运行**，再应用到生产环境

---

## 📞 需要帮助？

如果遇到问题，检查：
1. `migrations/` 目录是否存在
2. 迁移文件名是否以数字开头（如 `001_`, `002_`）
3. SQL 语法是否正确（SQLite 不支持某些 MySQL 语法）
4. 数据库文件权限是否正确

---

**🎉 现在你可以轻松地管理和更新数据库了！**
