/**
 * Fallback persistence bridge for native Fabric components.
 * STAMP: 2026-08-19
 * Activates only when the legacy controller did not finish registering its
 * normal SAVE_CONTENT_DATA handler; the parent message contract is unchanged.
 */
(function (window) {
    "use strict";

    function serializeCurrentDeck() {
        if (typeof window.fabricUpdatedContent === "function") {
            return window.fabricUpdatedContent();
        }
        var canvas = window.canvas;
        var slides = window.generated_slides;
        var index = Number(window.slide_index);
        if (!canvas || !Array.isArray(slides) || index < 0 || !slides[index]) {
            throw new Error("The current page is not ready to save.");
        }

        canvas.discardActiveObject();
        canvas.requestRenderAll();
        var slide = slides[index];
        slide.jsonobj = canvas.toObject(["id"]);
        try { slide.svg = encodeURIComponent(canvas.toSVG()); } catch (_) { /* JSON remains authoritative. */ }
        try { slide.imgprev = canvas.toDataURL(); } catch (_) { /* Keep the previous thumbnail. */ }
        if (Array.isArray(window.slide_actions)) slide.actions = window.slide_actions;
        if (typeof slide.HTMlcontent !== "string") slide.HTMlcontent = "";
        return JSON.stringify(slides);
    }

    window.addEventListener("message", function (event) {
        var data = event.data || {};
        if (data.type !== "SAVE_CONTENT_DATA" || window.__cgLegacySaveBridgeReady) return;
        try {
            var contentData = serializeCurrentDeck();
            var thumbnail = "";
            try { thumbnail = window.canvas ? window.canvas.toDataURL({ multiplier: .31 }) : ""; } catch (_) { thumbnail = ""; }
            event.source.postMessage({
                type: "SAVE_CONTENT_DATA_RESPONSE",
                contentData: contentData,
                thumbnailImage: thumbnail
            }, event.origin);
        } catch (error) {
            console.error("Component page save failed", error);
            event.source.postMessage({
                type: "SAVE_CONTENT_DATA_RESPONSE",
                contentData: null,
                error: error && error.message ? error.message : "Unable to save page content."
            }, event.origin);
        }
    });
}(window));
