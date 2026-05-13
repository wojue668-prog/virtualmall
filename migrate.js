const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'virtualmall.db');
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

// 创建数据库连接
function openDB() {
  return new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('❌ 无法连接数据库:', err.message);
      process.exit(1);
    }
  });
}

// 初始化迁移表
function initMigrationsTable(db) {
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL UNIQUE,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// 获取已运行的迁移
function getAppliedMigrations(db) {
  return new Promise((resolve, reject) => {
    db.all('SELECT filename FROM migrations ORDER BY id ASC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows.map(r => r.filename));
    });
  });
}

// 运行单个迁移
function runMigration(db, filename) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(MIGRATIONS_DIR, filename);
    const sql = fs.readFileSync(filePath, 'utf8');
    
    console.log(`📄 正在应用迁移: ${filename}`);
    
    db.exec(sql, (err) => {
      if (err) {
        reject(err);
        return;
      }
      
      // 记录迁移
      db.run('INSERT INTO migrations (filename) VALUES (?)', [filename], (err) => {
        if (err) reject(err);
        else {
          console.log(`✅ 迁移完成: ${filename}`);
          resolve();
        }
      });
    });
  });
}

// 主函数
async function migrate() {
  console.log('🚀 开始数据库迁移...\n');
  
  // 确保迁移目录存在
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
    console.log('📁 创建迁移目录:', MIGRATIONS_DIR);
  }
  
  const db = openDB();
  
  try {
    // 初始化迁移表
    await initMigrationsTable(db);
    
    // 获取已应用的迁移
    const applied = await getAppliedMigrations(db);
    console.log(`📊 已应用迁移数: ${applied.length}`);
    
    // 读取所有迁移文件
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort(); // 按文件名排序
    
    if (files.length === 0) {
      console.log('⚠️  没有找到迁移文件');
      console.log('💡 提示: 将迁移SQL文件放在 migrations/ 目录下');
      process.exit(0);
    }
    
    // 找出未应用的迁移
    const pending = files.filter(f => !applied.includes(f));
    
    if (pending.length === 0) {
      console.log('✅ 所有迁移已应用，无需更新');
      process.exit(0);
    }
    
    console.log(`\n📋 待应用迁移: ${pending.length} 个`);
    pending.forEach(f => console.log(`   - ${f}`));
    console.log('');
    
    // 依次应用迁移
    for (const file of pending) {
      await runMigration(db, file);
    }
    
    console.log('\n🎉 所有迁移应用成功！');
    
  } catch (err) {
    console.error('\n❌ 迁移失败:', err.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

// 执行
migrate();
