(function (window, document) {
    "use strict"

    const PROPERTY = "cgEffects"
    const EVENT_TYPE = "hover"
    const VERSION = 1
    let modalTarget = null
    let previewFrame = 0
    let modalPreviewAnimation = null

    const presets = {
        lift: { label: "Lift / Float", icon: "fa-arrow-up", defaults: { distance: 12 } },
        tilt: { label: "Tilt", icon: "fa-rotate-left", defaults: { rotation: 7 } },
        scale: { label: "Scale / Zoom", icon: "fa-search-plus", defaults: { scale: 1.08 } },
        fade: { label: "Fade / Opacity", icon: "fa-adjust", defaults: { opacity: 0.55 } },
        glow: { label: "Glow", icon: "fa-sun-o", defaults: { blur: 18, color: "#4f8cff" } },
        shadow: { label: "Shadow", icon: "fa-cloud", defaults: { blur: 18, offsetX: 7, offsetY: 9, color: "#0f172a" } },
        rotate: { label: "Rotate", icon: "fa-repeat", defaults: { rotation: 12 } },
        pulse: { label: "Pulse", icon: "fa-heartbeat", defaults: { scale: 1.08 } },
        bounce: { label: "Bounce", icon: "fa-exchange", defaults: { distance: 14 } },
        skew: { label: "Skew", icon: "fa-sliders", defaults: { skew: 10 } }
    }

    const numericSettings = {
        distance: { label: "Distance", min: 1, max: 50, step: 1, suffix: "px" },
        rotation: { label: "Rotation", min: -45, max: 45, step: 1, suffix: "deg" },
        scale: { label: "Scale", min: 0.5, max: 1.6, step: 0.01, suffix: "x" },
        opacity: { label: "Opacity", min: 0.1, max: 1, step: 0.05, suffix: "" },
        blur: { label: "Blur", min: 0, max: 50, step: 1, suffix: "px" },
        offsetX: { label: "Horizontal offset", min: -30, max: 30, step: 1, suffix: "px" },
        offsetY: { label: "Vertical offset", min: -30, max: 30, step: 1, suffix: "px" },
        skew: { label: "Skew", min: -35, max: 35, step: 1, suffix: "deg" },
        duration: { label: "Duration", min: 100, max: 2000, step: 50, suffix: "ms" }
    }

    function clone(value) {
        return value === null || value === undefined ? value : JSON.parse(JSON.stringify(value))
    }

    function normalize(model) {
        if (!model || !model.events || !model.events[EVENT_TYPE]) return null
        const source = model.events[EVENT_TYPE]
        if (!presets[source.preset]) return null
        return {
            version: VERSION,
            events: {
                [EVENT_TYPE]: {
                    preset: source.preset,
                    settings: { ...presets[source.preset].defaults, duration: 300, ...(source.settings || {}) }
                }
            }
        }
    }

    function getEffect(object) {
        return normalize(object && object[PROPERTY])
    }

    function hasEffect(object) {
        return Boolean(getEffect(object))
    }

    function getTargets(target) {
        return target && String(target.type || "").toLowerCase() === "activeselection" && typeof target.getObjects === "function" ? target.getObjects().slice() : (target ? [target] : [])
    }

    function persist(target, model) {
        const targets = getTargets(target)
        targets.forEach((object) => {
            object.set(PROPERTY, model ? clone(model) : null)
            object.setCoords()
        })
        const canvas = target && target.canvas
        canvas?.requestRenderAll()
        /* STAMP: 2026-10-01 - Persist through the editor history API directly.
         * The legacy object:modified handler requires an active Fabric transform
         * and throws when a modal or Layers action owns the target. */
        window.updateCanvasState?.()
        window.LoadTimeline?.()
        window.dispatchEvent(new CustomEvent("cg:object-effects-changed", { detail: { targets } }))
    }

    function closeModal() {
        const modal = document.getElementById("cgEffectsModal")
        const instance = modal && window.bootstrap ? window.bootstrap.Modal.getInstance(modal) : null
        if (instance) instance.hide()
    }

    function settingMarkup(effect) {
        const values = { ...effect.settings, duration: effect.settings.duration || 300 }
        return Object.keys(values).map((name) => {
            if (name === "color") return `<label class="cg-effects-setting"><span>Colour</span><input type="color" data-cg-effect-setting="color" value="${String(values.color).startsWith("#") ? values.color : "#4f8cff"}"></label>`
            const definition = numericSettings[name]
            if (!definition) return ""
            return `<label class="cg-effects-setting"><span>${definition.label}<output>${values[name]}${definition.suffix}</output></span><input type="range" data-cg-effect-setting="${name}" min="${definition.min}" max="${definition.max}" step="${definition.step}" value="${values[name]}"></label>`
        }).join("")
    }

    function syncModal(model) {
        const selected = model?.events?.[EVENT_TYPE]
        document.querySelectorAll("[data-cg-effect-preset]").forEach((button) => {
            const active = button.dataset.cgEffectPreset === selected?.preset
            button.classList.toggle("is-selected", active)
            button.setAttribute("aria-pressed", String(active))
        })
        const settings = document.getElementById("cgEffectsSettings")
        if (settings) settings.innerHTML = selected ? settingMarkup(selected) : '<p class="cg-effects-empty">Choose a preset to configure it.</p>'
        const remove = document.getElementById("cgRemoveEffect")
        if (remove) remove.hidden = !selected
    }

    function selectedModalModel() {
        const preset = document.querySelector("[data-cg-effect-preset].is-selected")?.dataset.cgEffectPreset
        if (!preset) return null
        const settings = { ...presets[preset].defaults, duration: 300 }
        document.querySelectorAll("[data-cg-effect-setting]").forEach((input) => {
            settings[input.dataset.cgEffectSetting] = input.type === "color" ? input.value : Number(input.value)
        })
        return { version: VERSION, events: { [EVENT_TYPE]: { preset, settings } } }
    }

    function getDomKeyframes(effect) {
        const settings = effect.settings || {}
        const distance = Number(settings.distance) || 12
        const rotation = Number(settings.rotation) || 8
        const scale = Number(settings.scale) || 1.08
        const skew = Number(settings.skew) || 10
        if (effect.preset === "lift") return [{ transform: "translateY(0)" }, { transform: `translateY(-${distance}px)` }]
        if (effect.preset === "tilt" || effect.preset === "rotate") return [{ transform: "rotate(0deg)" }, { transform: `rotate(${rotation}deg)` }]
        if (effect.preset === "scale") return [{ transform: "scale(1)" }, { transform: `scale(${scale})` }]
        if (effect.preset === "fade") return [{ opacity: 1 }, { opacity: Number(settings.opacity) || 0.55 }]
        if (effect.preset === "glow") return [{ filter: "drop-shadow(0 0 0 transparent)" }, { filter: `drop-shadow(0 0 ${Number(settings.blur) || 18}px ${settings.color || "#4f8cff"})` }]
        if (effect.preset === "shadow") return [{ filter: "drop-shadow(0 0 0 transparent)" }, { filter: `drop-shadow(${Number(settings.offsetX) || 7}px ${Number(settings.offsetY) || 9}px ${Number(settings.blur) || 18}px ${settings.color || "#0f172a"})` }]
        if (effect.preset === "pulse") return [{ transform: "scale(1)" }, { transform: `scale(${scale})` }, { transform: "scale(1)" }]
        if (effect.preset === "bounce") return [{ transform: "translateY(0)" }, { transform: `translateY(-${distance}px)` }, { transform: "translateY(0)" }]
        if (effect.preset === "skew") return [{ transform: "skewX(0deg)" }, { transform: `skewX(${skew}deg)` }]
        return []
    }

    function playModalPreview() {
        const image = document.getElementById("cgEffectsPreviewImage")
        const model = selectedModalModel()
        if (!image || !model || typeof image.animate !== "function") return
        if (modalPreviewAnimation) modalPreviewAnimation.cancel()
        const effect = model.events[EVENT_TYPE]
        modalPreviewAnimation = image.animate(getDomKeyframes(effect), {
            duration: Math.max(100, Number(effect.settings.duration) || 300),
            easing: "cubic-bezier(.22,.61,.36,1)",
            fill: "both",
            iterations: effect.preset === "pulse" || effect.preset === "bounce" ? 2 : 1,
            direction: "alternate"
        })
    }

    function syncModalPreview(target) {
        const object = getTargets(target)[0]
        const image = document.getElementById("cgEffectsPreviewImage")
        const name = document.getElementById("cgEffectsPreviewName")
        if (!object || !image) return
        try {
            image.src = object.toDataURL({ format: "png", multiplier: 1, enableRetinaScaling: false })
        } catch (error) {
            image.removeAttribute("src")
        }
        if (name) name.textContent = object.name || object.text || "Selected object"
        window.requestAnimationFrame(playModalPreview)
    }

    function openModal(target) {
        if (!target) return false
        modalTarget = target
        syncModal(getEffect(getTargets(target)[0]))
        syncModalPreview(target)
        const element = document.getElementById("cgEffectsModal")
        if (!element || !window.bootstrap) return false
        window.bootstrap.Modal.getOrCreateInstance(element).show()
        return true
    }

    function initializeModal() {
        const modal = document.getElementById("cgEffectsModal")
        if (!modal || modal.dataset.cgEffectsBound) return
        modal.dataset.cgEffectsBound = "true"
        const grid = document.getElementById("cgEffectsPresetGrid")
        grid.innerHTML = Object.entries(presets).map(([id, preset]) => `<button type="button" class="cg-effect-preset cg-effect-preset--${id}" data-cg-effect-preset="${id}" aria-pressed="false"><span class="cg-effect-preset__preview"><i class="fa ${preset.icon}" aria-hidden="true"></i></span><strong>${preset.label}</strong></button>`).join("")
        modal.addEventListener("click", (event) => {
            const presetButton = event.target.closest("[data-cg-effect-preset]")
            if (presetButton) {
                const id = presetButton.dataset.cgEffectPreset
                syncModal({ version: VERSION, events: { [EVENT_TYPE]: { preset: id, settings: { ...presets[id].defaults, duration: 300 } } } })
                playModalPreview()
            } else if (event.target.closest("#cgApplyEffect")) {
                const model = selectedModalModel()
                if (!model) {
                    window.CGEditorFeedback?.warning("Choose an effect", "Select a Hover preset before applying.")
                    return
                }
                const preset = presets[model.events.hover.preset]
                persist(modalTarget, model)
                closeModal()
                window.CGEditorFeedback?.success(preset.label, "Saved successfully. This effect will play in preview and published output.")
            } else if (event.target.closest("#cgRemoveEffect")) {
                persist(modalTarget, null)
                syncModal(null)
                closeModal()
                window.CGEditorFeedback?.removed("Hover effect removed", "The saved output effect was cleared.")
            }
        })
        modal.addEventListener("input", (event) => {
            const input = event.target.closest("[data-cg-effect-setting]")
            if (!input) return
            const output = input.closest("label")?.querySelector("output")
            const definition = numericSettings[input.dataset.cgEffectSetting]
            if (output) output.textContent = `${input.value}${definition?.suffix || ""}`
            window.cancelAnimationFrame(previewFrame)
            previewFrame = window.requestAnimationFrame(playModalPreview)
        })
        document.getElementById("cgEffectsPreview")?.addEventListener("pointerenter", playModalPreview)
    }

    function registerSerialization() {
        if (!window.fabric) return;
        [window.fabric.Object, window.fabric.FabricObject].filter(Boolean).forEach((constructor) => {
            constructor.customProperties = Array.from(new Set([...(constructor.customProperties || []), PROPERTY]))
        })
    }

    function initialize() {
        registerSerialization()
        initializeModal()
    }

    window.CGObjectEffects = {
        property: PROPERTY,
        presets,
        normalize,
        getEffect,
        hasEffect,
        open: openModal,
        remove(target) { persist(target, null) }
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true })
    else initialize()
}(window, document))
