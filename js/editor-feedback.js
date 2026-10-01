(function (window, document) {
    "use strict"

    const recent = new Map()

    function escapeHtml(value) {
        const node = document.createElement("span")
        node.textContent = value
        return node.innerHTML
    }

    function ensureRegion() {
        let region = document.getElementById("cgEditorToastRegion")
        if (region) return region
        region = document.createElement("div")
        region.id = "cgEditorToastRegion"
        region.className = "cg-effects-toast-region"
        region.setAttribute("aria-live", "polite")
        region.setAttribute("aria-atomic", "false")
        document.body.appendChild(region)
        return region
    }

    function show(options) {
        const type = ["success", "error", "warning", "info", "removed"].includes(options?.type) ? options.type : "info"
        const title = String(options?.title || "Editor update")
        const message = String(options?.message || "The action completed.")
        const key = `${type}:${title}:${message}`
        const existing = recent.get(key)
        if (existing && existing.toast.isConnected && Date.now() - existing.time < 900) {
            existing.count += 1
            existing.time = Date.now()
            existing.toast.querySelector("[data-cg-toast-count]").textContent = `x${existing.count}`
            existing.toast.querySelector("[data-cg-toast-count]").hidden = false
            return existing.toast
        }
        const region = ensureRegion()
        const toast = document.createElement("section")
        const icons = { success: "fa-check", error: "fa-exclamation-triangle", warning: "fa-exclamation", info: "fa-info", removed: "fa-trash" }
        const labels = { success: "Completed", error: "Action failed", warning: "Attention", info: "Editor update", removed: "Removed" }
        toast.className = `cg-effects-toast is-${type}`
        toast.setAttribute("role", type === "error" ? "alert" : "status")
        toast.innerHTML = `<span class="cg-effects-toast__icon"><i class="fa ${icons[type]}" aria-hidden="true"></i></span><span class="cg-effects-toast__copy"><small>${labels[type]}</small><strong>${escapeHtml(title)} <em data-cg-toast-count hidden></em></strong><span>${escapeHtml(message)}</span></span><button type="button" class="cg-effects-toast__close" aria-label="Dismiss notification"><i class="fa fa-times" aria-hidden="true"></i></button><span class="cg-effects-toast__progress" aria-hidden="true"></span>`
        region.appendChild(toast)
        const record = { toast, count: 1, time: Date.now() }
        recent.set(key, record)
        const remove = () => {
            if (!toast.isConnected || toast.classList.contains("is-leaving")) return
            toast.classList.add("is-leaving")
            window.setTimeout(() => {
                toast.remove()
                if (recent.get(key) === record) recent.delete(key)
            }, 220)
        }
        toast.querySelector("button").addEventListener("click", remove)
        window.setTimeout(remove, type === "error" ? 6200 : 4200)
        return toast
    }

    window.CGEditorFeedback = {
        show,
        success(title, message) { return show({ type: "success", title, message }) },
        error(title, message) { return show({ type: "error", title, message }) },
        warning(title, message) { return show({ type: "warning", title, message }) },
        info(title, message) { return show({ type: "info", title, message }) },
        removed(title, message) { return show({ type: "removed", title, message }) }
    }
}(window, document))
