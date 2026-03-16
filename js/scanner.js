// ============================================================
//  scanner.js — Bluetooth HID Barcode Scanner Support v3
// ============================================================

const BarcodeScanner = (() => {

    const MIN_BARCODE_LENGTH  = 3;
    const CHAR_SPEED_MS       = 50;   // scanner chars are faster than this
    const COMMIT_TIMEOUT_MS   = 120;  // ms after last char before auto-commit

    let buffer    = '';
    let lastTime  = 0;
    let fastChars = 0;
    let timer     = null;

    function onKeyDown(e) {
        if (['Shift','Control','Alt','Meta','CapsLock','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) return;

        // Enter = scanner terminator — commit whatever is in buffer
        if (e.key === 'Enter') {
            clearTimeout(timer);
            const b = buffer;
            const fc = fastChars;
            buffer = ''; fastChars = 0; lastTime = 0;
            if (b.length >= MIN_BARCODE_LENGTH && fc >= MIN_BARCODE_LENGTH - 1) {
                commitScan(b.trim());
            }
            return;
        }

        if (e.key.length !== 1) return;

        const now = Date.now();
        const gap = lastTime ? now - lastTime : 999;
        lastTime = now;

        if (gap < CHAR_SPEED_MS) fastChars++;
        else fastChars = 0;

        buffer += e.key;

        clearTimeout(timer);
        timer = setTimeout(() => {
            const b = buffer; buffer = ''; fastChars = 0; lastTime = 0;
            if (b.trim().length >= MIN_BARCODE_LENGTH) commitScan(b.trim());
        }, COMMIT_TIMEOUT_MS);
    }

    function commitScan(barcode) {
        if (!barcode) return;
        console.log('[Scanner] Commit:', barcode);

        // 1. Wake from splash
        const home = document.getElementById('homeScreen');
        if (home && !home.classList.contains('hidden')) {
            home.classList.add('hidden');
        }

        // 2. Wait for app to be ready, then route
        setTimeout(() => route(barcode), 100);
    }

    function route(barcode) {
        const items = (window.API && window.API.items) ? window.API.items : [];
        const match = items.find(i =>
            i.partNo && i.partNo.trim().toLowerCase() === barcode.toLowerCase()
        );

        if (match) {
            // Known item — open Use modal
            toast('Found: ' + match.name);
            if (window.Components && typeof window.Components.showUseModal === 'function') {
                window.Components.showUseModal(match);
            }
        } else {
            // Unknown — go to Add Part, fill field
            toast('New barcode — fill in details');
            if (window.UI && typeof window.UI.switchTab === 'function') {
                window.UI.switchTab('add');
            }
            setTimeout(() => {
                const f = document.getElementById('partNo');
                if (!f) return;
                f.value = barcode;
                f.dispatchEvent(new Event('input'));
                const clr = document.getElementById('clearPartNo');
                if (clr) clr.style.display = 'flex';
                f.style.background = '#d1fae5';
                setTimeout(() => { f.style.background = '#f0f2f5'; }, 700);
                const nf = document.getElementById('partName');
                if (nf) nf.focus();
            }, 200);
        }
    }

    function toast(msg) {
        if (window.Utils && typeof window.Utils.showToast === 'function') {
            try { window.Utils.showToast(msg); return; } catch(e) {}
        }
        const t = document.getElementById('toast');
        if (!t) return;
        t.textContent = msg;
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 2500);
    }

    function init() {
        document.addEventListener('keydown', onKeyDown, true);
        console.log('[Scanner] v3 ready');
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', () => BarcodeScanner.init());
