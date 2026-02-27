// Main App Controller
const App = {
    userName: localStorage.getItem('sparesUser') || '',
    
    init() {
        console.log('App initializing... Current user:', this.userName);
        this.setupEventListeners();
        
        if (this.userName) {
            console.log('User found in localStorage:', this.userName);
            this.showMainApp();
        } else {
            console.log('No user found, showing name screen');
            document.getElementById('nameScreen').classList.remove('hidden');
        }
    },

    setName() {
        const input = document.getElementById('nameInput');
        const name = input.value.trim();
        
        if (!name) {
            Utils.shakeElement(input);
            return;
        }
        
        this.userName = name;
        localStorage.setItem('sparesUser', name);
        console.log('Name set to:', name);
        this.showMainApp();
    },

    showMainApp() {
        document.getElementById('nameScreen').classList.add('hidden');
        document.getElementById('appScreen').classList.remove('hidden');
        // Pass userName to connectSSE
        API.connectSSE(this.userName);
    },

    setupEventListeners() {
        document.getElementById('nameInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.setName();
        });

        document.getElementById('modalOverlay').addEventListener('click', (e) => {
            if (e.target === document.getElementById('modalOverlay')) {
                Utils.closeModal();
            }
        });
    }
};

// Start the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => App.init());