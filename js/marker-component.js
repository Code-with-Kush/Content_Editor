/*
 * Marker configuration, live preview, and grouped Fabric insertion.
 * STAMP: 2026-09-26 - Keeps reusable marker state separate from editor lifecycle integration.
 */
(function initialiseMarkerComponent(window, document) {
    "use strict"

    const SVG_NAMESPACE = "http://www.w3.org/2000/svg"
    const SUPPORTED_SHAPES = ["rectangle", "square", "circle", "octagon", "hexagon"]
    const SUPPORTED_FONTS = ["Arial", "Verdana", "Tahoma", "Georgia", "Times New Roman"]
    const SUPPORTED_FONT_WEIGHTS = [400, 500, 600, 700]
    const DEFAULT_CONFIG = Object.freeze({
        shape: "rectangle",
        useNumbers: false,
        numberLimit: 5,
        shapeStyle: Object.freeze({
            fillColor: "#2563eb",
            strokeColor: "#1e3a8a",
            strokeWidth: 2,
            cornerRadius: 8,
            size: 72
        }),
        labelStyle: Object.freeze({
            textColor: "#ffffff",
            fontFamily: "Arial",
            fontSize: 22,
            fontWeight: 700
        })
    })

    const cloneDefaults = () => ({
        shape: DEFAULT_CONFIG.shape,
        useNumbers: DEFAULT_CONFIG.useNumbers,
        numberLimit: DEFAULT_CONFIG.numberLimit,
        shapeStyle: { ...DEFAULT_CONFIG.shapeStyle },
        labelStyle: { ...DEFAULT_CONFIG.labelStyle }
    })

    const clamp = (value, minimum, maximum, fallback) => {
        const parsedValue = Number(value)
        return Number.isFinite(parsedValue) ? Math.min(maximum, Math.max(minimum, parsedValue)) : fallback
    }

    const normalizeColor = (value, fallback) => (/^#[0-9a-f]{6}$/i.test(value || "") ? value.toLowerCase() : fallback)

    function normalizeConfig(candidate = {}) {
        const shapeStyle = candidate.shapeStyle || {}
        const labelStyle = candidate.labelStyle || {}
        const fontWeight = Number(labelStyle.fontWeight)
        return {
            shape: SUPPORTED_SHAPES.includes(candidate.shape) ? candidate.shape : DEFAULT_CONFIG.shape,
            useNumbers: candidate.useNumbers === true,
            numberLimit: Math.round(clamp(candidate.numberLimit, 1, 50, DEFAULT_CONFIG.numberLimit)),
            shapeStyle: {
                fillColor: normalizeColor(shapeStyle.fillColor, DEFAULT_CONFIG.shapeStyle.fillColor),
                strokeColor: normalizeColor(shapeStyle.strokeColor, DEFAULT_CONFIG.shapeStyle.strokeColor),
                strokeWidth: clamp(shapeStyle.strokeWidth, 0, 12, DEFAULT_CONFIG.shapeStyle.strokeWidth),
                cornerRadius: clamp(shapeStyle.cornerRadius, 0, 36, DEFAULT_CONFIG.shapeStyle.cornerRadius),
                size: clamp(shapeStyle.size, 40, 120, DEFAULT_CONFIG.shapeStyle.size)
            },
            labelStyle: {
                textColor: normalizeColor(labelStyle.textColor, DEFAULT_CONFIG.labelStyle.textColor),
                fontFamily: SUPPORTED_FONTS.includes(labelStyle.fontFamily) ? labelStyle.fontFamily : DEFAULT_CONFIG.labelStyle.fontFamily,
                fontSize: clamp(labelStyle.fontSize, 10, 48, DEFAULT_CONFIG.labelStyle.fontSize),
                fontWeight: SUPPORTED_FONT_WEIGHTS.includes(fontWeight) ? fontWeight : DEFAULT_CONFIG.labelStyle.fontWeight
            }
        }
    }

    function createSvgElement(name, attributes = {}) {
        const element = document.createElementNS(SVG_NAMESPACE, name)
        Object.entries(attributes).forEach(([attribute, value]) => element.setAttribute(attribute, String(value)))
        return element
    }

    function polygonPoints(shape, width, height, inset) {
        if (shape === "hexagon") {
            return `${width * 0.25},${inset} ${width * 0.75},${inset} ${width - inset},${height / 2} ` +
                `${width * 0.75},${height - inset} ${width * 0.25},${height - inset} ${inset},${height / 2}`
        }
        const cut = width * 0.29
        return `${cut},${inset} ${width - cut},${inset} ${width - inset},${cut} ` +
            `${width - inset},${height - cut} ${width - cut},${height - inset} ${cut},${height - inset} ` +
            `${inset},${height - cut} ${inset},${cut}`
    }

    function createMarkerPreview(config, number) {
        const size = config.shapeStyle.size
        const isRectangle = config.shape === "rectangle"
        const width = isRectangle ? Math.round(size * 1.35) : size
        const height = size
        const strokeInset = config.shapeStyle.strokeWidth / 2
        const svg = createSvgElement("svg", {
            class: "cg-marker-preview__marker",
            viewBox: `0 0 ${width} ${height}`,
            width,
            height,
            role: "img",
            "aria-label": config.useNumbers ? `Marker ${number}` : `${config.shape} marker`
        })
        const sharedAttributes = {
            fill: config.shapeStyle.fillColor,
            stroke: config.shapeStyle.strokeColor,
            "stroke-width": config.shapeStyle.strokeWidth,
            "vector-effect": "non-scaling-stroke"
        }
        let shape

        if (config.shape === "circle") {
            shape = createSvgElement("circle", {
                ...sharedAttributes,
                cx: width / 2,
                cy: height / 2,
                r: Math.max(1, (size / 2) - strokeInset)
            })
        } else if (config.shape === "hexagon" || config.shape === "octagon") {
            shape = createSvgElement("polygon", {
                ...sharedAttributes,
                points: polygonPoints(config.shape, width, height, strokeInset)
            })
        } else {
            shape = createSvgElement("rect", {
                ...sharedAttributes,
                x: strokeInset,
                y: strokeInset,
                width: Math.max(1, width - config.shapeStyle.strokeWidth),
                height: Math.max(1, height - config.shapeStyle.strokeWidth),
                rx: Math.min(config.shapeStyle.cornerRadius, height / 2),
                ry: Math.min(config.shapeStyle.cornerRadius, height / 2)
            })
        }
        svg.appendChild(shape)

        if (config.useNumbers) {
            const label = createSvgElement("text", {
                x: "50%",
                y: "50%",
                fill: config.labelStyle.textColor,
                "font-family": config.labelStyle.fontFamily,
                "font-size": config.labelStyle.fontSize,
                "font-weight": config.labelStyle.fontWeight,
                "text-anchor": "middle",
                "dominant-baseline": "central"
            })
            label.textContent = String(number)
            svg.appendChild(label)
        }
        return svg
    }

    function makeId(prefix) {
        return typeof window.generate_id === "function" ? window.generate_id(prefix) : `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
    }

    function patchMarkerSerialization() {
        const groupPrototype = window.fabric?.Group?.prototype
        if (!groupPrototype || groupPrototype.cgMarkerSerialization) return
        const originalToObject = groupPrototype.toObject
        groupPrototype.toObject = function toMarkerObject(propertiesToInclude) {
            return Object.assign(originalToObject.call(this, propertiesToInclude), {
                markerComponent: this.markerComponent,
                markerConfig: this.markerConfig,
                markerNumber: this.markerNumber
            })
        }
        groupPrototype.cgMarkerSerialization = true
    }

    function markerDimensions(config) {
        return {
            width: config.shape === "rectangle" ? Math.round(config.shapeStyle.size * 1.35) : config.shapeStyle.size,
            height: config.shapeStyle.size
        }
    }

    function fabricPolygonPoints(shape, width, height) {
        if (shape === "hexagon") {
            return [
                { x: width * 0.25, y: 0 }, { x: width * 0.75, y: 0 },
                { x: width, y: height / 2 }, { x: width * 0.75, y: height },
                { x: width * 0.25, y: height }, { x: 0, y: height / 2 }
            ]
        }
        const cut = width * 0.29
        return [
            { x: cut, y: 0 }, { x: width - cut, y: 0 }, { x: width, y: cut },
            { x: width, y: height - cut }, { x: width - cut, y: height },
            { x: cut, y: height }, { x: 0, y: height - cut }, { x: 0, y: cut }
        ]
    }

    function createFabricMarker(fabric, config, number, idBase) {
        const { width, height } = markerDimensions(config)
        const shapeOptions = {
            id: `${idBase}_shape`,
            left: width / 2,
            top: height / 2,
            originX: "center",
            originY: "center",
            fill: config.shapeStyle.fillColor,
            stroke: config.shapeStyle.strokeColor,
            strokeWidth: config.shapeStyle.strokeWidth,
            selectable: false,
            evented: false
        }
        let shape

        if (config.shape === "circle") {
            shape = new fabric.Circle({ ...shapeOptions, radius: height / 2 })
        } else if (config.shape === "hexagon" || config.shape === "octagon") {
            shape = new fabric.Polygon(fabricPolygonPoints(config.shape, width, height), shapeOptions)
        } else {
            shape = new fabric.Rect({
                ...shapeOptions,
                width,
                height,
                rx: config.shapeStyle.cornerRadius,
                ry: config.shapeStyle.cornerRadius
            })
        }

        if (!config.useNumbers) return [shape]
        return [
            shape,
            new fabric.IText(String(number), {
                id: `${idBase}_label`,
                left: width / 2,
                top: height / 2,
                originX: "center",
                originY: "center",
                fill: config.labelStyle.textColor,
                fontFamily: config.labelStyle.fontFamily,
                fontSize: config.labelStyle.fontSize,
                fontWeight: String(config.labelStyle.fontWeight),
                textAlign: "center",
                selectable: false,
                evented: false
            })
        ]
    }

    function createMarkerObject(fabric, config, markerNumber, options = {}) {
        const objectId = options.id || makeId("marker_")
        return new fabric.Group(createFabricMarker(fabric, config, markerNumber, objectId), {
            id: objectId,
            name: "Marker",
            markerComponent: true,
            markerConfig: normalizeConfig(config),
            markerNumber,
            left: options.left || 0,
            top: options.top || 0,
            angle: options.angle || 0,
            scaleX: options.scaleX || 1,
            scaleY: options.scaleY || 1,
            flipX: options.flipX || false,
            flipY: options.flipY || false,
            subTargetCheck: false,
            transparentCorners: true
        })
    }

    function addMarkerObjectsToCanvas(config, existingMarker = null) {
        const fabric = window.fabric
        const canvas = window.CGCanvas || window.canvas
        const editor = window.CGObjectLibraryEditor
        if (!fabric || !canvas || !editor?.insertMany) throw new Error("The canvas is still loading. Please try again.")

        if (!editor.getSlideId() && typeof window.addSlide === "function") window.addSlide(1)
        const slideId = editor.getSlideId()
        if (!slideId) throw new Error("The active slide could not be prepared.")

        patchMarkerSerialization()
        const canvasWidth = Number(canvas.width) || Number(canvas.getWidth?.()) || 943
        const canvasHeight = Number(canvas.height) || Number(canvas.getHeight?.()) || 442
        const markerCount = config.useNumbers ? config.numberLimit : 1
        const { width, height } = markerDimensions(config)
        const gap = 16
        const columns = Math.min(markerCount, 8)
        const rows = Math.ceil(markerCount / columns)
        const layoutWidth = (columns * width) + ((columns - 1) * gap)
        const layoutHeight = (rows * height) + ((rows - 1) * gap)

        if (existingMarker) {
            const replacement = createMarkerObject(fabric, config, existingMarker.markerNumber || 1, {
                id: existingMarker.id,
                left: existingMarker.left,
                top: existingMarker.top,
                angle: existingMarker.angle,
                scaleX: existingMarker.scaleX,
                scaleY: existingMarker.scaleY,
                flipX: existingMarker.flipX,
                flipY: existingMarker.flipY
            })
            editor.insertMany([replacement], slideId, existingMarker)
            return [replacement]
        }

        const availableWidth = Math.max(80, canvasWidth - 60)
        const availableHeight = Math.max(80, canvasHeight - 100)
        const scale = Math.min(1, availableWidth / layoutWidth, availableHeight / layoutHeight)
        const startX = Math.max(30, (canvasWidth - (layoutWidth * scale)) / 2)
        const objects = []

        for (let index = 0; index < markerCount; index += 1) {
            const row = Math.floor(index / columns)
            const column = index % columns
            objects.push(createMarkerObject(fabric, config, index + 1, {
                left: startX + (column * (width + gap) * scale),
                top: 50 + (row * (height + gap) * scale),
                scaleX: scale,
                scaleY: scale
            }))
        }

        editor.insertMany(objects, slideId)
        return objects
    }

    function setupMarkerBuilder() {
        const form = document.getElementById("markerBuilderForm")
        const trigger = document.getElementById("addMarkersComponent")
        const panel = document.getElementById("modalmarkers")
        const preview = document.getElementById("markerPreview")
        if (!form || !trigger || !panel || !preview) return

        const syncIslandState = (isOpen) => {
            const canvas = window.CGCanvas || window.canvas
            document.body.classList.toggle("cg-marker-island-open", isOpen)
            trigger.setAttribute("aria-expanded", String(isOpen))
            window.requestAnimationFrame(() => {
                window.dispatchEvent(new Event("resize"))
                canvas?.calcOffset?.()
                canvas?.requestRenderAll?.()
            })
        }
        const closeComponentMenu = () => {
            const toggle = document.querySelector(".cg-component-menu__toggle")
            const menu = document.querySelector(".cg-component-menu")
            window.bootstrap?.Dropdown?.getOrCreateInstance(toggle)?.hide()
            toggle?.classList.remove("show")
            toggle?.setAttribute("aria-expanded", "false")
            menu?.classList.remove("show")
        }
        const close = (restoreFocus = false) => {
            if (panel.hidden) return
            panel.hidden = true
            panel.setAttribute("aria-hidden", "true")
            syncIslandState(false)
            if (restoreFocus) trigger.focus({ preventScroll: true })
        }
        const open = () => {
            closeComponentMenu();
            ["CGLayersIsland", "CGShapeSidebar", "CGStickerIsland", "CGObjectLibraryIsland", "CGFlipCardIsland", "CGTreeNodesIsland"]
                .forEach((controller) => window[controller]?.close?.())
            panel.hidden = false
            panel.setAttribute("aria-hidden", "false")
            syncIslandState(true)
            window.requestAnimationFrame(() => form.querySelector("input, select, button")?.focus({ preventScroll: true }))
        }

        window.bootstrap?.Modal?.getInstance(panel)?.dispose()
        panel.classList.remove("modal", "fade", "show")
        panel.classList.add("cg-left-component-island")
        /* STAMP: 2026-09-28 - Keep the marker builder inside the stage so the
         * sticky editor menu cannot cover its header or close control. */
        document.querySelector(".cg-stage-column")?.appendChild(panel)
        panel.removeAttribute("style")
        panel.hidden = true
        panel.setAttribute("role", "dialog")
        panel.setAttribute("aria-modal", "false")
        panel.setAttribute("aria-hidden", "true")
        trigger.removeAttribute("data-bs-toggle")
        trigger.removeAttribute("data-bs-target")
        trigger.setAttribute("aria-controls", panel.id)
        trigger.setAttribute("aria-expanded", "false")
        window.CGMarkerIsland = Object.freeze({ open, close })

        panel.querySelectorAll('[data-bs-dismiss="modal"]').forEach((button) => {
            button.removeAttribute("data-bs-dismiss")
            button.addEventListener("click", () => close(true))
        })
        panel.addEventListener("keydown", (event) => {
            if (event.key !== "Escape") return
            event.preventDefault()
            event.stopPropagation()
            close(true)
        })
        document.querySelectorAll("#cgLayersIslandToggle, .cg-shape-toggle, #addFlipRevealDemo, #addTreeNodesComponent, #openStickerLibrary, #cgOpenObjectLibrary, #cgCanvasHelp")
            .forEach((button) => button.addEventListener("click", () => close()))

        const controls = {
            shape: document.getElementById("markerShape"),
            useNumbers: document.getElementById("markerUseNumbers"),
            numberLimit: document.getElementById("markerNumberLimit"),
            fillColor: document.getElementById("markerFillColor"),
            strokeColor: document.getElementById("markerStrokeColor"),
            strokeWidth: document.getElementById("markerStrokeWidth"),
            cornerRadius: document.getElementById("markerCornerRadius"),
            size: document.getElementById("markerSize"),
            textColor: document.getElementById("markerTextColor"),
            fontFamily: document.getElementById("markerFontFamily"),
            fontSize: document.getElementById("markerFontSize"),
            fontWeight: document.getElementById("markerFontWeight")
        }
        const numberSettings = document.getElementById("markerNumberSettings")
        const cornerRadiusField = document.getElementById("markerCornerRadiusField")
        const previewCount = document.getElementById("markerPreviewCount")
        const status = document.getElementById("markerBuilderStatus")
        const addButton = document.getElementById("addMarkerToCanvas")
        const modalTitle = document.getElementById("markerBuilderTitle")
        const numberLimitField = document.getElementById("markerNumberLimitField")
        let configuration = cloneDefaults()
        let editingMarker = null

        const setStatus = (message) => {
            status.textContent = message || ""
            status.hidden = !message
        }

        const readControls = () => normalizeConfig({
            shape: controls.shape.value,
            useNumbers: controls.useNumbers.checked,
            numberLimit: controls.numberLimit.value,
            shapeStyle: {
                fillColor: controls.fillColor.value,
                strokeColor: controls.strokeColor.value,
                strokeWidth: controls.strokeWidth.value,
                cornerRadius: controls.cornerRadius.value,
                size: controls.size.value
            },
            labelStyle: {
                textColor: controls.textColor.value,
                fontFamily: controls.fontFamily.value,
                fontSize: controls.fontSize.value,
                fontWeight: controls.fontWeight.value
            }
        })

        const writeControls = (config) => {
            controls.shape.value = config.shape
            controls.useNumbers.checked = config.useNumbers
            controls.numberLimit.value = config.numberLimit
            controls.fillColor.value = config.shapeStyle.fillColor
            controls.strokeColor.value = config.shapeStyle.strokeColor
            controls.strokeWidth.value = config.shapeStyle.strokeWidth
            controls.cornerRadius.value = config.shapeStyle.cornerRadius
            controls.size.value = config.shapeStyle.size
            controls.textColor.value = config.labelStyle.textColor
            controls.fontFamily.value = config.labelStyle.fontFamily
            controls.fontSize.value = config.labelStyle.fontSize
            controls.fontWeight.value = config.labelStyle.fontWeight
        }

        const render = () => {
            configuration = readControls()
            const markerCount = editingMarker ? 1 : (configuration.useNumbers ? configuration.numberLimit : 1)
            const firstMarkerNumber = editingMarker?.markerNumber || 1
            const supportsCornerRadius = configuration.shape === "rectangle" || configuration.shape === "square"
            const fragment = document.createDocumentFragment()

            numberSettings.hidden = !configuration.useNumbers
            numberLimitField.hidden = Boolean(editingMarker)
            cornerRadiusField.classList.toggle("is-disabled", !supportsCornerRadius)
            controls.cornerRadius.disabled = !supportsCornerRadius
            previewCount.value = editingMarker ? `Marker ${firstMarkerNumber}` : `${markerCount} marker${markerCount === 1 ? "" : "s"}`
            controls.size.nextElementSibling.value = `${configuration.shapeStyle.size} px`
            controls.fillColor.nextElementSibling.value = configuration.shapeStyle.fillColor.toUpperCase()
            controls.strokeColor.nextElementSibling.value = configuration.shapeStyle.strokeColor.toUpperCase()
            controls.textColor.nextElementSibling.value = configuration.labelStyle.textColor.toUpperCase()
            setStatus("")

            for (let index = 0; index < markerCount; index += 1) {
                const item = document.createElement("div")
                item.className = "cg-marker-preview__item"
                item.appendChild(createMarkerPreview(configuration, firstMarkerNumber + index))
                fragment.appendChild(item)
            }
            preview.replaceChildren(fragment)
        }

        const setConfig = (nextConfiguration) => {
            configuration = normalizeConfig(nextConfiguration)
            writeControls(configuration)
            render()
        }

        const setEditMode = (marker = null) => {
            editingMarker = marker
            modalTitle.textContent = marker ? "Edit Marker" : "Markers"
            addButton.textContent = marker ? "Update marker" : "Add to canvas"
        }

        const openForEdit = (marker) => {
            if (!marker?.markerComponent || !marker.markerConfig) return false
            setEditMode(marker)
            setConfig(marker.markerConfig)
            open()
            return true
        }

        form.addEventListener("input", render)
        form.addEventListener("change", render)
        form.querySelectorAll('input[type="number"]').forEach((input) => {
            input.addEventListener("blur", () => {
                writeControls(configuration)
                render()
            })
        })
        trigger.addEventListener("click", (event) => {
            event.preventDefault()
            setEditMode()
            setConfig(configuration)
            open()
        })
        document.getElementById("resetMarkerConfiguration").addEventListener("click", () => setConfig(cloneDefaults()))
        addButton.addEventListener("click", () => {
            if (addButton.disabled) return
            addButton.disabled = true
            setStatus("")
            try {
                configuration = readControls()
                addMarkerObjectsToCanvas(configuration, editingMarker)
                window.dispatchEvent(new CustomEvent("cg:marker-configured", { detail: normalizeConfig(configuration) }))
                close(true)
            } catch (error) {
                console.error("Markers could not be added to the canvas", error)
                setStatus(error.message || "Unable to add markers to the canvas.")
            } finally {
                addButton.disabled = false
            }
        })

        window.CGMarkers = Object.freeze({
            getConfig: () => normalizeConfig(configuration),
            setConfig,
            reset: () => setConfig(cloneDefaults()),
            addToCanvas: () => addMarkerObjectsToCanvas(configuration),
            open: () => {
                setEditMode()
                open()
            },
            openForEdit,
            close: () => window.CGMarkerIsland?.close?.()
        })

        document.addEventListener("click", (event) => {
            const editButton = event.target.closest?.('[data-cg-selection-action="edit-group"]')
            if (!editButton) return
            const marker = (window.CGCanvas || window.canvas)?.getActiveObject?.()
            if (!marker?.markerComponent) return
            event.preventDefault()
            event.stopImmediatePropagation()
            openForEdit(marker)
        }, true)
        setConfig(configuration)
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", setupMarkerBuilder, { once: true })
    } else {
        setupMarkerBuilder()
    }
    if (document.readyState === "complete") patchMarkerSerialization()
    else window.addEventListener("load", patchMarkerSerialization, { once: true })
}(window, document))
