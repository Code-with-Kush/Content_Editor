/**
 * Content Generator keyboard shortcuts.
 * STAMP: 2026-09-14
 *
 * Keep shortcut metadata in these registries so behavior and tutorial content
 * stay synchronized. General commands can use any supported object type;
 * text shortcuts continue to act only on the selected editable text.
 */
(function (window, document) {
    "use strict"

    const DEFAULT_FONT_SIZE = 30
    const FONT_SIZE_STEP = 1
    const FONT_WEIGHT_STEP = 100
    const CANVAS_SURFACE_STORAGE_PREFIX = "iaotcore.content-generator.canvas-surface.v1"
    const CANVAS_SURFACE_PLAIN_CLASS = "cg-canvas-surface-plain"
    // STAMP: 2026-09-16 - Shared general-command metadata drives tutorial labels.
    const GENERAL_SHORTCUTS = [
        { id: "toggle-canvas-surface", key: "g", modifier: false, alt: false, shift: true, label: "Shift+G", description: "Toggle the editor canvas background between dotted and plain white." },
        { id: "format-painter", key: "p", modifier: false, alt: true, shift: false, label: "Alt+P", description: "Start Format Painter from one selected object; press again to cancel. Click a matching object to apply its style." },
        { id: "cancel-format-painter", key: "escape", modifier: false, alt: false, shift: false, label: "Escape", description: "Cancel active Format Painter without applying formatting." }
    ]
    const TEXT_SHORTCUTS = [
        { id: "bold", key: "b", shift: false, label: "Alt+B", description: "Toggle bold or normal text." },
        { id: "increase-font-weight", key: "q", shift: false, label: "Alt+Q", description: "Increase font weight from thin toward thick." },
        { id: "decrease-font-weight", key: "w", shift: false, label: "Alt+W", description: "Decrease font weight from thick toward thin." },
        { id: "italic", key: "i", shift: false, label: "Alt+I", description: "Toggle italic or normal text." },
        { id: "underline", key: "u", shift: false, label: "Alt+U", description: "Toggle underline on or off." },
        { id: "strike", key: "s", shift: false, label: "Alt+S", description: "Toggle strikethrough on or off." },
        { id: "increase-font-size", key: "e", shift: false, label: "Alt+E", description: "Increase the font size by 1." },
        { id: "decrease-font-size", key: "r", shift: false, label: "Alt+R", description: "Decrease the font size by 1." },
        { id: "original-font-size", key: "o", shift: false, label: "Alt+O", description: "Restore the original 30-point font size." },
        { id: "uppercase", key: "u", shift: true, label: "Alt+Shift+U", description: "Caps on: convert selected text to UPPERCASE." },
        { id: "lowercase", key: "l", shift: true, label: "Alt+Shift+L", description: "Caps off: convert selected text to lowercase." },
        { id: "camel-case", key: "c", shift: true, label: "Alt+Shift+C", description: "Make the first letter uppercase (hello world becomes Hello world). Apply to highlighted text or, without a character selection, each line of the selected text object." }
    ]

    function getEditorCanvas() {
        return typeof canvas !== "undefined" && canvas && typeof canvas.getActiveObject === "function" ? canvas : null
    }

    function getPreferenceUserId() {
        try {
            const userData = JSON.parse(window.sessionStorage.getItem("userData") || "{}")
            const userId = userData.userID || userData.userId || userData.UserID || userData.id || userData.uid || userData.code || userData.email
            return String(userId || "anonymous").trim() || "anonymous"
        } catch (error) {
            return "anonymous"
        }
    }

    function getCanvasSurfaceStorageKey() {
        return `${CANVAS_SURFACE_STORAGE_PREFIX}.${getPreferenceUserId()}`
    }

    function readCanvasSurfacePreference() {
        try {
            return window.localStorage.getItem(getCanvasSurfaceStorageKey()) === "plain"
        } catch (error) {
            return false
        }
    }

    function saveCanvasSurfacePreference(isPlain) {
        try {
            window.localStorage.setItem(getCanvasSurfaceStorageKey(), isPlain ? "plain" : "dotted")
        } catch (error) {
            /* Storage can be unavailable in restricted browser contexts. */
        }
    }

    function applyCanvasSurfacePreference(isPlain) {
        document.body.classList.toggle(CANVAS_SURFACE_PLAIN_CLASS, isPlain)
        document.body.dataset.cgCanvasSurface = isPlain ? "plain" : "dotted"
    }

    function toggleCanvasSurface() {
        const isPlain = !document.body.classList.contains(CANVAS_SURFACE_PLAIN_CLASS)
        applyCanvasSurfacePreference(isPlain)
        saveCanvasSurfacePreference(isPlain)
        return true
    }

    const GENERAL_COMMANDS = {
        "toggle-canvas-surface": toggleCanvasSurface,
        "format-painter" () {
            if (window.CGIsFormatPainterActive?.()) return window.CGCancelFormatPainter?.() === true
            const source = getEditorCanvas()?.getActiveObject()
            if (!source || source.isEditing || String(source.type).toLowerCase() === "activeselection") return false
            return window.CGStartFormatPainter?.(source) === true
        },
        "cancel-format-painter" () {
            return window.CGCancelFormatPainter?.() === true
        }
    }

    function isTextObject(object) {
        const type = String((object && object.type) || "").toLowerCase()
        return type === "text" || type === "textbox" || type === "i-text"
    }

    function isLocked(object) {
        return typeof window.CGIsCanvasObjectLocked === "function" ? window.CGIsCanvasObjectLocked(object) : Boolean(object && object.lockMovementX && object.lockMovementY
                && object.lockScalingX && object.lockScalingY && object.lockRotation)
    }

    function hasSelectedCharacters(object) {
        return Boolean(object && object.isEditing && object.selectionStart !== object.selectionEnd
            && typeof object.setSelectionStyles === "function")
    }

    function getEffectiveValue(object, property) {
        if (hasSelectedCharacters(object) && typeof object.getSelectionStyles === "function") {
            const styles = object.getSelectionStyles(object.selectionStart, object.selectionEnd, true) || []
            for (let index = 0; index < styles.length; index += 1) {
                if (styles[index] && styles[index][property] !== undefined) return styles[index][property]
            }
        }
        return object ? object[property] : undefined
    }

    function applyTextStyle(editorCanvas, object, styles) {
        if (hasSelectedCharacters(object)) object.setSelectionStyles(styles, object.selectionStart, object.selectionEnd)
        else object.set(styles)
        object.dirty = true
        object.setCoords()
        editorCanvas.requestRenderAll()
        editorCanvas.fire("object:modified", { target: object })
    }

    function applyFontSize(object, size) {
        if (typeof window.CGApplyCanvasFontSize !== "function") return false
        return window.CGApplyCanvasFontSize(Math.max(1, Math.min(200, size)), true)
    }

    /** STAMP: 2026-09-14 - Step selected text safely across the supported 100-900 weight scale. */
    function applyFontWeight(editorCanvas, object, weight) {
        const normalizedWeight = Math.max(100, Math.min(900, weight))
        if (typeof window.CGApplyTextFontWeight === "function") {
            window.CGApplyTextFontWeight(object, normalizedWeight)
            return true
        }
        applyTextStyle(editorCanvas, object, { fontWeight: String(normalizedWeight) })
        return true
    }

    function getNumericFontWeight(object) {
        const value = getEffectiveValue(object, "fontWeight")
        if (typeof window.CGNormalizeTextFontWeight === "function") return window.CGNormalizeTextFontWeight(value)
        if (value === "bold") return 700
        if (value === "normal") return 400
        const numericWeight = Number(value)
        return Number.isFinite(numericWeight) ? Math.max(100, Math.min(900, Math.round(numericWeight / 100) * 100)) : 400
    }

    /** STAMP: 2026-09-16 - Case conversion retains source-character styles,
     * Unicode expansions, logical lines, native list markers and authored geometry.
     * A selected editing range owns the conversion; otherwise use the whole text.
     */
    function applyTextCase(editorCanvas, object, mode) {
        if (object.inCompositionMode) return false
        const split = window.fabric.util.string.graphemeSplit
        const source = split(object.text || "")
        const selected = hasSelectedCharacters(object)
        const start = selected ? object.selectionStart : 0
        const end = selected ? object.selectionEnd : source.length
        const paints = object.getSelectionStyles(0, source.length)
        const output = [], styles = {}, boundaries = [0]
        let line = 0, column = 0, lineStart = 0, firstLetterChanged = false
        let markerLength = 0
        source.forEach(function (character, index) {
            if (index === lineStart) {
                const logicalLine = source.slice(index).join("").split("\n")[0]
                const listStyle = object.cgTextListStyle
                const marker = listStyle === "alpha" ? (logicalLine.match(/^[A-Z]+\. /) || [""])[0] : listStyle === "numbered" ? (logicalLine.match(/^\d+\. /) || [""])[0] : window.CGTextLists?.prefix(listStyle, 0) || ""
                markerLength = marker && logicalLine.startsWith(marker) ? split(marker).length : 0
            }
            let replacement = character
            if (index >= start && index < end && index >= lineStart + markerLength && character !== "\n") {
                if (mode === "uppercase") replacement = character.toUpperCase()
                else if (mode === "lowercase") replacement = character.toLowerCase()
                // STAMP: 2026-09-16 - Alt+Shift+C capitalizes the first
                // letter while retaining spaces, punctuation and remaining text.
                else if (!firstLetterChanged && character.toUpperCase() !== character.toLowerCase()) {
                    replacement = character.toUpperCase()
                    firstLetterChanged = true
                }
            }
            split(replacement).forEach(function (value) {
                output.push(value)
                if (value === "\n") { line++; column = 0 } else {
                    if (paints[index] && Object.keys(paints[index]).length) {
                        if (!styles[line]) styles[line] = {}
                        styles[line][column] = { ...paints[index] }
                    }
                    column++
                }
            })
            boundaries.push(output.length)
            if (character === "\n") { lineStart = index + 1; firstLetterChanged = false }
        })
        const text = output.join("")
        if (text === object.text) return false
        const geometry = { left: object.left, top: object.top }
        if (String(object.type).toLowerCase() === "textbox") geometry.width = object.width
        object.set({ text, styles, ...geometry })
        if (object.isEditing) {
            object.selectionStart = boundaries[Math.min(object.selectionStart, source.length)]
            object.selectionEnd = boundaries[Math.min(object.selectionEnd, source.length)]
            if (object.hiddenTextarea) {
                object.hiddenTextarea.value = text
                object._updateTextarea()
            }
        }
        object.dirty = true
        if (object.group) object.group.dirty = true
        object.setCoords()
        object.fire("changed")
        editorCanvas.fire("text:changed", { target: object })
        editorCanvas.fire("object:modified", { target: object })
        editorCanvas.requestRenderAll()
        return true
    }

    const COMMANDS = {
        uppercase (editorCanvas, object) { return applyTextCase(editorCanvas, object, "uppercase") },
        lowercase (editorCanvas, object) { return applyTextCase(editorCanvas, object, "lowercase") },
        "camel-case" (editorCanvas, object) { return applyTextCase(editorCanvas, object, "camel-case") },
        bold (editorCanvas, object) {
            const weight = getEffectiveValue(object, "fontWeight")
            const isBold = weight === "bold" || Number(weight) >= 600
            applyTextStyle(editorCanvas, object, { fontWeight: isBold ? "400" : "700" })
            return true
        },
        "increase-font-weight" (editorCanvas, object) {
            return applyFontWeight(editorCanvas, object, getNumericFontWeight(object) + FONT_WEIGHT_STEP)
        },
        "decrease-font-weight" (editorCanvas, object) {
            return applyFontWeight(editorCanvas, object, getNumericFontWeight(object) - FONT_WEIGHT_STEP)
        },
        italic (editorCanvas, object) {
            applyTextStyle(editorCanvas, object, {
                fontStyle: getEffectiveValue(object, "fontStyle") === "italic" ? "normal" : "italic"
            })
            return true
        },
        underline (editorCanvas, object) {
            const value = getEffectiveValue(object, "underline")
            applyTextStyle(editorCanvas, object, { underline: !(value === true || value === "true") })
            return true
        },
        strike (editorCanvas, object) {
            const value = getEffectiveValue(object, "linethrough")
            applyTextStyle(editorCanvas, object, { linethrough: !(value === true || value === "true") })
            return true
        },
        "increase-font-size" (editorCanvas, object) {
            return applyFontSize(object, (Number(getEffectiveValue(object, "fontSize")) || DEFAULT_FONT_SIZE) + FONT_SIZE_STEP)
        },
        "decrease-font-size" (editorCanvas, object) {
            return applyFontSize(object, (Number(getEffectiveValue(object, "fontSize")) || DEFAULT_FONT_SIZE) - FONT_SIZE_STEP)
        },
        "original-font-size" (editorCanvas, object) {
            return applyFontSize(object, DEFAULT_FONT_SIZE)
        }
    }

    function isAllowedKeyboardTarget(target) {
        if (!target) return true
        if (target.matches && target.matches("textarea[data-fabric]")) return true
        return !(/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)
    }

    function isAllowedGeneralShortcutTarget(target) {
        if (!target) return true
        return !(/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)
    }

    /**
     * STAMP: 2026-09-14 - Detect canvas pointer/focus before Alt-based text
     * commands can escape to browser or operating-system menu handling.
     */
    function isCanvasInteractionActive() {
        const container = document.getElementById("canvas-container")
        if (!container) return false
        const pointerInside = typeof container.matches === "function" && container.matches(":hover")
        const focusInside = document.activeElement && typeof container.contains === "function"
            && container.contains(document.activeElement)
        return Boolean(pointerInside || focusInside)
    }

    function handleGeneralShortcut(event) {
        if (!event || event.repeat || !isAllowedGeneralShortcutTarget(event.target)) return false
        const physicalKey = /^Key[A-Z]$/.test(event.code || "") ? event.code.slice(3).toLowerCase() : ""
        const pressedKey = physicalKey || String(event.key || "").toLowerCase()
        const shortcut = GENERAL_SHORTCUTS.find(function (item) {
            return item.key === pressedKey && item.modifier === Boolean(event.ctrlKey || event.metaKey)
                && item.alt === Boolean(event.altKey) && item.shift === Boolean(event.shiftKey)
        })
        if (!shortcut) return false
        const active = getEditorCanvas()?.getActiveObject()
        if (active?.isEditing) return false
        const command = GENERAL_COMMANDS[shortcut.id]
        if (!command || command() !== true) return false
        event.preventDefault()
        event.stopImmediatePropagation()
        return true
    }

    function handleKeydown(event) {
        if (event.repeat) return
        // STAMP: 2026-09-16 - Reserve general commands before legacy/browser
        // handlers, while form fields and native text editing keep their keys.
        if (handleGeneralShortcut(event)) return
        const physicalKey = /^Key[A-Z]$/.test(event.code || "") ? event.code.slice(3).toLowerCase() : ""
        const pressedKey = physicalKey || String(event.key || "").toLowerCase()
        /* STAMP: 2026-09-14 - An active text selection owns its formatting
         * shortcuts even after the pointer leaves the canvas. The previous
         * hdnincanvas hover gate silently disabled keyboard formatting as soon
         * as the user moved the pointer outside #canvas-container. */
        if (!event.altKey || event.ctrlKey || event.metaKey || !isAllowedKeyboardTarget(event.target)) return
        const shortcut = TEXT_SHORTCUTS.find(function (item) {
            return item.key === pressedKey && item.shift === Boolean(event.shiftKey)
        })
        const command = shortcut && COMMANDS[shortcut.id]
        if (!command) return

        /* Reserve known text commands at the window capture boundary while the
         * canvas is active, before browser or operating-system menu handling. */
        const canvasInteractionActive = isCanvasInteractionActive()
        if (canvasInteractionActive) {
            event.preventDefault()
            event.stopImmediatePropagation()
        }
        const editorCanvas = getEditorCanvas()
        const object = editorCanvas && editorCanvas.getActiveObject()
        if (!isTextObject(object) || isLocked(object)) return
        if (!canvasInteractionActive) {
            event.preventDefault()
            event.stopImmediatePropagation()
        }
        command(editorCanvas, object)
    }

    window.CGTextShortcuts = {
        items: TEXT_SHORTCUTS.map(function (item) {
            return { id: item.id, label: item.label, description: item.description }
        })
    }
    window.CGGeneralShortcuts = {
        items: GENERAL_SHORTCUTS.map(function (item) {
            return { id: item.id, label: item.label, macLabel: item.macLabel, description: item.description }
        }),
        toggleCanvasSurface,
        isCanvasSurfacePlain () {
            return document.body.classList.contains(CANVAS_SURFACE_PLAIN_CLASS)
        },
        isAllowedTarget: isAllowedGeneralShortcutTarget,
        handleKeydown: handleGeneralShortcut
    }
    applyCanvasSurfacePreference(readCanvasSurfacePreference())
    /* Window capture runs before document/Fabric handlers and browser defaults. */
    window.addEventListener("keydown", handleKeydown, true)
})(window, document)
