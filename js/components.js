// Modal Components
const Components = {
    showUseModal(item) {
        console.log('Showing use modal for:', item);
        const modal = document.getElementById('modal');
        modal.innerHTML = `
            <h3>Use Part</h3>
            <div class="modal-sub">${Utils.escapeHtml(item.name)} — Current stock: ${item.quantity}</div>
            <div class="form-row">
                <label>How many used?</label>
                <input type="number" id="useAmount" value="1" min="1" onfocus="this.select()" max="${item.quantity}" style="width: 100%; padding: 12px; border: 2px solid #e2e5ea; border-radius: 8px;">
            </div>
            <div class="modal-actions">
                <button class="modal-btn cancel" onclick="Components.closeUseModal()">Cancel</button>
                <button class="modal-btn danger" onclick="Components.confirmUse(${item.id})">Use Part</button>
            </div>
        `;
        document.getElementById('modalOverlay').classList.add('show');
    },

    closeUseModal() {
        document.getElementById('modalOverlay').classList.remove('show');
    },

    async confirmUse(id) {
        const amount = parseInt(document.getElementById('useAmount').value) || 1;
        Components.closeUseModal();
        Utils.showLoading();
        try {
            await API.useItem(id, amount, App.userName);
            Utils.showToast('Part used successfully');
        } catch (err) {
            Utils.showToast('Error using part', true);
        } finally {
            Utils.hideLoading();
        }
    },

    showRestockModal(item) {
        console.log('Showing restock modal for:', item);
        const modal = document.getElementById('modal');
        modal.innerHTML = `
            <h3>Restock Part</h3>
            <div class="modal-sub">${Utils.escapeHtml(item.name)} — Current stock: ${item.quantity}</div>
            <div class="form-row">
                <label>How many to add?</label>
                <input type="number" id="restockAmount" value="1" min="1" onfocus="this.select()" style="width: 100%; padding: 12px; border: 2px solid #e2e5ea; border-radius: 8px;">
            </div>
            <div class="modal-actions">
                <button class="modal-btn cancel" onclick="Components.closeRestockModal()">Cancel</button>
                <button class="modal-btn confirm" onclick="Components.confirmRestock(${item.id})">Restock</button>
            </div>
        `;
        document.getElementById('modalOverlay').classList.add('show');
    },

    closeRestockModal() {
        document.getElementById('modalOverlay').classList.remove('show');
    },

    async confirmRestock(id) {
        const amount = parseInt(document.getElementById('restockAmount').value) || 1;
        Components.closeRestockModal();
        Utils.showLoading();
        try {
            await API.restockItem(id, amount);
            Utils.showToast('Restocked successfully');
        } catch (err) {
            Utils.showToast('Error restocking', true);
        } finally {
            Utils.hideLoading();
        }
    },

    showDeleteModal(item) {
        console.log('Showing delete modal for:', item);
        const modal = document.getElementById('modal');
        modal.innerHTML = `
            <h3>Delete Part</h3>
            <div class="modal-sub">Remove <strong>${Utils.escapeHtml(item.name)}</strong> from the list?</div>
            <div class="modal-actions">
                <button class="modal-btn cancel" onclick="Components.closeDeleteModal()">Cancel</button>
                <button class="modal-btn danger" onclick="Components.confirmDelete(${item.id})">Delete</button>
            </div>
        `;
        document.getElementById('modalOverlay').classList.add('show');
    },

    closeDeleteModal() {
        document.getElementById('modalOverlay').classList.remove('show');
    },

    async confirmDelete(id) {
        Components.closeDeleteModal();
        Utils.showLoading();
        try {
            await API.deleteItem(id);
            Utils.showToast('Part deleted');
        } catch (err) {
            Utils.showToast('Error deleting part', true);
        } finally {
            Utils.hideLoading();
        }
    },

    // ===== WORKSTATION MODALS =====

    showDeleteWorkstationModal(ws) {
        console.log('Showing delete workstation modal for:', ws);
        const partCount = API.items.filter(i => i.workstationId === ws.id).length;
        const modal = document.getElementById('modal');
        modal.innerHTML = `
            <h3>Delete Workstation</h3>
            <div class="modal-sub">
                Remove <strong>${Utils.escapeHtml(ws.name)}</strong>?
                ${partCount > 0 
                    ? `<br><br><span style="color: #f59e0b; font-weight: 600;">⚠️ ${partCount} part${partCount !== 1 ? 's are' : ' is'} assigned to this workstation. They will be unassigned but not deleted.</span>` 
                    : ''
                }
            </div>
            <div class="modal-actions">
                <button class="modal-btn cancel" onclick="Components.closeDeleteWorkstationModal()">Cancel</button>
                <button class="modal-btn danger" onclick="Components.confirmDeleteWorkstation(${ws.id})">Delete</button>
            </div>
        `;
        document.getElementById('modalOverlay').classList.add('show');
    },

    closeDeleteWorkstationModal() {
        document.getElementById('modalOverlay').classList.remove('show');
    },

    async confirmDeleteWorkstation(id) {
        Components.closeDeleteWorkstationModal();
        Utils.showLoading();
        try {
            await API.deleteWorkstation(id);
            Utils.showToast('Workstation deleted');
        } catch (err) {
            Utils.showToast('Error deleting workstation', true);
        } finally {
            Utils.hideLoading();
        }
    },

    // ===== STATS MODAL =====

    showStatsModal(items) {
        const totalItems = items.length;
        const totalStock = items.reduce((sum, i) => sum + (i.quantity || 0), 0);
        const lowStock = items.filter(i => i.minStock > 0 && i.quantity <= i.minStock).length;
        const outOfStock = items.filter(i => i.quantity === 0).length;
        const wsCount = API.workstations.length;
        const assignedCount = items.filter(i => i.workstationId).length;
        
        const modal = document.getElementById('modal');
        modal.innerHTML = `
            <h3>Statistics</h3>
            <div style="padding: 10px 0;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Total Parts:</span>
                    <strong>${totalItems}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Total Stock:</span>
                    <strong>${totalStock}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Low Stock:</span>
                    <strong style="color: #f59e0b;">${lowStock}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Out of Stock:</span>
                    <strong style="color: #ef4444;">${outOfStock}</strong>
                </div>
                <div style="border-top: 1px solid #e2e5ea; margin: 10px 0;"></div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Workstations:</span>
                    <strong>${wsCount}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Assigned to WS:</span>
                    <strong>${assignedCount}</strong>
                </div>
            </div>
            <div class="modal-actions">
                <button class="modal-btn cancel" onclick="Components.closeStatsModal()">Close</button>
            </div>
        `;
        document.getElementById('modalOverlay').classList.add('show');
    },

    closeStatsModal() {
        document.getElementById('modalOverlay').classList.remove('show');
    },

    // ===== ADD PART MODAL =====

    showAddModal(barcode) {
        const workstationOptions = API.workstations.map(ws =>
            `<option value="${ws.id}">${Utils.escapeHtml(ws.name)}</option>`
        ).join('');

        const modal = document.getElementById('modal');
        modal.innerHTML = `
            <h3>Add Spare Part</h3>
            <div class="form-row">
                <label>Part No. (Barcode)</label>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <input type="text" id="modalPartNo" placeholder="Scan or enter part number"
                        value="${barcode ? Utils.escapeHtml(barcode) : ''}"
                        style="flex: 1; padding: 12px; border: 2px solid ${barcode ? '#86efac' : '#e2e5ea'}; border-radius: 8px; background: ${barcode ? '#f0fdf4' : '#f0f2f5'};">
                </div>
            </div>
            <div class="form-row">
                <label>Part Name *</label>
                <input type="text" id="modalPartName" placeholder="e.g. Contactor LC1D25"
                    style="width: 100%; padding: 12px; border: 2px solid #e2e5ea; border-radius: 8px;">
            </div>
            <div class="form-row">
                <label>Workstation</label>
                <select id="modalPartWorkstation" class="form-select">
                    <option value="">— No Workstation —</option>
                    ${workstationOptions}
                </select>
            </div>
            <div class="form-row">
                <label>Location</label>
                <input type="text" id="modalPartLocation" placeholder="e.g. Press 4, Bay 2"
                    style="width: 100%; padding: 12px; border: 2px solid #e2e5ea; border-radius: 8px;">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-row">
                    <label>Quantity</label>
                    <input type="number" id="modalPartQty" value="1" min="0" onfocus="this.select()"
                        style="width: 100%; padding: 12px; border: 2px solid #e2e5ea; border-radius: 8px;">
                </div>
                <div class="form-row">
                    <label>Min Stock</label>
                    <input type="number" id="modalPartMinStock" value="0" min="0" onfocus="this.select()"
                        style="width: 100%; padding: 12px; border: 2px solid #e2e5ea; border-radius: 8px;">
                </div>
            </div>
            <div class="form-row">
                <label>Notes</label>
                <textarea id="modalPartNotes" rows="2" placeholder="Supplier, part number, etc."
                    style="width: 100%; padding: 12px; border: 2px solid #e2e5ea; border-radius: 8px; resize: vertical;"></textarea>
            </div>
            <div class="modal-actions">
                <button class="modal-btn cancel" onclick="Components.closeAddModal()">Cancel</button>
                <button class="modal-btn confirm" onclick="Components.confirmAddItem()">Add to Stock</button>
            </div>
        `;
        document.getElementById('modalOverlay').classList.add('show');

        // Auto-focus part name if barcode already filled
        setTimeout(() => {
            const f = barcode
                ? document.getElementById('modalPartName')
                : document.getElementById('modalPartNo');
            if (f) f.focus();
        }, 100);
    },

    closeAddModal() {
        document.getElementById('modalOverlay').classList.remove('show');
    },

    async confirmAddItem() {
        const nameInput = document.getElementById('modalPartName');
        const name = nameInput.value.trim();
        if (!name) {
            Utils.shakeElement(nameInput);
            return;
        }
        const wsSelect = document.getElementById('modalPartWorkstation');
        const workstationId = wsSelect && wsSelect.value ? parseInt(wsSelect.value) : null;
        const item = {
            partNo:        document.getElementById('modalPartNo').value.trim(),
            name:          name,
            location:      document.getElementById('modalPartLocation').value.trim(),
            quantity:      parseInt(document.getElementById('modalPartQty').value) || 1,
            minStock:      parseInt(document.getElementById('modalPartMinStock').value) || 0,
            notes:         document.getElementById('modalPartNotes').value.trim(),
            workstationId: workstationId,
            addedBy:       App.userName
        };
        Components.closeAddModal();
        Utils.showLoading();
        try {
            await API.addItem(item);
            Utils.showToast('Part added!');
        } catch (err) {
            Utils.showToast('Error adding part', true);
        } finally {
            Utils.hideLoading();
        }
    }
};


    // ===== STOCK MODAL =====

    showStockModal() {
        const overlay = document.getElementById('contentModalOverlay');
        const modal   = document.getElementById('contentModal');
        if (!overlay || !modal) return;

        modal.innerHTML = `
            <div style="padding: 16px 20px; border-bottom: 1px solid #e2e5ea; display:flex; justify-content:space-between; align-items:center; flex-shrink:0;">
                <h3 style="margin:0; color:#2D4A5C;">📦 Stock</h3>
                <button onclick="Components.closeContentModal()" style="border:none; background:none; font-size:22px; cursor:pointer; color:#6b7280; line-height:1;">✕</button>
            </div>
            <div style="padding: 12px 20px; border-bottom: 1px solid #e2e5ea; flex-shrink:0; display:flex; flex-direction:column; gap:10px;">
                <div style="display:flex; gap:8px;">
                    <button id="stockFilterAll" class="filter-btn active" onclick="Components._stockFilter('all')">All</button>
                    <button id="stockFilterLow" class="filter-btn danger" onclick="Components._stockFilter('low')">Low Stock</button>
                </div>
                <input type="text" id="stockSearch" placeholder="🔍 Search parts or workstations..."
                    oninput="Components._renderStock()"
                    style="width:100%; padding:10px 12px; border:1px solid #d1d5db; border-radius:8px; font-size:14px; box-sizing:border-box;">
            </div>
            <div id="stockModalList" style="overflow-y:auto; flex:1; padding:16px 20px;"></div>
        `;

        overlay.classList.add('show');
        Components._currentStockFilter = 'all';
        Components._renderStock();
    },

    _currentStockFilter: 'all',

    _stockFilter(f) {
        Components._currentStockFilter = f;
        document.getElementById('stockFilterAll')?.classList.toggle('active', f === 'all');
        document.getElementById('stockFilterLow')?.classList.toggle('active', f === 'low');
        Components._renderStock();
    },

    _renderStock() {
        const container = document.getElementById('stockModalList');
        if (!container) return;

        const searchTerm = (document.getElementById('stockSearch')?.value || '').toLowerCase();
        const filter     = Components._currentStockFilter;

        let items = API.items;
        if (filter === 'low') items = items.filter(i => i.minStock > 0 && i.quantity <= i.minStock);
        if (searchTerm) {
            items = items.filter(i => {
                const wsName = API.getWorkstationName(i.workstationId) || '';
                return i.name.toLowerCase().includes(searchTerm) ||
                    (i.location || '').toLowerCase().includes(searchTerm) ||
                    wsName.toLowerCase().includes(searchTerm);
            });
        }

        if (items.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="icon">${filter === 'low' ? '✅' : '📋'}</div><p>${filter === 'low' ? 'No low stock items!' : 'No items found'}</p></div>`;
            return;
        }

        const groups = items.reduce((acc, item) => {
            const ws = API.getWorkstationName(item.workstationId) || 'Unassigned / General';
            if (!acc[ws]) acc[ws] = [];
            acc[ws].push(item);
            return acc;
        }, {});

        container.innerHTML = Object.keys(groups).sort().map(ws => {
            const wsItems = groups[ws].sort((a,b) => a.name.localeCompare(b.name));
            return \`
                <div style="margin-bottom:20px;">
                    <div style="background:#e2e5ea; padding:8px 12px; border-radius:8px; margin-bottom:10px; font-weight:700; color:#2D4A5C; font-size:13px; display:flex; justify-content:space-between;">
                        <span>🏭 \${ws}</span>
                        <span style="font-size:11px; opacity:0.7;">\${wsItems.length} item\${wsItems.length !== 1 ? 's' : ''}</span>
                    </div>
                    \${wsItems.map(item => UI.renderItemCard(item)).join('')}
                </div>
            \`;
        }).join('');
    },

    // ===== MACHINES MODAL =====

    showMachinesModal() {
        const overlay = document.getElementById('contentModalOverlay');
        const modal   = document.getElementById('contentModal');
        if (!overlay || !modal) return;

        const wsOptions = API.workstations.map(ws =>
            `<option value="${ws.id}">${Utils.escapeHtml(ws.name)}</option>`
        ).join('');

        modal.innerHTML = `
            <div style="padding:16px 20px; border-bottom:1px solid #e2e5ea; display:flex; justify-content:space-between; align-items:center; flex-shrink:0;">
                <h3 style="margin:0; color:#2D4A5C;">🏭 Machines</h3>
                <button onclick="Components.closeContentModal()" style="border:none; background:none; font-size:22px; cursor:pointer; color:#6b7280; line-height:1;">✕</button>
            </div>
            <div style="padding:12px 20px; border-bottom:1px solid #e2e5ea; flex-shrink:0; display:flex; flex-direction:column; gap:12px;">
                <div>
                    <label style="font-size:12px; font-weight:600; color:#6b7280; text-transform:uppercase; display:block; margin-bottom:6px;">Add Workstation</label>
                    <div style="display:flex; gap:8px;">
                        <input type="text" id="modalWsName" placeholder="Workstation name *"
                            style="flex:1; padding:10px 12px; border:1px solid #d1d5db; border-radius:8px; font-size:14px;">
                        <input type="text" id="modalWsDesc" placeholder="Description"
                            style="flex:1; padding:10px 12px; border:1px solid #d1d5db; border-radius:8px; font-size:14px;">
                        <button class="btn-submit" onclick="Components._addWorkstation()" style="padding:10px 16px; white-space:nowrap;">Add</button>
                    </div>
                </div>
                <select id="modalWsSelect" class="form-select" onchange="Components._renderMachines()">
                    <option value="">— Select a Workstation —</option>
                    ${wsOptions}
                </select>
            </div>
            <div id="machinesModalList" style="overflow-y:auto; flex:1; padding:16px 20px;">
                <div class="empty-state"><div class="icon">🏭</div><p>Select a workstation above</p></div>
            </div>
        `;

        overlay.classList.add('show');
    },

    _renderMachines() {
        const container = document.getElementById('machinesModalList');
        const wsId = document.getElementById('modalWsSelect')?.value;
        if (!container) return;
        if (!wsId) {
            container.innerHTML = '<div class="empty-state"><div class="icon">🏭</div><p>Select a workstation above</p></div>';
            return;
        }
        const ws = API.workstations.find(w => w.id == wsId);
        if (ws) container.innerHTML = UI.renderSingleWorkstationCard(ws);
    },

    async _addWorkstation() {
        const nameInput = document.getElementById('modalWsName');
        const name = nameInput?.value.trim();
        if (!name) { Utils.shakeElement(nameInput); return; }
        Utils.showLoading();
        try {
            await API.addWorkstation({
                name,
                description: document.getElementById('modalWsDesc')?.value.trim() || '',
                addedBy: App.userName
            });
            nameInput.value = '';
            document.getElementById('modalWsDesc').value = '';
            Utils.showToast('Workstation added!');
            // Refresh the select options
            Components.closeContentModal();
            setTimeout(() => Components.showMachinesModal(), 100);
        } catch(e) {
            Utils.showToast('Error adding workstation', true);
        } finally {
            Utils.hideLoading();
        }
    },

    closeContentModal() {
        document.getElementById('contentModalOverlay').classList.remove('show');
    },

// Make Components globally available
window.Components = Components;
