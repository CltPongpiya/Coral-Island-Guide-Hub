'use strict';

(function () {
	const JSON_PATH = './coral_island_fish_cache.json';

	/** @type {Array<any>} */
	let allItems = [];
	/** @type {Array<any>} */
	let currentItems = [];

	// Elements
	const fishTbodyEl = document.getElementById('fishTbody');
	const emptyStateEl = document.getElementById('emptyState');
	const totalCountEl = document.getElementById('totalCount');

	// Filters
	const seasonSelectEl = document.getElementById('seasonSelect');
	const weatherSelectEl = document.getElementById('weatherSelect');
	const areaSelectEl = document.getElementById('areaSelect');
	const applyFiltersBtn = document.getElementById('applyFiltersBtn');
	const resetFiltersBtn = document.getElementById('resetFiltersBtn');
	const priceSortBtn = document.getElementById('priceSortBtn');
	const priceSortIcon = document.getElementById('priceSortIcon');
	const raritySortBtn = document.getElementById('raritySortBtn');
	const raritySortIcon = document.getElementById('raritySortIcon');

	// sort state: null | 'asc' | 'desc'
	let priceSortDir = 'desc';   // เริ่มต้นราคาแพงสุดก่อน
	let raritySortDir = 'desc';  // เริ่มต้นความหายากสูงสุดก่อน
	const rarityRank = { Legendary: 4, Rare: 3, Uncommon: 2, Common: 1 };

	function uniqueStrings(arrays) {
		const set = new Set();
		arrays.forEach((a) => Array.isArray(a) && a.forEach((v) => set.add(v)));
		return Array.from(set);
	}

	function coerceNumber(value) {
		const n = Number(value);
		return Number.isFinite(n) ? n : undefined;
	}

	async function loadData() {
		try {
			const res = await fetch(JSON_PATH, { cache: 'no-store' });
			if (!res.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ');
			const data = await res.json();
			const rawItems = Array.isArray(data?.items) ? data.items : [];
			// รองรับทั้งโครงสร้างเดิม, { season: string, data: {...} } และ { season: string, data: [...]} 
			const items = rawItems.flatMap((entry) => {
				if (!entry) return [];
				// รูปแบบใหม่: season เป็นสตริง และ data เป็นอาร์เรย์ของปลา
				if (typeof entry.season === 'string' && Array.isArray(entry.data)) {
					return entry.data.map((fish) => {
						const normalized = Object.assign({}, fish);
						normalized.season = [entry.season];
						return normalized;
					});
				}
				// รูปแบบก่อนหน้า: season เป็นสตริง และ data เป็นอ็อบเจ็กต์เดียว
				if (typeof entry.season === 'string' && entry.data && typeof entry.data === 'object') {
					const normalized = Object.assign({}, entry.data);
					normalized.season = [entry.season];
					return [normalized];
				}
				// โครงสร้างแบนเดิม
				return [entry];
			});
			allItems = items;
			currentItems = items.slice();
			populateDynamicFilterOptions(items);
			// ใช้ applyFilters เพื่อให้เกิดการตัดซ้ำอัตโนมัติเมื่อ season = "ทั้งหมด"
			applyFilters();
		} catch (err) {
			console.error(err);
			showLoadError();
		}
	}

	function showLoadError() {
		fishTbodyEl.innerHTML = '';
		emptyStateEl.hidden = true;
		totalCountEl.textContent = '0';
		const wrapper = document.querySelector('.table-wrapper');
		if (wrapper) {
			wrapper.insertAdjacentHTML('beforeend', [
				'<div class="error">',
				'ไม่สามารถโหลดข้อมูลจาก coral_island_fish_cache.json',
				'<br>โปรดเปิดผ่านเซิร์ฟเวอร์ท้องถิ่น เช่น',
				'<code>python -m http.server</code> แล้วเปิด <code>http://localhost:8000</code>',
				'</div>'
			].join(''));
		}
	}

	function populateDynamicFilterOptions(items) {
		// เสริมออปชันให้กับ select ที่เป็น multiple หากพบค่าที่ไม่มีในรายการ
		function ensureOptions(selectEl, values) {
			if (!selectEl || !Array.isArray(values)) return;
			const existing = new Set(Array.from(selectEl.options).map((o) => o.value));
			values.forEach((v) => {
				if (!existing.has(String(v))) {
					const opt = document.createElement('option');
					opt.textContent = String(v);
					opt.value = String(v);
					selectEl.appendChild(opt);
				}
			});
		}

		ensureOptions(seasonSelectEl, uniqueStrings(items.map((i) => i.season)));
		ensureOptions(weatherSelectEl, uniqueStrings(items.map((i) => i.weather)));
		ensureOptions(areaSelectEl, uniqueStrings(items.map((i) => i.area)));
	}

	function render() {
		const items = currentItems.slice();
		// apply sorting: ถ้ามีทั้ง rarity และ price → เรียงตาม rarity ก่อน แล้วค่อย price เป็นตัวเสริม
		items.sort((a, b) => {
			// rarity primary (ถ้ากำหนด)
			if (raritySortDir) {
				const ra = rarityRank[String(a.rarity || '')] || 0;
				const rb = rarityRank[String(b.rarity || '')] || 0;
				const rcmp = raritySortDir === 'asc' ? ra - rb : rb - ra;
				if (rcmp !== 0) return rcmp;
			}
			// price secondary (ถ้ากำหนด)
			if (priceSortDir) {
				const pa = typeof a.price === 'number' ? a.price : (priceSortDir === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
				const pb = typeof b.price === 'number' ? b.price : (priceSortDir === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
				const pcmp = priceSortDir === 'asc' ? pa - pb : pb - pa;
				if (pcmp !== 0) return pcmp;
			}
			return 0;
		});
		totalCountEl.textContent = String(items.length);
		if (items.length === 0) {
			fishTbodyEl.innerHTML = '';
			emptyStateEl.hidden = false;
			return;
		}
		emptyStateEl.hidden = true;
		const rows = items.map(renderRow).join('');
		fishTbodyEl.innerHTML = rows;
	}

	function renderRow(item) {
		const name = escapeHtml(item.name || '-');
		const rarity = escapeHtml(item.rarity || 'Unknown');
		const rarityClass = String(item.rarity || '').toLowerCase();
		const area = Array.isArray(item.area) ? item.area.map(escapeHtml).join(', ') : '-';
		const weather = Array.isArray(item.weather) ? item.weather.map(escapeHtml).join(', ') : '-';
		// เวลา: รองรับทั้งสตริงเดียวหรืออาเรย์ของสตริง แสดงแต่ละช่วงขึ้นบรรทัดใหม่
		let areaHtml = '-';
		let timeHtml = '-';
		if (Array.isArray(item.area) && item.area.length > 0 || Array.isArray(item.time) && item.time.length > 0) {
			areaHtml = item.area.map(escapeHtml).join('<br>');
			timeHtml = item.time.map(escapeHtml).join('<br>');
		} else if (typeof item.time === 'string' && item.time.trim() !== '') {
			areaHtml = escapeHtml(item.area);
			timeHtml = escapeHtml(item.time);
		}
		const imgSrc = item.image_url ? ` src="${escapeAttr(item.image_url)}"` : '';
		const priceText = typeof item.price === 'number' ? `${item.price} ฿` : '-';
		return [
			'<tr>',
			'<td class="cell-fish">',
			`<img class="fish-img"${imgSrc} alt="${escapeAttr(name)}" loading="lazy">`,
			`<div class="fish-name">${name}</div>`,
			'</td>',
			`<td class="cell-area">${areaHtml}</td>`,
			`<td class="cell-time">${timeHtml}</td>`,
			`<td class="cell-weather">${weather}</td>`,
			`<td class="cell-rarity"><span class="rarity ${rarityClass}">${rarity}</span></td>`,
			`<td class="cell-price">${priceText}</td>`,
			'</tr>'
		].join('');
	}

	function escapeHtml(text) {
		return String(text)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}
	function escapeAttr(text) {
		return escapeHtml(text).replace(/"/g, '&quot;');
	}

	function getSelectedValues(selectEl) {
		return Array.from(selectEl.selectedOptions).map((o) => o.value);
	}

	function applyFilters() {
		const season = seasonSelectEl.value || '';
		const weather = weatherSelectEl.value || '';
		const area = areaSelectEl.value || '';

		let filtered = allItems.filter((it) => {
			if (season) {
				const has = Array.isArray(it.season) && it.season.includes(season);
				if (!has) return false;
			}
			if (weather) {
				const has = Array.isArray(it.weather) && it.weather.includes(weather);
				if (!has) return false;
			}
			if (area) {
				const has = Array.isArray(it.area) && it.area.includes(area);
				if (!has) return false;
			}
			return true;
		});

		// หากไม่ได้เลือกฤดูกาล (คือ "ทั้งหมด") ให้กรองข้อมูลซ้ำ โดยยึดตามชื่อปลาเป็นหลัก
		if (!season) {
			// รวมรายการที่ชื่อซ้ำ ให้เหลือเพียงตัวแทนเดียว โดยเลือกตัวที่ "ความหายากสูงกว่า"
			// ถ้าความหายากเท่ากัน เลือก "ราคาสูงกว่า"
			const byName = new Map();
			const getKey = (it) => String(it.name || '').trim().toLowerCase();
			const getRank = (it) => {
				const rarityRank = { Legendary: 4, Rare: 3, Uncommon: 2, Common: 1 };
				return rarityRank[String(it.rarity || '')] || 0;
			};
			for (const it of filtered) {
				const key = getKey(it);
				const prev = byName.get(key);
				if (!prev) {
					byName.set(key, it);
				} else {
					const r1 = getRank(prev);
					const r2 = getRank(it);
					if (r2 > r1) {
						byName.set(key, it);
					} else if (r2 === r1) {
						const p1 = typeof prev.price === 'number' ? prev.price : -Infinity;
						const p2 = typeof it.price === 'number' ? it.price : -Infinity;
						if (p2 > p1) byName.set(key, it);
					}
				}
			}
			filtered = Array.from(byName.values());
		}

		currentItems = filtered;
		render();
	}

	function resetFilters() {
		seasonSelectEl.value = '';
		weatherSelectEl.value = '';
		areaSelectEl.value = '';

		applyFilters();
	}

	function wireEvents() {
		applyFiltersBtn.addEventListener('click', applyFilters);
		resetFiltersBtn.addEventListener('click', resetFilters);
		// เปลี่ยนค่า dropdown ให้กรองทันที
		seasonSelectEl.addEventListener('change', applyFilters);
		weatherSelectEl.addEventListener('change', applyFilters);
		areaSelectEl.addEventListener('change', applyFilters);
		// toggle sort
		priceSortBtn.addEventListener('click', () => {
			// สลับเฉพาะ desc <-> asc; ครั้งแรกให้เป็น desc
			if (priceSortDir === 'desc') {
				priceSortDir = 'asc';
			} else {
				priceSortDir = 'desc';
			}
			// หากผู้ใช้กดเรียงราคาจะปิดการเรียงตาม rarity เพื่อความชัดเจน
			raritySortDir = null;
			updateSortUI();
			render();
		});
		// toggle rarity sort
		raritySortBtn.addEventListener('click', () => {
			if (raritySortDir === 'desc') {
				raritySortDir = 'asc';
			} else {
				raritySortDir = 'desc';
			}
			// เมื่อเรียงตามความหายาก ให้คงราคาเป็นตัวเสริม (ไม่ยกเลิก)
			updateSortUI();
			render();
		});
	}

	function updateSortUI() {
		if (priceSortIcon) priceSortIcon.dataset.state = priceSortDir || '';
		if (raritySortIcon) raritySortIcon.dataset.state = raritySortDir || '';
	}

	// init
	wireEvents();
	loadData();
})();


