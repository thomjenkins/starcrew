export class WebRTCManager {
    constructor() {
        this.peerConnection = null;
        this.dataChannel = null;
        this.listeners = [];
        this.connected = false;
        this.isHost = false;
        this.pendingIceCandidates = [];
        this.remoteDescriptionSet = false;
    }

    on(event, callback) {
        this.listeners.push({ event, callback });
    }

    off(event, callback) {
        this.listeners = this.listeners.filter(
            l => !(l.event === event && l.callback === callback)
        );
    }

    emit(event, data) {
        this.listeners.forEach(listener => {
            if (listener.event === event) {
                listener.callback(data);
            }
        });
    }

    createPeerConnection() {
        this.peerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }
            ]
        });

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                // Emit the raw ICE candidate so signaling layers can serialize
                this.emit('iceCandidate', { candidate: event.candidate });
            }
        };

        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            if (state === 'connected') {
                this.connected = true;
                this.emit('connected');
            } else if (state === 'disconnected' || state === 'failed') {
                this.connected = false;
                this.emit('disconnected');
            }
        };

        this.peerConnection.ondatachannel = (event) => {
            this.dataChannel = event.channel;
            this.setupDataChannel();
        };
    }

    setupDataChannel() {
        if (!this.dataChannel) return;

        this.dataChannel.onopen = () => {
            this.connected = true;
            this.emit('connected');
        };

        this.dataChannel.onclose = () => {
            this.connected = false;
            this.emit('disconnected');
        };

        this.dataChannel.onerror = (error) => {
            this.emit('error', error);
        };

        this.dataChannel.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'input' && data.payload) {
                    this.emit('inputReceived', { input: data.payload });
                }
            } catch (error) {
                this.emit('error', error);
            }
        };
    }

    async createConnection(isHost = false) {
        this.isHost = isHost;
        this.createPeerConnection();
        this.pendingIceCandidates = [];
        this.remoteDescriptionSet = false;

        if (this.isHost) {
            this.dataChannel = this.peerConnection.createDataChannel('game-data', {
                ordered: true,
                maxRetransmits: 0
            });
            this.setupDataChannel();

            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            this.emit('offerCreated', { offer });
        }
    }

    async handleOffer(offer) {
        if (!this.peerConnection) {
            this.createPeerConnection();
        }

        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        this.remoteDescriptionSet = true;
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        this.flushPendingIceCandidates();
        this.emit('answerCreated', { answer });
    }

    async handleAnswer(answer) {
        if (!this.peerConnection) return;
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        this.remoteDescriptionSet = true;
        this.flushPendingIceCandidates();
    }

    async handleIceCandidate(candidate) {
        if (!candidate || !this.peerConnection) return;

        // Support raw RTCIceCandidateInit, nested { candidate }, or Firebase-shaped objects
        let candidateData;
        if (candidate.candidate && typeof candidate.candidate === 'object' && candidate.candidate.candidate) {
            candidateData = candidate.candidate;
        } else if (candidate.candidate && candidate.sdpMid !== undefined) {
            candidateData = candidate;
        } else if (candidate.candidate && typeof candidate.candidate === 'string') {
            candidateData = candidate;
        } else {
            candidateData = candidate;
        }
        try {
            if (!this.remoteDescriptionSet) {
                this.pendingIceCandidates.push(candidateData);
                return;
            }
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidateData));
        } catch (error) {
            this.emit('error', error);
        }
    }

    flushPendingIceCandidates() {
        if (!this.peerConnection || !this.remoteDescriptionSet || !this.pendingIceCandidates.length) return;
        const queued = [...this.pendingIceCandidates];
        this.pendingIceCandidates = [];
        queued.forEach(async (candidateData) => {
            try {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidateData));
            } catch (error) {
                this.emit('error', error);
            }
        });
    }

    sendInput(input) {
        if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
            return;
        }

        const payload = {
            type: 'input',
            payload: input
        };
        this.dataChannel.send(JSON.stringify(payload));
    }

    close() {
        if (this.dataChannel) {
            this.dataChannel.close();
        }
        if (this.peerConnection) {
            this.peerConnection.close();
        }
        this.connected = false;
    }
}
