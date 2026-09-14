/**
 * Figma-style Fabric.js connections, graphs, and tree relationships.
 * STAMP: 2026-08-25
 * First-class connector objects persist in normal Fabric JSON and remain
 * independent from the legacy editor controller.
 */
(function (window, document) {
    "use strict"

    const fabric = window.fabric
    if (!fabric || !fabric.Line || !fabric.Control) return

    let activeCanvas = null
    let connectSource = null
    let connectMode = false
    let removingDependants = false
    const ANCHORS = ["top", "right", "bottom", "left"]
    const SHAPE_TYPES = ["rect", "circle", "ellipse", "triangle", "polygon"]
    const SHAPE_GAP = 72

    function makeId(prefix) {
        return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    }

    function isConnection(object) {
        return !!object && (object.type === "connection" || object.isConnection === true)
    }

    function isSupportedShape(object) {
        return !!object && SHAPE_TYPES.indexOf(String(object.type || "").toLowerCase()) >= 0
            && !object.isConnection && !object.flowPreview
    }

    function findObject(id) {
        if (!activeCanvas || !id) return null
        return activeCanvas.getObjects().find(function (object) { return object.id === id }) || null
    }

    function pointForAnchor(object, anchor) {
        if (!object) return null
        const origins = {
            top: ["center", "top"],
right: ["right", "center"],
            bottom: ["center", "bottom"],
left: ["left", "center"]
        }
        const origin = origins[anchor] || origins.right
        return object.getPointByOrigin(origin[0], origin[1])
    }

    function closestAnchor(object, point) {
        let best = "right"
        let distance = Infinity
        ANCHORS.forEach(function (anchor) {
            const candidate = pointForAnchor(object, anchor)
            const next = Math.pow(candidate.x - point.x, 2) + Math.pow(candidate.y - point.y, 2)
            if (next < distance) { distance = next; best = anchor }
        })
        return best
    }

    function findTargetAt(point, ignoredConnection) {
        if (!activeCanvas) return null
        return activeCanvas.getObjects().slice().reverse().find(function (object) {
            if (object === ignoredConnection || isConnection(object) || !object.visible || object.evented === false) return false
            return object.containsPoint(point)
        }) || null
    }

    function endpointPosition(which) {
        return function (_dimension, finalMatrix, object) {
            const points = object.calcLinePoints()
            const local = which === "source" ? new fabric.Point(points.x1, points.y1) : new fabric.Point(points.x2, points.y2)
            return fabric.util.transformPoint(local, finalMatrix)
        }
    }

    function dragEndpoint(which) {
        return function (eventData, transform) {
            const connection = transform.target
            const pointer = activeCanvas.getScenePoint(eventData)
            const target = findTargetAt(pointer, connection)
            if (which === "source") {
                connection.sourceId = target ? target.id : null
                connection.sourceAnchor = target ? closestAnchor(target, pointer) : connection.sourceAnchor
                connection.set({ x1: pointer.x, y1: pointer.y })
                if (connection.relationType === "tree") connection.parentId = connection.sourceId
            } else {
                connection.targetId = target ? target.id : null
                connection.targetAnchor = target ? closestAnchor(target, pointer) : connection.targetAnchor
                connection.set({ x2: pointer.x, y2: pointer.y })
                if (connection.relationType === "tree") connection.childId = connection.targetId
            }
            updateConnection(connection) // eslint-disable-line no-use-before-define
            return true
        }
    }

    function createEndpointControls() {
        function render(ctx, left, top) {
            ctx.save()
            ctx.fillStyle = "#ffffff"
            ctx.strokeStyle = "#7f56d9"
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.arc(left, top, 6, 0, Math.PI * 2)
            ctx.fill()
            ctx.stroke()
            ctx.restore()
        }
        return {
            source: new fabric.Control({ cursorStyle: "crosshair",
actionName: "reconnect",
sizeX: 16,
sizeY: 16,
                positionHandler: endpointPosition("source"),
actionHandler: dragEndpoint("source"),
render }),
            target: new fabric.Control({ cursorStyle: "crosshair",
actionName: "reconnect",
sizeX: 16,
sizeY: 16,
                positionHandler: endpointPosition("target"),
actionHandler: dragEndpoint("target"),
render })
        }
    }

    class Connection extends fabric.Line {
        constructor(points, options) {
            options = Object.assign({}, options || {})
            delete options.type
            super(points || [0, 0, 1, 1], Object.assign({
                stroke: "#475467",
strokeWidth: 2,
fill: "transparent",
selectable: true,
                evented: true,
perPixelTargetFind: true,
hasBorders: false,
hasControls: true,
                objectCaching: false,
strokeUniform: true,
lockMovementX: true,
lockMovementY: true,
                name: "Connection"
            }, options))
            this.id = options.id || makeId("connection_")
            this.isConnection = true
            this.sourceId = options.sourceId || null
            this.targetId = options.targetId || null
            this.sourceAnchor = options.sourceAnchor || "right"
            this.targetAnchor = options.targetAnchor || "left"
            this.connectionType = options.connectionType || "straight"
            this.relationType = options.relationType || "graph"
            this.parentId = options.parentId || (this.relationType === "tree" ? this.sourceId : null)
            this.childId = options.childId || (this.relationType === "tree" ? this.targetId : null)
            this.arrowEnd = options.arrowEnd !== false
            this.controls = createEndpointControls()
        }

        _render(ctx) {
            const points = this.calcLinePoints()
            const x1 = points.x1, y1 = points.y1, x2 = points.x2, y2 = points.y2
            ctx.beginPath()
            ctx.moveTo(x1, y1)
            if (this.connectionType === "curved") {
                const bend = Math.max(45, Math.abs(x2 - x1) * 0.45)
                const direction = x2 >= x1 ? 1 : -1
                ctx.bezierCurveTo(x1 + (bend * direction), y1, x2 - (bend * direction), y2, x2, y2)
            } else if (this.connectionType === "elbow") {
                const middleX = (x1 + x2) / 2
                ctx.lineTo(middleX, y1); ctx.lineTo(middleX, y2); ctx.lineTo(x2, y2)
            } else {
                ctx.lineTo(x2, y2)
            }
            this._renderStroke(ctx)
            if (this.arrowEnd) this._renderArrow(ctx, x1, y1, x2, y2)
        }

        _renderArrow(ctx, x1, y1, x2, y2) {
            let previousX = x1
            const previousY = y1
            if (this.connectionType === "elbow") previousX = (x1 + x2) / 2
            if (this.connectionType === "curved") previousX = x2 - (x2 >= x1 ? 12 : -12)
            const angle = Math.atan2(y2 - previousY, x2 - previousX)
            const size = Math.max(9, this.strokeWidth * 4.5)
            ctx.save(); ctx.translate(x2, y2); ctx.rotate(angle)
            ctx.fillStyle = this.stroke || "#475467"
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-size, size * 0.55)
            ctx.lineTo(-size, -size * 0.55); ctx.closePath(); ctx.fill(); ctx.restore()
        }

        toObject(propertiesToInclude) {
            return Object.assign(super.toObject(propertiesToInclude), {
                id: this.id,
isConnection: true,
sourceId: this.sourceId,
targetId: this.targetId,
                sourceAnchor: this.sourceAnchor,
targetAnchor: this.targetAnchor,
                connectionType: this.connectionType,
relationType: this.relationType,
                parentId: this.parentId,
childId: this.childId,
arrowEnd: this.arrowEnd
            })
        }

        static async fromObject(object) {
            return new Connection([object.x1, object.y1, object.x2, object.y2], object)
        }
    }

    Connection.type = "connection"
    fabric.classRegistry.setClass(Connection, "connection")
    fabric.classRegistry.setClass(Connection, "Connection")
    window.FabricConnection = Connection

    function updateConnection(connection) {
        if (!connection || !activeCanvas) return
        const source = findObject(connection.sourceId)
        const target = findObject(connection.targetId)
        const start = source ? pointForAnchor(source, connection.sourceAnchor) : { x: connection.x1, y: connection.y1 }
        const end = target ? pointForAnchor(target, connection.targetAnchor) : { x: connection.x2, y: connection.y2 }
        connection.set({ x1: start.x, y1: start.y, x2: end.x, y2: end.y })
        connection.setCoords()
        connection.dirty = true
    }

    function updateForNode(node) {
        if (!node || isConnection(node) || !activeCanvas) return
        activeCanvas.getObjects().forEach(function (connection) {
            if (isConnection(connection) && (connection.sourceId === node.id || connection.targetId === node.id)) updateConnection(connection)
        })
        activeCanvas.requestRenderAll()
    }

    function controlValue(id, fallback) { const element = document.getElementById(id); return element ? element.value : fallback }
    function isChecked(id, fallback) { const element = document.getElementById(id); return element ? element.checked : fallback }
    function status(message) { const element = document.getElementById("cgConnectionStatus"); if (element) element.textContent = message }

    function createConnection(source, target, options) {
        if (!source || !target || source === target || isConnection(source) || isConnection(target)) return null
        if (!source.id) source.id = makeId("node_")
        if (!target.id) target.id = makeId("node_")
        options = options || {}
        const sourceAnchor = closestAnchor(source, target.getCenterPoint())
        const targetAnchor = closestAnchor(target, source.getCenterPoint())
        const start = pointForAnchor(source, sourceAnchor)
        const end = pointForAnchor(target, targetAnchor)
        const connection = new Connection([start.x, start.y, end.x, end.y], {
            sourceId: source.id,
targetId: target.id,
sourceAnchor,
targetAnchor,
            connectionType: options.connectionType || controlValue("cgConnectionType", "straight"),
            relationType: options.relationType || controlValue("cgConnectionRelation", "graph"),
            stroke: options.stroke || controlValue("cgConnectionColor", "#475467"),
            strokeWidth: Number(options.strokeWidth || controlValue("cgConnectionWidth", 2)),
            arrowEnd: options.arrowEnd !== undefined ? options.arrowEnd : isChecked("cgConnectionArrow", true)
        })
        activeCanvas.add(connection)
        activeCanvas.sendObjectToBack(connection)
        updateConnection(connection)
        return connection
    }

    /* STAMP: 2026-08-29 - Figma-style shape branching. The clone uses the
       source object's own serialized properties, so dimensions,
       scaling, rotation, fill, stroke, opacity, and shape-specific values are
       retained without maintaining a parallel shape factory. */
    function cloneCenterForAnchor(source, anchor) {
        const center = source.getCenterPoint()
        const bounds = source.getBoundingRect()
        const xDistance = bounds.width + SHAPE_GAP
        const yDistance = bounds.height + SHAPE_GAP
        return new fabric.Point(
            center.x + (anchor === "right" ? xDistance : (anchor === "left" ? -xDistance : 0)),
            center.y + (anchor === "bottom" ? yDistance : (anchor === "top" ? -yDistance : 0))
        )
    }

    function placeClone(source, clone, anchor) {
        const center = cloneCenterForAnchor(source, anchor)
        clone.set({ left: center.x, top: center.y, originX: "center", originY: "center" })
        clone.setCoords()
    }

    function persistShapeBranch() {
        if (window.generated_slides && window.slide_index >= 0 && window.generated_slides[window.slide_index]) {
            const slide = window.generated_slides[window.slide_index]
            slide.jsonobj = activeCanvas.toObject(["id"])
            slide.svg = encodeURIComponent(activeCanvas.toSVG())
        }
        if (typeof window.updateCanvasState === "function") window.updateCanvasState()
    }

    function createShapeBranch(source, anchor) {
        if (!activeCanvas || !isSupportedShape(source)) return false
        source.clone(["id"]).then(function (clone) {
            clone.id = makeId("shape_")
            clone.name = source.name || source.type
            clone.flowPreview = false
            clone.excludeFromExport = false
            placeClone(source, clone, anchor)
            activeCanvas.add(clone)
            if (typeof window.applyCanvasObjectActionControls === "function") window.applyCanvasObjectActionControls(clone)
            applyShapeBranchControls(clone) // eslint-disable-line no-use-before-define
            /* Register the generated clone through the same legacy object-list
               hooks used by ordinary shape insertion. */
            if (typeof window.pushControl === "function") {
                const objectListName = source.name || source.type.charAt(0).toUpperCase() + source.type.slice(1)
                window.pushControl(clone.id, objectListName)
            }
            activeCanvas.setActiveObject(clone)
            activeCanvas.requestRenderAll()
            persistShapeBranch()
            if (typeof window.CGLoadTimeline === "function") window.CGLoadTimeline()
            if (typeof window.getselobjprop === "function") window.getselobjprop()
        })
        return false
    }

    function renderShapeAnchor(ctx, left, top) {
        ctx.save()
        ctx.shadowColor = "rgba(20, 132, 255, 0.28)"
        ctx.shadowBlur = 5
        ctx.fillStyle = "#55b6f4"
        ctx.strokeStyle = "#ffffff"
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(left, top, 5, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        ctx.restore()
    }

    function shapeAnchorControl(anchor) {
        const positions = {
            top: { x: 0, y: -0.5, offsetY: -20, cursor: "n-resize" },
            right: { x: 0.5, y: 0, offsetX: 20, cursor: "e-resize" },
            bottom: { x: 0, y: 0.5, offsetY: 20, cursor: "s-resize" },
            left: { x: -0.5, y: 0, offsetX: -20, cursor: "w-resize" }
        }
        const position = positions[anchor]
        return new fabric.Control({
            x: position.x,
            y: position.y,
            offsetX: position.offsetX || 0,
            offsetY: position.offsetY || 0,
            sizeX: 22,
            sizeY: 22,
            cursorStyle: position.cursor,
            actionName: "createConnectedShape",
            render: renderShapeAnchor,
            mouseUpHandler: function (_eventData, transform) { return createShapeBranch(transform.target, anchor) }
        })
    }

    function applyShapeBranchControls(object) {
        if (!isSupportedShape(object)) return object
        object.controls = Object.assign({}, object.controls, {
            flowTop: shapeAnchorControl("top"),
            flowRight: shapeAnchorControl("right"),
            flowBottom: shapeAnchorControl("bottom"),
            flowLeft: shapeAnchorControl("left")
        })
        object.setCoords()
        return object
    }

    function installShapeControlBridge() {
        const applyControls = window.applyCanvasObjectActionControls
        if (typeof applyControls !== "function" || applyControls.__shapeBranchControls) return
        const bridgedApplyControls = function (target) {
            const result = applyControls(target)
            applyShapeBranchControls(target)
            return result
        }
        bridgedApplyControls.__shapeBranchControls = true
        window.applyCanvasObjectActionControls = bridgedApplyControls
    }

    function setMode(enabled) {
        connectMode = enabled; connectSource = null
        const button = document.getElementById("cgConnectionCreate")
        if (button) { button.classList.toggle("is-active", enabled); button.setAttribute("aria-pressed", String(enabled)) }
        status(enabled ? "Choose the first object to connect." : "Select two or more objects, or click Connect then choose two objects.")
    }

    function connectSelection() {
        const selected = activeCanvas.getActiveObjects().filter(function (object) { return !isConnection(object) })
        if (selected.length < 2) return false
        const source = selected[0]
        const created = selected.slice(1).map(function (target) { return createConnection(source, target) }).filter(Boolean)
        activeCanvas.discardActiveObject()
        if (created.length === 1) activeCanvas.setActiveObject(created[0])
        activeCanvas.requestRenderAll()
        status(`${created.length  } connection${  created.length === 1 ? "" : "s"  } created.`)
        return true
    }

    function syncInspector(object) {
        const connection = isConnection(object) ? object : null
        const panel = document.getElementById("cgConnectionPanel")
        const deleteButton = document.getElementById("cgConnectionDelete")
        /* STAMP: 2026-08-27 - Connection authoring UI was removed, but the
         * runtime remains tolerant so previously saved connectors can load. */
        if (!deleteButton) return
        if (panel && connection) panel.hidden = false
        deleteButton.hidden = !connection
        if (!connection) return
        document.getElementById("cgConnectionType").value = connection.connectionType
        document.getElementById("cgConnectionRelation").value = connection.relationType
        document.getElementById("cgConnectionColor").value = connection.stroke
        document.getElementById("cgConnectionWidth").value = connection.strokeWidth
        document.getElementById("cgConnectionArrow").checked = connection.arrowEnd
        status(`${connection.relationType === "tree" ? "Parent / child" : "Graph"  } connection selected. Drag either purple endpoint to reconnect.`)
    }

    function applyInspector() {
        const connection = activeCanvas && activeCanvas.getActiveObject()
        if (!isConnection(connection)) return
        connection.set({ connectionType: controlValue("cgConnectionType", "straight"),
            relationType: controlValue("cgConnectionRelation", "graph"),
            stroke: controlValue("cgConnectionColor", "#475467"),
            strokeWidth: Number(controlValue("cgConnectionWidth", 2)),
arrowEnd: isChecked("cgConnectionArrow", true) })
        connection.parentId = connection.relationType === "tree" ? connection.sourceId : null
        connection.childId = connection.relationType === "tree" ? connection.targetId : null
        updateConnection(connection)
        activeCanvas.requestRenderAll()
    }

    function bindUi() {
        const button = document.getElementById("cgConnectionCreate")
        const panel = document.getElementById("cgConnectionPanel")
        const closeButton = document.getElementById("cgConnectionClose")
        if (!button || button.dataset.bound === "true") return
        button.dataset.bound = "true"
        button.addEventListener("click", function () { panel.hidden = false; if (!connectSelection()) setMode(!connectMode) });
        if (closeButton) closeButton.addEventListener("click", function (event) {
            event.preventDefault()
            event.stopPropagation()
            panel.hidden = true
            setMode(false)
        })
        ["cgConnectionType", "cgConnectionRelation", "cgConnectionColor", "cgConnectionWidth", "cgConnectionArrow"].forEach(function (id) {
            document.getElementById(id).addEventListener("change", applyInspector)
        })
        document.getElementById("cgConnectionDelete").addEventListener("click", function () {
            const connection = activeCanvas.getActiveObject()
            if (isConnection(connection)) { activeCanvas.remove(connection); activeCanvas.discardActiveObject(); activeCanvas.requestRenderAll() }
        })
    }

    function initialise(canvas) {
        if (!canvas || canvas.__connectionsInitialised) return
        canvas.__connectionsInitialised = true; activeCanvas = canvas; installShapeControlBridge(); bindUi();
        ["object:moving", "object:scaling", "object:rotating", "object:modified"].forEach(function (eventName) {
            canvas.on(eventName, function (event) { updateForNode(event.target) })
        })
        canvas.on("object:added", function (event) { if (isConnection(event.target)) updateConnection(event.target) })
        canvas.on("object:removed", function (event) {
            if (removingDependants || isConnection(event.target)) return
            removingDependants = true
            canvas.getObjects().filter(function (object) {
                return isConnection(object) && (object.sourceId === event.target.id || object.targetId === event.target.id)
            }).forEach(function (connection) { canvas.remove(connection) })
            removingDependants = false
        })
        canvas.on("mouse:down", function (event) {
            if (!connectMode || !event.target || isConnection(event.target)) return
            if (!connectSource) { connectSource = event.target; status("Choose the object to connect to."); return }
            const connection = createConnection(connectSource, event.target)
            setMode(false)
            if (connection) { canvas.setActiveObject(connection); syncInspector(connection); canvas.requestRenderAll() }
        })
        canvas.on("selection:created", function (event) { syncInspector(event.target) })
        canvas.on("selection:created", function (event) { applyShapeBranchControls(event.target) })
        canvas.on("selection:updated", function (event) { syncInspector(event.target); applyShapeBranchControls(event.target) })
        canvas.on("selection:cleared", function () { syncInspector(null) })
        canvas.getObjects().forEach(function (object) { if (isConnection(object)) updateConnection(object) })
    }

    window.ContentConnections = { initialise, create: createConnection, update: updateConnection, isConnection }
    /* STAMP: 2026-08-26 - Bind to the editor's stable Fabric canvas handoff.
     * The lexical canvas is intentionally not exposed as window.canvas. */
    function initialiseAvailableCanvas(event) {
        const availableCanvas = event && event.detail && event.detail.canvas
            ? event.detail.canvas
            : (window.CGCanvas || window.canvas)
        if (!availableCanvas || typeof availableCanvas.on !== "function") return false
        initialise(availableCanvas)
        return true
    }
    window.addEventListener("cg:canvas-ready", initialiseAvailableCanvas)
    const timer = window.setInterval(function () {
        if (initialiseAvailableCanvas()) window.clearInterval(timer)
    }, 50)
}(window, document))
