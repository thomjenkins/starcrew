// Network Manager for Firebase Realtime Database multiplayer
export class NetworkManager {
    constructor() {
        this.db = null;
        this.roomId = null;
        this.playerId = null;
        this.players = new Map(); // Other players: {id: {x, y, rotation, health, shields, ...}}
        this.isHost = false;
        this.connected = false;
        this.listeners = [];
        this.lastInputSent = 0;
        this.inputThrottle = 50; // Send inputs every 50ms (20 updates/sec)
    }
    
    /**
     * Initialize Firebase connection
     * @param {Object} firebaseConfig - Firebase configuration object
     */
    async initialize(firebaseConfig) {
        try {
            // Initialize Firebase (using compat API)
            if (typeof firebase === 'undefined') {
                console.error('Firebase not loaded. Make sure Firebase scripts are included.');
                return false;
            }
            
            const app = firebase.initializeApp(firebaseConfig);
            this.db = firebase.database();
            console.log('✅ Firebase initialized');
            return true;
        } catch (error) {
            console.error('Failed to initialize Firebase:', error);
            return false;
        }
    }
    
    /**
     * Generate a unique player ID
     */
    generatePlayerId() {
        return 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    /**
     * Generate a unique room ID
     */
    generateRoomId() {
        return 'room_' + Math.random().toString(36).substr(2, 9);
    }
    
    /**
     * Create a new game room (host)
     */
    async createRoom() {
        if (!this.db) {
            console.error('Firebase not initialized');
            return null;
        }
        
        this.playerId = this.generatePlayerId();
        this.roomId = this.generateRoomId();
        this.isHost = true;
        
        try {
            // Create room structure
            const roomRef = this.db.ref(`rooms/${this.roomId}`);
            await roomRef.set({
                hostId: this.playerId,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                gameState: {
                    score: 0,
                    level: 1,
                    running: true
                }
            });
            
            // Add this player to the room
            await roomRef.child(`players/${this.playerId}`).set({
                id: this.playerId,
                isHost: true,
                connected: true,
                lastUpdate: firebase.database.ServerValue.TIMESTAMP
            });
            
            // Set up listeners
            this.setupRoomListeners();
            
            this.connected = true;
            console.log(`✅ Room created: ${this.roomId}`);
            return this.roomId;
        } catch (error) {
            console.error('Failed to create room:', error);
            return null;
        }
    }
    
    /**
     * Join an existing game room
     */
    async joinRoom(roomId) {
        if (!this.db) {
            console.error('Firebase not initialized');
            return false;
        }
        
        this.playerId = this.generatePlayerId();
        this.roomId = roomId;
        this.isHost = false;
        
        try {
            const roomRef = this.db.ref(`rooms/${this.roomId}`);
            const snapshot = await roomRef.once('value');
            
            if (!snapshot.exists()) {
                console.error('Room does not exist');
                return false;
            }
            
            // Add this player to the room
            await roomRef.child(`players/${this.playerId}`).set({
                id: this.playerId,
                isHost: false,
                connected: true,
                lastUpdate: firebase.database.ServerValue.TIMESTAMP
            });
            
            // Set up listeners
            this.setupRoomListeners();
            
            this.connected = true;
            console.log(`✅ Joined room: ${this.roomId}`);
            return true;
        } catch (error) {
            console.error('Failed to join room:', error);
            return false;
        }
    }
    
    /**
     * Set up Firebase listeners for room updates
     */
    setupRoomListeners() {
        if (!this.db || !this.roomId) return;
        
        const roomRef = this.db.ref(`rooms/${this.roomId}`);
        
        // Listen for other players joining/leaving
        roomRef.child('players').on('value', (snapshot) => {
            const players = snapshot.val() || {};
            this.players.clear();
            
            Object.keys(players).forEach(playerId => {
                if (playerId !== this.playerId && players[playerId].connected) {
                    this.players.set(playerId, players[playerId]);
                }
            });
            
            // Notify listeners
            this.notifyListeners('playersUpdated', { players: Array.from(this.players.values()) });
        });
        
        // Listen for player state updates
        roomRef.child('players').on('child_changed', (snapshot) => {
            const playerData = snapshot.val();
            if (playerData && playerData.id !== this.playerId) {
                this.players.set(playerData.id, playerData);
                this.notifyListeners('playerUpdated', { player: playerData });
            }
        });
        
        // Listen for player disconnections
        roomRef.child('players').on('child_removed', (snapshot) => {
            const playerId = snapshot.key;
            this.players.delete(playerId);
            this.notifyListeners('playerLeft', { playerId });
        });
        
        // Listen for shared game state (if host)
        if (this.isHost) {
            // Host manages shared state
        } else {
            // Clients listen to host's game state
            roomRef.child('gameState').on('value', (snapshot) => {
                const gameState = snapshot.val();
                if (gameState) {
                    this.notifyListeners('gameStateUpdated', { gameState });
                }
            });
        }
    }
    
    /**
     * Send local player state to Firebase
     */
    async sendPlayerState(playerState) {
        if (!this.connected || !this.db || !this.roomId || !this.playerId) {
            return;
        }
        
        const now = Date.now();
        if (now - this.lastInputSent < this.inputThrottle) {
            return; // Throttle updates
        }
        this.lastInputSent = now;
        
        try {
            const playerRef = this.db.ref(`rooms/${this.roomId}/players/${this.playerId}`);
            await playerRef.update({
                ...playerState,
                lastUpdate: firebase.database.ServerValue.TIMESTAMP
            });
        } catch (error) {
            console.error('Failed to send player state:', error);
        }
    }
    
    /**
     * Send game state update (host only)
     */
    async sendGameState(gameState) {
        if (!this.connected || !this.isHost || !this.db || !this.roomId) {
            return;
        }
        
        try {
            const gameStateRef = this.db.ref(`rooms/${this.roomId}/gameState`);
            await gameStateRef.update({
                ...gameState,
                lastUpdate: firebase.database.ServerValue.TIMESTAMP
            });
        } catch (error) {
            console.error('Failed to send game state:', error);
        }
    }
    
    /**
     * Send an event (shooting, powerup collection, etc.)
     */
    async sendEvent(eventType, eventData) {
        if (!this.connected || !this.db || !this.roomId) {
            return;
        }
        
        try {
            const eventsRef = this.db.ref(`rooms/${this.roomId}/events`);
            await eventsRef.push({
                type: eventType,
                playerId: this.playerId,
                data: eventData,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
        } catch (error) {
            console.error('Failed to send event:', error);
        }
    }
    
    /**
     * Register a listener for network events
     */
    on(event, callback) {
        this.listeners.push({ event, callback });
    }
    
    /**
     * Remove a listener
     */
    off(event, callback) {
        this.listeners = this.listeners.filter(
            l => !(l.event === event && l.callback === callback)
        );
    }
    
    /**
     * Notify all listeners of an event
     */
    notifyListeners(event, data) {
        this.listeners.forEach(listener => {
            if (listener.event === event) {
                listener.callback(data);
            }
        });
    }
    
    /**
     * Leave the current room
     */
    async leaveRoom() {
        if (!this.connected || !this.db || !this.roomId || !this.playerId) {
            return;
        }
        
        try {
            const playerRef = this.db.ref(`rooms/${this.roomId}/players/${this.playerId}`);
            await playerRef.update({ connected: false });
            
            // If host, clean up room after a delay
            if (this.isHost) {
                setTimeout(async () => {
                    await this.db.ref(`rooms/${this.roomId}`).remove();
                }, 5000);
            }
            
            this.connected = false;
            this.roomId = null;
            this.playerId = null;
            this.players.clear();
            console.log('Left room');
        } catch (error) {
            console.error('Failed to leave room:', error);
        }
    }
    
    /**
     * Get all connected players
     */
    getPlayers() {
        return Array.from(this.players.values());
    }
    
    /**
     * Check if connected
     */
    isConnected() {
        return this.connected;
    }
    
    /**
     * Get room ID
     */
    getRoomId() {
        return this.roomId;
    }
    
    /**
     * Get player ID
     */
    getPlayerId() {
        return this.playerId;
    }
}

