/**
 * Content Generator keyboard shortcuts.
 * STAMP: 2026-09-14
 *
 * Keep shortcut metadata in these registries so behavior and tutorial content
 * stay synchronized. General shortcuts must not depend on a selected object;
 * text shortcuts continue to act only on the selected editable text.
 */
(function (window, document) {
    "use strict"

    const DEFAULT_FONT_SIZE = 30
    const FONT_SIZE_STEP = 1
    const CANVAS_SURFACE_STORAGE_PREFIX = "iaotcore.content-generator.canvas-surface.v1"
    const CANVAS_SURFACE_PLAIN_CLASS = "cg-canvas-surface-plain"
    const GENERAL_SHORTCUTS = [{ id: "toggle-canvas-surface", key: "g", modifier: false, alt: false, shift: true, label: "Shift+G", description: "Toggle the editor canvas background between dotted and plain white." }]
    const TEXT_SHORTCUTS = [
        { id: "bold", key: "b", shift: false, label: "Ctrl+B", description: "Toggle bold or normal text." },
        { id: "italic", key: "u", shift: false, label: "Ctrl+U", description: "Toggle italic or normal text." },
        { id: "underline", key: "u", shift: true, label: "Ctrl+Shift+U", description: "Toggle underline on or off." },
        { id: "strike", key: "s", shift: false, label: "Ctrl+S", description: "Toggle strikethrough on or off." },
        { id: "increase-font-size", key: "i", shift: false, label: "Ctrl+I", description: "Increase the font size by 1." },
        { id: "decrease-font-size", key: "d", shift: false, label: "Ctrl+D", description: "Decrease the font size by 1." },
        { id: "original-font-size", key: "o", shift: false, label: "Ctrl+O", description: "Restore the original 30-point font size." }
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

    const COMMANDS = {
        bold (editorCanvas, object) {
            const weight = getEffectiveValue(object, "fontWeight")
            const isBold = weight === "bold" || Number(weight) >= 600
            applyTextStyle(editorCanvas, object, { fontWeight: isBold ? "400" : "700" })
            return true
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

    const GENERAL_COMMANDS = {
        "toggle-canvas-surface": toggleCanvasSurface
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

    function handleKeydown(event) {
        if (event.repeat) return
        const pressedKey = String(event.key || "").toLowerCase()
        const generalShortcut = GENERAL_SHORTCUTS.find(function (item) {
            return item.key === pressedKey && item.modifier === Boolean(event.ctrlKey || event.metaKey)
                && item.alt === Boolean(event.altKey) && item.shift === Boolean(event.shiftKey)
        })
        const generalCommand = generalShortcut && GENERAL_COMMANDS[generalShortcut.id]
        if (generalCommand && isAllowedGeneralShortcutTarget(event.target)) {
            event.preventDefault()
            event.stopPropagation()
            generalCommand()
            return
        }
        if (!(event.ctrlKey || event.metaKey) || event.altKey || !isAllowedKeyboardTarget(event.target)
            || typeof hdnincanvas === "undefined" || hdnincanvas !== "1") return
        const editorCanvas = getEditorCanvas()
        const object = editorCanvas && editorCanvas.getActiveObject()
        if (!isTextObject(object) || isLocked(object)) return
        const shortcut = TEXT_SHORTCUTS.find(function (item) {
            return item.key === pressedKey && item.shift === Boolean(event.shiftKey)
        })
        const command = shortcut && COMMANDS[shortcut.id]
        if (!command) return
        event.preventDefault()
        event.stopPropagation()
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
        }
    }
    applyCanvasSurfacePreference(readCanvasSurfacePreference())
    document.addEventListener("keydown", handleKeydown, true)
})(window, document)
