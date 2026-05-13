// 修复 server.js 中 defaults 数组和 INSERT 语句不匹配的问题
const fs = require('fs');
const path = require('path');

const filePath = path.join('C:', 'Users', 'Admin', 'WorkBuddy', '2026-05-12-task-14', 'server.js');
let content = fs.readFileSync(filePath, 'utf8');

// 方案：去掉 INSERT 中的 shipping_method，并去掉 defaults 数组中的最后一个值（'auto'/'manual'）
// 这样 10 个值对应 10 个列

// 替换 defaults 数组（去掉最后一个元素 'auto'/'manual'）
const oldDefaults = `  const defaults = [
    ['🎁','Apple 礼品卡 $100','礼品卡','hot','美国区App Store & iTunes 充值卡，即时发货',685,720,12580,5,2341,'auto'],
    ['🎮','Steam 钱包充值 $50','游戏充值','none','全球版，支持所有区域，秒到账',345,365,8942,5,5672,'auto'],
    ['🤖','ChatGPT Plus 一个月','AI服务','sale','官方正版，支持GPT-4o，即开即用',128,168,15234,4,3891,'manual'],
    ['🎬','Netflix 高级会员 1个月','流媒体会员','hot','4K画质，4台设备同时在线',45,65,22105,5,4521,'auto'],
    ['🎵','Spotify Premium 3个月','音乐会员','none','全球版，无广告，离线下载',89,120,6732,5,1876,'auto'],
    ['☁️','iCloud 200GB 一年','云存储','new','苹果官方，自动续费，安全可靠',198,240,3421,5,956,'manual'],
  ];`;

const newDefaults = `  const defaults = [
    ['🎁','Apple 礼品卡 $100','礼品卡','hot','美国区App Store & iTunes 充值卡，即时发货',685,720,12580,5,2341],
    ['🎮','Steam 钱包充值 $50','游戏充值','none','全球版，支持所有区域，秒到账',345,365,8942,5,5672],
    ['🤖','ChatGPT Plus 一个月','AI服务','sale','官方正版，支持GPT-4o，即开即用',128,168,15234,4,3891],
    ['🎬','Netflix 高级会员 1个月','流媒体会员','hot','4K画质，4台设备同时在线',45,65,22105,5,4521],
    ['🎵','Spotify Premium 3个月','音乐会员','none','全球版，无广告，离线下载',89,120,6732,5,1876],
    ['☁️','iCloud 200GB 一年','云存储','new','苹果官方，自动续费，安全可靠',198,240,3421,5,956],
  ];`;

if (content.includes(oldDefaults)) {
  content = content.replace(oldDefaults, newDefaults);
  console.log('✅ 已修复 defaults 数组（去掉 shipping_method 值）');
} else {
  console.log('⚠️  未找到预期的 defaults 数组，尝试通用修复...');
  // 通用修复：去掉每个子数组的最后一个元素（假设是 'auto' 或 'manual'）
  content = content.replace(/const defaults = \[[\s\S]*?\];/m, (match) => {
    return match.replace(/,('auto'|'manual')\]/g, ']');
  });
}

// 替换 INSERT 语句（去掉 shipping_method 列）
const oldInsert = `    \`INSERT INTO products (emoji,name,category,badge,description,price,original_price,sales,rating,reviews,shipping_method) VALUES (?,?,?,?,?,?,?,?,?,?,?)\`
  `;
const newInsert = '    `INSERT INTO products (emoji,name,category,badge,description,price,original_price,sales,rating,reviews) VALUES (?,?,?,?,?,?,?,?,?,?)`\n  ';

if (content.includes(oldInsert)) {
  content = content.replace(oldInsert, newInsert);
  console.log('✅ 已修复 INSERT 语句（去掉 shipping_method 列）');
} else {
  console.log('⚠️  未找到预期的 INSERT 语句，请手动检查');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ server.js 已修复');
