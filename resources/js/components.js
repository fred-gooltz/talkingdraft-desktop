<!-- Web Components for Bespoke App -->
<!-- These get loaded at the bottom of index.html -->

<template id="app-header">
	<div class="bg-[#FFD905] text-[#1b170e] px-4 py-2 flex justify-between items-center">
		<div class="text-2xl font-bold">Bespoke Writing Suite</div>
	</div>
</template>

<template id="story-dash">
	<div class="m-3" x-init="loadStories()">
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
							<div x-text="'Transcribed '+ time2ms(storyDuration(story)) +' of '+ story.minutes +' min'"></div>
						</div>
					</div>
				</a>
			</template>
		</div>
	</div>
</template>

<template id="story-new">
	<div class="p-4 bg-slate-600 rounded-lg" x-data="{name:'', preset:'Save the Cat', minutes:90}">
		<input type="text" x-model="name" placeholder="Story Name" class="w-full p-2 mb-2 rounded border text-gray-900"/>
		<select x-model="preset" class="w-full p-2 mb-2 rounded border text-gray-900">
			<option>Free Form</option>
			<option>Four Act</option>
			<option>Five Act TV</option>
			<option>Eight Sequences</option>
			<option>Save the Cat</option>
			<option>Story Circle</option>
		</select>
		<input type="number" x-model.number="minutes" placeholder="Minutes" class="w-full p-2 mb-2 rounded border text-gray-900"/>
		<button @click="newOpenStory(name, null, preset, minutes)" :class="$store.utils.baseBtn" class="w-full">Create Story</button>
	</div>
</template>

<template id="story-nav">
	<div class="relative z-10" x-data="{ open:false }" @click.stop="!open && loadStories(); open=!open" @keydown.escape.stop="open = false;" @click.outside="open=false">
		<div class="flex items-center cursor-pointer">
			<span x-text="activeStory.name" class="text-3xl hover:text-gray-500"></span>
		</div>
		<div x-show="open" class="origin-top-left absolute left-0 mt-0 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5" role="menu">
			<div class="py-1">
				<span :class="$store.utils.menuItem" @click="newOpen=2">New Story</span>
				<span :class="$store.utils.menuItem" @click="copyStory(activeStory)">Copy Story</span>
				<span :class="$store.utils.menuItem" @click="renameStory(activeStory)">Rename Story</span>
				<span :class="$store.utils.menuItem" @click="deleteStory(activeStory)">Delete Story</span>
			</div>
			<div class="py-1 border-t" x-show="storyList.length">
				<span class="px-4 py-2 text-sm text-gray-400">Your Stories</span>
				<template x-for="story in storyList" :key="story.id">
					<a x-text="story.name" :class="$store.utils.menuItem" :href="'index.html?sid='+story.id"></a>
				</template>
			</div>
		</div>
	</div>
</template>

<template id="system-nav">
	<div class="whitespace-nowrap text-sm">
		<span>Structure</span>
		<select class="p-1 mr-3 rounded text-gray-900" :value="activeStory.sectionPreset" @change="migratePreset(activeStory, $el.value)">
			<option>Free Form</option>
			<option>Four Act</option>
			<option>Five Act TV</option>
			<option>Eight Sequences</option>
			<option>Save the Cat</option>
			<option>Story Circle</option>
		</select>
		<span x-text="time2ms(storyDuration(activeStory))+ ' of'"></span>
		<input type="number" class="p-1 rounded text-gray-900 w-12" @change="setMinutes(activeStory, parseInt($el.value,10))" :value="activeStory?.minutes"/>
	</div>
</template>

<template id="story-sections">
	<div class="w-full pt-3 px-3 pb-2 flex flex-col">
		<template x-for="(section, idx) of activeStory.sections" :key="section?.id">
			<div class="group relative w-full pr-4 pt-6 pb-6 mb-10 rounded-xl border hover:border-[#8694A0] border-slate-500">
				<div class="absolute inset-x-0 top-0 flex justify-center">
					<div class="px-2 rounded-b text-white text-sm bg-slate-500 group-hover:bg-[#8694A0]">
						<span x-text="$store.api.sectionPresets?.[activeStory.sectionPreset]?.sections?.[idx]?.name"></span>
					</div>
				</div>
				<div class="flex items-stretch pl-4">
					<textarea x-model="section.value" class="w-full p-1 text-sm bg-transparent rounded border border-slate-500/0 hover:border-slate-500/50" @change="Alpine.store('api').saveStory(activeStory)"></textarea>
				</div>
				<div class="flex items-center justify-between mt-3">
					<button :class="$store.utils.iconBtn" @click="addScene(activeStory, idx, null, [])">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="#FFD905">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
						</svg>
						<span class="ml-1 text-xs font-bold">Add Scene</span>
					</button>
					<div class="px-2 py-1 rounded-lg bg-slate-500 text-sm" x-text="sectionBeats(activeStory.sectionPreset, idx, activeStory.minutes)"></div>
				</div>
			</div>
		</template>
	</div>
</template>

<script>
// Register web components
document.addEventListener('alpine:init', () => {
	// Simple component registration
	window.customElements.define('app-header', class extends HTMLElement {
		connectedCallback() {
			const template = document.getElementById('app-header');
			this.appendChild(template.content.cloneNode(true));
		}
	});
	
	window.customElements.define('story-dash', class extends HTMLElement {
		connectedCallback() {
			const template = document.getElementById('story-dash');
			this.appendChild(template.content.cloneNode(true));
		}
	});
	
	window.customElements.define('story-new', class extends HTMLElement {
		connectedCallback() {
			const template = document.getElementById('story-new');
			this.appendChild(template.content.cloneNode(true));
		}
	});
	
	window.customElements.define('story-nav', class extends HTMLElement {
		connectedCallback() {
			const template = document.getElementById('story-nav');
			this.appendChild(template.content.cloneNode(true));
		}
	});
	
	window.customElements.define('system-nav', class extends HTMLElement {
		connectedCallback() {
			const template = document.getElementById('system-nav');
			this.appendChild(template.content.cloneNode(true));
		}
	});
	
	window.customElements.define('story-sections', class extends HTMLElement {
		connectedCallback() {
			const template = document.getElementById('story-sections');
			this.appendChild(template.content.cloneNode(true));
		}
	});
});
</script>
