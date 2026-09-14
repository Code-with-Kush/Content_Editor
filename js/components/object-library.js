/**
 * Account object library — STAMP: 2026-09-09.
 * SVG is kept for portable export; Fabric JSON preserves native editable text,
 * groups and controls. Authenticated persistence is delegated to the parent.
 * Bootstrap utilities reuse the editor theme without adding inline styles.
 */
(function (window, document) {
    "use strict";
    var pending = new Map(), modal, host, canvas, trigger, snapshot, items = [], offset = 0, busy = false;
    var properties = ["id", "name", "selectable", "evented", "richTextComponent", "richTextGroup", "richTextHtml"];

    function request(action, payload) {
        return new Promise(function (resolve, reject) {
            if (window.parent === window) { reject(new Error("Open the editor from your signed-in account to use the library.")); return; }
            var requestId = window.crypto.randomUUID();
            var timeout = window.setTimeout(function () {
                pending.delete(requestId);
                reject(new Error("The library did not respond. Reopen it to check whether your object was saved before trying again."));
            }, 60000);
            pending.set(requestId, { resolve: resolve, reject: reject, timeout: timeout });
            window.parent.postMessage({ type: "CG_OBJECT_LIBRARY_REQUEST", requestId: requestId, action: action, payload: payload }, window.location.origin);
        });
    }
    window.addEventListener("message", function (event) {
        if (event.source !== window.parent || event.origin !== window.location.origin || event.data?.type !== "CG_OBJECT_LIBRARY_RESULT") return;
        var entry = pending.get(event.data.requestId);
        if (!entry) return;
        window.clearTimeout(entry.timeout); pending.delete(event.data.requestId);
        if (event.data.error) entry.reject(new Error(event.data.error)); else entry.resolve(event.data.payload);
    });

    function status(message, error) {
        var element = host.querySelector("[data-status]");
        element.textContent = message;
        element.className = "cg-object-library__status small " + (error ? "text-danger" : "text-muted");
    }
    async function run(work) {
        if (busy) return;
        busy = true;
        host.querySelectorAll("button:not(.btn-close), input").forEach(function (button) { button.disabled = true; });
        try { await work(); } catch (error) { status(error.message || "The object could not be processed.", true); }
        finally {
            busy = false;
            host.querySelectorAll("button:not(.btn-close), input").forEach(function (button) { button.disabled = false; });
            host.querySelector("[data-save]").disabled = !snapshot;
        }
    }

    // Images must survive expiry/deletion of the original upload URL. Only
    // detached revived copies are changed; the selected slide stays untouched.
    async function embedImages(object) {
        if (object.type === "image") {
            var source = object.getSrc();
            if (!/^data:image\/(png|jpeg|jpg|gif|webp);base64,/i.test(source)) {
                var imageElement = object.getElement();
                var element = document.createElement("canvas");
                element.width = imageElement.naturalWidth || imageElement.width;
                element.height = imageElement.naturalHeight || imageElement.height;
                try {
                    element.getContext("2d").drawImage(imageElement, 0, 0);
                    await object.setSrc(element.toDataURL("image/png"));
                } catch (_) { throw new Error("An image cannot be embedded. Upload that image into the editor, then save the object again."); }
            }
        }
        if (object.getObjects) await Promise.all(object.getObjects().map(embedImages));
        if (object.clipPath) await embedImages(object.clipPath);
    }

    /** Build a cropped SVG from a detached canvas, never by exporting the full slide. */
    async function capture(json, name) {
        var restored = await window.fabric.util.enlivenObjects([json]);
        var object = restored[0], previewCanvas;
        try {
            await embedImages(object);
            object.setCoords();
            var bounds = object.getBoundingRect();
            var padding = Math.max(12, Number(object.strokeWidth) || 0);
            if (object.shadow) padding += Math.abs(object.shadow.offsetX || 0) + Math.abs(object.shadow.offsetY || 0) + (object.shadow.blur || 0) * 2;
            var width = Math.ceil(bounds.width + padding * 2), height = Math.ceil(bounds.height + padding * 2);
            if (!Number.isFinite(width + height) || width <= 0 || height <= 0 || width > 8192 || height > 8192 || width * height > 16000000) throw new Error("Resize this object before saving it to the library.");
            object.set({ left: object.left - bounds.left + padding, top: object.top - bounds.top + padding });
            object.setCoords();
            previewCanvas = new window.fabric.StaticCanvas(document.createElement("canvas"), { width: width, height: height, renderOnAddRemove: false, enableRetinaScaling: false });
            previewCanvas.add(object);
            var svg = previewCanvas.toSVG({ suppressPreamble: true });
            var preview = previewCanvas.toDataURL({ format: "png", multiplier: Math.min(1, 240 / Math.max(width, height)), enableRetinaScaling: false });
            return { name: name, svg: svg, fabricJson: JSON.stringify(object.toObject(properties)), preview: preview };
        } finally {
            if (previewCanvas) await previewCanvas.dispose(); else object?.dispose();
        }
    }

    /** Allocate IDs for every nested object and remap internal references. */
    function freshIds(json) {
        var ids = new Map();
        function collect(value) {
            if (!value || typeof value !== "object") return;
            if (typeof value.type === "string" && ("left" in value || "top" in value)) {
                var next = "lib_" + window.crypto.randomUUID();
                if (value.id) ids.set(value.id, next);
                value.id = next;
            }
            Object.values(value).forEach(collect);
        }
        function replace(value) {
            if (!value || typeof value !== "object") return;
            Object.keys(value).forEach(function (key) {
                if (typeof value[key] === "string" && ids.has(value[key])) value[key] = ids.get(value[key]);
                else replace(value[key]);
            });
        }
        collect(json); replace(json);
        return json;
    }

    async function useObject(id) {
        var editor = window.CGObjectLibraryEditor, slideId = editor?.getSlideId();
        if (!slideId) throw new Error("Wait for the current slide to finish loading.");
        status("Adding object...");
        var saved = await request("get", { id: id });
        var objects = await window.fabric.util.enlivenObjects([freshIds(JSON.parse(saved.fabricJson))]);
        var object = objects[0];
        try {
            // A library item starts selected; retain child locks and metadata.
            object.set({ selectable: true, evented: true });
            var scale = Math.min(1, canvas.getWidth() * 0.8 / object.getScaledWidth(), canvas.getHeight() * 0.8 / object.getScaledHeight());
            object.set({ scaleX: object.scaleX * scale, scaleY: object.scaleY * scale });
            object.setPositionByOrigin(new window.fabric.Point(canvas.getWidth() / 2, canvas.getHeight() / 2), "center", "center");
            editor.insert(object, slideId);
            modal.hide();
        } catch (error) { if (!object.canvas) object.dispose(); throw error; }
    }
    async function download(id) {
        var saved = await request("get", { id: id });
        var url = window.URL.createObjectURL(new Blob([saved.svg], { type: "image/svg+xml" }));
        var link = document.createElement("a");
        link.href = url; link.download = saved.name.replace(/[^a-z0-9 _-]/gi, "_") + ".svg";
        document.body.appendChild(link); link.click(); link.remove();
        window.setTimeout(function () { window.URL.revokeObjectURL(url); }, 1000);
        status("SVG downloaded.");
    }
    function button(label, tone, action) {
        var element = document.createElement("button");
        element.type = "button";
        element.className = "btn btn-sm cg-object-library__item-action cg-object-library__item-action--" + tone;
        element.textContent = label; element.addEventListener("click", function () { void run(action); });
        return element;
    }
    function render() {
        var grid = host.querySelector("[data-items]"); grid.replaceChildren();
        items.forEach(function (item) {
            var column = document.createElement("div"), card = document.createElement("div"), image = document.createElement("img"), title = document.createElement("strong"), actions = document.createElement("div");
            column.className = "col-12 col-sm-6 col-lg-4"; card.className = "cg-object-library__item h-100 d-flex flex-column";
            image.className = "cg-object-library__preview img-fluid mx-auto"; image.width = 160; image.height = 120; image.alt = item.name; image.loading = "lazy";
            if (/^data:image\/png;base64,/.test(item.preview)) image.src = item.preview;
            title.className = "cg-object-library__item-name text-break"; title.textContent = item.name; actions.className = "cg-object-library__item-actions d-flex flex-wrap mt-auto";
            actions.append(button("Use object", "primary", function () { return useObject(item.id); }), button("Download SVG", "teal", function () { return download(item.id); }), button("Remove", "danger", async function () {
                if (!window.confirm('Remove "' + item.name + '" from your library? Objects already added to slides will remain.')) return;
                await request("delete", { id: item.id }); await load(false);
            }));
            card.append(image, title, actions); column.append(card); grid.append(column);
        });
    }
    async function load(more) {
        if (!more) { items = []; render(); host.querySelector("[data-more]").hidden = true; }
        status("Loading your objects...");
        var nextOffset = more ? offset + 24 : 0;
        var result = await request("list", { search: host.querySelector("[data-search]").value.trim(), offset: nextOffset });
        offset = nextOffset; items = more ? items.concat(result.items) : result.items;
        render(); host.querySelector("[data-more]").hidden = !result.hasMore;
        status(items.length ? "Select Use object to add an editable copy to this slide." : "No saved objects. Select an object on your slide, then save it here.");
    }
    /* STAMP: 2026-09-10 - Object Library shares the non-blocking left island
       state contract while retaining its account bridge and object actions. */
    function syncIslandState(isOpen) {
        document.body.classList.toggle("cg-object-library-island-open", isOpen);
        if (trigger) trigger.setAttribute("aria-expanded", String(isOpen));
        window.requestAnimationFrame(function () {
            window.dispatchEvent(new Event("resize"));
            if (canvas) { canvas.calcOffset?.(); canvas.requestRenderAll?.(); }
        });
    }
    function closeOtherLeftIslands() {
        window.CGLayersIsland?.close?.();
        window.CGShapeSidebar?.close?.();
        window.CGStickerIsland?.close?.();
        window.CGFlipCardIsland?.close?.();
        window.CGTreeNodesIsland?.close?.();
    }
    function initialise() {
        canvas = window.CGCanvas;
        trigger = document.getElementById("cgOpenObjectLibrary");
        if (!canvas || !trigger || host) return;
        host = document.createElement("div"); host.className = "cg-left-component-island"; host.tabIndex = -1; host.id = "cgObjectLibrary"; host.hidden = true;
        host.setAttribute("role", "dialog");
        host.setAttribute("aria-modal", "false");
        host.setAttribute("aria-labelledby", "cgObjectLibraryTitle");
        host.setAttribute("aria-hidden", "true");
        // STAMP: 2026-09-09 - Compact, class-scoped presentation; handlers and account bridge stay unchanged.
        host.innerHTML = '<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable cg-object-library__dialog"><div class="modal-content cg-object-library__content">' +
            '<div class="modal-header cg-object-library__header"><h5 class="modal-title" id="cgObjectLibraryTitle">Object library</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close object library"></button></div>' +
            '<div class="modal-body cg-object-library__body"><p class="cg-object-library__intro">Your saved objects are available across devices when you sign in to this account.</p>' +
            '<form data-save-form class="cg-object-library__save"><label for="cgLibraryName" class="form-label">Save selected object</label><div class="input-group cg-object-library__input-group"><input id="cgLibraryName" class="form-control" maxlength="120" required placeholder="Object name"><button data-save class="btn cg-object-library__button cg-object-library__button--save" type="submit">Save to library</button></div></form>' +
            '<form data-search-form class="input-group cg-object-library__input-group cg-object-library__search"><input data-search class="form-control" type="search" maxlength="120" aria-label="Search saved objects" placeholder="Search your objects"><button class="btn cg-object-library__button cg-object-library__button--search" type="submit">Search</button></form>' +
            '<p data-status class="cg-object-library__status" role="status" aria-live="polite"></p><div data-items class="row g-2"></div><button data-more class="btn cg-object-library__button cg-object-library__button--more" type="button" hidden>Load more</button></div></div></div>';
        document.body.appendChild(host);
        /* STAMP: 2026-09-10 - Preserve the established show/hide interface
           while using deterministic left-island positioning instead. */
        modal = {
            show: function () { closeOtherLeftIslands(); host.hidden = false; host.setAttribute("aria-hidden", "false"); syncIslandState(true); },
            hide: function () { host.hidden = true; host.setAttribute("aria-hidden", "true"); syncIslandState(false); }
        };
        trigger.setAttribute("aria-controls", "cgObjectLibrary");
        trigger.setAttribute("aria-expanded", "false");
        window.CGObjectLibraryIsland = { open: function () { modal.show(); }, close: function () { modal.hide(); } };
        host.querySelector(".cg-object-library__header .btn-close").removeAttribute("data-bs-dismiss");
        host.querySelector(".cg-object-library__header .btn-close").addEventListener("click", function () { modal.hide(); trigger.focus(); });
        host.addEventListener("keydown", function (event) { if (event.key === "Escape") { modal.hide(); trigger.focus(); } });
        trigger.addEventListener("click", function () {
            if (busy) { modal.show(); return; }
            var selected = canvas.getActiveObject();
            snapshot = selected ? selected.toObject(properties) : null;
            if (snapshot && String(snapshot.type).toLowerCase() === "activeselection") snapshot.type = "group";
            host.querySelector("#cgLibraryName").value = selected ? (selected.name || "My object") : "";
            host.querySelector("[data-search]").value = "";
            modal.show(); void run(function () { return load(false); });
        });
        host.querySelector("[data-save-form]").addEventListener("submit", function (event) {
            event.preventDefault(); if (!snapshot) return;
            var name = host.querySelector("#cgLibraryName").value.trim();
            if (!name) { status("Enter an object name.", true); return; }
            void run(async function () {
                status("Saving selected object...");
                var payload = await capture(snapshot, name);
                if (payload.svg.length > 5 * 1024 * 1024 || payload.fabricJson.length > 5 * 1024 * 1024 || payload.preview.length > 300000) throw new Error("This object is too large. Reduce its image size before saving.");
                await request("save", payload);
                host.querySelector("[data-search]").value = "";
                await load(false); status('Saved "' + name + '" to your object library.');
            });
        });
        host.querySelector("[data-search-form]").addEventListener("submit", function (event) { event.preventDefault(); void run(function () { return load(false); }); });
        host.querySelector("[data-more]").addEventListener("click", function () { void run(function () { return load(true); }); });
    }
    window.addEventListener("cg:canvas-ready", initialise);
    initialise();
}(window, document));
