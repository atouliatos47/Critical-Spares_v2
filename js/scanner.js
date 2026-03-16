// ============================================================
//  scanner.js — Bluetooth HID Barcode Scanner v5
//  Only activates when NO modal is open.
//  Never interferes with form typing.
// ============================================================

const BarcodeScanner = (() => {

    const MIN_LENGTH     = 3;
    const CHAR_GAP_MS    = 50;   // scanner chars are faster than this
    const COMMIT_TIMEOUT = 150;

    let buffer    = '';
    let lastTime  = 0;
    let fastCount = 0;
    let timer     = null;

    function isModalOpen() {
        return document.getElementById('modalOverlay')?.classList.contains('show') ||
               document.getElementById('contentModalOverlay')?.classList.contains('show') ||
               document.getElementById('scannerModal')?.classList.contains('active');
    }

    function onKeyDown(e) {
        // Always ignore modifier keys
        if (e.key.length > 1 && e.key !== 'Enter') return;
        if (['Shift','Control','Alt','Meta','CapsLock','Tab'].includes(e.key)) return;

        // If any modal is open — do nothing at all, let the browser handle it normally
        if (isModalOpen()) return;

        if (e.key === 'Enter') {
            clearTimeout(timer);
            const b = buffer.trim();
            buffer = ''; lastTime = 0; fastCount = 0;
            if (b.length >= MIN_LENGTH && fastCount >= MIN_LENGTH - 1) commitScan(b);
            return;
        }

        if (e.key.length !== 1) return;

        const now  = Date.now();
        const gap  = lastTime ? now - lastTime : 999;
        lastTime   = now;

        if (gap < CHAR_GAP_MS) fastCount++;
        else fastCount = 0;

        buffer += e.key;

        clearTimeout(timer);
        timer = setTimeout(() => {
            const b = buffer.trim();
            buffer = ''; lastTime = 0; fastCount = 0;
            // Only commit if chars came in fast (scanner, not human typing)
            if (b.length >= MIN_LENGTH && fastCount >= MIN_LENGTH - 1) commitScan(b);
        }, COMMIT_TIMEOUT);
    }

    function commitScan(barcode) {
        console.log('[Scanner] Scanned:', barcode);

        // Wake splash screen
        const home = document.getElementById('homeScreen');
        if (home && !home.classList.contains('hidden')) home.classList.add('hidden');

        setTimeout(() => route(barcode), 150);
    }

    function route(barcode, attempt) {
        attempt = attempt || 1;
        const items = (typeof API !== 'undefined' && API.items) ? API.items : [];
        console.log('[Scanner] Looking up in', items.length, 'items (attempt ' + attempt + ')');

        if (items.length === 0 && attempt < 6) {
            setTimeout(() => route(barcode, attempt + 1), 500);
            return;
        }

        const match = items.find(i =>
            (i.partNo || '').trim().toLowerCase() === barcode.toLowerCase() && i.partNo !== ''
        );

        const needsRestock = match && (
            match.quantity === 0 ||
            (match.minStock > 0 && match.quantity <= match.minStock)
        );

        if (match && !needsRestock) {
            console.log('[Scanner] Match found:', match.name);
            toast('Found: ' + match.name);
            if (typeof Components !== 'undefined') Components.showUseModal(match);
        } else if (needsRestock) {
            console.log('[Scanner] Needs restock:', match.name);
            toast('Low/no stock — add new quantity');
            if (typeof Components !== 'undefined') Components.showAddModal(barcode);
        } else {
            console.log('[Scanner] New barcode');
            if (typeof Components !== 'undefined') Components.showAddModal(barcode);
        }
    }

    function toast(msg) {
        if (typeof Utils !== 'undefined' && Utils.showToast) {
            try { Utils.showToast(msg); return; } catch(e) {}
        }
        const t = document.getElementById('toast');
        if (!t) return;
        t.textContent = msg;
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 2500);
    }

    function init() {
        document.addEventListener('keydown', onKeyDown, false);
        console.log('[Scanner] v5 ready');
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', () => BarcodeScanner.init());
