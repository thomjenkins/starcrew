// Upgrade Menu Manager
export class UpgradeMenu {
    constructor(upgradeSystem) {
        this.upgradeSystem = upgradeSystem;
        this.menuElement = null;
        this.optionsElement = null;
        this.closeButton = null;
        this.initialized = false;
    }

    init() {
        this.menuElement = document.getElementById('upgradeMenu');
        this.optionsElement = document.getElementById('upgradeOptions');
        this.closeButton = document.getElementById('closeUpgrade');
        
        if (this.closeButton) {
            this.closeButton.addEventListener('click', () => {
                this.hide();
            });
        }
        this.initialized = true;
    }

    show() {
        if (!this.initialized || !this.menuElement || !this.optionsElement) return;
        
        // Clear previous options
        this.optionsElement.innerHTML = '';
        
        // Get available upgrades
        const upgrades = this.upgradeSystem.getUpgradeList();
        const upgradePoints = this.upgradeSystem.getUpgradePoints();
        
        upgrades.forEach(upgrade => {
            const button = document.createElement('button');
            button.className = 'upgrade-btn';
            button.textContent = `${upgrade.name} (Level ${upgrade.level}) - Cost: ${upgrade.cost} point${upgrade.cost !== 1 ? 's' : ''}`;
            button.disabled = upgradePoints < upgrade.cost;
            
            button.addEventListener('click', () => {
                this.selectUpgrade(upgrade.key);
            });
            
            this.optionsElement.appendChild(button);
        });
        
        this.menuElement.classList.remove('hidden');
    }

    hide() {
        if (this.menuElement) {
            this.menuElement.classList.add('hidden');
        }
    }

    selectUpgrade(key) {
        // This will be handled by the game's applyUpgrade function
        // The menu just triggers the selection
        if (this.onUpgradeSelected) {
            this.onUpgradeSelected(key);
        }
    }

    setOnUpgradeSelected(callback) {
        this.onUpgradeSelected = callback;
    }
}



