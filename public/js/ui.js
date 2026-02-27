// UI Management
const UI = {
    currentFilter: 'all',
    searchTimeout: null,

    renderItems() {
        const container = document.getElementById('itemsList');
        if (!container) return;
        
        let filtered = API.items;

        if (this.currentFilter === 'low') {
            filtered = filtered.filter(i => i.minStock > 0 && i.quantity <= i.minStock);
        }

        const searchTerm = document.getElementById('searchInput')?.value.toLowerCase();
        if (searchTerm) {
            filtered = filtered.filter(item => 
                item.name.toLowerCase().includes(searchTerm) ||
                (item.location && item.location.toLowerCase().includes(searchTerm)) ||
                (item.notes && item.notes.toLowerCase().includes(searchTerm))
            );
        }

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="icon">${this.currentFilter === 'low' ? '✅' : '📋'}</div>
                    <p>${this.currentFilter === 'low' ? 'No low stock items - all good!' : 'No items found'}</p>
                </div>
            `;
            return;
        }

        const sorted = filtered.sort((a, b) => {
            const aLow = a.minStock > 0 && a.quantity <= a.minStock ? 0 : 1;
            const bLow = b.minStock > 0 && b.quantity <= b.minStock ? 0 : 1;
            if (aLow !== bLow) return aLow - bLow;
            return a.name.localeCompare(b.name);
        });
        
        container.innerHTML = sorted.map(item => this.renderItemCard(item)).join('');
    },

    renderItemCard(item) {
        const isLow = item.minStock > 0 && item.quantity <= item.minStock;
        const isCritical = item.quantity === 0;
        const cardClass = isCritical ? 'critical' : (isLow ? 'low-stock' : '');
        const qtyClass = isCritical ? 'critical' : (isLow ? 'low' : '');
        const time = Utils.formatTime(item.lastUpdated || item.createdAt);
        
        // Create a safe JSON string for the item
        const itemJson = JSON.stringify(item).replace(/'/g, "\\'").replace(/"/g, '&quot;');
        
        return `
            <div class="item-card ${cardClass}">
                <div class="item-header">
                    <span class="item-name">${Utils.escapeHtml(item.name)}</span>
                    <div class="item-stock-badge">
                        ${item.minStock > 0 ? '<span class="item-min">min ' + item.minStock + '</span>' : ''}
                        <span class="item-qty ${qtyClass}">${item.quantity}</span>
                    </div>
                </div>
                <div class="item-meta">
                    ${item.location ? '<span>📍 ' + Utils.escapeHtml(item.location) + '</span>' : ''}
                    <span>👤 ${Utils.escapeHtml(item.addedBy)}</span>
                    <span>🕐 ${time}</span>
                </div>
                ${item.notes ? '<div class="item-notes">' + Utils.escapeHtml(item.notes) + '</div>' : ''}
                <div class="item-actions">
                    <button class="act-btn act-use" onclick="UI.handleUseClick(${item.id})" ${item.quantity === 0 ? 'disabled' : ''}>- Use</button>
                    <button class="act-btn act-restock" onclick="UI.handleRestockClick(${item.id})">+ Restock</button>
                    <button class="act-btn act-delete" onclick="UI.handleDeleteClick(${item.id})">🗑</button>
                </div>
            </div>
        `;
    },

    // Helper functions to handle button clicks
    handleUseClick(id) {
        console.log('Use clicked for id:', id);
        const item = API.items.find(i => i.id === id);
        if (item && window.Components) {
            Components.showUseModal(item);
        } else {
            console.error('Item not found or Components not loaded');
        }
    },

    handleRestockClick(id) {
        console.log('Restock clicked for id:', id);
        const item = API.items.find(i => i.id === id);
        if (item && window.Components) {
            Components.showRestockModal(item);
        } else {
            console.error('Item not found or Components not loaded');
        }
    },

    handleDeleteClick(id) {
        console.log('Delete clicked for id:', id);
        const item = API.items.find(i => i.id === id);
        if (item && window.Components) {
            Components.showDeleteModal(item);
        } else {
            console.error('Item not found or Components not loaded');
        }
    },

    updateAlerts() {
        const alertsSection = document.getElementById('alertsSection');
        const alertsList = document.getElementById('alertsList');
        const alertBanner = document.getElementById('alertBanner');
        
        if (!alertsSection || !alertsList || !alertBanner) return;
        
        const lowStockItems = API.items.filter(item => 
            item.minStock > 0 && item.quantity <= item.minStock
        );
        
        if (lowStockItems.length > 0) {
            const sortedAlerts = lowStockItems.sort((a, b) => {
                const aPercent = a.quantity / a.minStock;
                const bPercent = b.quantity / b.minStock;
                return aPercent - bPercent;
            });
            
            alertsList.innerHTML = sortedAlerts.map(item => {
                const percentOfMin = Math.round((item.quantity / item.minStock) * 100);
                const isCritical = item.quantity === 0;
                
                return `
                    <div class="alert-item">
                        <div class="alert-item-left">
                            <div class="alert-item-name">
                                ${Utils.escapeHtml(item.name)}
                                ${isCritical ? '<span style="color: #b91c1c; font-size: 16px; margin-left: 5px;">⚠️</span>' : ''}
                            </div>
                            <div class="alert-item-details">
                                <span class="alert-item-stock">Stock: ${item.quantity}</span>
                                <span class="alert-item-min">Min: ${item.minStock}</span>
                                <span style="color: ${percentOfMin < 50 ? '#b91c1c' : '#f59e0b'};">
                                    ${percentOfMin}% of min
                                </span>
                                ${item.location ? `<span>📍 ${Utils.escapeHtml(item.location)}</span>` : ''}
                            </div>
                        </div>
                        <button class="alert-item-action" onclick="UI.handleRestockClick(${item.id})">
                            + Restock Now
                        </button>
                    </div>
                `;
            }).join('');
            
            alertsSection.classList.remove('hidden');
            alertBanner.innerHTML = `
                <span>⚠️</span>
                <span>${lowStockItems.length} item${lowStockItems.length > 1 ? 's' : ''} below minimum stock!</span>
                <span class="alert-badge">Action needed</span>
            `;
            alertBanner.classList.add('show');
        } else {
            alertsSection.classList.add('hidden');
            alertBanner.classList.remove('show');
        }
    },

    updateStats() {
        document.getElementById('totalItems').textContent = API.items.length;
        
        const totalQty = API.items.reduce((sum, i) => sum + (i.quantity || 0), 0);
        document.getElementById('totalQty').textContent = totalQty;
        
        const lowItems = API.items.filter(i => i.minStock > 0 && i.quantity <= i.minStock);
        document.getElementById('lowCount').textContent = lowItems.length;

        const badge = document.getElementById('lowBadge');
        if (badge) {
            badge.style.display = lowItems.length > 0 ? 'inline' : 'none';
            badge.textContent = lowItems.length;
        }
    },

    updateUserList(users) {
        console.log('Updating user list:', users);
        const userList = document.getElementById('userList');
        const userCount = document.getElementById('userCount');
        
        if (!userList || !userCount) return;
        
        userCount.textContent = users.length;
        
        if (users.length === 0) {
            userList.innerHTML = '<div style="color: #6b7280; font-size: 13px; padding: 5px;">No other users connected</div>';
            return;
        }
        
        userList.innerHTML = users.map(user => {
            const time = Utils.formatTime(user.connectedAt);
            const isYou = user.name === App.userName;
            
            return `
                <div class="user-avatar online" title="Connected since ${time}">
                    <span class="avatar-dot"></span>
                    <span class="avatar-name">${Utils.escapeHtml(user.name)}${isYou ? ' (you)' : ''}</span>
                    <span class="avatar-time">${time}</span>
                </div>
            `;
        }).join('');
    },

    async addItem() {
        const nameInput = document.getElementById('partName');
        const name = nameInput.value.trim();
        
        if (!name) {
            Utils.shakeElement(nameInput);
            return;
        }

        Utils.showLoading();

        const item = {
            name: name,
            location: document.getElementById('partLocation').value.trim(),
            quantity: parseInt(document.getElementById('partQty').value) || 1,
            minStock: parseInt(document.getElementById('partMinStock').value) || 0,
            notes: document.getElementById('partNotes').value.trim(),
            addedBy: App.userName
        };

        try {
            await API.addItem(item);
            document.getElementById('partName').value = '';
            document.getElementById('partLocation').value = '';
            document.getElementById('partQty').value = '1';
            document.getElementById('partMinStock').value = '0';
            document.getElementById('partNotes').value = '';
            Utils.showToast('Part added!');
            this.switchTab('list');
        } catch (err) {
            // Error handled in API
        } finally {
            Utils.hideLoading();
        }
    },

    setFilter(filter) {
        this.currentFilter = filter;
        document.getElementById('filterAll').classList.toggle('active', filter === 'all');
        document.getElementById('filterLow').classList.toggle('active', filter === 'low');
        this.renderItems();
    },

    debounceSearch: function() {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => this.renderItems(), 300);
    },

    switchTab(tab) {
        document.getElementById('tabAdd').classList.toggle('active', tab === 'add');
        document.getElementById('tabList').classList.toggle('active', tab === 'list');
        document.getElementById('addView').classList.toggle('hidden', tab !== 'add');
        document.getElementById('listView').classList.toggle('hidden', tab !== 'list');
    },

    scrollToAlerts() {
        document.getElementById('alertsSection').scrollIntoView({ behavior: 'smooth' });
    },

    showStats() {
        if (window.Components) {
            Components.showStatsModal(API.items);
        }
    }
};

// Make UI globally available
window.UI = UI;