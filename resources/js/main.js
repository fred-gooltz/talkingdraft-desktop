import { alpineUtils, genId } from "./lib/utils.js";
import { apiStore } from "./lib/utils.js";

console.log('✅ main.js loaded');

document.addEventListener('alpine:init', () => {
	console.log('🎯 alpine:init event fired');
	let mediaRecorder, mediaStream, chunks = [], timerIntervalID;

	function getWavBytes(buffer, options) {
		const type = options.isFloat ? Float32Array : Uint16Array
		const numFrames = buffer.byteLength / type.BYTES_PER_ELEMENT
		const headerBytes = getWavHeader(Object.assign({}, options, { numFrames }))
		const wavBytes = new Uint8Array(headerBytes.length + buffer.byteLength);
		wavBytes.set(headerBytes, 0)
		wavBytes.set(new Uint8Array(buffer), headerBytes.length)
		return wavBytes
	}

	function getWavHeader(options) {
		const numFrames = options.numFrames
		const numChannels = options.numChannels || 2
		const sampleRate = options.sampleRate || 44100
		const bytesPerSample = options.isFloat? 4 : 2
		const format = options.isFloat? 3 : 1
		const blockAlign = numChannels * bytesPerSample
		const byteRate = sampleRate * blockAlign
		const dataSize = numFrames * blockAlign
		const buffer = new ArrayBuffer(44)
		const dv = new DataView(buffer)
		let p = 0

		function writeString(s) {
			for (let i = 0; i < s.length; i++) {
				dv.setUint8(p + i, s.charCodeAt(i))
			}
			p += s.length
		}
		function writeUint32(d) {
			dv.setUint32(p, d, true)
			p += 4
		}
		function writeUint16(d) {
			dv.setUint16(p, d, true)
			p += 2
		}

		writeString('RIFF')
		writeUint32(dataSize + 36)
		writeString('WAVE')
		writeString('fmt ')
		writeUint32(16)
		writeUint16(format)
		writeUint16(numChannels)
		writeUint32(sampleRate)
		writeUint32(byteRate)
		writeUint16(blockAlign)
		writeUint16(bytesPerSample * 8)
		writeString('data')
		writeUint32(dataSize)

		return new Uint8Array(buffer)
	}

	Alpine.store('utils', alpineUtils(ENV.API_URL));
	console.log('📦 utils store registered');

	Alpine.store('api', apiStore);
	console.log('📦 api store registered');

	Alpine.data('ui', () => ({
		// flags and styles
		charEdit:0, 
		tView:false, // Transcript view closed by default
		newOpen:1, 
		dnlStory:null,
		
		// New story form data
		newStoryName: '',
		newStoryPreset: 'Save the Cat',
		newStoryMinutes: 90,
		
		// Button styles
		sbtn:{ 'relative':1, 'p-4':1, 'w-full':1, 'h-24':1, 'flex':1, 'items-center':1, 'justify-center':1, 'rounded-lg':1, 'bg-slate-500':1, 'text-white':1, 'outline-none':1, 'border-transparent':1, 'border':1, 'hover:bg-transparent':1, 'hover:border-[#FFD905]':1, 'active:border-[#FFD905]':1, 'active:bg-transparent':1, 'duration-200':1 },
		abtn:{ 'bg-transparent':1, 'border-[#2cd83d]':1, 'border':1, 'hover:border-[#FFD905]':0, },
		
		// 🔧 DEV MODE - Set to false when backend is ready
		devMode: false,
		
		// State variables
		onSwitch: false,
		mode: 'setup', // 'setup', 'active', or 'transcription'
		currnum: undefined, 
		prevnum: undefined,
		audioURL: '',
		timer: 0,
		timerDisplay: "00:00",
		sceneMax: 1200, // 20 minutes default
		transcribing: 0,
		loading: 0,
		_pendingSceneLoad: null,  // Queue for scene load requests during loading
		
		// Session blobs - in-memory audio storage during recording
		sessionBlobs: [],
		
		// Transcription progress
		transcriptionProgress: {
			current: 0,
			total: 0
		},
		
		// Story data
 		activeStory: {},
 		activeScene: {},
 		showAllScenes: false,
		storyList: [],
		
		// Custom modal state (replaces native confirm/prompt)
		modal: {
			show: false,
			type: '', // 'confirm' or 'prompt'
			title: '',
			message: '',
			inputValue: '',
			onConfirm: null,
			onCancel: null
		},

        async init () {
            console.log('UI init');
            console.log('🔧 DEV MODE:', this.devMode ? 'ENABLED (using mock transcription)' : 'DISABLED (using real backend)');
            
            // Keyboard shortcuts - keydown to prevent jingle
            document.addEventListener('keydown', (e) => {
                // Don't interfere with any Cmd/Ctrl shortcuts (paste, copy, cut, etc.)
                if (e.metaKey || e.ctrlKey) {
                    return; // Let all Cmd/Ctrl shortcuts through
                }
                
                // Prevent error jingle during active recording
                if (this.mode == 'active') {
                    // Only handle number keys 0-9 and space/numpad decimal
                    const key = e.key;
                    if ((key >= '0' && key <= '9') || key == ' ' || e.code == 'NumpadDecimal') {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                }
            });
            
            // Handle key actions on keyup
            document.addEventListener('keyup', (e) => {
                if (this.mode == 'active') {
                    if (e.key == ' ' || e.code == 'NumpadDecimal') { 
                        this.activateRecording(this.activeScene, document.getElementById('viscanvas')); 
                    } else { 
                        this.startStopRecording(e.key, false); 
                    } 
                    return; 
                }
                
                if (this.mode == 'setup') { 
                    if (e.code == 'NumpadDecimal') { 
                        this.activateRecording(this.activeScene, document.getElementById('viscanvas')); 
                    } 
                    return; 
                }
            });
            
            // Warn before leaving during transcription
            window.addEventListener('beforeunload', (e) => { 
                if (this.transcribing || this.mode === 'transcription') { 
                    e.preventDefault(); 
                    e.returnValue = ''; 
                    delete e['returnValue']; 
                } 
            });
           
            this.onSwitch = true;
            const qs = new Proxy(new URLSearchParams(window.location.search), { 
                get:(searchParams, prop) => searchParams.get(prop),
            });
            if (qs.sid) { 
                this.newOpenStory('', qs.sid) 
            } else { 
                this.newOpen = 1; 
            }
        },

        // 🔧 MOCK TRANSCRIPTION RESPONSE - Documents API contract
        mockTranscriptionResponse () {
            console.log('📝 Using MOCK transcription response');
            
            // This defines the exact format the backend must return
            const mockTranscripts = this.sessionBlobs.map((item, idx) => {
                // Simulate different types of transcripts
                const mockTexts = [
                    "This is a mock transcription of the recorded audio segment.",
                    "The quick brown fox jumps over the lazy dog.",
                    "Testing the batch transcription system with mock data.",
                    "Mock transcript for development and testing purposes.",
                    "Simulated speech-to-text conversion output."
                ];
                
                return {
                    tid: item.tid,
                    transcript: item.charName === 'ACTION' 
                        ? `[${mockTexts[idx % mockTexts.length]}]`
                        : mockTexts[idx % mockTexts.length]
                };
            });
            
            // This is the exact structure the frontend expects from the backend
            const response = {
                success: true,
                transcripts: mockTranscripts
            };
            
            console.log('📤 Mock response structure:', response);
            return response;
        },

        async newOpenStory (name, id, system, minutes) {
            console.log('🔵 newOpenStory called with:', {name, id, system, minutes});
            if (!this.checkStuff()) { 
                console.log('❌ checkStuff failed');
                return; 
            }

            if (id) { 
                let loaded = await this.loadStory(id);
                this.newOpen = loaded ? 0 : 1;
                console.log('📖 Story load result:', loaded, 'newOpen:', this.newOpen);
                return; 
            }

            try {
                let story = Alpine.store('api').newStory(name, system, minutes);
                await Alpine.store('api').saveStory(story);
                window.location.replace('index.html?sid='+story.id);
            }
            catch (err) { 
                return Alpine.store('utils').showAlert(err); 
            }
        },

        async loadStories () {
            console.log('loadStories');
            let fd = new FormData(); 
            fd.append('cmd', 'listStories'); 
            let stories = await Alpine.store('utils').apiReq(fd); 
            let tmp = [];
            if (stories && stories.length) {
                for (const story of stories) { 
                    // Normalize timestamp: convert milliseconds to seconds if needed
                    if (story.updated && story.updated > 10000000000) {
                        // This is in milliseconds (13+ digits), convert to seconds
                        story.updated = story.updated / 1000;
                    }
                    tmp.push(story); 
                }
                
                // DEBUG: Log timestamps before sorting
                console.log('📊 BEFORE SORT:', tmp.map(s => ({
                    name: s.name,
                    updated: s.updated,
                    date: s.updated ? new Date(s.updated * 1000).toLocaleString() : 'NO TIMESTAMP'
                })));
                
                // Sort by updated timestamp (most recent first)
                // Handle stories without timestamps by treating them as oldest
                tmp.sort((a, b) => {
                    const aTime = a.updated || 0;
                    const bTime = b.updated || 0;
                    return bTime - aTime;
                });
                
                // DEBUG: Log timestamps after sorting
                console.log('📊 AFTER SORT:', tmp.map(s => ({
                    name: s.name,
                    updated: s.updated,
                    date: s.updated ? new Date(s.updated * 1000).toLocaleString() : 'NO TIMESTAMP'
                })));
            }
            this.storyList = tmp;
            console.log('📊 Stories loaded and sorted:', tmp.length, 'stories');
        },

        async loadStory (id) {
            console.log('loadStory', id);	
            if (!this.checkStuff()) { return false; }
            
            try { 
                let story = await Alpine.store('api').getStory(id); 
                if (this.loading) { 
                    Alpine.store('utils').showAlert('Scene loading in progress');
                    return false;
                }
                this.activeStory = story;
                
                // Update "last accessed" timestamp for this specific story
                // Use a lightweight API call that only updates the timestamp
                let fd = new FormData();
                fd.append('cmd', 'touchStory');
                fd.append('id', story.id);
                await Alpine.store('utils').apiReq(fd);
                console.log('🔄 Story access time updated');
                
                return true;
            }
            catch (err) { 
                console.error('Error loading story:', err);
                Alpine.store('utils').showAlert('Story not found: ' + err); 
                window.history.replaceState({}, '', 'index.html');
                return false;
            }
        },

        async deleteStory (story) {
            console.log('🗑️  deleteStory CALLED with story:', story);
            
            if (!this.checkStuff()) { 
                console.log('❌ deleteStory: checkStuff failed');
                return; 
            }
            
            if (!story?.id) { 
                console.log('❌ deleteStory: Invalid story (no ID)', story);
                return Alpine.store('utils').showAlert('Error: Invalid story.'); 
            }
            
            console.log('📋 Story ID:', story.id);
            console.log('📋 Story name:', story.name);
            console.log('📋 Current view - newOpen:', this.newOpen);
            
            // Show custom confirmation modal
            this.showConfirmModal(
                'Delete Story?',
                `Are you sure you want to delete "${story.name}"? This cannot be undone.`,
                async () => {
                    console.log('✅ User confirmed deletion. Calling API...');
                    
                    try { 
                        console.log('📤 Calling Alpine.store("api").deleteStory...');
                        await Alpine.store('api').deleteStory(story); 
                        console.log('✅ API deleteStory returned successfully');
                        
                        // If on dashboard, refresh the story list
                        if (this.newOpen == 1) {
                            console.log('📊 On dashboard - removing from storyList');
                            // Remove from storyList array
                            const index = this.storyList.findIndex(s => s.id === story.id);
                            console.log('📊 Story index in list:', index);
                            if (index > -1) {
                                this.storyList.splice(index, 1);
                                console.log('✅ Story removed from list');
                            }
                            Alpine.store('utils').showAlert('Story deleted successfully', 2000, false, 'notice');
                        } else {
                            console.log('📄 In story view - redirecting to dashboard');
                            // If in story view, redirect to dashboard
                            window.location.replace('index.html');
                        }
                    } 
                    catch (err) { 
                        console.error('❌ deleteStory ERROR:', err);
                        return Alpine.store('utils').showAlert(err); 
                    }
                }
            );
        },

        async copyStory (story) {
            if (!this.checkStuff()) { return; }
            if (!story?.id) { return Alpine.store('utils').showAlert('Error: Invalid story.'); }
            
            // Show custom prompt modal
            this.showPromptModal(
                'Copy Story',
                'Enter name for copy:',
                story.name + ' COPY',
                async (name) => {
                    if (!name || !name.trim()) { return; }
                    
                    let copy = JSON.parse(JSON.stringify(story));
                    copy.id = genId();
                    copy.name = name.trim();
                    copy.sections.forEach((e,i) => { e.id = genId(i); });

                    try {
                        let rcd = await Alpine.store('api').saveStory(copy); 
                        if (!rcd?.id) { return Alpine.store('utils').showAlert('Error copying story'); }
                        
                        // Copy audio files via API
                        let tids = [];	
                        for (const scene of story.scenes) {	
                            for (const tid of scene.trackOrder) { 
                                tids.push(story.id+"-"+scene.id+"-"+tid); 
                            }	
                        }
                        let fd = new FormData(); 
                        fd.append('cmd', 'copyAudio'); 
                        fd.append('newid', rcd.id); 
                        fd.append('tids', JSON.stringify(tids)); 	
                        await Alpine.store('utils').apiReq(fd);

                        window.location.replace('index.html?sid='+rcd.id);
                    } catch (err) { 
                        Alpine.store('utils').showAlert(err); 
                    }
                }
            );
        },

        async addScene (story, sectionIdx, sceneId, chars) {
            if (!this.checkStuff()) { return; }
            if (!story.scenes || (sectionIdx == undefined && sceneId == undefined)) { 
                return Alpine.store('utils').showAlert('Invalid Story or Index'); 
            }
            console.log('UI addScene', sectionIdx);

            try { 
                let scene = Alpine.store('api').addScene(
                    story, 
                    sectionIdx, 
                    story.scenes.findIndex((e,i) => e.id == sceneId)+1, 
                    chars
                ); 
                Alpine.store('api').saveStory(story);
            } 
            catch (err) { 
                Alpine.store('utils').showAlert(err); 
            }
        },

        async setScene (story, scene, offset, sceneIdx) {
            console.log('setScene', scene, offset, sceneIdx);
            if (!story?.id || !story?.scenes) { 
                return Alpine.store('utils').showAlert('Error: Invalid story.'); 
            }
            if (!this.checkStuff()) { return; }

            // Handle offset navigation (previous/next)
            if (offset) {
                let idx = story.scenes.findIndex((e,i) => e.id == scene.id);
                if ((idx == -1) || !story.scenes?.[idx+offset]) { 
                    return Alpine.store('utils').showAlert('No scene found'); 
                }
                scene = story.scenes[idx+offset];
            }

            // Handle scene index navigation
            if (sceneIdx != undefined) {
                scene = story.scenes[sceneIdx] || story.scenes[0];
            }

            // Close modal if no scene
            if (!scene?.id) {
                this.activeScene = {};
                this.audioURL = '';
                this.sessionBlobs = []; // Clear session blobs when closing
                return; 
            }

            this.loading++;
            this.activeScene = scene;
            this.audioURL = '';
            this.sessionBlobs = []; // Clear session blobs when opening new scene

            // Load audio for each track from backend
            try {
                for (const tid in scene.tracks) {
                    let fd = new FormData(); 
                    fd.append('cmd', 'getAudio'); 
                    fd.append('id', story.id+"-"+scene.id+"-"+tid);
                    let rsp = await Alpine.store('utils').apiReq(fd, true);
                    let data = await rsp.blob();
                    if (data.type.match('audio')) {	
                        scene.tracks[tid].audio = data;	
                    } else {	
                        console.log('Track not loaded', tid, data.type); 
                    }
                }
            }
            catch (err) {
                Alpine.store('utils').showAlert('Error loading scene audio: ' + err);
            }

            // Compile audio tracks into single playback file
            try {
                let tmp = await this.compileAudio(story, scene);
                scene.duration = tmp.duration ?? scene.duration;
                this.audioURL = tmp.audioURL || '';
            }
            catch (err) {
                Alpine.store('utils').showAlert('Error compiling scene audio: ' + err);
            }

            this.loading--;
        },

        async recorderInit () {
            console.log('recorderInit');
            if (!navigator.mediaDevices?.getUserMedia) { 
                return Alpine.store('utils').showAlert('Error: Audio recording is not supported or disabled.'); 
            }
            if (mediaRecorder) { 
                return console.log('mediaRecorder already initialized', mediaRecorder) 
            }
            
            try {
                // Use existing stream or request microphone once
                if (!mediaStream) {
                    console.log('🎤 Requesting microphone access (ONE TIME ONLY)...');
                    mediaStream = await navigator.mediaDevices.getUserMedia({ 
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true,
                            sampleRate: 48000,
                            channelCount: 1
                        }
                    });
                    console.log('✅ Microphone access granted! Stream will be kept alive.');
                } else {
                    console.log('✅ Reusing existing microphone stream (no permission needed)');
                }
                
                // Configure MediaRecorder options
                const options = {
                    audioBitsPerSecond: 128000
                };
                
                // Try webm first, fallback to ogg
                if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                    options.mimeType = 'audio/webm;codecs=opus';
                } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
                    options.mimeType = 'audio/ogg;codecs=opus';
                }
                
                mediaRecorder = new MediaRecorder(mediaStream, options);
                mediaRecorder.ondataavailable = function (e) { chunks.push(e.data); };
                mediaRecorder.onstop = (e) => { 
                    this.addTrack(this.activeStory, this.activeScene); 
                };
                
                console.log('✅ MediaRecorder initialized:', options);
            } catch (err) {
                console.error('Microphone error:', err);
                Alpine.store('utils').showAlert('Microphone access denied. Please allow microphone access and reload the app.', 5000);
            }
        },

        async addTrack (story, scene) {
            console.log('addTrack', story?.name, scene?.name);
            if (!story?.id) { 
                return Alpine.store('utils').showAlert('Error adding track. Invalid story.'); 
            }
            if (!scene?.id) { 
                return Alpine.store('utils').showAlert('Error adding track. Invalid scene.'); 
            }
            
            let tid = genId(); 
            // Use the same mimeType as MediaRecorder
            let mimeType = mediaRecorder.mimeType || 'audio/webm;codecs=opus';
            let blob = new Blob(chunks, {'type': mimeType}); 
            chunks = [];

            try {
                // ✅ CRITICAL: Add to session blobs (in-memory only)
                this.sessionBlobs.push({
                    tid: tid,
                    blob: blob,
                    charName: scene.chars[this.prevnum]
                });
                
                // ✅ CRITICAL: DO NOT save to permanent storage yet!
                // Audio will be saved only after batch transcription completes
                
                console.log(`✅ Track ${tid} added to session (${this.sessionBlobs.length} total)`);
                console.log('📋 Session blobs:', this.sessionBlobs.map(sb => ({
                    tid: sb.tid,
                    charName: sb.charName,
                    blobSize: sb.blob.size
                })));
                
                // Update scene duration for UI feedback
                if (mediaRecorder.state == 'inactive') { 
                    let tmp = await this.compileAudio(story, scene); 
                    scene.duration = tmp.duration; 
                    this.audioURL = tmp.audioURL || ''; 
                }
            }
            catch (err) {
                Alpine.store('utils').showAlert('Error adding track: ' + err);
            }
        },

        async compileAudio (story, scene) {
            if (!story?.id) { 
                return Alpine.store('utils').showAlert('Error updating audio. Invalid story.'); 
            }
            if (!scene?.id) { 
                return Alpine.store('utils').showAlert('Error updating audio. Invalid scene.'); 
            }

            const audioContext = new AudioContext();
            let buffs = [], errs = [];
            
            // Compile saved tracks
            for (const tid of (scene.trackOrder || [])) {
                if (!scene.tracks[tid]?.audio?.arrayBuffer) { continue; }
                try {
                    let arrayBuffer = await scene.tracks[tid].audio.arrayBuffer();
                    let audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                    buffs.push(audioBuffer);
                }
                catch (err) {
                    errs.push(err + ' ' + scene.id + '-' + tid);
                }
            }
            
            // Also compile session blobs (for real-time preview)
            for (const item of this.sessionBlobs) {
                if (!item.blob?.arrayBuffer) { continue; }
                try {
                    let arrayBuffer = await item.blob.arrayBuffer();
                    let audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                    buffs.push(audioBuffer);
                }
                catch (err) {
                    errs.push(err + ' session-' + item.tid);
                }
            }
            
            if (errs.length) { 
                console.error('Audio compilation errors:', errs);
            }
            if (!buffs.length) { return {}; }

            // Combine all audiobuffers into single buffer
            let buflengh = buffs.length, totalSamples = 0, channels = [];
            for (let a=0; a < buflengh; a++){
                channels.push(buffs[a].numberOfChannels);
                totalSamples += buffs[a].length;
            }
            let numberOfChannels = channels.reduce(function(a, b) { return Math.min(a, b); });
            let tmp = audioContext.createBuffer(numberOfChannels, totalSamples, audioContext.sampleRate);	
            for (var b=0; b<numberOfChannels; b++) {
                let channel = tmp.getChannelData(b), dataIndex = 0;
                for (var c = 0; c < buflengh; c++) {	
                    channel.set(buffs[c].getChannelData(b), dataIndex);	
                    dataIndex+=buffs[c].length;		
                }
            }

            // Convert to WAV format
            const [left, right] = [tmp.getChannelData(0), tmp.getChannelData(0)]
            const interleaved = new Float32Array(left.length + right.length)
            for (let src=0, dst=0; src < left.length; src++, dst+=2) {				
                interleaved[dst] = left[src];				
                interleaved[dst+1] = right[src];			
            }
            const wavBytes = getWavBytes(interleaved.buffer, { 
                isFloat:true, 
                numChannels:2, 
                sampleRate:audioContext.sampleRate, 
            })
            
            return { 
                duration: tmp.duration, 
                audioURL: window.URL.createObjectURL(new Blob([wavBytes], { type: 'audio/wav' })) 
            };
        },

        async batchTranscribeScene (story, scene) {
            console.log('=== batchTranscribeScene START ===');
            console.log('Session blobs:', this.sessionBlobs.length);
            console.log('📋 Blobs to transcribe:', this.sessionBlobs.map(sb => ({
                tid: sb.tid,
                charName: sb.charName,
                blobSize: sb.blob.size
            })));
            
            if (this.sessionBlobs.length === 0) {
                console.log('No session blobs to transcribe');
                return;
            }
            
            // Enter transcription mode
            this.mode = 'transcription';
            this.transcriptionProgress = {
                current: 0,
                total: this.sessionBlobs.length
            };
            
            try {
                let data;
                
                if (this.devMode) {
                    // 🔧 DEV MODE: Use mock transcription
                    console.log('🔧 DEV MODE: Using mock transcription');
                    
                    // Simulate processing time
                    let progressInterval = setInterval(() => {
                        if (this.transcriptionProgress.current < this.transcriptionProgress.total) {
                            this.transcriptionProgress.current++;
                            console.log(`Progress: ${this.transcriptionProgress.current}/${this.transcriptionProgress.total}`);
                        }
                    }, 500); // Faster for dev
                    
                    // Simulate network delay
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    clearInterval(progressInterval);
                    
                    // Get mock response
                    data = this.mockTranscriptionResponse();
                    
                } else {
                    // 🎯 PRODUCTION MODE: Real backend API call
                    console.log('🎯 PRODUCTION MODE: Calling real backend');
                    
                    // Build FormData for backend
                    let fd = new FormData();
                    fd.append('cmd', 'batchTranscribe');
                    fd.append('storyId', story.id);
                    fd.append('sceneId', scene.id);
                    
                    // Add each blob with metadata
                    this.sessionBlobs.forEach((item, idx) => {
                        fd.append(`audio_${idx}`, item.blob);
                        fd.append(`tid_${idx}`, item.tid);
                        fd.append(`charName_${idx}`, item.charName);
                    });
                    fd.append('count', this.sessionBlobs.length);
                    
                    console.log('📤 Sending to backend:', {
                        cmd: 'batchTranscribe',
                        storyId: story.id,
                        sceneId: scene.id,
                        count: this.sessionBlobs.length
                    });
                    
                    // Realistic progress simulation: estimate ~3-5 seconds per segment
                    // Calculate estimated duration based on audio length
                    const avgSecondsPerSegment = 4; // Whisper typically takes 3-5 seconds per audio segment
                    const estimatedDuration = this.sessionBlobs.length * avgSecondsPerSegment * 1000; // in milliseconds
                    const updateInterval = 100; // Update every 100ms for smooth animation
                    const incrementsNeeded = Math.floor(estimatedDuration / updateInterval);
                    const incrementPerUpdate = this.transcriptionProgress.total / incrementsNeeded;
                    
                    let progressInterval = setInterval(() => {
                        if (this.transcriptionProgress.current < this.transcriptionProgress.total - 0.5) {
                            // Increment smoothly, but never quite reach 100% until backend actually completes
                            this.transcriptionProgress.current = Math.min(
                                this.transcriptionProgress.current + incrementPerUpdate,
                                this.transcriptionProgress.total - 0.5 // Stop at 99%
                            );
                        }
                    }, updateInterval);
                    
                    // Make API call
                    data = await Alpine.store('utils').apiReq(fd);
                    
                    // Stop the progress animation
                    clearInterval(progressInterval);
                    
                    // Set to 100% when actually complete
                    this.transcriptionProgress.current = this.transcriptionProgress.total;
                }
                
                if (data.error) { 
                    throw new Error(data.error); 
                }
                
                console.log('📥 Transcription response received:', data);
                
                // ✅ NOW write to scene.tracks with transcripts
                if (data.transcripts) {
                    data.transcripts.forEach((item, idx) => {
                        const sessionBlob = this.sessionBlobs[idx];
                        scene.tracks[item.tid] = {
                            name: sessionBlob.charName,
                            audio: sessionBlob.blob,
                            transcript: item.transcript || '[No speech detected]'
                        };
                        scene.trackOrder.push(item.tid);
                        
                        console.log(`✅ Track ${item.tid} transcribed:`, {
                            character: sessionBlob.charName,
                            transcript: item.transcript.substring(0, 50) + '...'
                        });
                    });
                }
                
                // ✅ Save story metadata (audio files were already saved during transcription)
                await Alpine.store('api').saveStory(story);
                console.log('✅ Story metadata saved');
                if (this.devMode) {
                    console.log('🔧 DEV MODE: Using mock transcripts, but audio files ARE saved');
                }
                
                // ✅ Clear session blobs
                this.sessionBlobs = [];
                console.log('✅ Session blobs cleared');
                
                // Recompile audio with transcribed tracks
                let tmp = await this.compileAudio(story, scene);
                scene.duration = tmp.duration;
                this.audioURL = tmp.audioURL || '';
                
                console.log('=== batchTranscribeScene COMPLETE ===');
            }
            catch (err) {
                Alpine.store('utils').showAlert('Transcription error: ' + err);
                console.error('❌ Batch transcription error:', err);
            }
            finally {
                // Return to setup mode
                this.mode = 'setup';
            }
        },

        async activateRecording (scene, visCanvas) {
            if (!mediaRecorder) { 
                await this.recorderInit(); 
                if (!mediaRecorder) { return; } 
            }
            if (mediaStream && ('active' in mediaStream) && (mediaStream.active == false)) { 
                confirm("Audio recorder error! Click OK to refresh.") && location.reload(); 
                return; 
            }
            if (this.loading) { 
                return Alpine.store('utils').showAlert('Scene loading in progress'); 
            }
            
            if (this.mode == 'setup') {
                // START RECORDING
                if (scene.duration >= this.sceneMax) { 
                    return Alpine.store('utils').showAlert('Maximum scene length reached.'); 
                }
                this.mode = 'active';
                this.startStopRecording(0, false); // auto start with ACTION
                this.timer = scene.duration || 0;	
                this.timerDisplay = this.time2ms(this.timer);
                timerIntervalID = setInterval(() => { this.trackTimer() }, 1000);
                this.visualizer(visCanvas);
            } else {
                // STOP RECORDING & START BATCH TRANSCRIPTION
                
                // ✅ FIX: Wait for mediaRecorder to finish stopping before transcribing
                if (mediaRecorder.state === 'recording') {
                    // Create a promise that resolves when recording stops and track is added
                    await new Promise((resolve) => {
                        const originalOnstop = mediaRecorder.onstop;
                        mediaRecorder.onstop = async (e) => {
                            // Call original handler (adds track)
                            await originalOnstop.call(this, e);
                            // Restore original handler
                            mediaRecorder.onstop = originalOnstop;
                            // Signal completion
                            resolve();
                        };
                        // Stop the recorder
                        this.startStopRecording(this.currnum, true);
                    });
                }
                
                clearInterval(timerIntervalID);
                
                // ✅ Now transcribe with ALL tracks including the last one
                await this.batchTranscribeScene(this.activeStory, this.activeScene);
            }
        },
        
        startStopRecording (n, theEnd) {
            if (this.loading) { 
                return Alpine.store('utils').showAlert('Scene loading in progress'); 
            }
            n = parseInt(n, 10);
            if (isNaN(n) || (n===null) || (n===undefined) || (n>9) || (n<0) || (this.mode == 'setup')) { 
                return; 
            }
            if (mediaRecorder.state == 'recording' && (this.currnum != n || theEnd)) {  
                this.prevnum = this.currnum; 
                this.currnum = undefined;  
                mediaRecorder.stop(); 
            }
            if (mediaRecorder.state == 'inactive' && !theEnd) { 
                this.currnum = n; 
                mediaRecorder.start(); 
            }
        },

        visualizer (canvas) {
            if (!canvas) {
                console.warn('Visualizer canvas not found');
                return;
            }
            
            let audioCtx = new AudioContext();
            const canvasCtx = canvas.getContext("2d");
            const source = audioCtx.createMediaStreamSource(mediaStream);
            const analyser = audioCtx.createAnalyser();  
            analyser.fftSize = 2048;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            
            const draw = () => {
                if (!(mediaRecorder.state == 'recording')) { return; }
                const WIDTH = canvas.width
                const HEIGHT = canvas.height;

                requestAnimationFrame(draw);
                analyser.getByteTimeDomainData(dataArray);

                canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);
                canvasCtx.lineWidth = 2;
                canvasCtx.strokeStyle = '#146c1d'; // Green waveform
                canvasCtx.beginPath();

                let sliceWidth = WIDTH * 1.0 / bufferLength;
                let x = 0;
                for (let i = 0; i < bufferLength; i++) {
                    let v = dataArray[i] / 128.0;
                    let y = v * HEIGHT/2;
                    if (i === 0) {
                        canvasCtx.moveTo(x, y);
                    } else {
                        canvasCtx.lineTo(x, y);
                    }
                    x += sliceWidth;
                }

                canvasCtx.lineTo(canvas.width, canvas.height/2);
                canvasCtx.stroke();
            };
            
            source.connect(analyser);
            draw();
        },

        checkStuff () {
            if (this.mode == 'active') { 
                return Alpine.store('utils').showAlert('Recording in progress'); 
            }
            if (this.mode == 'transcription') { 
                return Alpine.store('utils').showAlert('Transcription in progress'); 
            }
            if (this.transcribing) { 
                return Alpine.store('utils').showAlert('Transcription in progress'); 
            }
            if (this.loading) { 
                return Alpine.store('utils').showAlert('Scene loading in progress'); 
            }
            return true;
        },

        time2ms (time) {
            let sec_num = parseInt(time||0, 10);
            let minutes = Math.floor(sec_num / 60);
            let seconds = sec_num - (minutes * 60);
            if (minutes < 10) {minutes = "0"+minutes;}
            if (seconds < 10) {seconds = "0"+seconds;}
            return minutes + ':' + seconds;
        },

        time2hms (time) {
            let sec_num = parseInt(time||0, 10);
            let hours   = Math.floor(sec_num / 3600);
            let minutes = Math.floor((sec_num - (hours * 3600)) / 60);
            let seconds = sec_num - (hours * 3600) - (minutes * 60);
            if (hours   < 10) {hours   = "0"+hours;}
            if (minutes < 10) {minutes = "0"+minutes;}
            if (seconds < 10) {seconds = "0"+seconds;}
            return (hours!="00" ? (hours+':') : '') + minutes + ':' + seconds;
        },

        renameStory (story) {
            if (!this.checkStuff()) { return; }
            if (!story?.id) { return Alpine.store('utils').showAlert('Error: Invalid story.'); }
            
            // Show custom prompt modal
            this.showPromptModal(
                'Rename Story',
                'Enter new name:',
                story.name,
                async (newName) => {
                    if (!newName || !newName.trim()) {
                        return Alpine.store('utils').showAlert('Please enter a story name.');
                    }
                    story.name = newName.replace(/\n/g," ").trim();
                    await Alpine.store('api').saveStory(story);
                    
                    // Reload story list to show updated name
                    if (this.newOpen == 1) {
                        await this.loadStories();
                    }
                }
            );
        },

        sectionBeats (presetName, sectionIdx, storyLength) {
            let preset = Alpine.store('api').sectionPresets[presetName];
            if (sectionIdx == undefined || !storyLength || !preset.sections.length || !preset.sections[sectionIdx]) { 
                return "# - #"; 
            } 

            let st = Math.floor(preset.sections[sectionIdx].st * storyLength) + 1; 
            let en = Math.floor(preset.sections[sectionIdx].en * storyLength); 
            if (en < st && en < 100) { en++; }

            return st + " - " + en;
        },

        sectionDuration (story, sectionIdx) {
            let duration = 0;
            for (let scene of (story?.scenes || [])) { 
                if (scene.sectionIdx == sectionIdx && scene.duration) { 
                    duration += scene.duration; 
                } 
            }
            return duration;
        },

        storyDuration (story) {
            let duration = 0;
            for (let scene of (story?.scenes || [])) { 
                duration += scene.duration; 
            }
            return duration;
        },

        migratePreset (story, val) {
            console.log('migratePreset', val);
            if (!this.checkStuff()) { return false; }
            if (!story?.sections || !story.scenes) {  
                return Alpine.store('utils').showAlert('Invalid Story'); 
            }
            if ((story.sections.find(e => e.value) || story.scenes.length) && 
                !confirm("WARNING!\nSwitching story structure will alter your story outline.\nConsider making a backup copy first.")) { 
                return false;	
            }

            try {
                Alpine.store('api').migratePreset(story, val);
                story.sectionPreset = val;
                Alpine.store('api').saveStory(story);
            } 
            catch (err) { 
                return Alpine.store('utils').showAlert(err); 
            }
        },

        deleteScene (story, scene) {
            if (!this.checkStuff()) { return; }
            if (!story?.scenes) { return Alpine.store('utils').showAlert('Invalid story'); }

            let idx = story.scenes.findIndex(s => s.id == scene.id);
            if (idx == -1) { return Alpine.store('utils').showAlert('Invalid scene.'); }
            
            // Show custom confirmation modal
            this.showConfirmModal(
                'Delete Scene?',
                `Are you sure you want to delete "${scene.name}"? This cannot be undone.`,
                () => {
                    story.scenes.splice(idx, 1);
                    Alpine.store('api').saveStory(story);
                    Alpine.store('utils').showAlert('Scene deleted successfully', 2000, false, 'notice');
                }
            );
            
            return idx;
        },

        reorderScenes (story, i1, i2, emptySec) {
            console.log('reorderScenes', i1, i2, emptySec);
            if (!story?.scenes) { return Alpine.store('utils').showAlert('Invalid story'); }

            if (emptySec) {
                if (story.scenes.findIndex(e => e.sectionIdx == i2) != -1) { return; }
                story.scenes[i1].sectionIdx = i2;
                story.scenes[i1].lastModified = Date.now();
				let scene = story.scenes.splice(i1, 1)[0];
                let insIdx = story.scenes.findIndex((e,i) => e.sectionIdx > i2); 
                insIdx = (insIdx == -1) ? story.scenes.length : insIdx; 
                story.scenes.splice(insIdx, 0, scene);
            } else {
                story.scenes[i1].sectionIdx = story.scenes[i2].sectionIdx;
                story.scenes[i1].lastModified = Date.now();
				story.scenes.splice(i2, 0, story.scenes.splice(i1, 1)[0]);
            }

            Alpine.store('api').saveStory(story);
        },

        editScene (story, scene, field, value) {
            if (field == 'name') {
                value = value.toString();
                if (!value) { 
                    Alpine.store('utils').showAlert('Please enter a scene location'); 
                    return false; 
                }
                if (!value.match(/^(INT|EXT|I\/E)(\.| |-)/i)) { 
                    value = "EXT. " + value; 
                }
                scene.name = value.replace(/\n/g," ").trim().toUpperCase();
                scene.lastModified = Date.now();
                Alpine.store('api').saveStory(story);
            }
            if (field == 'desc') {
                value = value.toString();
                if (value.split(/\s/).length > 100) { 
                    Alpine.store('utils').showAlert('Scene notes should be less than 100 words.'); 
                }
                scene.desc = value;
                scene.lastModified = Date.now();
                Alpine.store('api').saveStory(story);
            }
        },

        // 📝 TRANSCRIPT EDITING: Edit character names and dialogue/action text
        editTrack(story, scene, tid, field, value) {
            console.log('📝 [editTrack] Editing track:', tid, 'field:', field, 'value:', value);
            
            if (!story?.id || !scene?.id || !tid) { 
                return Alpine.store('utils').showAlert('Error: Invalid track.'); 
            }
            if (!scene.tracks || !scene.tracks[tid]) { 
                return Alpine.store('utils').showAlert('Error: Invalid track.'); 
            }
            
            value = value?.toString().trim() || '';
            
            // Do NOT delete track if empty — avoids audio desync.
            // Empty values are saved as-is.
            
            if (field === 'name') {
                scene.tracks[tid].name = value ? value.toUpperCase() : 'NAME';
                console.log('✅ [editTrack] Updated character name to:', scene.tracks[tid].name);
            } else if (field === 'transcript') {
                scene.tracks[tid].transcript = value;
                console.log('✅ [editTrack] Updated transcript:', value.substring(0, 50));
            }
            
            scene.lastModified = Date.now();
            Alpine.store('api').saveStory(story);
        },

        // 🗑️ TRANSCRIPT EDITING: Delete a track (removes from tracks and trackOrder)
        deleteTrack(story, scene, tid) {
            console.log('🗑️ [deleteTrack] Deleting track:', tid);
            
            if (!scene.tracks || !scene.tracks[tid]) { 
                return; 
            }
            
            // Remove from tracks object
            delete scene.tracks[tid];
            
            // Remove from trackOrder array
            const orderIdx = scene.trackOrder.indexOf(tid);
            if (orderIdx > -1) {
                scene.trackOrder.splice(orderIdx, 1);
            }
            
            console.log('✅ [deleteTrack] Track deleted successfully');
            Alpine.store('api').saveStory(story);
        },

        allChars (story) {
            let chars = {};
            if (!story?.scenes) { return chars; }
            for (const scene of story.scenes) {
                for (const c of scene.chars) { 
                    if (c=='ACTION' || c.match(/^NAME-\d/)) { continue }		
                    chars[c] = (c in chars) ? (chars[c]+1) : 1;		
                }
            }
            return Object.keys(chars).sort();
        },

        setMinutes (story, n) {
            if (!story?.id) { return Alpine.store('utils').showAlert('Error: Invalid story.'); }
            if (!Number.isInteger(n) || n < 0) { 
                return Alpine.store('utils').showAlert('Invalid number of minutes.'); 
            }
            story.minutes = n;
            Alpine.store('api').saveStory(story);
        },

        setSceneChars (story, scene, chars) {
            console.log('setSceneChars', scene.name, chars);
            if (!this.checkStuff()) { return; }
            if (!story?.id) { return Alpine.store('utils').showAlert('Error: Invalid story.'); }
            if (!scene?.id) { return Alpine.store('utils').showAlert('Error: Invalid scene.'); }
            if (!chars?.length) { return; }
            scene.chars = JSON.parse(JSON.stringify(chars));
            scene.lastModified = Date.now();
            Alpine.store('api').saveStory(story);
            return true;
        },
        
        setCharName (story, scene, n, cn) {
            console.log('setCharName', scene.name, n, cn);
            if (!this.checkStuff()) { return; }
            if (!story?.id) { return Alpine.store('utils').showAlert('Error: Invalid story.'); }
            if (!scene?.id) { return Alpine.store('utils').showAlert('Error: Invalid scene.'); }
            if (n>0 && n<10 && cn && (typeof cn == 'string')) {
                if (cn.match(/^\s*$/)) { 
                    Alpine.store('utils').showAlert('Please enter a character name.'); 
                    return false; 
                }
                cn = cn.toUpperCase().trim();
                scene.chars[n] = cn;
                scene.lastModified = Date.now();
                Alpine.store('api').saveStory(story);
                return true;
            }
        },
        
        trackTimer () {
            if (this.mode == 'active' && this.timer >= this.sceneMax) { 
                this.activateRecording(this.activeScene, document.getElementById('viscanvas')); 
            }
            this.timer++;
            this.timerDisplay = this.time2ms(this.timer);
        },

        async downloadOutline(story) {
            console.log('📄 downloadOutline called with story:', story?.name, story?.id);
            
            if (!story?.id || !story?.sections) { 
                console.log('❌ Invalid story:', story);
                return Alpine.store('utils').showAlert('Error: Invalid story.'); 
            }
            
            let preset = Alpine.store('api').sectionPresets[story.sectionPreset];
            if (!preset?.sections) { 
                console.log('❌ Invalid preset:', story.sectionPreset);
                return Alpine.store('utils').showAlert('Error: Invalid story preset.'); 
            }

            // Generate outline content
            let outline = "";
            for (let i=0; i<story.sections.length; i++) {
                let sec = story.sections[i];
                outline += (preset.sections[i]?.act + "\n" + preset.sections[i]?.name + " - " + sec.value + "\n\n");
                for (const scene of story.scenes) {
                    if (scene.sectionIdx != i) { continue; }
                    outline += (scene.name + " - " + scene.desc + "\n\n");
                }
                outline += "\n\n";
            }
            
            if (outline.length == 0) { 
                console.log('❌ No outline content');
                return Alpine.store('utils').showAlert('No outline available.'); 
            }
            
            console.log('✅ Outline generated, length:', outline.length);
            
            // Create safe filename
            const filename = story.name.replace(/[^a-z0-9]/gi, '_') + '_Outline.txt';
            
            // ✅ FIX: Use showSaveDialog WITHOUT defaultPath (macOS bug workaround)
            try {
                if (typeof Neutralino !== 'undefined' && Neutralino.os && Neutralino.filesystem) {
                    console.log('📂 Calling Neutralino save dialog (without defaultPath - macOS workaround)');
                    
                    // Don't use defaultPath on macOS - it causes the dialog to fail!
                    const savePath = await Neutralino.os.showSaveDialog('Save Outline');
                    
                    console.log('📂 Save dialog returned:', savePath);
                    
                    if (savePath && savePath !== '') {
                        // User selected a path, but we need to ensure it has .txt extension
                        let finalPath = savePath;
                        if (!finalPath.toLowerCase().endsWith('.txt')) {
                            finalPath += '.txt';
                        }
                        
                        console.log('💾 Writing file to:', finalPath);
                        await Neutralino.filesystem.writeFile(finalPath, outline);
                        console.log('✅ File saved successfully!');
                        Alpine.store('utils').showAlert('Outline exported successfully!', 2000, false, 'notice');
                        return;
                    } else {
                        console.log('ℹ️ User cancelled save');
                        return;
                    }
                }
            } catch (err) {
                console.error('❌ Save error:', err);
                if (err.code && err.code !== 'NE_OS_DIACANC') {
                    Alpine.store('utils').showAlert('Error saving file: ' + (err.message || 'Unknown error'));
                }
            }
        },

        // Custom modal helpers (replace native confirm/prompt)
        showConfirmModal(title, message, onConfirm) {
            this.modal = {
                show: true,
                type: 'confirm',
                title: title,
                message: message,
                inputValue: '',
                onConfirm: onConfirm,
                onCancel: () => {
                    console.log('❌ User cancelled');
                    this.modal.show = false;
                }
            };
        },
        
        showPromptModal(title, message, defaultValue, onConfirm) {
            this.modal = {
                show: true,
                type: 'prompt',
                title: title,
                message: message,
                inputValue: defaultValue || '',
                onConfirm: onConfirm,
                onCancel: () => {
                    console.log('❌ User cancelled');
                    this.modal.show = false;
                }
            };
        },
        
        async confirmModal() {
            if (this.modal.onConfirm) {
                await this.modal.onConfirm(this.modal.inputValue);
            }
            this.modal.show = false;
        },
        
        cancelModal() {
            if (this.modal.onCancel) {
                this.modal.onCancel();
            }
            this.modal.show = false;
        },

        async downloadTranscript(story) {
            console.log('📝 downloadTranscript called with story:', story?.name, story?.id);
            
            if (!story?.id || !story?.scenes) { 
                console.log('❌ Invalid story:', story);
                return Alpine.store('utils').showAlert('Error: Invalid story.'); 
            }
            
            // Generate transcript content
            let transcript = "";
            for (const scene of story.scenes) {
                transcript += (scene.name) + "\n\n";
                for (const tid of scene.trackOrder) {
                    if (!scene.tracks[tid].transcript || 
                        scene.tracks[tid].transcript === 'Pending transcription') { 
                        continue; 
                    }
                    if (scene.tracks[tid].name == 'ACTION') {
                        transcript += "\n" + scene.tracks[tid].transcript + "\n\n";
                    } else {
                        transcript += scene.tracks[tid].name + "\n" + scene.tracks[tid].transcript + "\n\n";
                    }
                }
                transcript += "\n";
            }
            
            if (transcript.length == 0) { 
                console.log('❌ No transcript content');
                return Alpine.store('utils').showAlert('No transcript available.'); 
            }
            
            // Clean up extra newlines
            transcript = transcript.replace(/\n\n\n/g, "\n\n");
            
            console.log('✅ Transcript generated, length:', transcript.length);
            
            // Create safe filename
            const filename = story.name.replace(/[^a-z0-9]/gi, '_') + '_Transcript.txt';
            
            // ✅ FIX: Use showSaveDialog WITHOUT defaultPath (macOS bug workaround)
            try {
                if (typeof Neutralino !== 'undefined' && Neutralino.os && Neutralino.filesystem) {
                    console.log('📂 Calling Neutralino save dialog (without defaultPath - macOS workaround)');
                    
                    // Don't use defaultPath on macOS - it causes the dialog to fail!
                    const savePath = await Neutralino.os.showSaveDialog('Save Transcript');
                    
                    console.log('📂 Save dialog returned:', savePath);
                    
                    if (savePath && savePath !== '') {
                        // User selected a path, but we need to ensure it has .txt extension
                        let finalPath = savePath;
                        if (!finalPath.toLowerCase().endsWith('.txt')) {
                            finalPath += '.txt';
                        }
                        
                        console.log('💾 Writing file to:', finalPath);
                        await Neutralino.filesystem.writeFile(finalPath, transcript);
                        console.log('✅ File saved successfully!');
                        Alpine.store('utils').showAlert('Transcript exported successfully!', 2000, false, 'notice');
                        return;
                    } else {
                        console.log('ℹ️ User cancelled save');
                        return;
                    }
                }
            } catch (err) {
                console.error('❌ Save error:', err);
                if (err.code && err.code !== 'NE_OS_DIACANC') {
                    Alpine.store('utils').showAlert('Error saving file: ' + (err.message || 'Unknown error'));
                }
            }
        },

    }));

    console.log('🎨 ui component registered');

});
