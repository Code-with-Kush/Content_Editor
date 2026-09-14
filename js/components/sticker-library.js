/**
 * Kitbitz hand-drawn SVG sticker library for the Fabric canvas.
 * STAMP: 2026-08-29
 * Uses the official CC0 Kitbitz catalogue and locally vendored SVG files.
 */
(function (window, document) {
    "use strict";
    var DATA_URL = "stickers/kitbitz/catalog.v1.json", SVG_ROOT = "stickers/kitbitz/kits/";
    var RECENTS_KEY = "content-generator-sticker-recents-v1", PAGE_SIZE = 96;
    var canvas, modal, modalElement, trigger, catalogue = [], visibleAssets = [], visibleCount = PAGE_SIZE, selectedKit = "", selectedCategory = "all";
    var kitNames = { "barbieland-kit": "Dreamland", "city-kit": "City Life", "cyberpunk-kit": "Cyberpunk", "dungeon-kit": "Dungeon", "interior-kit": "Interiors", "medieval-kit": "Medieval", "nature-kit": "Nature", "pirate-kit": "Pirates", "space-kit": "Space", "western-kit": "Western", "winter-kit": "Winter", "wkm-kit": "Characters", "wkm-props-kit": "Everyday Props" };

    function escapeHtml(value) { return String(value || "").replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]; }); }
    function assetPath(asset) {
        return SVG_ROOT + new window.URL(asset.formats.svg).pathname.replace(/^\/kits\//, "").split("/").map(function (part) { return encodeURIComponent(decodeURIComponent(part)); }).join("/");
    }
    function readRecents() { try { return JSON.parse(window.localStorage.getItem(RECENTS_KEY) || "[]"); } catch (error) { return []; } }
    function remember(id) { var items = readRecents().filter(function (item) { return item !== id; }); items.unshift(id); window.localStorage.setItem(RECENTS_KEY, JSON.stringify(items.slice(0, 10))); }
    function categoryOf(asset) {
        var terms = [asset.assetKind, asset.category, asset.material, (asset.tags || []).join(" ")].join(" ").toLowerCase();
        if (/character|people|person|human|avatar|creature/.test(terms)) return "characters";
        if (/plant|tree|flower|nature|animal|vegetation|rock|water/.test(terms)) return "nature";
        if (/building|architecture|city|house|room|environment|landscape/.test(terms)) return "places";
        return "objects";
    }
    function animatedAssets() {
        var kits = {}, results = [];
        catalogue.forEach(function (asset) {
            kits[asset.kit] = kits[asset.kit] || 0;
            if (kits[asset.kit] < 3) { kits[asset.kit] += 1; results.push(asset); }
        });
        return results;
    }
    function animationFor(asset) {
        var index = animatedAssets().findIndex(function (item) { return item.assetId === asset.assetId; });
        return index < 0 ? "" : ["bounce", "rotatein", "zoomin", "slideinbottom"][index % 4];
    }
    function stickerButton(asset, animated) {
        var effect = animated ? animationFor(asset) : "";
        return '<button class="cg-sticker-card' + (effect ? ' is-animated cg-sticker-card--' + effect : '') + '" type="button" role="listitem" data-sticker-id="' + escapeHtml(asset.assetId) + '"' + (effect ? ' data-sticker-animation="' + effect + '"' : '') + ' title="' + escapeHtml(asset.name) + '" aria-label="Add ' + escapeHtml(asset.name) + '"><img loading="lazy" src="' + assetPath(asset) + '" alt="">' + (effect ? '<span class="cg-sticker-motion-badge"><i class="fa fa-play" aria-hidden="true"></i></span>' : '') + '</button>';
    }

    /* STAMP: 2026-09-10 - Sticker Library participates in the shared left
     * island contract without changing catalogue or Fabric insertion logic. */
    function syncIslandState(isOpen) {
        document.body.classList.toggle("cg-sticker-island-open", isOpen);
        if (trigger) trigger.setAttribute("aria-expanded", String(isOpen));
        window.requestAnimationFrame(function () {
            window.dispatchEvent(new Event("resize"));
            if (canvas) { canvas.calcOffset?.(); canvas.requestRenderAll?.(); }
        });
    }
    function closeOtherLeftIslands() {
        window.CGLayersIsland?.close?.();
        window.CGShapeSidebar?.close?.();
        window.CGObjectLibraryIsland?.close?.();
        window.CGFlipCardIsland?.close?.();
        window.CGTreeNodesIsland?.close?.();
    }

    function createModal() {
        modalElement = document.createElement("div"); modalElement.id = "cgStickerModal"; modalElement.className = "cg-sticker-modal cg-left-component-island"; modalElement.tabIndex = -1; modalElement.hidden = true; modalElement.setAttribute("role", "dialog"); modalElement.setAttribute("aria-modal", "false"); modalElement.setAttribute("aria-labelledby", "cgStickerModalTitle"); modalElement.setAttribute("aria-hidden", "true");
        modalElement.innerHTML = '<div class="modal-dialog modal-dialog-centered"><div class="modal-content"><h2 id="cgStickerModalTitle" class="visually-hidden">Stickers</h2><header class="cg-sticker-modal__header"><button class="cg-sticker-back" type="button" aria-label="Back to sticker libraries" hidden><i class="fa fa-angle-left" aria-hidden="true"></i></button><label class="cg-sticker-search"><i class="fa fa-search" aria-hidden="true"></i><input id="cgStickerSearch" type="search" placeholder="Search stickers" autocomplete="off" aria-label="Search stickers"></label><button class="cg-sticker-modal__close" type="button" data-bs-dismiss="modal" aria-label="Close">&times;</button></header><nav class="cg-sticker-categories" aria-label="Sticker categories"><button type="button" data-sticker-category="all" class="is-active">All</button><button type="button" data-sticker-category="animated"><i class="fa fa-play-circle" aria-hidden="true"></i> Animated</button><button type="button" data-sticker-category="characters">Characters</button><button type="button" data-sticker-category="nature">Nature</button><button type="button" data-sticker-category="places">Places</button><button type="button" data-sticker-category="objects">Objects</button></nav><div class="cg-sticker-modal__body"><div class="cg-sticker-content"></div><button class="cg-sticker-more" type="button" hidden>Show more</button><p class="cg-sticker-credit">Hand-drawn illustrations from <a href="https://kitbitz.art/" target="_blank" rel="noopener noreferrer">Kitbitz</a> · CC0</p></div><input class="cg-sticker-upload" type="file" accept="image/svg+xml,.svg" hidden></div></div>';
        document.body.appendChild(modalElement);
        /* STAMP: 2026-09-10 - Preserve the established show/hide callers but
         * remove Bootstrap positioning so this panel is strictly left-side. */
        modal = {
            show: function () { closeOtherLeftIslands(); modalElement.hidden = false; modalElement.setAttribute("aria-hidden", "false"); syncIslandState(true); window.requestAnimationFrame(function () { modalElement.querySelector("#cgStickerSearch").focus(); }); },
            hide: function () { modalElement.hidden = true; modalElement.setAttribute("aria-hidden", "true"); syncIslandState(false); }
        };
        modalElement.querySelector("#cgStickerSearch").addEventListener("input", renderSearch);
        modalElement.querySelector(".cg-sticker-content").addEventListener("click", handleContentClick);
        modalElement.querySelector(".cg-sticker-categories").addEventListener("click", selectCategory);
        modalElement.querySelector(".cg-sticker-back").addEventListener("click", showLibraries);
        modalElement.querySelector(".cg-sticker-more").addEventListener("click", function () { visibleCount += PAGE_SIZE; renderAssetGrid(); });
        modalElement.querySelector(".cg-sticker-upload").addEventListener("change", importSticker);
        modalElement.querySelector(".cg-sticker-modal__close").removeAttribute("data-bs-dismiss");
        modalElement.querySelector(".cg-sticker-modal__close").addEventListener("click", function () { modal.hide(); trigger.focus(); });
        modalElement.addEventListener("keydown", function (event) { if (event.key === "Escape") { modal.hide(); trigger.focus(); } });
        window.CGStickerIsland = { open: function () { modal.show(); }, close: function () { modal.hide(); } };
    }

    function showLibraries() {
        selectedKit = ""; selectedCategory = "all"; visibleCount = PAGE_SIZE; modalElement.querySelector("#cgStickerSearch").value = ""; modalElement.querySelector(".cg-sticker-back").hidden = true; modalElement.querySelector(".cg-sticker-more").hidden = true; syncCategoryButtons();
        var recent = readRecents().map(function (id) { return catalogue.find(function (asset) { return asset.assetId === id; }); }).filter(Boolean);
        var kits = []; catalogue.forEach(function (asset) { if (kits.indexOf(asset.kit) < 0) kits.push(asset.kit); });
        var recentMarkup = recent.length ? recent.map(function (asset) { return stickerButton(asset, false); }).join("") : '<p class="cg-sticker-empty">Stickers you use will appear here.</p>';
        var libraries = '<button class="cg-sticker-library cg-sticker-library--upload" type="button" data-upload-sticker><i class="fa fa-plus" aria-hidden="true"></i><span>Add your own</span></button>' + kits.map(function (kit) {
            var assets = catalogue.filter(function (asset) { return asset.kit === kit; }), samples = assets.slice(0, 6);
            return '<button class="cg-sticker-library" type="button" data-sticker-kit="' + escapeHtml(kit) + '"><span class="cg-sticker-library__preview">' + samples.map(function (asset) { return '<img loading="lazy" src="' + assetPath(asset) + '" alt="">'; }).join("") + '</span><strong>' + escapeHtml(kitNames[kit] || kit.replace(/-kit$/, "").replace(/-/g, " ")) + '</strong><small>' + assets.length + ' stickers</small></button>';
        }).join("");
        modalElement.querySelector(".cg-sticker-content").innerHTML = '<section><h3>Recents</h3><div class="cg-sticker-recents" role="list">' + recentMarkup + '</div></section><section><h3>Libraries</h3><div class="cg-sticker-libraries">' + libraries + '</div></section>';
    }

    function syncCategoryButtons() {
        modalElement.querySelectorAll("[data-sticker-category]").forEach(function (button) { button.classList.toggle("is-active", button.dataset.stickerCategory === selectedCategory); });
    }
    function selectCategory(event) {
        var button = event.target.closest("[data-sticker-category]"); if (!button) return;
        selectedCategory = button.dataset.stickerCategory; selectedKit = "category"; visibleCount = PAGE_SIZE; modalElement.querySelector("#cgStickerSearch").value = ""; syncCategoryButtons();
        if (selectedCategory === "all") { showLibraries(); return; }
        visibleAssets = selectedCategory === "animated" ? animatedAssets() : catalogue.filter(function (asset) { return categoryOf(asset) === selectedCategory; });
        modalElement.querySelector(".cg-sticker-back").hidden = false; renderAssetGrid(selectedCategory === "animated" ? "Animated stickers" : selectedCategory);
    }

    function showKit(kit) { selectedKit = kit; visibleCount = PAGE_SIZE; visibleAssets = catalogue.filter(function (asset) { return asset.kit === kit; }); modalElement.querySelector(".cg-sticker-back").hidden = false; renderAssetGrid(); }
    function renderSearch() {
        var query = modalElement.querySelector("#cgStickerSearch").value.trim().toLowerCase();
        if (!query) { showLibraries(); return; }
        selectedKit = "search"; visibleCount = PAGE_SIZE; visibleAssets = catalogue.filter(function (asset) { return [asset.name, asset.description, (asset.tags || []).join(" "), asset.category, kitNames[asset.kit], asset.kit].join(" ").toLowerCase().indexOf(query) >= 0; }); modalElement.querySelector(".cg-sticker-back").hidden = false; renderAssetGrid("Search results");
    }
    function renderAssetGrid(title) {
        var content = modalElement.querySelector(".cg-sticker-content"), more = modalElement.querySelector(".cg-sticker-more"), heading = title || kitNames[selectedKit] || selectedKit.replace(/-kit$/, "").replace(/-/g, " ");
        if (!visibleAssets.length) { content.innerHTML = '<div class="cg-sticker-state"><i class="fa fa-search" aria-hidden="true"></i><span>No stickers match your search.</span></div>'; more.hidden = true; return; }
        content.innerHTML = '<section><h3>' + escapeHtml(heading) + '</h3><div class="cg-sticker-grid" role="list">' + visibleAssets.slice(0, visibleCount).map(function (asset) { return stickerButton(asset, selectedCategory === "animated"); }).join("") + '</div></section>'; more.hidden = visibleCount >= visibleAssets.length; more.textContent = "Show more (" + Math.min(PAGE_SIZE, visibleAssets.length - visibleCount) + ")";
    }

    function saveCanvas() {
        if (window.generated_slides && window.slide_index >= 0 && window.generated_slides[window.slide_index]) {
            var slide = window.generated_slides[window.slide_index];
            slide.jsonobj = canvas.toObject(["id"]);
            if (Array.isArray(slide.AnimationSequence)) slide.jsonobj.animationSequence = slide.AnimationSequence;
            slide.svg = encodeURIComponent(canvas.toSVG());
        }
        if (typeof window.updateCanvasState === "function") window.updateCanvasState();
    }
    function addSvg(url, name, assetId, animationEffect) {
        window.fabric.loadSVGFromURL(url).then(function (result) {
            if (!result.objects || !result.objects.length) throw new Error("SVG has no drawable objects");
            var sticker = window.fabric.util.groupSVGElements(result.objects, result.options || {}), maxSize = 190, scale = Math.min(1, maxSize / Math.max(sticker.width || maxSize, sticker.height || maxSize));
            sticker.set({ id: "sticker_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), name: name || "Sticker", left: canvas.getWidth() / 2, top: canvas.getHeight() / 2, originX: "center", originY: "center", scaleX: scale, scaleY: scale, transparentCorners: true });
            canvas.add(sticker); canvas.setActiveObject(sticker); if (typeof window.applyCanvasObjectActionControls === "function") window.applyCanvasObjectActionControls(sticker); if (typeof window.pushControl === "function") window.pushControl(sticker.id, "Sticker"); sticker.setCoords();
            if (animationEffect && window.generated_slides && window.generated_slides[window.slide_index]) {
                var slide = window.generated_slides[window.slide_index], sequence = Array.isArray(slide.AnimationSequence) ? slide.AnimationSequence : [];
                sequence.push({ objectId: sticker.id, effect: animationEffect, order: sequence.length + 1, duration: 0.8 }); slide.AnimationSequence = sequence;
                sticker.stickerAnimation = animationEffect;
            }
            canvas.requestRenderAll(); saveCanvas(); if (assetId) remember(assetId); modal.hide();
        }).catch(function (error) { console.error("SVG sticker could not be added", error); window.alert("This SVG sticker could not be added. Please try another one."); });
    }
    function handleContentClick(event) {
        var sticker = event.target.closest("[data-sticker-id]"), library = event.target.closest("[data-sticker-kit]");
        if (sticker) { var asset = catalogue.find(function (item) { return item.assetId === sticker.dataset.stickerId; }); if (asset) addSvg(assetPath(asset), asset.name, asset.assetId, sticker.dataset.stickerAnimation || ""); }
        else if (library) showKit(library.dataset.stickerKit); else if (event.target.closest("[data-upload-sticker]")) modalElement.querySelector(".cg-sticker-upload").click();
    }
    function importSticker(event) {
        var file = event.target.files && event.target.files[0]; if (!file) return;
        if (file.type !== "image/svg+xml" && !/\.svg$/i.test(file.name)) { window.alert("Please select an SVG file."); return; }
        var reader = new window.FileReader(); reader.onload = function () { addSvg(String(reader.result), file.name.replace(/\.svg$/i, "")); }; reader.readAsDataURL(file); event.target.value = "";
    }
    function loadCatalogue() {
        modalElement.querySelector(".cg-sticker-content").innerHTML = '<div class="cg-sticker-state"><i class="fa fa-circle-o-notch fa-spin" aria-hidden="true"></i><span>Loading sticker libraries...</span></div>';
        return window.fetch(DATA_URL).then(function (response) { if (!response.ok) throw new Error("Catalogue request failed"); return response.json(); }).then(function (data) { catalogue = (data.assets || []).filter(function (asset) { return asset.formats && asset.formats.svg; }); showLibraries(); }).catch(function (error) { console.error("Kitbitz sticker catalogue could not be loaded", error); modalElement.querySelector(".cg-sticker-content").innerHTML = '<div class="cg-sticker-state"><i class="fa fa-exclamation-circle" aria-hidden="true"></i><span>Sticker libraries could not be loaded.</span></div>'; });
    }
    function initialise() { canvas = window.CGCanvas; trigger = document.getElementById("openStickerLibrary"); if (!canvas || !trigger || !window.fabric) return false; trigger.setAttribute("aria-controls", "cgStickerModal"); trigger.setAttribute("aria-expanded", "false"); createModal(); trigger.addEventListener("click", function () { modal.show(); if (!catalogue.length) loadCatalogue(); else showLibraries(); }); return true; }
    var timer = window.setInterval(function () { if (initialise()) window.clearInterval(timer); }, 100);
}(window, document));
