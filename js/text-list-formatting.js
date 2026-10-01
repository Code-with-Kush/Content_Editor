/** STAMP: 2026-09-16 - Editable lists for existing Fabric text objects.
 * Markers are native text, so canvas/SVG/JSON share the same result. Only this
 * component's known prefix is removed; body text, edits, blank lines, character
 * styles and the object's identity/geometry are retained. Registry owns labels
 * and markers for both behaviour and toolbar choices.
 */
(function (root) {
    "use strict"
    const choices = [
        { id: "round", label: "Round bullet", marker: "\u2022", category: "Bullets" },
        { id: "hollow-round", label: "Hollow circle", marker: "\u25cb", category: "Bullets" },
        { id: "square", label: "Square bullet", marker: "\u25aa", category: "Bullets" },
        { id: "diamond", label: "Diamond", marker: "\u25c6", category: "Bullets" },
        { id: "arrow", label: "Arrow", marker: "\u203a", category: "Bullets" },
        { id: "check", label: "Check mark", marker: "\u2713", category: "Bullets" },
        { id: "star", label: "Star", marker: "\u2605", category: "Bullets" },
        { id: "dash", label: "Dash", marker: "\u2013", category: "Bullets" },
        { id: "numbered", label: "Numbered list", marker: "1.", category: "Ordered" },
        { id: "alpha", label: "Lettered list", marker: "A.", category: "Ordered" }
    ]
    const byId = {}
    choices.forEach(function (choice) { byId[choice.id] = choice })
    function alpha(index) {
        let result = ""
        for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
            result = String.fromCharCode(65 + ((value - 1) % 26)) + result
        }
        return result
    }
    function prefix(style, index) {
        if (!byId[style]) return ""
        const marker = style === "numbered" ? `${index + 1}.` : style === "alpha" ? `${alpha(index)}.` : byId[style].marker
        return `${marker} `
    }
    function existingPrefix(line, style) {
        if (style === "numbered") return (line.match(/^\d+\. /) || [""])[0]
        if (style === "alpha") return (line.match(/^[A-Z]+\. /) || [""])[0]
        const marker = prefix(style, 0)
        return marker && line.indexOf(marker) === 0 ? marker : ""
    }
    function length(text) { return root.fabric.util.string.graphemeSplit(text).length }

    /** Apply/remove a list without recreating the object or losing rich styles.
     * Caller owns history and rendering. Returns false for unsupported/no-op data.
     */
    function apply(target, style, options = {}) {
        if (!target || ["text", "textbox", "i-text"].indexOf(String(target.type).toLowerCase()) === -1) return false
        if (style !== "none" && !byId[style]) return false
        const previous = target.cgTextListStyle
        const styles = {}
        let index = 0
        let markerPaintChanged = false
        const lines = String(target.text || "").split("\n").map(function (line, lineIndex) {
            const removed = existingPrefix(line, previous)
            const body = line.slice(removed.length)
            const added = body.trim() || lineIndex === options.forceLine || (options.preserveEmpty && removed) ? prefix(style, index++) : ""
            const offset = length(added) - length(removed)
            const lineStyles = target.styles && target.styles[lineIndex]
            Object.keys(lineStyles || {}).forEach(function (key) {
                const column = Number(key)
                if (column < length(removed)) return
                if (!styles[lineIndex]) styles[lineIndex] = {}
                styles[lineIndex][column + offset] = lineStyles[key]
            })
            // STAMP: 2026-09-16 - Markers follow each item's effective font
            // paint, including imported character-level colours. Base paint
            // stays inherited; empty Enter continuations use the caret's paint.
            if (added) {
                const leading = (body.match(/^\s*/) || [""])[0]
                const firstStyle = lineStyles && lineStyles[length(removed) + length(leading)]
                const fill = body.trim() ? (firstStyle?.fill ?? target.fill) : (options.continuationFill ?? target.fill)
                for (let column = 0; column < length(added); column++) {
                    const previousFill = lineStyles?.[column]?.fill ?? target.fill
                    if (previousFill !== fill) markerPaintChanged = true
                    if (fill !== target.fill) {
                        if (!styles[lineIndex]) styles[lineIndex] = {}
                        styles[lineIndex][column] = { fill }
                    }
                }
            }
            return added + body
        })
        const text = lines.join("\n"), nextStyle = style === "none" ? null : style
        if (text === target.text && nextStyle === (previous || null) && !markerPaintChanged) return false
        target.set({ text, styles, cgTextListStyle: nextStyle })
        target.dirty = true
        if (target.group) target.group.dirty = true
        target.setCoords()
        return true
    }
    /** STAMP: 2026-09-16 - Enter continues list mode while native Fabric text
     * editing stays active. Insert through Fabric's style-aware editing API,
     * renumber subsequent items, synchronize the hidden textarea/caret, then
     * fire the same change events as normal typing. Shift+Enter/IME stay native.
     */
    function continueOnEnter(target, event) {
        const style = target.cgTextListStyle
        if (!byId[style] || !target.isEditing || target.inCompositionMode || event.isComposing
            || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return false
        if (event.key !== "Enter" && event.keyCode !== 13) return false
        const before = target._text.slice(0, target.selectionStart).join("")
        const preceding = before.split("\n")
        const nextLine = preceding.length
        const nextIndex = preceding.filter(line => line.trim()).length
        const inserted = `\n${prefix(style, nextIndex)}`
        const paintIndex = Math.max(0, target.selectionStart - 1)
        const continuationFill = target.getSelectionStyles(paintIndex, paintIndex + 1, true)[0]?.fill ?? target.fill
        target.insertChars(inserted, null, target.selectionStart, target.selectionEnd)
        apply(target, style, { forceLine: nextLine, preserveEmpty: true, continuationFill })
        const lines = target.text.split("\n")
        const caret = length(lines.slice(0, nextLine).join("\n")) + 1 + length(existingPrefix(lines[nextLine], style))
        target.selectionStart = target.selectionEnd = caret
        target.hiddenTextarea.value = target.text
        target._updateTextarea()
        target.fire("changed")
        if (target.canvas) {
            target.canvas.fire("text:changed", { target })
            target.canvas.requestRenderAll()
        }
        event.preventDefault()
        event.stopImmediatePropagation()
        return true
    }
    root.CGTextLists = { choices, apply, prefix, continueOnEnter }
    // Installed before objects are constructed, so Fabric binds this wrapper
    // to each object's native hidden textarea; ordinary text keeps its handler.
    const originalKeyDown = root.fabric.IText.prototype.onKeyDown
    root.fabric.IText.prototype.onKeyDown = function (event) {
        if (!continueOnEnter(this, event)) return originalKeyDown.call(this, event)
    }
    // Fabric's registry retains list mode through save/clone/load, including JSON
    // serialized outside the editor's own toObject wrapper.
    const objectClass = root.fabric && (root.fabric.FabricObject || root.fabric.Object)
    if (objectClass) objectClass.customProperties = Array.from(new Set((objectClass.customProperties || []).concat(["cgTextListStyle"])))
})(window)
