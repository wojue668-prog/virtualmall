const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'virtualmall.db');

// 备份现有数据库
if (fs.existsSync(DB_PATH)) {
  const backupPath = DB_PATH + '.backup_' + Date.now();
  fs.copyFileSync(DB_PATH, backupPath);
  console.log('✅ 已备份现有数据库到:', backupPath);
  console.log('');
}

// 删除现有数据库（强制重新初始化）
if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
  console.log('🗑️  已删除旧数据库，将重新初始化\n');
}

console.log('🚀 开始重新初始化数据库...\n');

// 创建新数据库并运行迁移
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ 创建数据库失败:', err.message);
    process.exit(1);
  }
});

// 读取并运行迁移SQL
const migrationPath = path.join(__dirname, 'migrations', '001_initial_schema.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

db.serialize(() => {
  // 启用外键约束
  db.run('PRAGMA foreign_keys = ON;');
  
  // 执行SQL
  db.exec(sql, (err) => {
    if (err) {
      console.error('❌ 迁移失败:', err.message);
      db.close();
      process.exit(1);
    }
    
    console.log('✅ 迁移 001_initial_schema.sql 应用成功!\n');
    
    // 验证表是否创建成功
    db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;", (err, tables) => {
      if (err) {
        console.error('❌ 查询表失败:', err.message);
      } else {
        console.log('📊 已创建的表:');
        tables.forEach(t => {
          if (!t.name.startsWith('sqlite')) {
            console.log(`   ✓ ${t.name}`);
          }
        });
        console.log('');
        
        // 显示商品分类数据
        db.all('SELECT * FROM categories', (err, categories) => {
          if (!err && categories) {
            console.log('📁 商品分类:');
            categories.forEach(c => {
              console.log(`   ${c.name} (${c.slug})`);
            });
          }
          
          console.log('\n🎉 数据库初始化完成！');
          db.close();
        });
      }
    });
  });
});
