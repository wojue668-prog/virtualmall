const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const nodemailer = require('nodemailer');

const DB_PATH = path.join(__dirname, 'virtualmall.db');

// 创建数据库连接
function getDB() {
  return new sqlite3.Database(DB_PATH);
}

// 自动发货函数
async function autoDeliver(orderId) {
  const db = getDB();
  
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 1. 获取订单信息
      db.get('SELECT * FROM orders WHERE id = ?', [orderId], (err, order) => {
        if (err || !order) {
          reject(new Error('订单不存在'));
          return;
        }
        
        console.log(`📦 开始处理订单 #${order.order_no}`);
        
        // 2. 获取订单中的所有商品
        db.all('SELECT * FROM order_items WHERE order_id = ?', [orderId], async (err, items) => {
          if (err) {
            reject(err);
            return;
          }
          
          try {
            for (const item of items) {
              // 3. 获取未使用的密钥
              db.get(
                'SELECT * FROM product_keys WHERE product_id = ? AND is_used = 0 LIMIT 1',
                [item.product_id],
                async (err, key) => {
                  if (err) {
                    console.error(`❌ 获取密钥失败: ${err.message}`);
                    return;
                  }
                  
                  if (!key) {
                    console.error(`⚠️  商品 ${item.product_id} 没有可用的密钥`);
                    return;
                  }
                  
                  // 4. 标记密钥已使用
                  db.run(
                    'UPDATE product_keys SET is_used = 1, order_id = ?, used_at = DATETIME("now") WHERE id = ?',
                    [orderId, key.id]
                  );
                  
                  // 5. 更新订单商品
                  db.run(
                    'UPDATE order_items SET key_sent = ? WHERE id = ?',
                    [key.key_code, item.id]
                  );
                  
                  console.log(`✅ 已分配密钥: ${key.key_code}`);
                  
                  // 6. 发送邮件
                  await sendDeliveryEmail(order.email, item.product_id, key.key_code, order.order_no);
                }
              );
            }
            
            // 7. 更新订单状态
            db.run(
              'UPDATE orders SET status = "completed", payment_status = "paid" WHERE id = ?',
              [orderId]
            );
            
            console.log(`🎉 订单 #${order.order_no} 处理完成`);
            resolve();
            
          } catch (error) {
            reject(error);
          }
        });
      });
    });
  });
}

// 发送发货邮件
async function sendDeliveryEmail(to, productId, keyCode, orderNo) {
  // 获取商品名称
  const db = getDB();
  
  return new Promise((resolve, reject) => {
    db.get('SELECT name FROM products WHERE id = ?', [productId], async (err, product) => {
      if (err) {
        reject(err);
        return;
      }
      
      const productName = product ? product.name : '虚拟商品';
      
      // 邮件内容
      const mailOptions = {
        from: '"虚拟商城" <noreply@example.com>',
        to: to,
        subject: `您的订单 #${orderNo} 已发货`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4F46E5;">订单发货通知</h2>
            <p>尊敬的客户，</p>
            <p>您的订单已成功发货！以下是您的商品信息：</p>
            
            <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">${productName}</h3>
              <p><strong>密钥/兑换码：</strong></p>
              <div style="background: #fff; padding: 15px; border-radius: 4px; font-family: monospace; font-size: 18px; text-align: center; letter-spacing: 2px;">
                ${keyCode}
              </div>
            </div>
            
            <p><strong>订单号：</strong>${orderNo}</p>
            <p>请妥善保管您的密钥，祝您使用愉快！</p>
            
            <hr style="margin: 30px 0;" />
            <p style="color: #6B7280; font-size: 12px;">
              此邮件为系统自动发送，请勿回复。<br />
              如有问题，请联系客服。
            </p>
          </div>
        `
      };
      
      // 这里使用 nodemailer 发送邮件
      // 实际部署时请配置真实的 SMTP 服务（如 SendGrid、阿里云邮件推送等）
      console.log(`📧 模拟发送邮件到: ${to}`);
      console.log(`   主题: ${mailOptions.subject}`);
      console.log(`   内容: 密钥 ${keyCode}`);
      
      // 记录邮件日志
      db.run(
        'INSERT INTO email_logs (order_id, recipient, subject, content, status) VALUES (?, ?, ?, ?, ?)',
        [orderId, to, mailOptions.subject, keyCode, 'sent'],
        (err) => {
          if (err) {
            console.error('❌ 记录邮件日志失败:', err.message);
          }
        }
      );
      
      resolve();
    });
  });
}

// 处理支付成功回调
async function handlePaymentSuccess(orderNo, transactionId) {
  const db = getDB();
  
  return new Promise((resolve, reject) => {
    // 1. 更新订单支付状态
    db.run(
      'UPDATE orders SET payment_status = "paid", payment_time = DATETIME("now"), transaction_id = ? WHERE order_no = ?',
      [transactionId, orderNo],
      async (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        console.log(`✅ 订单 #${orderNo} 支付成功`);
        
        // 2. 获取订单ID
        db.get('SELECT id FROM orders WHERE order_no = ?', [orderNo], async (err, order) => {
          if (err || !order) {
            reject(new Error('订单不存在'));
            return;
          }
          
          // 3. 触发自动发货
          try {
            await autoDeliver(order.id);
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      }
    );
  });
}

module.exports = {
  autoDeliver,
  handlePaymentSuccess,
  sendDeliveryEmail
};

// 命令行测试
if (require.main === module) {
  const orderId = process.argv[2];
  
  if (!orderId) {
    console.log('用法: node auto-deliver.js <order_id>');
    process.exit(1);
  }
  
  autoDeliver(parseInt(orderId))
    .then(() => {
      console.log('✅ 自动发货完成');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ 自动发货失败:', err.message);
      process.exit(1);
    });
}
