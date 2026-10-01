/*
 * Rich Text Canvas Component
 * STAMP: 2026-08-18
 * Converts editor HTML into one native Fabric group of editable Textbox controls.
 */
(function (window, document, $) {
    "use strict"

    const CANVAS_PADDING = 24
    const BLOCK_GAP = 10

    function getCanvasBounds(canvas) {
        return { width: canvas.getWidth(), height: canvas.getHeight() }
    }

    /** 2026-08-18: Final render guard; rich text can never paint outside the canvas. */
    function applyCanvasClip(text, canvas) {
        const bounds = getCanvasBounds(canvas)
        text.set("clipPath", new fabric.Rect({
            left: 0,
            top: 0,
            width: bounds.width,
            height: bounds.height,
            absolutePositioned: true
        }))
    }

    function constrainObjectToCanvas(object, canvas) {
        if (!object || !object.richTextComponent) return
        const bounds = getCanvasBounds(canvas)
        object.setCoords()
        let box = object.getBoundingRect()
        if (box.width > bounds.width || box.height > bounds.height) {
            const fitScale = Math.min(bounds.width / box.width, bounds.height / box.height)
            object.scaleX *= fitScale
            object.scaleY *= fitScale
            object.setCoords()
            box = object.getBoundingRect()
        }
        if (box.left < 0) object.left += -box.left
        if (box.top < 0) object.top += -box.top
        if (box.left + box.width > bounds.width) object.left -= box.left + box.width - bounds.width
        if (box.top + box.height > bounds.height) object.top -= box.top + box.height - bounds.height
        object.setCoords()
        applyCanvasClip(object, canvas)
    }

    function bindCanvasBoundary(canvas) {
        if (canvas._cgRichTextBoundaryReady) return
        canvas._cgRichTextBoundaryReady = true
        const enforce = function (event) { constrainObjectToCanvas(event && event.target, canvas) }
        canvas.on("object:moving", enforce)
        canvas.on("object:scaling", enforce)
        canvas.on("object:rotating", enforce)
        canvas.on("object:modified", enforce)
        canvas.getObjects().forEach(function (object) {
            if (object.richTextComponent) constrainObjectToCanvas(object, canvas)
        })
    }

    function sanitizeHtml(rawHtml) {
        const template = document.createElement("template")
        template.innerHTML = typeof rawHtml === "string" ? rawHtml : ""
        template.content.querySelectorAll("script, iframe, object, embed, form, input, button, textarea, select, style, link, meta, img")
            .forEach(function (node) { node.remove() })
        template.content.querySelectorAll("*").forEach(function (node) {
            Array.prototype.slice.call(node.attributes).forEach(function (attribute) {
                const name = attribute.name.toLowerCase()
                const value = attribute.value.trim().toLowerCase()
                if (name.indexOf("on") === 0 || name === "srcdoc" || ((name === "href" || name === "src") && value.indexOf("javascript:") === 0)) {
                    node.removeAttribute(attribute.name)
                }
            })
        })
        return template.innerHTML.trim()
    }

    function hasVisibleContent(html) {
        const container = document.createElement("div")
        container.innerHTML = html
        return !!container.textContent.trim() || !!container.querySelector("table, hr, ul, ol")
    }

    function getNodeStyle(node, inheritedStyle) {
        const style = Object.assign({}, inheritedStyle)
        if (!node || node.nodeType !== 1) return style
        if (node.tagName === "STRONG" || node.tagName === "B") style.fontWeight = "bold"
        if (node.tagName === "EM" || node.tagName === "I") style.fontStyle = "italic"
        if (node.tagName === "U") style.underline = true
        if (["S", "STRIKE", "DEL"].indexOf(node.tagName) !== -1) style.linethrough = true
        if (node.style && node.style.color) style.fill = node.style.color
        if (node.style && node.style.fontFamily) style.fontFamily = node.style.fontFamily.replace(/["']/g, "")
        if (node.style && node.style.fontSize) style.fontSize = parseFloat(node.style.fontSize) || style.fontSize
        if (node.style && node.style.textAlign) style.textAlign = node.style.textAlign
        return style
    }

    function extractStyledText(rootNode) {
        let text = ""
        const flatStyles = {}

        function appendText(value, style) {
            const normalized = value.replace(/\s+/g, " ")
            for (let index = 0; index < normalized.length; index++) {
                const characterIndex = text.length
                text += normalized[index]
                if (Object.keys(style).length) flatStyles[characterIndex] = Object.assign({}, style)
            }
        }

        function walk(node, inheritedStyle) {
            if (node.nodeType === 3) {
                appendText(node.nodeValue || "", inheritedStyle)
                return
            }
            if (node.nodeType !== 1) return
            if (node.tagName === "BR") {
                text += "\n"
                return
            }
            const currentStyle = getNodeStyle(node, inheritedStyle)
            Array.prototype.forEach.call(node.childNodes, function (childNode) { walk(childNode, currentStyle) })
        }

        walk(rootNode, {})
        text = text.replace(/^\s+|\s+$/g, "")
        const fabricStyles = {}
        let lineIndex = 0
        let charIndex = 0
        for (let index = 0; index < text.length; index++) {
            if (text[index] === "\n") {
                lineIndex++
                charIndex = 0
            } else {
                if (flatStyles[index]) {
                    if (!fabricStyles[lineIndex]) fabricStyles[lineIndex] = {}
                    fabricStyles[lineIndex][charIndex] = flatStyles[index]
                }
                charIndex++
            }
        }
        return { text, styles: fabricStyles }
    }

    function tableToText(table) {
        const rows = Array.prototype.map.call(table.querySelectorAll("tr"), function (row) {
            return Array.prototype.map.call(row.querySelectorAll("th, td"), function (cell) {
                return cell.textContent.replace(/\s+/g, " ").trim()
            })
        }).filter(function (row) { return row.length })
        if (!rows.length) return ""

        const columnCount = Math.max.apply(null, rows.map(function (row) { return row.length }))
        const widths = []
        for (let column = 0; column < columnCount; column++) {
            widths[column] = Math.max(3, Math.min(24, Math.max.apply(null, rows.map(function (row) {
                return (row[column] || "").length
            }))))
        }
        function formatRow(row) {
            return widths.map(function (width, column) {
                const cell = row[column] || ""
                const clipped = cell.length > width ? `${cell.slice(0, width - 1)}…` : cell
                return clipped.padEnd(width, " ")
            }).join(" | ")
        }
        const lines = []
        rows.forEach(function (row, rowIndex) {
            lines.push(formatRow(row))
            if (rowIndex === 0 && table.querySelector("th")) {
                lines.push(widths.map(function (width) { return "-".repeat(width) }).join("-+-"))
            }
        })
        return lines.join("\n")
    }

    function offsetStylesForPrefix(styles, prefixLength) {
        if (!prefixLength || !styles[0]) return styles
        const adjustedStyles = Object.assign({}, styles)
        adjustedStyles[0] = {}
        Object.keys(styles[0]).forEach(function (characterIndex) {
            adjustedStyles[0][parseInt(characterIndex, 10) + prefixLength] = styles[0][characterIndex]
        })
        return adjustedStyles
    }

    function htmlToBlocks(html) {
        const container = document.createElement("div")
        container.innerHTML = html
        const blocks = []

        function addTextBlock(node, options) {
            const styledText = extractStyledText(node)
            if (!styledText.text) return
            blocks.push(Object.assign({ text: styledText.text, styles: styledText.styles, fontSize: 18, fontFamily: "Arial", fontWeight: "100", controlName: "Textbox", indent: 0 }, options || {}))
        }

        function addList(listNode, depth) {
            let itemNumber = 0
            Array.prototype.forEach.call(listNode.children, function (listItem) {
                if (listItem.tagName !== "LI") return
                itemNumber++
                const clone = listItem.cloneNode(true)
                clone.querySelectorAll("ul, ol").forEach(function (nestedList) { nestedList.remove() })
                addTextBlock(clone, { prefix: listNode.tagName === "OL" ? `${itemNumber}. ` : "• ", controlName: "Listtext", indent: depth * 24 })
                Array.prototype.forEach.call(listItem.children, function (child) {
                    if (child.tagName === "UL" || child.tagName === "OL") addList(child, depth + 1)
                })
            })
        }

        Array.prototype.forEach.call(container.children, function (node) {
            if (/^H[1-6]$/.test(node.tagName)) {
                const sizes = { H1: 38, H2: 32, H3: 27, H4: 23, H5: 20, H6: 18 }
                addTextBlock(node, { fontSize: sizes[node.tagName], fontWeight: "bold" })
            } else if (node.tagName === "UL" || node.tagName === "OL") {
                addList(node, 0)
            } else if (node.tagName === "TABLE") {
                const tableText = tableToText(node)
                if (tableText) blocks.push({ text: tableText, styles: {}, fontSize: 15, fontFamily: "Courier New", fontWeight: "100", controlName: "Listtext", indent: 0 })
            } else if (node.tagName === "HR") {
                blocks.push({ text: "────────────────────────", styles: {}, fontSize: 18, fontFamily: "Arial", fontWeight: "100", controlName: "Textbox", indent: 0 })
            } else {
                addTextBlock(node)
            }
        })
        if (!blocks.length && container.textContent.trim()) addTextBlock(container)
        return blocks
    }

    /** Flatten block structure into one Fabric Textbox while retaining styles. */
    function blocksToSingleText(blocks) {
        let text = ""
        const styles = {}
        let outputLine = 0

        blocks.forEach(function (block, blockIndex) {
            if (blockIndex > 0) {
                text += "\n"
                outputLine++
            }
            const prefix = block.prefix || ""
            const blockText = `${prefix}${block.text}`
            const sourceStyles = offsetStylesForPrefix(block.styles || {}, prefix.length)
            const lines = blockText.split("\n")
            lines.forEach(function (line, sourceLine) {
                if (!styles[outputLine]) styles[outputLine] = {}
                for (let character = 0; character < line.length; character++) {
                    styles[outputLine][character] = Object.assign({
                        fontSize: block.fontSize,
                        fontFamily: block.fontFamily,
                        fontWeight: block.fontWeight
                    }, sourceStyles[sourceLine] && sourceStyles[sourceLine][character] ? sourceStyles[sourceLine][character] : {})
                }
                text += line
                if (sourceLine < lines.length - 1) {
                    text += "\n"
                    outputLine++
                }
            })
        })
        return { text, styles }
    }

    function escapeHtml(value) {
        const element = document.createElement("div")
        element.textContent = value === null || value === undefined ? "" : String(value)
        return element.innerHTML
    }

    /** 2026-08-18: Rehydrate native Fabric text into editable HTML without rasterizing it. */
    function textObjectToHtml(textObject) {
        if (textObject.richTextHtml) return textObject.richTextHtml
        const styles = []
        if (textObject.fontFamily) styles.push(`font-family:${textObject.fontFamily}`)
        if (textObject.fontSize) styles.push(`font-size:${textObject.fontSize}px`)
        if (textObject.fontWeight) styles.push(`font-weight:${textObject.fontWeight}`)
        if (textObject.fontStyle) styles.push(`font-style:${textObject.fontStyle}`)
        if (textObject.underline) styles.push("text-decoration:underline")
        if (textObject.fill && typeof textObject.fill === "string") styles.push(`color:${textObject.fill}`)
        if (textObject.textAlign) styles.push(`text-align:${textObject.textAlign}`)
        return `<p style="${styles.join(";")}">${escapeHtml(textObject.text).replace(/\n/g, "<br>")}</p>`
    }

    function objectToEditorHtml(target) {
        if (!target) return ""
        if (target.richTextHtml) return target.richTextHtml
        if (target.type === "group" && Array.isArray(target._objects)) {
            return target._objects
                .filter(function (item) { return item.type === "textbox" || item.type === "i-text" })
                .map(textObjectToHtml)
                .join("")
        }
        return textObjectToHtml(target)
    }

    function initialize(config) {
        const canvas = config && config.canvas
        if (!canvas || !window.fabric || !window.bootstrap || !$.fn.summernote) return
        const $editor = $("#richTextComponentEditor")
        const modalElement = document.getElementById("richTextComponentModal")
        if (!$editor.length || !modalElement || modalElement.dataset.cgReady === "true") return
        modalElement.dataset.cgReady = "true"
        bindCanvasBoundary(canvas)
        let lastAcceptedHtml = ""
        let isRestoringEditor = false
        let editingTarget = null
        let directTextPlacementArmed = false

        $editor.summernote({ placeholder: "Add formatted text...", dialogsInBody: true, toolbar: [["style", ["style"]], ["font", ["bold", "italic", "underline", "clear"]], ["para", ["ul", "ol", "paragraph"]], ["insert", ["link", "table", "hr"]], ["view", ["codeview"]]] })

        function getEditableArea() {
            return modalElement.querySelector(".note-editable")
        }

        function editorOverflows() {
            const editable = getEditableArea()
            return !!editable && (editable.scrollHeight > editable.clientHeight + 1 || editable.scrollWidth > editable.clientWidth + 1)
        }

        function showEditorLimitError() {
            $("#richTextComponentError")
                .text("The content has reached the canvas boundary. Remove some content before adding more.")
                .prop("hidden", false)
        }

        function placeCaretAtEnd(element) {
            if (!element || !window.getSelection || !document.createRange) return
            const range = document.createRange()
            range.selectNodeContents(element)
            range.collapse(false)
            const selection = window.getSelection()
            selection.removeAllRanges()
            selection.addRange(range)
        }

        function restoreAcceptedContent() {
            if (isRestoringEditor) return
            isRestoringEditor = true
            $editor.summernote("code", lastAcceptedHtml)
            const editable = getEditableArea()
            if (editable) editable.scrollTop = 0
            placeCaretAtEnd(editable)
            isRestoringEditor = false
            showEditorLimitError()
        }

        /** STAMP: 2026-08-18 - Reject typing, paste, and toolbar edits that exceed the fixed canvas viewport. */
        function validateEditorCapacity() {
            if (isRestoringEditor) return true
            if (editorOverflows()) {
                restoreAcceptedContent()
                return false
            }
            lastAcceptedHtml = $editor.summernote("code") || ""
            $("#richTextComponentError").prop("hidden", true)
            return true
        }

        function bindEditorCapacityGuard() {
            const editable = getEditableArea()
            if (!editable || editable.dataset.cgCapacityGuard === "true") return
            editable.dataset.cgCapacityGuard = "true"
            $(editable)
                .on("beforeinput.cgRichText paste.cgRichText", function () {
                    lastAcceptedHtml = $editor.summernote("code") || ""
                })
                .on("input.cgRichText", function () {
                    window.requestAnimationFrame(validateEditorCapacity)
                })
        }

        $editor.on("summernote.change.cgRichText", function () {
            window.requestAnimationFrame(validateEditorCapacity)
        })

        function syncEditorCanvasSize() {
            const bounds = getCanvasBounds(canvas)
            const dialog = modalElement.querySelector(".cg-rich-text-modal__dialog")
            const editorFrame = modalElement.querySelector(".note-editor")
            const editable = modalElement.querySelector(".note-editable")
            modalElement.style.setProperty("--cg-canvas-aspect", `${bounds.width} / ${bounds.height}`)
            modalElement.style.setProperty("--cg-canvas-width", `${bounds.width}px`)
            if (dialog) dialog.style.maxWidth = `min(calc(100vw - 32px), ${bounds.width + 48}px)`
            if (editorFrame && editable) {
                editorFrame.style.maxWidth = `${bounds.width}px`
                editorFrame.style.marginLeft = "auto"
                editorFrame.style.marginRight = "auto"
                const editorWidth = editorFrame.clientWidth || Math.min(bounds.width, window.innerWidth - 80)
                const editorHeight = Math.round(editorWidth * bounds.height / bounds.width)
                modalElement.style.setProperty("--cg-editor-height", `${editorHeight}px`)
                editorFrame.style.width = `${editorWidth}px`
                editable.style.height = `${editorHeight}px`
                editable.style.minHeight = `${editorHeight}px`
                editable.style.maxHeight = `${editorHeight}px`
                editable.scrollTop = 0
            }
            bindEditorCapacityGuard()
            validateEditorCapacity()
        }

        $(modalElement).on("shown.bs.modal.cgRichText", syncEditorCanvasSize)

        function setEditorMode(target) {
            editingTarget = target || null
            const isEditing = !!editingTarget
            const html = isEditing ? objectToEditorHtml(editingTarget) : ""
            $("#richTextComponentModalLabel").text(isEditing ? "Edit Rich Text" : "Rich Text Editor")
            $("#addRichTextComponentBtn").text(isEditing ? "Update Canvas" : "Add to Canvas")
            $("#richTextComponentError").prop("hidden", true)
            $editor.summernote("code", html)
            lastAcceptedHtml = html
        }

        /**
         * STAMP: 2026-08-25 - Create one immediately editable native text object.
         * It enters Fabric editing mode at once so the blinking caret is the
         * prompt and clipboard formatting can be applied to the same object.
         */
        /* STAMP: 2026-09-05 - Direct text starts at caret width and grows with
           its measured styled text. Wrap at the canvas edge; manual side-handle
           resizing opts into the established fixed-width textbox behavior. */
        function fitDirectTextWidth(target) {
            if (!target || !target.cgAutoTextWidth || target.type !== "textbox") return
            const bounds = getCanvasBounds(canvas)
            const maxWidth = Math.max(2, (bounds.width - Math.max(0, target.left) - CANVAS_PADDING) / Math.max(0.01, Math.abs(target.scaleX || 1)))
            target.set("width", maxWidth)
            target.initDimensions()
            const width = Math.max(2, Math.min(maxWidth, target.calcTextWidth() + 2))
            target.set("width", width)
            target.initDimensions()
            target.setCoords()
            canvas.requestRenderAll()
        }
        canvas.on("text:changed", function (event) { fitDirectTextWidth(event.target) })
        canvas.on("before:transform", function (event) {
            const transform = event.transform
            if (transform && transform.target && transform.action === "resizing") transform.target.cgAutoTextWidth = false
        })

        function setDirectTextPlacementMode(isArmed) {
            if (isArmed) {
                window.dispatchEvent(new CustomEvent("cg:canvas-placement-armed", { detail: { owner: "text" } }))
            }
            directTextPlacementArmed = Boolean(isArmed)
            document.body.classList.toggle("cg-direct-text-placement", directTextPlacementArmed)
            const trigger = document.getElementById("addDirectText")
            if (trigger) trigger.setAttribute("aria-pressed", String(directTextPlacementArmed))
        }

        /**
         * STAMP: 2026-09-15 - Normal text uses Arial 16 and may be placed at
         * the author's next canvas click. Calls without a point preserve the
         * established centred insertion contract used by the public API.
         *
         * @param {{x: number, y: number}=} placementPoint Canvas scene point.
         * @returns {fabric.Textbox} Newly inserted editable text object.
         */
        function insertDirectTextObject(placementPoint) {
            const canvasBounds = getCanvasBounds(canvas)
            const objectId = config.generateId("textbox_")
            const requestedLeft = Number(placementPoint && placementPoint.x)
            const requestedTop = Number(placementPoint && placementPoint.y)
            const defaultLeft = Math.max(CANVAS_PADDING, Math.round((canvasBounds.width - 420) / 2))
            const defaultTop = Math.max(CANVAS_PADDING, Math.round((canvasBounds.height - 80) / 2))
            const textObject = new fabric.Textbox("", {
                id: objectId,
                name: `Rich_Text_${Math.floor(1000 + (Math.random() * 9000))}`,
                left: Number.isFinite(requestedLeft) ? Math.max(0, Math.min(canvasBounds.width - 2, requestedLeft)) : defaultLeft,
                top: Number.isFinite(requestedTop) ? Math.max(0, Math.min(canvasBounds.height - 16, requestedTop)) : defaultTop,
                width: 2,
                minWidth: 2,
                cgAutoTextWidth: true,
                fontSize: 16,
                fontFamily: "Arial",
                fontWeight: window.CG_DEFAULT_TEXT_FONT_WEIGHT || "100",
                fill: "#111827",
                lineHeight: 1.35,
                textAlign: "left",
                richTextComponent: true,
                richTextGroup: false,
                richTextHtml: "",
                /* STAMP: 2026-09-11 - Remove this draft if editing ends before
                 * the author enters visible content. */
                cgRemoveIfEmpty: true,
                selectable: true,
                evented: true,
                editable: true,
                transparentCorners: false
            })

            applyCanvasClip(textObject, canvas)
            canvas.add(textObject)
            canvas.setActiveObject(textObject)
            textObject.setCoords()
            if (config.incrementObjectCount) config.incrementObjectCount()
            if (config.pushControl) config.pushControl(objectId, "Rich Text")
            if (config.refreshSelection) config.refreshSelection()
            if (config.updateCanvasState) config.updateCanvasState()
            canvas.requestRenderAll()

            window.setTimeout(function () {
                textObject.enterEditing()
                textObject.setSelectionStart(0)
                textObject.setSelectionEnd(0)
                if (textObject.hiddenTextarea) textObject.hiddenTextarea.focus()
                canvas.requestRenderAll()
            }, 0)
            return textObject
        }

        /**
         * STAMP: 2026-09-11 - Discard only a newly inserted direct-text draft
         * when its first editing session ends empty. Once visible content is
         * committed, later editing follows the established object lifecycle.
         *
         * @param {Object} event Fabric text:editing:exited event.
         * @returns {boolean} True when an empty draft was removed.
         */
        function removeEmptyDraftTextObject(event) {
            const target = event && event.target
            if (!target || target.cgRemoveIfEmpty !== true) return false
            const visibleText = String(target.text || "").replace(/[\s\u200B-\u200D\uFEFF]/gu, "")
            if (visibleText) {
                target.cgRemoveIfEmpty = false
                return false
            }
            if (canvas.getObjects().indexOf(target) < 0) return false

            if (canvas.getActiveObject && canvas.getActiveObject() === target && canvas.discardActiveObject) {
                canvas.discardActiveObject()
            }
            if (config.popControl && target.id) config.popControl(target.id)
            canvas.remove(target)
            if (config.decrementObjectCount) config.decrementObjectCount()
            if (config.refreshSelection) config.refreshSelection()
            canvas.requestRenderAll()
            if (config.updateCanvasState) config.updateCanvasState()
            if (config.updateThumbnail) config.updateThumbnail()
            return true
        }

        canvas.on("text:editing:exited", removeEmptyDraftTextObject)

        /* STAMP: 2026-09-15 - The top Text control arms a one-shot placement
         * mode. The next primary canvas click owns the insertion coordinates,
         * then the existing immediate-edit flow displays the blinking caret. */
        canvas.on("mouse:down", function (event) {
            if (!directTextPlacementArmed || !event || !event.e || event.e.button > 0) return
            const point = event.scenePoint || (typeof canvas.getScenePoint === "function" ? canvas.getScenePoint(event.e) : canvas.getPointer(event.e))
            if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) return
            setDirectTextPlacementMode(false)
            insertDirectTextObject({ x: Number(point.x), y: Number(point.y) })
        })

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && directTextPlacementArmed) setDirectTextPlacementMode(false)
        })
        window.addEventListener("cg:canvas-placement-armed", function (event) {
            if (directTextPlacementArmed && event.detail && event.detail.owner !== "text") setDirectTextPlacementMode(false)
        })

        /** Apply rich clipboard HTML at the Fabric caret without a group/image. */
        function insertRichClipboard(target, html) {
            const cleanHtml = sanitizeHtml(html)
            const blocks = htmlToBlocks(cleanHtml)
            if (!blocks.length) return false
            const flattened = blocksToSingleText(blocks)
            if (!flattened.text) return false

            const selectionStart = Number(target.selectionStart || 0)
            const selectionEnd = Number(target.selectionEnd === null || target.selectionEnd === undefined ? selectionStart : target.selectionEnd)
            const wasEmpty = !target.text
            target.insertChars(flattened.text, null, selectionStart, selectionEnd)

            let flatOffset = 0
            const insertedLines = flattened.text.split("\n")
            insertedLines.forEach(function (line, lineIndex) {
                for (let character = 0; character < line.length; character++) {
                    const style = flattened.styles[lineIndex] && flattened.styles[lineIndex][character]
                    if (style) target.setSelectionStyles(style, selectionStart + flatOffset, selectionStart + flatOffset + 1)
                    flatOffset++
                }
                if (lineIndex < insertedLines.length - 1) flatOffset++
            })

            const nextCaret = selectionStart + flattened.text.length
            target.setSelectionStart(nextCaret)
            target.setSelectionEnd(nextCaret)
            target.set({ richTextComponent: true, richTextGroup: false, richTextHtml: wasEmpty ? cleanHtml : "" })
            target.initDimensions()
            fitDirectTextWidth(target)
            target.setCoords()
            if (target.hiddenTextarea) {
                target.hiddenTextarea.value = target.text
                target.hiddenTextarea.selectionStart = nextCaret
                target.hiddenTextarea.selectionEnd = nextCaret
            }
            canvas.requestRenderAll()
            canvas.fire("object:modified", { target })
            if (config.updateCanvasState) config.updateCanvasState()
            if (config.updateThumbnail) config.updateThumbnail()
            return true
        }

        /**
         * STAMP: 2026-09-11 - Paste external text as content only.
         * Clipboard HTML styling must never replace the selected Fabric text
         * object's font, size, colour, alignment, transform, or authored width.
         * The style at the destination caret is applied to the inserted range
         * so fully styled legacy text also keeps its existing appearance.
         *
         * @param {fabric.IText|fabric.Textbox} target Text object being edited.
         * @param {string} clipboardText Plain-text clipboard payload.
         * @returns {boolean} True when clipboard text was inserted.
         */
        function insertPlainClipboardText(target, clipboardText) {
            if (!target || typeof clipboardText !== "string") return false

            const plainText = clipboardText.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ")
            if (!plainText) return false

            const selectionStart = Number(target.selectionStart || 0)
            const selectionEnd = Number(target.selectionEnd === null || target.selectionEnd === undefined ? selectionStart : target.selectionEnd)
            const existingTextLength = String(target.text || "").length
            const styleIndex = existingTextLength
                ? Math.min(selectionStart, existingTextLength - 1)
                : 0
            const destinationStyles = typeof target.getSelectionStyles === "function"
                ? target.getSelectionStyles(styleIndex, styleIndex + 1, false)
                : []
            const destinationStyle = destinationStyles && destinationStyles[0]
                ? Object.assign({}, destinationStyles[0])
                : null
            const preservedLayout = {
                left: target.left,
                top: target.top,
                scaleX: target.scaleX,
                scaleY: target.scaleY,
                angle: target.angle,
                skewX: target.skewX,
                skewY: target.skewY,
                flipX: target.flipX,
                flipY: target.flipY,
                originX: target.originX,
                originY: target.originY
            }
            if (target.type === "textbox") preservedLayout.width = target.width

            const insertedLength = window.fabric.util && typeof window.fabric.util.graphemeSplit === "function"
                ? window.fabric.util.graphemeSplit(plainText).length
                : Array.from(plainText).length

            target.insertChars(plainText, null, selectionStart, selectionEnd)
            if (destinationStyle && Object.keys(destinationStyle).length) {
                target.setSelectionStyles(destinationStyle, selectionStart, selectionStart + insertedLength)
            }

            target.set(Object.assign({}, preservedLayout, {
                richTextHtml: ""
            }))
            target.initDimensions()
            target.set(preservedLayout)
            target.setCoords()

            const nextCaret = selectionStart + insertedLength
            target.setSelectionStart(nextCaret)
            target.setSelectionEnd(nextCaret)
            if (target.hiddenTextarea) {
                target.hiddenTextarea.value = target.text
                target.hiddenTextarea.selectionStart = nextCaret
                target.hiddenTextarea.selectionEnd = nextCaret
            }

            canvas.requestRenderAll()
            canvas.fire("object:modified", { target })
            if (config.updateCanvasState) config.updateCanvasState()
            if (config.updateThumbnail) config.updateThumbnail()
            return true
        }

        $(document).off("click.cgDirectText", "#addDirectText").on("click.cgDirectText", "#addDirectText", function (event) {
            event.preventDefault()
            event.stopPropagation()
            setDirectTextPlacementMode(!directTextPlacementArmed)
        })

        document.addEventListener("paste", function (event) {
            const target = canvas.getActiveObject()
            if (!target || !target.isEditing || (target.type !== "textbox" && target.type !== "i-text")) return
            const clipboard = event.clipboardData
            const plainText = clipboard && clipboard.getData("text/plain")
            if (!insertPlainClipboardText(target, plainText)) return
            event.preventDefault()
            event.stopPropagation()
        }, true)

        window.CGRichTextComponent.insertDirectTextObject = insertDirectTextObject
        window.CGRichTextComponent.insertRichClipboard = insertRichClipboard
        window.CGRichTextComponent.insertPlainClipboardText = insertPlainClipboardText
        window.CGRichTextComponent.removeEmptyDraftTextObject = removeEmptyDraftTextObject

        window.CGRichTextComponent.openForEdit = function (target) {
            const candidate = target || canvas.getActiveObject()
            if (!candidate) return false
            /* STAMP: 2026-09-01 - The Quick Action pencil uses this exact
             * editor for every Fabric text-based object, including Text. */
            const isText = candidate.type === "textbox" || candidate.type === "i-text" || candidate.type === "text"
            const groupChildren = candidate.type === "group" && Array.isArray(candidate._objects) ? candidate._objects : []
            const textChildren = groupChildren.filter(function (item) { return item.type === "textbox" || item.type === "i-text" })
            const hasTextChildren = textChildren.length > 0 && (candidate.richTextGroup || textChildren.length === groupChildren.length)
            if (!isText && !hasTextChildren) return false
            setEditorMode(candidate)
            bootstrap.Modal.getOrCreateInstance(modalElement).show()
            window.setTimeout(function () { $editor.summernote("focus") }, 250)
            return true
        }

        $("#openRichTextModal").off("click.cgRichText").on("click.cgRichText", function (event) {
            event.preventDefault()
            event.stopPropagation()
            setEditorMode(null)
            const dropdown = event.currentTarget.closest(".dropdown")
            const toggle = dropdown && dropdown.querySelector('[data-bs-toggle="dropdown"]')
            if (toggle) bootstrap.Dropdown.getOrCreateInstance(toggle).hide()
            bootstrap.Modal.getOrCreateInstance(modalElement).show()
            window.setTimeout(function () { $editor.summernote("focus") }, 250)
        })

        $("#addRichTextComponentBtn").off("click.cgRichText").on("click.cgRichText", function () {
            const cleanHtml = sanitizeHtml($editor.summernote("code"))
            if (!validateEditorCapacity()) return
            if (!hasVisibleContent(cleanHtml)) {
                $("#richTextComponentError").text("Add some content before placing the component on the canvas.").prop("hidden", false)
                return
            }
            const blocks = htmlToBlocks(cleanHtml)
            if (!blocks.length) {
                $("#richTextComponentError").prop("hidden", false)
                return
            }

            $("#richTextComponentError").prop("hidden", true)
            const canvasBounds = getCanvasBounds(canvas)
            const availableWidth = Math.max(160, canvasBounds.width - (CANVAS_PADDING * 2))
            const availableHeight = Math.max(80, canvasBounds.height - (CANVAS_PADDING * 2))
            const flattened = blocksToSingleText(blocks)
            const originalTransform = editingTarget ? {
                left: editingTarget.left,
                top: editingTarget.top,
                scaleX: editingTarget.scaleX,
                scaleY: editingTarget.scaleY,
                angle: editingTarget.angle,
                flipX: editingTarget.flipX,
                flipY: editingTarget.flipY
            } : null
            const objectId = editingTarget && editingTarget.id ? editingTarget.id : config.generateId("textbox_")
            const textObject = new fabric.Textbox(flattened.text, {
                id: objectId,
                name: editingTarget && editingTarget.name ? editingTarget.name : `Rich_Text_${Math.floor(1000 + (Math.random() * 9000))}`,
                left: originalTransform ? originalTransform.left : CANVAS_PADDING,
                top: originalTransform ? originalTransform.top : CANVAS_PADDING,
                width: editingTarget && editingTarget.width ? editingTarget.width : availableWidth,
                fontSize: 18,
                fontFamily: "Arial",
                fontWeight: editingTarget && editingTarget.fontWeight ? editingTarget.fontWeight : (window.CG_DEFAULT_TEXT_FONT_WEIGHT || "100"),
                fill: editingTarget && editingTarget.fill ? editingTarget.fill : "#111827",
                lineHeight: editingTarget && editingTarget.lineHeight ? editingTarget.lineHeight : 1.35,
                textAlign: editingTarget && editingTarget.textAlign ? editingTarget.textAlign : "left",
                styles: flattened.styles,
                richTextComponent: true,
                richTextGroup: false,
                richTextHtml: cleanHtml,
                selectable: true,
                evented: true,
                transparentCorners: false
            })
            if (originalTransform) textObject.set(originalTransform)
            textObject.setControlsVisibility({ mt: false, mb: false, ml: true, mr: true, bl: false, br: false, tl: false, tr: false, mtr: true })
            const fitScale = Math.min(1, availableHeight / Math.max(1, textObject.getScaledHeight()))
            if (!editingTarget && fitScale < 1) {
                textObject.set({ scaleX: fitScale, scaleY: fitScale })
            }
            applyCanvasClip(textObject, canvas)
            if (editingTarget) canvas.remove(editingTarget)
            canvas.add(textObject)
            textObject.setCoords()
            constrainObjectToCanvas(textObject, canvas)
            canvas.setActiveObject(textObject)
            if (!editingTarget && config.incrementObjectCount) config.incrementObjectCount()
            if (!editingTarget && config.pushControl) config.pushControl(objectId, "Rich Text")
            canvas.requestRenderAll()
            if (config.refreshSelection) config.refreshSelection()
            if (config.updateCanvasState) config.updateCanvasState()
            if (config.updateThumbnail) config.updateThumbnail()
            bootstrap.Modal.getOrCreateInstance(modalElement).hide()
        })

        $(modalElement).on("hidden.bs.modal.cgRichText", function () {
            $("#richTextComponentError").prop("hidden", true)
            $editor.summernote("code", "")
            editingTarget = null
            $("#richTextComponentModalLabel").text("Rich Text Editor")
            $("#addRichTextComponentBtn").text("Add to Canvas")
        })
    }

    window.CGRichTextComponent = {
        initialize,
        parseHtml(html) { return blocksToSingleText(htmlToBlocks(sanitizeHtml(html))) }
    }
}(window, document, window.jQuery))
