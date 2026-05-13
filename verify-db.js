const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'virtualmall.db');
const db = new sqlite3.Database(DB_PATH);

console.log('🔍 验证数据库结构...\n');

// 检查每张表的结构
const tables = [
  'categories',
  'products', 
  'product_keys',
  'users',
  'admin_users',
  'orders',
  'order_items',
  'payment_notifications',
  'email_logs',
  'migrations'
];

let completed = 0;

tables.forEach(table => {
  db.all(`PRAGMA table_info(${table})`, (err, columns) => {
    if (err) {
      console.error(`❌ 表 ${table} 不存在或查询失败`);
    } else {
      console.log(`✅ ${table}: ${columns.length} 个字段`);
      // 显示关键字段
      const keyColumns = columns.filter(c => c.name.match(/id|name|email|status|price/));
      if (keyColumns.length > 0) {
        console.log(`   关键字段: ${keyColumns.map(c => c.name).join(', ')}`);
      }
    }
    
    completed++;
    if (completed === tables.length) {
      console.log('\n🎉 验证完成！数据库已就绪。\n');
      
      // 显示示例数据
      db.all('SELECT * FROM products LIMIT 3', (err, products) => {
        if (!err && products) {
          console.log('📦 示例商品:');
          products.forEach(p => {
            console.log(`   - ${p.name}: ¥${p.price}`);
          });
        }
        
        db.close();
      });
    }
  });
});
