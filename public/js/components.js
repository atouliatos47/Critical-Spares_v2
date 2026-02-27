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
                <input type="number" id="useAmount" value="1" min="1" max="${item.quantity}" style="width: 100%; padding: 12px; border: 2px solid #e2e5ea; border-radius: 8px;">
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
                <input type="number" id="restockAmount" value="1" min="1" style="width: 100%; padding: 12px; border: 2px solid #e2e5ea; border-radius: 8px;">
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

    showStatsModal(items) {
        const totalItems = items.length;
        const totalStock = items.reduce((sum, i) => sum + (i.quantity || 0), 0);
        const lowStock = items.filter(i => i.minStock > 0 && i.quantity <= i.minStock).length;
        const outOfStock = items.filter(i => i.quantity === 0).length;
        
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
            </div>
            <div class="modal-actions">
                <button class="modal-btn cancel" onclick="Components.closeStatsModal()">Close</button>
            </div>
        `;
        document.getElementById('modalOverlay').classList.add('show');
    },

    closeStatsModal() {
        document.getElementById('modalOverlay').classList.remove('show');
    }
};

// Make Components globally available
window.Components = Components;