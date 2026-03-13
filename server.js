const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const url = require('url');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3000;
const APP_DIR = __dirname;

// ===== DATABASE =====
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function initDb() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS workstations (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            added_by TEXT DEFAULT 'Unknown',
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS items (
            id SERIAL PRIMARY KEY,
            part_no TEXT DEFAULT '',
            name TEXT NOT NULL,
            location TEXT DEFAULT '',
            workstation_id INTEGER REFERENCES workstations(id) ON DELETE SET NULL,
            added_by TEXT DEFAULT 'Unknown',
            quantity INTEGER DEFAULT 1,
            min_stock INTEGER DEFAULT 0,
            notes TEXT DEFAULT '',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            last_updated TIMESTAMPTZ DEFAULT NOW(),
            last_used_by TEXT DEFAULT ''
        );
    `);
    console.log('✅ Database tables ready');
}

function mapItem(row) {
    return {
        id: row.id,
        partNo: row.part_no,
        name: row.name,
        location: row.location,
        workstationId: row.workstation_id,
        addedBy: row.added_by,
        quantity: row.quantity,
        minStock: row.min_stock,
        notes: row.notes,
        createdAt: row.created_at,
        lastUpdated: row.last_updated,
        lastUsedBy: row.last_used_by
    };
}

function mapWorkstation(row) {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        addedBy: row.added_by,
        createdAt: row.created_at
    };
}

// ===== SSE =====
let clients = [];
let connectedUsers = new Map();

function broadcast(eventName, data) {
    const message = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    clients.forEach(client => { try { client.write(message); } catch (e) {} });
}

function broadcastUserList() {
    const users = Array.from(connectedUsers.values()).map(u => ({
        name: u.name, connectedAt: u.connectedAt
    }));
    broadcast('users', users);
}

// ===== HELPERS =====
function getBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    });
}

async function serveFile(res, filePath, contentType) {
    try {
        const data = await fs.readFile(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    } catch {
        res.writeHead(404);
        res.end('Not found');
    }
}

// ===== SERVER =====
const server = http.createServer(async (req, res) => {
    const p = url.parse(req.url, true);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    // Static
    if (p.pathname === '/' || p.pathname === '/index.html')
        return serveFile(res, path.join(APP_DIR, 'index.html'), 'text/html');
    if (p.pathname.startsWith('/img/'))
        return serveFile(res, path.join(APP_DIR, p.pathname), 'image/png');
    if (p.pathname === '/css/style.css')
        return serveFile(res, path.join(APP_DIR, 'css/style.css'), 'text/css');
    if (p.pathname.startsWith('/js/') && p.pathname.endsWith('.js'))
        return serveFile(res, path.join(APP_DIR, p.pathname), 'application/javascript');

    // SSE
    if (p.pathname === '/events' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
        try {
            const [ir, wr] = await Promise.all([
                pool.query('SELECT * FROM items ORDER BY id ASC'),
                pool.query('SELECT * FROM workstations ORDER BY id ASC')
            ]);
            res.write(`event: init\ndata: ${JSON.stringify({ items: ir.rows.map(mapItem), workstations: wr.rows.map(mapWorkstation) })}\n\n`);
        } catch (e) { console.error('SSE init error:', e); }
        const userName = p.query.name || 'Anonymous';
        connectedUsers.set(res, { name: userName, connectedAt: new Date().toISOString() });
        broadcastUserList();
        clients.push(res);
        req.on('close', () => { clients = clients.filter(c => c !== res); connectedUsers.delete(res); broadcastUserList(); });
        return;
    }

    // GET items
    if (p.pathname === '/items' && req.method === 'GET') {
        const r = await pool.query('SELECT * FROM items ORDER BY id ASC');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(r.rows.map(mapItem)));
    }

    // POST item
    if (p.pathname === '/items' && req.method === 'POST') {
        try {
            const b = await getBody(req);
            const r = await pool.query(
                `INSERT INTO items (part_no,name,location,workstation_id,added_by,quantity,min_stock,notes)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
                [b.partNo||'', b.name, b.location||'', b.workstationId||null, b.addedBy||'Unknown', b.quantity||1, b.minStock||0, b.notes||'']
            );
            const item = mapItem(r.rows[0]);
            broadcast('newItem', item);
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(item));
        } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
        return;
    }

    // Use item
    const useMatch = p.pathname.match(/^\/items\/(\d+)\/use$/);
    if (useMatch && req.method === 'POST') {
        try {
            const b = await getBody(req);
            const r = await pool.query(
                `UPDATE items SET quantity=GREATEST(0,quantity-$1), last_updated=NOW(), last_used_by=$2 WHERE id=$3 RETURNING *`,
                [b.amount||1, b.usedBy||'Unknown', parseInt(useMatch[1])]
            );
            if (!r.rows.length) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Not found' })); }
            const item = mapItem(r.rows[0]);
            broadcast('updateItem', item);
            res.end(JSON.stringify(item));
        } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
        return;
    }

    // Restock item
    const restockMatch = p.pathname.match(/^\/items\/(\d+)\/restock$/);
    if (restockMatch && req.method === 'POST') {
        try {
            const b = await getBody(req);
            const r = await pool.query(
                `UPDATE items SET quantity=quantity+$1, last_updated=NOW() WHERE id=$2 RETURNING *`,
                [b.amount||1, parseInt(restockMatch[1])]
            );
            if (!r.rows.length) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Not found' })); }
            const item = mapItem(r.rows[0]);
            broadcast('updateItem', item);
            res.end(JSON.stringify(item));
        } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
        return;
    }

    // Delete item
    const delItemMatch = p.pathname.match(/^\/items\/(\d+)\/delete$/);
    if (delItemMatch && req.method === 'POST') {
        await pool.query('DELETE FROM items WHERE id=$1', [parseInt(delItemMatch[1])]);
        broadcast('deleteItem', { id: parseInt(delItemMatch[1]) });
        res.end(JSON.stringify({ success: true }));
        return;
    }

    // GET workstations
    if (p.pathname === '/workstations' && req.method === 'GET') {
        const r = await pool.query('SELECT * FROM workstations ORDER BY id ASC');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(r.rows.map(mapWorkstation)));
    }

    // POST workstation
    if (p.pathname === '/workstations' && req.method === 'POST') {
        try {
            const b = await getBody(req);
            const r = await pool.query(
                `INSERT INTO workstations (name,description,added_by) VALUES ($1,$2,$3) RETURNING *`,
                [b.name.trim(), b.description||'', b.addedBy||'Unknown']
            );
            const ws = mapWorkstation(r.rows[0]);
            broadcast('newWorkstation', ws);
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(ws));
        } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid JSON' })); }
        return;
    }

    // Delete workstation
    const delWsMatch = p.pathname.match(/^\/workstations\/(\d+)\/delete$/);
    if (delWsMatch && req.method === 'POST') {
        const id = parseInt(delWsMatch[1]);
        await pool.query('DELETE FROM workstations WHERE id=$1', [id]);
        broadcast('deleteWorkstation', { id });
        const ir = await pool.query('SELECT * FROM items ORDER BY id ASC');
        broadcast('init_items', ir.rows.map(mapItem));
        res.end(JSON.stringify({ success: true }));
        return;
    }

    res.writeHead(404);
    res.end('Not found');
});

async function start() {
    await initDb();
    server.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server live on port ${PORT}`));
}

start();
