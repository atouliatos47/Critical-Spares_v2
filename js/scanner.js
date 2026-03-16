// ============================================================
//  scanner.js — Bluetooth HID Barcode Scanner v4
// ============================================================

const BarcodeScanner = (() => {

    const MIN_LENGTH     = 3;
    const COMMIT_TIMEOUT = 120;

    let buffer = '';
    let timer  = null;

    function onKeyDown(e) {
        if (['Shift','Control','Alt','Meta','CapsLock','Tab',
             'ArrowUp','ArrowDown','ArrowLeft','ArrowRight',
             'Escape','F1','F2','F3','F4','F5'].includes(e.key)) return;

        // Enter = commit immediately
        if (e.key === 'Enter') {
            clearTimeout(timer);
            const b = buffer.trim();
            buffer = '';
            if (b.length >= MIN_LENGTH) commitScan(b);
            return;
        }

        if (e.key.length !== 1) return;

        buffer += e.key;

        // Also commit via timeout (scanners that don't send Enter)
        clearTimeout(timer);
        timer = setTimeout(() => {
            const b = buffer.trim();
            buffer = '';
            if (b.length >= MIN_LENGTH) commitScan(b);
        }, COMMIT_TIMEOUT);
    }

    function commitScan(barcode) {
        console.log('[Scanner] Scanned:', barcode);

        // Wake from splash screen
        const home = document.getElementById('homeScreen');
        if (home && !home.classList.contains('hidden')) {
            home.classList.add('hidden');
        }

        setTimeout(() => route(barcode), 150);
    }

    function route(barcode, attempt) {
        attempt = attempt || 1;
        const items = (window.API && window.API.items) ? window.API.items : [];
        console.log('[Scanner] Looking up in', items.length, 'items (attempt', attempt + ')');

        // Items not loaded yet — retry up to 5 times
        if (items.length === 0 && attempt < 6) {
            setTimeout(() => route(barcode, attempt + 1), 500);
            return;
        }

        const match = items.find(i => {
            const pn = (i.partNo || '').trim().toLowerCase();
            return pn !== '' && pn === barcode.toLowerCase();
        });

        if (match) {
            console.log('[Scanner] Match found:', match.name);
            toast('Found: ' + match.name);
            if (window.Components && typeof window.Components.showUseModal === 'function') {
                window.Components.showUseModal(match);
            }
        } else {
            console.log('[Scanner] No match — going to Add Part');
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
        console.log('[Scanner] v4 ready');
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', () => BarcodeScanner.init());
