// API Communication
const API = {
    eventSource: null,
    items: [],
    
    connectSSE(userName) {
        console.log('Connecting SSE with username:', userName);
        
        if (this.eventSource) {
            console.log('Closing existing connection');
            this.eventSource.close();
        }

        // Make sure userName is encoded properly and not undefined
        const safeName = userName || 'Anonymous';
        const encodedName = encodeURIComponent(safeName);
        const url = '/events?name=' + encodedName;
        console.log('Connecting to:', url);
        
        this.eventSource = new EventSource(url);

        this.eventSource.addEventListener('init', (e) => {
            console.log('Received init event');
            this.items = JSON.parse(e.data);
            UI.renderItems();
            UI.updateStats();
            UI.updateAlerts();
            Utils.setConnected(true);
            Utils.hideLoading();
        });

        this.eventSource.addEventListener('users', (e) => {
            console.log('Received users event with data:', e.data);
            try {
                const users = JSON.parse(e.data);
                UI.updateUserList(users);
            } catch (err) {
                console.error('Error parsing users data:', err);
            }
        });

        this.eventSource.addEventListener('newItem', (e) => {
            const item = JSON.parse(e.data);
            this.items.push(item);
            UI.renderItems();
            UI.updateStats();
            UI.updateAlerts();
            if (item.addedBy !== userName) {
                Utils.showToast(`${item.addedBy} added: ${item.name}`);
            }
        });

        this.eventSource.addEventListener('updateItem', (e) => {
            const updated = JSON.parse(e.data);
            const index = this.items.findIndex(i => i.id === updated.id);
            if (index !== -1) {
                this.items[index] = updated;
                UI.renderItems();
                UI.updateStats();
                UI.updateAlerts();
                
                if (updated.minStock > 0 && updated.quantity <= updated.minStock) {
                    Utils.showToast('⚠️ LOW STOCK: ' + updated.name + ' (' + updated.quantity + ' left)', true);
                }
            }
        });

        this.eventSource.addEventListener('deleteItem', (e) => {
            const data = JSON.parse(e.data);
            this.items = this.items.filter(i => i.id !== data.id);
            UI.renderItems();
            UI.updateStats();
            UI.updateAlerts();
            Utils.showToast('Item removed');
        });

        this.eventSource.onerror = (error) => {
            console.error('SSE Error:', error);
            Utils.setConnected(false);
            Utils.showToast('Connection lost. Reconnecting...', true);
            // Try to reconnect with the same username
            setTimeout(() => this.connectSSE(userName), 3000);
        };

        this.eventSource.onopen = () => {
            console.log('SSE connection opened');
            Utils.setConnected(true);
        };
    },

    async addItem(item) {
        try {
            const response = await fetch('/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });

            if (!response.ok) throw new Error('Failed to add item');
            return await response.json();
        } catch (err) {
            Utils.showToast('Error adding part', true);
            throw err;
        }
    },

    async useItem(id, amount, usedBy) {
        const response = await fetch(`/items/${id}/use`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, usedBy })
        });
        if (!response.ok) throw new Error('Failed to use item');
        return await response.json();
    },

    async restockItem(id, amount) {
        const response = await fetch(`/items/${id}/restock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount })
        });
        if (!response.ok) throw new Error('Failed to restock');
        return await response.json();
    },

    async deleteItem(id) {
        const response = await fetch(`/items/${id}/delete`, { method: 'POST' });
        if (!response.ok) throw new Error('Failed to delete');
        return await response.json();
    }
};