// Generate unique IDs
export function genId(seed) {
	return (seed !== undefined ? seed + '-' : '') + Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Alpine utilities store
export function alpineUtils(apiUrl) {
	return {
		apiUrl: apiUrl,
		userInfo: { email: 'local-user' }, // No auth for desktop
		alertInfo: { show: false, msg: '', modal: false, type: '' },
		
		baseBtn: { 
			'px-4': 1, 'py-2': 1, 'rounded-md': 1, 'border': 1, 
			'border-gray-300': 1, 'bg-white': 1, 'text-sm': 1, 
			'font-medium': 1, 'text-gray-700': 1, 'hover:bg-gray-50': 1,
			'shadow': 1, 'outline-none': 1 
		},
		
		iconBtn: { 
			'flex': 1, 'items-center': 1, 'px-2': 1, 'py-1': 1, 
			'rounded': 1, 'hover:bg-slate-600': 1, 'cursor-pointer': 1 
		},
		
		iconClk: { 'h-6': 1, 'w-6': 1, 'cursor-pointer': 1 },
		
		menuPopup: { 
			'absolute': 1, 'z-10': 1, 'mt-2': 1, 'w-56': 1, 
			'rounded-md': 1, 'shadow-lg': 1, 'bg-white': 1, 
			'ring-1': 1, 'ring-black': 1, 'ring-opacity-5': 1 
		},
		
		menuItem: { 
			'block': 1, 'px-4': 1, 'py-2': 1, 'text-sm': 1, 
			'text-gray-700': 1, 'hover:bg-gray-100': 1, 
			'cursor-pointer': 1 
		},

		async apiReq(fd, rawResponse = false) {
			try {
				let response = await fetch(this.apiUrl, {
					method: 'POST',
					body: fd
				});
				
				if (!response.ok) {
					throw new Error(`API request failed: ${response.status}`);
				}
				
				if (rawResponse) {
					return response;
				}
				
				let data = await response.json();
				return data;
			} catch (err) {
				console.error('API Request Error:', err);
				throw err;
			}
		},

		showAlert(msg, timeout, modal, type) {
			if (!msg) {
				this.alertInfo = { show: false, msg: '', modal: false, type: '' };
				return;
			}
			
			this.alertInfo = {
				show: true,
				msg: msg,
				modal: modal || false,
				type: type || 'warning'
			};
			
			if (!modal && timeout !== null) {
				setTimeout(() => {
					this.alertInfo.show = false;
				}, timeout || 3000);
			}
		},

		checkVersion() {
			console.log('Desktop version - no version check needed');
		},

		transUsage(usage) {
			// Desktop version - no usage tracking
			console.log('Transcription usage:', usage);
		},

		logout() {
			// Desktop version - no logout needed
			window.location.replace('index.html');
		}
	};
}

// Custom web components
export function customElems() {
	// App Header Component
	Alpine.data('appHeader', () => ({
		template: `
			<div class="bg-[#FFD905] text-[#1b170e] px-4 py-2 flex justify-between items-center">
				<div class="text-2xl font-bold">Bespoke Writing Suite</div>
			</div>
		`
	}));

	// Story Dashboard Component  
	Alpine.data('storyDash', () => ({
		template: `
			<div class="m-3">
				<div class="text-3xl mb-3">Start a New Story</div>
				<story-new></story-new>
				<div class="h-16"></div>
				<div class="text-3xl mb-3">Your Stories</div>
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
					<template x-for="story in storyList" :key="story.id">
						<a :href="'index.html?sid='+story.id">
							<div class="relative p-5 rounded-xl border border-transparent bg-slate-500 hover:bg-transparent hover:border-[#FFCC33]">
								<div class="text-lg font-bold" x-text="story.name"></div>
								<div class="h-10"></div>
								<div class="flex justify-between text-sm">
									<div class="italic" x-text="story.sectionPreset"></div>
									<div x-text="'Transcribed '+ time2ms(storyDuration(story)) +' of '+ story.minutes +' minutes'"></div>
								</div>
							</div>
						</a>
					</template>
				</div>
			</div>
		`
	}));

	// Story New Component
	Alpine.data('storyNew', () => ({
		name: '',
		preset: 'Save the Cat',
		minutes: 90,
		
		create() {
			if (!this.name.trim()) {
				Alpine.store('utils').showAlert('Please enter a story name');
				return;
			}
			this.newOpenStory(this.name, null, this.preset, this.minutes);
		}
	}));
}
// Alpine API Store - Story Structure Presets and API Functions
// This should be initialized in main.js with: Alpine.store('api', apiStore())
export const apiStore = {
	sectionPresets: {
		"Free Form" : { desc:"No guide. Write by the seat of your pants!", sections:[
			{ name: 'Logline', act:"", st:0, en:1, desc:'A brief (usually one-sentence) summary that states the central conflict of the story and an emotional hook to stimulate interest.' },
		]},
		"Four Act" : { desc:"Aristotle's classic story structure. The setup, the rise / fall, and the resolution.", sections: [
			{ name: 'Act 1: Stasis', act:"Act 1", st:0, en:.25, desc:'Act 1. The Introduction / story setup' },
			{ name: 'Act 2: Thesis', act:"Act 2", st:.25, en:.50, desc:'Act 2. The rising action / the stakes get higher' },
			{ name: 'Act 3: Antithesis', act:"Act 3", st:.50, en:.75, desc:'Act 3. The crisis / falling action'	},
			{ name: 'Act 4: Synthesis', act:"Act 4", st:.75, en:1, desc:'Act 4. The climax, the resolution'	},
		]},
		"Five Act TV" : { desc:"Most TV has 5 acts. Some shows contain a teaser & tag which can go in the 1st and 5th acts.", sections: [
			{ name: 'Act 1: Big start / Exposition', act:"Act 1", st:0, en:.11, desc:'Introduce the main characters and backstory. Presents the central dilemma through an "exciting force" or "inciting incident." Setoff A and maybe B stories. Act ends with a "wow" moment that turns the story.' },
			{ name: 'Act 2: Rising action, conflicts appear', act:"Act 2", st:.11, en:.37, desc:'Things escalate. The conflict begins to increase as the characters try to achieve their goals. Expand the world, meet more people, the different trajectories build your narrative toward the climax. C story has three scenes total.' },
			{ name: 'Act 3: The center, things get real bad, climax', act:"Act 3", st:.37, en:.59, desc:'The third act contains the worst or most exciting beat, the moment where the tension reaches its peak. Features a turning point - not the culmination of action. At the midpoint, a change ushers in the counterplay.'	},
			{ name: 'Act 4: Falling action, crush, everything\'s downhill', act:"Act 4", st:.59, en:.75, desc:'Story turns in a different direction, new evidence, or a big character revelation. A ticking clock triggers a series of events that build suspense and anxiety about how the story will unfold. B story has one scene per act.'	},
			{ name: 'Act 5: Resolution / Tag', act:"Act 5", st:.75, en:1, desc:'A moment of victory, the big reveal, ties up loose ends, brings the narrative to a close. Introduce a cliffhanger for the next episode.'	},
		]},
		"Eight Sequences" : { desc:"Frank Daniel divides a story into 8 sequences that generate cliffhangers and twists.", sections: [
			{ name: "Status Quo & Inciting Incident", act:"Act 1", st:0, en:.12, desc:"Establishes the central character, their life, and the status quo and the world of the story. Sequence one usually ends with the POINT OF ATTACK or INCITING INCIDENT, but this plot point can sometimes appear earlier in the first few minutes of the film."	},
			{ name: "Predicament & Lock In", act:"Act 1", st:.12, en:.25, desc:"Sets up the PREDICAMENT that will be central to the story, with first glimpses of possible obstacles. The main tension is established at the end of the act. The sequence ends when the main character is LOCKED IN the predicament, propelling her into a new direction to obtain her goal."	},
			{ name: "First Obstacle & Raising the Stakes", act:"Act 2", st:.25, en:.37, desc:"The FIRST OBSTACLE to the central character is faced, and the beginning of the elimination of the alternatives begins, often a time where EXPOSITION left over from ACT I is brought out. Since our character is locked into the situation and can't simply walk away, there is a RAISING OF THE STAKES with a lot more to lose." },
			{ name: "First Culmination & Midpoint", act:"Act 2", st:.37, en:.50, desc:"A higher OBSTACLE, the principle of RISING ACTION is brought in and builds to the FIRST CULMINATION, which usually parallels the RESOLUTION of the film. If the story is a tragedy and our hero dies, then the first culmination (or midpoint) should be a low point for our character. If, however, our hero wins in the end of the film, then sequence four should end with her winning in some way." },
			{ name: "Subplot & Rising Action", act:"Act 3", st:.50, en:.62, desc:"The second act sag may set in at this point if we don't have a strong SUBPLOT to take the ball for a while. We still want RISING ACTION, but we're not ready for the MAIN CULMINATION yet."	},
			{ name: "Main Culmination & End of Act Two", act:"Act 3", st:.62, en:.75, desc:"The build-up to the MAIN CULMINATION - back to the main story line with a vengeance. The highest obstacle, the last alternative, the highest or lowest moment and the end of our main tension come at this point. But we get the first inklings of the new tension that will carry us through the third act."	},
			{ name: "New Tension & Twist", act:"Act 4", st:.75, en:.87, desc:"The full yet simple, brief establishment of the third act tension with its requisite exposition. Simpler, faster in nearly all ways, with rapid, short scenes and no real elaborate set-ups. The TWIST can end this sequence or come at the start of the eighth sequence." },
			{ name: "Resolution", act:"Act 4", st:.87, en:1, desc:"Hell-bent for the RESOLUTION. Clarity is important. If they turn left, all is well, if they go right, the world as we know it ends. Not that we don't have complex emotions or ideas about what it all amounts to, but at this point we crave clarity. Will she get the girl, defuse the bomb, turn in her murderous brother and escape from the sinking boat surrounded by sharks?" },
		]},
		"Save the Cat" : { desc:"Blake Snyder's Hollywood method defines the key plot points and when they occur.", sections: [
			{ name: 'Opening Image', act:"Act 1", st:0, en:.01, desc:"In one moment, we set the tone, mood, style, and scope of the story. It's a 'before' snapshot of the hero's world." },
			{ name: 'Theme Stated', act:"Act 1", st:.01, en:.03, desc:"A moment when a secondary character may pose a question or statement that is the theme of the story, or a location might suggest the theme." },
			{ name: 'Set Up', act:"Act 1", st:.03, en:.10, desc:"Introduce your hero and key characters in your story. Show character flaws that need fixing. It might show the hero's weakness and need to change. You might also set up the stakes and goal." },
			{ name: 'Catalyst', act:"Act 1", st:.10, en:.11, desc:"A single life-changing event, a Call to Adventure makes the main character realize that Stasis = Death. " },
			{ name: 'Debate', act:"Act 1", st:.11, en:.21, desc:"This is where the hero reacts to the change that occurs. Should she follow the path this change leads to? The character makes a choice." },
			{ name: 'Break into Act II', act:"Act 2", st:.21, en:.22, desc:"A moment when the hero leaves the old world behind and chooses something new. A strong, definite change as the story proper begins." },
			{ name: 'B Story Introduction', act:"Act 2", st:.22, en:.23, desc:"Sometimes the love story or introducing new characters. This beat gives us a break from the tension of the main story; it is a subplot to carry the theme of the story." },
			{ name: 'Fun and Games', act:"Act 2", st:.23, en:.49, desc:"The heart of the story, promise of the premise, trailer moments. The stakes are not too high yet, the hero is exploring the new world of act 2." },
			{ name: 'Midpoint', act:"Act 3", st:.49, en:.50, desc:"The momentary threshold between the first half and the second half of the story; the stakes are raised; the fun and games are over. It's sometimes a false success, or more often something goes badly wrong." },
			{ name: 'Bad Guy Closes In', act:"Act 3", st:.50, en:.67, desc:"This section of the story is where the hero is really tested, the knife is twisted. Now a different challenge must be overcome. Perhaps the bad guys regroup and attack; or the hero's team begins to unravel." },
			{ name: 'All is Lost', act:"Act 3", st:.67, en:.68, desc:"A moment that puts your hero at her lowest point, she is beaten, the hero's life is in shambles. Blake talks of a 'whiff of death' at this point in a story, sometimes the mentor dies, perhaps symbolically. The old way of thinking dies. The hero may give up or run away, there seems no hope." },
			{ name: 'Dark Night of the Soul', act:"Act 3", st:.68, en:.76, desc:"The hero ruminates in the darkness before the dawn. Hero figures out the answer sometimes with insight from the B Story. She will pull out the last, best idea that will save herself and everyone around her." },
			{ name: 'Break into Act III', act:"Act 4", st:.76, en:.77, desc:"The hero has dug deep, learned, changed, and found the solution. The stories carried by the theme and sub plot intertwine with the main plot. The hero has an idea to solve the problem and the end is in sight." },
			{ name: 'Finale', act:"Act 4", st:.77, en:.99, desc:"The final act is where the hero triumphs and a new world order is revealed. The bad guys are dispatched, the problem is fixed." },
			{ name: 'Final Image', act:"Act 4", st:.99, en:1, desc:"The closing scene should be the opposite of the opening scene; it is the proof that change has occurred and is real." },
		]},
		"Story Circle" : { desc:"Dan Harmon's hero's journey structure for sitcoms and 'there-and-back-again' stories.", sections: [
			{ name: "You", act:"Act 1", st:0, en:.12, desc:"A character is in a zone of comfort."	},
			{ name: "Need", act:"Act 1", st:.12, en:.25, desc:"But they want something."	},
			{ name: "Go", act:"Act 2", st:.25, en:.37, desc:"They enter an unfamiliar situation." },
			{ name: "Search", act:"Act 2", st:.37, en:.50, desc:"Adapt to it." },
			{ name: "Find", act:"Act 3", st:.50, en:.62, desc:"Get what they wanted."	},
			{ name: "Take", act:"Act 3", st:.62, en:.75, desc:"Pay a heavy price for it."	},
			{ name: "Return", act:"Act 4", st:.75, en:.87, desc:"Then return to their familiar situation." },
			{ name: "Change", act:"Act 4", st:.87, en:1, desc:"Having changed." },
		]},
		"9Cs" : { desc:"Screenwriter & playwright Ed Horowitz has taught his 9Cs at UCLA, USC, Chapman, and other film schools in California.", sections: [
			{ name: "Character", act:"Act 1", st:0, en:.10, desc:"Establish your main character (MC) in their Normal World which in some way embodies the thematic opposite of their eventual triumph." },
			{ name: "Catalyst", act:"Act 1", st:.11, en:.13, desc:"The incident that creates the problem that sets the story in motion. The MC rejects the opportunity or denies the problem at first." },
			{ name: "Clear Want", act:"Act 1", st:.14, en:.25, desc:"MC shifts between their initial want of the Normal World and a New Want created by the Catalyst. Establish the defining motivation and objective that drives plot to the end." },
			{ name: "Conflict", act:"Act 2", st:.26, en:.48, desc:"This includes the Antagonist and other obstacles and challenges your main character will face." },
			{ name: "Consciousness", act:"Act 2", st:.49, en:.52, desc:"The midpoint MOMENT in which your MC has an epiphany about their predicament that enables them to take more focused and directed action." },
			{ name: "Collision", act:"Act 3", st:.53, en:.70, desc:"In Act 3 the MC's actions reach their goal and force the antagonist to respond in kind. As their wants collide, the stakes and tension rise." },
			{ name: "Crisis", act:"Act 3", st:.71, en:.75, desc:"The MOMENT when the MC thinks they are the furthest from achieving their goal; they think they have failed." },
			{ name: "Climax", act:"Act 4", st:.76, en:.97, desc:"The final conflict between MC and the antagonist in which the MC's action embodies the values of your theme and becomes the character's defining moment." },
			{ name: "Change", act:"Act 4", st:.98, en:1, desc:"This demonstrates what has changed in the world of your story from beginning to end. Either the MC has changed or the world around them has changed, or both." },
		]},
	},

	migrationMap: {
		"Free Form" : {
			"Four Act": [0],
			"Five Act TV" : [0],
			"Eight Sequences" : [0],
			"Save the Cat" : [0],
			"Story Circle" : [0],
			"9Cs": [0],
		},
		"Four Act" : {
			"Free Form":     [0,0,0,0],
			"Five Act TV" :  [0,1,2,4],
			"Eight Sequences" : [0,2,4,6],
			"Save the Cat" : [0,2,4,6],
			"Story Circle"   : [0,2,4,6],
			"9Cs": [0, 3, 5, 7],
		},
		"Five Act TV" : {
			"Free Form":     [0,0,0,0,0],
			"Four Act" :    [0,1,1,2,3],
			"Eight Sequences" : [0,1,3,4,6],
			"Save the Cat" : [0,1,3,4,6],
			"Story Circle"   : [0,1,3,4,6],
			"9Cs": [0, 2, 4, 6, 7],
		},
		"Eight Sequences" : {
			"Free Form":      [0,0,0,0,0,0, 0, 0],
			"Four Act" :     [0,0,1,1,2,2, 3, 3],
			"Five Act TV" :   [0,0,1,2,2,2, 3, 4],
			"Save the Cat" :  [2,4,6,7,9,11,13,14],
			"Story Circle"   :  [0,1,2,3,4,5, 6, 7],
			"9Cs": [0, 2, 3, 3, 5, 6, 7, 8],
		},
		"Save the Cat" : {
			"Free Form":      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
			"Four Act" :     [0,0,0,0,0,1,1,1,2,2,2,2,3,3,3],
			"Five Act TV" :   [0,0,0,0,1,1,1,2,2,2,3,3,3,4,4],
			"Eight Sequences" :  [0,0,0,1,1,1,2,3,4,4,5,5,6,6,7],
			"Story Circle"   :  [0,0,0,1,1,1,2,3,4,4,5,5,6,6,7],
			"9Cs": [0, 0, 0, 1, 2, 2, 3, 3, 4, 5, 6, 6, 7, 7, 8],
		},
		"Story Circle" :   {
			"Free Form":      [0,0,0,0,0,0, 0, 0],
			"Four Act" :     [0,0,1,1,2,2, 3, 3],
			"Five Act TV" :   [0,0,1,2,2,2, 3, 4],
			"Eight Sequences" :  [0,1,2,3,4,5, 6, 7],
			"Save the Cat" :  [2,4,6,7,9,11,13,14],
			"9Cs": [0, 1, 3, 4, 5, 6, 7, 8],
		},
		"9Cs" : {  // FROM 9Cs TO other structures (9 entries each)
			"Free Form":         [0, 0, 0, 0, 0, 0, 0, 0, 0],
			"Four Act" :         [0, 0, 0, 1, 1, 2, 2, 3, 3],
			"Five Act TV" :      [0, 1, 1, 2, 2, 3, 3, 4, 4],
			"Eight Sequences":   [0, 0, 1, 2, 3, 4, 5, 6, 7],
			"Save the Cat" :     [0, 3, 4, 7, 8, 9, 10, 13, 14],
			"Story Circle" :     [0, 1, 2, 3, 4, 5, 6, 6, 7],
		},
	},
	
	defaultScene(sectionIdx) {
		return { 
			id: genId(), 
			sectionIdx: sectionIdx||0, 
			name: 'EXT. LOCATION', 
			desc: '', 
			tracks: {}, 
			trackOrder: [], 
			duration: 0, 
			chars: ["ACTION", "NAME-1", "NAME-2", "NAME-3", "NAME-4", "NAME-5", "NAME-6", "NAME-7", "NAME-8", "NAME-9"],
			lastModified: Date.now()
		};
	},

	defaultStory(name, sys, min) {
		sys = (sys in this.sectionPresets) ? sys : 'Free Form';
		min = parseInt(min||0, 10); 
		min = min > 0 ? min : 90; 
		let sections = this.sectionPresets[sys].sections.map((e,i) => ({id:genId(i), value:""}));
		return { 
			id: genId(), 
			name: ((name ?? '').toString().trim() || 'My First Story'), 
			sectionPreset: sys, 
			minutes: min, 
			sections: sections, 
			scenes: [], 
			updated: "" 
		};
	},

	newStory(name, system, minutes) {
		name = (name ?? '').toString().trim();
		console.log('newStory', name, system, minutes);
		if (!name) { throw 'Invalid story name'; }
		if (!system) { throw 'Please select a Story Structure'; }
		let story = this.defaultStory(name, system, minutes);
		return story;
	},

	addScene(story, sectionIdx, insIdx, chars) {
		console.log('API addScene', story, sectionIdx, chars);
		if (!story.scenes) { throw 'Invalid story'; }
		insIdx = insIdx || story.scenes.findIndex((e,i) => e.sectionIdx > sectionIdx); 
		insIdx = (insIdx < 0) ? story.scenes.length : insIdx;
		let scene = this.defaultScene(sectionIdx), hi = 0;

		if (chars.length) { scene.chars = JSON.parse(JSON.stringify(chars)); } 
		for (const s of story.scenes) { 
			let n = s.name.match(/LOCATION-(\d+)$/); 
			n = (n && n.length) ? parseInt(n[1],10) : 0;	  
			if (n > hi) { hi = n; }		
		}
		scene.name += ('-' + (hi+1));			

		story.scenes.splice(insIdx, 0, scene);
		
		return scene;
	},		
	
	migratePreset(story, newPreset) {
		console.log('migratePreset', story.sectionPreset, ' > ', newPreset);
		if (!(newPreset in this.sectionPresets) || !(newPreset in this.migrationMap)) { 
			throw('Invalid Preset'); 
		}
		if (!(story.sectionPreset in this.migrationMap)) { 
			throw('Error setting up migration'); 
		}

		let newsecs = this.sectionPresets[newPreset].sections.map((e,i) => ({id:genId(i), value:""}));

		for (let i=0; i<story.sections.length; i++) {
			let i2 = this.migrationMap[story.sectionPreset][newPreset][i];
			let os = story.sections[i], ns = newsecs[i2];
			ns.value = (ns.value + (ns.value ? "\n" : "") + os.value).trim();
		}
		story.sections = newsecs;

		for (let s of story.scenes) {
			s.sectionIdx = this.migrationMap[story.sectionPreset][newPreset][s.sectionIdx];
		}
	},

	async saveStory(story, tid, blob) {
		if (!story?.id || !story?.name) { throw 'Invalid story'; }
		console.log('saveStory ST', story.name);

		let fd = new FormData(); 
		fd.append('cmd', 'saveStory'); 
		fd.append('story', JSON.stringify(story)); 
		
		if (tid && blob) {
			fd.append('tid', tid);
			fd.append('audio', blob);
		}
		
		let rcd = await Alpine.store('utils').apiReq(fd);
		if (rcd.error) { 
			throw rcd.error;
		}

		// Update timestamp from backend response or use current time
		story.updated = rcd.updated || (Date.now() / 1000); // Backend uses seconds, convert
		console.log('🔄 Story updated timestamp:', new Date(story.updated * 1000).toLocaleString());
		return story;
	},

	async deleteStory(story) {
		console.log('📚 API deleteStory called with story:', story);
		
		if (!story?.id) { 
			console.log('❌ API deleteStory: No story ID');
			throw 'Invalid Story - Deletion Failed'; 
		}
		
		let storyID = story.id;
		console.log('📚 deleteStory START', storyID);

		let fd = new FormData(); 
		fd.append('cmd', 'deleteStory'); 
		fd.append('id', storyID);
		
		console.log('📤 Sending FormData to API:', {
			cmd: 'deleteStory',
			id: storyID
		});
		
		let result = await Alpine.store('utils').apiReq(fd);
		console.log('📥 API response:', result);
		console.log('📚 deleteStory END', storyID);
		
		return result;
	},

	async getStory(id) {
		console.log('getStory', id);
		let fd = new FormData(); 
		fd.append('cmd', 'getStory'); 
		fd.append('id', id); 
		let story = await Alpine.store('utils').apiReq(fd);
		if (!story?.id) { throw('No story found.'); }
		return story;
	},
};