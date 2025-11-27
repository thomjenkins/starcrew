// Network Manager for Firebase Realtime Database multiplayer
export class NetworkManager {
    constructor() {
        this.db = null;
        this.roomId = null;
        this.playerId = null;
        this.gameSeed = null;
        this.players = new Map(); // Other players: {id: {x, y, rotation, health, shields, ...}}
        this.isHost = false;
        this.connected = false;
        this.listeners = [];
        this.lastStateSent = 0;
        this.stateThrottle = 20; // Send player state frequently for smooth remote control
        this.lastEntitySent = 0;
        this.entityThrottle = 33; // Send complete state every 33ms (~30Hz) for reliable sync
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
            // Create room structure with deterministic seed
            const gameSeed = Date.now(); // Shared seed for deterministic lockstep
            const roomRef = this.db.ref(`rooms/${this.roomId}`);
            await roomRef.set({
                hostId: this.playerId,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                gameSeed: gameSeed, // Shared seed for deterministic RNG
                gameState: {
                    score: 0,
                    level: 1,
                    running: true
                }
            });

            this.gameSeed = gameSeed;

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

            const existingSeed = snapshot.val()?.gameSeed;
            if (existingSeed) {
                this.gameSeed = existingSeed;
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
        
        // Listen for player disconnections
        roomRef.child('players').on('child_removed', (snapshot) => {
            const playerId = snapshot.key;
            this.players.delete(playerId);
            this.notifyListeners('playerLeft', { playerId });
        });
        
        // Listen for shared game seed (clients)
        if (!this.isHost) {
            roomRef.child('gameSeed').on('value', (snapshot) => {
                const seed = snapshot.val();
                if (seed) {
                    this.gameSeed = seed;
                    this.notifyListeners('gameSeedUpdated', { seed });
                }
            });
        }

        // Listen for events (playerDied, playerDamaged, etc.) - all players listen
        roomRef.child('events').on('child_added', (snapshot) => {
            const event = snapshot.val();
            if (event && event.type) {
                // Check if event is targeted to a specific player
                if (event.targetPlayerId && event.targetPlayerId !== this.playerId) {
                    return; // This event is not for us
                }
                // Process events (either broadcast or targeted to us)
                this.notifyListeners(event.type, { ...event.data, playerId: event.playerId } || {});
            }
        });

        // WebRTC signaling
        roomRef.child('webrtc/offer').on('value', (snapshot) => {
            const offer = snapshot.val();
            if (offer && offer.playerId !== this.playerId) {
                this.notifyListeners('webRTCOffer', { offer });
            }
        });

        roomRef.child('webrtc/answer').on('value', (snapshot) => {
            const answer = snapshot.val();
            if (answer && answer.playerId !== this.playerId) {
                this.notifyListeners('webRTCAnswer', { answer });
            }
        });

        roomRef.child('webrtc/candidates').on('child_added', (snapshot) => {
            const candidate = snapshot.val();
            if (candidate && candidate.playerId !== this.playerId) {
                this.notifyListeners('iceCandidate', { candidate });
            }
        });
    }
    
    /**
     * Send local player state to Firebase
     */
    async sendPlayerState(playerState) {
        if (!this.connected || !this.db || !this.roomId || !this.playerId) {
            return;
        }

        const now = Date.now();
        if (now - this.lastStateSent < this.stateThrottle) {
            return; // Throttle updates
        }
        this.lastStateSent = now;
        
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
     * Send complete game state (entities, particles, etc.) - host only
     * This is the new host-authoritative approach
     */
    async sendCompleteGameState(completeState, force = false) {
        if (!this.connected || !this.isHost || !this.db || !this.roomId) {
            return;
        }
        
        const now = Date.now();
        if (!force && now - this.lastEntitySent < this.entityThrottle) {
            return; // Throttle updates (unless forced)
        }
        this.lastEntitySent = now;
        
        try {
            const stateRef = this.db.ref(`rooms/${this.roomId}/completeGameState`);
            await stateRef.update({
                ...completeState,
                lastUpdate: firebase.database.ServerValue.TIMESTAMP
            });
        } catch (error) {
            console.error('Failed to send complete game state:', error);
        }
    }
    
    /**
     * Send game entities (enemies, asteroids) - host only
     * @param {Object} entities - The entities to send
     * @param {boolean} force - If true, bypass throttle for immediate sync
     */
    async sendGameEntities(entities, force = false) {
        if (!this.connected || !this.isHost || !this.db || !this.roomId) {
            return;
        }
        
        const now = Date.now();
        if (!force && now - this.lastEntitySent < this.entityThrottle) {
            return; // Throttle updates (unless forced)
        }
        this.lastEntitySent = now;
        
        try {
            const entitiesRef = this.db.ref(`rooms/${this.roomId}/gameEntities`);
            await entitiesRef.update({
                enemies: entities.enemies || [],
                asteroids: entities.asteroids || [],
                bosses: entities.bosses || [],
                cargoVessel: entities.cargoVessel || null,
                lastUpdate: firebase.database.ServerValue.TIMESTAMP
            });
        } catch (error) {
            console.error('Failed to send game entities:', error);
        }
    }
    
    /**
     * Send an event (shooting, powerup collection, etc.)
     */
    async sendEvent(eventType, eventData, targetPlayerId = null) {
        if (!this.connected || !this.db || !this.roomId) {
            return;
        }
        
        try {
            const eventsRef = this.db.ref(`rooms/${this.roomId}/events`);
            await eventsRef.push({
                type: eventType,
                playerId: this.playerId,
                targetPlayerId: targetPlayerId, // Who should receive this event (null = broadcast)
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
     * Send WebRTC offer via Firebase signaling
     */
    async sendWebRTCOffer(offer) {
        if (!this.connected || !this.db || !this.roomId || !offer) return;

        try {
            await this.db.ref(`rooms/${this.roomId}/webrtc/offer`).set({
                ...offer,
                playerId: this.playerId,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
        } catch (error) {
            console.error('Failed to send WebRTC offer:', error);
        }
    }

    /**
     * Send WebRTC answer via Firebase signaling
     */
    async sendWebRTCAnswer(answer) {
        if (!this.connected || !this.db || !this.roomId || !answer) return;

        try {
            await this.db.ref(`rooms/${this.roomId}/webrtc/answer`).set({
                ...answer,
                playerId: this.playerId,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
        } catch (error) {
            console.error('Failed to send WebRTC answer:', error);
        }
    }

    /**
     * Send ICE candidate via Firebase signaling
     */
    async sendICECandidate(candidate) {
        if (!this.connected || !this.db || !this.roomId || !candidate) return;

        // Allow either raw RTCIceCandidateInit or wrapped { candidate }
        const candidateData = candidate.candidate ? candidate.candidate : candidate;

        try {
            await this.db.ref(`rooms/${this.roomId}/webrtc/candidates`).push({
                candidate: candidateData.candidate,
                sdpMid: candidateData.sdpMid,
                sdpMLineIndex: candidateData.sdpMLineIndex,
                usernameFragment: candidateData.usernameFragment,
                playerId: this.playerId,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
        } catch (error) {
            console.error('Failed to send ICE candidate:', error);
        }
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

    /**
     * Check if this player is the host
     */
    isHostPlayer() {
        return this.isHost;
    }

    /**
     * Get the deterministic game seed for the room
     */
    getGameSeed() {
        return this.gameSeed;
    }
}

