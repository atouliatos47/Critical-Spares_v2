const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const url = require('url');
const os = require('os');

// Use Render's port if available, otherwise default to 3000
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

// UPDATED: Files are now in the root directory for GitHub Pages compatibility
const APP_DIR = __dirname; 

let items = [];
let workstations = [];
let nextId = 1;
let nextWsId = 1;
let clients = [];
let connectedUsers = new Map();

// Get local IP
function getLocalIP() {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) return net.address;
        }
    }
    return 'localhost';
}

// Load data
async function loadData() {
    try {
        const data = await fs.readFile(DB_PATH, 'utf8');
        const parsed = JSON.parse(data);
        items = parsed.items || [];
        workstations = parsed.workstations || [];
        nextId = parsed.nextId || 1;
        nextWsId = parsed.nextWsId || 1;
        console.log(`✅ Loaded ${items.length} items, ${workstations.length} workstations`);
    } catch (err) {
        console.log('📁 Starting fresh database');
        await saveData();
    }
}

// Save data
async function saveData() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        const data = { items, workstations, nextId, nextWsId };
        await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error saving:', err);
    }
}

// Broadcast to clients
function broadcast(eventName, data) {
    const message = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    clients.forEach(client => {
        try {
            client.write(message);
        } catch (err) {}
    });
}

// Broadcast user list
function broadcastUserList() {
    const users = Array.from(connectedUsers.values()).map(u => ({
        name: u.name,
        connectedAt: u.connectedAt
    }));
    broadcast('users', users);
}

// Parse body
function getBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch (e) {
                reject(e);
            }
        });
    });
}

// Serve static files
async function serveStaticFile(res, filePath, contentType) {
    try {
        const data = await fs.readFile(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    } catch (err) {
        console.error(`❌ Missing file: ${filePath}`);
        res.writeHead(404);
        res.end('File not found');
    }
}

// Create server
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    // Serve HTML
    if (parsedUrl.pathname === '/' || parsedUrl.pathname === '/index.html') {
        return serveStaticFile(res, path.join(APP_DIR, 'index.html'), 'text/html');
    }

    // Serve images
    if (parsedUrl.pathname.startsWith('/img/')) {
        const imgPath = path.join(APP_DIR, parsedUrl.pathname);
        return serveStaticFile(res, imgPath, 'image/png');
    }

    // Serve CSS
    if (parsedUrl.pathname === '/css/style.css') {
        return serveStaticFile(res, path.join(APP_DIR, 'css', 'style.css'), 'text/css');
    }

    // Serve JS files
    if (parsedUrl.pathname.startsWith('/js/') && parsedUrl.pathname.endsWith('.js')) {
        const jsPath = path.join(APP_DIR, parsedUrl.pathname);
        return serveStaticFile(res, jsPath, 'application/javascript');
    }

    // SSE with user tracking
    if (parsedUrl.pathname === '/events' && req.method === 'GET') {
        const userName = parsedUrl.query.name || 'Anonymous';
        const userIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        connectedUsers.set(res, {
            name: userName,
            connectedAt: new Date().toISOString(),
            ip: userIP
        });

        res.write(`event: init\ndata: ${JSON.stringify({ items, workstations })}\n\n`);
        broadcastUserList();
        clients.push(res);

        req.on('close', () => {
            clients = clients.filter(c => c !== res);
            connectedUsers.delete(res);
            broadcastUserList();
        });
        return;
    }

    // ===== ITEMS ENDPOINTS =====
    if (parsedUrl.pathname === '/items' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(items));
    }

    if (parsedUrl.pathname === '/items' && req.method === 'POST') {
        try {
            const body = await getBody(req);
            const item = {
                id: nextId++,
                name: body.name,
                location: body.location || '',
                workstationId: body.workstationId || null,
                addedBy: body.addedBy || 'Unknown',
                quantity: body.quantity || 1,
                minStock: body.minStock || 0,
                notes: body.notes || '',
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            };
            items.push(item);
            await saveData();
            broadcast('newItem', item);
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(item));
        } catch (err) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
        return;
    }

    // Use item
    const useMatch = parsedUrl.pathname.match(/^\/items\/(\d+)\/use$/);
    if (useMatch && req.method === 'POST') {
        try {
            const id = parseInt(useMatch[1]);
            const body = await getBody(req);
            const item = items.find(i => i.id === id);
            if (!item) {
                res.writeHead(404);
                return res.end(JSON.stringify({ error: 'Not found' }));
            }
            const amount = body.amount || 1;
            item.quantity = Math.max(0, item.quantity - amount);
            item.lastUpdated = new Date().toISOString();
            item.lastUsedBy = body.usedBy || 'Unknown';
            await saveData();
            broadcast('updateItem', item);
            res.end(JSON.stringify(item));
        } catch (err) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Invalid request' }));
        }
        return;
    }

    // Restock item
    const restockMatch = parsedUrl.pathname.match(/^\/items\/(\d+)\/restock$/);
    if (restockMatch && req.method === 'POST') {
        try {
            const id = parseInt(restockMatch[1]);
            const body = await getBody(req);
            const item = items.find(i => i.id === id);
            if (!item) {
                res.writeHead(404);
                return res.end(JSON.stringify({ error: 'Not found' }));
            }
            const amount = body.amount || 1;
            item.quantity += amount;
            item.lastUpdated = new Date().toISOString();
            await saveData();
            broadcast('updateItem', item);
            res.end(JSON.stringify(item));
        } catch (err) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Invalid request' }));
        }
        return;
    }

    // Delete item
    const deleteMatch = parsedUrl.pathname.match(/^\/items\/(\d+)\/delete$/);
    if (deleteMatch && req.method === 'POST') {
        const id = parseInt(deleteMatch[1]);
        const index = items.findIndex(i => i.id === id);
        if (index === -1) {
            res.writeHead(404);
            return res.end(JSON.stringify({ error: 'Not found' }));
        }
        const removed = items.splice(index, 1)[0];
        await saveData();
        broadcast('deleteItem', { id });
        res.end(JSON.stringify({ success: true }));
        return;
    }

    // ===== WORKSTATION ENDPOINTS =====
    if (parsedUrl.pathname === '/workstations' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(workstations));
    }

    if (parsedUrl.pathname === '/workstations' && req.method === 'POST') {
        try {
            const body = await getBody(req);
            const ws = {
                id: nextWsId++,
                name: body.name.trim(),
                description: body.description || '',
                addedBy: body.addedBy || 'Unknown',
                createdAt: new Date().toISOString()
            };
            workstations.push(ws);
            await saveData();
            broadcast('newWorkstation', ws);
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(ws));
        } catch (err) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
        return;
    }

    const deleteWsMatch = parsedUrl.pathname.match(/^\/workstations\/(\d+)\/delete$/);
    if (deleteWsMatch && req.method === 'POST') {
        const id = parseInt(deleteWsMatch[1]);
        const index = workstations.findIndex(ws => ws.id === id);
        if (index === -1) {
            res.writeHead(404);
            return res.end(JSON.stringify({ error: 'Not found' }));
        }
        workstations.splice(index, 1);
        items.forEach(item => { if (item.workstationId === id) item.workstationId = null; });
        await saveData();
        broadcast('deleteWorkstation', { id });
        broadcast('init_items', items);
        res.end(JSON.stringify({ success: true }));
        return;
    }

    res.writeHead(404);
    res.end('Not found');
});

// Start server
async function start() {
    await loadData();
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server live on port ${PORT}`);
    });
}

start();