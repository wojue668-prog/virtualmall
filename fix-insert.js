// 修复 server.js 中的 INSERT 语句
const fs = require('fs');
const path = require('path');

const filePath = path.join('C:', 'Users', 'Admin', 'WorkBuddy', '2026-05-12-task-14', 'server.js');
let content = fs.readFileSync(filePath, 'utf8');

// 修复 INSERT 语句：去掉 shipping_method 列
const oldINSERT = 'INSERT INTO products (emoji,name,category,badge,description,price,original_price,sales,rating,reviews,shipping_method) VALUES (?,?,?,?,?,?,?,?,?,?,?)';
const newINSERT = 'INSERT INTO products (emoji,name,category,badge,description,price,original_price,sales,rating,reviews) VALUES (?,?,?,?,?,?,?,?,?,?)';

if (content.includes(oldINSERT)) {
  content = content.replace(oldINSERT, newINSERT);
  console.log('✅ INSERT 语句已修复（去掉 shipping_method）');
} else {
  console.log('⚠️ 未找到预期的 INSERT 语句');
  console.log('当前内容（相关部分）：');
  const match = content.match(/INSERT INTO products $$[\s\S]*?$$/);
  if (match) {
    console.log(match[0].substring(0, 200));
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ server.js 已保存');
