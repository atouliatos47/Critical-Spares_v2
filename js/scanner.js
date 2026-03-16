// ============================================================
//  scanner.js  —  Bluetooth HID Barcode Scanner Support
//  Works with any scanner paired in keyboard-emulation mode.
//  Detects rapid keystrokes (scanner) vs slow typing (human).
// ============================================================

const BarcodeScanner = (() => {

    // --- Config ---
    const SCAN_SPEED_THRESHOLD_MS = 50;  // chars faster than this = scanner
    const MIN_BARCODE_LENGTH      = 3;   // ignore very short accidental bursts
    const SCAN_COMPLETE_TIMEOUT   = 100; // ms after last char to commit scan

    // --- State ---
    let buffer        = '';
    let lastKeyTime   = 0;
    let commitTimer   = null;

    // -------------------------------------------------------
    // Core: handle every keydown on the document
    // -------------------------------------------------------
    function onKeyDown(e) {

        // Ignore modifier-only keypresses
        if (['Shift','Control','Alt','Meta','CapsLock','Tab'].includes(e.key)) return;

        // Enter = end of scan (scanners always terminate with Enter)
        if (e.key === 'Enter') {
            if (buffer.length >= MIN_BARCODE_LENGTH) {
                clearTimeout(commitTimer);
                commitScan(buffer);
            }
            buffer = '';
            return;
        }

        const now = Date.now();
        const gap = now - lastKeyTime;
        lastKeyTime = now;

        // If gap is too long this is probably human typing — reset buffer
        if (gap > SCAN_SPEED_THRESHOLD_MS * 3 && buffer.length > 0) {
            // Only reset if the target input is NOT a known form field
            // (let human typing pass through to inputs normally)
            if (!isFormFieldFocused()) {
                buffer = '';
            } else {
                buffer = '';
                return; // let human input go to the field as normal
            }
        }

        // Accumulate character
        if (e.key.length === 1) {   // printable characters only
            buffer += e.key;

            // Intercept keypress from form fields only when scanning fast
            // (gap < threshold means it's a scanner burst)
            if (gap < SCAN_SPEED_THRESHOLD_MS && isFormFieldFocused()) {
                // We're building a scan — but let it type into the field too.
                // The commitScan will overwrite with the clean buffer anyway.
            }
        }

        // Reset the commit timer on every new character
        clearTimeout(commitTimer);
        if (buffer.length >= MIN_BARCODE_LENGTH) {
            commitTimer = setTimeout(() => {
                if (buffer.length >= MIN_BARCODE_LENGTH) {
                    commitScan(buffer);
                }
                buffer = '';
            }, SCAN_COMPLETE_TIMEOUT);
        }
    }

    // -------------------------------------------------------
    // Decide what to do with a completed scan
    // -------------------------------------------------------
    function commitScan(barcode) {
        barcode = barcode.trim();
        if (!barcode) return;

        console.log(`[Scanner] Scanned: "${barcode}"`);

        // 1️⃣  "Use Item" modal is open — fill the quantity confirm field if present
        const useModal = document.getElementById('useModal');
        if (useModal && !useModal.closest('.modal-overlay')?.classList.contains('hidden')) {
            // Modal is open — nothing to fill with a barcode here, ignore
            return;
        }

        // 2️⃣  Add Part tab is active — fill the Part No. field
        const addView = document.getElementById('addView');
        if (addView && !addView.classList.contains('hidden')) {
            fillPartNo(barcode);
            return;
        }

        // 3️⃣  Stock List tab is active — find item and open Use modal
        const listView = document.getElementById('listView');
        if (listView && !listView.classList.contains('hidden')) {
            triggerUseByBarcode(barcode);
            return;
        }

        // 4️⃣  Fallback: if search box exists and is visible, put it there
        const searchInput = document.getElementById('searchInput');
        if (searchInput && isVisible(searchInput)) {
            searchInput.value = barcode;
            searchInput.dispatchEvent(new Event('keyup'));
        }
    }

    // -------------------------------------------------------
    // Fill the Part No. field in the Add Part form
    // -------------------------------------------------------
    function fillPartNo(barcode) {
        const field = document.getElementById('partNo');
        if (!field) return;

        field.value = barcode;
        field.dispatchEvent(new Event('input'));

        // Show the clear button if it exists
        const clearBtn = document.getElementById('clearPartNo');
        if (clearBtn) clearBtn.style.display = 'flex';

        // Highlight briefly to give visual feedback
        field.style.transition = 'background 0.3s';
        field.style.background = '#d1fae5';   // green flash
        setTimeout(() => { field.style.background = '#f0f2f5'; }, 600);

        // Move focus to Part Name so user can keep filling the form
        const nameField = document.getElementById('partName');
        if (nameField) setTimeout(() => nameField.focus(), 100);

        showScanToast(`Scanned: ${barcode}`);
    }

    // -------------------------------------------------------
    // Find an item by part_no and open the Use modal
    // -------------------------------------------------------
    function triggerUseByBarcode(barcode) {
        // Items live in API.items (populated via SSE in api.js)
        const items = (window.API && window.API.items) ? window.API.items : [];

        if (!items || items.length === 0) {
            showScanToast('⚠️ No items loaded yet', 'warn');
            return;
        }

        const match = items.find(i =>
            i.partNo && i.partNo.trim().toLowerCase() === barcode.toLowerCase()
        );

        if (!match) {
            showScanToast(`❌ No part found: ${barcode}`, 'warn');
            // Also populate the search box so user can see results
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.value = barcode;
                searchInput.dispatchEvent(new Event('keyup'));
            }
            return;
        }

        showScanToast(`✅ Found: ${match.name}`);

        // Call UI.openUseModal if it exists (defined in ui.js)
        if (window.UI && typeof window.UI.openUseModal === 'function') {
            setTimeout(() => window.UI.openUseModal(match.id), 150);
        } else {
            // Fallback: highlight the item row
            const row = document.querySelector(`[data-id="${match.id}"]`);
            if (row) {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                row.style.outline = '3px solid #95C11F';
                setTimeout(() => row.style.outline = '', 1500);
            }
        }
    }

    // -------------------------------------------------------
    // Small toast specific to scanner events
    // -------------------------------------------------------
    function showScanToast(msg, type = 'success') {
        // Reuse the app's existing toast if available
        if (window.UI && typeof window.UI.toast === 'function') {
            window.UI.toast(msg);
            return;
        }
        // Fallback: use the #toast element directly
        const t = document.getElementById('toast');
        if (!t) return;
        t.textContent = msg;
        t.style.background = type === 'warn' ? '#ef4444' : '#95C11F';
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 2500);
    }

    // -------------------------------------------------------
    // Helpers
    // -------------------------------------------------------
    function isFormFieldFocused() {
        const el = document.activeElement;
        if (!el) return false;
        return ['INPUT','TEXTAREA','SELECT'].includes(el.tagName);
    }

    function isVisible(el) {
        return el && el.offsetParent !== null;
    }

    // -------------------------------------------------------
    // Public API
    // -------------------------------------------------------
    function init() {
        document.addEventListener('keydown', onKeyDown, true);
        console.log('[Scanner] Bluetooth HID scanner listener active');
    }

    // Allow app.js to expose the items array to the scanner
    function setItemsSource(fn) {
        window.App = window.App || {};
        window.App.getItems = fn;
    }

    return { init, setItemsSource };

})();

// Auto-init on DOM ready
document.addEventListener('DOMContentLoaded', () => BarcodeScanner.init());
