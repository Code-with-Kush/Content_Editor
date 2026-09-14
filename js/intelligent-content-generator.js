/**
 * Intelligent Content Generator
 * STAMP: 2026-09-04
 *
 * Creates editable Fabric.js page layouts from a written brief or a reference
 * image. AI requests travel through the authenticated React parent so model
 * credentials remain server-side. The model returns a constrained semantic
 * plan; this module remains the only code allowed to create Fabric objects.
 */
(function () {
    "use strict";

    var state = { mode: "replace", attachments: [], reference: null, referenceUrl: "", replacementRecords: [], replacementUrls: [], confirmPageReplace: false };
    var MAX_FILE_BYTES = 20 * 1024 * 1024;
    var MAX_TOTAL_BYTES = 40 * 1024 * 1024;
    var MAX_ATTACHMENTS = 5;
    var ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
    var ALLOWED_FILE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "pdf", "txt", "md", "doc", "docx", "ppt", "pptx"];
    var PAGE_REPLACE_WARNING_KEY = "cg-intelligent-page-replace-warning-seen";

    function byId(id) { return document.getElementById(id); }
    function uid(prefix) { return prefix + "_ai_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
    function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
    function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }

    /**
     * STAMP: 2026-08-19
     * Remember the destructive page-replacement warning for this browser tab
     * so authors confirm it once without weakening the first-use safeguard.
     */
    function hasSeenPageReplaceWarning() {
        try {
            return window.sessionStorage.getItem(PAGE_REPLACE_WARNING_KEY) === "true";
        } catch (error) {
            return false;
        }
    }

    function rememberPageReplaceWarning() {
        try {
            window.sessionStorage.setItem(PAGE_REPLACE_WARNING_KEY, "true");
        } catch (error) {
            // Storage can be unavailable in restricted/private browser contexts.
        }
    }

    function setStatus(message, type) {
        var status = byId("intelligentContentStatus");
        status.textContent = message || "";
        status.className = "cg-intelligent-modal__status" + (type ? " is-" + type : "");
    }

    function setMode(mode) {
        state.mode = mode;
        state.confirmPageReplace = false;
        var isReplace = mode === "replace";
        byId("intelligentPromptPanel").hidden = !isReplace;
        byId("intelligentImagePanel").hidden = isReplace;
        byId("intelligentGenerationOptions").hidden = isReplace;
        byId("intelligentSharedImageSection").hidden = isReplace;
        byId("intelligentImageHelp").textContent = isReplace
            ? "Use the fields below to replace content without moving the layout."
            : "AI uses attached documents and images as source context.";
        var generateButton = byId("generateIntelligentContent");
        generateButton.querySelector("i").className = isReplace ? "fa fa-refresh" : "fa fa-magic";
        generateButton.querySelector("span").textContent = isReplace ? "Replace content" : "Generate page";
        ["Prompt", "Image"].forEach(function (name) {
            var active = (name === "Prompt" && isReplace) || (name === "Image" && !isReplace);
            var button = byId("intelligent" + name + "Mode");
            button.classList.toggle("is-active", active);
            button.setAttribute("aria-selected", String(active));
        });
        setStatus("");
    }

    function getFileExtension(file) {
        return String(file && file.name || "").split(".").pop().toLowerCase();
    }

    function formatBytes(bytes) {
        return bytes >= 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(1) + " MB" : Math.max(1, Math.round(bytes / 1024)) + " KB";
    }

    function syncPrimaryReference() {
        if (state.referenceUrl) URL.revokeObjectURL(state.referenceUrl);
        state.reference = state.attachments.find(function (file) { return ALLOWED_IMAGE_TYPES.indexOf(file.type) !== -1; }) || null;
        state.referenceUrl = state.reference ? URL.createObjectURL(state.reference) : "";
    }

    function renderAttachments() {
        var container = byId("intelligentImagePreview");
        container.replaceChildren();
        state.attachments.forEach(function (file, index) {
            var row = makeElement("div", "cg-intelligent-modal__attachment");
            var icon = makeElement("span", "cg-intelligent-modal__attachment-icon");
            icon.appendChild(makeElement("i", "fa " + (ALLOWED_IMAGE_TYPES.indexOf(file.type) !== -1 ? "fa-picture-o" : "fa-file-text-o")));
            var copy = makeElement("span", "cg-intelligent-modal__attachment-copy");
            copy.appendChild(makeElement("strong", "", file.name));
            copy.appendChild(makeElement("span", "", formatBytes(file.size)));
            var remove = makeElement("button", "cg-intelligent-modal__attachment-remove");
            remove.type = "button";
            remove.setAttribute("aria-label", "Remove " + file.name);
            remove.appendChild(makeElement("i", "fa fa-times"));
            remove.addEventListener("click", function () {
                state.attachments.splice(index, 1);
                syncPrimaryReference();
                renderAttachments();
            });
            row.appendChild(icon);
            row.appendChild(copy);
            row.appendChild(remove);
            container.appendChild(row);
        });
        container.hidden = !state.attachments.length;
        byId("intelligentImageDropzone").hidden = state.attachments.length >= MAX_ATTACHMENTS;
        byId("intelligentReferenceImage").value = "";
    }

    function selectReferences(fileList) {
        var files = Array.from(fileList || []);
        if (!files.length) return;
        var available = MAX_ATTACHMENTS - state.attachments.length;
        var accepted = files.slice(0, available).filter(function (file) {
            return ALLOWED_FILE_EXTENSIONS.indexOf(getFileExtension(file)) !== -1 && file.size <= MAX_FILE_BYTES;
        });
        var nextTotal = state.attachments.concat(accepted).reduce(function (total, file) { return total + file.size; }, 0);
        if (!accepted.length) {
            setStatus("Choose a supported file no larger than 20 MB.", "error");
            return;
        }
        if (nextTotal > MAX_TOTAL_BYTES) {
            setStatus("Attachments can be up to 40 MB in total.", "error");
            return;
        }
        state.attachments = state.attachments.concat(accepted);
        syncPrimaryReference();
        renderAttachments();
        setStatus(state.attachments.length + " source file" + (state.attachments.length === 1 ? " is" : "s are") + " ready for AI context.", "success");
    }

    function parseBrief(value) {
        var raw = String(value || "").trim();
        var sentences = raw.split(/(?:\r?\n|(?<=[.!?])\s+)/).map(clean).filter(Boolean);
        var explicitTitle = raw.match(/(?:title(?:d)?|heading)\s*[:\-]?\s*["']?([^\n.!?"']{3,80})/i);
        var title = explicitTitle ? clean(explicitTitle[1]) : (sentences[0] || "New learning page");
        title = title.replace(/^(?:create|make|design|build)\s+(?:an?\s+)?(?:content\s+)?page\s+(?:about|on|for)\s+/i, "");
        title = title.replace(/^(?:about|on)\s+/i, "").replace(/[.:;]$/, "");
        if (title.length > 72) title = title.slice(0, 69).replace(/\s+\S*$/, "") + "…";

        var pointSource = raw.replace(/(?:title(?:d)?|heading)\s*[:\-]?\s*["']?[^\n.!?"']{3,80}/i, "");
        var points = pointSource.split(/(?:\r?\n|\s*[;*]\s*|,\s+(?=(?:and\s+)?[a-z]+\s))/i)
            .map(function (item) { return clean(item.replace(/^[-*\d.)\s]+/, "")); })
            .filter(function (item) { return item.length > 5 && item.toLowerCase() !== title.toLowerCase(); });
        if (!points.length) points = sentences.slice(1);
        if (!points.length && raw) points = [raw];
        return { title: title || "New learning page", points: points.slice(0, 4) };
    }

    function luminance(rgb) { return (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000; }
    function rgb(rgbValue) { return "rgb(" + rgbValue.join(",") + ")"; }
    function lighten(value, amount) { return value.map(function (channel) { return clamp(Math.round(channel + (255 - channel) * amount), 0, 255); }); }

    function loadImage(url) {
        return new Promise(function (resolve, reject) {
            var image = new Image();
            image.onload = function () { resolve(image); };
            image.onerror = function () { reject(new Error("The reference image could not be read.")); };
            image.src = url;
        });
    }

    function readFileAsDataUrl(file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () { resolve(String(reader.result || "")); };
            reader.onerror = function () { reject(new Error("The replacement image could not be read.")); };
            reader.readAsDataURL(file);
        });
    }

    function analyzeImage(image) {
        var sampler = document.createElement("canvas");
        var context = sampler.getContext("2d", { willReadFrequently: true });
        sampler.width = 32;
        sampler.height = 32;
        context.drawImage(image, 0, 0, 32, 32);
        var pixels = context.getImageData(0, 0, 32, 32).data;
        var buckets = {};
        for (var index = 0; index < pixels.length; index += 16) {
            if (pixels[index + 3] < 180) continue;
            var color = [pixels[index], pixels[index + 1], pixels[index + 2]];
            var key = color.map(function (channel) { return Math.round(channel / 32) * 32; }).join(",");
            buckets[key] = (buckets[key] || 0) + 1;
        }
        var dominant = Object.keys(buckets).sort(function (a, b) { return buckets[b] - buckets[a]; })[0];
        var base = dominant ? dominant.split(",").map(Number) : [31, 38, 43];
        var dark = luminance(base) < 145;
        return {
            base: rgb(base),
            soft: rgb(lighten(base, dark ? 0.15 : 0.72)),
            text: dark ? "#ffffff" : "#16201c",
            muted: dark ? "#d3ddd8" : "#3f4b46",
            accent: rgb(lighten(base, dark ? 0.5 : 0.08))
        };
    }

    function addObject(object, type) {
        object.set({ id: uid(type.toLowerCase()), objectCaching: false });
        canvas.add(object);
        if (typeof pushControl === "function") pushControl(object.id, type);
        return object;
    }

    function addText(text, options) {
        return addObject(new fabric.Textbox(text, Object.assign({
            fontFamily: "Arial", fill: "#17201c", editable: true, splitByGrapheme: false,
            lineHeight: 1.1, padding: 4
        }, options)), "Textbox");
    }

    function addRect(options) {
        return addObject(new fabric.Rect(Object.assign({ selectable: true, rx: 0, ry: 0 }, options)), "Rectangle");
    }

    function clearCanvasSafely() {
        canvas.discardActiveObject();
        canvas.getObjects().slice().forEach(function (object) { canvas.remove(object); });
        if (Array.isArray(slide_controls)) slide_controls.length = 0;
        if (Array.isArray(slide_actions)) slide_actions.length = 0;
        if (Array.isArray(slide_load_actions)) slide_load_actions.length = 0;
        if (Array.isArray(slide_groups)) slide_groups.length = 0;
    }

    function renderFeatureLayout(brief, palette, image) {
        var hasImage = !!image;
        canvas.set("backgroundColor", palette.base);
        addRect({ left: 0, top: 0, width: hasImage ? 520 : 943, height: 442, fill: palette.base, selectable: false, evented: false });
        addRect({ left: 44, top: 42, width: 38, height: 5, rx: 2, ry: 2, fill: palette.accent });
        addText(brief.title, { left: 44, top: 68, width: hasImage ? 420 : 600, fontSize: brief.title.length > 44 ? 37 : 45, fontWeight: "700", fill: palette.text });
        var points = brief.points.length ? brief.points : ["Add supporting content here."];
        points.slice(0, 3).forEach(function (point, index) {
            var top = 224 + index * 58;
            addText(String(index + 1).padStart(2, "0"), { left: 44, top: top, width: 34, fontSize: 14, fontWeight: "700", fill: palette.accent });
            addText(point, { left: 92, top: top - 2, width: hasImage ? 370 : 720, fontSize: 17, fill: palette.muted, lineHeight: 1.2 });
        });
        if (hasImage) addReferenceImage(image, 548, 28, 367, 386, 14);
    }

    function renderEditorialLayout(brief, palette, image) {
        canvas.set("backgroundColor", "#f4f2ec");
        addRect({ left: 0, top: 0, width: 943, height: 442, fill: "#f4f2ec", selectable: false, evented: false });
        if (image) addReferenceImage(image, 0, 0, 462, 442, 0);
        var start = image ? 510 : 70;
        addText("LEARNING NOTE", { left: start, top: 52, width: 310, fontSize: 12, charSpacing: 170, fontWeight: "700", fill: palette.base });
        addText(brief.title, { left: start, top: 91, width: image ? 370 : 660, fontFamily: "Georgia", fontSize: brief.title.length > 42 ? 37 : 46, fontWeight: "700", fill: "#17201c", lineHeight: 1.02 });
        addRect({ left: start, top: 211, width: 56, height: 3, fill: palette.base });
        addText(brief.points.join("\n\n") || "Add supporting content here.", { left: start, top: 239, width: image ? 360 : 700, fontSize: 16, fill: "#46504b", lineHeight: 1.35 });
    }

    function renderStatementLayout(brief, palette, image) {
        canvas.set("backgroundColor", palette.base);
        addRect({ left: 0, top: 0, width: 943, height: 442, fill: palette.base, selectable: false, evented: false });
        if (image) {
            addReferenceImage(image, 0, 0, 943, 442, 0);
            addRect({ left: 0, top: 0, width: 943, height: 442, fill: "rgba(0,0,0,.48)", selectable: false, evented: false });
        }
        addText(brief.title, { left: 70, top: 104, width: 800, fontSize: brief.title.length > 44 ? 48 : 62, fontWeight: "700", fill: "#ffffff", textAlign: "center", lineHeight: 1.02 });
        var supporting = brief.points.slice(0, 2).join("  |  ");
        if (supporting) addText(supporting, { left: 150, top: 292, width: 640, fontSize: 17, fill: "#edf3f0", textAlign: "center", lineHeight: 1.3 });
    }

    function addReferenceImage(image, left, top, boxWidth, boxHeight, radius) {
        var scale = Math.max(boxWidth / image.naturalWidth, boxHeight / image.naturalHeight);
        var object = new fabric.Image(image, {
            left: left, top: top, scaleX: scale, scaleY: scale,
            cropX: Math.max(0, (image.naturalWidth - boxWidth / scale) / 2),
            cropY: Math.max(0, (image.naturalHeight - boxHeight / scale) / 2),
            width: Math.min(image.naturalWidth, boxWidth / scale),
            height: Math.min(image.naturalHeight, boxHeight / scale),
            rx: radius, ry: radius
        });
        addObject(object, "Image");
    }

    function clearReplacementUrls() {
        state.replacementUrls.forEach(function (url) { URL.revokeObjectURL(url); });
        state.replacementUrls = [];
    }

    function makeElement(tagName, className, textValue) {
        var element = document.createElement(tagName);
        if (className) element.className = className;
        if (typeof textValue === "string") element.textContent = textValue;
        return element;
    }

    function getObjectMeta(object) {
        return "X " + Math.round(Number(object.left) || 0) + " | Y " + Math.round(Number(object.top) || 0);
    }

    function collectReplaceableObjects(objects, result) {
        objects.forEach(function (object) {
            var type = String(object.type || "").toLowerCase();
            if (object.visible !== false && (["textbox", "i-text", "text", "image"].indexOf(type) !== -1)) {
                result.push(object);
            }
            if (object.visible !== false && typeof object.getObjects === "function") {
                collectReplaceableObjects(object.getObjects(), result);
            }
        });
        return result;
    }

    function appendTextReplacement(container, object, kind, number) {
        var record = { object: object, kind: kind, original: String(object.text || "") };
        var card = makeElement("div", "cg-intelligent-object");
        var cardHeader = makeElement("div", "cg-intelligent-object__header");
        var type = makeElement("div", "cg-intelligent-object__type");
        type.appendChild(makeElement("i", "fa " + (kind === "heading" ? "fa-header" : "fa-align-left")));
        type.appendChild(document.createTextNode((kind === "heading" ? "Heading " : "Paragraph ") + number));
        cardHeader.appendChild(type);
        cardHeader.appendChild(makeElement("span", "cg-intelligent-object__meta", getObjectMeta(object)));
        card.appendChild(cardHeader);
        var input = makeElement(kind === "heading" ? "input" : "textarea");
        if (kind === "heading") {
            input.type = "text";
            input.maxLength = 500;
        } else {
            input.rows = 4;
            input.maxLength = 5000;
            input.setAttribute("aria-label", "Paragraph editor " + number);
        }
        input.value = record.original;
        record.input = input;
        card.appendChild(input);
        container.appendChild(card);
        state.replacementRecords.push(record);
    }

    function appendImageReplacement(container, object, number) {
        var record = { object: object, kind: "image", file: null, previewUrl: "", sourceUrl: "" };
        var card = makeElement("div", "cg-intelligent-object");
        var cardHeader = makeElement("div", "cg-intelligent-object__header");
        var type = makeElement("div", "cg-intelligent-object__type");
        type.appendChild(makeElement("i", "fa fa-picture-o"));
        type.appendChild(document.createTextNode("Image " + number));
        cardHeader.appendChild(type);
        cardHeader.appendChild(makeElement("span", "cg-intelligent-object__meta", getObjectMeta(object)));
        card.appendChild(cardHeader);
        var imageRow = makeElement("div", "cg-intelligent-object__image");
        var preview = makeElement("img", "cg-intelligent-object__preview");
        preview.alt = "Current image " + number;
        if (typeof object.getSrc === "function") preview.src = object.getSrc();
        var upload = makeElement("label", "cg-intelligent-object__upload");
        upload.appendChild(makeElement("strong", "", "Choose replacement image"));
        upload.appendChild(makeElement("span", "", "JPG, PNG or WebP | maximum 10 MB"));
        var input = makeElement("input");
        input.type = "file";
        input.accept = ".jpg,.jpeg,.png,.webp";
        input.hidden = true;
        input.addEventListener("change", async function () {
            var file = input.files[0];
            if (!file) return;
            if (ALLOWED_IMAGE_TYPES.indexOf(file.type) === -1 || file.size > MAX_IMAGE_BYTES) {
                input.value = "";
                setStatus(file.size > MAX_IMAGE_BYTES ? "The image must be 10 MB or smaller." : "Choose a JPG, PNG or WebP image.", "error");
                return;
            }
            if (record.previewUrl) URL.revokeObjectURL(record.previewUrl);
            record.file = file;
            record.previewUrl = URL.createObjectURL(file);
            state.replacementUrls.push(record.previewUrl);
            preview.src = record.previewUrl;
            upload.querySelector("strong").textContent = file.name;
            try {
                record.sourceUrl = await readFileAsDataUrl(file);
                setStatus("Image " + number + " is ready to replace.", "success");
            } catch (error) {
                record.file = null;
                record.sourceUrl = "";
                input.value = "";
                setStatus(error.message, "error");
            }
        });
        upload.appendChild(input);
        imageRow.appendChild(preview);
        imageRow.appendChild(upload);
        card.appendChild(imageRow);
        container.appendChild(card);
        state.replacementRecords.push(record);
    }

    /** STAMP: 2026-08-18 - Build one replacement field per active-slide text/image object. */
    function populateReplacementFields() {
        if (typeof canvas === "undefined" || !canvas) return;
        clearReplacementUrls();
        state.replacementRecords = [];
        var container = byId("intelligentReplacementFields");
        container.replaceChildren();
        var objects = collectReplaceableObjects(canvas.getObjects(), []);
        var textObjects = objects.filter(function (object) {
            return ["textbox", "i-text", "text"].indexOf(String(object.type || "").toLowerCase()) !== -1;
        }).sort(function (a, b) { return (Number(a.top) || 0) - (Number(b.top) || 0); });
        var imageObjects = objects.filter(function (object) { return String(object.type || "").toLowerCase() === "image"; });
        var maximumFontSize = textObjects.length ? Math.max.apply(null, textObjects.map(function (object) { return Number(object.fontSize) || 16; })) : 0;
        var headingCount = 0;
        var paragraphCount = 0;
        textObjects.forEach(function (object) {
            var weight = parseInt(object.fontWeight, 10) || (String(object.fontWeight).toLowerCase() === "bold" ? 700 : 400);
            var isHeading = (Number(object.fontSize) || 16) >= maximumFontSize * 0.82 && (weight >= 600 || clean(object.text).length <= 160);
            if (isHeading) appendTextReplacement(container, object, "heading", ++headingCount);
            else appendTextReplacement(container, object, "paragraph", ++paragraphCount);
        });
        imageObjects.forEach(function (object, index) { appendImageReplacement(container, object, index + 1); });
        byId("intelligentDetectedSummary").textContent = textObjects.length + " text object" + (textObjects.length === 1 ? "" : "s")
            + " and " + imageObjects.length + " image" + (imageObjects.length === 1 ? "" : "s") + " detected";
        if (!state.replacementRecords.length) {
            container.appendChild(makeElement("div", "cg-intelligent-object__empty", "No replaceable text or image objects were found on this slide."));
        }
    }

    function notifyObjectChanged(object) {
        object.setCoords();
        if (object.group) object.group.dirty = true;
        object.dirty = true;
    }

    /**
     * STAMP: 2026-08-19
     * Commit a complete modal-driven replacement once at slide level. The
     * legacy interactive object:modified handler requires an active selection,
     * so firing it for background modal edits causes an undefined `.get()`
     * error and performs redundant persistence work for every object.
     */
    function commitSlideReplacement() {
        canvas.requestRenderAll();
        if (Array.isArray(generated_slides) && generated_slides[slide_index]) {
            generated_slides[slide_index].jsonobj = canvas.toObject(["id"]);
            generated_slides[slide_index].imgprev = canvas.toDataURL();
            generated_slides[slide_index].svg = encodeURIComponent(canvas.toSVG());
        }
        if (typeof updateSlideThumbnail === "function" && typeof selected_slide_id !== "undefined") {
            updateSlideThumbnail(selected_slide_id, canvas.toDataURL());
        }
        if (typeof updateCanvasState === "function") updateCanvasState();
        if (typeof LoadTimeline === "function") LoadTimeline();
        if (typeof syncBlankSlideActions === "function") syncBlankSlideActions();
    }

    function collectSerializedObjects(objects, result) {
        (Array.isArray(objects) ? objects : []).forEach(function (object) {
            if (!object || object.visible === false) return;
            var type = String(object.type || "").toLowerCase();
            if (["textbox", "i-text", "text", "image"].indexOf(type) !== -1) result.push(object);
            if (Array.isArray(object.objects)) collectSerializedObjects(object.objects, result);
        });
        return result;
    }

    async function refreshSerializedSlidePreview(slide) {
        if (!slide || !slide.jsonobj || typeof fabric === "undefined" || !fabric.StaticCanvas) return;
        var previewElement = document.createElement("canvas");
        var previewCanvas = new fabric.StaticCanvas(previewElement, {
            width: canvas.getWidth(),
            height: canvas.getHeight(),
            enableRetinaScaling: true,
            renderOnAddRemove: false
        });
        try {
            await previewCanvas.loadFromJSON(slide.jsonobj);
            previewCanvas.requestRenderAll();
            slide.imgprev = previewCanvas.toDataURL({ format: "png", multiplier: 1 });
            slide.svg = encodeURIComponent(previewCanvas.toSVG());
            if (typeof updateSlideThumbnail === "function") updateSlideThumbnail(slide.id, slide.imgprev);
        } finally {
            previewCanvas.dispose();
        }
    }

    /**
     * STAMP: 2026-08-19
     * Apply only explicitly edited fields to corresponding object positions in
     * every other slide. Serialized mutation preserves each slide's layout,
     * actions, identifiers, animation metadata, and all unrelated objects.
     */
    async function applyChangesToAllSlides(changes) {
        if (!Array.isArray(generated_slides) || generated_slides.length < 2) return 0;
        var changedSlides = 0;

        for (var index = 0; index < generated_slides.length; index += 1) {
            var slide = generated_slides[index];
            if (!slide || slide.id === selected_slide_id || !slide.jsonobj) continue;
            var serialized;
            try {
                serialized = typeof slide.jsonobj === "string" ? JSON.parse(slide.jsonobj) : slide.jsonobj;
            } catch (error) {
                continue;
            }
            if (!serialized || !Array.isArray(serialized.objects)) continue;
            var replaceable = collectSerializedObjects(serialized.objects, []);
            var textObjects = replaceable.filter(function (object) { return String(object.type || "").toLowerCase() !== "image"; });
            var imageObjects = replaceable.filter(function (object) { return String(object.type || "").toLowerCase() === "image"; });
            var slideChanged = false;

            changes.text.forEach(function (change) {
                if (!textObjects[change.index]) return;
                textObjects[change.index].text = change.value;
                slideChanged = true;
            });
            changes.images.forEach(function (change) {
                if (!imageObjects[change.index]) return;
                var target = imageObjects[change.index];
                var boxWidth = Math.max(1, (Number(target.width) || 1) * (Number(target.scaleX) || 1));
                var boxHeight = Math.max(1, (Number(target.height) || 1) * (Number(target.scaleY) || 1));
                var coverScale = Math.max(boxWidth / change.naturalWidth, boxHeight / change.naturalHeight);
                var cropWidth = Math.min(change.naturalWidth, boxWidth / coverScale);
                var cropHeight = Math.min(change.naturalHeight, boxHeight / coverScale);
                target.src = change.sourceUrl;
                target.width = cropWidth;
                target.height = cropHeight;
                target.cropX = Math.max(0, (change.naturalWidth - cropWidth) / 2);
                target.cropY = Math.max(0, (change.naturalHeight - cropHeight) / 2);
                target.scaleX = boxWidth / cropWidth;
                target.scaleY = boxHeight / cropHeight;
                slideChanged = true;
            });

            if (!slideChanged) continue;
            slide.jsonobj = serialized;
            await refreshSerializedSlidePreview(slide);
            changedSlides += 1;
        }
        return changedSlides;
    }

    /**
     * Swap the image pixels while retaining the original Fabric object's ID,
     * z-order, origin, coordinates, angle and visible bounding-box dimensions.
     */
    /**
     * STAMP: 2026-08-19
     * Replace a Fabric image through its supported async source API. The
     * rendered box and all transform properties stay unchanged, including for
     * images nested in groups on the active slide.
     */
    async function replaceImageSource(target, sourceUrl) {
        if (!target || typeof target.set !== "function") throw new Error("An image object is no longer available on this slide.");

        var boxWidth = Math.max(1, Number(target.getScaledWidth ? target.getScaledWidth() : target.width * target.scaleX) || 1);
        var boxHeight = Math.max(1, Number(target.getScaledHeight ? target.getScaledHeight() : target.height * target.scaleY) || 1);

        if (typeof target.setSrc === "function") {
            await target.setSrc(sourceUrl);
        } else {
            target.setElement(await loadImage(sourceUrl));
        }

        var element = target.getElement ? target.getElement() : target._element;
        var naturalWidth = Math.max(1, Number(element && (element.naturalWidth || element.width)) || Number(target.width) || 1);
        var naturalHeight = Math.max(1, Number(element && (element.naturalHeight || element.height)) || Number(target.height) || 1);
        var coverScale = Math.max(boxWidth / naturalWidth, boxHeight / naturalHeight);
        var cropWidth = Math.min(naturalWidth, boxWidth / coverScale);
        var cropHeight = Math.min(naturalHeight, boxHeight / coverScale);

        target.set({
            width: cropWidth,
            height: cropHeight,
            cropX: Math.max(0, (naturalWidth - cropWidth) / 2),
            cropY: Math.max(0, (naturalHeight - cropHeight) / 2),
            scaleX: boxWidth / cropWidth,
            scaleY: boxHeight / cropHeight,
            objectCaching: false,
            dirty: true
        });
        notifyObjectChanged(target);
    }

    async function replaceExistingContent() {
        var changes = [];
        var bulkChanges = { text: [], images: [] };
        var textIndex = 0;
        var imageIndex = 0;
        for (var index = 0; index < state.replacementRecords.length; index += 1) {
            var record = state.replacementRecords[index];
            if (record.kind === "image" && record.file) {
                if (!record.sourceUrl) throw new Error("Wait for the selected replacement image to finish loading.");
                await replaceImageSource(record.object, record.sourceUrl);
                changes.push("image");
                var imageElement = record.object.getElement ? record.object.getElement() : record.object._element;
                bulkChanges.images.push({
                    index: imageIndex,
                    sourceUrl: record.sourceUrl,
                    naturalWidth: Math.max(1, Number(imageElement && (imageElement.naturalWidth || imageElement.width)) || 1),
                    naturalHeight: Math.max(1, Number(imageElement && (imageElement.naturalHeight || imageElement.height)) || 1)
                });
            } else if (record.kind !== "image" && record.input.value !== record.original) {
                record.object.set("text", record.input.value);
                notifyObjectChanged(record.object);
                changes.push(record.kind);
                bulkChanges.text.push({ index: textIndex, value: record.input.value });
            }
            if (record.kind === "image") imageIndex += 1;
            else textIndex += 1;
        }
        if (!changes.length) {
            setStatus("Change at least one text field or choose a replacement image.", "error");
            return false;
        }
        commitSlideReplacement();
        var updatedOtherSlides = byId("intelligentApplyAllSlides").checked
            ? await applyChangesToAllSlides(bulkChanges)
            : 0;
        var slideMessage = updatedOtherSlides ? " across " + (updatedOtherSlides + 1) + " slides" : "";
        setStatus(changes.length + " object" + (changes.length === 1 ? " was" : "s were") + " replaced" + slideMessage + " without changing the layout.", "success");
        return true;
    }

    function chooseLayout(request) {
        if (request.layout !== "auto") return request.layout;
        if (request.image && request.brief.title.length < 38) return "editorial";
        if (request.brief.points.length >= 2) return "feature";
        return "statement";
    }

    function normalizeHexColor(value, fallback) {
        var color = String(value || "").trim();
        return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
    }

    /** STAMP: 2026-09-04 - Treat all model output as untrusted data before it reaches Fabric. */
    function normalizeAiPlan(plan, fallbackRequest) {
        var source = plan && typeof plan === "object" ? plan : {};
        var sourceBrief = source.brief && typeof source.brief === "object" ? source.brief : source;
        var fallbackBrief = fallbackRequest.brief;
        var points = Array.isArray(sourceBrief.points) ? sourceBrief.points : (Array.isArray(sourceBrief.bullets) ? sourceBrief.bullets : fallbackBrief.points);
        var layout = ["auto", "editorial", "feature", "statement"].indexOf(source.layout) !== -1 ? source.layout : fallbackRequest.layout;
        var paletteSource = source.palette && typeof source.palette === "object" ? source.palette : {};
        return {
            prompt: fallbackRequest.prompt,
            image: fallbackRequest.image,
            layout: layout,
            brief: {
                title: clean(sourceBrief.title || fallbackBrief.title).slice(0, 120) || fallbackBrief.title,
                points: points.map(clean).filter(Boolean).slice(0, 4)
            },
            palette: {
                base: normalizeHexColor(paletteSource.base, "#20272b"),
                soft: normalizeHexColor(paletteSource.soft, "#36423d"),
                text: normalizeHexColor(paletteSource.text, "#ffffff"),
                muted: normalizeHexColor(paletteSource.muted, "#ced8d3"),
                accent: normalizeHexColor(paletteSource.accent, "#72e6b5")
            }
        };
    }

    function summarizeCurrentSlide() {
        if (!canvas || typeof canvas.getObjects !== "function") return [];
        return collectReplaceableObjects(canvas.getObjects(), []).filter(function (object) {
            return ["textbox", "i-text", "text"].indexOf(String(object.type || "").toLowerCase()) !== -1;
        }).map(function (object) { return clean(object.text).slice(0, 1000); }).filter(Boolean).slice(0, 20);
    }

    /**
     * Ask the authenticated React host to call the server-side AI endpoint.
     * File objects are cloned by postMessage; API keys never enter this iframe.
     */
    function requestAiPlan(request) {
        return new Promise(function (resolve, reject) {
            var requestId = uid("content_request");
            var timeout = window.setTimeout(function () {
                window.removeEventListener("message", onResponse);
                reject(new Error("AI generation timed out. Please try again."));
            }, 90000);
            function onResponse(event) {
                if (event.source !== window.parent || !event.data || event.data.requestId !== requestId) return;
                if (event.data.type !== "AI_CONTENT_GENERATION_SUCCESS" && event.data.type !== "AI_CONTENT_GENERATION_ERROR") return;
                window.clearTimeout(timeout);
                window.removeEventListener("message", onResponse);
                if (event.data.type === "AI_CONTENT_GENERATION_ERROR") reject(new Error(event.data.error || "AI generation failed."));
                else resolve(event.data.payload);
            }
            window.addEventListener("message", onResponse);
            window.parent.postMessage({
                type: "AI_CONTENT_GENERATION_REQUEST",
                requestId: requestId,
                payload: {
                    prompt: request.prompt,
                    layout: request.layout,
                    currentSlideText: summarizeCurrentSlide(),
                    attachments: state.attachments.slice()
                }
            }, window.location.origin);
        });
    }

    window.CGIntelligentContentProvider = { generate: requestAiPlan };

    async function generate() {
        if (typeof canvas === "undefined" || !canvas || typeof fabric === "undefined") {
            setStatus("The canvas is still loading. Please try again in a moment.", "error");
            return;
        }
        var isReplace = state.mode === "replace";
        var prompt = isReplace ? "" : byId("intelligentImageContext").value;
        if (!isReplace && clean(prompt).length < 8) {
            setStatus("Describe the new page in at least a few words.", "error");
            byId("intelligentImageContext").focus();
            return;
        }
        var button = byId("generateIntelligentContent");
        var replace = byId("intelligentCanvasMode").value === "replace";
        var needsPageReplaceWarning = replace && canvas.getObjects().length && !hasSeenPageReplaceWarning();
        if (needsPageReplaceWarning && !state.confirmPageReplace) {
            state.confirmPageReplace = true;
            setStatus("Replace the current page? Existing canvas objects will be removed. Click Confirm replace to continue.", "warning");
            button.querySelector("span").textContent = "Confirm replace";
            return;
        }
        if (needsPageReplaceWarning && state.confirmPageReplace) rememberPageReplaceWarning();
        state.confirmPageReplace = false;

        button.disabled = true;
        button.querySelector("span").textContent = "Generating…";
        setStatus(isReplace ? "Replacing content while preserving the layout…" : "Building editable Fabric objects…");
        try {
            if (isReplace) {
                var replaced = await replaceExistingContent();
                if (!replaced) return;
                return;
            }
            var image = state.referenceUrl ? await loadImage(state.referenceUrl) : null;
            var request = {
                prompt: prompt,
                brief: parseBrief(prompt || "Visual learning page"),
                image: image,
                layout: byId("intelligentLayoutStyle").value
            };
            var palette = image ? analyzeImage(image) : { base: "#20272b", soft: "#36423d", text: "#ffffff", muted: "#ced8d3", accent: "#72e6b5" };
            var provider = window.CGIntelligentContentProvider;
            if (!provider || typeof provider.generate !== "function") throw new Error("The AI content service is not available.");
            request = normalizeAiPlan(await provider.generate(request), request);
            palette = request.palette || palette;
            if (replace) clearCanvasSafely();
            var layout = chooseLayout(request);
            if (layout === "editorial") renderEditorialLayout(request.brief, palette, image);
            else if (layout === "statement") renderStatementLayout(request.brief, palette, image);
            else renderFeatureLayout(request.brief, palette, image);
            canvas.requestRenderAll();
            if (typeof LoadTimeline === "function") LoadTimeline();
            if (typeof syncBlankSlideActions === "function") syncBlankSlideActions();
            setStatus("Page generated. Select any object on the canvas to refine it.", "success");
        } catch (error) {
            setStatus(error && error.message ? error.message : "The page could not be generated.", "error");
        } finally {
            button.disabled = false;
            button.querySelector("span").textContent = isReplace ? "Replace content" : "Generate page";
        }
    }

    document.addEventListener("DOMContentLoaded", function () {
        byId("intelligentPromptMode").addEventListener("click", function () { setMode("replace"); populateReplacementFields(); });
        byId("intelligentImageMode").addEventListener("click", function () { setMode("create"); });
        byId("intelligentImageDropzone").addEventListener("click", function () { byId("intelligentReferenceImage").click(); });
        byId("intelligentReferenceImage").addEventListener("change", function (event) { selectReferences(event.target.files); });
        byId("generateIntelligentContent").addEventListener("click", generate);
        byId("intelligentImageContext").addEventListener("input", function (event) {
            byId("intelligentPromptCount").textContent = event.target.value.length + " / 4000";
        });
        byId("intelligentCanvasMode").addEventListener("change", function () {
            state.confirmPageReplace = false;
            setStatus("");
            var isReplace = state.mode === "replace";
            byId("generateIntelligentContent").querySelector("span").textContent = isReplace ? "Replace content" : "Generate page";
        });
        ["dragenter", "dragover"].forEach(function (name) {
            byId("intelligentImageDropzone").addEventListener(name, function (event) { event.preventDefault(); event.currentTarget.classList.add("is-dragging"); });
        });
        ["dragleave", "drop"].forEach(function (name) {
            byId("intelligentImageDropzone").addEventListener(name, function (event) { event.preventDefault(); event.currentTarget.classList.remove("is-dragging"); });
        });
        byId("intelligentImageDropzone").addEventListener("drop", function (event) { selectReferences(event.dataTransfer.files); });
    });

    function showForActiveSlide() {
        // STAMP: 2026-09-04 - Open on AI generation so the prompt/context fields are immediately visible.
        setMode("create");
        byId("intelligentApplyAllSlides").checked = false;
        populateReplacementFields();
        bootstrap.Modal.getOrCreateInstance(byId("intelligentContentModal")).show();
    }

    /** Open from a slide action menu and ensure that slide owns the replacement form. */
    window.openIntelligentContentForSlide = function (slideId, event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        setStatus("");
        if (typeof selected_slide_id !== "undefined" && selected_slide_id !== slideId && typeof changeSlide === "function") {
            changeSlide(slideId, false, false, false);
            window.setTimeout(showForActiveSlide, 250);
            return;
        }
        showForActiveSlide();
    };
})();
