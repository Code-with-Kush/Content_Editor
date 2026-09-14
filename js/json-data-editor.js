/**
 * Advanced ContentData JSON editor.
 * STAMP: 2026-08-13
 *
 * Reads from the established Fabric serializer and applies valid JSON back to
 * the live editor. Persistence intentionally remains owned by the existing
 * parent Submit flow.
 */
(function () {
    "use strict"

    const modalElement = document.getElementById("jsonDataEditorModal")
    const openButton = document.getElementById("openJsonDataEditor")
    const editor = document.getElementById("jsonDataEditorInput")
    const lines = document.getElementById("jsonEditorLines")
    const status = document.getElementById("jsonEditorStatus")
    const errorBox = document.getElementById("jsonEditorError")
    const errorMessage = document.getElementById("jsonEditorErrorMessage")
    const cursor = document.getElementById("jsonEditorCursor")
    const search = document.getElementById("jsonEditorSearch")
    const searchCount = document.getElementById("jsonEditorSearchCount")
    const applyButton = document.getElementById("applyJsonData")
    let matches = []
    let activeMatch = -1
    let validationTimer = null

    if (!modalElement || !openButton || !editor) return

    function parseErrorPosition(message) {
        const match = String(message || "").match(/position\s+(\d+)/i)
        return match ? Number(match[1]) : null
    }

    function getLineColumn(position) {
        const before = editor.value.slice(0, Math.max(0, position))
        const parts = before.split("\n")
        return { line: parts.length, column: parts[parts.length - 1].length + 1 }
    }

    function updateLines() {
        const count = Math.max(1, editor.value.split("\n").length)
        const output = []
        for (let index = 1; index <= count; index += 1) output.push(index)
        lines.textContent = output.join("\n")
        lines.scrollTop = editor.scrollTop
    }

    function updateCursor() {
        const point = getLineColumn(editor.selectionStart || 0)
        cursor.textContent = `Line ${  point.line  }, Column ${  point.column}`
    }

    /**
     * Centre a character position inside the textarea in both directions.
     * STAMP: 2026-08-13 - Native textarea selection does not reliably reveal
     * horizontally distant matches when wrap is disabled, so calculate the
     * monospace position and move the viewport explicitly.
     */
    function revealEditorPosition(position) {
        const point = getLineColumn(position)
        const style = window.getComputedStyle(editor)
        const lineHeight = Number.parseFloat(style.lineHeight) || 21
        const measuringCanvas = document.createElement("canvas")
        const context = measuringCanvas.getContext("2d")
        let characterWidth = 8

        if (context) {
            context.font = style.font
            characterWidth = context.measureText("0").width || characterWidth
        }

        const targetTop = (point.line - 1) * lineHeight
        const targetLeft = (point.column - 1) * characterWidth
        editor.scrollTop = Math.max(0, targetTop - (editor.clientHeight / 2) + (lineHeight / 2))
        editor.scrollLeft = Math.max(0, targetLeft - (editor.clientWidth / 2) + (characterWidth / 2))
        lines.scrollTop = editor.scrollTop
    }

    function validateJson(highlightError) {
        try {
            const parsed = JSON.parse(editor.value)
            status.className = "cg-json-editor__status is-valid"
            status.innerHTML = '<i class="fa fa-check-circle" aria-hidden="true"></i><span>Valid JSON</span>'
            errorBox.hidden = true
            applyButton.disabled = false
            return parsed
        } catch (error) {
            const position = parseErrorPosition(error.message)
            const point = position === null ? null : getLineColumn(position)
            const location = point ? `Line ${  point.line  }, column ${  point.column  }: ` : ""
            status.className = "cg-json-editor__status is-invalid"
            status.innerHTML = '<i class="fa fa-times-circle" aria-hidden="true"></i><span>Invalid JSON</span>'
            errorMessage.textContent = location + error.message
            errorBox.hidden = false
            applyButton.disabled = true
            if (highlightError && position !== null) {
                editor.focus()
                editor.setSelectionRange(position, Math.min(position + 1, editor.value.length))
                updateCursor()
            }
            return null
        }
    }

    function updateSearch() {
        const query = search.value
        matches = []
        activeMatch = -1
        if (query) {
            const source = editor.value.toLocaleLowerCase()
            const needle = query.toLocaleLowerCase()
            let offset = 0
            while ((offset = source.indexOf(needle, offset)) !== -1) {
                matches.push(offset)
                offset += Math.max(needle.length, 1)
            }
        }
        searchCount.textContent = matches.length + (matches.length === 1 ? " result" : " results")
    }

    function goToMatch(direction) {
        if (!matches.length) return
        activeMatch = (activeMatch + direction + matches.length) % matches.length
        const start = matches[activeMatch]
        editor.focus()
        editor.setSelectionRange(start, start + search.value.length)
        // Apply after the browser's native selection scroll so our centred
        // vertical and horizontal position is the final visible location.
        window.requestAnimationFrame(function () {
            revealEditorPosition(start)
            editor.focus({ preventScroll: true })
        })
        searchCount.textContent = `${activeMatch + 1  } of ${  matches.length}`
        updateCursor()
    }

    openButton.addEventListener("click", function () {
        const contentData = typeof window.setData === "function" ? window.setData() : "{}"
        editor.disabled = false
        editor.readOnly = false
        try { editor.value = JSON.stringify(JSON.parse(contentData), null, 2) } catch (_) { editor.value = String(contentData || "") }
        search.value = ""
        updateLines()
        updateSearch()
        validateJson(false)
        bootstrap.Modal.getOrCreateInstance(modalElement).show()
    })

    modalElement.addEventListener("shown.bs.modal", function () {
        editor.focus({ preventScroll: true })
        updateCursor()
    })

    editor.addEventListener("input", function () {
        updateLines()
        updateSearch()
        clearTimeout(validationTimer)
        validationTimer = setTimeout(function () { validateJson(false) }, 180)
    })
    editor.addEventListener("scroll", function () { lines.scrollTop = editor.scrollTop })
    /**
     * STAMP: 2026-08-13 - Keep native text-editing shortcuts inside the JSON
     * workspace so Fabric's document-level copy, paste, delete, undo, redo and
     * arrow handlers cannot intercept edits intended for ContentData.
     */
    editor.addEventListener("keydown", function (event) {
        event.stopPropagation()

        // Insert indentation at the cursor instead of moving focus away.
        if (event.key === "Tab") {
            event.preventDefault()
            editor.setRangeText("  ", editor.selectionStart, editor.selectionEnd, "end")
            editor.dispatchEvent(new Event("input", { bubbles: false }))
        }
    })
    editor.addEventListener("keyup", function (event) {
        event.stopPropagation()
        updateCursor()
    })
    ;["copy", "cut", "paste"].forEach(function (eventName) {
        editor.addEventListener(eventName, function (event) {
            event.stopPropagation()
        })
    })
    editor.addEventListener("click", updateCursor)
    search.addEventListener("input", updateSearch)
    document.getElementById("jsonEditorSearchPrevious").addEventListener("click", function () { goToMatch(-1) })
    document.getElementById("jsonEditorSearchNext").addEventListener("click", function () { goToMatch(1) })
    document.getElementById("formatJsonData").addEventListener("click", function () {
        const parsed = validateJson(true)
        if (parsed === null) return
        editor.value = JSON.stringify(parsed, null, 2)
        updateLines()
        updateSearch()
    })
    document.getElementById("copyJsonData").addEventListener("click", function () {
        const selectionStart = editor.selectionStart
        const selectionEnd = editor.selectionEnd
        const selectedJson = selectionStart === selectionEnd ? editor.value : editor.value.slice(selectionStart, selectionEnd)

        navigator.clipboard.writeText(selectedJson).catch(function () {
            editor.setSelectionRange(selectionStart, selectionEnd)
            editor.focus()
            document.execCommand("copy")
        })
    })
    applyButton.addEventListener("click", async function () {
        const parsed = validateJson(true)
        if (parsed === null || typeof window.applyJsonEditorContentData !== "function") return
        applyButton.disabled = true
        applyButton.innerHTML = '<i class="fa fa-spinner fa-spin" aria-hidden="true"></i>'
        try {
            await window.applyJsonEditorContentData(JSON.stringify(parsed))
            bootstrap.Modal.getInstance(modalElement).hide()
        } catch (error) {
            errorMessage.textContent = error.message || "The JSON could not be applied to the content."
            errorBox.hidden = false
        } finally {
            applyButton.disabled = false
            applyButton.innerHTML = '<i class="fa fa-check" aria-hidden="true"></i>'
        }
    })

    document.addEventListener("keydown", function (event) {
        if (!modalElement.classList.contains("show")) return
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
            event.preventDefault()
            search.focus()
            search.select()
        }
    })
}())
