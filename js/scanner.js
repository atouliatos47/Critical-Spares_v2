// ============================================================
//  scanner.js  —  Bluetooth HID Barcode Scanner Support
// ============================================================

const BarcodeScanner = (() => {

    const SCAN_SPEED_THRESHOLD_MS = 50;
    const MIN_BARCODE_LENGTH      = 3;
    const SCAN_COMPLETE_TIMEOUT   = 100;

    let buffer      = '';
    let lastKeyTime = 0;
    let scanCount   = 0; // track consecutive fast chars

    // -------------------------------------------------------
    // Core keydown handler
    // -------------------------------------------------------
    function onKeyDown(e) {
        if (['Shift','Control','Alt','Meta','CapsLock','Tab'].includes(e.key)) return;

        if (e.key === 'Enter') {
            if (buffer.length >= MIN_BARCODE_LENGTH && scanCount >= MIN_BARCODE_LENGTH) {
                clearTimeout(BarcodeScanner._timer);
                commitScan(buffer);
            }
            buffer    = '';
            scanCount = 0;
            return;
        }

        if (e.key.length !== 1) return;

        const now = Date.now();
        const gap = lastKeyTime === 0 ? 0 : (now - lastKeyTime);
        lastKeyTime = now;

        if (gap > 0 && gap < SCAN_SPEED_THRESHOLD_MS) {
            // Fast keystroke — scanner territory
            scanCount++;
        } else {
            // Slow / first keystroke — could be human, reset fast-char counter
            scanCount = 0;
        }

        buffer += e.key;

        clearTimeout(BarcodeScanner._timer);
        BarcodeScanner._timer = setTimeout(() => {
            // Only commit if most chars came in fast (scanner, not human)
            if (buffer.length >= MIN_BARCODE_LENGTH && scanCount >= MIN_BARCODE_LENGTH - 1) {
                commitScan(buffer);
            }
            buffer    = '';
            scanCount = 0;
        }, SCAN_COMPLETE_TIMEOUT);
    }

    // -------------------------------------------------------
    // Route the completed scan
    // -------------------------------------------------------
    function commitScan(barcode) {
        barcode = barcode.trim();
        if (!barcode) return;
        console.log(`[Scanner] Scanned: "${barcode}"`);

        // Wake app if on splash/home screen
        wakeApp();

        // Look up item
        const items = (window.API && window.API.items) ? window.API.items : [];
        const match = items.find(i =>
            i.partNo && i.partNo.trim().toLowerCase() === barcode.toLowerCase()
        );

        if (match) {
            showToast(`✅ Found: ${match.name}`);
            setTimeout(() => {
                if (window.UI && typeof window.UI.openUseModal === 'function') {
                    window.UI.openUseModal(match.id);
                }
            }, 200);
        } else {
            showToast(`📦 New part scanned — add details`);
            if (window.UI && typeof window.UI.switchTab === 'function') {
                window.UI.switchTab('add');
            }
            setTimeout(() => fillPartNo(barcode), 250);
        }
    }

    // -------------------------------------------------------
    // Wake from splash/home screen
    // -------------------------------------------------------
    function wakeApp() {
        const homeScreen = document.getElementById('homeScreen');
        if (homeScreen && !homeScreen.classList.contains('hidden')) {
            homeScreen.classList.add('hidden');
            if (window.UI && typeof window.UI.startIdleTimer === 'function') {
                window.UI.startIdleTimer();
            }
        }
    }

    // -------------------------------------------------------
    // Fill Part No. field
    // -------------------------------------------------------
    function fillPartNo(barcode) {
        const field = document.getElementById('partNo');
        if (!field) return;
        field.value = barcode;
        field.dispatchEvent(new Event('input'));
        const clearBtn = document.getElementById('clearPartNo');
        if (clearBtn) clearBtn.style.display = 'flex';
        field.style.transition = 'background 0.3s';
        field.style.background = '#d1fae5';
        setTimeout(() => { field.style.background = '#f0f2f5'; }, 700);
        const nameField = document.getElementById('partName');
        if (nameField) setTimeout(() => nameField.focus(), 150);
    }

    // -------------------------------------------------------
    // Toast — works with any Utils.showToast signature
    // -------------------------------------------------------
    function showToast(msg) {
        // Try Utils first (most common signature)
        if (window.Utils && typeof window.Utils.showToast === 'function') {
            try { window.Utils.showToast(msg); return; } catch(e) {}
        }
        // Fallback: directly manipulate the toast element
        const t = document.getElementById('toast');
        if (!t) return;
        t.textContent = msg;
        t.style.background = '#95C11F';
        t.style.color = '#fff';
        t.style.display = 'block';
        t.style.opacity = '1';
        t.classList.add('show');
        setTimeout(() => {
            t.classList.remove('show');
            t.style.opacity = '';
        }, 2500);
    }

    // -------------------------------------------------------
    // Init
    // -------------------------------------------------------
    function init() {
        document.addEventListener('keydown', onKeyDown, true);
        console.log('[Scanner] Bluetooth HID scanner listener active');
    }

    return { init };

})();

document.addEventListener('DOMContentLoaded', () => BarcodeScanner.init());
