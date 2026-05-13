
// ============================================================
// VirtualMall 绠＄悊鍚庡彴 - 鍏ㄩ儴璋冪敤鍚庣 API
// ============================================================

const EMOJIS = ['馃巵','馃幃','馃','馃幀','馃幍','鈽侊笍','馃摫','馃挸','馃摎','馃幆','猸?,'馃敟','馃拵','馃彿锔?,'馃帀','馃摝'];

// ========== 鐧诲綍妫€鏌?==========
if(sessionStorage.getItem('vm_logged_in')!=='true') window.location.href='admin-login.html';

// ========== API 鍩虹 ==========
const API = '';  // 鍚屾簮閮ㄧ讲

async function apiFetch(path, options={}){
    const res  = await fetch(API + path, options);
    const json = await res.json();
    if(!json.success) throw new Error(json.message || '鎿嶄綔澶辫触');
    return json;
}

// ========== 椤甸潰鍒囨崲 ==========
function switchPage(name){
    document.querySelectorAll('.page').forEach(p => p.style.display='none');
    const pageEl = document.getElementById('page-'+name);
    if(pageEl) pageEl.style.display='block';
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.sidebar-link').forEach(l => {
        if(l.getAttribute('onclick') && l.getAttribute('onclick').includes("'"+name+"'")) l.classList.add('active');
    });
    if(name==='dashboard') updateStats();
    if(name==='products')  renderProducts();
    if(name==='inventory') { loadInventoryProductOptions(); renderInventory(); }
    if(name==='orders')    renderOrders();
    if(name==='payments') loadQrPreviews();
}

// ========== 浠〃鐩?==========
async function updateStats(){
    try {
        const json = await apiFetch('/api/stats');
        const d = json.data || {};
        document.getElementById('stat-products').textContent  = d.products || 0;
        document.getElementById('stat-orders').textContent   = d.orders || 0;
        document.getElementById('stat-revenue').textContent  = '楼' + (d.revenue || 0);
        document.getElementById('stat-inventory').textContent = d.inventory || 0;
        const invTrend = document.getElementById('stat-inventory-trend');
        const unused = d.inventory || 0;
        if(unused === 0){ invTrend.textContent='鈿狅笍 搴撳瓨宸茬┖锛岃鍙婃椂琛ュ厖锛?; invTrend.className='stat-trend down'; }
        else if(unused < 10){ invTrend.textContent='鈿狅笍 搴撳瓨涓嶈冻 10 鏉★紝璇峰強鏃惰ˉ鍏?; invTrend.className='stat-trend down'; }
        else { invTrend.textContent='鉁?搴撳瓨鍏呰冻锛?+unused+' 鏉℃湭浣跨敤锛?; invTrend.className='stat-trend up'; }
    } catch(e){
        console.error('鍔犺浇缁熻澶辫触锛?, e);
    }
}

// ========== 鍟嗗搧绠＄悊 ==========
let allProductsCache = [];
let currentProductPage = 1;
const PRODUCTS_PER_PAGE = 10;

async function loadProducts(){
    const json = await apiFetch('/api/products');
    allProductsCache = json.data || [];
    return allProductsCache;
}
function getProducts(){ return allProductsCache; }

async function renderProducts(){
    await loadProducts();
    const search  = (document.getElementById('searchInput')||{}).value.toLowerCase();
    const cat     = (document.getElementById('categoryFilter')||{}).value;
    const badge   = (document.getElementById('badgeFilter')||{}).value;
    let filtered = allProductsCache.filter(p => {
        const m = !search || (p.name||'').toLowerCase().includes(search) || (p.description||'').toLowerCase().includes(search);
        return m && (!cat || p.category===cat) && (!badge || p.badge===badge);
    });
    const totalPages = Math.max(1, Math.ceil(filtered.length / PRODUCTS_PER_PAGE));
    if(currentProductPage > totalPages) currentProductPage = totalPages;
    const start = (currentProductPage-1)*PRODUCTS_PER_PAGE;
    const items = filtered.slice(start, start+PRODUCTS_PER_PAGE);

    const tbody = document.getElementById('productsTable');
    const empty = document.getElementById('emptyState');
    if(!filtered.length){
        tbody.innerHTML = '';
        empty.style.display = 'block';
    } else {
        empty.style.display = 'none';
        tbody.innerHTML = items.map(p => {
            const badgeHtml = p.badge==='hot'?'<span class="badge badge-hot">鐑攢</span>':p.badge==='new'?'<span class="badge badge-new">鏂板搧</span>':p.badge==='sale'?'<span class="badge badge-sale">淇冮攢</span>':'<span class="badge badge-none">--</span>';
            const discount = p.original_price ? Math.round(p.price/p.original_price*10*10)/10+'鎶? : '';
            const nameEscaped = (p.name||'').replace(/'/g,'\\'');
            return `<tr>
                <td><div style="width:40px;height:40px;background:#f7fafc;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:20px;">${p.emoji||'馃摝'}</div></td>
                <td style="font-weight:600;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${p.name||''}">${p.name||''}</td>
                <td>${p.category||''}</td><td>${badgeHtml}</td>
                <td style="color:#e53e3e;font-weight:700;">楼${p.price}</td>
                <td>${p.original_price?'楼'+p.original_price+' <span style="color:#a0aec0;font-size:12px;">'+discount+'</span>':'--'}</td>
                <td>${(p.sales||0).toLocaleString()}</td>
                <td><div style="display:flex;gap:6px;"><button class="btn btn-sm btn-ghost" onclick="editProduct(${p.id})">缂栬緫</button><button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.id})">鍒犻櫎</button></div></td>
            </tr>`;
        }).join('');
    }
    // 鍒嗛〉
    const pag = document.getElementById('pagination');
    if(totalPages<=1){
        pag.innerHTML = `<span>鍏?${filtered.length} 浠跺晢鍝?/span><div class="pagination-btns"></div>`;
    } else {
        let btns = '';
        if(currentProductPage>1) btns += `<button class="page-btn" onclick="goProductPage(${currentProductPage-1})">鈥?/button>`;
        for(let i=1;i<=totalPages;i++) btns += `<button class="page-btn ${i===currentProductPage?'active':''}" onclick="goProductPage(${i})">${i}</button>`;
        if(currentProductPage<totalPages) btns += `<button class="page-btn" onclick="goProductPage(${currentProductPage+1})">鈥?/button>`;
        pag.innerHTML = `<span>鍏?${filtered.length} 浠讹紝绗?${currentProductPage}/${totalPages} 椤?/span><div class="pagination-btns">${btns}</div>`;
    }
}
function goProductPage(p){ currentProductPage=p; renderProducts(); }

// Emoji Picker
function initEmojiPicker(){
    const c = document.getElementById('emojiPicker');
    if(!c) return;
    c.innerHTML = EMOJIS.map(e => `<div class="emoji-option" onclick="selectEmoji('${e}')">${e}</div>`).join('');
}
function selectEmoji(e){
    const inp = document.getElementById('formEmoji');
    if(inp) inp.value = e;
    document.querySelectorAll('.emoji-option').forEach(el => el.classList.toggle('selected', el.textContent===e));
}
function openProductModal(){
    document.getElementById('editId').value = '';
    document.getElementById('modalTitle').textContent = '娣诲姞鍟嗗搧';
    document.getElementById('formEmoji').value = '馃摝';
    document.getElementById('formName').value = '';
    document.getElementById('formCategory').value = '绀煎搧鍗?;
    document.getElementById('formBadge').value = 'none';
    document.getElementById('formDesc').value = '';
    document.getElementById('formPrice').value = '';
    document.getElementById('formOriginalPrice').value = '';
    document.getElementById('formSales').value = 0;
    initEmojiPicker(); selectEmoji('馃摝');
    document.getElementById('productModal').classList.add('show');
}
function closeProductModal(){ document.getElementById('productModal').classList.remove('show'); }

async function editProduct(id){
    try {
        const json = await apiFetch('/api/products/'+id);
        const p = json.data;
        if(!p) return;
        document.getElementById('editId').value = id;
        document.getElementById('modalTitle').textContent = '缂栬緫鍟嗗搧';
        document.getElementById('formEmoji').value = p.emoji||'馃摝';
        document.getElementById('formName').value = p.name||'';
        document.getElementById('formCategory').value = p.category||'绀煎搧鍗?;
        document.getElementById('formBadge').value = p.badge||'none';
        document.getElementById('formDesc').value = p.description||'';
        document.getElementById('formPrice').value = p.price||'';
        document.getElementById('formOriginalPrice').value = p.original_price||'';
        document.getElementById('formSales').value = p.sales||0;
        initEmojiPicker(); selectEmoji(p.emoji||'馃摝');
        document.getElementById('productModal').classList.add('show');
    } catch(e){ showToast('鍔犺浇鍟嗗搧澶辫触锛?+e.message, 'error'); }
}

async function saveProduct(){
    const name  = document.getElementById('formName').value.trim();
    const price = parseFloat(document.getElementById('formPrice').value);
    if(!name || !price){ showToast('璇峰～鍐欏晢鍝佸悕绉板拰鍞环','error'); return; }
    const editId = document.getElementById('editId').value;
    const body = {
        emoji:         document.getElementById('formEmoji').value||'馃摝',
        name,
        category:      document.getElementById('formCategory').value,
        badge:         document.getElementById('formBadge').value,
        description:   document.getElementById('formDesc').value.trim(),
        price,
        original_price: parseFloat(document.getElementById('formOriginalPrice').value)||0,
        sales:         parseInt(document.getElementById('formSales').value)||0,
        rating:        5,
        reviews:       0,
    };
    try {
        if(editId){
            await apiFetch('/api/products/'+editId, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
            showToast('鍟嗗搧鏇存柊鎴愬姛锛?,'success');
        } else {
            await apiFetch('/api/products', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
            showToast('鍟嗗搧娣诲姞鎴愬姛锛?,'success');
        }
        closeProductModal();
        await renderProducts();
        await updateStats();
    } catch(e){ showToast('淇濆瓨澶辫触锛?+e.message, 'error'); }
}

let deleteTargetId = null;
function deleteProduct(id){
    deleteTargetId = id;
    document.getElementById('confirmText').textContent = '纭畾瑕佸垹闄よ鍟嗗搧鍚楋紵';
    document.getElementById('confirmModal').classList.add('show');
}
function closeConfirmModal(){ document.getElementById('confirmModal').classList.remove('show'); deleteTargetId = null; }
async function confirmDelete(){
    if(!deleteTargetId) return;
    try {
        await apiFetch('/api/products/'+deleteTargetId, { method:'DELETE' });
        closeConfirmModal();
        await renderProducts();
        await updateStats();
        showToast('鍟嗗搧宸插垹闄?,'success');
    } catch(e){ showToast('鍒犻櫎澶辫触锛?+e.message,'error'); }
}

// ========== 搴撳瓨绠＄悊 ==========
async function loadInventoryProductOptions(){
    await loadProducts();
    ['invProductId','batchProductId','invProductFilter'].forEach(id => {
        const el = document.getElementById(id);
        if(!el) return;
        const val = el.value;
        el.innerHTML = (id==='invProductFilter'?'<option value="">鍏ㄩ儴鍟嗗搧</option>':'<option value="">璇烽€夋嫨鍟嗗搧</option>')
            + allProductsCache.map(p => `<option value="${p.id}" ${String(val)===String(p.id)?'selected':''}>${p.emoji||'馃摝'} ${p.name}</option>`).join('');
    });
}

async function renderInventory(){
    const productId = (document.getElementById('invProductFilter')||{}).value;
    const status    = (document.getElementById('invStatusFilter')||{}).value;
    let url = '/api/inventory';
    const params = [];
    if(productId) params.push('product_id='+encodeURIComponent(productId));
    if(status)    params.push('status='+encodeURIComponent(status));
    if(params.length) url += '?' + params.join('&');
    try {
        const json  = await apiFetch(url);
        const inventory = json.data || [];
        const tbody = document.getElementById('inventoryTable');
        const empty = document.getElementById('invEmpty');
        if(!inventory.length){
            tbody.innerHTML = '';
            empty.style.display = 'block';
        } else {
            empty.style.display = 'none';
            tbody.innerHTML = inventory.map(inv => {
                const p = allProductsCache.find(x => x.id === inv.product_id) || { emoji:'鉂?, name:'鏈煡鍟嗗搧' };
                const statusHtml = inv.status==='unused'?'<span class="badge badge-none">鏈娇鐢?/span>':'<span class="badge badge-shipped">宸插垎閰?/span>';
                return `<tr>
                    <td style="color:#a0aec0;font-size:13px;">#${inv.id}</td>
                    <td><span>${p.emoji||''} ${p.name||'鏈煡'}</span></td>
                    <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;"><a href="${inv.link}" target="_blank" style="color:#667eea;">${inv.link}</a></td>
                    <td><strong>${inv.pwd||'--'}</strong></td>
                    <td>${statusHtml}</td>
                    <td style="font-size:12px;color:#718096;">${inv.order_id||'--'}</td>
                    <td><button class="btn btn-sm btn-danger" onclick="deleteInventory(${inv.id})">鍒犻櫎</button></td>
                </tr>`;
            }).join('');
        }
    } catch(e){ showToast('鍔犺浇搴撳瓨澶辫触锛?+e.message, 'error'); }
}

function openInventoryModal(){
    document.getElementById('invEditId').value = '';
    document.getElementById('invModalTitle').textContent = '娣诲姞搴撳瓨閾炬帴';
    loadInventoryProductOptions();
    document.getElementById('invProductId').value = '';
    document.getElementById('invLink').value = '';
    document.getElementById('invPwd').value = '';
    document.getElementById('invRemark').value = '';
    document.getElementById('inventoryModal').classList.add('show');
}
function closeInventoryModal(){ document.getElementById('inventoryModal').classList.remove('show'); }

async function saveInventory(){
    const product_id = parseInt(document.getElementById('invProductId').value);
    const link      = document.getElementById('invLink').value.trim();
    if(!product_id || !link){ showToast('璇烽€夋嫨鍟嗗搧骞跺～鍐欓摼鎺?,'error'); return; }
    try {
        await apiFetch('/api/inventory', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ product_id, link, pwd:document.getElementById('invPwd').value.trim(), remark:document.getElementById('invRemark').value.trim() })
        });
        closeInventoryModal();
        await renderInventory();
        await updateStats();
        showToast('搴撳瓨閾炬帴娣诲姞鎴愬姛锛?,'success');
    } catch(e){ showToast('娣诲姞澶辫触锛?+e.message, 'error'); }
}

async function deleteInventory(id){
    if(!confirm('纭畾鍒犻櫎璇ュ簱瀛樿褰曞悧锛?)) return;
    try {
        await apiFetch('/api/inventory/'+id, { method:'DELETE' });
        await renderInventory();
        await updateStats();
        showToast('宸插垹闄?,'success');
    } catch(e){ showToast('鍒犻櫎澶辫触锛?+e.message,'error'); }
}

function openBatchImportModal(){
    loadInventoryProductOptions();
    document.getElementById('batchProductId').value = '';
    document.getElementById('batchInput').value = '';
    document.getElementById('batchImportModal').classList.add('show');
}
function closeBatchImportModal(){ document.getElementById('batchImportModal').classList.remove('show'); }

async function batchImport(){
    const product_id = parseInt(document.getElementById('batchProductId').value);
    const text       = document.getElementById('batchInput').value.trim();
    if(!product_id){ showToast('璇烽€夋嫨鍟嗗搧','error'); return; }
    if(!text){ showToast('璇疯緭鍏ラ摼鎺ユ暟鎹?,'error'); return; }
    const lines = text.split('\n').filter(l => l.trim()).map(line => {
        const parts = line.split(',').map(s => s.trim());
        return { link:parts[0]||'', pwd:parts[1]||'', remark:parts[2]||'' };
    }).filter(l => l.link);
    if(!lines.length){ showToast('娌℃湁鏈夋晥鐨勯摼鎺ユ暟鎹?,'error'); return; }
    try {
        await apiFetch('/api/inventory/batch', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ product_id, lines })
        });
        closeBatchImportModal();
        await renderInventory();
        await updateStats();
        showToast('鎴愬姛瀵煎叆 '+lines.length+' 鏉″簱瀛樿褰曪紒','success');
    } catch(e){ showToast('瀵煎叆澶辫触锛?+e.message, 'error'); }
}

// ========== 璁㈠崟绠＄悊 ==========
async function renderOrders(){
    const statusFilter = (document.getElementById('orderStatusFilter')||{}).value;
    const search       = (document.getElementById('orderSearch')||{}).value.toLowerCase();
    let url = '/api/orders';
    const params = [];
    if(statusFilter) params.push('status='+encodeURIComponent(statusFilter));
    if(search)       params.push('search='+encodeURIComponent(search));
    if(params.length) url += '?' + params.join('&');
    try {
        const json      = await apiFetch(url);
        const orders    = json.data || [];
        const container = document.getElementById('ordersList');
        const empty     = document.getElementById('ordersEmpty');
        if(!orders.length){
            container.innerHTML = '';
            empty.style.display = 'block';
            return;
        }
        empty.style.display = 'none';
        container.innerHTML = '<div style="display:flex;flex-direction:column;gap:16px;">'
            + orders.map(o => {
                const statusLabel = o.status==='pending'?'<span class="badge badge-pending">寰呮敮浠?/span>':o.status==='paid'?'<span class="badge badge-paid">宸叉敮浠?/span>':'<span class="badge badge-shipped">宸插彂璐?/span>';
                const itemsHtml = (o.items||[]).map(it => `<div style="font-size:14px;margin-bottom:4px;">${it.emoji||''} ${it.name} 脳 ${it.qty} <span style="color:#e53e3e;font-weight:600;">楼${(it.price*it.qty)}</span></div>`).join('');
                const linksHtml = (o.links||[]).length ? '<div style="margin-top:12px;padding:12px;background:#f0fff4;border-radius:8px;"><div style="font-size:13px;font-weight:600;margin-bottom:8px;">馃摝 鍙戣揣淇℃伅锛?/div>'+o.links.map(l=>`<div style="font-size:13px;margin-bottom:4px;">${l.emoji||''} ${l.productName}锛?{l.link?`<a href="${l.link}" style="color:#667eea;">${l.link}</a>`:`<span style="color:#e53e3e;">${l.remark||'搴撳瓨涓嶈冻'}</span>`}${l.pwd?` <span style="color:#718096;">鎻愬彇鐮侊細${l.pwd}</span>`:''}</div>`).join('')+'</div>' : '';
                const shipBtn = o.status==='paid' ? `<button class="btn btn-sm btn-success" onclick="manualShip('${o.id}')">鎵嬪姩鍙戣揣</button>` : '';
                return `<div style="background:white;border-radius:12px;border:1px solid #e2e8f0;padding:20px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
                    <span style="font-size:14px;color:#718096;">璁㈠崟鍙凤細${o.id}</span>${statusLabel}</div>${itemsHtml}
                    <div style="margin-top:8px;font-size:15px;font-weight:700;text-align:right;">鍚堣锛?span style="color:#e53e3e;">楼${o.total}</span></div>
                    <div style="margin-top:8px;font-size:13px;color:#718096;">閭锛?{o.email||''} ${o.phone?' | 鎵嬫満锛?+o.phone:''}</div>${linksHtml}
                    <div style="margin-top:12px;display:flex;gap:8px;">${shipBtn}<button class="btn btn-sm btn-danger" onclick="deleteOrder('${o.id}')">鍒犻櫎璁㈠崟</button></div>
                </div>`;
            }).join('') + '</div>';
    } catch(e){ showToast('鍔犺浇璁㈠崟澶辫触锛?+e.message, 'error'); }
}

async function manualShip(orderId){
    try {
        await apiFetch('/api/orders/'+orderId+'/ship', { method:'POST' });
        await renderOrders();
        await updateStats();
        showToast('鎵嬪姩鍙戣揣瀹屾垚锛?,'success');
    } catch(e){ showToast('鍙戣揣澶辫触锛?+e.message, 'error'); }
}

async function deleteOrder(orderId){
    if(!confirm('纭畾鍒犻櫎璇ヨ鍗曞悧锛?)) return;
    try {
        await apiFetch('/api/orders/'+orderId, { method:'DELETE' });
        await renderOrders();
        await updateStats();
        showToast('璁㈠崟宸插垹闄?,'success');
    } catch(e){ showToast('鍒犻櫎澶辫触锛?+e.message,'error'); }
}

// ========== 鏀粯璁剧疆 ==========
function uploadQr(type, input){
    const file = input.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = async function(e){
        try {
            await apiFetch('/api/settings/qrcode', {
                method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({ type, data: e.target.result })
            });
            await loadQrPreviews();
            showToast(type==='alipay'?'鏀粯瀹濇敹娆剧爜宸叉洿鏂帮紒':'寰俊鏀舵鐮佸凡鏇存柊锛?, 'success');
        } catch(err){ showToast('涓婁紶澶辫触锛?+err.message, 'error'); }
    };
    reader.readAsDataURL(file);
    input.value = '';
}
async function loadQrPreviews(){
    for(const type of ['alipay','wechat']){
        try {
            const json      = await apiFetch('/api/settings/qrcode?type='+type);
            const url       = json.data || '';
            const container = document.getElementById(type+'Preview');
            if(url){
                container.innerHTML = `<img src="${url}" class="qrcode-preview">`;
            } else {
                container.innerHTML = `<div style="width:120px;height:120px;background:#f7fafc;border-radius:8px;border:2px dashed #cbd5e0;display:flex;align-items:center;justify-content:center;font-size:12px;color:#a0aec0;text-align:center;">灏氭湭涓婁紶</div>`;
            }
        } catch(e){ console.error('鍔犺浇鏀舵鐮佸け璐ワ細', e); }
    }
}

// ========== 淇敼瀵嗙爜 ==========
function changePassword(){
    const current = document.getElementById('currentPwd').value;
    const newPwd  = document.getElementById('newPwd').value;
    const confirm  = document.getElementById('confirmPwd').value;
    const saved   = JSON.parse(localStorage.getItem('vm_admin')||'{}');
    if(current !== saved.password){ showToast('褰撳墠瀵嗙爜涓嶆纭?,'error'); return; }
    if(!newPwd || newPwd.length<6){ showToast('鏂板瘑鐮佽嚦灏?浣?,'error'); return; }
    if(newPwd !== confirm){ showToast('涓ゆ瀵嗙爜涓嶄竴鑷?,'error'); return; }
    saved.password = newPwd;
    localStorage.setItem('vm_admin', JSON.stringify(saved));
    document.getElementById('currentPwd').value = '';
    document.getElementById('newPwd').value    = '';
    document.getElementById('confirmPwd').value  = '';
    showToast('瀵嗙爜淇敼鎴愬姛锛?,'success');
}

function resetData(){
    if(!confirm('纭畾閲嶇疆鎵€鏈夋暟鎹悧锛熻繖灏嗘仮澶嶉粯璁ゅ晢鍝佹暟鎹苟娓呯┖搴撳瓨鍜岃鍗曘€?)) return;
    localStorage.setItem('vm_products', JSON.stringify(DEFAULT_PRODUCTS));
    localStorage.removeItem('vm_inventory');
    localStorage.removeItem('vm_orders');
    renderProducts();
    updateStats();
    showToast('鏁版嵁宸查噸缃?,'info');
}

function logout(){ sessionStorage.removeItem('vm_logged_in'); window.location.href='admin-login.html'; }

// ========== Toast ==========
function showToast(msg, type='info'){
    let el = document.getElementById('toast');
    const icons = {success:'鉁?,error:'鉂?,info:'鈩癸笍'};
    el.className = 'toast toast-'+type;
    el.innerHTML = (icons[type]||'鉁?) + ' ' + msg;
    el.classList.add('show');
    setTimeout(()=> el.classList.remove('show'), 2500);
}

// ========== 鍒濆鍖?==========
loadProducts().then(() => {
    renderProducts();
    updateStats();
});

