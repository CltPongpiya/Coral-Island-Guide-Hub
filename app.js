'use strict';

(function () {
	const JSON_PATH = './coral_island_fish_cache.json';

	/** @type {Array<any>} */
	let allItems = [];
	/** @type {Array<any>} */
	let currentItems = [];

	// Elements
	const fishTbodyEl = document.getElementById('fishTbody');
	const cardsWrapperEl = document.getElementById('cardsWrapper');
	const emptyStateEl = document.getElementById('emptyState');
	const totalCountEl = document.getElementById('totalCount');

	// Filters
	let seasonSelectEl = null; // จะเปลี่ยนเป็น tab แทน
	const seasonTabsEl = document.getElementById('seasonTabs');
	const weatherTabsEl = document.getElementById('weatherTabs');
	const priceSortBtn = document.getElementById('priceSortBtn');
	const priceSortIcon = document.getElementById('priceSortIcon');
	const raritySortBtn = document.getElementById('raritySortBtn');
	const raritySortIcon = document.getElementById('raritySortIcon');
	
	// Season / Weather state (แทน select value)
	let selectedSeason = '';
	let selectedWeather = '';

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

		// สร้าง season tabs (กรอง "ตกได้ทุกฤดูกาล" ออก)
		const allSeasons = uniqueStrings(items.map((i) => i.season));
		const seasons = allSeasons.filter((s) => s && s !== 'ตกได้ทุกฤดูกาล');
		if (seasonTabsEl) {
			// เพิ่ม tab แต่ละฤดูกาล
			let isFirst = true;
			seasons.forEach((season) => {
				if (!season) return;
				const tab = document.createElement('button');
				tab.className = isFirst ? 'season-tab active' : 'season-tab';
				tab.dataset.season = season;
				tab.textContent = season;
				tab.addEventListener('click', () => {
					selectedSeason = season;
					updateSeasonTabs();
					applyFilters();
					scrollToTableTop();
				});
				seasonTabsEl.appendChild(tab);
				if (isFirst) {
					selectedSeason = season;
					isFirst = false;
				}
			});
		}
		
		// สร้าง weather tabs (กรอง "ทุกสภาพอากาศ" ออกจาก UI แต่ยังใช้ใน logic)
		const allWeathers = uniqueStrings(items.map((i) => i.weather));
		const weathers = allWeathers.filter((w) => w && w !== 'ทุกสภาพอากาศ');
		if (weatherTabsEl) {
			let isFirstWeather = true;
			weathers.forEach((weather) => {
				if (!weather) return;
				const tab = document.createElement('button');
				tab.className = isFirstWeather ? 'season-tab weather-tab active' : 'season-tab weather-tab';
				tab.dataset.weather = weather;
				tab.textContent = weather;
				tab.addEventListener('click', () => {
					selectedWeather = weather;
					updateWeatherTabs();
					applyFilters();
					scrollToTableTop();
				});
				weatherTabsEl.appendChild(tab);
				if (isFirstWeather) {
					selectedWeather = weather;
					isFirstWeather = false;
				}
			});
		}
	}
	
	function updateSeasonTabs() {
		if (!seasonTabsEl) return;
		const tabs = seasonTabsEl.querySelectorAll('.season-tab');
		tabs.forEach((tab) => {
			if (tab.dataset.season === selectedSeason) {
				tab.classList.add('active');
			} else {
				tab.classList.remove('active');
			}
		});
	}

	function updateWeatherTabs() {
		if (!weatherTabsEl) return;
		const tabs = weatherTabsEl.querySelectorAll('.weather-tab');
		tabs.forEach((tab) => {
			if (tab.dataset.weather === selectedWeather) {
				tab.classList.add('active');
			} else {
				tab.classList.remove('active');
			}
		});
	}

	// เมื่อเปลี่ยน filter ฤดูกาล/สภาพอากาศ ให้เลื่อน scroll กลับไปจุดเริ่มต้นของรายการเสมอ
	function scrollToTableTop() {
		try {
			const wrapper = document.querySelector('.cards-wrapper') || document.querySelector('.table-wrapper');
			if (!wrapper) return;

			const rect = wrapper.getBoundingClientRect();
			const headerEl = document.querySelector('.filters-header');
			const headerHeight = headerEl ? headerEl.offsetHeight : 0;
			const safeOffset = headerHeight + 8; // เผื่อ margin เล็กน้อย
			const target = window.scrollY + rect.top - safeOffset;

			window.scrollTo({
				top: target > 0 ? target : 0,
				behavior: 'auto'
			});
		} catch (_) {
			// เผื่อ fallback ถ้ามีปัญหาใด ๆ
			window.scrollTo({ top: 0, behavior: 'auto' });
		}
	}

	// เก็บ sorted items สำหรับ modal
	let sortedItems = [];

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
		sortedItems = items;
		totalCountEl.textContent = String(items.length);
		if (items.length === 0) {
			fishTbodyEl.innerHTML = '';
			if (cardsWrapperEl) cardsWrapperEl.innerHTML = '';
			emptyStateEl.hidden = false;
			return;
		}
		emptyStateEl.hidden = true;
		const rows = items.map((item, index) => renderRow(item, index)).join('');
		fishTbodyEl.innerHTML = rows;
		// Render cards สำหรับ mobile
		if (cardsWrapperEl) {
			const cards = items.map((item, index) => renderCard(item, index)).join('');
			cardsWrapperEl.innerHTML = cards;
		}
		// เชื่อม event listeners สำหรับ tooltip
		wireTooltips();
		// เชื่อม event listeners สำหรับปุ่มแผนที่
		wireMapButtons();
	}

	function renderRow(item, index) {
		const name = escapeHtml(item.name || '-');
		const rarity = escapeHtml(item.rarity || 'Unknown');
		const rarityClass = String(item.rarity || '').toLowerCase();
		const area = Array.isArray(item.area) ? item.area.map(escapeHtml).join(', ') : '-';
		const weather = Array.isArray(item.weather) ? item.weather.map(escapeHtml).join(', ') : '-';
		// ตรวจสอบว่าตกได้ทุกฤดูกาลหรือไม่
		const seasons = Array.isArray(item.season) ? item.season : (item.season ? [item.season] : []);
		const isAllSeason = seasons.some(s => String(s).trim() === 'ตกได้ทุกฤดูกาล');
		const allSeasonTag = isAllSeason ? '<span class="all-season-tag">ตกได้ทุกฤดูกาล</span>' : '';
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
		// แสดงราคาเป็นไอคอนเหรียญปกติ + ตัวเลข (ไม่ใช้สัญลักษณ์สกุลเงิน)
		const priceText = typeof item.price === 'number'
			? `<img class="coin-icon" src="img/Normal_coin.webp" alt="">${item.price}`
			: '-';
		// เตรียมข้อมูลสำหรับ tooltip
		const hasTierData = typeof item.tier1 === 'number' || typeof item.tier2 === 'number' || typeof item.tier3 === 'number' || typeof item.tier4 === 'number';
		const priceCellAttrs = hasTierData ? ` class="cell-price tooltip-trigger" data-image="${escapeAttr(item.image_url || '')}" data-tier1="${item.tier1 || ''}" data-tier2="${item.tier2 || ''}" data-tier3="${item.tier3 || ''}" data-tier4="${item.tier4 || ''}"` : ' class="cell-price"';
		// เก็บ index แทนการเก็บข้อมูลทั้งหมดใน attribute
		return [
			`<tr class="fish-row" data-item-index="${index}">`,
			'<td class="cell-fish">',
			`<img class="fish-img"${imgSrc} alt="${escapeAttr(name)}" loading="lazy">`,
			`<div class="fish-name">${name}${allSeasonTag ? ' ' + allSeasonTag : ''}</div>`,
			'</td>',
			`<td class="cell-area">${areaHtml}</td>`,
			`<td class="cell-time">${timeHtml}</td>`,
			`<td class="cell-weather">${weather}</td>`,
			`<td class="cell-rarity"><span class="rarity ${rarityClass}">${rarity}</span></td>`,
			`<td${priceCellAttrs}>${priceText}</td>`,
			'</tr>'
		].join('');
	}

	function renderCard(item, index) {
		const name = escapeHtml(item.name || '-');
		const rarity = escapeHtml(item.rarity || 'Unknown');
		const rarityClass = String(item.rarity || '').toLowerCase();
		const weather = Array.isArray(item.weather) ? item.weather.map(escapeHtml).join(', ') : '-';
		// ตรวจสอบว่าตกได้ทุกฤดูกาลหรือไม่
		const seasons = Array.isArray(item.season) ? item.season : (item.season ? [item.season] : []);
		const isAllSeason = seasons.some(s => String(s).trim() === 'ตกได้ทุกฤดูกาล');
		const allSeasonTag = isAllSeason ? '<span class="all-season-tag">ตกได้ทุกฤดูกาล</span>' : '';
		// เวลาและจุดตกปลา: แสดงแต่ละรายการขึ้นบรรทัดใหม่
		let areaHtml = '-';
		let timeHtml = '-';
		if (Array.isArray(item.area) && item.area.length > 0 || Array.isArray(item.time) && item.time.length > 0) {
			areaHtml = item.area.map(escapeHtml).join('<br>');
			timeHtml = item.time.map(escapeHtml).join('<br>');
		} else if (typeof item.time === 'string' && item.time.trim() !== '') {
			areaHtml = escapeHtml(item.area);
			timeHtml = escapeHtml(item.time);
		}
		// แสดงราคาใน card เป็นไอคอนเหรียญปกติ + ตัวเลข
		const price = typeof item.price === 'number'
			? `<img class="coin-icon" src="img/Normal_coin.webp" alt="">${item.price}`
			: '-';
		const imgSrc = item.image_url ? ` src="${escapeAttr(item.image_url)}"` : '';
		const hasTierData = typeof item.tier1 === 'number' || typeof item.tier2 === 'number' || typeof item.tier3 === 'number' || typeof item.tier4 === 'number';
		const priceAttrs = hasTierData ? ` class="card-price tooltip-trigger" data-image="${escapeAttr(item.image_url || '')}" data-tier1="${item.tier1 || ''}" data-tier2="${item.tier2 || ''}" data-tier3="${item.tier3 || ''}" data-tier4="${item.tier4 || ''}"` : ' class="card-price"';
		
		return [
			`<div class="fish-card" data-item-index="${index}">`,
			'<div class="card-header">',
			`<img class="card-fish-img"${imgSrc} alt="${escapeAttr(name)}" loading="lazy">`,
			'<div class="card-title">',
			`<h3 class="card-name">${name}${allSeasonTag ? ' ' + allSeasonTag : ''}</h3>`,
			`<span class="rarity ${rarityClass}">${rarity}</span>`,
			'</div>',
			`<div${priceAttrs}>${price}</div>`,
			'</div>',
			'<div class="card-body">',
			`<div class="card-info"><strong>จุดตกปลา:</strong> <span>${areaHtml}</span></div>`,
			`<div class="card-info"><strong>เวลา:</strong> <span>${timeHtml}</span></div>`,
			`<div class="card-info"><strong>สภาพอากาศ:</strong> <span>${weather}</span></div>`,
			'</div>',
			'<button class="map-tag-btn" data-action="show-map">แผนที่</button>',
			'</div>'
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
		const season = selectedSeason;
		const weather = selectedWeather;

		let filtered = allItems.filter((it) => {
			if (season) {
				// รวมปลาที่มี season ตรงกับที่เลือก หรือ "ตกได้ทุกฤดูกาล"
				const seasons = Array.isArray(it.season) ? it.season : [];
				const hasSeason = seasons.includes(season) || seasons.includes('ตกได้ทุกฤดูกาล');
				if (!hasSeason) return false;
			}
			if (weather) {
				// รวมปลาที่มี weather ตรงกับที่เลือก หรือ "ทุกสภาพอากาศ"
				const weathers = Array.isArray(it.weather) ? it.weather : [];
				const hasWeather = weathers.includes(weather) || weathers.includes('ทุกสภาพอากาศ');
				if (!hasWeather) return false;
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

	function wireEvents() {
		// season / weather tabs จัดการตัวเองแล้ว
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

	let tooltipEl = null;

	function createTooltip() {
		if (tooltipEl) return tooltipEl;
		tooltipEl = document.createElement('div');
		tooltipEl.className = 'price-tooltip';
		tooltipEl.hidden = true;
		document.body.appendChild(tooltipEl);
		return tooltipEl;
	}

	function showTooltip(trigger, imageUrl, tier1, tier2, tier3, tier4) {
		const tooltip = createTooltip();
		const rect = trigger.getBoundingClientRect();
		const scrollX = window.scrollX || window.pageXOffset;
		const scrollY = window.scrollY || window.pageYOffset;
		
		let content = '<div class="tooltip-tiers">';
		if (typeof tier1 === 'number') {
			content += `<div class="tier-item"><span class="tier-value"><img class="coin-icon" src="img/Bronze_coin.webp" alt="">${tier1}</span></div>`;
		}
		if (typeof tier2 === 'number') {
			content += `<div class="tier-item"><span class="tier-value"><img class="coin-icon" src="img/Silver_coin.webp" alt="">${tier2}</span></div>`;
		}
		if (typeof tier3 === 'number') {
			content += `<div class="tier-item"><span class="tier-value"><img class="coin-icon" src="img/Gold_coin.webp" alt="">${tier3}</span></div>`;
		}
		if (typeof tier4 === 'number') {
			content += `<div class="tier-item"><span class="tier-value"><img class="coin-icon" src="img/Osmium_coin.webp" alt="">${tier4}</span></div>`;
		}
		content += '</div>';
		
		tooltip.innerHTML = content;
		tooltip.hidden = false;
		
		// จัดตำแหน่ง tooltip ทางขวาของ cell-price แต่ป้องกันล้นจอ
		const tooltipRect = tooltip.getBoundingClientRect();
		const viewportWidth = window.innerWidth || document.documentElement.clientWidth;

		let left = rect.right + 12 + scrollX;
		let top = rect.top + scrollY - (tooltipRect.height / 2) + (rect.height / 2);

		// ถ้าล้นขวา ให้เลื่อนไปแสดงด้านซ้ายของ cell
		if (left + tooltipRect.width > scrollX + viewportWidth - 8) {
			left = rect.left + scrollX - tooltipRect.width - 12;
		}
		// ถ้ายังล้นซ้าย ให้ชนขอบซ้ายสุดที่ 8px
		if (left < scrollX + 8) {
			left = scrollX + 8;
		}

		// ปรับตำแหน่งแนวตั้งไม่ให้ล้นด้านบนมากเกินไป
		const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
		const minTop = scrollY + 8;
		const maxTop = scrollY + viewportHeight - tooltipRect.height - 8;
		if (top < minTop) top = minTop;
		if (top > maxTop) top = maxTop;

		tooltip.style.left = `${left}px`;
		tooltip.style.top = `${top}px`;
	}

	function hideTooltip() {
		if (tooltipEl) tooltipEl.hidden = true;
	}

	function wireTooltips() {
		const triggers = document.querySelectorAll('.tooltip-trigger');
		triggers.forEach((trigger) => {
			trigger.addEventListener('mouseenter', (e) => {
				const img = trigger.dataset.image || '';
				const t1 = trigger.dataset.tier1 ? Number(trigger.dataset.tier1) : undefined;
				const t2 = trigger.dataset.tier2 ? Number(trigger.dataset.tier2) : undefined;
				const t3 = trigger.dataset.tier3 ? Number(trigger.dataset.tier3) : undefined;
				const t4 = trigger.dataset.tier4 ? Number(trigger.dataset.tier4) : undefined;
				showTooltip(trigger, img, t1, t2, t3, t4);
			});
			trigger.addEventListener('mouseleave', hideTooltip);
		});
	}

	// Map Modal
	const mapModalEl = document.getElementById('mapModal');
	const mapModalCloseEl = document.getElementById('mapModalClose');

	function showMapModal() {
		if (mapModalEl) {
			mapModalEl.hidden = false;
			document.body.style.overflow = 'hidden';
		}
	}

	function hideMapModal() {
		if (mapModalEl) {
			mapModalEl.hidden = true;
			document.body.style.overflow = '';
		}
	}

	function wireMapButtons() {
		const mapButtons = document.querySelectorAll('.map-tag-btn');
		mapButtons.forEach((btn) => {
			btn.addEventListener('click', (e) => {
				e.stopPropagation();
				showMapModal();
			});
		});
	}

	// init
	wireEvents();
	// ซ่อน tooltip อัตโนมัติเมื่อมีการ scroll หน้า
	window.addEventListener('scroll', hideTooltip, { passive: true });
	if (mapModalCloseEl) {
		mapModalCloseEl.addEventListener('click', hideMapModal);
	}
	if (mapModalEl) {
		const overlay = mapModalEl.querySelector('.map-modal-overlay');
		if (overlay) {
			overlay.addEventListener('click', hideMapModal);
		}
		// ปิด modal เมื่อกด ESC
		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape' && !mapModalEl.hidden) {
				hideMapModal();
			}
		});
	}
	loadData();
})();


