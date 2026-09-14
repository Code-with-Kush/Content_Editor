/* eslint-disable */
/**
 * Shared ContentGenerator font catalog and loader.
 *
 * STAMP: 2026-09-11 - Editor and preview/player surfaces must resolve the
 * same family names and Google Font weights before Fabric SVG text is shown.
 */
(function (window) {
    "use strict";

    var groups = {
        "Preferred": ["Arial", "Arial Black", "Impact"],
        "Modern": ["Inter", "Manrope", "DM Sans", "Plus Jakarta Sans", "Outfit", "Space Grotesk", "Poppins", "Montserrat", "Lato", "Roboto", "Nunito"],
        "Handwritten & Cursive": ["Caveat", "Dancing Script", "Kalam", "Patrick Hand", "Pacifico", "Satisfy", "Gochi Hand", "Schoolbell", "Coming Soon", "Segoe Print", "Comic Sans MS"],
        "Display & Serif": ["Playfair Display", "Cormorant Garamond", "Anton", "Righteous", "Alfa Slab One", "Orbitron", "Georgia", "Garamond"],
        "System & Classic": ["Calibri", "Cambria", "Courier New", "Tahoma", "Times New Roman", "Trebuchet MS", "Verdana"]
    };
    var systemGroups = ["Preferred", "System & Classic"];

    function unique(values) {
        return values.filter(function (value, index, list) {
            return value && list.indexOf(value) === index;
        });
    }

    function list() {
        return unique(Object.keys(groups).reduce(function (fonts, groupName) {
            return fonts.concat(groups[groupName]);
        }, []));
    }

    function isSystemFont(font) {
        return systemGroups.some(function (groupName) {
            return groups[groupName].indexOf(font) >= 0;
        }) || font === "Segoe Print" || font === "Comic Sans MS";
    }

    function extractFamilies(payload) {
        var found = [];
        var seen = [];
        function add(value) {
            String(value || "").split(",").forEach(function (family) {
                family = family.replace(/["']/g, "").trim();
                if (family && !/^(serif|sans-serif|monospace|cursive|fantasy)$/i.test(family)) found.push(family);
            });
        }
        function visit(value) {
            if (!value || typeof value !== "object" || seen.indexOf(value) >= 0) return;
            seen.push(value);
            if (value.fontFamily) add(value.fontFamily);
            Object.keys(value).forEach(function (key) { visit(value[key]); });
        }
        visit(payload);
        (Array.isArray(payload) ? payload : []).forEach(function (slide) {
            var svg = String(slide && slide.svg || "");
            try { svg = decodeURIComponent(svg); } catch (error) { /* Keep already-decoded SVG. */ }
            svg.replace(/font-family=(?:"([^"]+)"|'([^']+)')/gi, function (match, doubleQuoted, singleQuoted) {
                add(doubleQuoted || singleQuoted);
                return match;
            });
            svg.replace(/font-family\s*:\s*([^;"']+)/gi, function (match, family) {
                add(family);
                return match;
            });
        });
        return unique(found);
    }

    function load(families, done) {
        var webFonts = unique((families || []).filter(function (font) { return !isSystemFont(font); }));
        var finish = typeof done === "function" ? done : function () {};
        if (!webFonts.length || !window.WebFont) {
            finish();
            return;
        }
        window.WebFont.load({
            google: { families: webFonts.map(function (font) { return font + ":100,200,300,400,500,600,700,800,900"; }) },
            active: finish,
            inactive: finish
        });
    }

    window.CGFontRuntime = { groups: groups, list: list(), isSystemFont: isSystemFont, extractFamilies: extractFamilies, load: load };
})(window);
