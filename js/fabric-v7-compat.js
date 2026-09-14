/*
 * Fabric 7 legacy-data compatibility boundary
 * STAMP: 2026-08-18
 *
 * The editor stores Fabric 3 JSON and contains callback-based integrations.
 * Fabric 7 is Promise-first and renamed its stacking APIs. These narrowly
 * scoped adapters keep saved ContentData operational while new code uses the
 * Fabric 7 methods directly.
 */
(function (window) {
    "use strict"

    const fabric = window.fabric
    if (!fabric || !fabric.Canvas || fabric.__contentGeneratorV7Compat) return
    fabric.__contentGeneratorV7Compat = true

    const canvasPrototype = fabric.Canvas.prototype
    const objectPrototype = fabric.FabricObject.prototype
    const imagePrototype = fabric.FabricImage.prototype

    if (!canvasPrototype.setBackgroundColor) {
        canvasPrototype.setBackgroundColor = function (color, callback) {
            this.backgroundColor = color
            this.requestRenderAll()
            if (typeof callback === "function") callback()
            return this
        }
    }

    if (!canvasPrototype.getPointer) {
        canvasPrototype.getPointer = function (event) { return this.getScenePoint(event) }
    }

    const stackAliases = {
        sendToBack: "sendObjectToBack",
        bringToFront: "bringObjectToFront",
        sendBackwards: "sendObjectBackwards",
        bringForward: "bringObjectForward",
        moveTo: "moveObjectTo"
    }
    Object.keys(stackAliases).forEach(function (legacyName) {
        if (!canvasPrototype[legacyName]) {
            canvasPrototype[legacyName] = function () {
                return this[stackAliases[legacyName]].apply(this, arguments)
            }
        }
    })

    if (!objectPrototype.remove) {
        objectPrototype.remove = function () {
            if (this.canvas) this.canvas.remove(this)
            return this
        }
    }
    Object.keys(stackAliases).forEach(function (legacyName) {
        if (legacyName === "moveTo" || objectPrototype[legacyName]) return
        objectPrototype[legacyName] = function () {
            if (!this.canvas) return false
            return this.canvas[stackAliases[legacyName]].apply(this.canvas, [this].concat(Array.prototype.slice.call(arguments)))
        }
    })

    fabric.util.object = fabric.util.object || {}
    fabric.util.object.extend = fabric.util.object.extend || function (target, source) {
        return Object.assign(target, source)
    }

    const nativeLoadFromJSON = canvasPrototype.loadFromJSON
    canvasPrototype.loadFromJSON = function (json, completionOrReviver, legacyReviver) {
        const isLegacyCall = typeof completionOrReviver === "function" && (arguments.length > 2 || completionOrReviver.length <= 1)
        if (!isLegacyCall) return nativeLoadFromJSON.apply(this, arguments)
        const targetCanvas = this
        return nativeLoadFromJSON.call(this, json, legacyReviver).then(function () {
            completionOrReviver(targetCanvas)
            return targetCanvas
        })
    }

    const nativeClone = objectPrototype.clone
    objectPrototype.clone = function (callbackOrProperties) {
        const promise = nativeClone.call(this, typeof callbackOrProperties === "function" ? undefined : callbackOrProperties)
        if (typeof callbackOrProperties === "function") promise.then(callbackOrProperties)
        return promise
    }

    const nativeImageFromURL = fabric.FabricImage.fromURL
    fabric.FabricImage.fromURL = fabric.Image.fromURL = function (url, callbackOrOptions, legacyOptions) {
        if (typeof callbackOrOptions !== "function") return nativeImageFromURL.apply(this, arguments)
        const promise = nativeImageFromURL.call(this, url, legacyOptions || {})
        promise.then(callbackOrOptions)
        return promise
    }

    const nativeSetSrc = imagePrototype.setSrc
    imagePrototype.setSrc = function (src, callbackOrOptions, legacyOptions) {
        const targetImage = this
        if (typeof callbackOrOptions !== "function") return nativeSetSrc.apply(this, arguments)
        return nativeSetSrc.call(this, src, legacyOptions || {}).then(function () {
            callbackOrOptions(targetImage)
        })
    }

}(window))
