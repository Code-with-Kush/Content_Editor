/**
 * Fabric LMS Widget Library
 * STAMP: 2026-08-25
 * Isolated UI/factory adapter for the legacy ContentGenerator. It only uses
 * public Fabric APIs and the editor's existing save/history/control hooks.
 */
(function (window, document) {
    "use strict";

    var registry = window.LMSWidgetRegistry;
    var fabric = window.fabric;
    var canvas = null;
    var mode = "edit";
    var customProperties = ["id", "widgetType", "widgetCategory", "interactionType", "required", "score", "widgetData", "widgetVersion", "sourceId", "targetId", "connectionType", "hidden", "locked"];

    function id() {
        if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
        return "widget_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
    }

    function escapeHtml(value) {
        return String(value || "").replace(/[&<>"']/g, function (character) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character];
        });
    }

    function metadata(definition) {
        return {
            id: id(), widgetType: definition.type, widgetCategory: definition.category,
            interactionType: definition.interactionType || "none", required: false, score: 0,
            widgetData: {}, widgetVersion: 1, name: definition.name
        };
    }

    function textObject(text, options) {
        return new fabric.Textbox(text, Object.assign({ fontFamily: "Arial", fontSize: 18, fill: "#101828", width: 210, lineHeight: 1.2 }, options));
    }

    function makeCard(definition) {
        var meta = metadata(definition);
        var width = 250, height = 132;
        var background = new fabric.Rect({ left: 0, top: 0, width: width, height: height, rx: 14, ry: 14, fill: "#ffffff", stroke: "#d0d5dd", strokeWidth: 1 });
        var eyebrow = textObject(definition.category.toUpperCase(), { left: 18, top: 16, width: 210, fontSize: 10, fontWeight: "700", fill: "#6941c6", charSpacing: 80 });
        var title = textObject(definition.name, { left: 18, top: 38, width: 214, fontSize: 20, fontWeight: "700" });
        var helper = textObject(definition.interactionType === "none" ? "Edit in Properties" : "Learner interaction: " + definition.interactionType, { left: 18, top: 77, width: 214, fontSize: 12, fill: "#667085" });
        if (definition.category === "assessment") helper.set({ text: "Question\nOption A     Option B", fontSize: 13 });
        if (definition.category === "gamification") helper.set({ text: definition.type === "star-rating" ? "☆  ☆  ☆  ☆  ☆" : "Progress  60%" });
        var group = new fabric.Group([background, eyebrow, title, helper], Object.assign(meta, {
            left: 70, top: 70, subTargetCheck: false, transparentCorners: true
        }));
        group.widgetData = { title: definition.name, content: helper.text, background: "#ffffff", border: "#d0d5dd", radius: 14, trigger: definition.interactionType };
        return group;
    }

    function makeShape(definition) {
        var meta = metadata(definition), object;
        var base = Object.assign(meta, { left: 100, top: 90, fill: "#f4ebff", stroke: "#7f56d9", strokeWidth: 2 });
        if (definition.type === "circle") object = new fabric.Circle(Object.assign(base, { radius: 60 }));
        else if (definition.type === "ellipse") object = new fabric.Ellipse(Object.assign(base, { rx: 90, ry: 55 }));
        else if (definition.type === "triangle") object = new fabric.Triangle(Object.assign(base, { width: 140, height: 120 }));
        else if (["line", "arrow"].indexOf(definition.type) >= 0) object = new fabric.Line([100, 100, 280, 100], Object.assign(base, { fill: null }));
        else object = new fabric.Rect(Object.assign(base, { width: 180, height: 110, rx: definition.type === "rounded-rectangle" ? 18 : 0, ry: definition.type === "rounded-rectangle" ? 18 : 0 }));
        object.widgetData = { background: "#f4ebff", border: "#7f56d9", radius: object.rx || 0 };
        return object;
    }

    function makeText(definition) {
        var values = { "text": "Add text", "heading": "Section heading", "rich-text-textbox": "Rich text content", "quote": "“Add a memorable quotation.”", "callout": "Key learning point", "sticky-note": "Remember this", "label": "Label", "badge": "NEW", "numbered-marker": "1" };
        var object = textObject(values[definition.type] || definition.name, Object.assign(metadata(definition), {
            left: 90, top: 80, width: definition.type === "heading" ? 360 : 230,
            fontSize: definition.type === "heading" ? 30 : 18,
            fontWeight: ["heading", "badge", "numbered-marker"].indexOf(definition.type) >= 0 ? "700" : "400",
            backgroundColor: definition.type === "sticky-note" ? "#fef0c7" : ""
        }));
        object.widgetData = { title: definition.name, content: object.text, background: object.backgroundColor || "transparent", border: "transparent", radius: 0 };
        return object;
    }

    function saveCanvas() {
        if (window.generated_slides && window.slide_index >= 0 && window.generated_slides[window.slide_index]) {
            window.generated_slides[window.slide_index].jsonobj = canvas.toObject(customProperties);
        }
        if (typeof window.updateCanvasState === "function") window.updateCanvasState();
    }

    function position(object, point) {
        if (!point) return;
        object.set({ left: Math.max(0, point.x - object.getScaledWidth() / 2), top: Math.max(0, point.y - object.getScaledHeight() / 2) });
        object.setCoords();
    }

    function add(definition, point) {
        if (!definition || !canvas) return null;
        if (definition.create === "table" && window.ContentTableWidget) {
            var table = window.ContentTableWidget.create(Object.assign(metadata(definition), { rows: 2, columns: 2, headerRow: true }));
            position(table, point);
            canvas.add(table); canvas.setActiveObject(table);
            if (typeof window.applyCanvasObjectActionControls === "function") window.applyCanvasObjectActionControls(table);
            if (typeof table.refreshControls === "function") table.refreshControls();
            if (typeof window.pushControl === "function") window.pushControl(table.id, "Table");
            saveCanvas(); canvas.requestRenderAll(); return table;
        }
        if (definition.create === "flip-card" && typeof window.openFlipRevealPresetEditor === "function") {
            window.openFlipRevealPresetEditor(null); return null;
        }
        if (definition.create === "connector") {
            var selected = canvas.getActiveObjects ? canvas.getActiveObjects() : [];
            if (selected.length >= 2 && window.ContentConnections) {
                var connection = window.ContentConnections.create(selected[0], selected[1], definition.defaultProps || {});
                if (connection) {
                    Object.assign(connection, metadata(definition), definition.defaultProps || {});
                    connection.sourceId = selected[0].id; connection.targetId = selected[1].id;
                    saveCanvas(); canvas.setActiveObject(connection); canvas.requestRenderAll();
                }
                return connection;
            }
        }
        if (definition.create === "animation") {
            var target = canvas.getActiveObject();
            if (target) {
                target.widgetAnimation = definition.type;
                target.set("dirty", true); saveCanvas(); canvas.requestRenderAll(); renderProperties(target); return target;
            }
        }
        var object = definition.category === "content" ? makeText(definition) : (definition.category === "shapes" ? makeShape(definition) : makeCard(definition));
        position(object, point);
        canvas.add(object); canvas.setActiveObject(object);
        if (typeof window.applyCanvasObjectActionControls === "function") window.applyCanvasObjectActionControls(object);
        if (typeof window.pushControl === "function") window.pushControl(object.id, object.type === "group" ? "Group" : object.type);
        saveCanvas(); canvas.requestRenderAll(); return object;
    }

    function renderProperties(object) {
        var host = document.getElementById("cgWidgetPropertiesBody");
        var panel = document.getElementById("cgWidgetProperties");
        if (!host || !panel) return;
        if (!object || !object.widgetType || object.type === "fabric-table") { panel.hidden = true; return; }
        panel.hidden = false;
        var data = object.widgetData || {};
        host.innerHTML = '<section><h4>Content</h4><label>Title<input data-widget-prop="title" value="' + escapeHtml(data.title || object.name || "") + '"></label><label>Content<textarea data-widget-prop="content">' + escapeHtml(data.content || object.text || "") + '</textarea></label></section>' +
            '<section><h4>Appearance</h4><label>Background<input type="color" data-widget-prop="background" value="' + escapeHtml(/^#[0-9a-f]{6}$/i.test(data.background || "") ? data.background : "#ffffff") + '"></label><label>Border<input type="color" data-widget-prop="border" value="' + escapeHtml(/^#[0-9a-f]{6}$/i.test(data.border || "") ? data.border : "#d0d5dd") + '"></label><label>Radius<input type="number" min="0" max="100" data-widget-prop="radius" value="' + Number(data.radius || 0) + '"></label></section>' +
            '<section><h4>Interaction</h4><label>Trigger<select data-object-prop="interactionType"><option value="none">None</option><option value="click">Click</option><option value="select">Select</option><option value="drag">Drag</option><option value="hover">Hover</option></select></label></section>' +
            '<section><h4>Assessment</h4><label>Score<input type="number" min="0" data-object-prop="score" value="' + Number(object.score || 0) + '"></label><label class="cg-widget-check"><input type="checkbox" data-object-prop="required" ' + (object.required ? "checked" : "") + '> Required</label></section>' +
            '<section><h4>Object</h4><div class="cg-widget-actions"><button data-widget-action="duplicate">Duplicate</button><button data-widget-action="lock">' + (object.locked ? "Unlock" : "Lock") + '</button><button data-widget-action="hide">' + (object.hidden ? "Show" : "Hide") + '</button><button data-widget-action="delete">Delete</button></div></section>';
        var select = host.querySelector('[data-object-prop="interactionType"]'); if (select) select.value = object.interactionType || "none";
    }

    function updateProperty(event) {
        var field = event.target.closest("[data-widget-prop], [data-object-prop]");
        var object = canvas && canvas.getActiveObject();
        if (!field || !object || !object.widgetType) return;
        if (field.dataset.objectProp) object[field.dataset.objectProp] = field.type === "checkbox" ? field.checked : (field.type === "number" ? Number(field.value) : field.value);
        else {
            object.widgetData = Object.assign({}, object.widgetData); object.widgetData[field.dataset.widgetProp] = field.type === "number" ? Number(field.value) : field.value;
            if (field.dataset.widgetProp === "content" && typeof object.set === "function" && object.type === "textbox") object.set("text", field.value);
            if (field.dataset.widgetProp === "background") object.set("fill", field.value);
            if (field.dataset.widgetProp === "border") object.set("stroke", field.value);
            if (field.dataset.widgetProp === "radius" && object.type === "rect") object.set({ rx: Number(field.value), ry: Number(field.value) });
        }
        object.set("dirty", true); saveCanvas(); canvas.requestRenderAll();
    }

    function performAction(event) {
        var button = event.target.closest("[data-widget-action]");
        var object = canvas && canvas.getActiveObject();
        if (!button || !object || !object.widgetType) return;
        var action = button.dataset.widgetAction;
        if (action === "delete") { canvas.remove(object); canvas.discardActiveObject(); }
        if (action === "duplicate") object.clone(customProperties).then(function (clone) { clone.set({ id: id(), left: object.left + 18, top: object.top + 18 }); canvas.add(clone); canvas.setActiveObject(clone); saveCanvas(); canvas.requestRenderAll(); });
        if (action === "lock") { object.locked = !object.locked; object.set({ lockMovementX: object.locked, lockMovementY: object.locked, lockScalingX: object.locked, lockScalingY: object.locked, lockRotation: object.locked }); }
        if (action === "hide") { object.hidden = !object.hidden; object.set({ opacity: object.hidden ? 0.15 : 1, evented: true }); }
        saveCanvas(); canvas.requestRenderAll(); renderProperties(object === canvas.getActiveObject() ? object : null);
    }

    function buildUi() {
        var workspace = document.querySelector(".cg-workspace");
        if (!workspace || document.getElementById("cgWidgetPanel")) return;
        var panel = document.createElement("aside"); panel.id = "cgWidgetPanel"; panel.className = "cg-widget-panel"; panel.hidden = true;
        panel.innerHTML = '<header><div><strong>Widgets</strong><small>LMS library</small></div><button type="button" data-widget-panel-close aria-label="Close widgets">×</button></header><label class="cg-widget-search"><i class="fa fa-search"></i><input type="search" placeholder="Search widgets..." aria-label="Search widgets"></label><div class="cg-widget-list"></div>';
        var properties = document.createElement("aside"); properties.id = "cgWidgetProperties"; properties.className = "cg-widget-properties"; properties.hidden = true;
        properties.innerHTML = '<header><div><strong>Properties</strong><small>Selected widget</small></div><button type="button" data-widget-properties-close aria-label="Close properties">×</button></header><div id="cgWidgetPropertiesBody"></div>';
        workspace.insertBefore(panel, workspace.firstChild); workspace.appendChild(properties);
        renderList("");
        panel.querySelector("input").addEventListener("input", function () { renderList(this.value); });
        panel.addEventListener("click", function (event) { var item = event.target.closest("[data-widget-type]"); if (item) add(registry.get(item.dataset.widgetType)); if (event.target.closest("[data-widget-panel-close]")) { var toggle = document.getElementById("cgWidgetsToggle"); panel.hidden = true; workspace.classList.remove("cg-workspace--widgets-open"); if (toggle) { toggle.classList.remove("is-active"); toggle.setAttribute("aria-expanded", "false"); toggle.title = "Show Widgets"; toggle.setAttribute("aria-label", "Show Widgets"); } } });
        panel.addEventListener("dragstart", function (event) { var item = event.target.closest("[data-widget-type]"); if (item) event.dataTransfer.setData("application/x-lms-widget", item.dataset.widgetType); });
        properties.addEventListener("input", updateProperty); properties.addEventListener("change", updateProperty); properties.addEventListener("click", function (event) { if (event.target.closest("[data-widget-properties-close]")) properties.hidden = true; else performAction(event); });
        removeTopWidgetMenu(); bindDrop();
    }

    function renderList(query) {
        var host = document.querySelector(".cg-widget-list"); if (!host) return;
        query = String(query || "").trim().toLowerCase();
        var categories = registry.categories();
        host.innerHTML = Object.keys(categories).map(function (category) {
            var items = registry.all().filter(function (item) { return item.category === category && (!query || (item.name + " " + item.type + " " + item.keywords.join(" ")).toLowerCase().indexOf(query) >= 0); });
            if (!items.length) return "";
            return '<section><h3>' + categories[category] + '</h3><div>' + items.map(function (item) { return '<button type="button" draggable="true" data-widget-type="' + item.type + '"><i class="fa ' + item.icon + '"></i><span>' + escapeHtml(item.name) + '</span></button>'; }).join("") + '</div></section>';
        }).join("");
    }

    function removeTopWidgetMenu() {
        /* STAMP: 2026-08-29
         * Widgets remain available to the runtime, but the standalone grid
         * launcher is intentionally excluded from the top authoring toolbar.
         * Remove an existing host as well so repeated/cached initialisation
         * cannot leave the deprecated control or an empty toolbar gap behind. */
        var button = document.getElementById("cgWidgetsToggle");
        var host = button && button.closest(".cg-widgets-toggle-host");
        if (host) host.remove();
        else if (button) button.remove();
    }

    function bindDrop() {
        var target = document.querySelector(".cg-canvas-stage") || document.getElementById("canvas-container"); if (!target) return;
        target.addEventListener("dragover", function (event) { if (event.dataTransfer.types.indexOf("application/x-lms-widget") >= 0) event.preventDefault(); });
        target.addEventListener("drop", function (event) { var type = event.dataTransfer.getData("application/x-lms-widget"); if (!type) return; event.preventDefault(); var rect = canvas.upperCanvasEl.getBoundingClientRect(); var point = new fabric.Point((event.clientX - rect.left) * canvas.getWidth() / rect.width, (event.clientY - rect.top) * canvas.getHeight() / rect.height); add(registry.get(type), point); });
    }

    function initialise() {
        var sharedCanvas = window.CGCanvas;
        if (!registry || !fabric || !sharedCanvas || typeof sharedCanvas.getWidth !== "function" || !document.querySelector(".cg-workspace")) return false;
        canvas = sharedCanvas;
        if (canvas.__lmsWidgetLibrary) return true;
        canvas.__lmsWidgetLibrary = true;
        if (window.ContentTableWidget) window.ContentTableWidget.initialise(canvas);
        /* Legacy saves frequently call canvas.toObject(["id"]). Extend the
         * established override once so LMS metadata survives every save path. */
        if (!fabric.Object.prototype.__lmsWidgetSerialization) {
            var inheritedToObject = fabric.Object.prototype.toObject;
            fabric.Object.prototype.toObject = function (propertiesToInclude) {
                return inheritedToObject.call(this, Array.from(new Set((propertiesToInclude || []).concat(customProperties, ["widgetAnimation"]))));
            };
            fabric.Object.prototype.__lmsWidgetSerialization = true;
        }
        buildUi();
        ["selection:created", "selection:updated"].forEach(function (name) { canvas.on(name, function (event) { renderProperties(event.selected && event.selected.length === 1 ? event.selected[0] : event.target); }); });
        canvas.on("selection:cleared", function () { renderProperties(null); });
        canvas.on("object:modified", saveCanvas); canvas.on("object:removed", saveCanvas);
        canvas.on("object:added", function (event) {
            var object = event.target;
            var definition = object && object.flipRevealComponent ? registry.get("flip-card") : (object && object.treeNodesComponent ? registry.get("tree-diagram") : null);
            if (definition && !object.widgetType) Object.assign(object, metadata(definition));
        });
        canvas.getObjects().forEach(function (object) {
            var definition = object.flipRevealComponent ? registry.get("flip-card") : (object.treeNodesComponent ? registry.get("tree-diagram") : null);
            if (definition && !object.widgetType) Object.assign(object, metadata(definition));
        });
        canvas.on("mouse:down", function (event) {
            var object = event.target;
            if (mode !== "preview" || !object || !object.widgetType || object.interactionType !== "click" || object.type !== "group") return;
            var parts = object.getObjects();
            if (parts[2] && parts[3]) {
                object.__learnerRevealed = !object.__learnerRevealed;
                parts[2].set("opacity", object.__learnerRevealed ? 0 : 1);
                parts[3].set({ opacity: 1, text: object.__learnerRevealed ? (object.widgetData.answer || "Revealed learning content") : (object.widgetData.content || "Click to reveal") });
                object.set("dirty", true); canvas.requestRenderAll();
            }
        });
        window.LMSWidgetLibrary = { add: function (type, point) { return add(registry.get(type), point); }, setMode: function (next) { mode = next; }, properties: customProperties.slice() };
        return true;
    }

    var timer = window.setInterval(function () { if (initialise()) window.clearInterval(timer); }, 100);
}(window, document));
