/**
 * LMS Widget Registry
 * STAMP: 2026-08-25
 * Declarative widget definitions consumed by the editor UI and Fabric factory.
 * Add future widgets with `register()`; the panel never needs to be rewritten.
 */
(function (window) {
    "use strict";

    var registry = [];
    var categoryLabels = {
        content: "Content", media: "Media", shapes: "Shapes", interactive: "Interactive Learning",
        assessment: "Assessment", diagram: "Diagram", drawing: "Drawing",
        gamification: "Gamification", animation: "Animation"
    };

    function slug(value) {
        return String(value || "").trim().toLowerCase().replace(/&/g, "and")
            .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    }

    function register(definition) {
        if (!definition || !definition.name || !definition.category) throw new Error("A widget needs a name and category.");
        var item = Object.assign({
            type: slug(definition.name), icon: "fa-square-o", interactionType: "none",
            defaultProps: {}, keywords: []
        }, definition);
        if (registry.some(function (entry) { return entry.type === item.type; })) return item;
        registry.push(Object.freeze(item));
        return item;
    }

    function addCategory(category, icon, names, options) {
        names.forEach(function (name) {
            var overrides = options && options[name] ? options[name] : {};
            register(Object.assign({ name: name, category: category, icon: icon }, overrides));
        });
    }

    addCategory("content", "fa-font", ["Text", "Heading", "Rich Text / Textbox", "Quote", "Callout", "Sticky Note", "Label", "Badge", "Numbered Marker"]);
    register({ name: "Table", type: "table", category: "content", icon: "fa-table", create: "table", keywords: ["rows", "columns", "cells", "grid"] });
    addCategory("media", "fa-picture-o", ["Image", "SVG", "Icon", "Video", "Audio", "Image Crop", "Image Mask"]);
    addCategory("shapes", "fa-square-o", ["Rectangle", "Rounded Rectangle", "Circle", "Ellipse", "Triangle", "Polygon", "Line", "Arrow", "Custom Path"]);
    addCategory("interactive", "fa-hand-pointer-o", ["Flip Card", "Flash Card", "Hotspot", "Tooltip", "Reveal Card", "Step Card", "Timeline", "Before / After", "Clickable Button"], {
        "Flip Card": { interactionType: "click", create: "flip-card" }
    });
    addCategory("assessment", "fa-check-square-o", ["Multiple Choice", "Multiple Select", "True / False", "Fill in Blank", "Short Answer", "Drag & Drop", "Matching", "Sorting", "Ordering", "Classification", "Image Choice", "Image Hotspot", "Label Diagram"], {
        "Multiple Choice": { interactionType: "select" }, "Multiple Select": { interactionType: "select" },
        "True / False": { interactionType: "select" }, "Drag & Drop": { interactionType: "drag" },
        "Matching": { interactionType: "drag" }, "Sorting": { interactionType: "drag" },
        "Ordering": { interactionType: "drag" }, "Classification": { interactionType: "drag" },
        "Image Choice": { interactionType: "select" }, "Image Hotspot": { interactionType: "click" }
    });
    addCategory("diagram", "fa-sitemap", ["Connector", "Smart Connector", "Elbow Connector", "Curved Connector", "Arrow Connector", "Anchor Points", "Ports", "Tree Node", "Tree Diagram", "Mind Map", "Concept Map", "Knowledge Graph", "Network Graph", "Flowchart", "Decision Tree", "Org Chart", "Swimlane"], {
        "Connector": { create: "connector", defaultProps: { connectionType: "straight" } },
        "Smart Connector": { create: "connector", defaultProps: { connectionType: "straight" } },
        "Elbow Connector": { create: "connector", defaultProps: { connectionType: "elbow" } },
        "Curved Connector": { create: "connector", defaultProps: { connectionType: "curved" } },
        "Arrow Connector": { create: "connector", defaultProps: { connectionType: "straight", arrowEnd: true } }
    });
    addCategory("drawing", "fa-pencil", ["Pencil", "Marker", "Highlighter", "Eraser"]);
    addCategory("gamification", "fa-trophy", ["Reward Badge", "Star Rating", "Progress Bar", "Progress Ring", "Timer", "Memory Cards", "Scratch Card", "Spin Wheel"], {
        "Memory Cards": { interactionType: "click" }, "Scratch Card": { interactionType: "drag" }, "Spin Wheel": { interactionType: "click" }
    });
    addCategory("animation", "fa-magic", ["Fade", "Slide", "Zoom", "Rotate", "Pulse", "Bounce", "Motion Path"], {
        "Fade": { create: "animation" }, "Slide": { create: "animation" }, "Zoom": { create: "animation" },
        "Rotate": { create: "animation" }, "Pulse": { create: "animation" }, "Bounce": { create: "animation" },
        "Motion Path": { create: "animation" }
    });

    window.LMSWidgetRegistry = Object.freeze({
        register: register,
        all: function () { return registry.slice(); },
        get: function (type) { return registry.find(function (item) { return item.type === type; }) || null; },
        categories: function () { return Object.assign({}, categoryLabels); }
    });
}(window));
