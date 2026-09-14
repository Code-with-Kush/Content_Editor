/**
 * Figma-style Fabric Table Component
 * STAMP: 2026-08-29
 * Single Fabric 7 object with editable data, variable geometry, styling,
 * structural controls, JSON revival, and normal canvas history events.
 */
/* eslint-disable no-use-before-define -- named function declarations keep the standalone widget lifecycle readable and hoist-safe. */
(function (window, document) {
    "use strict"
    const fabric = window.fabric
    if (!fabric || !fabric.FabricObject || !fabric.classRegistry) return

    const MIN_COLUMN = 48
    const MIN_ROW = 30
    const DEFAULT_COLUMN = 150
    const DEFAULT_ROW = 62
    const OUTER_EDGE_HIT_SIZE = 10

    function uid() {
        if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID()
        return `table_${  Date.now().toString(36)  }${Math.random().toString(36).slice(2, 8)}`
    }
    function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, Number(value))) }
    function sum(values, start, count) {
        return values.slice(start || 0, count === undefined ? values.length : start + count)
            .reduce(function (total, value) { return total + value }, 0)
    }
    function newCell(source) {
        return Object.assign({ text: "", rowSpan: 1, colSpan: 1, hidden: false, fill: null, textColor: null, textAlign: null, fontWeight: null, fontStyle: null, underline: null, fontSize: null }, source || {})
    }
    function makeCells(rows, columns, source) {
        return Array.from({ length: rows }, function (_, row) {
            return Array.from({ length: columns }, function (_, column) { return newCell(source && source[row] && source[row][column]) })
        })
    }
    function rangeOf(start, end) {
        return { top: Math.min(start.row, end.row), bottom: Math.max(start.row, end.row), left: Math.min(start.column, end.column), right: Math.max(start.column, end.column) }
    }
    function escapeXml(value) {
        return String(value === undefined || value === null ? "" : value).replace(/[&<>"']/g, function (character) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[character]
        })
    }
    function wrapSvgText(text, maximumWidth, fontSize) {
        const lines = []; const maximumCharacters = Math.max(1, Math.floor(maximumWidth / Math.max(1, fontSize * 0.58)))
        String(text || "").split(/\n/).forEach(function (paragraph) {
            const words = paragraph.split(/\s+/).filter(Boolean); if (!words.length) { lines.push(""); return }
            let line = words.shift(); words.forEach(function (word) { const next = `${line  } ${  word}`; if (next.length <= maximumCharacters) line = next; else { lines.push(line); line = word } }); lines.push(line)
        })
        return lines
    }
    function boundaryPosition(axis, index) {
        return function (_dimension, matrix, table) {
            const offset = sum(axis === "column" ? table.columnWidths : table.rowHeights, 0, index)
            const point = axis === "column" ? new fabric.Point((-table.width / 2) + offset, 0) : new fabric.Point(0, (-table.height / 2) + offset)
            return fabric.util.transformPoint(point, matrix)
        }
    }
    function boundaryRender(axis) {
        return function (ctx, left, top, _style, table) {
            ctx.save(); ctx.translate(left, top); ctx.rotate(fabric.util.degreesToRadians(table.angle || 0))
            ctx.strokeStyle = "#2e90fa"; ctx.fillStyle = "#fff"; ctx.lineWidth = 1.5; ctx.beginPath()
            if (axis === "column") { ctx.moveTo(0, -12); ctx.lineTo(0, 12) } else { ctx.moveTo(-12, 0); ctx.lineTo(12, 0) }
            ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore()
        }
    }
    function boundaryResize(axis, index) {
        return function (event, transform) {
            const table = transform.target
            const angle = fabric.util.degreesToRadians(-(table.angle || 0))
            const movementX = Number(event.movementX) || 0
            const movementY = Number(event.movementY) || 0
            const localX = ((movementX * Math.cos(angle)) - (movementY * Math.sin(angle))) / (table.scaleX || 1)
            const localY = ((movementX * Math.sin(angle)) + (movementY * Math.cos(angle))) / (table.scaleY || 1)
            if (axis === "column") table.columnWidths[index - 1] = Math.max(MIN_COLUMN, table.columnWidths[index - 1] + localX)
            else table.rowHeights[index - 1] = Math.max(MIN_ROW, table.rowHeights[index - 1] + localY)
            table.updateGeometry(); return true
        }
    }
    function renderAddControl(ctx, left, top) {
        ctx.save(); ctx.shadowColor = "rgba(20, 132, 255, 0.28)"; ctx.shadowBlur = 5
        ctx.fillStyle = "#55b6f4"; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(left, top, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore()
    }
    function addControl(side) {
        const positions = {
            top: { x: 0, y: -0.5, offsetY: -20 },
            right: { x: 0.5, y: 0, offsetX: 20 },
            bottom: { x: 0, y: 0.5, offsetY: 20 },
            left: { x: -0.5, y: 0, offsetX: -20 }
        }
        const position = positions[side]
        return new fabric.Control({
            x: position.x, y: position.y, offsetX: position.offsetX || 0, offsetY: position.offsetY || 0,
            sizeX: 22, sizeY: 22, cursorStyle: "pointer", actionName: `addTable${side}`,
            render: renderAddControl,
            mouseUpHandler: function (_eventData, transform) { return addFromSide(transform.target, side) }
        })
    }

    class FabricTable extends fabric.FabricObject {
        constructor(options) {
            options = Object.assign({}, options || {}); delete options.type
            const rows = Math.max(1, Number(options.rows) || 2)
            const columns = Math.max(1, Number(options.columns) || 2)
            const cellWidth = Math.max(MIN_COLUMN, Number(options.cellWidth) || DEFAULT_COLUMN)
            const cellHeight = Math.max(MIN_ROW, Number(options.cellHeight) || DEFAULT_ROW)
            const widths = Array.from({ length: columns }, function (_, index) { return Math.max(MIN_COLUMN, Number(options.columnWidths && options.columnWidths[index]) || cellWidth) })
            const heights = Array.from({ length: rows }, function (_, index) { return Math.max(MIN_ROW, Number(options.rowHeights && options.rowHeights[index]) || cellHeight) })
            super(Object.assign({ left: 90, top: 80, width: sum(widths), height: sum(heights), fill: "#fff", stroke: "#cfd4dc", strokeWidth: 1, hasBorders: true, hasControls: true, borderDashArray: [5, 4], cornerStyle: "circle", cornerColor: "#ffffff", cornerStrokeColor: "#2e90fa", cornerSize: 10, transparentCorners: false, objectCaching: false, strokeUniform: true, name: "Table", widgetType: "table", widgetCategory: "content" }, options))
            this.id = options.id || uid(); this.rows = rows; this.columns = columns
            this.columnWidths = widths; this.rowHeights = heights; this.cells = makeCells(rows, columns, options.cells)
            this.fontFamily = options.fontFamily || "Arial"; this.fontSize = clamp(options.fontSize || 16, 8, 72)
            this.fontWeight = options.fontWeight || "400"; this.fontStyle = options.fontStyle || "normal"; this.underline = options.underline === true
            this.textColor = options.textColor || "#101828"; this.textAlign = options.textAlign || "left"; this.verticalAlign = options.verticalAlign || "middle"
            this.cellPadding = clamp(options.cellPadding === undefined ? 10 : options.cellPadding, 0, 32)
            this.headerRow = options.headerRow === true; this.headerFill = options.headerFill || "#f2f4f7"; this.headerTextColor = options.headerTextColor || "#101828"
            this.borderColor = options.borderColor || options.stroke || "#cfd4dc"; this.borderWidth = clamp(options.borderWidth || options.strokeWidth || 1, 0, 12)
            this.selectionStart = null; this.selectionEnd = null; this.widgetData = Object.assign({ rows, columns }, options.widgetData || {}); this.widgetVersion = 2
            this.updateGeometry(); this.refreshControls()
        }
        updateGeometry() {
            this.width = sum(this.columnWidths); this.height = sum(this.rowHeights); this.widgetData.rows = this.rows; this.widgetData.columns = this.columns
            this.setCoords(); this.dirty = true
        }
        refreshControls() {
            const controls = fabric.controlsUtils && fabric.controlsUtils.createObjectDefaultControls ? fabric.controlsUtils.createObjectDefaultControls() : Object.assign({}, this.controls || {})
            for (let column = 1; column < this.columns; column += 1) controls[`tableColumn${  column}`] = new fabric.Control({ cursorStyle: "col-resize", actionName: "resizeTableColumn", positionHandler: boundaryPosition("column", column), actionHandler: boundaryResize("column", column), render: boundaryRender("column"), sizeX: 14, sizeY: 28 })
            for (let row = 1; row < this.rows; row += 1) controls[`tableRow${  row}`] = new fabric.Control({ cursorStyle: "row-resize", actionName: "resizeTableRow", positionHandler: boundaryPosition("row", row), actionHandler: boundaryResize("row", row), render: boundaryRender("row"), sizeX: 28, sizeY: 14 })
            /* STAMP: 2026-08-29 - Figma-style outside controls mutate this
             * single table object; they never create detached row/cell objects. */
            controls.tableAddTop = addControl("top"); controls.tableAddRight = addControl("right")
            controls.tableAddBottom = addControl("bottom"); controls.tableAddLeft = addControl("left")
            this.controls = controls
            if (typeof this.setControlsVisibility === "function") {
                const visibility = {}; Object.keys(controls).forEach(function (key) { visibility[key] = true })
                this.setControlsVisibility(visibility)
            }
        }
        cellBounds(row, column) {
            const cell = this.cells[row][column]
            return { x: (-this.width / 2) + sum(this.columnWidths, 0, column), y: (-this.height / 2) + sum(this.rowHeights, 0, row), width: sum(this.columnWidths, column, cell.colSpan), height: sum(this.rowHeights, row, cell.rowSpan) }
        }
        cellStyle(row, column) {
            const cell = this.cells[row][column]; const header = this.headerRow && row === 0
            return { fill: cell.fill || (header ? this.headerFill : this.fill), textColor: cell.textColor || (header ? this.headerTextColor : this.textColor), textAlign: cell.textAlign || this.textAlign, fontWeight: cell.fontWeight || (header ? "700" : this.fontWeight), fontStyle: cell.fontStyle || this.fontStyle, underline: cell.underline === null ? this.underline : cell.underline, fontSize: cell.fontSize || this.fontSize }
        }
        wrap(ctx, text, maximumWidth) {
            const lines = []
            String(text || "").split(/\n/).forEach(function (paragraph) {
                const words = paragraph.split(/\s+/).filter(Boolean); if (!words.length) { lines.push(""); return }
                let line = words.shift(); words.forEach(function (word) { const next = `${line  } ${  word}`; if (ctx.measureText(next).width <= maximumWidth) line = next; else { lines.push(line); line = word } }); lines.push(line)
            }); return lines
        }
        _render(ctx) {
            const selection = this.getSelectionRange(); ctx.save(); ctx.strokeStyle = this.borderColor; ctx.lineWidth = this.borderWidth
            for (let row = 0; row < this.rows; row += 1) for (let column = 0; column < this.columns; column += 1) {
                const cell = this.cells[row][column]; if (cell.hidden) continue
                const box = this.cellBounds(row, column); const style = this.cellStyle(row, column)
                const selected = selection && row >= selection.top && row <= selection.bottom && column >= selection.left && column <= selection.right
                ctx.fillStyle = selected ? "#eaf4ff" : style.fill; ctx.fillRect(box.x, box.y, box.width, box.height); if (this.borderWidth > 0) ctx.strokeRect(box.x, box.y, box.width, box.height)
                ctx.save(); ctx.beginPath(); ctx.rect(box.x + this.cellPadding, box.y + 2, Math.max(0, box.width - (this.cellPadding * 2)), box.height - 4); ctx.clip()
                ctx.fillStyle = style.textColor; ctx.font = `${style.fontStyle  } ${  style.fontWeight  } ${  style.fontSize  }px ${  this.fontFamily}`; ctx.textBaseline = "middle"; ctx.textAlign = style.textAlign
                const lines = this.wrap(ctx, cell.text, Math.max(1, box.width - (this.cellPadding * 2))); const lineHeight = style.fontSize * 1.25; const contentHeight = lines.length * lineHeight
                let firstY = box.y + (box.height / 2) - (contentHeight / 2) + (lineHeight / 2)
                if (this.verticalAlign === "top") firstY = box.y + this.cellPadding + (lineHeight / 2)
                if (this.verticalAlign === "bottom") firstY = box.y + box.height - this.cellPadding - contentHeight + (lineHeight / 2)
                let textX = box.x + this.cellPadding; if (style.textAlign === "center") textX = box.x + (box.width / 2); if (style.textAlign === "right") textX = box.x + box.width - this.cellPadding
                lines.forEach(function (line, index) { const y = firstY + (index * lineHeight); ctx.fillText(line, textX, y); if (style.underline && line) { const width = ctx.measureText(line).width; let x = textX; if (style.textAlign === "center") x -= width / 2; if (style.textAlign === "right") x -= width; ctx.fillRect(x, y + (style.fontSize * 0.45), width, 1) } })
                ctx.restore()
            }
            /* STAMP: 2026-08-29 - Draw a guaranteed active-object outline from
             * the table itself. This remains visible even if a legacy editor
             * listener temporarily replaces Fabric's selection style map. */
            if (this.canvas && typeof this.canvas.getActiveObject === "function" && this.canvas.getActiveObject() === this) {
                ctx.save(); ctx.strokeStyle = "#2e90fa"; ctx.lineWidth = 1.5 / Math.max(Math.abs(this.scaleX || 1), 0.01)
                if (typeof ctx.setLineDash === "function") ctx.setLineDash([5, 4])
                ctx.strokeRect((-this.width / 2) - 1, (-this.height / 2) - 1, this.width + 2, this.height + 2); ctx.restore()
            }
            ctx.restore()
        }
        _renderControls(ctx, styleOverride) {
            this.hasBorders = true; this.hasControls = true; this.borderDashArray = [5, 4]
            this.refreshControls()
            return super._renderControls(ctx, styleOverride)
        }
        /** STAMP: 2026-08-27 - Export the single table object as native SVG for learner/author previews. */
        _toSVG() {
            const markup = ["<g ", "COMMON_PARTS", ">\n"]
            for (let row = 0; row < this.rows; row += 1) for (let column = 0; column < this.columns; column += 1) {
                const cell = this.cells[row][column]; if (cell.hidden) continue
                const box = this.cellBounds(row, column); const style = this.cellStyle(row, column)
                markup.push(`<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" fill="${escapeXml(style.fill)}" stroke="${escapeXml(this.borderColor)}" stroke-width="${this.borderWidth}" />\n`)
                if (!cell.text) continue
                const lineHeight = style.fontSize * 1.25; const lines = wrapSvgText(cell.text, Math.max(1, box.width - (this.cellPadding * 2)), style.fontSize); const contentHeight = lines.length * lineHeight
                let firstY = box.y + (box.height / 2) - (contentHeight / 2) + (lineHeight / 2)
                if (this.verticalAlign === "top") firstY = box.y + this.cellPadding + (lineHeight / 2)
                if (this.verticalAlign === "bottom") firstY = box.y + box.height - this.cellPadding - contentHeight + (lineHeight / 2)
                let textX = box.x + this.cellPadding; let anchor = "start"
                if (style.textAlign === "center") { textX = box.x + (box.width / 2); anchor = "middle" }
                if (style.textAlign === "right") { textX = box.x + box.width - this.cellPadding; anchor = "end" }
                markup.push(`<text x="${textX}" y="${firstY}" fill="${escapeXml(style.textColor)}" font-family="${escapeXml(this.fontFamily)}" font-size="${style.fontSize}" font-weight="${escapeXml(style.fontWeight)}" font-style="${escapeXml(style.fontStyle)}" text-anchor="${anchor}" dominant-baseline="middle"${style.underline ? ' text-decoration="underline"' : ""}>`)
                lines.forEach(function (line, index) { markup.push(`<tspan x="${textX}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`) })
                markup.push("</text>\n")
            }
            markup.push("</g>\n"); return markup
        }
        getSelectionRange() { return this.selectionStart && this.selectionEnd ? rangeOf(this.selectionStart, this.selectionEnd) : null }
        selectCell(cell, extend) { if (!extend || !this.selectionStart) this.selectionStart = { row: cell.row, column: cell.column }; this.selectionEnd = { row: cell.row, column: cell.column }; this.dirty = true }
        /**
         * STAMP: 2026-08-29 - Detect only the table's outside frame in local
         * coordinates. Keeping this separate from cell hit-testing preserves
         * existing cell editing and internal row/column resize controls.
         */
        isOuterEdgeAt(scenePoint) {
            if (!scenePoint) return false
            const local = fabric.util.transformPoint(scenePoint, fabric.util.invertTransform(this.calcTransformMatrix()))
            const halfWidth = this.width / 2; const halfHeight = this.height / 2
            const toleranceX = OUTER_EDGE_HIT_SIZE / Math.max(Math.abs(this.scaleX || 1), 0.01)
            const toleranceY = OUTER_EDGE_HIT_SIZE / Math.max(Math.abs(this.scaleY || 1), 0.01)
            const inside = local.x >= -halfWidth - toleranceX && local.x <= halfWidth + toleranceX && local.y >= -halfHeight - toleranceY && local.y <= halfHeight + toleranceY
            return inside && (Math.abs(Math.abs(local.x) - halfWidth) <= toleranceX || Math.abs(Math.abs(local.y) - halfHeight) <= toleranceY)
        }
        cellAt(scenePoint) {
            const local = fabric.util.transformPoint(scenePoint, fabric.util.invertTransform(this.calcTransformMatrix()))
            const x = local.x + (this.width / 2); const y = local.y + (this.height / 2); if (x < 0 || y < 0 || x > this.width || y > this.height) return null
            let column = 0; let row = 0; let offset = this.columnWidths[0]
            while (column < this.columns - 1 && x > offset) { column += 1; offset += this.columnWidths[column] }
            offset = this.rowHeights[0]; while (row < this.rows - 1 && y > offset) { row += 1; offset += this.rowHeights[row] }
            if (!this.cells[row][column].hidden) return { row, column }
            for (let sourceRow = row; sourceRow >= 0; sourceRow -= 1) for (let sourceColumn = column; sourceColumn >= 0; sourceColumn -= 1) { const cell = this.cells[sourceRow][sourceColumn]; if (!cell.hidden && sourceRow + cell.rowSpan > row && sourceColumn + cell.colSpan > column) return { row: sourceRow, column: sourceColumn } }
            return null
        }
        selectedCells() {
            const range = this.getSelectionRange(); const result = []; if (!range) return result
            for (let row = range.top; row <= range.bottom; row += 1) for (let column = range.left; column <= range.right; column += 1) if (!this.cells[row][column].hidden) result.push(this.cells[row][column])
            return result
        }
        applyCellStyle(property, value) { const cells = this.selectedCells(); cells.forEach(function (cell) { cell[property] = value }); this.dirty = true; return cells.length > 0 }
        mergeSelection() {
            const range = this.getSelectionRange(); if (!range || (range.top === range.bottom && range.left === range.right)) return false
            const content = []
            for (let row = range.top; row <= range.bottom; row += 1) for (let column = range.left; column <= range.right; column += 1) { const cell = this.cells[row][column]; if (cell.text) content.push(cell.text); cell.hidden = !(row === range.top && column === range.left); if (cell.hidden) { cell.rowSpan = 1; cell.colSpan = 1 } }
            const anchor = this.cells[range.top][range.left]; anchor.hidden = false; anchor.rowSpan = range.bottom - range.top + 1; anchor.colSpan = range.right - range.left + 1; anchor.text = content.join(" "); this.selectCell({ row: range.top, column: range.left }, false); return true
        }
        clearMerges() { this.cells.forEach(function (row) { row.forEach(function (cell) { cell.hidden = false; cell.rowSpan = 1; cell.colSpan = 1 }) }); this.selectionStart = null; this.selectionEnd = null }
        insertRow(index) { index = clamp(index, 0, this.rows); this.cells.splice(index, 0, makeCells(1, this.columns)[0]); this.rowHeights.splice(index, 0, this.rowHeights[Math.max(0, index - 1)] || DEFAULT_ROW); this.rows += 1; this.clearMerges(); this.updateGeometry(); this.refreshControls() }
        insertColumn(index) { index = clamp(index, 0, this.columns); this.cells.forEach(function (row) { row.splice(index, 0, newCell()) }); this.columnWidths.splice(index, 0, this.columnWidths[Math.max(0, index - 1)] || DEFAULT_COLUMN); this.columns += 1; this.clearMerges(); this.updateGeometry(); this.refreshControls() }
        deleteRow(index) { if (this.rows <= 1) return false; this.cells.splice(clamp(index, 0, this.rows - 1), 1); this.rowHeights.splice(clamp(index, 0, this.rows - 1), 1); this.rows -= 1; this.clearMerges(); this.updateGeometry(); this.refreshControls(); return true }
        deleteColumn(index) { if (this.columns <= 1) return false; index = clamp(index, 0, this.columns - 1); this.cells.forEach(function (row) { row.splice(index, 1) }); this.columnWidths.splice(index, 1); this.columns -= 1; this.clearMerges(); this.updateGeometry(); this.refreshControls(); return true }
        toObject(properties) {
            return Object.assign(super.toObject(properties), { id: this.id, rows: this.rows, columns: this.columns, columnWidths: this.columnWidths.slice(), rowHeights: this.rowHeights.slice(), cells: this.cells.map(function (row) { return row.map(function (cell) { return Object.assign({}, cell) }) }), fontFamily: this.fontFamily, fontSize: this.fontSize, fontWeight: this.fontWeight, fontStyle: this.fontStyle, underline: this.underline, textColor: this.textColor, textAlign: this.textAlign, verticalAlign: this.verticalAlign, cellPadding: this.cellPadding, headerRow: this.headerRow, headerFill: this.headerFill, headerTextColor: this.headerTextColor, borderColor: this.borderColor, borderWidth: this.borderWidth, widgetType: "table", widgetCategory: "content", widgetData: Object.assign({}, this.widgetData), widgetVersion: this.widgetVersion })
        }
        static async fromObject(object) { return new FabricTable(object) }
    }

    FabricTable.type = "fabric-table"; fabric.classRegistry.setClass(FabricTable, "fabric-table"); fabric.classRegistry.setClass(FabricTable, "FabricTable")
    let canvas = null; let menu = null; let editor = null; let inspector = null
    function isFabricCanvas(candidate) {
        return !!candidate && typeof candidate.getWidth === "function" && typeof candidate.getHeight === "function" && typeof candidate.add === "function" && typeof candidate.on === "function"
    }
    function commit(table) { table.updateGeometry(); table.refreshControls(); canvas.requestRenderAll(); canvas.fire("object:modified", { target: table, tableMutation: true }) }
    function addFromSide(table, side) {
        if (!isTableObject(table) || !canvas) return false
        const origins = {
            top: ["center", "bottom"], right: ["left", "center"],
            bottom: ["center", "top"], left: ["right", "center"]
        }
        const origin = origins[side]
        const fixedPoint = typeof table.getPointByOrigin === "function" ? table.getPointByOrigin(origin[0], origin[1]) : null
        if (side === "top") table.insertRow(0)
        else if (side === "bottom") table.insertRow(table.rows)
        else if (side === "left") table.insertColumn(0)
        else if (side === "right") table.insertColumn(table.columns)
        else return false
        /* Preserve the opposite edge so adding above/left expands toward the
         * clicked dot, including on rotated and scaled tables. */
        if (fixedPoint && typeof table.setPositionByOrigin === "function") table.setPositionByOrigin(fixedPoint, origin[0], origin[1])
        commit(table); canvas.setActiveObject(table); showInspector(table)
        if (typeof window.updateCanvasState === "function") window.updateCanvasState()
        if (typeof window.CGLoadTimeline === "function") window.CGLoadTimeline()
        return false
    }
    function add(options) {
        if (!isFabricCanvas(canvas) && isFabricCanvas(window.CGCanvas)) canvas = window.CGCanvas
        if (!isFabricCanvas(canvas)) return null
        const table = new FabricTable(options)
        if (!options || (options.left === undefined && options.top === undefined)) table.set({ left: Math.max(0, (canvas.getWidth() - table.width) / 2), top: Math.max(0, (canvas.getHeight() - table.height) / 2) })
        /* STAMP: 2026-08-29 - The top toolbar table action must finish in one
         * deterministic active-selection state, independent of object:added
         * listener order in the legacy editor. */
        table.set({ selectable: true, evented: true, hasBorders: true, hasControls: true })
        canvas.add(table); canvas.setActiveObject(table)
        if (typeof window.applyCanvasObjectActionControls === "function") window.applyCanvasObjectActionControls(table)
        table.refreshControls(); table.setCoords()
        if (typeof window.pushControl === "function") window.pushControl(table.id, "Table")
        canvas.requestRenderAll(); showInspector(table); return table
    }
    function selectedCell(table) { return table.selectionEnd || { row: 0, column: 0 } }
    function runAction(table, action) {
        const cell = selectedCell(table); let changed = true
        if (action === "merge") changed = table.mergeSelection(); else if (action === "row-above") table.insertRow(cell.row); else if (action === "row-below") table.insertRow(cell.row + 1); else if (action === "column-left") table.insertColumn(cell.column); else if (action === "column-right") table.insertColumn(cell.column + 1); else if (action === "delete-row") changed = table.deleteRow(cell.row); else if (action === "delete-column") changed = table.deleteColumn(cell.column); else changed = false
        if (changed) { commit(table); renderInspector(table) }
    }
    function bindToolbar() {
        const button = document.getElementById && document.getElementById("cgTableInsert"); if (!button || button.dataset.fabricTableBound) return
        button.dataset.fabricTableBound = "true"; button.addEventListener("click", function () {
            if (isFabricCanvas(window.CGCanvas)) initialise(window.CGCanvas)
            add({ rows: 2, columns: 2, headerRow: true })
        })
    }
    function buildMenu() {
        if (menu) return menu
        menu = document.createElement("div"); menu.id = "cgTableContextMenu"; menu.className = "cg-table-context-menu"; menu.hidden = true
        menu.innerHTML = '<button type="button" data-table-action="merge"><i class="fa fa-compress"></i>Merge cells</button><span role="separator"></span><button type="button" data-table-action="column-left"><i class="fa fa-arrow-left"></i>Column left</button><button type="button" data-table-action="column-right"><i class="fa fa-arrow-right"></i>Column right</button><button type="button" data-table-action="row-above"><i class="fa fa-arrow-up"></i>Row above</button><button type="button" data-table-action="row-below"><i class="fa fa-arrow-down"></i>Row below</button><span role="separator"></span><button type="button" data-table-action="delete-row" class="is-danger"><i class="fa fa-minus"></i>Delete row</button><button type="button" data-table-action="delete-column" class="is-danger"><i class="fa fa-minus"></i>Delete column</button>'
        document.body.appendChild(menu); menu.addEventListener("click", function (event) { const button = event.target.closest("[data-table-action]"); if (button && menu.__table) runAction(menu.__table, button.dataset.tableAction); menu.hidden = true }); document.addEventListener("pointerdown", function (event) { if (!event.target.closest("#cgTableContextMenu")) menu.hidden = true }); return menu
    }
    function showMenu(table, event) {
        const popup = buildMenu(); const range = table.getSelectionRange(); popup.__table = table
        popup.querySelector('[data-table-action="merge"]').disabled = !range || (range.top === range.bottom && range.left === range.right); popup.querySelector('[data-table-action="delete-row"]').disabled = table.rows <= 1; popup.querySelector('[data-table-action="delete-column"]').disabled = table.columns <= 1
        popup.style.left = `${Math.min(event.clientX, window.innerWidth - 174)  }px`; popup.style.top = `${Math.min(event.clientY, window.innerHeight - 260)  }px`; popup.hidden = false
    }
    function buildInspector() {
        if (inspector) return inspector
        inspector = document.createElement("aside"); inspector.id = "cgTableInspector"; inspector.className = "cg-table-inspector"; inspector.hidden = true
        inspector.innerHTML = '<header><div><strong>Table</strong><small data-table-summary></small></div><button data-table-close aria-label="Close">×</button></header><div class="cg-table-inspector__body">' +
            '<section><h4>Structure</h4><div class="cg-table-action-grid"><button data-table-action="row-above">+ Row above</button><button data-table-action="row-below">+ Row below</button><button data-table-action="column-left">+ Column left</button><button data-table-action="column-right">+ Column right</button><button data-table-action="delete-row" class="is-danger">Delete row</button><button data-table-action="delete-column" class="is-danger">Delete column</button></div></section>' +
            '<section><h4>Table</h4><label class="cg-table-check"><input type="checkbox" data-table-property="headerRow">Header row</label><label>Cell fill<input type="color" data-table-property="fill"></label><label>Header fill<input type="color" data-table-property="headerFill"></label><label>Border<input type="color" data-table-property="borderColor"></label><label>Border width<input type="number" min="0" max="12" data-table-property="borderWidth"></label><label>Padding<input type="number" min="0" max="32" data-table-property="cellPadding"></label></section>' +
            '<section><h4>Selected cell</h4><label>Fill<input type="color" data-cell-property="fill"></label><div class="cg-table-control-row"><span>Alignment</span><div class="cg-table-segment"><button type="button" data-cell-property="textAlign" data-cell-value="left" aria-label="Align left"><i class="fa fa-align-left"></i></button><button type="button" data-cell-property="textAlign" data-cell-value="center" aria-label="Align center"><i class="fa fa-align-center"></i></button><button type="button" data-cell-property="textAlign" data-cell-value="right" aria-label="Align right"><i class="fa fa-align-right"></i></button></div></div></section>' +
            '<section><h4>Text</h4><label>Font<select data-table-property="fontFamily"><option>Arial</option><option>Helvetica</option><option>Georgia</option><option>Verdana</option><option>Times New Roman</option></select></label><label>Size<input type="number" min="8" max="72" data-table-property="fontSize"></label><label>Color<input type="color" data-table-property="textColor"></label><div class="cg-table-control-row"><span>Style</span><div class="cg-table-segment"><button type="button" data-table-toggle="bold" aria-label="Bold"><b>B</b></button><button type="button" data-table-toggle="italic" aria-label="Italic"><i>I</i></button><button type="button" data-table-toggle="underline" aria-label="Underline"><u>U</u></button></div></div><label>Vertical<select data-table-property="verticalAlign"><option value="top">Top</option><option value="middle">Middle</option><option value="bottom">Bottom</option></select></label></section>' +
            '<section><button class="cg-table-merge" data-table-action="merge"><i class="fa fa-compress"></i>Merge selected cells</button><p>Click a cell, then Shift-click another cell to select a range.</p></section></div>'
        const workspace = document.querySelector(".cg-workspace") || document.body
        workspace.appendChild(inspector)
        inspector.addEventListener("click", function (event) {
            if (event.target.closest("[data-table-close]")) { inspector.hidden = true; return }
            const table = inspector.__table; if (!table) return
            const action = event.target.closest("[data-table-action]"); if (action) { runAction(table, action.dataset.tableAction); return }
            const cell = event.target.closest("button[data-cell-property]"); if (cell) { table.applyCellStyle(cell.dataset.cellProperty, cell.dataset.cellValue); commit(table); renderInspector(table); return }
            const toggle = event.target.closest("[data-table-toggle]"); if (!toggle) return
            if (toggle.dataset.tableToggle === "bold") table.fontWeight = table.fontWeight === "700" ? "400" : "700"; if (toggle.dataset.tableToggle === "italic") table.fontStyle = table.fontStyle === "italic" ? "normal" : "italic"; if (toggle.dataset.tableToggle === "underline") table.underline = !table.underline
            commit(table); renderInspector(table)
        })
        function update(event) { const field = event.target.closest("[data-table-property], [data-cell-property]"); const table = inspector.__table; if (!field || !table || field.tagName === "BUTTON") return; let value = field.type === "checkbox" ? field.checked : field.value; if (field.type === "number") value = Number(value); if (field.dataset.cellProperty) table.applyCellStyle(field.dataset.cellProperty, value); else table[field.dataset.tableProperty] = value; commit(table); renderInspector(table) }
        inspector.addEventListener("change", update); return inspector
    }
    function renderInspector(table) {
        const panel = buildInspector(); panel.__table = table; panel.querySelector("[data-table-summary]").textContent = `${table.rows  } rows × ${  table.columns  } columns`
        panel.querySelectorAll("[data-table-property]").forEach(function (field) { const value = table[field.dataset.tableProperty]; if (field.type === "checkbox") field.checked = value === true; else field.value = value })
        const selected = table.selectedCells()[0]; panel.querySelector('input[data-cell-property="fill"]').value = selected && selected.fill ? selected.fill : table.fill
        panel.querySelector('[data-table-action="merge"]').disabled = table.selectedCells().length < 2; panel.querySelector('[data-table-action="delete-row"]').disabled = table.rows <= 1; panel.querySelector('[data-table-action="delete-column"]').disabled = table.columns <= 1
        panel.querySelector('[data-table-toggle="bold"]').classList.toggle("is-active", table.fontWeight === "700"); panel.querySelector('[data-table-toggle="italic"]').classList.toggle("is-active", table.fontStyle === "italic"); panel.querySelector('[data-table-toggle="underline"]').classList.toggle("is-active", table.underline)
    }
    function showInspector(table) { if (typeof document.createElement !== "function") return; const panel = buildInspector(); panel.hidden = false; renderInspector(table) }
    function cellRect(table, cell) {
        const canvasRect = canvas.upperCanvasEl.getBoundingClientRect(); const box = table.cellBounds(cell.row, cell.column); const matrix = table.calcTransformMatrix(); const viewport = canvas.viewportTransform
        const a = fabric.util.transformPoint(fabric.util.transformPoint(new fabric.Point(box.x, box.y), matrix), viewport); const b = fabric.util.transformPoint(fabric.util.transformPoint(new fabric.Point(box.x + box.width, box.y + box.height), matrix), viewport)
        return { left: canvasRect.left + ((Math.min(a.x, b.x) * canvasRect.width) / canvas.getWidth()), top: canvasRect.top + ((Math.min(a.y, b.y) * canvasRect.height) / canvas.getHeight()), width: Math.abs(b.x - a.x) * canvasRect.width / canvas.getWidth(), height: Math.abs(b.y - a.y) * canvasRect.height / canvas.getHeight() }
    }
    function editCell(table, cell) {
        if (editor) editor.remove(); const rect = cellRect(table, cell); const style = table.cellStyle(cell.row, cell.column); editor = document.createElement("textarea"); editor.className = "cg-table-cell-editor"; editor.value = table.cells[cell.row][cell.column].text || ""
        Object.assign(editor.style, { left: `${rect.left  }px`, top: `${rect.top  }px`, width: `${rect.width  }px`, height: `${rect.height  }px`, color: style.textColor, background: style.fill, textAlign: style.textAlign, fontFamily: table.fontFamily, fontSize: `${style.fontSize  }px`, fontWeight: style.fontWeight, fontStyle: style.fontStyle }); document.body.appendChild(editor)
        function finish() { if (!editor) return; table.cells[cell.row][cell.column].text = editor.value; editor.remove(); editor = null; commit(table); renderInspector(table) }
        editor.addEventListener("blur", finish, { once: true }); editor.addEventListener("keydown", function (event) { if (event.key === "Escape") { editor.value = table.cells[cell.row][cell.column].text || ""; editor.blur() } if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); editor.blur() } }); editor.focus(); editor.select()
    }
    function isTableObject(target) { return !!target && (target instanceof FabricTable || target.type === FabricTable.type) }
    function legacyTablePreset(target) {
        if (!target || target.type !== "group") return null
        const match = String(target.name || "").match(/^(Table2x2|Table3x3|Swimlane)(?:_|$)/i)
        return match ? match[1].toLowerCase() : null
    }
    function upgradeLegacyTable(target) {
        const preset = legacyTablePreset(target); if (!preset || !canvas) return null
        const size = preset === "table2x2" ? 2 : 3
        /* STAMP: 2026-08-29 - Previously saved table presets were line groups.
         * Upgrade only those stamped preset names on interaction, retaining
         * their canvas identity and transforms while enabling native table UI. */
        const table = new FabricTable({
            id: target.id, name: target.name, left: target.left, top: target.top,
            rows: preset === "swimlane" ? 2 : size, columns: size, headerRow: preset === "swimlane",
            scaleX: target.scaleX, scaleY: target.scaleY, angle: target.angle,
            flipX: target.flipX, flipY: target.flipY, opacity: target.opacity,
            visible: target.visible, selectable: target.selectable, evented: target.evented
        })
        canvas.remove(target); canvas.add(table); canvas.setActiveObject(table); table.setCoords(); canvas.requestRenderAll()
        if (typeof window.updateCanvasState === "function") window.updateCanvasState()
        if (typeof window.CGLoadTimeline === "function") window.CGLoadTimeline()
        return table
    }
    function tableAtOuterEdge(scenePoint, eventTarget) {
        if (isTableObject(eventTarget) && eventTarget.isOuterEdgeAt(scenePoint)) return eventTarget
        /* STAMP: 2026-08-29 - Fabric may return no target when the pointer is
         * just outside the table's thin perimeter stroke. Search top-to-bottom
         * only in that empty-target case so a nearby table edge remains easy
         * to select without stealing clicks from overlapping canvas objects. */
        if (eventTarget || !canvas || typeof canvas.getObjects !== "function") return null
        const objects = canvas.getObjects()
        for (let index = objects.length - 1; index >= 0; index -= 1) {
            if (isTableObject(objects[index]) && objects[index].visible !== false && objects[index].evented !== false && objects[index].isOuterEdgeAt(scenePoint)) return objects[index]
        }
        return null
    }
    function initialise(nextCanvas) {
        if (!isFabricCanvas(nextCanvas)) return false; canvas = nextCanvas; bindToolbar(); if (canvas.__fabricTableWidget) return true; canvas.__fabricTableWidget = true
        canvas.on("mouse:down", function (event) {
            const point = event.scenePoint || canvas.getScenePoint(event.e)
            const upgradedTable = upgradeLegacyTable(event.target)
            if (upgradedTable) { showInspector(upgradedTable); return }
            const edgeTable = tableAtOuterEdge(point, event.target)
            if (edgeTable) {
                /* An outside-frame click explicitly selects the table as one
                 * object and clears cell highlighting so the dotted Fabric
                 * boundary and corner controls are visually unambiguous. */
                edgeTable.selectionStart = null; edgeTable.selectionEnd = null; edgeTable.hasBorders = true; edgeTable.hasControls = true; edgeTable.borderDashArray = [5, 4]
                edgeTable.refreshControls(); edgeTable.setCoords(); canvas.setActiveObject(edgeTable)
                if (typeof window.applyCanvasObjectActionControls === "function") window.applyCanvasObjectActionControls(edgeTable)
                showInspector(edgeTable); canvas.requestRenderAll(); return
            }
            const table = event.target; if (!isTableObject(table)) return
            canvas.setActiveObject(table)
            const cell = table.cellAt(point); if (cell) { table.selectCell(cell, !!event.e.shiftKey); showInspector(table); canvas.requestRenderAll() }
        })
        canvas.on("mouse:dblclick", function (event) { const table = event.target; if (!isTableObject(table)) return; const point = event.scenePoint || canvas.getScenePoint(event.e); if (table.isOuterEdgeAt(point)) return; const cell = table.cellAt(point); if (cell) editCell(table, cell) })
        canvas.on("contextmenu", function (event) { const table = event.target; if (!isTableObject(table)) return; event.e.preventDefault(); const cell = table.cellAt(event.scenePoint || canvas.getScenePoint(event.e)); if (!cell) return; const range = table.getSelectionRange(); if (!(range && cell.row >= range.top && cell.row <= range.bottom && cell.column >= range.left && cell.column <= range.right)) table.selectCell(cell, false); canvas.setActiveObject(table); canvas.requestRenderAll(); showInspector(table); showMenu(table, event.e) })
        canvas.on("selection:created", function (event) { if (event.selected && event.selected[0] instanceof FabricTable) showInspector(event.selected[0]) }); canvas.on("selection:updated", function (event) { if (event.selected && event.selected[0] instanceof FabricTable) showInspector(event.selected[0]) }); canvas.on("selection:cleared", function () { if (inspector) inspector.hidden = true }); return true
    }
    window.FabricTable = FabricTable; window.ContentTableWidget = { create (options) { return new FabricTable(options) }, add, initialise }
    /* fabric-main.js publishes the lexical Fabric instance through CGCanvas
       and a ready event. Use that supported handoff instead of window.canvas. */
    if (typeof window.addEventListener === "function") {
        window.addEventListener("cg:canvas-ready", function (event) {
            initialise(event.detail && event.detail.canvas ? event.detail.canvas : window.CGCanvas)
        })
    }
    if (typeof window.setInterval === "function") {
        const timer = window.setInterval(function () {
            const sharedCanvas = window.CGCanvas
            if (sharedCanvas && initialise(sharedCanvas)) window.clearInterval(timer)
        }, 100)
    }
}(window, document))
