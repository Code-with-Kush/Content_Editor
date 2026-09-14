/**
 * Rehydrate native ContentGenerator component groups after Fabric JSON load.
 * STAMP: 2026-08-19
 */
(function (window) {
    "use strict";
    function findObject(canvas, id) {
        return canvas.getObjects().find(function (object) { return object && object.id === id; });
    }
    function buildFlipCard(saved) {
        var fabric = window.fabric;
        var width = Number(saved.flipRevealCardWidth) || 320;
        var height = Number(saved.flipRevealCardHeight) || 190;
        var id = saved.id;
        var frontId = id + "_front";
        var backId = id + "_back";
        var border = saved.flipRevealBorderColor || "#f59e0b";
        var common = { left: -width / 2, top: -height / 2, width: width, height: height,
            rx: 18, ry: 18, strokeWidth: 2, originX: "left", originY: "top" };
        var objects = [
            new fabric.Rect(Object.assign({}, common, { id: frontId + "_panel", flipRevealRole: "frontPanel",
                fill: saved.flipRevealFrontColor || "#1f2937", stroke: border })),
            new fabric.Textbox(saved.flipRevealFrontText || "Click to reveal", { id: frontId + "_text",
                flipRevealRole: "frontText", left: -width * .4, top: -Math.min(48, height * .24), width: width * .8,
                fontFamily: "Arial", fontSize: Math.max(18, Math.min(28, width / 13)), fontWeight: "700",
                fill: saved.flipRevealFrontTextColor || "#ffffff", textAlign: "center" }),
            new fabric.Textbox("Click to reveal", { id: frontId + "_hint", flipRevealRole: "frontHint",
                left: -width * .28, top: height * .23, width: width * .56, fontFamily: "Arial", fontSize: 15,
                fill: border, textAlign: "center" }),
            new fabric.Rect(Object.assign({}, common, { id: backId + "_panel", flipRevealRole: "backPanel",
                fill: saved.flipRevealBackColor || "#fff7ed", stroke: border, opacity: 0 })),
            new fabric.Textbox(saved.flipRevealBackText || "Add your answer here.", { id: backId + "_text",
                flipRevealRole: "backText", left: -width * .4, top: -Math.min(36, height * .18), width: width * .8,
                fontFamily: "Arial", fontSize: Math.max(17, Math.min(26, width / 14)), fontWeight: "700",
                fill: saved.flipRevealBackTextColor || "#7c2d12", textAlign: "center", opacity: 0 })
        ];
        return new fabric.Group(objects, {
            id: id, name: "Flip Card", flipRevealComponent: true,
            flipRevealFrontText: saved.flipRevealFrontText, flipRevealBackText: saved.flipRevealBackText,
            flipRevealFrontColor: saved.flipRevealFrontColor, flipRevealFrontTextColor: saved.flipRevealFrontTextColor,
            flipRevealBackColor: saved.flipRevealBackColor, flipRevealBackTextColor: saved.flipRevealBackTextColor,
            flipRevealBorderColor: border, flipRevealCardWidth: width, flipRevealCardHeight: height,
            left: Number(saved.left) || 0, top: Number(saved.top) || 0, angle: Number(saved.angle) || 0,
            scaleX: Number(saved.scaleX) || 1, scaleY: Number(saved.scaleY) || 1,
            flipX: !!saved.flipX, flipY: !!saved.flipY, opacity: saved.opacity == null ? 1 : Number(saved.opacity),
            subTargetCheck: false, transparentCorners: true
        });
    }

    window.restoreContentGeneratorComponents = function (canvas, json) {
        var source = json || {};
        if (typeof source === "string") {
            try {
                source = JSON.parse(source);
            } catch (error) {
                console.warn("Flip Card revival skipped: invalid canvas JSON", error);
                return false;
            }
        }
        var records = Array.isArray(source.objects) ? source.objects : [];
        records.filter(function (item) { return item && (item.flipRevealComponent || item.name === "Flip Card"); })
            .forEach(function (saved) {
                var loaded = findObject(canvas, saved.id);
                if (loaded) {
                    Object.keys(saved).filter(function (key) { return key.indexOf("flipReveal") === 0; })
                        .forEach(function (key) { loaded.set(key, saved[key]); });
                    loaded.set({ name: "Flip Card", flipRevealComponent: true });
                    if (typeof window.applyCanvasObjectActionControls === "function") window.applyCanvasObjectActionControls(loaded);
                    loaded.setCoords();
                    return;
                }
                var restored = buildFlipCard(saved);
                canvas.add(restored);
                if (typeof window.applyCanvasObjectActionControls === "function") window.applyCanvasObjectActionControls(restored);
            });
        canvas.requestRenderAll();
        return true;
    };
}(window));
