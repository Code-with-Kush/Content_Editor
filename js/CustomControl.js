/*
 * Fabric 7 control configuration
 * STAMP: 2026-08-25
 * Uses supported defaults and preserves existing top-left ContentData origins.
 */
(function (window) {
    "use strict"

    const fabric = window.fabric
    if (!fabric || !fabric.FabricObject) return

    const controlDefaults = {
        originX: "left",
        originY: "top",
        transparentCorners: false,
        cornerColor: "#1c4467",
        cornerStrokeColor: "#000000",
        cornerSize: 15,
        cornerStyle: "circle",
        borderColor: "#1c4467",
        padding: 0
    }

    const classesWithPositionDefaults = [
        fabric.FabricObject,
        fabric.InteractiveFabricObject,
        fabric.Rect,
        fabric.Circle,
        fabric.Triangle,
        fabric.Line,
        fabric.Text,
        fabric.IText,
        fabric.Textbox,
        fabric.FabricImage,
        fabric.Group,
        fabric.ActiveSelection
    ]
    classesWithPositionDefaults.forEach(function (FabricClass) {
        if (FabricClass && FabricClass.ownDefaults) Object.assign(FabricClass.ownDefaults, controlDefaults)
    })

    const controlsUtils = fabric.controlsUtils
    if (!controlsUtils || typeof controlsUtils.createObjectDefaultControls !== "function") return

    /* STAMP: 2026-08-24 - Restore Fabric 7's regular resize and rotation
       controls. Delete and Edit remain available through the established
       keyboard/context/property-panel flows instead of occupying corners. */
    /* STAMP: 2026-09-05 - Keep the entire rotation handle inside the visible
       canvas. Prefer its normal top position, flip below at an edge, then
       clamp if neither side fits. Position and hit-testing share this handler;
       Fabric's existing rotation action remains unchanged. */
    function keepRotationHandleInCanvas(controls) {
        const rotation = controls && controls.mtr
        if (!rotation || rotation.cgCanvasBounded) return controls
        rotation.cgCanvasBounded = true
        const nativePosition = rotation.positionHandler
        rotation.positionHandler = function (dimensions, matrix, target, control) {
            const top = nativePosition.call(this, dimensions, matrix, target, control)
            const canvas = target.canvas
            if (!canvas || !canvas.upperCanvasEl) return top
            const rect = canvas.upperCanvasEl.getBoundingClientRect()
            if (!rect.width || !rect.height) return top
            const scaleX = canvas.getWidth() / rect.width
            const scaleY = canvas.getHeight() / rect.height
            const margin = Math.max(target.cornerSize || 10, this.sizeX || 0, this.sizeY || 0) / 2 + 3
            const left = Math.max(0, -rect.left * scaleX) + margin
            const right = Math.max(left, Math.min(canvas.getWidth(), (window.innerWidth - rect.left) * scaleX) - margin)
            const minY = Math.max(0, -rect.top * scaleY) + margin
            const maxY = Math.max(minY, Math.min(canvas.getHeight(), (window.innerHeight - rect.top) * scaleY) - margin)
            const fits = point => point.x >= left && point.x <= right && point.y >= minY && point.y <= maxY
            if (fits(top)) return top
            const bottomControl = Object.assign(Object.create(this), { y: -this.y, offsetY: -this.offsetY })
            const bottom = nativePosition.call(bottomControl, dimensions, matrix, target, bottomControl)
            if (fits(bottom)) return bottom
            const clamp = point => new fabric.Point(Math.max(left, Math.min(right, point.x)), Math.max(minY, Math.min(maxY, point.y)))
            const clippedTop = clamp(top)
            const clippedBottom = clamp(bottom)
            const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
            return distance(top, clippedTop) <= distance(bottom, clippedBottom) ? clippedTop : clippedBottom
        }
        return controls
    }
    window.CGKeepRotationHandleInCanvas = keepRotationHandleInCanvas

    function createRegularControls() {
        return keepRotationHandleInCanvas(controlsUtils.createObjectDefaultControls())
    }

    /* STAMP: 2026-08-25 - Textbox side handles use Fabric's supported
       change-width action. This reflows text without scaling/distorting glyphs. */
    function createTextboxControls() {
        if (typeof controlsUtils.createTextboxDefaultControls === "function") {
            return keepRotationHandleInCanvas(controlsUtils.createTextboxDefaultControls())
        }
        return createRegularControls()
    }

    classesWithPositionDefaults.forEach(function (FabricClass) {
        if (FabricClass && FabricClass.prototype) FabricClass.prototype.controls = createRegularControls()
    })
    if (fabric.Textbox && fabric.Textbox.prototype) {
        fabric.Textbox.prototype.controls = createTextboxControls()
    }

    window.applyCanvasObjectActionControls = function applyCanvasObjectActionControls(target) {
        if (!target) return target
        /* STAMP: 2026-08-25 - Connections own draggable endpoint controls;
           replacing them with resize handles would prevent reconnection. */
        if (target.isConnection === true || target.type === "connection") {
            target.hasControls = true
            target.hasBorders = false
            target.setCoords()
            return target
        }
        /* STAMP: 2026-08-27 - A Fabric Table owns supported custom boundary
           controls for independent row/column resizing. */
        if (target.type === "fabric-table" && typeof target.refreshControls === "function") {
            target.refreshControls()
            keepRotationHandleInCanvas(target.controls)
            target.hasControls = true
            target.hasBorders = true
            target.transparentCorners = false
            target.cornerStyle = "circle"
            target.cornerColor = "#ffffff"
            target.cornerStrokeColor = "#1c4467"
            target.cornerSize = 10
            target.borderColor = "#1c4467"
            target.borderDashArray = [5, 4]
            if (typeof target.setControlsVisibility === "function") {
                var tableControlVisibility = {}
                Object.keys(target.controls || {}).forEach(function (key) { tableControlVisibility[key] = true })
                target.setControlsVisibility(tableControlVisibility)
            }
            target.setCoords()
            return target
        }
        const isTextbox = target.type === "textbox" || (fabric.Textbox && target instanceof fabric.Textbox)
        target.controls = isTextbox ? createTextboxControls() : createRegularControls()
        target.hasControls = true
        target.hasBorders = true
        target.transparentCorners = false
        target.cornerStyle = "circle"
        target.cornerColor = "#ffffff"
        target.cornerStrokeColor = "#1c4467"
        target.cornerSize = 10
        target.borderColor = "#1c4467"
        target.borderScaleFactor = 1.25
        if (typeof target.setControlsVisibility === "function") {
            let controlVisibility = {
                tl: true,
                tr: true,
                br: true,
                bl: true,
                ml: true,
                mt: true,
                mr: true,
                mb: true,
                mtr: true
            }
            if (isTextbox) {
                controlVisibility = {
                    tl: false,
                    tr: false,
                    br: false,
                    bl: false,
                    ml: true,
                    mt: false,
                    mr: true,
                    mb: false,
                    mtr: true
                }
            }
            target.setControlsVisibility(controlVisibility)
        }
        if (typeof target.getObjects === "function") {
            target.getObjects().forEach(window.applyCanvasObjectActionControls)
        }
        target.setCoords()
        return target
    }
}(window))
