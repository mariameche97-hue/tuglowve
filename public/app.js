// --- ESTADO EN MEMORIA (sincronizado con la API / Netlify DB) ---
let inv = [];
let cli = [];
let ven = [];

let currentView = 'dashboard';
let selId = -1; // id de venta seleccionada (id real de la BD)
let itemsVentaTemporal = [];
let editandoVentaId = -1; // id real de venta en edición
let editIdInv = -1;
let editIdCli = -1;

async function api(path, opts) {
    const res = await fetch(path, opts);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error de red' }));
        throw new Error(err.error || 'Error de solicitud');
    }
    if (res.status === 204) return null;
    return res.json();
}

async function cargarDatos() {
    [inv, cli, ven] = await Promise.all([
        api('/api/products'),
        api('/api/clients'),
        api('/api/sales'),
    ]);
    inv.forEach(i => { i.price = parseFloat(i.price); });
    ven.forEach(v => { v.total = parseFloat(v.total); v.paid = parseFloat(v.paid); v.history = v.history || []; v.items = v.items || []; });
}

function getSaleItems(v) {
    return v.items && v.items.length ? v.items : [];
}

// --- NAVEGACIÓN ---
async function nav(page, evt) {
    currentView = page;
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if (evt && evt.currentTarget) evt.currentTarget.classList.add('active');

    document.getElementById('page-title').innerText = page.charAt(0).toUpperCase() + page.slice(1);
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');

    if (page === 'dashboard') {
        document.getElementById('page-dashboard').style.display = 'block';
        renderDashboard();
    } else {
        document.getElementById('page-ventas').style.display = 'block';
        renderTable();
    }
}

function renderDashboard() {
    const ing = ven.reduce((a, v) => a + v.paid, 0);
    const tV = ven.reduce((a, v) => a + v.total, 0);
    const crit = inv.filter(i => i.stock <= i.minStock).length;

    document.getElementById('dash-ingresos').innerText = `$${ing.toFixed(2)}`;
    document.getElementById('dash-deuda').innerText = `$${(tV - ing).toFixed(2)}`;
    document.getElementById('dash-vcount').innerText = ven.length;
    document.getElementById('dash-stock').innerText = crit;

    const lastV = [...ven].reverse().slice(0, 5);
    document.getElementById('body-dash-ventas').innerHTML = lastV.length ? lastV.map(v => {
        let r = v.total - v.paid;
        let bad = r <= 0 ? 'bg-paid' : (v.paid > 0 ? 'bg-partial' : 'bg-debt');
        let txt = r <= 0 ? 'PAGADO' : (v.paid > 0 ? 'ABONADO' : 'PENDIENTE');
        return `<tr><td><b>${v.clientName}</b><br><small style="color:var(--c-text-muted)">${v.date}</small></td><td>$${v.total.toFixed(2)}</td><td>$${v.paid.toFixed(2)}</td><td><span class="badge ${bad}">${txt}</span></td></tr>`;
    }).join('') : '<tr><td colspan="4" style="text-align:center; color:var(--c-text-muted)">Sin ventas registradas aún</td></tr>';
}

function renderTable() {
    const h = document.getElementById('headers');
    const b = document.getElementById('body-datos');
    const filtroCont = document.getElementById('filtro-container');
    b.innerHTML = "";

    if (filtroCont) {
        filtroCont.style.display = currentView === 'ventas' ? 'flex' : 'none';
    }

    if (currentView === 'inventario') {
        h.innerHTML = '<th>Producto / Categoría</th><th>Stock</th><th>Mín.</th><th>Precio Venta</th><th>Acciones</th>';
        inv.forEach((i) => {
            b.innerHTML += `<tr><td><b>${i.name}</b><br><small style="color:var(--c-text-muted)">${i.category || 'General'}</small></td><td>${i.stock}</td><td>${i.minStock}</td><td>$${i.price.toFixed(2)}</td>
            <td><button class="btn btn-secondary" style="padding:4px 10px" onclick="editar(${i.id})">✎ Editar</button></td></tr>`;
        });
    } else if (currentView === 'clientes') {
        h.innerHTML = '<th>Nombre</th><th>Teléfono / WhatsApp</th><th>Instagram</th><th>Acciones</th>';
        cli.forEach((c) => {
            b.innerHTML += `<tr><td><b>${c.name}</b></td><td>${c.phone || '-'}</td><td>${c.instagram || '-'}</td>
            <td><button class="btn btn-secondary" style="padding:4px 10px" onclick="editar(${c.id})">✎ Editar</button></td></tr>`;
        });
    } else if (currentView === 'ventas') {
        h.innerHTML = '<th>Fecha / Cliente</th><th>Total Venta</th><th>Pendiente</th><th>Estatus</th><th>Acciones</th>';

        const filterVal = document.getElementById('filter-ventas') ? document.getElementById('filter-ventas').value : 'todas';

        const ventasFiltradas = ven.filter(v => {
            let r = v.total - v.paid;
            if (filterVal === 'pagadas') return r <= 0;
            if (filterVal === 'nopagadas') return r > 0;
            return true;
        });

        if (ventasFiltradas.length === 0) {
            b.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--c-text-muted); padding:20px;">No hay ventas registradas en esta categoría.</td></tr>';
        } else {
            ventasFiltradas.forEach(v => {
                let r = v.total - v.paid;
                let bad = r <= 0 ? 'bg-paid' : (v.paid > 0 ? 'bg-partial' : 'bg-debt');
                let txt = r <= 0 ? 'PAGADO' : (v.paid > 0 ? 'ABONADO' : 'DEUDA');
                b.innerHTML += `<tr><td><small>${v.date}</small><br><b>${v.clientName}</b></td><td>$${v.total.toFixed(2)}</td><td style="color:var(--c-danger); font-weight:bold">$${r.toFixed(2)}</td>
                <td><span class="badge ${bad}">${txt}</span></td>
                <td><button class="btn btn-primary" style="padding:5px 12px" onclick="abrirAcciones(${v.id})">Gestionar</button></td></tr>`;
            });
        }
    }
}

// --- CREAR Y EDITAR ---
function abrirCrear() {
    editIdInv = -1;
    editIdCli = -1;
    editandoVentaId = -1;
    itemsVentaTemporal = [];
    const body = document.getElementById('form-body');
    document.getElementById('form-title').innerText = "Nuevo Registro";

    if (currentView === 'inventario' || currentView === 'dashboard') {
        body.innerHTML = `
            <label>Nombre del Producto:</label><input id="f-n" placeholder="Ej. Iluminador Glow Greige">
            <label>Categoría / Tono:</label><input id="f-c" placeholder="Ej. Rostro / Tono Oliva Warm">
            <label>Stock Inicial:</label><input type="number" id="f-s" min="0" value="1">
            <label>Stock Mínimo (Alerta):</label><input type="number" id="f-m" min="0" value="2">
            <label>Precio de Venta ($):</label><input type="number" step="0.01" id="f-p" value="0.00">
        `;
    } else if (currentView === 'clientes') {
        body.innerHTML = `
            <label>Nombre Completo:</label><input id="f-n" placeholder="Ej. Camila Silva">
            <label>Teléfono / WhatsApp:</label><input id="f-t" placeholder="Ej. +584141234567">
            <label>Usuario de Instagram:</label><input id="f-ig" placeholder="Ej. @camilasilva">
        `;
    } else {
        if (!cli.length) return alert("Agrega primero al menos una clienta.");
        if (!inv.length) return alert("Agrega primero productos al inventario.");

        body.innerHTML = `
            <label>Seleccionar Clienta:</label>
            <select id="f-cli">${cli.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}</select>

            <div style="border:1px solid var(--c-border); padding:14px; border-radius:8px; margin-bottom:16px; background:var(--c-card-header);">
                <label style="color:var(--c-sidebar-active)">Agregar Producto a la Compra:</label>
                <div style="display:flex; gap:8px; margin-bottom:8px;">
                    <select id="f-p-sel" style="margin-bottom:0; flex:2"></select>
                    <input type="number" id="f-q-sel" min="1" value="1" style="margin-bottom:0; flex:1">
                    <button type="button" class="btn btn-primary" onclick="agregarItemVenta()">+ Añadir</button>
                </div>
            </div>

            <div style="max-height:150px; overflow-y:auto; border:1px solid var(--c-border); border-radius:8px; margin-bottom:12px;">
                <table>
                    <thead><tr><th>Producto</th><th style="text-align:center">Cant.</th><th style="text-align:right">Subtotal</th><th style="text-align:center">Quitar</th></tr></thead>
                    <tbody id="tbody-items-venta"></tbody>
                </table>
            </div>
            <div style="text-align:right; font-weight:bold; font-size:15px; color:var(--c-sidebar-active);">Total: <span id="total-venta-temp">$0.00</span></div>
        `;
        actualizarSelectProductos();
        renderTablaItemsVenta();
    }
    document.getElementById('modal-form').style.display = 'flex';
}

function calcularStockDisponible(productId) {
    const itemInv = inv.find(i => i.id === productId);
    if (!itemInv) return 0;

    let stockDisp = itemInv.stock;

    if (editandoVentaId >= 0) {
        const vOriginal = ven.find(v => v.id === editandoVentaId);
        const origItem = vOriginal ? getSaleItems(vOriginal).find(it => it.productId === productId) : null;
        if (origItem) stockDisp += origItem.qty;
    }

    const agregadosModal = itemsVentaTemporal.filter(it => it.productId === productId).reduce((a, b) => a + b.qty, 0);
    return stockDisp - agregadosModal;
}

function actualizarSelectProductos() {
    const sel = document.getElementById('f-p-sel');
    if (!sel) return;

    sel.innerHTML = inv.map(i => {
        const disp = calcularStockDisponible(i.id);
        return `<option value="${i.id}">${i.name} (Disp: ${disp}) - $${i.price.toFixed(2)}</option>`;
    }).join('');
}

function agregarItemVenta() {
    const productId = parseInt(document.getElementById('f-p-sel').value);
    const qty = parseInt(document.getElementById('f-q-sel').value) || 0;
    const itemInv = inv.find(i => i.id === productId);

    if (!itemInv || qty <= 0) return alert("Selecciona una cantidad válida.");

    const disp = calcularStockDisponible(productId);
    if (qty > disp) return alert(`Stock insuficiente. Solo quedan ${disp} unidades disponibles.`);

    const exist = itemsVentaTemporal.find(it => it.productId === productId);
    if (exist) {
        exist.qty += qty;
        exist.subtotal = exist.qty * exist.price;
    } else {
        itemsVentaTemporal.push({ productId: itemInv.id, name: itemInv.name, qty, price: itemInv.price, subtotal: qty * itemInv.price });
    }

    actualizarSelectProductos();
    renderTablaItemsVenta();
}

function renderTablaItemsVenta() {
    const tbody = document.getElementById('tbody-items-venta');
    if (!tbody) return;

    let total = 0;
    tbody.innerHTML = itemsVentaTemporal.length ? itemsVentaTemporal.map((item, idx) => {
        total += item.subtotal;
        return `<tr>
            <td><b>${item.name}</b></td>
            <td style="text-align:center">${item.qty}</td>
            <td style="text-align:right">$${item.subtotal.toFixed(2)}</td>
            <td style="text-align:center">
                <button type="button" class="btn btn-secondary" style="color:var(--c-danger); padding:2px 8px; font-weight:bold" onclick="eliminarItemVenta(event, ${idx})">✕</button>
            </td>
        </tr>`;
    }).join('') : '<tr><td colspan="4" style="text-align:center; color:var(--c-text-muted); padding:12px;">No has agregado productos a la factura</td></tr>';

    const lblTotal = document.getElementById('total-venta-temp');
    if (lblTotal) lblTotal.innerText = `$${total.toFixed(2)}`;
}

function eliminarItemVenta(evt, idx) {
    if (evt) evt.stopPropagation();
    itemsVentaTemporal.splice(idx, 1);
    actualizarSelectProductos();
    renderTablaItemsVenta();
}

function abrirEditarVenta() {
    if (selId < 0) return;
    editandoVentaId = selId;
    const v = ven.find(x => x.id === selId);

    document.getElementById('modal-acciones').style.display = 'none';
    document.getElementById('form-title').innerText = `Editar Factura #${selId}`;
    itemsVentaTemporal = JSON.parse(JSON.stringify(getSaleItems(v)));

    const body = document.getElementById('form-body');
    body.innerHTML = `
        <label>Clienta:</label>
        <select id="f-cli">${cli.map(c => `<option value="${c.name}" ${c.name === v.clientName ? 'selected' : ''}>${c.name}</option>`).join('')}</select>

        <div style="border:1px solid var(--c-border); padding:14px; border-radius:8px; margin-bottom:16px; background:var(--c-card-header);">
            <label style="color:var(--c-sidebar-active)">Modificar Productos de la Compra:</label>
            <div style="display:flex; gap:8px; margin-bottom:8px;">
                <select id="f-p-sel" style="margin-bottom:0; flex:2"></select>
                <input type="number" id="f-q-sel" min="1" value="1" style="margin-bottom:0; flex:1">
                <button type="button" class="btn btn-primary" onclick="agregarItemVenta()">+ Añadir</button>
            </div>
        </div>

        <div style="max-height:150px; overflow-y:auto; border:1px solid var(--c-border); border-radius:8px; margin-bottom:12px;">
            <table>
                <thead><tr><th>Producto</th><th style="text-align:center">Cant.</th><th style="text-align:right">Subtotal</th><th style="text-align:center">Quitar</th></tr></thead>
                <tbody id="tbody-items-venta"></tbody>
            </table>
        </div>
        <div style="text-align:right; font-weight:bold; font-size:15px; color:var(--c-sidebar-active);">Nuevo Total: <span id="total-venta-temp">$0.00</span></div>
    `;

    actualizarSelectProductos();
    renderTablaItemsVenta();
    document.getElementById('modal-form').style.display = 'flex';
}

function editar(id) {
    editandoVentaId = -1;
    const body = document.getElementById('form-body');
    document.getElementById('form-title').innerText = "Editar Registro";

    if (currentView === 'inventario') {
        editIdInv = id;
        const item = inv.find(i => i.id === id);
        body.innerHTML = `
            <label>Nombre del Producto:</label><input id="f-n" value="${item.name}">
            <label>Categoría / Tono:</label><input id="f-c" value="${item.category || ''}">
            <label>Stock Actual:</label><input type="number" id="f-s" min="0" value="${item.stock}">
            <label>Stock Mínimo:</label><input type="number" id="f-m" min="0" value="${item.minStock}">
            <label>Precio de Venta ($):</label><input type="number" step="0.01" id="f-p" value="${item.price.toFixed(2)}">
        `;
    } else if (currentView === 'clientes') {
        editIdCli = id;
        const item = cli.find(c => c.id === id);
        body.innerHTML = `
            <label>Nombre Completo:</label><input id="f-n" value="${item.name}">
            <label>Teléfono / WhatsApp:</label><input id="f-t" value="${item.phone || ''}">
            <label>Instagram:</label><input id="f-ig" value="${item.instagram || ''}">
        `;
    }
    document.getElementById('modal-form').style.display = 'flex';
}

async function guardarRegistro() {
    const g = id => document.getElementById(id).value.trim();

    try {
        if (currentView === 'inventario' || (currentView === 'dashboard' && editIdInv === -1 && editandoVentaId === -1 && editIdCli === -1)) {
            if (!g('f-n')) return alert("Ingresa el nombre del producto.");
            const data = { name: g('f-n'), category: g('f-c'), stock: parseInt(g('f-s')) || 0, minStock: parseInt(g('f-m')) || 0, price: parseFloat(g('f-p')) || 0 };
            if (editIdInv === -1) {
                await api('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            } else {
                await api(`/api/products?id=${editIdInv}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            }

        } else if (currentView === 'clientes') {
            if (!g('f-n')) return alert("Ingresa el nombre de la clienta.");
            const data = { name: g('f-n'), phone: g('f-t'), instagram: g('f-ig') };
            if (editIdCli === -1) {
                await api('/api/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            } else {
                await api(`/api/clients?id=${editIdCli}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            }

        } else {
            if (!itemsVentaTemporal.length) return alert("Agrega al menos un producto a la factura.");
            const clientName = g('f-cli');

            if (editandoVentaId >= 0) {
                await api(`/api/sales?id=${editandoVentaId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ clientName, items: itemsVentaTemporal }),
                });
            } else {
                await api('/api/sales', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ clientName, items: itemsVentaTemporal, date: new Date().toLocaleDateString('es-ES') }),
                });
            }
        }

        cerrarModal();
        await cargarDatos();
        nav(currentView === 'dashboard' ? 'ventas' : currentView);
    } catch (e) {
        alert(e.message);
    }
}

// --- COBRANZAS ---
function abrirAcciones(id) {
    selId = id;
    const v = ven.find(x => x.id === id);
    const r = v.total - v.paid;
    const items = getSaleItems(v);

    document.getElementById('v-info').innerHTML = `<b>Clienta: ${v.clientName}</b><br><small style="color:var(--c-text-muted)"><b>Productos:</b> ${items.map(it => `${it.name} (x${it.qty})`).join(', ')}</small><br><br>Total Venta: $${v.total.toFixed(2)} | <b style="color:var(--c-danger)">PENDIENTE: $${r.toFixed(2)}</b>`;
    document.getElementById('v-hist').innerHTML = "<b>Historial de Abonos:</b><br>" + (v.history && v.history.length ? v.history.map(h => `• ${h.f}: $${parseFloat(h.m).toFixed(2)}`).join('<br>') : 'Sin abonos aún.');
    document.getElementById('abono-fecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('modal-acciones').style.display = 'flex';
}

async function registrarPago() {
    const m = parseFloat(document.getElementById('abono-monto').value);
    const f = document.getElementById('abono-fecha').value;
    if (isNaN(m) || m <= 0) return alert("Ingresa un monto válido.");

    try {
        await api(`/api/sales?id=${selId}&action=payment`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: m, date: f }),
        });
        document.getElementById('abono-monto').value = "";
        await cargarDatos();
        abrirAcciones(selId);
        renderTable();
    } catch (e) {
        alert(e.message);
    }
}

function verNotaEntrega() {
    const v = ven.find(x => x.id === selId);
    document.getElementById('n-folio').innerText = "TGV-" + (1000 + v.id);
    document.getElementById('n-cli').innerText = v.clientName;
    document.getElementById('n-fec').innerText = v.date;

    const items = getSaleItems(v);
    document.getElementById('n-body').innerHTML = items.map(it => `
        <tr><td>${it.name}</td><td style="text-align:center">${it.qty}</td><td style="text-align:right">$${it.price.toFixed(2)}</td><td style="text-align:right">$${it.subtotal.toFixed(2)}</td></tr>
    `).join('');

    document.getElementById('n-total').innerText = `$${v.total.toFixed(2)}`;
    document.getElementById('modal-nota').style.display = 'flex';
}

function enviarWhatsApp() {
    const v = ven.find(x => x.id === selId);
    const items = getSaleItems(v);
    const lista = items.map(it => `• ${it.name} (x${it.qty})`).join('%0A');

    const msg = `*TUGLOW.VE* 🌿%0A*Nota de Venta: TGV-${1000 + v.id}*%0A--------------------------------%0A*Clienta:* ${v.clientName}%0A*Detalle:*%0A${lista}%0A--------------------------------%0A*Total Venta:* $${v.total.toFixed(2)}%0A*Monto Abonado:* $${v.paid.toFixed(2)}%0A*Saldo Pendiente:* $${(v.total - v.paid).toFixed(2)}%0A--------------------------------%0A_¡Muchas gracias por elegir TUGLOW.VE!_`;
    window.open(`https://wa.me/?text=${msg}`);
}

async function anularVenta() {
    if (confirm("¿Seguro que deseas anular esta venta? Se devolverán los productos al inventario.")) {
        try {
            await api(`/api/sales?id=${selId}`, { method: 'DELETE' });
            cerrarModal();
            await cargarDatos();
            renderTable();
        } catch (e) {
            alert(e.message);
        }
    }
}

function imprimirDocumento(areaId) {
    const contenido = document.getElementById(areaId).innerHTML;
    const win = window.open('', '', 'width=800,height=900');
    win.document.write(`
        <html>
        <head><title>Comprobante TUGLOW.VE</title>
        <style>
            body { font-family: 'Segoe UI', sans-serif; padding: 30px; color: #2B2D29; background: #F3F0EA; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th { background: #DFD9CE; padding: 10px; font-size: 11px; text-transform: uppercase; color: #374130; }
            td { padding: 10px; border-bottom: 1px solid #CEC7BC; font-size: 12px; }
        </style>
        </head>
        <body>${contenido}<script>window.onload = function() { window.print(); window.close(); };<\/script></body>
        </html>
    `);
    win.document.close();
}

function cerrarModal() {
    editandoVentaId = -1;
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
}

function exportarCSV() {
    const data = currentView === 'inventario' ? inv : (currentView === 'clientes' ? cli : ven);
    if (!data.length) return alert("No hay datos para exportar.");

    let csv = "Dato1,Dato2,Dato3\n";
    if (currentView === 'inventario') {
        data.forEach(o => csv += `${o.name},${o.category || ''},${o.stock},${o.price}\n`);
    } else if (currentView === 'clientes') {
        data.forEach(o => csv += `${o.name},${o.phone || ''},${o.instagram || ''}\n`);
    } else {
        data.forEach(o => csv += `${o.date},${o.clientName},${o.total},${o.paid}\n`);
    }
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv);
    a.download = `TUGLOW_${currentView}.csv`;
    a.click();
}

function importarCSV(input) {
    if (!input.files.length) return;
    const reader = new FileReader();
    reader.onload = async function (e) {
        const lines = e.target.result.split('\n');
        const nuevos = [];
        for (let i = 1; i < lines.length; i++) {
            const c = lines[i].split(',');
            if (c.length > 1 && currentView === 'inventario') {
                nuevos.push({ name: c[0].trim(), category: c[1]?.trim() || 'General', stock: parseInt(c[2]) || 0, minStock: 2, price: parseFloat(c[3]) || 0 });
            }
        }
        try {
            for (const p of nuevos) {
                await api('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
            }
            await cargarDatos();
            renderTable();
            alert("Importación exitosa.");
        } catch (err) {
            alert(err.message);
        }
    };
    reader.readAsText(input.files[0]);
}

document.getElementById('top-date').innerText = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

cargarDatos()
    .then(() => renderDashboard())
    .catch(e => {
        document.getElementById('content').innerHTML = `<div style="padding:40px;text-align:center;color:var(--c-danger)">No se pudieron cargar los datos: ${e.message}</div>`;
    });
