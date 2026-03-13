// UI Management
const UI = {
    currentFilter: 'all',
    currentTab: 'add',
    searchTimeout: null,
    scanner: null, // Holds the Html5Qrcode instance

    // ===== BARCODE SCANNER LOGIC =====

    openScanner() {
        const modal = document.getElementById('scannerModal');
        if (modal) modal.classList.add('active'); // Show modal
        
        // Make sure we create a new scanner instance
        if (this.scanner) {
            try {
                this.scanner.stop();
            } catch (e) {
                // Ignore errors on stop
            }
        }
        
        // Wait a moment for the modal to be visible
        setTimeout(() => {
            const readerElement = document.getElementById('reader');
            if (!readerElement) {
                alert('Scanner element not found');
                return;
            }
            
            this.scanner = new Html5Qrcode("reader");
            const config = { 
                fps: 10, 
                qrbox: { width: 250, height: 150 },
                rememberLastUsedCamera: true,
                showTorchButtonIfSupported: true
            };
            
            this.scanner.start(
                { facingMode: "environment" }, 
                config, 
                (decodedText, decodedResult) => {
                    // Success callback - pass the decoded text
                    console.log('Scan success:', decodedText);
                    this.handleScanResult(decodedText);
                },
                (errorMessage) => {
                    // Error callback - ignore most errors as they're continuous
                    // console.log('Scan error:', errorMessage);
                }
            ).catch(err => {
                console.error('Scanner start error:', err);
                alert("Camera Error: Please ensure you are using HTTPS and have granted permissions.\n\n" + err);
                this.closeScanner();
            });
        }, 300); // Small delay to ensure modal is visible
    },

    closeScanner() {
        const modal = document.getElementById('scannerModal');
        
        if (this.scanner) {
            try {
                if (this.scanner.isScanning) {
                    this.scanner.stop().then(() => {
                        if (modal) modal.classList.remove('active');
                        this.scanner = null;
                    }).catch(() => {
                        if (modal) modal.classList.remove('active');
                        this.scanner = null;
                    });
                } else {
                    if (modal) modal.classList.remove('active');
                    this.scanner = null;
                }
            } catch (err) {
                console.error('Error stopping scanner:', err);
                if (modal) modal.classList.remove('active');
                this.scanner = null;
            }
        } else {
            if (modal) modal.classList.remove('active');
        }
    },

    handleScanResult(barcode) {
        console.log('Handling scan result:', barcode);
        
        if (navigator.vibrate) navigator.vibrate(100);

        // Clean up the barcode - remove any whitespace
        barcode = barcode.trim();

        // Find item by barcode (check both barcode field and notes for backward compatibility)
        const item = API.items.find(i => 
            (i.barcode && i.barcode === barcode) || 
            (i.notes && i.notes.includes(barcode))
        );

        console.log('Found item:', item);
        
        this.closeScanner();

        if (item) {
            // ITEM EXISTS: Open the existing Use modal
            setTimeout(() => {
                if (window.Components) {
                    Components.showUseModal(item);
                    Utils.showToast(`Found: ${item.name}`);
                } else {
                    console.error('Components not available');
                    Utils.showToast('Error: Cannot open item details', 3000);
                }
            }, 500);
        } else {
            // NEW ITEM: Switch to Add tab and pre-fill the barcode field
            this.switchTab('add');
            
            const barcodeField = document.getElementById('partBarcode');
            const nameField = document.getElementById('partName');
            
            if (barcodeField) {
                barcodeField.value = barcode;
                barcodeField.readOnly = true; // Keep it read-only after scan
                
                // Move focus to part name for easy entry
                if (nameField) {
                    setTimeout(() => nameField.focus(), 300);
                }
                
                Utils.showToast("New barcode detected. Please enter part name and details.", 4000);
            } else {
                console.error('Barcode field not found');
                Utils.showToast('Error: Barcode field missing', 3000);
            }
        }
    },

    // ===== INVENTORY RENDERING =====

    renderItems() {
        const container = document.getElementById('itemsList');
        if (!container) return;
        
        const searchTerm = document.getElementById('searchInput')?.value.toLowerCase();
        
        // DASHBOARD VIEW: Show this when the search bar is empty
        if (!searchTerm && this.currentFilter === 'all') {
            const wsSummary = API.items.reduce((acc, item) => {
                const wsName = API.getWorkstationName(item.workstationId) || 'General';
                acc[wsName] = (acc[wsName] || 0) + item.quantity;
                return acc;
            }, {});

            container.innerHTML = `
                <div class="form-card" style="margin-bottom: 20px; border-top: 4px solid #95C11F;">
                    <h4 style="margin-bottom: 12px; font-size: 13px; color: #2D4A5C;">🏭 STOCK BY PRESS (Tap to view)</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        ${Object.entries(wsSummary).map(([name, qty]) => `
                            <div onclick="UI.quickFilter('${name}')" style="
                                background: #f0f2f5; 
                                padding: 10px; 
                                border-radius: 8px; 
                                font-size: 12px; 
                                cursor: pointer; 
                                border: 1px solid #e2e5ea;
                            ">
                                <strong style="color: #2D4A5C;">${name}</strong>
                                <div style="color: #6b7280; margin-top: 4px;">${qty} pcs</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="empty-state">
                    <div class="icon">🔍</div>
                    <p>Search above or tap a press to view parts</p>
                </div>
            `;
            return;
        }

        let filtered = API.items;

        if (this.currentFilter === 'low') {
            filtered = filtered.filter(i => i.minStock > 0 && i.quantity <= i.minStock);
        }

        if (searchTerm) {
            filtered = filtered.filter(item => {
                const wsName = API.getWorkstationName(item.workstationId) || '';
                // Include barcode in search
                return (item.barcode && item.barcode.toLowerCase().includes(searchTerm)) ||
                    item.name.toLowerCase().includes(searchTerm) ||
                    (item.location && item.location.toLowerCase().includes(searchTerm)) ||
                    (item.notes && item.notes.toLowerCase().includes(searchTerm)) ||
                    wsName.toLowerCase().includes(searchTerm);
            });
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

        // Group items by Workstation
        const groups = filtered.reduce((acc, item) => {
            const wsName = API.getWorkstationName(item.workstationId) || 'Unassigned / General';
            if (!acc[wsName]) acc[wsName] = [];
            acc[wsName].push(item);
            return acc;
        }, {});

        const sortedWorkstations = Object.keys(groups).sort();

        container.innerHTML = sortedWorkstations.map(ws => {
            const items = groups[ws].sort((a, b) => a.name.localeCompare(b.name));
            return `
                <div class="ws-group-container" style="margin-bottom: 25px;">
                    <div class="ws-group-header" style="background: #e2e5ea; padding: 8px 15px; border-radius: 8px; margin-bottom: 10px; font-weight: 700; color: #2D4A5C; font-size: 13px; display: flex; justify-content: space-between; align-items: center;">
                        <span>🏭 ${ws}</span>
                        <span style="font-size: 11px; opacity: 0.7;">${items.length} item${items.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${items.map(item => this.renderItemCard(item)).join('')}
                    </div>
                </div>
            `;
        }).join('');
    },

    renderItemCard(item) {
        const isLow = item.minStock > 0 && item.quantity <= item.minStock;
        const isCritical = item.quantity === 0;
        const cardClass = isCritical ? 'critical' : (isLow ? 'low-stock' : '');
        const qtyClass = isCritical ? 'critical' : (isLow ? 'low' : '');
        const time = Utils.formatTime(item.lastUpdated || item.createdAt);
        const wsName = API.getWorkstationName(item.workstationId);
        
        // Show barcode if available
        const barcodeDisplay = item.barcode ? 
            `<div class="item-barcode" style="font-size: 11px; color: #6b7280; margin-top: 4px; font-family: monospace;">📷 #${Utils.escapeHtml(item.barcode)}</div>` : '';
        
        return `
            <div class="item-card ${cardClass}">
                <div class="item-header">
                    <span class="item-name">${Utils.escapeHtml(item.name)}</span>
                    <div class="item-stock-badge">
                        ${item.minStock > 0 ? '<span class="item-min">min ' + item.minStock + '</span>' : ''}
                        <span class="item-qty ${qtyClass}">${item.quantity}</span>
                    </div>
                </div>
                ${barcodeDisplay}
                <div class="item-meta">
                    ${wsName ? '<span class="ws-tag">🏭 ' + Utils.escapeHtml(wsName) + '</span>' : ''}
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

    handleUseClick(id) {
        const item = API.items.find(i => i.id === id);
        if (item && window.Components) {
            Components.showUseModal(item);
        }
    },

    handleRestockClick(id) {
        const item = API.items.find(i => i.id === id);
        if (item && window.Components) {
            Components.showRestockModal(item);
        }
    },

    handleDeleteClick(id) {
        const item = API.items.find(i => i.id === id);
        if (item && window.Components) {
            Components.showDeleteModal(item);
        }
    },

    quickFilter(name) {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = name;
            this.renderItems();
            window.scrollTo({ top: searchInput.offsetTop - 20, behavior: 'smooth' });
        }
    },

    // ===== WORKSTATION UI =====

    updateWorkstationDropdown() {
        const partSelect = document.getElementById('partWorkstation');
        const quickSelect = document.getElementById('wsQuickSelect');
        if (!partSelect) return;

        const optionsHtml = API.workstations.map(ws => 
            `<option value="${ws.id}">${Utils.escapeHtml(ws.name)}${ws.description ? ' (' + Utils.escapeHtml(ws.description) + ')' : ''}</option>`
        ).join('');

        partSelect.innerHTML = '<option value="">— No Workstation —</option>' + optionsHtml;

        if (quickSelect) {
            const currentQuickVal = quickSelect.value;
            quickSelect.innerHTML = '<option value="">— Select a Workstation —</option>' + optionsHtml;
            quickSelect.value = currentQuickVal;
        }
    },

    renderWorkstations() {
        const container = document.getElementById('workstationsList');
        const quickSelect = document.getElementById('wsQuickSelect');
        if (!container || !quickSelect) return;

        if (!quickSelect.value) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="icon">🏭</div>
                    <p>Please select a workstation from the dropdown above to view details.</p>
                </div>
            `;
            return;
        }

        const ws = API.workstations.find(w => w.id == quickSelect.value);
        if (ws) {
            container.innerHTML = this.renderSingleWorkstationCard(ws);
        }
    },

    handleWsSelect(wsId) {
        const container = document.getElementById('workstationsList');
        if (!container) return;

        if (!wsId) {
            sessionStorage.removeItem('selectedWorkstation');
            this.renderWorkstations();
            return;
        }
        
        sessionStorage.setItem('selectedWorkstation', wsId);
        const ws = API.workstations.find(w => w.id == wsId);
        if (ws) {
            container.innerHTML = this.renderSingleWorkstationCard(ws);
        }
    },

    renderSingleWorkstationCard(ws) {
        const partCount = API.items.filter(i => i.workstationId === ws.id).length;
        const lowCount = API.items.filter(i => i.workstationId === ws.id && i.minStock > 0 && i.quantity <= i.minStock).length;
        const time = Utils.formatTime(ws.createdAt);

        return `
            <div class="item-card" style="border-left-color: #2D4A5C;">
                <div class="item-header">
                    <span class="item-name">🏭 ${Utils.escapeHtml(ws.name)}</span>
                    <span class="item-qty">${partCount} part${partCount !== 1 ? 's' : ''}</span>
                </div>
                ${ws.description ? '<div class="item-meta"><span>' + Utils.escapeHtml(ws.description) + '</span></div>' : ''}
                <div class="item-meta">
                    <span>👤 ${Utils.escapeHtml(ws.addedBy)}</span>
                    <span>🕐 ${time}</span>
                    ${lowCount > 0 ? '<span style="color: #ef4444; font-weight: 700;">⚠️ ' + lowCount + ' low stock</span>' : ''}
                </div>
                <div class="item-actions">
                    <button class="act-btn act-restock" onclick="UI.filterByWorkstation(${ws.id})" style="flex: 3;">📋 View Parts</button>
                    <button class="act-btn act-delete" onclick="UI.handleDeleteWorkstation(${ws.id})">🗑</button>
                </div>
            </div>
        `;
    },

    filterByWorkstation(wsId) {
        this.switchTab('list');
        const ws = API.workstations.find(w => w.id === wsId);
        if (ws) {
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.value = ws.name;
                this.renderItems();
            }
        }
    },

    async addWorkstation() {
        const nameInput = document.getElementById('wsName');
        const name = nameInput.value.trim();
        if (!name) {
            Utils.shakeElement(nameInput);
            return;
        }
        Utils.showLoading();
        const ws = {
            name: name,
            description: document.getElementById('wsDescription').value.trim(),
            addedBy: App.userName
        };
        try {
            await API.addWorkstation(ws);
            document.getElementById('wsName').value = '';
            document.getElementById('wsDescription').value = '';
            Utils.showToast('Workstation added!');
        } catch (err) { } finally {
            Utils.hideLoading();
        }
    },

    handleDeleteWorkstation(id) {
        const ws = API.workstations.find(w => w.id === id);
        if (ws && window.Components) {
            Components.showDeleteWorkstationModal(ws);
        }
    },

    updateAlerts() {
        const alertsSection = document.getElementById('alertsSection');
        const alertsList = document.getElementById('alertsList');
        if (!alertsSection || !alertsList) return;
        const lowStockItems = API.items.filter(item => item.minStock > 0 && item.quantity <= item.minStock);
        if (lowStockItems.length > 0) {
            const sortedAlerts = lowStockItems.sort((a, b) => (a.quantity / a.minStock) - (b.quantity / b.minStock));
            alertsList.innerHTML = sortedAlerts.map(item => {
                const percentOfMin = Math.round((item.quantity / item.minStock) * 100);
                const isCritical = item.quantity === 0;
                const wsName = API.getWorkstationName(item.workstationId);
                return `
                    <div class="alert-item">
                        <div class="alert-item-left">
                            <div class="alert-item-name">${Utils.escapeHtml(item.name)}${isCritical ? ' ⚠️' : ''}</div>
                            <div class="alert-item-details">
                                <span class="alert-item-stock">Stock: ${item.quantity}</span>
                                <span class="alert-item-min">Min: ${item.minStock}</span>
                                <span style="color: ${percentOfMin < 50 ? '#b91c1c' : '#f59e0b'};">${percentOfMin}% of min</span>
                                ${wsName ? `<span>🏭 ${Utils.escapeHtml(wsName)}</span>` : ''}
                            </div>
                        </div>
                        <button class="alert-item-action" onclick="UI.handleRestockClick(${item.id})">+ Restock Now</button>
                    </div>
                `;
            }).join('');
            alertsSection.classList.remove('hidden');
        } else {
            alertsSection.classList.add('hidden');
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
        const barcodeField = document.getElementById('partBarcode');
        const nameField = document.getElementById('partName');
        
        const barcode = barcodeField ? barcodeField.value.trim() : '';
        const name = nameField.value.trim();
        
        // Validate both fields
        if (!barcode) {
            Utils.shakeElement(barcodeField);
            Utils.showToast('Please scan or enter a Part No.', 3000);
            return;
        }
        
        if (!name) {
            Utils.shakeElement(nameField);
            Utils.showToast('Please enter a Part Name', 3000);
            return;
        }
        
        Utils.showLoading();
        
        const wsSelect = document.getElementById('partWorkstation');
        const workstationId = wsSelect && wsSelect.value ? parseInt(wsSelect.value) : null;
        
        const item = {
            barcode: barcode,
            name: name,
            location: document.getElementById('partLocation').value.trim(),
            quantity: parseInt(document.getElementById('partQty').value) || 1,
            minStock: parseInt(document.getElementById('partMinStock').value) || 0,
            notes: document.getElementById('partNotes').value.trim(),
            workstationId: workstationId,
            addedBy: App.userName
        };
        
        try {
            await API.addItem(item);
            
            // Clear all fields including barcode
            if (barcodeField) barcodeField.value = '';
            nameField.value = '';
            document.getElementById('partLocation').value = '';
            document.getElementById('partQty').value = '1';
            document.getElementById('partMinStock').value = '0';
            document.getElementById('partNotes').value = '';
            if (wsSelect) wsSelect.value = '';
            
            Utils.showToast('Part added!');
            this.switchTab('list');
        } catch (err) { 
            console.error('Error adding item:', err);
            Utils.showToast('Error adding part', 3000);
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
        this.currentTab = tab;
        document.getElementById('tabAdd').classList.toggle('active', tab === 'add');
        document.getElementById('tabList').classList.toggle('active', tab === 'list');
        document.getElementById('tabWorkstations').classList.toggle('active', tab === 'workstations');
        document.getElementById('addView').classList.toggle('hidden', tab !== 'add');
        document.getElementById('listView').classList.toggle('hidden', tab !== 'list');
        document.getElementById('workstationsView').classList.toggle('hidden', tab !== 'workstations');

        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = ""; 
        }

        if (tab === 'workstations') {
            const quickSelect = document.getElementById('wsQuickSelect');
            if (quickSelect) {
                quickSelect.value = ""; 
            }
            this.renderWorkstations(); 
        }

        this.renderItems(); 
    },

    scrollToAlerts() {
        const el = document.getElementById('alertsSection');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    },

    showStats() {
        if (window.Components) {
            Components.showStatsModal(API.items);
        }
    }
};

window.UI = UI;