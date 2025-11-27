// Command Module Manager
export class CommandModule {
    constructor() {
        this.moduleElement = null;
        this.crewTab = null;
        this.storeTab = null;
        this.crewTabContent = null;
        this.storeTabContent = null;
        this.closeButton = null;
        this.initialized = false;
    }

    init() {
        this.moduleElement = document.getElementById('commandModule');
        this.crewTab = document.getElementById('crewTab');
        this.storeTab = document.getElementById('storeTab');
        this.crewTabContent = document.getElementById('crewTabContent');
        this.storeTabContent = document.getElementById('storeTabContent');
        this.closeButton = document.getElementById('closeCommandModule');
        
        // Tab switching
        if (this.crewTab && this.storeTab && this.crewTabContent && this.storeTabContent) {
            this.crewTab.addEventListener('click', () => {
                this.crewTab.classList.add('active');
                this.storeTab.classList.remove('active');
                this.crewTabContent.classList.remove('hidden');
                this.storeTabContent.classList.add('hidden');
            });
            
            this.storeTab.addEventListener('click', () => {
                this.storeTab.classList.add('active');
                this.crewTab.classList.remove('active');
                this.storeTabContent.classList.remove('hidden');
                this.crewTabContent.classList.add('hidden');
            });
        }
        
        if (this.closeButton) {
            this.closeButton.addEventListener('click', () => {
                this.close();
            });
        }
        
        this.initialized = true;
    }

    open() {
        if (this.moduleElement) {
            this.moduleElement.classList.remove('hidden');
        }
    }

    close() {
        if (this.moduleElement) {
            this.moduleElement.classList.add('hidden');
        }
    }

    isOpen() {
        return this.moduleElement && !this.moduleElement.classList.contains('hidden');
    }

    updateCurrency(currency, tab = 'both') {
        if (tab === 'both' || tab === 'crew') {
            const currencyCrew = document.getElementById('currencyCrew');
            if (currencyCrew) {
                currencyCrew.textContent = currency;
            }
        }
        if (tab === 'both' || tab === 'store') {
            const currencyStore = document.getElementById('currencyStore');
            if (currencyStore) {
                currencyStore.textContent = currency;
            }
        }
    }

    updateCrewCount(totalCrew) {
        const totalCrewElement = document.getElementById('totalCrew');
        if (totalCrewElement) {
            totalCrewElement.textContent = totalCrew;
        }
    }

    updateCrewStation(station, count, effect) {
        const crewElement = document.getElementById(`${station}Crew`);
        const effectElement = document.getElementById(`${station}Effect`);
        
        if (crewElement) {
            crewElement.textContent = count;
        }
        if (effectElement) {
            effectElement.textContent = effect;
        }
    }

    updateStoreItem(itemId, enabled, price) {
        const button = document.getElementById(itemId);
        if (button) {
            button.disabled = !enabled;
            if (price !== undefined) {
                const priceText = button.textContent.replace(/\d+/, price);
                button.textContent = priceText;
            }
        }
    }

    showCargoShipSection(show) {
        const cargoShipStoreItem = document.getElementById('cargoShipStoreItem');
        if (cargoShipStoreItem) {
            cargoShipStoreItem.style.display = show ? 'block' : 'none';
        }
    }

    updateCargoShipCount(count, price) {
        const cargoShipCount = document.getElementById('cargoShipCount');
        const cargoShipPrice = document.getElementById('cargoShipPrice');
        
        if (cargoShipCount) {
            cargoShipCount.textContent = count;
        }
        if (cargoShipPrice) {
            cargoShipPrice.textContent = price;
        }
    }
}



