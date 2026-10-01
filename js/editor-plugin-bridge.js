/**
 * STAMP: 2026-09-16 - Compatibility boundary for existing third-party widgets.
 * The native Fabric controller never reads the jQuery global. These widgets
 * retain their established DOM, callbacks, and values through this allowlist.
 * Remove this bridge only after replacing and visually validating each widget.
 */
(function installEditorPluginBridge() {
    const allowed = new Set(['summernote', 'minicolors', 'sortable'])
    window.CGEditorPluginBridge = Object.freeze({
        supports(name) {
            return allowed.has(name) && typeof window.jQuery?.fn?.[name] === 'function'
        },
        invoke(name, nodes, args, wrap) {
            if (!this.supports(name)) throw new Error(`Unsupported editor widget: ${name}`)
            const selection = window.jQuery(nodes)
            const forwarded = args.map(argument => {
                if (name !== 'sortable' || !argument || typeof argument !== 'object') return argument
                const options = { ...argument }
                for (const key of ['start', 'stop', 'update', 'change']) {
                    if (typeof options[key] !== 'function') continue
                    const callback = options[key]
                    options[key] = function forwardSortableEvent(event, ui) {
                        const nativeUi = { ...ui }
                        for (const field of ['item', 'placeholder', 'helper']) {
                            if (ui[field]) nativeUi[field] = wrap(ui[field].toArray())
                        }
                        return callback.call(this, event, nativeUi)
                    }
                }
                return options
            })
            const value = selection[name](...forwarded)
            return { selection: value === selection, value }
        }
    })
})()
