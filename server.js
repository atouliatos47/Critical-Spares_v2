const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const url = require('url');
const os = require('os');

const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

let items = [];
let nextId = 1;
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
        nextId = parsed.nextId || 1;
        console.log(`✅ Loaded ${items.length} items`);
    } catch (err) {
        console.log('📁 Starting fresh database');
        await saveData();
    }
}

// Save data
async function saveData() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        const data = { items, nextId };
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
        const data = await fs.readFile(filePath, 'utf8');
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    } catch (err) {
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
        return serveStaticFile(res, path.join(PUBLIC_DIR, 'index.html'), 'text/html');
    }

    // Serve CSS
    if (parsedUrl.pathname === '/css/style.css') {
        return serveStaticFile(res, path.join(PUBLIC_DIR, 'css/style.css'), 'text/css');
    }

    // Serve JS files
    if (parsedUrl.pathname === '/js/app.js') {
        return serveStaticFile(res, path.join(PUBLIC_DIR, 'js/app.js'), 'application/javascript');
    }
    if (parsedUrl.pathname === '/js/api.js') {
        return serveStaticFile(res, path.join(PUBLIC_DIR, 'js/api.js'), 'application/javascript');
    }
    if (parsedUrl.pathname === '/js/ui.js') {
        return serveStaticFile(res, path.join(PUBLIC_DIR, 'js/ui.js'), 'application/javascript');
    }
    if (parsedUrl.pathname === '/js/components.js') {
        return serveStaticFile(res, path.join(PUBLIC_DIR, 'js/components.js'), 'application/javascript');
    }
    if (parsedUrl.pathname === '/js/utils.js') {
        return serveStaticFile(res, path.join(PUBLIC_DIR, 'js/utils.js'), 'application/javascript');
    }

    // SSE with user tracking - FIXED VERSION
    if (parsedUrl.pathname === '/events' && req.method === 'GET') {
        const userName = parsedUrl.query.name || 'Anonymous';
        const userIP = req.socket.remoteAddress;
        
        console.log(`📱 New connection from ${userIP} with name: ${userName}`);

        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });

        // Store user connection
        connectedUsers.set(res, {
            name: userName,
            connectedAt: new Date().toISOString(),
            ip: userIP
        });

        // Send initial data
        res.write(`event: init\ndata: ${JSON.stringify(items)}\n\n`);
        
        // Broadcast updated user list to ALL clients
        broadcastUserList();

        clients.push(res);
        console.log(`👤 ${userName} connected. Total clients: ${clients.length}, Total users: ${connectedUsers.size}`);

        req.on('close', () => {
            clients = clients.filter(c => c !== res);
            connectedUsers.delete(res);
            broadcastUserList();
            console.log(`👤 User disconnected. Total clients: ${clients.length}, Total users: ${connectedUsers.size}`);
        });
        return;
    }

    // Get items
    if (parsedUrl.pathname === '/items' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(items));
    }

    // Add item
    if (parsedUrl.pathname === '/items' && req.method === 'POST') {
        try {
            const body = await getBody(req);
            const item = {
                id: nextId++,
                name: body.name,
                location: body.location || '',
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
            console.log(`➕ Added: ${item.name} by ${item.addedBy}`);
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
            const lowStock = item.minStock > 0 && item.quantity <= item.minStock;
            console.log(`⬇️ Used: ${item.name} (-${amount}) -> ${item.quantity}${lowStock ? ' ⚠️' : ''}`);
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
            console.log(`⬆️ Restocked: ${item.name} (+${amount}) -> ${item.quantity}`);
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
        console.log(`🗑️ Deleted: ${removed.name}`);
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
        const ip = getLocalIP();
        console.log('\n' + '='.repeat(50));
        console.log('📦 CRITICAL SPARES TRACKER');
        console.log('='.repeat(50));
        console.log(`\n📍 Local:    http://localhost:${PORT}`);
        console.log(`📱 Network:   http://${ip}:${PORT}`);
        console.log(`\n📊 Items: ${items.length}`);
        console.log('\n' + '='.repeat(50) + '\n');
    });
}

start();