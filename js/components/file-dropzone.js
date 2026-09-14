/**
 * Canvas file drop zones — STAMP: 2026-09-09.
 * Progressively enhances visible native file inputs without replacing them, so
 * every legacy change/upload handler receives the same FileList as before.
 */
(function (window, document) {
    "use strict"

    const INPUT_SELECTOR = 'input[type="file"]:not([data-cg-file-dropzone])'

    function acceptedTypes(input) {
        const types = String(input.accept || "").split(",").map(function (type) {
            return type.trim()
        }).filter(Boolean)
        if (!types.length) return "Any supported file"
        return types.filter(function (type) { return type.charAt(0) === "." }).map(function (type) {
            return type.slice(1).toUpperCase()
        }).filter(function (type, index, values) { return values.indexOf(type) === index }).join(", ") || "Supported files"
    }

    function acceptsFile(input, file) {
        const rules = String(input.accept || "").toLowerCase().split(",").map(function (rule) { return rule.trim() }).filter(Boolean)
        if (!rules.length) return true
        return rules.some(function (rule) {
            if (rule.charAt(0) === ".") return file.name.toLowerCase().endsWith(rule)
            if (rule.endsWith("/*")) return file.type.toLowerCase().indexOf(rule.slice(0, -1)) === 0
            return file.type.toLowerCase() === rule
        })
    }

    function assignFiles(input, files) {
        let accepted = Array.from(files).filter(function (file) { return acceptsFile(input, file) })
        if (!input.multiple) accepted = accepted.slice(0, 1)
        if (!accepted.length) return false
        try {
            const transfer = new window.DataTransfer()
            accepted.forEach(function (file) { transfer.items.add(file) })
            input.files = transfer.files
        } catch (_) {
            if (accepted.length !== files.length) return false
            input.files = files
        }
        input.dispatchEvent(new window.Event("change", { bubbles: true }))
        return true
    }

    function enhance(input) {
        if (!input || input.hasAttribute("data-cg-hidden") || input.hidden || input.closest(".cg-intelligent-modal__media")) return
        input.setAttribute("data-cg-file-dropzone", "true")
        input.classList.add("cg-file-dropzone__input")

        const zone = document.createElement("div")
        const icon = document.createElement("span")
        const copy = document.createElement("span")
        const label = document.createElement("strong")
        const hint = document.createElement("small")
        const fileName = document.createElement("span")
        let dragDepth = 0

        zone.className = "cg-file-dropzone"
        zone.tabIndex = 0
        zone.setAttribute("role", "button")
        zone.setAttribute("aria-label", input.multiple ? "Choose files or drop files here" : "Choose a file or drop a file here")
        if (input.id) zone.setAttribute("aria-controls", input.id)
        icon.className = "cg-file-dropzone__icon"
        icon.setAttribute("aria-hidden", "true")
        icon.innerHTML = '<i class="fa fa-cloud-upload"></i>'
        copy.className = "cg-file-dropzone__copy"
        label.textContent = input.getAttribute("data-cg-drop-label") || (input.multiple ? "Drop files here or browse" : "Drop file here or browse")
        hint.textContent = input.getAttribute("data-cg-drop-hint") || acceptedTypes(input)
        fileName.className = "cg-file-dropzone__name"
        fileName.textContent = input.multiple ? "No files selected" : "No file selected"
        copy.append(label, hint, fileName)
        zone.append(icon, copy)
        input.insertAdjacentElement("afterend", zone)

        const legacyHost = input.closest(".upload-btn-wrapper")
        if (legacyHost) {
            legacyHost.classList.add("cg-file-dropzone-host")
            Array.from(legacyHost.children).forEach(function (child) {
                if (child !== input && child !== zone && child.matches("a, button")) child.classList.add("cg-file-dropzone__legacy-trigger")
            })
        }

        function updateSelection() {
            const files = input.files ? Array.from(input.files) : []
            zone.classList.toggle("is-selected", files.length > 0)
            zone.classList.remove("is-error")
            fileName.textContent = files.length > 1 ? `${files.length  } files selected` : (files[0] ? files[0].name : (input.multiple ? "No files selected" : "No file selected"))
        }

        function openPicker() {
            if (!input.disabled) input.click()
        }

        zone.addEventListener("click", openPicker)
        zone.addEventListener("keydown", function (event) {
            if (event.key !== "Enter" && event.key !== " ") return
            event.preventDefault()
            openPicker()
        })
        zone.addEventListener("dragenter", function (event) {
            event.preventDefault()
            dragDepth += 1
            zone.classList.add("is-dragging")
        })
        zone.addEventListener("dragover", function (event) {
            event.preventDefault()
            if (event.dataTransfer) event.dataTransfer.dropEffect = "copy"
        })
        zone.addEventListener("dragleave", function (event) {
            event.preventDefault()
            dragDepth = Math.max(0, dragDepth - 1)
            if (!dragDepth) zone.classList.remove("is-dragging")
        })
        zone.addEventListener("drop", function (event) {
            event.preventDefault()
            dragDepth = 0
            zone.classList.remove("is-dragging")
            if (!event.dataTransfer || !event.dataTransfer.files.length) return
            if (!assignFiles(input, event.dataTransfer.files)) {
                zone.classList.add("is-error")
                fileName.textContent = `Choose ${  acceptedTypes(input)  } files`
            }
        })
        input.addEventListener("change", updateSelection)
        updateSelection()
    }

    function scan(root) {
        if (root.matches && root.matches(INPUT_SELECTOR)) enhance(root)
        if (root.querySelectorAll) root.querySelectorAll(INPUT_SELECTOR).forEach(enhance)
    }

    function initialise() {
        scan(document)
        new window.MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                mutation.addedNodes.forEach(function (node) {
                    if (node.nodeType === 1) scan(node)
                })
            })
        }).observe(document.body, { childList: true, subtree: true })
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialise)
    else initialise()
}(window, document))
