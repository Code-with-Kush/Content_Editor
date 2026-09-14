(function () {
    /** STAMP: 2026-08-20 - Keep the compact inspector tabs and timeline in sync with legacy inputs. */
    function setupMotionInspector() {
        const inspector = document.querySelector(".cg-motion-inspector");
        if (!inspector) return;

        const tabs = Array.from(inspector.querySelectorAll("[data-cg-motion-tab]"));
        const panels = Array.from(inspector.querySelectorAll("[data-cg-motion-panel]"));
        const startInput = document.getElementById("load_delay_span");
        const durationInput = document.getElementById("load_dur_span");
        const clip = document.getElementById("cgMotionTimelineClip");
        const summary = document.getElementById("cgMotionSummary");

        function selectTab(name) {
            tabs.forEach((tab) => {
                const active = tab.dataset.cgMotionTab === name;
                tab.classList.toggle("is-active", active);
                tab.setAttribute("aria-selected", String(active));
            });
            panels.forEach((panel) => { panel.hidden = panel.dataset.cgMotionPanel !== name; });
        }

        function updateTimeline() {
            const start = Math.max(0, Number(startInput && startInput.value) || 0);
            const duration = Math.max(0.5, Number(durationInput && durationInput.value) || 0.5);
            if (clip) {
                clip.style.left = `${Math.min(100, start / 30 * 100)}%`;
                clip.style.width = `${Math.min(100 - Math.min(100, start / 30 * 100), duration / 30 * 100)}%`;
            }
            if (summary) summary.textContent = `Starts at ${start}s · Runs for ${duration}s`;
        }

        tabs.forEach((tab) => tab.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            selectTab(tab.dataset.cgMotionTab);
        }));
        [startInput, durationInput, document.getElementById("load_delay"), document.getElementById("dur_delay")]
            .filter(Boolean)
            .forEach((input) => input.addEventListener("input", window.requestAnimationFrame.bind(window, updateTimeline)));

        updateTimeline();
    }

    document.addEventListener("DOMContentLoaded", setupMotionInspector);
    const panelTitles = {
        ShapeSettingsarea: "Shape properties",
        TextSettingsarea: "Font properties",
        ImageSettingsarea: "Image properties",
        GroupSettingsarea: "Group properties",
        ObjectAutomationSettings: "Interactions"
    };

    function getToolbarTitle(section) {
        const ids = Array.from(section.querySelectorAll("[id]")).map((element) => element.id);

        if (ids.includes("undo") || ids.includes("redo") || ids.includes("clear")) {
            return "Edit";
        }

        if (ids.includes("canvasback")) {
            return "Canvas";
        }

        if (ids.includes("image") || ids.includes("AddImage") || ids.includes("rect") || ids.includes("addh1")) {
            return "Insert";
        }

        if (ids.includes("divAudioPlayer") || ids.includes("divVideoLink")) {
            return "Media";
        }

        if (ids.includes("fliphorz") || ids.includes("opacityrange") || ids.includes("shdhrange")) {
            return "Arrange";
        }

        if (ids.includes("refresh") || ids.includes("btnpreview") || ids.includes("btndownload")) {
            return "Slides";
        }

        return "Tools";
    }

    function createElement(tagName, className, textContent) {
        const element = document.createElement(tagName);

        if (className) {
            element.className = className;
        }

        if (typeof textContent === "string") {
            element.textContent = textContent;
        }

        return element;
    }

    /* STAMP: 2026-09-13 - Treat the existing five Fabric transform locks as
       the editor's complete lock contract. A locked child also protects group
       and multi-selection size/position actions from changing it indirectly. */
    function isCanvasObjectLocked(object) {
        if (!object) return false;
        if (typeof window.CGIsCanvasObjectLocked === "function") {
            return window.CGIsCanvasObjectLocked(object);
        }
        if (object.lockMovementX && object.lockMovementY && object.lockScalingX
            && object.lockScalingY && object.lockRotation) return true;
        return Boolean(object._objects && object._objects.some(isCanvasObjectLocked));
    }

    function clampDropdownPosition(left, top, menu) {
        const margin = 8;
        const width = menu.offsetWidth || 240;
        const height = menu.offsetHeight || 160;
        const maxLeft = Math.max(margin, window.innerWidth - width - margin);
        const maxTop = Math.max(margin, window.innerHeight - height - margin);

        return {
            left: Math.min(Math.max(margin, left), maxLeft),
            top: Math.min(Math.max(margin, top), maxTop)
        };
    }

    function clampDropdownWidth(width) {
        const margin = 8;
        const maxWidth = Math.max(180, window.innerWidth - margin * 2);

        return Math.min(Math.max(180, width), maxWidth);
    }

    function ensureDropdownResizeHandles(menu) {
        if (!(menu instanceof HTMLElement) || menu.querySelector(":scope > .cg-dropdown-resize-handle")) {
            return;
        }

        ["left", "right"].forEach((side) => {
            const handle = createElement("span", `cg-dropdown-resize-handle cg-dropdown-resize-handle--${side}`);
            handle.setAttribute("aria-hidden", "true");
            handle.dataset.cgNoDrag = "true";
            handle.dataset.cgResizeSide = side;
            menu.insertBefore(handle, menu.firstChild);
        });
    }

    function makeDropdownFloating(menu) {
        if (!(menu instanceof HTMLElement) || menu.dataset.cgDropdownFloating === "true") {
            return;
        }

        ensureDropdownCloseButton(menu);
        ensureDropdownResizeHandles(menu);

        const rect = menu.getBoundingClientRect();
        const nextPosition = clampDropdownPosition(rect.left, rect.top, menu);

        menu.dataset.cgDropdownFloating = "true";
        menu.classList.add("cg-draggable-dropdown-menu");
        menu.style.position = "fixed";
        menu.style.inset = "auto";
        menu.style.left = `${nextPosition.left}px`;
        menu.style.top = `${nextPosition.top}px`;
        menu.style.right = "auto";
        menu.style.bottom = "auto";
        menu.style.margin = "0";
        menu.style.transform = "none";
        menu.style.zIndex = "110080";
    }

    function resetFloatingDropdown(menu) {
        if (!(menu instanceof HTMLElement)) {
            return;
        }

        delete menu.dataset.cgDropdownFloating;
        menu.classList.remove(
            "cg-draggable-dropdown-menu",
            "cg-draggable-dropdown-menu--dragging",
            "cg-draggable-dropdown-menu--resizing"
        );
        menu.style.position = "";
        menu.style.inset = "";
        menu.style.left = "";
        menu.style.top = "";
        menu.style.right = "";
        menu.style.bottom = "";
        menu.style.margin = "";
        menu.style.transform = "";
        menu.style.zIndex = "";
        menu.style.width = "";
        menu.style.minWidth = "";
        menu.style.maxWidth = "";
        menu.removeAttribute("data-cg-dragged");
    }

    function closeDropdownMenu(menu) {
        if (!(menu instanceof HTMLElement)) {
            return;
        }

        const dropdown = menu.closest(".dropdown");
        const toggle = dropdown ? dropdown.querySelector('[data-bs-toggle="dropdown"]') : null;

        if (toggle && window.bootstrap && window.bootstrap.Dropdown) {
            window.bootstrap.Dropdown.getOrCreateInstance(toggle).hide();
            return;
        }

        menu.classList.remove("show");
        resetFloatingDropdown(menu);

        if (toggle instanceof HTMLElement) {
            toggle.setAttribute("aria-expanded", "false");
        }
    }

    function ensureDropdownCloseButton(menu) {
        if (!(menu instanceof HTMLElement)) {
            return;
        }

        /* STAMP: 2026-08-27 - Top canvas-menu dropdowns close from their
           owning toolbar toggle; do not inject a redundant X into them. */
        if (menu.closest(".cg-floating-canvas-toolbar")) {
            const existingClose = menu.querySelector(":scope > .cg-dropdown-close");
            if (existingClose) existingClose.remove();
            return;
        }

        if (menu.querySelector(":scope > .cg-dropdown-close")) return;

        const closeButton = createElement("button", "cg-dropdown-close", "x");
        closeButton.type = "button";
        closeButton.setAttribute("aria-label", "Close dropdown menu");
        closeButton.setAttribute("title", "Close");
        closeButton.dataset.cgNoDrag = "true";
        closeButton.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            closeDropdownMenu(menu);
        });

        menu.insertBefore(closeButton, menu.firstChild);
    }

    function isDropdownDragBlocked(target) {
        return Boolean(target.closest(
            "a, button, input, select, textarea, label, audio, video, canvas, iframe, .form-check, .minicolors, .cg-dropdown-resize-handle, [data-cg-no-drag]"
        ));
    }

    function enableDraggableDropdownMenus(root) {
        let dragState = null;
        let resizeState = null;

        root.querySelectorAll('[data-bs-toggle="dropdown"]').forEach((toggle) => {
            toggle.setAttribute("data-bs-auto-close", "false");
        });

        root.querySelectorAll(".dropdown-menu").forEach((menu) => {
            ensureDropdownCloseButton(menu);
            ensureDropdownResizeHandles(menu);
        });

        /* Draggable persistent dropdown menus stamped 2026-05-08:
           Bootstrap/Popper owns initial placement; once a menu is open, convert it
           to fixed positioning so the author can drag the menu around the editor.
           Menus stay open on outside clicks and resize from either edge. Top
           toolbar menus close from their owning toggle; other menus retain
           their explicit close control. */
        root.addEventListener("shown.bs.dropdown", (event) => {
            const dropdown = event.target instanceof HTMLElement ? event.target : null;
            const menu = dropdown ? dropdown.querySelector(":scope > .dropdown-menu") : null;

            closeOtherDropdownMenus(dropdown);
            ensureDropdownCloseButton(menu);
            ensureDropdownResizeHandles(menu);
            makeDropdownFloating(menu);
        });

        root.addEventListener("hide.bs.dropdown", (event) => {
            const dropdown = event.target instanceof HTMLElement ? event.target : null;
            const menu = dropdown ? dropdown.querySelector(":scope > .dropdown-menu") : null;
            const clickTarget = event.clickEvent && event.clickEvent.target instanceof Element ? event.clickEvent.target : null;

            if (clickTarget && !clickTarget.closest(".cg-dropdown-close") && !clickTarget.closest('[data-bs-toggle="dropdown"]')) {
                event.preventDefault();
                return;
            }

            if (menu && menu.dataset.cgDragged !== "true") {
                resetFloatingDropdown(menu);
            }
        });

        root.addEventListener("hidden.bs.dropdown", (event) => {
            const dropdown = event.target instanceof HTMLElement ? event.target : null;
            const menu = dropdown ? dropdown.querySelector(":scope > .dropdown-menu") : null;

            resetFloatingDropdown(menu);
        });

        root.addEventListener("mousedown", (event) => {
            if (event.button !== 0) {
                return;
            }

            const resizeHandle = event.target instanceof Element ? event.target.closest(".cg-dropdown-resize-handle") : null;

            if (resizeHandle instanceof HTMLElement) {
                const menu = resizeHandle.closest(".dropdown-menu");

                if (!(menu instanceof HTMLElement)) {
                    return;
                }

                makeDropdownFloating(menu);

                const rect = menu.getBoundingClientRect();
                resizeState = {
                    menu,
                    side: resizeHandle.dataset.cgResizeSide === "left" ? "left" : "right",
                    startX: event.clientX,
                    startLeft: rect.left,
                    startWidth: rect.width
                };

                menu.dataset.cgDragged = "true";
                menu.classList.add("cg-draggable-dropdown-menu--resizing");
                document.body.classList.add("cg-dropdown-resizing");
                event.preventDefault();
                event.stopPropagation();
                return;
            }

            const menu = event.target instanceof Element ? event.target.closest(".dropdown-menu") : null;

            if (!(menu instanceof HTMLElement) || isDropdownDragBlocked(event.target)) {
                return;
            }

            makeDropdownFloating(menu);

            const rect = menu.getBoundingClientRect();
            dragState = {
                menu,
                offsetX: event.clientX - rect.left,
                offsetY: event.clientY - rect.top
            };

            menu.dataset.cgDragged = "true";
            menu.classList.add("cg-draggable-dropdown-menu--dragging");
            document.body.classList.add("cg-dropdown-dragging");
            event.preventDefault();
            event.stopPropagation();
        });

        root.addEventListener("mousemove", (event) => {
            if (resizeState) {
                const margin = 8;
                const deltaX = event.clientX - resizeState.startX;
                const viewportMaxWidth = window.innerWidth - margin * 2;
                let nextWidth = resizeState.side === "left"
                    ? resizeState.startWidth - deltaX
                    : resizeState.startWidth + deltaX;
                let nextLeft = resizeState.startLeft;

                nextWidth = clampDropdownWidth(Math.min(nextWidth, viewportMaxWidth));

                if (resizeState.side === "left") {
                    nextLeft = resizeState.startLeft + resizeState.startWidth - nextWidth;
                    nextLeft = Math.min(Math.max(margin, nextLeft), window.innerWidth - nextWidth - margin);
                } else {
                    nextLeft = Math.min(
                        Math.max(margin, resizeState.startLeft),
                        window.innerWidth - nextWidth - margin
                    );
                }

                resizeState.menu.style.left = `${nextLeft}px`;
                resizeState.menu.style.width = `${nextWidth}px`;
                resizeState.menu.style.minWidth = `${nextWidth}px`;
                resizeState.menu.style.maxWidth = `${nextWidth}px`;
                event.preventDefault();
                return;
            }

            if (!dragState) {
                return;
            }

            const nextPosition = clampDropdownPosition(
                event.clientX - dragState.offsetX,
                event.clientY - dragState.offsetY,
                dragState.menu
            );

            dragState.menu.style.left = `${nextPosition.left}px`;
            dragState.menu.style.top = `${nextPosition.top}px`;
            event.preventDefault();
        });

        root.addEventListener("mouseup", () => {
            if (resizeState) {
                resizeState.menu.classList.remove("cg-draggable-dropdown-menu--resizing");
                document.body.classList.remove("cg-dropdown-resizing");
                resizeState = null;
                return;
            }

            if (!dragState) {
                return;
            }

            dragState.menu.classList.remove("cg-draggable-dropdown-menu--dragging");
            document.body.classList.remove("cg-dropdown-dragging");
            dragState = null;
        });
    }

    function closeOpenDropdownMenus() {
        document.querySelectorAll(".dropdown-menu.show").forEach((menu) => {
            closeDropdownMenu(menu);
        });
    }

    function closeOtherDropdownMenus(activeDropdown) {
        document.querySelectorAll(".dropdown-menu.show").forEach((menu) => {
            const dropdown = menu.closest(".dropdown");

            if (!(dropdown instanceof HTMLElement) || dropdown === activeDropdown) {
                return;
            }

            if (activeDropdown instanceof HTMLElement && (activeDropdown.contains(dropdown) || dropdown.contains(activeDropdown))) {
                return;
            }

            closeDropdownMenu(menu);
        });
    }

    function enableCanvasDropdownClose(canvasContainer) {
        if (!(canvasContainer instanceof HTMLElement)) {
            return;
        }

        /* Canvas close behavior stamped 2026-05-08:
           dropdowns stay persistent while editing controls, but returning to
           the Fabric canvas should clear the toolbar surface. */
        canvasContainer.addEventListener("mousedown", (event) => {
            const target = event.target instanceof Element ? event.target : null;

            if (!target || target.closest(".dropdown-menu, .dropdown, #divcanvaszio, #myObjnav")) {
                return;
            }

            if (target.closest(".canvas-container, .upper-canvas, .lower-canvas, canvas, .cg-canvas-stage")) {
                closeOpenDropdownMenus();
            }
        });
    }

    function decorateToolbar(toolbar) {
        Array.from(toolbar.children).forEach((section) => {
            if (!(section instanceof HTMLElement)) {
                return;
            }

            section.classList.add("cg-toolbar-cluster");
            section.dataset.cgTitle = getToolbarTitle(section);

            if (section.classList.contains("ms-auto")) {
                section.classList.add("cg-toolbar-actions");
            }
        });
    }

    /* STAMP: 2026-09-10 - A global canvas-tool choice ends the current object
     * context before the chosen control runs. This keeps the selection toolbar
     * from overlapping insertion panels without changing any toolbar handler. */
    function setupToolbarSelectionDismissal(toolbar) {
        if (toolbar.dataset.cgSelectionDismissal === "true") return;
        toolbar.dataset.cgSelectionDismissal = "true";

        toolbar.addEventListener("pointerdown", (event) => {
            if (event.button !== undefined && event.button !== 0) return;

            const target = event.target instanceof Element ? event.target : null;
            const control = target?.closest("button, a, input, select, [role='button'], [role='menuitem']");
            if (!control || !toolbar.contains(control) || control.matches(":disabled, [aria-disabled='true']")) return;
            if (typeof canvas === "undefined" || !canvas?.getActiveObject?.()) return;

            canvas.discardActiveObject();
            canvas.requestRenderAll?.();
        }, true);
    }

    /* STAMP: 2026-08-24 - Rehouse the existing canvas controls in a single
       Figma-inspired floating island. Moving (rather than cloning) the live
       nodes preserves every legacy ID, upload input, dropdown, and handler. */
    function setupFloatingCanvasToolbar(toolbar) {
        if (toolbar.querySelector(".cg-floating-canvas-toolbar")) {
            return;
        }

        const floatingToolbar = createElement("div", "cg-floating-canvas-toolbar");
        const selectButton = createElement("button", "cg-floating-canvas-toolbar__select is-active-tool");
        const navigateButton = createElement("button", "cg-floating-canvas-toolbar__navigate");
        const canvasSections = Array.from(toolbar.children);

        floatingToolbar.setAttribute("role", "toolbar");
        floatingToolbar.setAttribute("aria-label", "Canvas tools");

        selectButton.type = "button";
        selectButton.title = "Select tool";
        selectButton.setAttribute("aria-label", "Select tool");
        selectButton.setAttribute("aria-pressed", "true");
        selectButton.innerHTML = '<i class="fa fa-mouse-pointer" aria-hidden="true"></i>';
        floatingToolbar.appendChild(selectButton);

        /* STAMP: 2026-08-27 - The compact hand control drives the original
           #scrollCanvas state, preserving Fabric pan behavior without the
           separate Navigate Canvas switch below the stage. */
        navigateButton.type = "button";
        navigateButton.title = "Navigate canvas";
        navigateButton.setAttribute("aria-label", "Navigate canvas");
        navigateButton.setAttribute("aria-pressed", "false");
        navigateButton.innerHTML = '<i class="fa fa-hand-o-up" aria-hidden="true"></i>';
        floatingToolbar.appendChild(navigateButton);

        canvasSections.forEach((section, sectionIndex) => {
            const controls = Array.from(section.children);

            if (sectionIndex > 0 && controls.length > 0) {
                const divider = createElement("span", "cg-floating-canvas-toolbar__divider");
                divider.setAttribute("aria-hidden", "true");
                floatingToolbar.appendChild(divider);
            }

            controls.forEach((control) => {
                if (section.id === "divGeneralProperties") {
                    control.classList.add("cg-requires-canvas-object");
                }
                floatingToolbar.appendChild(control);
            });
            section.remove();
        });
        toolbar.appendChild(floatingToolbar);

        /* STAMP: 2026-08-24 - Replace mixed legacy Font Awesome glyphs with
           one sharp outline icon language while retaining the original live
           controls and click targets. */
        const iconPaths = {
            "fa-reply": '<path d="M9 7 4 12l5 5"/><path d="M4 12h9a6 6 0 0 1 6 6"/>',
            "fa-share": '<path d="m15 7 5 5-5 5"/><path d="M20 12h-9a6 6 0 0 0-6 6"/>',
            "fa-calendar-o": '<path d="M4 7h16v13H4z"/><path d="M8 4v6M16 4v6M4 11h16"/>',
            "fa-picture-o": '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 15-5-5L5 20"/>',
            "fa-circle-thin": '<circle cx="12" cy="12" r="8"/>',
            "fa-square-o": '<rect x="4" y="4" width="16" height="16" rx="1.5"/>',
            "fa-circle-o": '<circle cx="12" cy="12" r="8"/>',
            "fa-play": '<path d="m8 5 11 7-11 7z"/>',
            "fa-minus": '<path d="M5 12h14"/>',
            "fa-star-o": '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
            "fa-font": '<path d="M5 20 11 4h2l6 16M7 15h10"/>',
            "fa-text-width": '<path d="M5 5h14M12 5v14M8 19h8"/>',
            "fa-cubes": '<path d="m12 3 4 2.3v4.6L12 12 8 9.9V5.3zM7 12l4 2.3v4.6L7 21l-4-2.1v-4.6zM17 12l4 2.3v4.6L17 21l-4-2.1v-4.6z"/>',
            "fa-sitemap": '<circle cx="12" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/><path d="M12 7v5M6 17v-5h12v5"/>',
            "fa-smile-o": '<circle cx="12" cy="12" r="9"/><path d="M8 10h.01M16 10h.01M8 15c1 1.5 2.3 2 4 2s3-.5 4-2"/>',
            "fa-volume-off": '<path d="M5 10v4h4l5 4V6L9 10zM18 9l4 6M22 9l-4 6"/>',
            "fa-volume-up": '<path d="M5 10v4h4l5 4V6L9 10zM17 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/>',
            "fa-video-camera": '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/>',
            "fa-link": '<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.2M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.2"/>',
            "fa-magic": '<path d="m4 20 11-11M14 4l1 3 3 1-3 1-1 3-1-3-3-1 3-1zM19 14l.7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7z"/>',
            "fa-arrows-alt": '<path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5M3 8l6-6M21 8l-6-6M3 16l6 6M21 16l-6 6"/>',
            "fa-adjust": '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M12 3a9 9 0 0 1 0 18z"/>',
            "fa-clone": '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
            "fa-object-group": '<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5"/>',
            "fa-object-ungroup": '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/><path d="M14 3h4a3 3 0 0 1 3 3v4M10 21H6a3 3 0 0 1-3-3v-4"/>',
            "fa-mouse-pointer": '<path d="m5 3 12 9-6 1-3 6z"/>',
            "fa-hand-o-up": '<path d="M8 11V6a2 2 0 0 1 4 0v4-2a2 2 0 0 1 4 0v3-1a2 2 0 0 1 4 0v5c0 4-2 6-6 6h-2c-2 0-3-.7-4.5-2.3L4 15.2a2 2 0 0 1 2.8-2.8z"/>',
            "fa-align-center": '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',
            "fa-arrows-h": '<path d="M4 12h16M7 9l-3 3 3 3M17 9l3 3-3 3"/>',
            "fa-eye": '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.5"/>',
            "fa-cube": '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9"/>',
            "fa-align-left": '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',
            "fa-align-right": '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
            "fa-align-justify": '<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>',
            "fa-pause": '<path d="M8 5v14M16 5v14"/>',
            "fa-file-code-o": '<path d="M6 3h9l4 4v14H6zM14 3v5h5M10 12l-2 2 2 2M15 12l2 2-2 2"/>',
            "fa-repeat": '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M18 12a6 6 0 0 0-10-4L5 11M6 12a6 6 0 0 0 10 4l3-3"/>',
            "fa-desktop": '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
            "fa-code": '<path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14"/>',
            "fa-upload": '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 15v5h16v-5"/>',
            "fa-download": '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 19v2h16v-2"/>',
            "fa-gear": '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z"/>',
            "fa-floppy-o": '<path d="M4 3h13l3 3v15H4z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>',
            "fa-times": '<path d="M6 6l12 12M18 6 6 18"/>'
        };

        floatingToolbar.querySelectorAll("i.fa").forEach((legacyIcon) => {
            const iconClass = Array.from(legacyIcon.classList).find((className) => iconPaths[className]);

            if (!iconClass) {
                return;
            }

            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("class", "cg-modern-toolbar-icon");
            svg.setAttribute("viewBox", "0 0 24 24");
            svg.setAttribute("aria-hidden", "true");
            svg.innerHTML = iconPaths[iconClass];
            legacyIcon.replaceWith(svg);
        });

        /* STAMP: 2026-08-31 - Expose a compact name below each top-level
           toolbar icon on hover/focus without widening the canvas toolbar. */
        const toolbarLabelOverrides = {
            clear: "Clear", canvasback: "Canvas", image: "Image", addDirectText: "Text",
            cgTableInsert: "Table", btnEmojiDropdown: "Emoji", btnAudioDropdown: "Audio",
            refresh: "Refresh", btnpreview: "Preview", openJsonDataEditor: "Code",
            btnimport: "Import", btndownload: "Export", openSettingModal: "Settings"
        };
        floatingToolbar.querySelectorAll("button, a").forEach((control) => {
            if (control.closest(".dropdown-menu")) return;
            const label = toolbarLabelOverrides[control.id]
                || control.getAttribute("title")
                || control.getAttribute("aria-label");
            if (label) control.dataset.cgToolLabel = label.replace(/^Add\s+/i, "");
            /* STAMP: 2026-09-05 - Keep the black toolbar label as the only
               hover hint; retain an accessible name without native tooltips. */
            if (label && !control.hasAttribute("aria-label")) {
                control.setAttribute("aria-label", label);
            }
            control.removeAttribute("title");
            control.removeAttribute("data-original-title");
            if (control.getAttribute("data-toggle") === "tooltip") {
                control.removeAttribute("data-toggle");
            }
        });

        const activateTool = (target) => {
            floatingToolbar.querySelectorAll(".is-active-tool").forEach((control) => {
                control.classList.remove("is-active-tool");
                control.setAttribute("aria-pressed", "false");
            });
            target.classList.add("is-active-tool");
            target.setAttribute("aria-pressed", "true");
        };

        selectButton.addEventListener("click", () => {
            const navigationToggle = document.getElementById("scrollCanvas");

            if (navigationToggle && navigationToggle.checked) {
                navigationToggle.click();
            }

            if (typeof canvas !== "undefined" && canvas) {
                canvas.isDrawingMode = false;
                canvas.selection = true;
                canvas.defaultCursor = "default";
                canvas.hoverCursor = "move";
                canvas.requestRenderAll();
            }

            activateTool(selectButton);
        });

        navigateButton.addEventListener("click", () => {
            const navigationToggle = document.getElementById("scrollCanvas");
            const enableNavigation = !(navigationToggle && navigationToggle.checked);

            if (navigationToggle && navigationToggle.checked !== enableNavigation) {
                navigationToggle.click();
            }

            if (typeof canvas !== "undefined" && canvas) {
                canvas.isDrawingMode = false;
                canvas.selection = !enableNavigation;
                canvas.defaultCursor = enableNavigation ? "grab" : "default";
                canvas.hoverCursor = enableNavigation ? "grab" : "move";
                canvas.requestRenderAll();
            }

            activateTool(enableNavigation ? navigateButton : selectButton);
        });

        floatingToolbar.addEventListener("click", (event) => {
            const control = event.target instanceof Element
                ? event.target.closest("button, a")
                : null;

            if (!control || control === selectButton || control === navigateButton || control.closest(".dropdown-menu")) {
                return;
            }

            activateTool(control);
        });
    }

    function buildWorkspace(hub, canvasContainer, propertyBars, slideBars) {
        const workspace = createElement("div", "cg-workspace");
        const stageColumn = createElement("section", "cg-stage-column");
        const canvasStage = createElement("div", "cg-canvas-stage");
        const canvasMeta = createElement("div", "cg-canvas-meta");
        const slideShell = createElement("aside", "cg-slide-shell cg-slide-dock");
        const slideHeader = createElement("div", "cg-slide-shell__header");
        const slideCopy = createElement("div", "cg-slide-shell__copy");
        const slideTitle = createElement("h2", "", "Slides");
        const slideText = createElement("p", "", "Manage the slide stack.");
        const canvasElement = canvasContainer.querySelector("#canvas");
        const importedData = canvasContainer.querySelector("#importeddate");
        const objectNav = canvasContainer.querySelector("#myObjnav");
        const zoomControls = canvasContainer.querySelector("#divcanvaszio");

        propertyBars.classList.remove("cg-property-dock");
        propertyBars.classList.add("cg-property-storage");
        canvasContainer.classList.add("cg-stage-surface");

        slideCopy.appendChild(slideTitle);
        slideCopy.appendChild(slideText);
        slideHeader.appendChild(slideCopy);
        slideShell.appendChild(slideHeader);

        hub.insertBefore(workspace, canvasContainer);
        workspace.appendChild(stageColumn);
        workspace.appendChild(slideShell);
        stageColumn.appendChild(canvasContainer);
        hub.appendChild(propertyBars);

        canvasContainer.insertBefore(canvasStage, objectNav || zoomControls || null);

        if (canvasElement) {
            canvasStage.appendChild(canvasElement);
        }

        if (importedData) {
            canvasStage.appendChild(importedData);
        }

        if (objectNav || zoomControls) {
            canvasContainer.appendChild(canvasMeta);
        }

        if (objectNav) {
            canvasMeta.appendChild(objectNav);
        }

        if (zoomControls) {
            canvasMeta.appendChild(zoomControls);
        }

        if (slideBars) {
            slideShell.appendChild(slideBars);
        }
    }

    /* STAMP: 2026-08-28 - Keep Layers available as a left-side island with
       separate open and close buttons. LoadTimeline remains the sole owner. */
    function setupLayersIsland(canvasContainer) {
        const objectNav = canvasContainer.querySelector("#myObjnav");
        const footerControls = canvasContainer.querySelector("#divcanvaszio");

        if (!objectNav || document.getElementById("cgLayersIslandToggle")) {
            return;
        }

        const toggle = createElement("button", "cg-layers-island-toggle");
        const toggleIcon = createElement("i", "fa fa-list-ul");
        const closeButton = objectNav.querySelector("#cgLayerClose");

        toggle.type = "button";
        toggle.id = "cgLayersIslandToggle";
        toggle.title = "Show object layers";
        toggle.setAttribute("aria-label", "Show object layers");
        toggle.setAttribute("aria-controls", "myObjnav");
        toggle.setAttribute("aria-expanded", "false");
        toggleIcon.setAttribute("aria-hidden", "true");
        toggle.appendChild(toggleIcon);
        (footerControls || document.body).appendChild(toggle);

        const setLayersOpen = (isOpen) => {
            /* STAMP: 2026-09-10 - Mirror the Shapes exclusion contract: only
             * one left-edge island may reserve canvas space at a time. */
            if (isOpen && window.CGShapeSidebar && typeof window.CGShapeSidebar.close === "function") {
                window.CGShapeSidebar.close();
            }
            if (isOpen && window.CGStickerIsland && typeof window.CGStickerIsland.close === "function") {
                window.CGStickerIsland.close();
            }
            if (isOpen && window.CGObjectLibraryIsland && typeof window.CGObjectLibraryIsland.close === "function") {
                window.CGObjectLibraryIsland.close();
            }
            window.CGFlipCardIsland?.close?.();
            window.CGTreeNodesIsland?.close?.();
            document.body.classList.toggle("cg-layers-island-open", isOpen);
            toggle.setAttribute("aria-expanded", String(isOpen));
        };

        /* STAMP: 2026-09-10 - Expose the existing Layers state transition so
         * another left-edge island can close it without duplicating DOM state. */
        window.CGLayersIsland = {
            open: () => setLayersOpen(true),
            close: () => setLayersOpen(false),
            toggle: () => setLayersOpen(!document.body.classList.contains("cg-layers-island-open"))
        };

        toggle.addEventListener("click", () => {
            /* STAMP: 2026-08-28 - Launcher is a normal open button, not an
             * on/off toggle. The panel close button owns the close action. */
            if (typeof window.LoadTimeline === "function") {
                window.LoadTimeline();
            }

            setLayersOpen(true);
        });

        if (closeButton) {
            closeButton.addEventListener("click", () => {
                setLayersOpen(false);
                toggle.focus();
            });
        }

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && document.body.classList.contains("cg-layers-island-open")) {
                setLayersOpen(false);
                toggle.focus();
            }
        });

        setLayersOpen(false);
    }

    /* STAMP: 2026-08-19 - Show the Canvas label only while the active Fabric
       slide is empty; object lifecycle and serialization remain untouched. */
    function setupEmptyCanvasHint(canvasContainer) {
        const canvasStage = canvasContainer.querySelector(".cg-canvas-stage");
        let attempts = 0;

        if (!canvasStage) {
            return;
        }

        const bindCanvasHint = () => {
            if (typeof canvas === "undefined" || !canvas || typeof canvas.on !== "function") {
                attempts += 1;

                if (attempts < 120) {
                    window.setTimeout(bindCanvasHint, 150);
                }

                return;
            }

            const syncCanvasHint = () => {
                const hasContent = typeof canvas.getObjects === "function" && canvas.getObjects().length > 0;
                canvasStage.classList.toggle("cg-canvas-has-content", hasContent);
            };

            canvas.on("object:added", syncCanvasHint);
            canvas.on("object:removed", syncCanvasHint);
            canvas.on("after:render", syncCanvasHint);
            syncCanvasHint();
        };

        bindCanvasHint();
    }

    function decorateSlideBar(toolbar, slideBars) {
        const slideDropdown = toolbar.querySelector(".custom-dropdown");
        const slideToggleButton = slideDropdown ? slideDropdown.querySelector(".custom-toggle") : null;

        if (slideDropdown) {
            slideDropdown.classList.add("cg-slide-summary");
        }

        if (slideToggleButton) {
            slideToggleButton.classList.add("cg-slide-summary__button");
            slideToggleButton.setAttribute("type", "button");
        }

        if (slideBars) {
            slideBars.classList.add("cg-slide-panel");
        }
    }

    /* STAMP: 2026-08-24 - Use a compact slide glyph plus the live slide number
       instead of repeating the word "Slide" inside the floating toolbar. */
    function setupSlideIconLabel(toolbar) {
        const slideNumber = toolbar.querySelector("#spancurrslide");
        const slideButton = slideNumber ? slideNumber.closest("button") : null;

        if (!slideNumber || !slideButton) {
            return;
        }

        /* STAMP: 2026-08-28 - Normalize any existing slide glyph to one visible
           dark plus so repeated initialization cannot leave an empty icon. */
        const existingSlideIcon = slideButton.querySelector(".cg-slide-summary__icon");
        const slideIcon = existingSlideIcon || createElement("span", "cg-slide-summary__icon");
        slideIcon.textContent = "+";
        slideIcon.setAttribute("aria-hidden", "true");
        if (!existingSlideIcon) {
            slideButton.insertBefore(slideIcon, slideNumber);
        }
        Array.from(slideButton.querySelectorAll("i, svg")).forEach((icon) => {
            if (icon !== slideIcon) {
                icon.remove();
            }
        });

        let isSynchronizing = false;
        const synchronizeNumber = () => {
            if (isSynchronizing) {
                return;
            }

            const match = slideNumber.textContent.match(/\d+/);
            const currentNumber = match ? match[0] : "1";

            isSynchronizing = true;
            if (slideNumber.textContent.trim() !== currentNumber) {
                slideNumber.textContent = currentNumber;
            }
            slideButton.setAttribute("aria-label", `Slide ${currentNumber}. Show slides panel`);
            isSynchronizing = false;
        };

        new MutationObserver(synchronizeNumber).observe(slideNumber, {
            childList: true,
            characterData: true,
            subtree: true
        });
        synchronizeNumber();
    }

    /* STAMP: 2026-08-24 - Keep the Slides rail visible on first load while
       allowing both its header close button and the existing top Slides
       control to share one predictable expanded/collapsed workspace state. */
    function setupSlidePanelToggle(toolbar, slideBars) {
        const workspace = document.querySelector(".cg-workspace");
        const stageColumn = workspace ? workspace.querySelector(".cg-stage-column") : null;
        const floatingToolbar = toolbar.querySelector(".cg-floating-canvas-toolbar");
        const slideShell = slideBars ? slideBars.closest(".cg-slide-shell") : null;
        const slideHeader = slideShell ? slideShell.querySelector(".cg-slide-shell__header") : null;
        const slideToggleButton = toolbar.querySelector(".cg-slide-summary__button");
        const slideToggleHost = slideToggleButton ? slideToggleButton.closest(".input-group-button") : null;
        const footerControls = document.getElementById("divcanvaszio");

        if (!workspace || !stageColumn || !slideBars || !slideShell || !slideHeader || !slideToggleButton) {
            return;
        }

        /* STAMP: 2026-08-26 - Keep the floating top menu centered over the
           actual editable canvas column, not the full viewport. Measuring the
           stage preserves correct alignment in both Slides-panel states and
           across responsive workspace sizes without changing canvas data. */
        const alignToolbarToCanvas = () => {
            if (!floatingToolbar) {
                return;
            }

            const stageBounds = stageColumn.getBoundingClientRect();
            const centerX = stageBounds.left + (stageBounds.width / 2);

            floatingToolbar.style.setProperty("--cg-canvas-toolbar-center-x", `${centerX}px`);
        };

        const stageResizeObserver = typeof ResizeObserver === "function"
            ? new ResizeObserver(alignToolbarToCanvas)
            : null;

        if (stageResizeObserver) {
            stageResizeObserver.observe(stageColumn);
        }

        window.addEventListener("resize", alignToolbarToCanvas, { passive: true });

        /* STAMP: 2026-09-10 - Runtime viewport authority for the right-side
         * Slides island. A shared inset guarantees equal breathing room above
         * and below without changing any slide content or controls. */
        const syncSlideRailHeight = () => {
            const viewportHeight = Math.max(
                document.documentElement.clientHeight || 0,
                window.innerHeight || 0
            );
            const islandInset = 12;
            const islandHeight = Math.max(220, viewportHeight - (islandInset * 2));

            slideShell.style.setProperty("position", "fixed", "important");
            slideShell.style.setProperty("top", `${islandInset}px`, "important");
            slideShell.style.setProperty("right", `${islandInset}px`, "important");
            slideShell.style.setProperty("bottom", "auto", "important");
            slideShell.style.setProperty("width", "228px", "important");
            slideShell.style.setProperty("height", `${islandHeight}px`, "important");
            slideShell.style.setProperty("min-height", `${islandHeight}px`, "important");
            slideShell.style.setProperty("max-height", `${islandHeight}px`, "important");
            slideShell.style.setProperty("margin", "0", "important");
        };

        window.addEventListener("resize", syncSlideRailHeight, { passive: true });
        syncSlideRailHeight();

        if (slideToggleHost && footerControls) {
            slideToggleHost.classList.add("cg-slide-summary__footer-host");
            footerControls.appendChild(slideToggleHost);
        }

        const closeButton = createElement("button", "cg-slide-shell__close");

        closeButton.type = "button";
        closeButton.title = "Close slides panel";
        closeButton.setAttribute("aria-label", "Close slides panel");
        closeButton.innerHTML = '<i class="fa fa-times" aria-hidden="true"></i>';
        slideHeader.appendChild(closeButton);

        const setPanelOpen = (isOpen) => {
            workspace.classList.toggle("cg-workspace--slides-collapsed", !isOpen);
            slideShell.hidden = !isOpen;
            slideBars.hidden = !isOpen;
            slideToggleButton.setAttribute("aria-expanded", String(isOpen));
            slideToggleButton.classList.toggle("is-slide-panel-open", isOpen);
            slideToggleButton.classList.toggle("cg-slide-summary__button--restore", !isOpen);
            if (slideToggleHost) {
                slideToggleHost.classList.toggle("cg-slide-summary__host--hidden", isOpen);
                slideToggleHost.classList.toggle("cg-slide-summary__host--restore", !isOpen);
            }
            slideToggleButton.title = isOpen ? "Slides panel is open" : "Show slides panel";
            if (isOpen) syncSlideRailHeight();
            window.requestAnimationFrame(alignToolbarToCanvas);
        };

        closeButton.addEventListener("click", () => {
            setPanelOpen(false);
            slideToggleButton.focus();
        });

        slideToggleButton.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            setPanelOpen(true);
        }, true);

        window.CGSlidePanel = {
            open: () => setPanelOpen(true),
            close: () => setPanelOpen(false),
            toggle: () => setPanelOpen(slideShell.hidden)
        };

        setPanelOpen(true);
    }

    function monitorSlides(slideBars) {
        if (!slideBars) {
            return;
        }

        const slideSection = slideBars.querySelector("#slidesection");
        const generatedSlides = slideBars.querySelector(".generatedSlides");
        const slideText = document.querySelector(".cg-slide-shell__header p");
        const scrollUpButton = slideSection ? createElement("button", "cg-slide-rail-nav cg-slide-rail-nav--up") : null;
        const scrollDownButton = slideSection ? createElement("button", "cg-slide-rail-nav cg-slide-rail-nav--down") : null;

        if (slideSection && generatedSlides && scrollUpButton && scrollDownButton && !slideSection.querySelector(".cg-slide-rail-nav")) {
            /* Slide rail arrow navigation stamped 2026-04-07:
               replace the visible thumbnail scrollbar with explicit up/down
               controls so the slide stack can be paged without changing the
               existing slide generation or selection flow. */
            scrollUpButton.type = "button";
            scrollDownButton.type = "button";
            scrollUpButton.setAttribute("aria-label", "Show previous slides");
            scrollDownButton.setAttribute("aria-label", "Show more slides");
            scrollUpButton.innerHTML = '<i class="fa fa-angle-up" aria-hidden="true"></i>';
            scrollDownButton.innerHTML = '<i class="fa fa-angle-down" aria-hidden="true"></i>';
            slideSection.insertBefore(scrollUpButton, generatedSlides);
            slideSection.appendChild(scrollDownButton);
        }

        const resolveScrollStep = () => {
            const firstSlide = generatedSlides ? generatedSlides.querySelector(":scope > div") : null;
            const firstHeight = firstSlide instanceof HTMLElement ? firstSlide.getBoundingClientRect().height : 0;
            const viewportStep = generatedSlides ? Math.floor(generatedSlides.clientHeight * 0.78) : 0;
            return Math.max(firstHeight + 12, viewportStep, 168);
        };

        const updateRailButtons = () => {
            if (!generatedSlides || !scrollUpButton || !scrollDownButton) {
                return;
            }

            const maxScrollTop = generatedSlides.scrollHeight - generatedSlides.clientHeight;
            const canScroll = maxScrollTop > 6;
            const nearTop = generatedSlides.scrollTop <= 4;
            const nearBottom = generatedSlides.scrollTop >= maxScrollTop - 4;

            scrollUpButton.hidden = !canScroll;
            scrollDownButton.hidden = !canScroll;
            scrollUpButton.disabled = !canScroll || nearTop;
            scrollDownButton.disabled = !canScroll || nearBottom;
        };

        const scrollSlides = (direction) => {
            if (!generatedSlides) {
                return;
            }

            generatedSlides.scrollBy({
                top: resolveScrollStep() * direction,
                behavior: "smooth"
            });
        };

        if (scrollUpButton && scrollDownButton) {
            scrollUpButton.addEventListener("click", () => scrollSlides(-1));
            scrollDownButton.addEventListener("click", () => scrollSlides(1));
        }

        const updateState = () => {
            const count = generatedSlides ? generatedSlides.children.length : 0;

            slideBars.classList.toggle("cg-has-slides", count > 0);

            if (slideText) {
                slideText.textContent = count > 0
                    ? `${count} slide${count === 1 ? "" : "s"} ready`
                    : "Manage the slide stack.";
            }

            window.requestAnimationFrame(updateRailButtons);
        };

        updateState();

        if (generatedSlides) {
            const observer = new MutationObserver(updateState);
            observer.observe(generatedSlides, {
                childList: true,
                subtree: true
            });

            generatedSlides.addEventListener("scroll", updateRailButtons, { passive: true });

            if (typeof ResizeObserver === "function") {
                const resizeObserver = new ResizeObserver(updateRailButtons);
                resizeObserver.observe(generatedSlides);
            }
        }
    }

    function setupShapeLibrary() {
        const library = document.getElementById("cgShapeLibrary");
        const search = document.getElementById("cgShapeSearch");
        const sidebar = document.getElementById("cgShapeSidebar");
        const closeButton = sidebar?.querySelector("[data-cg-shape-close]");
        const toggle = sidebar?.closest(".dropdown")?.querySelector(".cg-shape-toggle");

        if (!library || !search || !sidebar || !toggle) {
            return;
        }

        /* STAMP: 2026-09-01 - The toolbar is transformed for canvas-centred
           positioning. Host the rail in the workspace, like Widgets, so its
           left edge is the editor edge rather than the toolbar edge. */
        const workspace = document.querySelector(".cg-workspace");
        if (workspace && sidebar.parentElement !== workspace) {
            workspace.insertBefore(sidebar, workspace.firstChild);
        }

        /* STAMP: 2026-09-01 - This is an explicit sidebar state, independent
           from Bootstrap dropdown positioning and auto-close behavior. */
        const setSidebarOpen = (isOpen) => {
            /* STAMP: 2026-09-10 - Only one left-edge island may occupy the
             * workspace. Close Layers through its controller before Shapes
             * reserves the left canvas edge. */
            if (isOpen && window.CGLayersIsland && typeof window.CGLayersIsland.close === "function") {
                window.CGLayersIsland.close();
            }
            if (isOpen && window.CGStickerIsland && typeof window.CGStickerIsland.close === "function") {
                window.CGStickerIsland.close();
            }
            if (isOpen && window.CGObjectLibraryIsland && typeof window.CGObjectLibraryIsland.close === "function") {
                window.CGObjectLibraryIsland.close();
            }
            window.CGFlipCardIsland?.close?.();
            window.CGTreeNodesIsland?.close?.();
            sidebar.classList.toggle("show", isOpen);
            document.body.classList.toggle("cg-shape-sidebar-open", isOpen);
            toggle.setAttribute("aria-expanded", String(isOpen));
            window.requestAnimationFrame(() => {
                /* STAMP: 2026-09-01 - Recalculate the stage after either
                   transition so closing restores the canvas to the left edge. */
                window.dispatchEvent(new Event("resize"));
                if (typeof canvas !== "undefined" && canvas) {
                    canvas.calcOffset?.();
                    canvas.requestRenderAll?.();
                }
                if (isOpen) search.focus();
            });
        };

        /* STAMP: 2026-09-10 - Share the single Shapes state transition with
         * Layers so mutual exclusion also updates accessibility and canvas. */
        window.CGShapeSidebar = {
            open: () => setSidebarOpen(true),
            close: () => setSidebarOpen(false),
            toggle: () => setSidebarOpen(!sidebar.classList.contains("show"))
        };

        toggle.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            setSidebarOpen(true);
        });

        closeButton?.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            setSidebarOpen(false);
            toggle.focus();
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && sidebar.classList.contains("show")) {
                setSidebarOpen(false);
                toggle.focus();
            }
        });

        setSidebarOpen(false);

        library.addEventListener("click", (event) => {
            const toggle = event.target instanceof Element
                ? event.target.closest(".cg-shape-library__section-toggle")
                : null;

            if (!toggle) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            const section = toggle.closest("[data-shape-section]");
            const isOpen = toggle.getAttribute("aria-expanded") === "true";
            toggle.setAttribute("aria-expanded", String(!isOpen));
            section.classList.toggle("is-collapsed", isOpen);
        });

        search.addEventListener("input", () => {
            const term = search.value.trim().toLowerCase();

            library.querySelectorAll("[data-shape-section]").forEach((section) => {
                let visibleCount = 0;
                section.querySelectorAll(".cg-shape-library__grid > button").forEach((button) => {
                    const matches = !term || (button.title || "").toLowerCase().includes(term);
                    button.hidden = !matches;
                    visibleCount += matches ? 1 : 0;
                });
                section.hidden = visibleCount === 0;
                if (term && visibleCount > 0) {
                    section.classList.remove("is-collapsed");
                    section.querySelector(".cg-shape-library__section-toggle")?.setAttribute("aria-expanded", "true");
                }
            });
        });
    }

    /* STAMP: 2026-09-10 - Promote preset editors to deterministic left islands.
     * Bootstrap's modal positioning is intentionally removed here so Flip Card
     * and Tree Nodes cannot fall back to a centered, canvas-covering dialog. */
    function setupPresetComponentIslands() {
        const configurations = [
            { id: "flipRevealPresetModal", triggerId: "addFlipRevealDemo", bodyClass: "cg-flip-card-island-open", controller: "CGFlipCardIsland" },
            { id: "treeNodesPresetModal", triggerId: "addTreeNodesComponent", bodyClass: "cg-tree-nodes-island-open", controller: "CGTreeNodesIsland" }
        ];

        const closeOtherLeftIslands = (exceptController) => {
            ["CGLayersIsland", "CGShapeSidebar", "CGStickerIsland", "CGObjectLibraryIsland", "CGFlipCardIsland", "CGTreeNodesIsland"]
                .filter((name) => name !== exceptController)
                .forEach((name) => window[name]?.close?.());
        };

        configurations.forEach((configuration) => {
            const panel = document.getElementById(configuration.id);
            const trigger = document.getElementById(configuration.triggerId);
            if (!panel || !trigger) return;

            window.bootstrap?.Modal?.getInstance(panel)?.dispose();
            panel.classList.remove("modal", "fade", "show");
            panel.classList.add("cg-left-component-island");
            panel.removeAttribute("style");
            panel.hidden = true;
            panel.setAttribute("role", "dialog");
            panel.setAttribute("aria-modal", "false");
            panel.setAttribute("aria-hidden", "true");
            trigger.removeAttribute("data-bs-toggle");
            trigger.removeAttribute("data-bs-target");
            trigger.setAttribute("aria-controls", configuration.id);
            trigger.setAttribute("aria-expanded", "false");

            const syncState = (isOpen) => {
                document.body.classList.toggle(configuration.bodyClass, isOpen);
                trigger.setAttribute("aria-expanded", String(isOpen));
                window.requestAnimationFrame(() => {
                    window.dispatchEvent(new Event("resize"));
                    if (typeof canvas !== "undefined" && canvas) {
                        canvas.calcOffset?.();
                        canvas.requestRenderAll?.();
                    }
                });
            };

            const close = (restoreFocus = false) => {
                if (panel.hidden) return;
                panel.hidden = true;
                panel.setAttribute("aria-hidden", "true");
                syncState(false);
                if (restoreFocus) trigger.focus({ preventScroll: true });
            };

            const open = () => {
                closeOtherLeftIslands(configuration.controller);
                panel.hidden = false;
                panel.setAttribute("aria-hidden", "false");
                syncState(true);
                window.requestAnimationFrame(() => panel.querySelector("input, textarea, select, button")?.focus({ preventScroll: true }));
            };

            window[configuration.controller] = { open, close };

            panel.querySelectorAll('[data-bs-dismiss="modal"]').forEach((button) => {
                button.removeAttribute("data-bs-dismiss");
                button.addEventListener("click", (event) => {
                    event.preventDefault();
                    close(true);
                });
            });

            panel.addEventListener("keydown", (event) => {
                if (event.key !== "Escape") return;
                event.preventDefault();
                event.stopPropagation();
                close(true);
            });
        });
    }

    function decoratePropertyBars(propertyBars) {
        if (!propertyBars.querySelector(".cg-property-shell__header")) {
            const header = createElement("div", "cg-property-shell__header");
            const copy = createElement("div", "cg-property-shell__copy");
            const title = createElement("h2", "", "Properties");
            const text = createElement("p", "", "Full object controls");
            const empty = createElement("div", "cg-property-shell__empty");
            const emptyTitle = createElement("strong", "", "Nothing selected");
            const emptyText = createElement("p", "", "Select any canvas object to edit it.");

            copy.appendChild(title);
            copy.appendChild(text);
            header.appendChild(copy);

            empty.appendChild(emptyTitle);
            empty.appendChild(emptyText);

            propertyBars.insertBefore(empty, propertyBars.firstChild);
            propertyBars.insertBefore(header, propertyBars.firstChild);
        }

        Object.entries(panelTitles).forEach(([id, title]) => {
            const panel = document.getElementById(id);

            if (panel) {
                panel.dataset.cgPanelTitle = title;
            }
        });
    }

    function monitorPropertyPanels(propertyBars) {
        const updateState = () => {
            const activePanel = Array.from(propertyBars.querySelectorAll(".objproperties")).some((panel) => {
                if (!(panel instanceof HTMLElement)) {
                    return false;
                }

                return window.getComputedStyle(panel).display !== "none";
            });

            propertyBars.classList.toggle("cg-has-active-panel", activePanel);
        };

        updateState();

        const observer = new MutationObserver(updateState);
        observer.observe(propertyBars, {
            subtree: true,
            attributes: true,
            attributeFilter: ["style", "class"]
        });
    }

    function keepDockVisible(panel) {
        if (!panel) {
            return;
        }

        const showPanel = () => {
            panel.style.display = "block";
        };

        showPanel();

        const observer = new MutationObserver(showPanel);
        observer.observe(panel, {
            attributes: true,
            attributeFilter: ["style", "class"]
        });
    }

    function setupTextHeadingFlyout() {
        const submenu = document.querySelector("#canvasheader .cg-text-dropdown__submenu");
        const trigger = submenu ? submenu.querySelector(".cg-text-dropdown__trigger") : null;
        const nestedMenu = submenu ? submenu.querySelector(".cg-text-dropdown__nested-menu") : null;

        if (!submenu || !trigger || !nestedMenu) {
            return;
        }

        /* Text heading flyout stamped 2026-05-06:
           keep the nested heading menu open while the Heading trigger is
           hovered, focused, or clicked, then close it immediately when the
           pointer leaves or the outer dropdown closes. */
        const openMenu = () => {
            submenu.classList.add("cg-text-dropdown__submenu--open");
            trigger.setAttribute("aria-expanded", "true");
        };

        const closeMenu = () => {
            submenu.classList.remove("cg-text-dropdown__submenu--open");
            trigger.setAttribute("aria-expanded", "false");
        };

        trigger.addEventListener("mouseenter", openMenu);
        trigger.addEventListener("mouseleave", closeMenu);
        trigger.addEventListener("focus", openMenu);
        trigger.addEventListener("blur", closeMenu);
        trigger.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();

            if (submenu.classList.contains("cg-text-dropdown__submenu--open")) {
                closeMenu();
            } else {
                openMenu();
            }
        });
        nestedMenu.addEventListener("mouseleave", closeMenu);

        nestedMenu.querySelectorAll("a").forEach((item) => {
            item.addEventListener("click", closeMenu);
        });

        const dropdown = submenu.closest(".dropdown");

        if (dropdown) {
            dropdown.addEventListener("hidden.bs.dropdown", closeMenu);
        }
    }

    function setupTextEditBlockToggle() {
        const editBlock = document.getElementById("diveditgrptxt");
        const toggleButton = document.getElementById("toggleEditTextBlock");
        const textarea = document.getElementById("editgrptxt");

        if (!editBlock || !toggleButton || !textarea) {
            return;
        }

        /* Edit Text expander stamped 2026-05-06:
           switch the textarea block between a compact editor card and a
           full-width writing surface without changing the underlying text
           binding or any save/update flow. */
        const state = {
            expanded: false
        };

        const syncState = () => {
            editBlock.classList.toggle("cg-text-edit-block--expanded", state.expanded);
            toggleButton.setAttribute("aria-pressed", state.expanded ? "true" : "false");
            toggleButton.setAttribute(
                "aria-label",
                state.expanded ? "Collapse Edit Text block" : "Expand Edit Text block"
            );
            toggleButton.title = state.expanded ? "Collapse Edit Text block" : "Expand Edit Text block";
            toggleButton.innerHTML = state.expanded
                ? '<i class="fa fa-compress" aria-hidden="true"></i>'
                : '<i class="fa fa-expand" aria-hidden="true"></i>';
            textarea.rows = state.expanded ? 7 : 1;
        };

        toggleButton.addEventListener("click", () => {
            /* STAMP: 2026-08-18 - Expand now opens the canvas-sized rich editor
               with the active text object or all-text group preloaded. */
            if (window.CGRichTextComponent && typeof window.CGRichTextComponent.openForEdit === "function") {
                const opened = window.CGRichTextComponent.openForEdit()
                if (opened) {
                    return
                }
            }
            state.expanded = !state.expanded;
            syncState();
        });

        syncState();
    }

    function getFriendlyObjectType(target) {
        if (!target) {
            return "Object";
        }

        switch (target.type) {
            case "i-text":
            case "textbox":
            case "text":
                return "Text";
            case "activeSelection":
            case "activeselection":
                return "Selection";
            case "image":
                return "Image";
            case "rect":
                return "Rectangle";
            case "circle":
                return "Circle";
            case "triangle":
                return "Triangle";
            case "line":
                return "Line";
            case "group":
                return "Group";
            default:
                return target.type ? target.type.charAt(0).toUpperCase() + target.type.slice(1) : "Object";
        }
    }

    function createQuickPopup(propertyBars) {
        /* STAMP: 2026-08-25 - Compact inspector accordions reuse the existing
         * property, animation, and action controls without duplicating IDs. */
        function createPopupAccordion(label, modifier) {
            const section = createElement("section", `cg-context-popup__section cg-context-popup__section--accordion ${modifier}`);
            const toggle = createElement("button", "cg-context-popup__accordion-toggle");
            const toggleLabel = createElement("span", "cg-context-popup__accordion-toggle-label", label);
            const toggleIcon = createElement("i", "cg-context-popup__accordion-toggle-icon fa fa-chevron-down");
            const content = createElement("div", "cg-context-popup__accordion-content");
            toggle.type = "button";
            toggle.setAttribute("aria-expanded", "false");
            content.id = `cg${label.replace(/\s+/g, "")}AccordionContent`;
            toggle.setAttribute("aria-controls", content.id);
            toggle.appendChild(toggleLabel);
            toggle.appendChild(toggleIcon);
            section.appendChild(toggle);
            section.appendChild(content);
            return { section, toggle, content };
        }

        const popup = createElement("div", "cg-context-popup");
        const header = createElement("div", "cg-context-popup__header");
        const titleWrap = createElement("div", "cg-context-popup__title-wrap");
        const title = createElement("strong", "cg-context-popup__title", "Object");
        const subtitle = createElement("span", "cg-context-popup__subtitle", "Quick controls");
        const closeButton = createElement("button", "cg-context-popup__close");
        const quickAccordion = createPopupAccordion("Quick controls", "cg-context-popup__quick-accordion");
        const propertyAccordion = createPopupAccordion("Property", "cg-context-popup__property-accordion");
        const effectsAccordion = createPopupAccordion("Effects", "cg-context-popup__effects-accordion");
        const animationAccordion = createPopupAccordion("Animation", "cg-context-popup__animation-accordion");
        const actionAccordion = createPopupAccordion("Actions", "cg-context-popup__actions-accordion");
        const quickControlsSection = quickAccordion.section;
        const quickControlsToggle = quickAccordion.toggle;
        const quickControlsContent = quickAccordion.content;
        const nameField = createElement("label", "cg-context-popup__field cg-context-popup__field--primary");
        const nameLabel = createElement("span", "cg-context-popup__label", "Name");
        const nameInput = createElement("input", "form-control cg-context-popup__input");
        const grid = createElement("div", "cg-context-popup__grid cg-context-popup__metric-grid");
        const xField = createElement("label", "cg-context-popup__field cg-context-popup__field--metric");
        const xLabel = createElement("span", "cg-context-popup__label", "X");
        const xInput = createElement("input", "form-control cg-context-popup__input");
        const yField = createElement("label", "cg-context-popup__field cg-context-popup__field--metric");
        const yLabel = createElement("span", "cg-context-popup__label", "Y");
        const yInput = createElement("input", "form-control cg-context-popup__input");
        const opacityField = createElement("label", "cg-context-popup__field cg-context-popup__field--wide");
        const opacityHeader = createElement("div", "cg-context-popup__field-head");
        const opacityLabel = createElement("span", "cg-context-popup__label", "Opacity");
        const opacityValue = createElement("span", "cg-context-popup__meta", "100%");
        const opacityInput = createElement("input", "cg-context-popup__range");
        const lockRow = createElement("label", "cg-context-popup__toggle");
        const lockInput = createElement("input", "");
        const lockText = createElement("span", "cg-context-popup__toggle-label", "Lock object");
        const imageTransformSection = createElement("section", "cg-context-popup__section cg-context-popup__section--image-transforms");
        const imageTransformTitle = createElement("div", "cg-context-popup__section-title", "Image transform");
        const imageTransformGrid = createElement("div", "cg-context-popup__image-actions");
        const replaceImageButton = createElement("button", "cg-context-popup__action-button cg-context-popup__action-button--replace-image");
        const rotateLeftButton = createElement("button", "cg-context-popup__action-button", "Rotate Left");
        const rotateRightButton = createElement("button", "cg-context-popup__action-button", "Rotate Right");
        const flipHorizontalButton = createElement("button", "cg-context-popup__action-button", "Flip Horizontal");
        const flipVerticalButton = createElement("button", "cg-context-popup__action-button", "Flip Vertical");
        const quickMeta = createElement("div", "cg-context-popup__quick-meta");
        const selectionPanelHost = createElement("div", "cg-context-popup__body cg-context-popup__selection-properties");
        const panelHost = createElement("div", "cg-context-popup__body");
        const effectsHost = createElement("div", "cg-context-popup__effects-host");
        const animationHost = createElement("div", "cg-context-popup__automation-host");
        const actionHost = createElement("div", "cg-context-popup__automation-host");
        const actions = createElement("div", "cg-context-popup__actions");
        const fullButton = createElement("button", "cg-context-popup__link", "Open full panel");

        popup.hidden = true;
        popup.setAttribute("aria-hidden", "true");

        closeButton.type = "button";
        closeButton.setAttribute("aria-label", "Close quick properties");
        closeButton.innerHTML = '<i class="fa fa-times" aria-hidden="true"></i>';

        nameInput.type = "text";
        xInput.type = "number";
        yInput.type = "number";
        xInput.step = "1";
        yInput.step = "1";
        opacityInput.type = "range";
        opacityInput.min = "10";
        opacityInput.max = "100";
        opacityInput.step = "1";
        lockInput.type = "checkbox";
        replaceImageButton.type = "button";
        replaceImageButton.innerHTML = '<i class="fa fa-picture-o" aria-hidden="true"></i><span>Replace Image</span>';
        rotateLeftButton.type = "button";
        rotateRightButton.type = "button";
        flipHorizontalButton.type = "button";
        flipVerticalButton.type = "button";
        fullButton.type = "button";
        titleWrap.appendChild(title);
        titleWrap.appendChild(subtitle);
        header.appendChild(titleWrap);
        header.appendChild(closeButton);

        nameField.appendChild(nameLabel);
        nameField.appendChild(nameInput);

        xField.appendChild(xLabel);
        xField.appendChild(xInput);
        yField.appendChild(yLabel);
        yField.appendChild(yInput);
        grid.appendChild(xField);
        grid.appendChild(yField);

        opacityHeader.appendChild(opacityLabel);
        opacityHeader.appendChild(opacityValue);
        opacityField.appendChild(opacityHeader);
        opacityField.appendChild(opacityInput);

        lockRow.appendChild(lockInput);
        lockRow.appendChild(lockText);

        imageTransformGrid.appendChild(replaceImageButton);
        imageTransformGrid.appendChild(rotateLeftButton);
        imageTransformGrid.appendChild(rotateRightButton);
        imageTransformGrid.appendChild(flipHorizontalButton);
        imageTransformGrid.appendChild(flipVerticalButton);
        imageTransformSection.appendChild(imageTransformTitle);
        imageTransformSection.appendChild(imageTransformGrid);

        actions.appendChild(fullButton);

        quickMeta.appendChild(nameField);
        quickMeta.appendChild(grid);
        quickMeta.appendChild(opacityField);
        quickMeta.appendChild(lockRow);
        quickControlsContent.appendChild(quickMeta);
        quickControlsContent.appendChild(imageTransformSection);
        propertyAccordion.content.appendChild(selectionPanelHost);
        propertyAccordion.content.appendChild(panelHost);
        effectsAccordion.content.appendChild(effectsHost);
        animationAccordion.content.appendChild(animationHost);
        actionAccordion.content.appendChild(actionHost);

        popup.appendChild(header);
        popup.appendChild(quickControlsSection);
        popup.appendChild(propertyAccordion.section);
        popup.appendChild(effectsAccordion.section);
        popup.appendChild(animationAccordion.section);
        popup.appendChild(actionAccordion.section);
        popup.appendChild(actions);
        document.body.appendChild(popup);

        popup.addEventListener("mousedown", (event) => {
            event.stopPropagation();
        });

        popup.addEventListener("click", (event) => {
            // STAMP: 2026-09-07 - Live animation/action controls use delegated
            // document click handlers. Dropdown clicks must reach those handlers.
            if (!popup.classList.contains("cg-toolbar-dropdown")) event.stopPropagation();
        });

        closeButton.addEventListener("click", () => {
            popup.dispatchEvent(new CustomEvent("cg:close"));
        });

        fullButton.addEventListener("click", () => {
            propertyBars.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
            propertyBars.classList.add("cg-dock-flash");
            window.setTimeout(() => propertyBars.classList.remove("cg-dock-flash"), 500);
            popup.dispatchEvent(new CustomEvent("cg:close"));
        });

        return {
            popup,
            header,
            title,
            subtitle,
            nameInput,
            xInput,
            yInput,
            opacityInput,
            opacityValue,
            lockInput,
            imageTransformSection,
            replaceImageButton,
            rotateLeftButton,
            rotateRightButton,
            flipHorizontalButton,
            flipVerticalButton,
            quickControlsSection,
            quickControlsToggle,
            quickControlsContent,
            accordions: [quickAccordion, propertyAccordion, effectsAccordion, animationAccordion, actionAccordion],
            propertyAccordion,
            effectsAccordion,
            quickMeta,
            selectionPanelHost,
            panelHost,
            effectsHost,
            animationHost,
            actionHost,
            fullButton
        };
    }

    function initQuickObjectPopup(propertyBars) {
        const quickPopup = createQuickPopup(propertyBars);
        const state = {
            activeCanvas: null,
            activeObject: null,
            syncing: false,
            mountedPanels: [],
            dragPointerId: null,
            dragOffsetX: 0,
            dragOffsetY: 0
        };
        /* STAMP: 2026-09-12 - One compact, type-safe command menu is shared by
         * text, images, shapes, groups and ActiveSelection objects. */
        const objectContextMenu = createElement("div", "cg-object-command-menu");
        let contextMenuTarget = null;
        objectContextMenu.hidden = true;
        objectContextMenu.setAttribute("role", "menu");
        objectContextMenu.setAttribute("aria-label", "Object actions");
        objectContextMenu.innerHTML = '<div class="cg-object-command-menu__group">'
            + '<button type="button" role="menuitem" data-cg-object-command="copy"><i class="fa fa-copy" aria-hidden="true"></i><span>Copy</span><kbd>Ctrl+C</kbd></button>'
            + '<button type="button" role="menuitem" data-cg-object-command="paste"><i class="fa fa-paste" aria-hidden="true"></i><span>Paste</span><kbd>Ctrl+V</kbd></button>'
            + '<button type="button" role="menuitem" data-cg-object-command="duplicate"><i class="fa fa-clone" aria-hidden="true"></i><span>Duplicate</span></button></div>'
            + '<div class="cg-object-command-menu__separator" role="separator"></div>'
            + '<div class="cg-object-command-menu__group"><button type="button" role="menuitem" class="is-danger" data-cg-object-command="delete"><i class="fa fa-trash" aria-hidden="true"></i><span>Delete</span><kbd>Del</kbd></button></div>'
            + '<div class="cg-object-command-menu__separator" role="separator"></div>'
            + '<div class="cg-object-command-menu__group">'
            + '<button type="button" role="menuitem" data-cg-object-command="properties"><i class="fa fa-sliders" aria-hidden="true"></i><span>Quick controls</span></button>'
            + '<button type="button" role="menuitem" data-cg-object-command="export-png"><i class="fa fa-download" aria-hidden="true"></i><span>Export as PNG</span></button></div>'
            + '<div class="cg-object-command-menu__separator" role="separator"></div>'
            + '<div class="cg-object-command-menu__group">'
            + '<button type="button" role="menuitem" data-cg-object-command="front"><i class="fa fa-angle-double-up" aria-hidden="true"></i><span>Bring to front</span></button>'
            + '<button type="button" role="menuitem" data-cg-object-command="forward"><i class="fa fa-angle-up" aria-hidden="true"></i><span>Bring forward</span></button>'
            + '<button type="button" role="menuitem" data-cg-object-command="backward"><i class="fa fa-angle-down" aria-hidden="true"></i><span>Send backward</span></button>'
            + '<button type="button" role="menuitem" data-cg-object-command="back"><i class="fa fa-angle-double-down" aria-hidden="true"></i><span>Send to back</span></button></div>'
            + '<div class="cg-object-command-menu__separator" role="separator"></div>'
            + '<div class="cg-object-command-menu__group">'
            + '<button type="button" role="menuitem" data-cg-object-command="lock"><i class="fa fa-lock" aria-hidden="true"></i><span>Lock object</span></button>'
            + '<button type="button" role="menuitem" data-cg-object-command="group" hidden><i class="fa fa-object-group" aria-hidden="true"></i><span>Group selection</span></button>'
            + '<button type="button" role="menuitem" data-cg-object-command="ungroup" hidden><i class="fa fa-object-ungroup" aria-hidden="true"></i><span>Ungroup</span></button></div>';
        document.body.appendChild(objectContextMenu);

        function clampPopupPosition(left, top) {
            const popupRect = quickPopup.popup.getBoundingClientRect();
            const margin = 14;
            const maxLeft = Math.max(margin, window.innerWidth - popupRect.width - margin);
            const maxTop = Math.max(margin, window.innerHeight - popupRect.height - margin);

            return {
                left: Math.min(Math.max(margin, left), maxLeft),
                top: Math.min(Math.max(margin, top), maxTop)
            };
        }

        function restoreMountedPanels() {
            if (!state.mountedPanels.length) {
                return;
            }

            /*
             * Multi-selection property panels stamped 2026-08-12:
             * Restore in reverse order so adjacent source panels return to their
             * exact original positions after the quick-controls popup closes.
             */
            state.mountedPanels.slice().reverse().forEach((mountedPanel) => {
                if (
                    mountedPanel.nextSibling &&
                    mountedPanel.nextSibling.parentNode === mountedPanel.parent
                ) {
                    mountedPanel.parent.insertBefore(mountedPanel.panel, mountedPanel.nextSibling);
                } else {
                    mountedPanel.parent.appendChild(mountedPanel.panel);
                }

                mountedPanel.panel.style.display = mountedPanel.display;
                if (mountedPanel.hidden) {
                    mountedPanel.panel.setAttribute("hidden", "");
                } else {
                    mountedPanel.panel.removeAttribute("hidden");
                }
            });

            quickPopup.selectionPanelHost.innerHTML = "";
            quickPopup.panelHost.innerHTML = "";
            quickPopup.effectsHost.innerHTML = "";
            quickPopup.popup.classList.remove("cg-context-popup--expanded");
            quickPopup.popup.classList.remove("cg-context-popup--text-layout");
            quickPopup.popup.classList.remove("cg-context-popup--mixed-selection");
            quickPopup.popup.classList.remove("cg-toolbar-dropdown--multi-automation");
            state.mountedPanels = [];
        }

        function setAccordionExpanded(accordion, expanded) {
            accordion.section.classList.toggle("is-open", expanded);
            accordion.toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
        }

        function collapseAllAccordions() {
            quickPopup.accordions.forEach((accordion) => setAccordionExpanded(accordion, false));
        }

        function hidePopup() {
            const wasOpen = !quickPopup.popup.hidden;
            stopDraggingPopup();
            restoreMountedPanels();
            collapseAllAccordions();
            quickPopup.popup.hidden = true;
            quickPopup.popup.setAttribute("aria-hidden", "true");
            document.body.classList.remove("cg-property-popup-open");
            state.activeObject = null;
            if (wasOpen && !quickPopup.popup.classList.contains("cg-toolbar-dropdown")) window.dispatchEvent(new CustomEvent("cg:property-popup-closed"));
        }

        function contextTargets(target) {
            return target && String(target.type || "").toLowerCase() === "activeselection"
                ? target.getObjects().slice()
                : (target ? [target] : []);
        }

        function hideObjectContextMenu(restoreToolbar) {
            if (objectContextMenu.hidden) return;
            objectContextMenu.hidden = true;
            objectContextMenu.setAttribute("aria-hidden", "true");
            contextMenuTarget = null;
            window.dispatchEvent(new CustomEvent("cg:object-context-menu-closed", { detail: { restoreToolbar: restoreToolbar !== false } }));
        }

        function showObjectContextMenu(target, event) {
            if (!target || !event) return;
            hidePopup();
            contextMenuTarget = target;
            const targetType = String(target.type || "").toLowerCase();
            const targets = contextTargets(target);
            const locked = targets.length > 0 && targets.every((object) => (
                object.lockMovementX && object.lockMovementY && object.lockScalingX
                && object.lockScalingY && object.lockRotation
            ));
            const lockControl = objectContextMenu.querySelector('[data-cg-object-command="lock"]');
            lockControl.querySelector("i").className = `fa ${locked ? "fa-unlock" : "fa-lock"}`;
            lockControl.querySelector("span").textContent = locked ? "Unlock object" : "Lock object";
            objectContextMenu.querySelector('[data-cg-object-command="group"]').hidden = targetType !== "activeselection";
            objectContextMenu.querySelector('[data-cg-object-command="ungroup"]').hidden = targetType !== "group";
            objectContextMenu.querySelector('[data-cg-object-command="export-png"]').disabled = typeof target.toDataURL !== "function";
            objectContextMenu.hidden = false;
            objectContextMenu.setAttribute("aria-hidden", "false");
            const bounds = objectContextMenu.getBoundingClientRect();
            const margin = 8;
            const left = Math.min(Math.max(margin, event.clientX), Math.max(margin, window.innerWidth - bounds.width - margin));
            const top = Math.min(Math.max(margin, event.clientY), Math.max(margin, window.innerHeight - bounds.height - margin));
            objectContextMenu.style.left = `${left}px`;
            objectContextMenu.style.top = `${top}px`;
            window.dispatchEvent(new CustomEvent("cg:object-context-menu-opened"));
            objectContextMenu.querySelector('button:not([hidden]):not(:disabled)')?.focus({ preventScroll: true });
        }

        function commitContextChange(target) {
            if (!state.activeCanvas || !target) return;
            state.activeCanvas.requestRenderAll();
            state.activeCanvas.fire("object:modified", { target });
            if (typeof window.updateCanvasState === "function") window.updateCanvasState();
        }

        function runLayerCommand(command, target) {
            const targets = contextTargets(target);
            const canvasObjects = state.activeCanvas.getObjects();
            targets.sort((first, second) => canvasObjects.indexOf(first) - canvasObjects.indexOf(second));
            if (command === "front") targets.forEach((object) => state.activeCanvas.bringObjectToFront(object));
            if (command === "forward") targets.slice().reverse().forEach((object) => state.activeCanvas.bringObjectForward(object));
            if (command === "backward") targets.forEach((object) => state.activeCanvas.sendObjectBackwards(object));
            if (command === "back") targets.slice().reverse().forEach((object) => state.activeCanvas.sendObjectToBack(object));
            commitContextChange(target);
        }

        async function exportContextTarget(target) {
            if (!target || typeof target.toDataURL !== "function") return;
            const safeName = String(target.name || target.id || "canvas-selection")
                .replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "canvas-selection";
            const response = await fetch(target.toDataURL({ format: "png", multiplier: 2, enableRetinaScaling: false }));
            const blob = await response.blob();
            if (typeof window.saveAs === "function") {
                window.saveAs(blob, `${safeName}.png`);
                return;
            }
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = objectUrl;
            link.download = `${safeName}.png`;
            link.click();
            window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        }

        function triggerSelectionCommand(command) {
            const control = document.querySelector(`.cg-selection-toolbar [data-cg-selection-action="${command}"]`);
            if (control) control.click();
        }

        function toggleContextTargetLock(target) {
            const targets = contextTargets(target);
            const shouldLock = !targets.every((object) => (
                object.lockMovementX && object.lockMovementY && object.lockScalingX
                && object.lockScalingY && object.lockRotation
            ));
            targets.forEach((object) => {
                object.set({
                    lockMovementX: shouldLock,
                    lockMovementY: shouldLock,
                    lockScalingX: shouldLock,
                    lockScalingY: shouldLock,
                    lockRotation: shouldLock,
                    editable: !shouldLock
                });
                window.applyCanvasObjectActionControls?.(object);
                object.setCoords();
            });
            commitContextChange(target);
        }

        objectContextMenu.addEventListener("mousedown", (event) => event.stopPropagation());
        objectContextMenu.addEventListener("click", async (event) => {
            const control = event.target.closest("[data-cg-object-command]");
            const target = state.activeCanvas && (state.activeCanvas.getActiveObject() || contextMenuTarget);
            if (!control || !target || control.disabled) return;
            const command = control.dataset.cgObjectCommand;
            hideObjectContextMenu(command !== "properties");
            if (command === "copy") await window.CGCopyActiveObject?.();
            else if (command === "paste") await window.CGPasteObject?.();
            else if (command === "duplicate") await window.CGDuplicateActiveObject?.();
            else if (command === "delete") window.requestDeleteSelectedObjects?.();
            else if (command === "properties") window.openObjectPropertyBar?.(target);
            else if (command === "export-png") await exportContextTarget(target);
            else if (["front", "forward", "backward", "back"].includes(command)) runLayerCommand(command, target);
            else if (command === "lock") toggleContextTargetLock(target);
            else if (command === "group" || command === "ungroup") triggerSelectionCommand(command);
        });
        objectContextMenu.addEventListener("keydown", (event) => {
            const items = Array.from(objectContextMenu.querySelectorAll('button:not([hidden]):not(:disabled)'));
            const currentIndex = items.indexOf(document.activeElement);
            if (event.key === "Escape") { event.preventDefault(); hideObjectContextMenu(true); return; }
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
            event.preventDefault();
            const offset = event.key === "ArrowDown" ? 1 : -1;
            items[(currentIndex + offset + items.length) % items.length]?.focus();
        });
        document.addEventListener("mousedown", (event) => {
            if (!objectContextMenu.hidden && !objectContextMenu.contains(event.target)) hideObjectContextMenu(true);
        });

        quickPopup.popup.addEventListener("cg:close", hidePopup);
        window.addEventListener("cg:open-image-crop", hidePopup);
        quickPopup.accordions.forEach((accordion) => accordion.toggle.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const shouldExpand = !accordion.section.classList.contains("is-open");

            /* STAMP: 2026-08-28 - The object inspector is a single-open
             * accordion. Collapsing siblings reduces height without changing
             * any mounted property controls or their existing handlers. */
            collapseAllAccordions();
            setAccordionExpanded(accordion, shouldExpand);
        }));

        function getPanelIdsForTarget(target) {
            if (!target) {
                return [];
            }

            if (String(target.type || "").toLowerCase() === "activeselection") {
                const selectedTypes = { hasShape: false };
                const scanSelectionObject = (selectedObject) => {
                    if (!selectedObject) {
                        return;
                    }

                    if (["rect", "circle", "triangle", "line"].includes(selectedObject.type)) {
                        selectedTypes.hasShape = true;
                    }

                    if (Array.isArray(selectedObject._objects)) {
                        selectedObject._objects.forEach(scanSelectionObject);
                    }
                };

                (target._objects || []).forEach(scanSelectionObject);

                const selectionPanelIds = [];
                /* STAMP: 2026-09-01 - Text editing is owned by the selection
                 * Quick Action Bar. Do not mount its single live control tree
                 * in the Property popup (including mixed selections). */
                if (selectedTypes.hasShape) {
                    /* Shape properties are owned by the Quick Action Bar. */
                }

                /* STAMP: 2026-09-11 - Multi-selection Animation and Actions
                 * reuse the live automation panel. fabric-main renders one
                 * compact row per selected object inside the existing hosts. */
                selectionPanelIds.push("ObjectAutomationSettings");
                return selectionPanelIds;
            }

            switch (target.type) {
                case "textbox":
                case "i-text":
                case "text":
                    return ["ObjectAutomationSettings"];
                case "image":
                    return ["ObjectAutomationSettings"];
                case "group":
                    return ["ObjectAutomationSettings"];
                case "rect":
                case "circle":
                case "triangle":
                case "line":
                default:
                    return ["ObjectAutomationSettings"];
            }
        }

        function mountPanelsForTarget(target) {
            const panelIds = getPanelIdsForTarget(target);
            const isMultiSelection = target && String(target.type || "").toLowerCase() === "activeselection";
            const targetHost = isMultiSelection ? quickPopup.selectionPanelHost : quickPopup.panelHost;
            const hasTextProperties = panelIds.includes("TextSettingsarea");
            const hasPropertyPanel = panelIds.some((panelId) => panelId !== "ObjectAutomationSettings");

            restoreMountedPanels();
            /* STAMP: 2026-09-01 - Text objects have no Property accordion.
             * Their complete live control set is in the Quick Action Bar. */
            quickPopup.propertyAccordion.section.hidden = !hasPropertyPanel;
            quickPopup.effectsAccordion.section.hidden = !hasTextProperties;

            if (!panelIds.length) {
                return;
            }

            panelIds.forEach((panelId) => {
                const panel = document.getElementById(panelId);
                if (!panel || !panel.parentNode) {
                    return;
                }

                if (panelId === "ObjectAutomationSettings") {
                    [
                        { selector: '[data-object-automation-panel="animation"]', host: quickPopup.animationHost },
                        { selector: '[data-object-automation-panel="action"]', host: quickPopup.actionHost }
                    ].forEach((automationMount) => {
                        const automationPanel = panel.querySelector(automationMount.selector);
                        if (!automationPanel || !automationPanel.parentNode) return;
                        state.mountedPanels.push({
                            panel: automationPanel,
                            parent: automationPanel.parentNode,
                            nextSibling: automationPanel.nextSibling,
                            display: automationPanel.style.display,
                            hidden: automationPanel.hasAttribute("hidden")
                        });
                        automationMount.host.appendChild(automationPanel);
                        automationPanel.style.display = "grid";
                        automationPanel.removeAttribute("hidden");
                    });
                    return;
                }

                state.mountedPanels.push({
                    panel,
                    parent: panel.parentNode,
                    nextSibling: panel.nextSibling,
                    display: panel.style.display,
                    hidden: panel.hasAttribute("hidden")
                });
                targetHost.appendChild(panel);
                panel.style.display = "block";

                /* STAMP: 2026-08-26 - Text effects have their own inspector
                 * accordion. Move the established controls instead of cloning
                 * them so every existing effect handler and object state stays
                 * authoritative. */
                if (panelId === "TextSettingsarea") {
                    const textEffectControls = [
                        panel.querySelector('.cg-effect-presets[aria-label="Text effects"]'),
                        panel.querySelector("#TextHighlight")?.closest(".cg-text-swatch-card"),
                        panel.querySelector("#TextAppliedEffects")
                    ].filter(Boolean);
                    textEffectControls.forEach((effectControl) => {
                        state.mountedPanels.push({
                            panel: effectControl,
                            parent: effectControl.parentNode,
                            nextSibling: effectControl.nextSibling,
                            display: effectControl.style.display,
                            hidden: effectControl.hasAttribute("hidden")
                        });
                        quickPopup.effectsHost.appendChild(effectControl);
                        effectControl.style.display = "block";
                        effectControl.removeAttribute("hidden");
                    });
                }
            });

            /* STAMP: 2026-08-18 - Offer a single editable text/list result only
             * when every object in a multi-selection is a text object. */
            const selectedObjects = isMultiSelection ? (target._objects || []) : [];
            const selectedTextObjects = [];
            const collectSelectedText = (item) => {
                if (!item) return;
                if (["text", "textbox", "i-text"].includes(item.type) || typeof item.text === "string") {
                    selectedTextObjects.push(item);
                    return;
                }
                (item._objects || []).forEach(collectSelectedText);
            };
            selectedObjects.forEach(collectSelectedText);
            if (isMultiSelection) {
                const combinePanel = createElement("section", "cg-selection-combine");
                combinePanel.innerHTML = `
                    <div class="cg-selection-combine__heading">
                        <div><strong>Combine text</strong><span>${selectedTextObjects.length || selectedObjects.length} selected objects</span></div>
                    </div>
                    <label class="cg-selection-combine__toggle">
                        <input type="checkbox" data-cg-combine-list>
                        <span>Make this a list</span>
                    </label>
                    <div class="cg-selection-combine__list-options" data-cg-combine-list-options hidden>
                        <span class="cg-selection-combine__label">Marker style</span>
                        <div class="cg-selection-combine__markers" role="radiogroup" aria-label="List marker style">
                            <label><input type="radio" name="cgCombineMarker" value="numbered" checked><span>1.</span><small>Numbered</small></label>
                            <label><input type="radio" name="cgCombineMarker" value="round"><span>•</span><small>Round</small></label>
                            <label><input type="radio" name="cgCombineMarker" value="square"><span>▪</span><small>Square</small></label>
                            <label><input type="radio" name="cgCombineMarker" value="alpha"><span>A.</span><small>Letters</small></label>
                            <label><input type="radio" name="cgCombineMarker" value="dash"><span>–</span><small>Dash</small></label>
                            <label><input type="radio" name="cgCombineMarker" value="arrow"><span>›</span><small>Arrow</small></label>
                            <label><input type="radio" name="cgCombineMarker" value="check"><span>✓</span><small>Check</small></label>
                            <label><input type="radio" name="cgCombineMarker" value="diamond"><span>◆</span><small>Diamond</small></label>
                            <label><input type="radio" name="cgCombineMarker" value="hollow-round"><span>○</span><small>Round outline</small></label>
                            <label><input type="radio" name="cgCombineMarker" value="hollow-square"><span>□</span><small>Square outline</small></label>
                            <label><input type="radio" name="cgCombineMarker" value="triangle"><span>▶</span><small>Triangle</small></label>
                            <label><input type="radio" name="cgCombineMarker" value="chevron"><span>❯</span><small>Chevron</small></label>
                            <label><input type="radio" name="cgCombineMarker" value="double-arrow"><span>⇒</span><small>Double arrow</small></label>
                            <label><input type="radio" name="cgCombineMarker" value="star"><span>★</span><small>Star</small></label>
                        </div>
                        <label class="cg-selection-combine__marker-width">
                            <span>Marker width</span>
                            <input type="range" min="50" max="200" step="10" value="100" data-cg-marker-width>
                            <output data-cg-marker-width-value>100%</output>
                        </label>
                    </div>
                    <button type="button" class="cg-selection-combine__apply" data-cg-combine-apply>Combine into one text object</button>`;
                targetHost.prepend(combinePanel);
            }

            if (!state.mountedPanels.length) {
                return;
            }

            quickPopup.popup.classList.add("cg-context-popup--expanded");
            quickPopup.popup.classList.toggle(
                "cg-context-popup--text-layout",
                panelIds.includes("TextSettingsarea")
            );
            quickPopup.popup.classList.toggle("cg-context-popup--mixed-selection", isMultiSelection);

            /* Selection properties stamped 2026-08-12:
             * A right-clicked multi-selection must reveal its detected Font and
             * Shape properties immediately inside Quick controls. */
            if (isMultiSelection) {
                setAccordionExpanded(quickPopup.accordions[1], true);
            } else if (target && target.type === "image") {
                setAccordionExpanded(quickPopup.accordions[0], true);
            }
        }

        quickPopup.popup.addEventListener("change", (event) => {
            if (!event.target.matches("[data-cg-combine-list]")) return;
            const panel = event.target.closest(".cg-selection-combine");
            const options = panel && panel.querySelector("[data-cg-combine-list-options]");
            const button = panel && panel.querySelector("[data-cg-combine-apply]");
            if (options) options.hidden = !event.target.checked;
            if (button) button.textContent = event.target.checked ? "Combine into one list" : "Combine into one text object";
        });

        quickPopup.popup.addEventListener("input", (event) => {
            if (!event.target.matches("[data-cg-marker-width]")) return;
            const panel = event.target.closest(".cg-selection-combine");
            const output = panel && panel.querySelector("[data-cg-marker-width-value]");
            if (output) output.textContent = `${event.target.value}%`;
        });

        quickPopup.popup.addEventListener("click", (event) => {
            const button = event.target.closest("[data-cg-combine-apply]");
            if (!button) return;
            const panel = button.closest(".cg-selection-combine");
            const listToggle = panel.querySelector("[data-cg-combine-list]");
            const marker = panel.querySelector('input[name="cgCombineMarker"]:checked');
            const markerWidth = panel.querySelector("[data-cg-marker-width]");
            if (typeof window.combineSelectedTextObjects === "function" && window.combineSelectedTextObjects({
                asList: Boolean(listToggle && listToggle.checked),
                markerStyle: marker ? marker.value : "numbered",
                markerScale: markerWidth ? Number(markerWidth.value) / 100 : 1
            })) {
                hidePopup();
            }
        });

        function syncObjectFields(target) {
            if (!target) {
                return;
            }

            state.syncing = true;
            quickPopup.title.textContent = getFriendlyObjectType(target);
            quickPopup.subtitle.textContent = target.name ? target.name : "Quick controls";
            quickPopup.nameInput.value = target.name || "";
            quickPopup.xInput.value = Math.round(Number(target.left || 0));
            quickPopup.yInput.value = Math.round(Number(target.top || 0));
            quickPopup.opacityInput.value = String(Math.round(Number((target.opacity == null ? 1 : target.opacity) * 100)));
            quickPopup.opacityValue.textContent = `${quickPopup.opacityInput.value}%`;
            quickPopup.imageTransformSection.hidden = target.type !== "image";
            const isLocked = Boolean(
                target.lockMovementX &&
                target.lockMovementY &&
                target.lockScalingX &&
                target.lockScalingY &&
                target.lockRotation
            );
            quickPopup.lockInput.checked = isLocked;
            quickPopup.xInput.disabled = isLocked;
            quickPopup.yInput.disabled = isLocked;
            [quickPopup.rotateLeftButton, quickPopup.rotateRightButton,
                quickPopup.flipHorizontalButton, quickPopup.flipVerticalButton]
                .forEach((control) => { control.disabled = isLocked; });
            state.syncing = false;
        }

        function commitObjectChange() {
            if (!state.activeCanvas || !state.activeObject) {
                return;
            }

            state.activeObject.setCoords();
            state.activeCanvas.requestRenderAll();
            state.activeCanvas.fire("object:modified", { target: state.activeObject });
        }

        function updateObjectPreview() {
            if (!state.activeCanvas || !state.activeObject) {
                return;
            }

            state.activeObject.setCoords();
            state.activeCanvas.requestRenderAll();
        }

        function rotateActiveObject(angleOffset) {
            if (!state.activeObject || state.activeObject.type !== "image" || isCanvasObjectLocked(state.activeObject)) {
                return;
            }

            let resetOrigin = false;
            let angle = Number(state.activeObject.get("angle") || 0) + angleOffset;

            if ((state.activeObject.originX !== "center" || state.activeObject.originY !== "center") && state.activeObject.centeredRotation) {
                state.activeObject.setOriginToCenter && state.activeObject.setOriginToCenter();
                resetOrigin = true;
            }

            angle = angle % 360;
            if (angle < 0) {
                angle += 360;
            }

            state.activeObject.set("angle", angle).setCoords();

            if (resetOrigin) {
                state.activeObject.setCenterToOrigin && state.activeObject.setCenterToOrigin();
            }

            syncObjectFields(state.activeObject);
            updateObjectPreview();
            commitObjectChange();
        }

        function flipActiveObject(axis) {
            if (!state.activeObject || state.activeObject.type !== "image" || isCanvasObjectLocked(state.activeObject)) {
                return;
            }

            if (axis === "x") {
                state.activeObject.set("flipX", !state.activeObject.flipX);
            } else if (axis === "y") {
                state.activeObject.set("flipY", !state.activeObject.flipY);
            }

            syncObjectFields(state.activeObject);
            updateObjectPreview();
            commitObjectChange();
        }

        function placePopupFromEvent(event) {
            const nextPosition = clampPopupPosition(event.clientX + 12, event.clientY + 12);
            quickPopup.popup.style.left = `${nextPosition.left}px`;
            quickPopup.popup.style.top = `${nextPosition.top}px`;
        }

        function stopDraggingPopup() {
            if (state.dragPointerId == null) {
                return;
            }

            state.dragPointerId = null;
            quickPopup.popup.classList.remove("cg-context-popup--dragging");
            document.body.style.userSelect = "";
        }

        function dragPopup(event) {
            if (state.dragPointerId == null) {
                return;
            }

            const nextPosition = clampPopupPosition(
                event.clientX - state.dragOffsetX,
                event.clientY - state.dragOffsetY
            );

            quickPopup.popup.style.left = `${nextPosition.left}px`;
            quickPopup.popup.style.top = `${nextPosition.top}px`;
        }

        quickPopup.header.addEventListener("mousedown", (event) => {
            if (event.button !== 0 || event.target.closest("button")) {
                return;
            }

            const popupRect = quickPopup.popup.getBoundingClientRect();
            // STAMP: 2026-09-07 - Retain manual placement until reopened.
            dropdownManuallyPlaced = true;
            state.dragPointerId = event.button;
            state.dragOffsetX = event.clientX - popupRect.left;
            state.dragOffsetY = event.clientY - popupRect.top;
            quickPopup.popup.classList.add("cg-context-popup--dragging");
            document.body.style.userSelect = "none";
            event.preventDefault();
        });

        window.addEventListener("mousemove", (event) => {
            dragPopup(event);
        });

        window.addEventListener("mouseup", () => {
            stopDraggingPopup();
        });

        quickPopup.nameInput.addEventListener("change", () => {
            if (state.syncing || !state.activeObject) {
                return;
            }

            state.activeObject.set("name", quickPopup.nameInput.value.trim());
            syncObjectFields(state.activeObject);
            commitObjectChange();
        });

        quickPopup.xInput.addEventListener("change", () => {
            if (state.syncing || !state.activeObject || isCanvasObjectLocked(state.activeObject)) {
                return;
            }

            state.activeObject.set("left", Number(quickPopup.xInput.value || 0));
            updateObjectPreview();
            commitObjectChange();
        });

        quickPopup.yInput.addEventListener("change", () => {
            if (state.syncing || !state.activeObject || isCanvasObjectLocked(state.activeObject)) {
                return;
            }

            state.activeObject.set("top", Number(quickPopup.yInput.value || 0));
            updateObjectPreview();
            commitObjectChange();
        });

        quickPopup.opacityInput.addEventListener("input", () => {
            if (state.syncing || !state.activeObject) {
                return;
            }

            quickPopup.opacityValue.textContent = `${quickPopup.opacityInput.value}%`;
            state.activeObject.set("opacity", Number(quickPopup.opacityInput.value) / 100);
            updateObjectPreview();
        });

        quickPopup.opacityInput.addEventListener("change", () => {
            if (state.syncing || !state.activeObject) {
                return;
            }

            commitObjectChange();
        });

        quickPopup.lockInput.addEventListener("change", () => {
            if (state.syncing || !state.activeObject) {
                return;
            }

            const isLocked = quickPopup.lockInput.checked;
            state.activeObject.set({
                lockMovementX: isLocked,
                lockMovementY: isLocked,
                lockScalingX: isLocked,
                lockScalingY: isLocked,
                lockRotation: isLocked,
                editable: !isLocked
            });
            commitObjectChange();
        });

        /* STAMP: 2026-08-31 - Reuse the established image replacement picker
         * from the image-only right-click Quick controls. This keeps the native
         * Fabric object ID, name, size policy, optimization, and history flow. */
        quickPopup.replaceImageButton.addEventListener("click", () => {
            if (!state.activeObject || state.activeObject.type !== "image") return;
            const existingReplaceAction = document.getElementById("btnchangeimagepopup");
            if (existingReplaceAction) existingReplaceAction.click();
        });

        quickPopup.rotateLeftButton.addEventListener("click", () => {
            rotateActiveObject(-90);
        });

        quickPopup.rotateRightButton.addEventListener("click", () => {
            rotateActiveObject(90);
        });

        quickPopup.flipHorizontalButton.addEventListener("click", () => {
            flipActiveObject("x");
        });

        quickPopup.flipVerticalButton.addEventListener("click", () => {
            flipActiveObject("y");
        });

        /**
         * STAMP: 2026-08-18 - Open the established type-aware object property
         * popup from a Fabric corner control, using the same panel mounting and
         * update handlers as the existing right-click workflow.
         */
        /* STAMP: 2026-09-07 - Reuse live controls in toolbar dropdowns,
         * preserving their IDs, handlers and mount/restore lifecycle. */
        let dropdownSection = null;
        let dropdownAnchor = null;
        let dropdownManuallyPlaced = false;

        /** STAMP: 2026-09-07 - Keep automatic placement clear of the whole toolbar.
         * Fit beside it, or constrain the panel above/below with scrolling.
         * Manual placement remains stable during content changes and scrolling.
         */
        function positionToolbarDropdown() {
            if (quickPopup.popup.hidden || !dropdownAnchor || state.dragPointerId != null) return;
            const popup = quickPopup.popup;
            if (dropdownManuallyPlaced) {
                const current = popup.getBoundingClientRect();
                const next = clampPopupPosition(current.left, current.top);
                popup.style.left = next.left + "px";
                popup.style.top = next.top + "px";
                return;
            }
            const anchor = dropdownAnchor.isConnected ? dropdownAnchor : document.querySelector(".cg-selection-toolbar");
            if (!anchor) { hidePopup(); return; }
            const bounds = (anchor.closest(".cg-selection-toolbar") || anchor).getBoundingClientRect();
            const margin = 14, gap = 10;
            const width = popup.getBoundingClientRect().width;
            const above = Math.max(0, bounds.top - gap - margin);
            const below = Math.max(0, window.innerHeight - bounds.bottom - gap - margin);
            let left = bounds.left, top;
            let availableHeight = window.innerHeight - margin * 2;
            if (window.innerWidth - bounds.right - gap - margin >= width) {
                left = bounds.right + gap;
                top = bounds.top;
            } else if (bounds.left - gap - margin >= width) {
                left = bounds.left - gap - width;
                top = bounds.top;
            } else {
                const useBelow = below >= above;
                availableHeight = useBelow ? below : above;
                popup.style.setProperty("--cg-dropdown-available-height", availableHeight + "px");
                top = useBelow ? bounds.bottom + gap : bounds.top - gap - popup.getBoundingClientRect().height;
            }
            popup.style.setProperty("--cg-dropdown-available-height", availableHeight + "px");
            const next = clampPopupPosition(left, top);
            popup.style.left = next.left + "px";
            popup.style.top = next.top + "px";
        }
        // Keep placement correct when action fields or thumbnail images resize.
        if (typeof ResizeObserver !== "undefined") {
            new ResizeObserver(positionToolbarDropdown).observe(quickPopup.popup);
        }
        window.openQuickActionDropdown = function (target, section, anchor) {
            if (!target || !state.activeCanvas) return false;
            if (section === "animation"
                && typeof window.isCurrentSlideAnimationDisabled === "function"
                && window.isCurrentSlideAnimationDisabled()) {
                hidePopup();
                return false;
            }
            if (!quickPopup.popup.hidden && dropdownSection === section && state.activeObject === target) {
                hidePopup(); return true;
            }
            hidePopup();
            state.activeObject = target;
            dropdownSection = section;
            dropdownAnchor = anchor;
            dropdownManuallyPlaced = false;
            quickPopup.header.title = "Drag to move";
            quickPopup.popup.style.removeProperty("--cg-dropdown-available-height");
            quickPopup.popup.classList.add("cg-toolbar-dropdown");
            quickPopup.popup.classList.toggle(
                "cg-toolbar-dropdown--multi-automation",
                String(target.type || "").toLowerCase() === "activeselection"
                    && (section === "animation" || section === "actions")
            );
            quickPopup.popup.hidden = false;
            quickPopup.popup.setAttribute("aria-hidden", "false");
            syncObjectFields(target);
            mountPanelsForTarget(target);
            // STAMP: 2026-09-07 - Reopen with the persisted animation selected.
            if ((section === "animation" || section === "actions")
                && typeof window.syncSelectedObjectAutomationPanel === "function") {
                window.syncSelectedObjectAutomationPanel();
            }
            collapseAllAccordions();
            const selected = section === "animation" ? 3 : section === "actions" ? 4 : 0;
            quickPopup.accordions.forEach((accordion, index) => {
                accordion.section.hidden = index !== selected;
                setAccordionExpanded(accordion, index === selected);
            });
            quickPopup.title.textContent = section === "animation" ? "Animation" : section === "actions" ? "Actions" : "Quick controls";
            positionToolbarDropdown();
            window.requestAnimationFrame(positionToolbarDropdown);
            return true;
        };
        // Legacy corner/More entry points now use the toolbar dropdown too.
        window.openObjectPropertyBar = function (target) {
            return window.openQuickActionDropdown(target, "quick", document.querySelector(".cg-selection-toolbar"));
        };
        document.addEventListener("mousedown", (event) => {
            if (!quickPopup.popup.hidden && !quickPopup.popup.contains(event.target) &&
                !event.target.closest(".cg-selection-toolbar, #colorPickerPopup, #cgObjectPreviewDialog, .modal, .select2-container")) hidePopup();
        });
        document.addEventListener("keydown", (event) => {
            // STAMP: 2026-09-07 - Dismiss the preview before its parent dropdown.
            if (event.key === "Escape" && !quickPopup.popup.hidden &&
                !document.body.classList.contains("cg-object-preview-open")) hidePopup();
        });
        window.addEventListener("blur", stopDraggingPopup);
        window.addEventListener("resize", positionToolbarDropdown);
        window.addEventListener("scroll", positionToolbarDropdown, true);
        window.addEventListener("cg:slide-navigation-start", hidePopup);
        window.addEventListener("cg:close-quick-dropdown", hidePopup);

        function bindCanvas() {
            if (state.activeCanvas || typeof canvas === "undefined" || !canvas || typeof canvas.on !== "function") {
                return Boolean(state.activeCanvas);
            }

            state.activeCanvas = canvas;
            state.activeCanvas.fireRightClick = true;
            state.activeCanvas.stopContextMenu = true;

            const canvasElement = state.activeCanvas.upperCanvasEl || state.activeCanvas.lowerCanvasEl;

            if (canvasElement) {
                canvasElement.addEventListener("contextmenu", (event) => {
                    event.preventDefault();
                });
            }

            state.activeCanvas.on("mouse:down", (opt) => {
                const event = opt && opt.e;
                const isRightClick = event && (event.button === 2 || event.which === 3);

                if (!opt.target) {
                    if (!quickPopup.popup.hidden) {
                        hidePopup();
                    }

                    if (isRightClick && event) {
                        event.preventDefault();
                        event.stopPropagation();
                    }

                    return;
                }

                if (!isRightClick) {
                    if (!quickPopup.popup.hidden) {
                        hidePopup();
                    }

                    return;
                }

                event.preventDefault();
                event.stopPropagation();
                // STAMP: 2026-09-12 - Select first, then show the shared compact command menu.
                hidePopup();
                state.activeCanvas.setActiveObject(opt.target);
                state.activeCanvas.requestRenderAll();
                if (String(opt.target.type || "").toLowerCase() !== "fabric-table") {
                    showObjectContextMenu(opt.target, event);
                }
            });

            /* Preserve the table widget's cell-specific context menu. */
            state.activeCanvas.on("contextmenu", (opt) => {
                if (opt && opt.target && String(opt.target.type || "").toLowerCase() === "fabric-table") {
                    hideObjectContextMenu(false);
                }
            });

            state.activeCanvas.on("selection:updated", hidePopup);

            state.activeCanvas.on("selection:cleared", hidePopup);

            state.activeCanvas.on("object:modified", () => {
                if (!quickPopup.popup.hidden && state.activeCanvas.getActiveObject()) {
                    state.activeObject = state.activeCanvas.getActiveObject();
                    syncObjectFields(state.activeObject);
                    positionToolbarDropdown();
                }
            });

            return true;
        }

        let attempts = 0;

        function waitForCanvas() {
            if (bindCanvas()) {
                return;
            }

            attempts += 1;

            if (attempts < 120) {
                window.setTimeout(waitForCanvas, 150);
            }
        }

        waitForCanvas();
    }

    /* STAMP: 2026-08-25 - Figma-style contextual selection toolbar. It is
     * independent from right-click properties and never changes canvas layout.
     * STAMP: 2026-08-26 - Add state-aware Group/Ungroup plus universal Lock,
     * Share Properties, Interactions, Motion, Alignment, Order, Transparency,
     * and Shadow controls while reusing established Fabric handlers and the
     * saved-content flow. */
    function initSelectionToolbar(canvasContainer) {
        const bar = createElement("div", "cg-selection-toolbar");
        /* STAMP: 2026-09-01 - This is the existing Text Properties control
         * tree, not a copy. Mounting it in the Quick Action Bar preserves all
         * established IDs, listeners, Fabric updates, and selection syncing. */
        let textSettingsPanel = document.getElementById("TextSettingsarea");
        const textPrimaryHost = createElement("div", "cg-selection-text-primary");
        const textMorePopover = createElement("div", "cg-selection-quick-popover cg-selection-text-more-popover");
        // STAMP: 2026-09-09 - Custom font menu enables reversible canvas previews; native option hover cannot.
        const fontPopover = createElement("div", "cg-selection-quick-popover cg-selection-font-popover");
        fontPopover.setAttribute("role", "listbox");
        fontPopover.setAttribute("aria-label", "Font family");
        fontPopover.innerHTML = '<div class="cg-selection-font-popover__header"><span>Font family</span><small>Hover to preview</small></div><div class="cg-selection-font-popover__list" data-cg-font-list></div>';
        const textSizePopover = createElement("div", "cg-selection-quick-popover cg-selection-text-size-popover");
        textSizePopover.innerHTML = '<div class="cg-selection-quick-popover__header"><span>Font Size</span></div><div data-cg-text-size-host></div><button type="button" class="cg-selection-text-size-reset" data-cg-text-size-reset><i class="fa fa-undo" aria-hidden="true"></i> Reset</button>';
        /* STAMP: 2026-09-12 - Compact H1-H6 presets for existing Fabric text.
         * Empty text receives a useful heading label; authored text is retained. */
        const headingPopover = createElement("div", "cg-selection-quick-popover cg-selection-heading-popover");
        headingPopover.setAttribute("role", "menu");
        headingPopover.setAttribute("aria-label", "Heading styles");
        headingPopover.innerHTML = '<div class="cg-selection-quick-popover__header"><span>Heading</span></div><div class="cg-selection-heading-popover__list">'
            + [64, 52, 44, 36, 28, 22].map((size, index) => `<button type="button" role="menuitem" data-cg-heading-level="${index + 1}" data-cg-heading-size="${size}"><b>H${index + 1}</b><span>Heading ${index + 1}</span><small>${size}px</small></button>`).join("")
            + '</div>';
        const textAlignmentPopover = createElement("div", "cg-selection-quick-popover cg-selection-text-alignment-popover");
        textAlignmentPopover.innerHTML = '<div class="cg-selection-quick-popover__header"><span>Alignment</span></div><div class="cg-selection-alignment-popover__actions">'
            + '<button type="button" data-cg-text-align="left" title="Align Left"><i class="fa fa-align-left" aria-hidden="true"></i></button>'
            + '<button type="button" data-cg-text-align="center" title="Align Center"><i class="fa fa-align-center" aria-hidden="true"></i></button>'
            + '<button type="button" data-cg-text-align="right" title="Align Right"><i class="fa fa-align-right" aria-hidden="true"></i></button>'
            + '<button type="button" data-cg-text-align="justify" title="Justify"><i class="fa fa-align-justify" aria-hidden="true"></i></button></div>';
        /**
         * STAMP: 2026-09-10 - Consolidate Back/Stroke colour and inline text
         * styles into compact, keyboard-accessible Quick Action popovers. The
         * established colour sources and Fabric text mutations remain the
         * authoritative update paths.
         */
        const colorPopover = createElement("div", "cg-selection-quick-popover cg-selection-color-popover");
        colorPopover.innerHTML = '<div class="cg-selection-quick-popover__header"><span>Colour</span><button type="button" class="cg-selection-quick-popover__close" data-cg-quick-close aria-label="Close colour options"><i class="fa fa-times" aria-hidden="true"></i></button></div>'
            + '<div class="cg-selection-color-popover__tabs" role="tablist" aria-label="Colour type">'
            + '<button type="button" class="is-active" role="tab" aria-selected="true" data-cg-color-tab="back">Back</button>'
            + '<button type="button" role="tab" aria-selected="false" data-cg-color-tab="stroke">Stroke</button></div>'
            + '<button type="button" class="cg-selection-color-popover__choose" data-cg-color-choose>'
            + '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" data-cg-color-preview></rect></svg>'
            + '<span><b data-cg-color-label>Back colour</b><small data-cg-color-value>#000000</small></span><i class="fa fa-angle-right" aria-hidden="true"></i></button>';
        const textStylePopover = createElement("div", "cg-selection-quick-popover cg-selection-text-style-popover");
        textStylePopover.innerHTML = '<div class="cg-selection-quick-popover__header"><span>Text style</span><button type="button" class="cg-selection-quick-popover__close" data-cg-quick-close aria-label="Close text styles"><i class="fa fa-times" aria-hidden="true"></i></button></div>'
            + '<label class="cg-selection-text-style-popover__weight"><span>Font Weight</span><select data-cg-font-weight aria-label="Font weight">'
            + '<option value="100">100 - Thin</option><option value="200">200 - Extra Light</option><option value="300">300 - Light</option>'
            + '<option value="400">400 - Regular</option><option value="500">500 - Medium</option><option value="600">600 - Semi Bold</option>'
            + '<option value="700">700 - Bold</option><option value="800">800 - Extra Bold</option><option value="900">900 - Black</option></select></label>'
            + '<div class="cg-selection-text-style-popover__actions">'
            + '<button type="button" data-cg-text-style="bold" aria-pressed="false"><i class="fa fa-bold" aria-hidden="true"></i><span>Bold</span></button>'
            + '<button type="button" data-cg-text-style="italic" aria-pressed="false"><i class="fa fa-italic" aria-hidden="true"></i><span>Italic</span></button>'
            + '<button type="button" data-cg-text-style="underline" aria-pressed="false"><i class="fa fa-underline" aria-hidden="true"></i><span>Underline</span></button>'
            + '<button type="button" data-cg-text-style="strike" aria-pressed="false"><i class="fa fa-strikethrough" aria-hidden="true"></i><span>Strike</span></button></div>';
        /* STAMP: 2026-09-01 - Move the single live Shape Properties panel to
         * Quick Actions so its existing Fabric handlers remain authoritative. */
        const shapeMorePopover = createElement("div", "cg-selection-quick-popover cg-selection-shape-more-popover");
        const shapeSettingsPanel = document.getElementById("ShapeSettingsarea");
        if (shapeSettingsPanel) shapeMorePopover.appendChild(shapeSettingsPanel);
        // STAMP: 2026-09-05 - Shape radius now lives under stroke width in the palette.
        /* STAMP: 2026-09-01 - Image and Group follow the same single-owner
         * Quick Action model as Text and Shape. Move, never clone, panels. */
        const imageMorePopover = createElement("div", "cg-selection-quick-popover cg-selection-object-more-popover cg-selection-image-more-popover");
        const imageSettingsPanel = document.getElementById("ImageSettingsarea");
        if (imageSettingsPanel) imageMorePopover.appendChild(imageSettingsPanel);
        const imageScalePopover = createElement("div", "cg-selection-quick-popover cg-selection-image-scale-popover");
        imageScalePopover.innerHTML = '<div class="cg-selection-quick-popover__header"><span>Image Scale</span><output data-cg-image-scale-value></output></div><div data-cg-image-scale-host></div>';
        const imageScaleControl = document.getElementById("imagewidth");
        if (imageScaleControl) imageScalePopover.querySelector("[data-cg-image-scale-host]").appendChild(imageScaleControl);
        const groupMorePopover = createElement("div", "cg-selection-quick-popover cg-selection-object-more-popover cg-selection-group-more-popover");
        const groupSettingsPanel = document.getElementById("GroupSettingsarea");
        if (groupSettingsPanel) groupMorePopover.appendChild(groupSettingsPanel);
        /**
         * STAMP: 2026-09-14 - One shared overflow keeps low-frequency object
         * commands available without stretching the contextual toolbar across
         * the canvas. The menu proxies the original toolbar buttons so their
         * established handlers and persistence paths remain authoritative.
         */
        const moreActionsPopover = createElement("div", "cg-selection-quick-popover cg-selection-more-actions-popover");
        moreActionsPopover.setAttribute("role", "menu");
        moreActionsPopover.setAttribute("aria-label", "More actions");
        moreActionsPopover.innerHTML = '<div class="cg-selection-quick-popover__header"><span>More actions</span><button type="button" class="cg-selection-quick-popover__close" data-cg-more-close aria-label="Close more actions"><i class="fa fa-times" aria-hidden="true"></i></button></div><div class="cg-selection-more-actions-popover__sections" data-cg-more-sections></div>';
        const mountTextControls = () => {
            textSettingsPanel = textSettingsPanel || document.getElementById("TextSettingsarea");
            if (!textSettingsPanel || textPrimaryHost.children.length || textMorePopover.children.length) return;
            const settingsGrid = textSettingsPanel.querySelector(".cg-text-settings");
            Array.from(settingsGrid?.children || []).forEach((control) => {
                const isFontSize = Boolean(control.querySelector("#fontsize"));
                const isPrimary = control.classList.contains("cg-text-font-picker")
                    || control.classList.contains("cg-text-color-grid")
                    || control.classList.contains("cg-text-toolbar-card");
                const destination = isFontSize
                    ? textSizePopover.querySelector("[data-cg-text-size-host]")
                    : (isPrimary ? textPrimaryHost : textMorePopover);
                destination.appendChild(control);
            });
            textSettingsPanel.appendChild(textPrimaryHost);
        };
        mountTextControls();
        textMorePopover.hidden = true;
        fontPopover.hidden = true;
        textSizePopover.hidden = true;
        headingPopover.hidden = true;
        textAlignmentPopover.hidden = true;
        colorPopover.hidden = true;
        textStylePopover.hidden = true;
        shapeMorePopover.hidden = true;
        imageMorePopover.hidden = true;
        groupMorePopover.hidden = true;
        imageScalePopover.hidden = true;
        moreActionsPopover.hidden = true;
        /* STAMP: 2026-09-05 - Resize shapes proportionally through the shared
           slider popover, preserving the center and one history entry per gesture. */
        const shapeSizePopover = createElement("div", "cg-selection-quick-popover");
        shapeSizePopover.id = "cgShapeSizePopover";
        shapeSizePopover.hidden = true;
        shapeSizePopover.innerHTML = '<div class="cg-selection-quick-popover__header"><span>Size</span><output data-cg-shape-size-value>100%</output><button type="button" class="btn-close btn-close-white" data-cg-shape-size-close aria-label="Close size"></button></div>'
            + '<input type="range" min="1" max="500" step="1" value="100" data-cg-shape-size aria-label="Shape size">';
        let shapeSizeTarget = null;
        let shapeSizeRatio = 1;
        const opacityPopover = createElement("div", "cg-selection-quick-popover");
        const linkPopover = createElement("div", "cg-selection-quick-popover cg-selection-link-popover");
        const orderPopover = createElement("div", "cg-selection-quick-popover cg-selection-order-popover");
        const alignmentPopover = createElement("div", "cg-selection-quick-popover cg-selection-alignment-popover");
        const shadowPopover = createElement("div", "cg-selection-quick-popover cg-selection-shadow-popover");
        const cropPopover = createElement("div", "cg-selection-quick-popover cg-selection-crop-popover");
        const interactionPopover = createElement("div", "cg-selection-quick-popover cg-selection-source-popover");
        const motionPopover = createElement("div", "cg-selection-quick-popover cg-selection-source-popover");
        const shadowPanel = document.querySelector("#cgTopShadowControl .cg-shadow-dropdown__panel");
        const interactionMenu = document.querySelector("#cgTopInteractionControl .dropdown-menu");
        const motionMenu = document.querySelector("#cgTopMotionControl .dropdown-menu");
        const legacyControlStorage = createElement("div", "cg-legacy-quick-action-sources");
        bar.hidden = true;
        bar.setAttribute("role", "toolbar");
        bar.setAttribute("aria-label", "Selected object quick controls");
        opacityPopover.hidden = true;
        opacityPopover.innerHTML = '<div class="cg-selection-quick-popover__header"><span>Transparency</span><output data-cg-selection-opacity-value>0%</output></div>'
            + '<input type="range" min="0" max="1" step="0.05" value="1" data-cg-selection-opacity aria-label="Transparency">';
        linkPopover.hidden = true;
        linkPopover.innerHTML = '<form data-cg-link-form novalidate>'
            + '<div class="cg-selection-quick-popover__header"><span>Hyperlink</span><small data-cg-link-scope>Whole text</small></div>'
            + '<label class="cg-selection-link-popover__field" for="cgSelectionLinkUrl"><span>URL <strong aria-hidden="true">*</strong></span>'
            + '<input id="cgSelectionLinkUrl" type="url" inputmode="url" autocomplete="url" placeholder="https://example.com" required data-cg-link-url></label>'
            + '<p class="cg-selection-link-popover__error" data-cg-link-error role="alert" aria-live="polite"></p>'
            + '<label class="cg-selection-link-popover__toggle"><span>Open in new tab</span><input type="checkbox" checked data-cg-link-new-tab><i aria-hidden="true"></i></label>'
            + '<label class="cg-selection-link-popover__toggle"><span>Follow link</span><input type="checkbox" checked data-cg-link-follow><i aria-hidden="true"></i></label>'
            + '<div class="cg-selection-link-popover__actions"><button type="button" data-cg-link-cancel>Cancel</button><button type="submit">Save link</button></div>'
            + '</form>';
        orderPopover.hidden = true;
        orderPopover.innerHTML = '<div class="cg-selection-quick-popover__header"><span>Order</span></div><div class="cg-selection-order-popover__actions">'
            + '<button type="button" data-cg-order-action="forward" title="Bring Forward" aria-label="Bring Forward"><i class="fa fa-angle-up" aria-hidden="true"></i></button>'
            + '<button type="button" data-cg-order-action="backward" title="Send Backward" aria-label="Send Backward"><i class="fa fa-angle-down" aria-hidden="true"></i></button>'
            + '<button type="button" data-cg-order-action="front" title="Bring To Front" aria-label="Bring To Front"><i class="fa fa-angle-double-up" aria-hidden="true"></i></button>'
            + '<button type="button" data-cg-order-action="back" title="Send To Back" aria-label="Send To Back"><i class="fa fa-angle-double-down" aria-hidden="true"></i></button></div>';
        alignmentPopover.hidden = true;
        alignmentPopover.innerHTML = '<div class="cg-selection-quick-popover__header"><span>Alignment</span></div>'
            + '<label class="cg-selection-alignment-popover__anchor" data-cg-alignment-anchor-row hidden><span><b>Align to first selected object</b><small>Off: align selection to canvas</small></span><input type="checkbox" checked data-cg-alignment-anchor><i aria-hidden="true"></i></label>'
            + '<div class="cg-selection-alignment-popover__reference" data-cg-alignment-reference-row><span>Align to</span><div role="group" aria-label="Alignment reference">'
            + '<button type="button" class="is-active" data-cg-alignment-reference="canvas" aria-pressed="true">Canvas</button>'
            + '<button type="button" data-cg-alignment-reference="behind" aria-pressed="false">Object behind</button></div></div>'
            + '<div class="cg-selection-alignment-popover__actions">'
            + '<button type="button" data-cg-alignment-action="left" title="Align Left" aria-label="Align Left"><i class="fa fa-align-left" aria-hidden="true"></i></button>'
            + '<button type="button" data-cg-alignment-action="center" title="Align Center" aria-label="Align Center"><i class="fa fa-align-center" aria-hidden="true"></i></button>'
            + '<button type="button" data-cg-alignment-action="right" title="Align Right" aria-label="Align Right"><i class="fa fa-align-right" aria-hidden="true"></i></button>'
            + '<button type="button" data-cg-alignment-action="top" title="Align Top" aria-label="Align Top"><i class="fa fa-long-arrow-up" aria-hidden="true"></i></button>'
            + '<button type="button" data-cg-alignment-action="middle" title="Align Middle" aria-label="Align Middle"><i class="fa fa-arrows-v" aria-hidden="true"></i></button>'
            + '<button type="button" data-cg-alignment-action="bottom" title="Align Bottom" aria-label="Align Bottom"><i class="fa fa-long-arrow-down" aria-hidden="true"></i></button></div>'
            + '<div class="cg-selection-alignment-popover__layout" data-cg-alignment-layout hidden>'
            + '<button type="button" data-cg-distribute-action="x" title="Space evenly from left to right"><i class="fa fa-arrows-h" aria-hidden="true"></i><span>Equal horizontal</span></button>'
            + '<button type="button" data-cg-distribute-action="y" title="Space evenly from top to bottom"><i class="fa fa-arrows-v" aria-hidden="true"></i><span>Equal vertical</span></button>'
            + '<button type="button" data-cg-smart-layout title="Automatically align and space the selection"><i class="fa fa-magic" aria-hidden="true"></i><span>Smart layout</span></button></div>';
        const transformPopover = createElement("div", "cg-selection-quick-popover cg-selection-transform-popover");
        transformPopover.hidden = true;
        transformPopover.innerHTML = '<div class="cg-selection-quick-popover__header"><span>Transform</span></div>'
            + '<div class="cg-selection-alignment-popover__transforms">'
            + '<button type="button" data-cg-transform-action="rotate-left" title="Rotate Left" aria-label="Rotate Left"><i class="fa fa-rotate-left" aria-hidden="true"></i></button>'
            + '<button type="button" data-cg-transform-action="rotate-right" title="Rotate Right" aria-label="Rotate Right"><i class="fa fa-rotate-right" aria-hidden="true"></i></button>'
            + '<button type="button" data-cg-transform-action="flip-x" title="Flip Horizontal" aria-label="Flip Horizontal"><i class="fa fa-arrows-h" aria-hidden="true"></i></button>'
            + '<button type="button" data-cg-transform-action="flip-y" title="Flip Vertical" aria-label="Flip Vertical"><i class="fa fa-arrows-v" aria-hidden="true"></i></button></div>';
        cropPopover.hidden = true;
        cropPopover.innerHTML = '<div class="cg-selection-quick-popover__header"><span>Crop image</span><small data-cg-crop-size></small></div>'
            + '<p class="cg-selection-crop-popover__hint"><i class="fa fa-crop" aria-hidden="true"></i><span>Drag the crop box or its handles directly on the image.</span></p>'
            + '<div class="cg-selection-crop-popover__actions"><button type="button" data-cg-crop-cancel>Cancel</button><button type="button" data-cg-crop-reset><i class="fa fa-undo" aria-hidden="true"></i> Reset selection</button><button type="button" data-cg-crop-apply><i class="fa fa-check" aria-hidden="true"></i> Crop</button></div>';
        shadowPopover.hidden = true;
        if (shadowPanel) shadowPopover.appendChild(shadowPanel);
        interactionPopover.hidden = true;
        motionPopover.hidden = true;
        if (interactionMenu) interactionPopover.appendChild(interactionMenu);
        if (motionMenu) motionPopover.appendChild(motionMenu);
        legacyControlStorage.hidden = true;
        ["cgTopGroupShareControl", "cgTopInteractionControl", "cgTopMotionControl", "cgTopTransformControl", "cgTopTransparencyControl", "cgTopShadowControl", "cgTopAlignmentControl"].forEach((controlId) => {
            const control = document.getElementById(controlId);
            if (control) legacyControlStorage.appendChild(control);
        });
        document.body.appendChild(bar);
        document.body.appendChild(linkPopover);
        document.body.appendChild(opacityPopover);
        document.body.appendChild(shapeSizePopover);
        document.body.appendChild(orderPopover);
        document.body.appendChild(alignmentPopover);
        document.body.appendChild(transformPopover);
        document.body.appendChild(cropPopover);
        document.body.appendChild(shadowPopover);
        document.body.appendChild(interactionPopover);
        document.body.appendChild(motionPopover);
        document.body.appendChild(textMorePopover);
        document.body.appendChild(fontPopover);
        document.body.appendChild(textSizePopover);
        document.body.appendChild(headingPopover);
        document.body.appendChild(textAlignmentPopover);
        document.body.appendChild(colorPopover);
        document.body.appendChild(textStylePopover);
        document.body.appendChild(shapeMorePopover);
        document.body.appendChild(imageMorePopover);
        document.body.appendChild(groupMorePopover);
        document.body.appendChild(imageScalePopover);
        document.body.appendChild(moreActionsPopover);
        document.body.appendChild(legacyControlStorage);
        let activeCanvas = null;
        let rightClickSuppressed = false;
        let propertyPopupOpen = false;
        let linkSelectionScope = null;
        let selectionAnchorObject = null;
        let alignmentReference = "canvas";
        let colorMode = "back";
        let toolbarPlacement = null;
        let toolbarPlacementTarget = null;
        let toolbarDrag = null;
        let dismissedToolbarTarget = null;
        let imageWheelCommitTimer = null;
        let fontPreviewState = null;
        let fontPreviewToken = 0;

        const cloneFontStyles = (styles) => JSON.parse(JSON.stringify(styles || {}));
        const captureFontState = (target) => {
            const state = [];
            const visit = (object) => {
                if (!object) return;
                const type = String(object.type || "").toLowerCase();
                if ((type === "group" || type === "activeselection") && typeof object.getObjects === "function") {
                    object.getObjects().forEach(visit);
                    return;
                }
                if (!isText(object)) return;
                state.push({
                    object,
                    fontFamily: object.fontFamily || "Arial",
                    styles: cloneFontStyles(object.styles),
                    isEditing: Boolean(object.isEditing),
                    selectionStart: Number(object.selectionStart) || 0,
                    selectionEnd: Number(object.selectionEnd) || 0
                });
            };
            visit(target);
            return { target, state };
        };
        const refreshFontObjects = (state) => {
            state.forEach(({ object }) => {
                object.dirty = true;
                object.setCoords?.();
            });
            activeCanvas?.requestRenderAll();
        };
        const restoreFontPreview = () => {
            fontPreviewToken += 1;
            if (!fontPreviewState) return;
            fontPreviewState.state.forEach(({ object, fontFamily, styles }) => {
                object.set({ fontFamily, styles: cloneFontStyles(styles) });
            });
            refreshFontObjects(fontPreviewState.state);
        };
        const applyFontPreview = (font) => {
            const preview = fontPreviewState;
            if (!preview || preview.target !== activeCanvas?.getActiveObject()) return;
            restoreFontPreview();
            const token = fontPreviewToken;
            const apply = () => {
                if (token !== fontPreviewToken || fontPopover.hidden || preview !== fontPreviewState) return;
                preview.state.forEach(({ object, isEditing, selectionStart, selectionEnd }) => {
                    if (isEditing && selectionEnd > selectionStart && typeof object.setSelectionStyles === "function") {
                        object.setSelectionStyles({ fontFamily: font }, selectionStart, selectionEnd);
                    } else {
                        object.set({ fontFamily: font });
                        if (typeof object.setSelectionStyles === "function" && typeof object.text === "string") {
                            object.setSelectionStyles({ fontFamily: font }, 0, object.text.length);
                        }
                    }
                });
                refreshFontObjects(preview.state);
            };
            if (typeof window.CGLoadCanvasFont === "function") window.CGLoadCanvasFont(font, apply);
            else apply();
        };
        const buildFontMenu = (selectedFont) => {
            const source = document.getElementById("font-family");
            const list = fontPopover.querySelector("[data-cg-font-list]");
            list.replaceChildren();
            Array.from(source?.children || []).forEach((sourceGroup) => {
                const group = createElement("section", "cg-selection-font-popover__group");
                const heading = createElement("span", "cg-selection-font-popover__group-label");
                heading.textContent = sourceGroup.label || "Fonts";
                group.appendChild(heading);
                Array.from(sourceGroup.matches("optgroup") ? sourceGroup.children : [sourceGroup]).forEach((option) => {
                    const item = createElement("button", "cg-selection-font-popover__option");
                    item.type = "button";
                    item.dataset.cgFontOption = option.value;
                    item.setAttribute("role", "option");
                    item.setAttribute("aria-selected", String(option.value === selectedFont));
                    item.classList.toggle("is-selected", option.value === selectedFont);
                    item.textContent = option.textContent;
                    item.style.fontFamily = option.value;
                    group.appendChild(item);
                });
                list.appendChild(group);
            });
        };
        const groupEditorModal = createElement("div", "cg-group-editor-modal");
        groupEditorModal.hidden = true;
        groupEditorModal.setAttribute("role", "dialog");
        groupEditorModal.setAttribute("aria-modal", "true");
        groupEditorModal.setAttribute("aria-labelledby", "cgGroupEditorTitle");
        groupEditorModal.innerHTML = '<div class="cg-group-editor-modal__backdrop" data-cg-group-editor-close></div>'
            + '<section class="cg-group-editor-modal__dialog">'
            + '<header class="cg-group-editor-modal__header"><div><small>GROUP CONTENT</small><h2 id="cgGroupEditorTitle">Edit group objects</h2></div>'
            + '<button type="button" class="cg-group-editor-modal__close" data-cg-group-editor-close aria-label="Close group editor"><i class="fa fa-times" aria-hidden="true"></i></button></header>'
            + '<div class="cg-group-editor-modal__body"><aside class="cg-group-editor-modal__rail">'
            + '<header class="cg-group-editor-modal__rail-header"><small>GROUP OBJECTS</small><strong>Choose an object to edit</strong></header>'
            + '<p class="cg-group-editor-modal__help">Each object keeps its own properties.</p>'
            + '<div class="cg-group-editor-modal__list" data-cg-group-list-host></div></aside>'
            + '<main class="cg-group-editor-modal__workspace"><section class="cg-group-editor-preview" data-cg-group-preview hidden><header class="cg-group-editor-preview__header">'
            + '<span><small>WHOLE GROUP PREVIEW</small><strong>Complete grouped object</strong></span><span class="cg-group-editor-preview__selection" data-cg-group-preview-selection></span></header>'
            + '<div class="cg-group-editor-preview__stage"><img data-cg-group-preview-image alt="Preview of the complete grouped object" /></div>'
            + '<p>Preview only. Continue editing the selected object below.</p></section>'
            + '<section class="cg-group-editor-accordion is-open"><button type="button" class="cg-group-editor-accordion__toggle" aria-expanded="true">'
            + '<span><small data-cg-group-property-type>OBJECT</small><strong>Properties</strong></span><i class="fa fa-angle-up" aria-hidden="true"></i></button>'
            + '<div class="cg-group-editor-accordion__content" data-cg-group-property-host></div></section></main></div>'
            + '<footer class="cg-group-editor-modal__footer"><button type="button" data-cg-group-editor-close>Done</button></footer></section>';
        document.body.appendChild(groupEditorModal);
        let groupListPlaceholder = null;
        let groupPropertyPlaceholder = null;
        let groupEditorTarget = null;
        let groupPreviewWatchTimer = null;
        let groupPreviewState = "";

        /** STAMP: 2026-09-08 - Render the complete group inside its editor.
         * The preview is a read-only bitmap of the live Fabric group, so child
         * property edits remain on the original editable object and canvas.
         */
        const renderGroupEditorPreview = (target, childIndex) => {
            const preview = groupEditorModal.querySelector("[data-cg-group-preview]");
            const image = groupEditorModal.querySelector("[data-cg-group-preview-image]");
            const selection = groupEditorModal.querySelector("[data-cg-group-preview-selection]");
            if (!preview || !image || !target || typeof target.toDataURL !== "function") return;
            try {
                target.dirty = true;
                image.src = target.toDataURL({ format: "png", multiplier: 1.5, enableRetinaScaling: false });
                const child = target.getObjects?.()[Number(childIndex)];
                const selectedName = child?.name || child?.type || "Object";
                selection.textContent = `Selected: ${selectedName}`;
                preview.hidden = false;
            } catch (previewError) {
                preview.hidden = true;
                console.warn("Unable to refresh grouped object preview", previewError);
            }
        };

        /** STAMP: 2026-09-08 - Legacy color/slider plugins do not consistently
         * bubble input events. Watch the live Fabric serialization while this
         * modal is open so every child-property change reaches the preview.
         */
        const watchGroupEditorPreview = () => {
            window.clearTimeout(groupPreviewWatchTimer);
            if (groupEditorModal.hidden || !groupEditorTarget) return;
            try {
                const nextState = JSON.stringify(groupEditorTarget.toObject?.(["id"]) || {});
                if (nextState !== groupPreviewState) {
                    groupPreviewState = nextState;
                    const selectedRow = groupEditorModal.querySelector(".cg-group-object-list__item.is-selected");
                    renderGroupEditorPreview(groupEditorTarget, selectedRow?.dataset.index || 0);
                }
            } catch (previewStateError) {
                console.warn("Unable to observe grouped object preview state", previewStateError);
            }
            groupPreviewWatchTimer = window.setTimeout(watchGroupEditorPreview, 120);
        };

        const setGroupEditorAccordion = (expanded) => {
            const accordion = groupEditorModal.querySelector(".cg-group-editor-accordion");
            const toggle = accordion.querySelector(".cg-group-editor-accordion__toggle");
            accordion.classList.toggle("is-open", expanded);
            toggle.setAttribute("aria-expanded", String(expanded));
            toggle.querySelector("i").className = `fa ${expanded ? "fa-angle-up" : "fa-angle-down"}`;
        };
        const closeGroupEditor = () => {
            if (groupEditorModal.hidden) return;
            const listWrap = groupEditorModal.querySelector("#groupObjectListWrap");
            const propertyHost = groupEditorModal.querySelector("#groupChildPropertyHost");
            if (listWrap && groupListPlaceholder?.parentNode) groupListPlaceholder.parentNode.replaceChild(listWrap, groupListPlaceholder);
            if (propertyHost && groupPropertyPlaceholder?.parentNode) groupPropertyPlaceholder.parentNode.replaceChild(propertyHost, groupPropertyPlaceholder);
            groupListPlaceholder = null;
            groupPropertyPlaceholder = null;
            groupEditorTarget = null;
            groupPreviewState = "";
            window.clearTimeout(groupPreviewWatchTimer);
            groupPreviewWatchTimer = null;
            groupEditorModal.hidden = true;
            document.body.classList.remove("cg-group-editor-open");
        };
        const openGroupEditor = (target) => {
            if (!target || String(target.type).toLowerCase() !== "group") return;
            groupEditorTarget = target;
            groupPreviewState = "";
            const listWrap = document.getElementById("groupObjectListWrap");
            const propertyHost = document.getElementById("groupChildPropertyHost");
            if (!listWrap || !propertyHost) return;
            groupListPlaceholder = document.createComment("group-object-list-home");
            groupPropertyPlaceholder = document.createComment("group-property-host-home");
            listWrap.parentNode.insertBefore(groupListPlaceholder, listWrap);
            propertyHost.parentNode.insertBefore(groupPropertyPlaceholder, propertyHost);
            groupEditorModal.querySelector("[data-cg-group-list-host]").appendChild(listWrap);
            groupEditorModal.querySelector("[data-cg-group-property-host]").appendChild(propertyHost);
            listWrap.hidden = false;
            listWrap.style.display = "grid";
            groupEditorModal.hidden = false;
            document.body.classList.add("cg-group-editor-open");
            setGroupEditorAccordion(true);
            const selectedRow = listWrap.querySelector(".cg-group-object-list__item.is-selected")
                || listWrap.querySelector(".cg-group-object-list__item");
            selectedRow?.click();
            watchGroupEditorPreview();
            groupEditorModal.querySelector(".cg-group-editor-modal__close")?.focus();
        };
        const openGroupChildEditor = (group, childIndex) => {
            openGroupEditor(group);
            window.requestAnimationFrame(() => {
                const row = groupEditorModal.querySelector(`.cg-group-object-list__item[data-index="${childIndex}"]`);
                row?.click();
                row?.scrollIntoView({ block: "nearest" });
                window.requestAnimationFrame(() => document.getElementById("editgrptxt")?.focus());
            });
        };
        groupEditorModal.addEventListener("click", (event) => {
            if (event.target.closest("[data-cg-group-editor-close]")) closeGroupEditor();
            if (event.target.closest(".cg-group-editor-accordion__toggle")) {
                setGroupEditorAccordion(!groupEditorModal.querySelector(".cg-group-editor-accordion").classList.contains("is-open"));
            }
            const row = event.target.closest(".cg-group-object-list__item");
            if (row) {
                setGroupEditorAccordion(true);
                window.requestAnimationFrame(() => {
                    const name = row.querySelector(".cg-group-object-list__name")?.textContent || "Object";
                    groupEditorModal.querySelector("[data-cg-group-property-type]").textContent = name.toUpperCase();
                    renderGroupEditorPreview(groupEditorTarget, row.dataset.index);
                });
            }
        });
        ["input", "change"].forEach((eventName) => {
            groupEditorModal.addEventListener(eventName, (event) => {
                if (!event.target.closest("[data-cg-group-property-host]")) return;
                window.requestAnimationFrame(() => {
                    const selectedRow = groupEditorModal.querySelector(".cg-group-object-list__item.is-selected");
                    renderGroupEditorPreview(groupEditorTarget, selectedRow?.dataset.index || 0);
                });
            });
        });
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && !groupEditorModal.hidden) closeGroupEditor();
        });

        /* STAMP: 2026-09-01 - Intercept every legacy and Quick Action ungroup
           command, then replay only the confirmed command through its existing handler. */
        let pendingUngroupControl = null;
        let allowConfirmedUngroup = false;
        document.addEventListener("click", (event) => {
            const ungroupControl = event.target.closest("#ungroupobjects, #ungroup");
            if (!ungroupControl || allowConfirmedUngroup) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            pendingUngroupControl = ungroupControl;
            const modalElement = document.getElementById("confirmUngroupModal");
            if (modalElement && window.bootstrap) {
                window.bootstrap.Modal.getOrCreateInstance(modalElement).show();
            }
        }, true);
        document.getElementById("confirmUngroupObject")?.addEventListener("click", () => {
            const control = pendingUngroupControl;
            pendingUngroupControl = null;
            const modalElement = document.getElementById("confirmUngroupModal");
            if (modalElement && window.bootstrap) {
                window.bootstrap.Modal.getOrCreateInstance(modalElement).hide();
            }
            if (!control) return;
            allowConfirmedUngroup = true;
            control.click();
            allowConfirmedUngroup = false;
        });

        const isText = (object) => object && ["text", "textbox", "i-text"].includes(object.type);
        /* STAMP: 2026-09-01 - Per-image, runtime-only transform snapshots let
           the canvas-fit quick action restore the exact prior size and position. */
        const imageCanvasFitSnapshots = new WeakMap();
        const downloadSelectedImage = async (image) => {
            const source = typeof image.getSrc === "function"
                ? image.getSrc()
                : (image._originalElement && image._originalElement.src) || "";
            if (!source) return;

            const sourceExtension = source.match(/\.([a-z0-9]{2,5})(?:[?#]|$)/i);
            const mimeExtension = source.match(/^data:image\/([a-z0-9.+-]+);/i);
            const extension = (sourceExtension && sourceExtension[1])
                || (mimeExtension && mimeExtension[1].replace("jpeg", "jpg").replace("svg+xml", "svg"))
                || "png";
            const safeName = String(image.name || image.id || "canvas-image")
                .replace(/[^a-z0-9_-]+/gi, "-")
                .replace(/^-+|-+$/g, "") || "canvas-image";
            const fileName = `${safeName}.${extension}`;

            try {
                const response = await fetch(source);
                if (!response.ok) throw new Error("Image download failed");
                const blob = await response.blob();
                if (typeof window.saveAs === "function") {
                    window.saveAs(blob, fileName);
                    return;
                }
                const objectUrl = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = objectUrl;
                link.download = fileName;
                link.click();
                window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
            } catch (_error) {
                const link = document.createElement("a");
                link.href = source;
                link.download = fileName;
                link.target = "_blank";
                link.rel = "noopener";
                link.click();
            }
        };
        const getLinkSelectionScope = (object) => {
            if (!isText(object) || !object.isEditing || typeof object.getSelectedText !== "function") return null;
            const start = Number(object.selectionStart);
            const end = Number(object.selectionEnd);
            const text = String(object.getSelectedText() || "");
            return text && end > start ? { start, end, text } : null;
        };
        const button = (icon, label, action) => `<button type="button" data-cg-selection-action="${action}" title="${label}" aria-label="${label}"><i class="fa ${icon}" aria-hidden="true"></i></button>`;
        const groupedActionSources = (actions) => `<span class="cg-selection-toolbar__grouped-sources" aria-hidden="true">${actions}</span>`;
        const moreActionsButton = '<button type="button" data-cg-selection-action="more-actions" title="More actions" aria-label="More actions" aria-haspopup="menu" aria-expanded="false"><i class="fa fa-ellipsis-v" aria-hidden="true"></i></button>';
        const renderMoreActionsMenu = (sections) => {
            const host = moreActionsPopover.querySelector("[data-cg-more-sections]");
            host.innerHTML = sections.filter((section) => section.actions.length).map((section) => (
                `<section class="cg-selection-more-actions-popover__section"><span>${section.label}</span><div>${section.actions.map((action) => (
                    `<button type="button" role="menuitem" data-cg-more-action="${action.action}"><i class="fa ${action.icon}" aria-hidden="true"></i><span>${action.label}</span></button>`
                )).join("")}</div></section>`
            )).join("");
        };
        const colorButton = (backColor, strokeColor) => '<button type="button" class="cg-selection-toolbar__color-menu" data-cg-selection-action="color-menu" title="Back and stroke colour" aria-label="Back and stroke colour" aria-haspopup="dialog" aria-expanded="false">'
            + `<svg viewBox="0 0 28 22" aria-hidden="true"><circle cx="10" cy="11" r="7" fill="${backColor}"></circle><circle cx="18" cy="11" r="7" fill="${strokeColor}"></circle></svg>`
            + '<i class="fa fa-angle-down" aria-hidden="true"></i></button>';
        const syncColorPopover = (target) => {
            const isStroke = colorMode === "stroke";
            const rawColor = isStroke ? target?.stroke : target?.fill;
            const fallback = "#000000";
            const color = /^#[0-9a-f]{6}$/i.test(String(rawColor || "")) ? rawColor : fallback;
            colorPopover.querySelectorAll("[data-cg-color-tab]").forEach((tab) => {
                const selected = tab.dataset.cgColorTab === colorMode;
                tab.classList.toggle("is-active", selected);
                tab.setAttribute("aria-selected", String(selected));
            });
            colorPopover.querySelector("[data-cg-color-label]").textContent = isStroke ? "Stroke colour" : "Back colour";
            colorPopover.querySelector("[data-cg-color-value]").textContent = color.toUpperCase();
            colorPopover.querySelector("[data-cg-color-preview]").setAttribute("fill", color);
        };
        const syncTextStyleControls = (target) => {
            const selectedTextStyle = target?.isEditing
                && target.selectionStart !== target.selectionEnd
                && typeof target.getSelectionStyles === "function"
                ? target.getSelectionStyles(target.selectionStart, target.selectionEnd, false)[0]
                : null;
            const storedWeight = selectedTextStyle?.fontWeight ?? target?.fontWeight;
            const weight = typeof window.CGNormalizeTextFontWeight === "function"
                ? window.CGNormalizeTextFontWeight(storedWeight)
                : (storedWeight === "bold" ? 700 : (Number(storedWeight) || 400));
            const weightControl = textStylePopover.querySelector("[data-cg-font-weight]");
            if (weightControl) weightControl.value = String(weight);
            const states = {
                bold: weight >= 600,
                italic: target?.fontStyle === "italic",
                underline: Boolean(target?.underline),
                strike: Boolean(target?.linethrough)
            };
            textStylePopover.querySelectorAll("[data-cg-text-style]").forEach((control) => {
                const active = Boolean(states[control.dataset.cgTextStyle]);
                control.classList.toggle("is-active", active);
                control.setAttribute("aria-pressed", String(active));
            });
        };
        /* STAMP: 2026-08-31 - A dedicated handle moves the quick-action bar
           around (never across) the currently selected object's perimeter. */
        const dragHandle = '<button type="button" class="cg-selection-toolbar__drag-handle" data-cg-selection-drag title="Move quick actions" aria-label="Drag quick actions around selected object"><i class="fa fa-arrows" aria-hidden="true"></i></button>';
        const hidePopovers = () => {
            restoreFontPreview();
            fontPreviewState = null;
            fontPopover.hidden = true;
            bar.querySelector("[data-cg-selection-font-toggle]")?.setAttribute("aria-expanded", "false");
            shapeSizePopover.hidden = true;
            shapeSizeTarget = null;
            bar.querySelector('[data-cg-selection-action="shape-size"]')?.setAttribute("aria-expanded", "false");
            opacityPopover.hidden = true;
            linkPopover.hidden = true;
            orderPopover.hidden = true;
            alignmentPopover.hidden = true;
            transformPopover.hidden = true;
            cropPopover.hidden = true;
            shadowPopover.hidden = true;
            interactionPopover.hidden = true;
            motionPopover.hidden = true;
            textMorePopover.hidden = true;
            textSizePopover.hidden = true;
            headingPopover.hidden = true;
            textAlignmentPopover.hidden = true;
            colorPopover.hidden = true;
            textStylePopover.hidden = true;
            bar.querySelector('[data-cg-selection-action="color-menu"]')?.setAttribute("aria-expanded", "false");
            bar.querySelector('[data-cg-selection-action="text-style"]')?.setAttribute("aria-expanded", "false");
            shapeMorePopover.hidden = true;
            imageMorePopover.hidden = true;
            groupMorePopover.hidden = true;
            imageScalePopover.hidden = true;
            moreActionsPopover.hidden = true;
            bar.querySelector('[data-cg-selection-action="more-actions"]')?.setAttribute("aria-expanded", "false");
        };
        // STAMP: 2026-09-05 - One quick-action dropdown or color palette at a time.
        window.addEventListener("cg:color-palette-opening", hidePopovers);
        const hide = () => {
            bar.hidden = true;
            hidePopovers();
        };
        const selectedTargets = (target) => String(target.type).toLowerCase() === "activeselection" && typeof target.getObjects === "function"
            ? target.getObjects()
            : [target];
        const syncCropControls = (state) => {
            if (!state) return false;
            cropPopover.querySelector("[data-cg-crop-size]").textContent = `${Math.round(state.cropWidth)} × ${Math.round(state.cropHeight)} px`;
            return true;
        };
        const openCropPopover = () => {
            const target = activeCanvas && activeCanvas.getActiveObject();
            if (!target || String(target.type).toLowerCase() !== "image" || !window.CGImageCropEditor) return;
            hidePopovers();
            if (!syncCropControls(window.CGImageCropEditor.start())) return;
            cropPopover.hidden = false;
            window.requestAnimationFrame(position);
        };
        const objectBounds = (object) => {
            const bounds = object.getBoundingRect();
            return { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height, right: bounds.left + bounds.width, bottom: bounds.top + bounds.height };
        };
        const collectionBounds = (objects) => {
            const bounds = objects.map(objectBounds);
            const left = Math.min(...bounds.map((item) => item.left));
            const top = Math.min(...bounds.map((item) => item.top));
            const right = Math.max(...bounds.map((item) => item.right));
            const bottom = Math.max(...bounds.map((item) => item.bottom));
            return { left, top, right, bottom, width: right - left, height: bottom - top };
        };
        const moveObject = (object, deltaX, deltaY) => {
            object.set({ left: object.left + deltaX, top: object.top + deltaY });
            object.setCoords();
        };
        /**
         * STAMP: 2026-09-10 - Return the active object or ActiveSelection to
         * the visible slide using only the smallest required translation.
         * Keeping the selection wrapper intact preserves every selected
         * object's size, rotation, and position relative to its neighbours.
         */
        const keepSelectionInsideCanvas = (target) => {
            if (!activeCanvas || !target) return false;
            const bounds = objectBounds(target);
            const canvasWidth = activeCanvas.getWidth();
            const canvasHeight = activeCanvas.getHeight();
            const axisCorrection = (start, end, limit) => {
                if (start < 0 && end > limit) return 0;
                if (start < 0) return -start;
                if (end > limit) return limit - end;
                return 0;
            };
            const deltaX = axisCorrection(bounds.left, bounds.right, canvasWidth);
            const deltaY = axisCorrection(bounds.top, bounds.bottom, canvasHeight);
            if (Math.abs(deltaX) < 0.01 && Math.abs(deltaY) < 0.01) return false;
            moveObject(target, deltaX, deltaY);
            commit(target);
            return true;
        };
        /* STAMP: 2026-09-09 - Resolve the closest visible canvas object below
         * the selection. Prefer a containing/overlapping object so text can be
         * positioned inside its authored background without changing layers. */
        const findObjectBehind = (target) => {
            if (!activeCanvas || !target) return null;
            const objects = activeCanvas.getObjects();
            const targetIndex = objects.indexOf(target);
            if (targetIndex < 1) return null;
            const targetBounds = objectBounds(target);
            const targetCenterX = targetBounds.left + targetBounds.width / 2;
            const targetCenterY = targetBounds.top + targetBounds.height / 2;
            for (let index = targetIndex - 1; index >= 0; index -= 1) {
                const candidate = objects[index];
                if (!candidate || candidate.visible === false) continue;
                const bounds = objectBounds(candidate);
                const containsCenter = targetCenterX >= bounds.left && targetCenterX <= bounds.right
                    && targetCenterY >= bounds.top && targetCenterY <= bounds.bottom;
                const overlaps = Math.min(targetBounds.right, bounds.right) > Math.max(targetBounds.left, bounds.left)
                    && Math.min(targetBounds.bottom, bounds.bottom) > Math.max(targetBounds.top, bounds.top);
                if (containsCenter || overlaps) return candidate;
            }
            return null;
        };
        const syncAlignmentReferenceControls = (target) => {
            const behindButton = alignmentPopover.querySelector('[data-cg-alignment-reference="behind"]');
            const hasObjectBehind = Boolean(findObjectBehind(target));
            behindButton.disabled = !hasObjectBehind;
            behindButton.title = hasObjectBehind ? "Align inside the nearest object behind" : "No overlapping object behind this selection";
            if (!hasObjectBehind && alignmentReference === "behind") alignmentReference = "canvas";
            alignmentPopover.querySelectorAll("[data-cg-alignment-reference]").forEach((button) => {
                const isActive = button.dataset.cgAlignmentReference === alignmentReference;
                button.classList.toggle("is-active", isActive);
                button.setAttribute("aria-pressed", String(isActive));
            });
        };
        const alignSingleObject = (target, direction) => {
            const referenceObject = alignmentReference === "behind" ? findObjectBehind(target) : null;
            const referenceBounds = referenceObject
                ? objectBounds(referenceObject)
                : { left: 0, top: 0, right: activeCanvas.getWidth(), bottom: activeCanvas.getHeight(), width: activeCanvas.getWidth(), height: activeCanvas.getHeight() };
            const bounds = objectBounds(target);
            let deltaX = 0;
            let deltaY = 0;
            if (direction === "left") deltaX = referenceBounds.left - bounds.left;
            if (direction === "center") deltaX = (referenceBounds.left + referenceBounds.width / 2) - (bounds.left + bounds.width / 2);
            if (direction === "right") deltaX = referenceBounds.right - bounds.right;
            if (direction === "top") deltaY = referenceBounds.top - bounds.top;
            if (direction === "middle") deltaY = (referenceBounds.top + referenceBounds.height / 2) - (bounds.top + bounds.height / 2);
            if (direction === "bottom") deltaY = referenceBounds.bottom - bounds.bottom;
            moveObject(target, deltaX, deltaY);
            commit(target);
        };
        const applyToUngroupedSelection = (operation) => {
            const selection = activeCanvas && activeCanvas.getActiveObject();
            if (!selection || String(selection.type).toLowerCase() !== "activeselection") return false;
            const objects = selection.getObjects().slice();
            if (objects.length < 2 || !window.fabric || !window.fabric.ActiveSelection) return false;
            const anchor = objects.includes(selectionAnchorObject) ? selectionAnchorObject : objects[0];
            activeCanvas.discardActiveObject();
            objects.forEach((object) => object.setCoords());
            operation(objects, anchor);
            objects.forEach((object) => object.setCoords());
            const nextSelection = new window.fabric.ActiveSelection(objects, { canvas: activeCanvas });
            selectionAnchorObject = anchor;
            activeCanvas.setActiveObject(nextSelection);
            activeCanvas.requestRenderAll();
            activeCanvas.fire("object:modified", { target: nextSelection });
            position();
            return true;
        };
        const alignMultiSelection = (direction, alignToFirst) => applyToUngroupedSelection((objects, anchor) => {
            if (alignToFirst) {
                const anchorBounds = objectBounds(anchor);
                objects.forEach((object) => {
                    if (object === anchor) return;
                    const bounds = objectBounds(object);
                    let deltaX = 0;
                    let deltaY = 0;
                    if (direction === "left") deltaX = anchorBounds.left - bounds.left;
                    if (direction === "center") deltaX = (anchorBounds.left + anchorBounds.width / 2) - (bounds.left + bounds.width / 2);
                    if (direction === "right") deltaX = anchorBounds.right - bounds.right;
                    if (direction === "top") deltaY = anchorBounds.top - bounds.top;
                    if (direction === "middle") deltaY = (anchorBounds.top + anchorBounds.height / 2) - (bounds.top + bounds.height / 2);
                    if (direction === "bottom") deltaY = anchorBounds.bottom - bounds.bottom;
                    moveObject(object, deltaX, deltaY);
                });
                return;
            }
            const bounds = collectionBounds(objects);
            let deltaX = 0;
            let deltaY = 0;
            if (direction === "left") deltaX = -bounds.left;
            if (direction === "center") deltaX = (activeCanvas.getWidth() - bounds.width) / 2 - bounds.left;
            if (direction === "right") deltaX = activeCanvas.getWidth() - bounds.right;
            if (direction === "top") deltaY = -bounds.top;
            if (direction === "middle") deltaY = (activeCanvas.getHeight() - bounds.height) / 2 - bounds.top;
            if (direction === "bottom") deltaY = activeCanvas.getHeight() - bounds.bottom;
            objects.forEach((object) => moveObject(object, deltaX, deltaY));
        });
        /* STAMP: 2026-09-12 - Distribute every object in an ActiveSelection with
         * equal edge-to-edge spacing. Snapshot the rendered Fabric bounds before
         * moving anything so rotated/scaled objects keep stable first/last edges. */
        const distributeSelection = (axis) => applyToUngroupedSelection((objects) => {
            const horizontal = axis === "x";
            const entries = objects.map((object, index) => ({ object, index, bounds: objectBounds(object) }));
            entries.sort((first, second) => {
                const positionDelta = horizontal
                    ? first.bounds.left - second.bounds.left
                    : first.bounds.top - second.bounds.top;
                return positionDelta || first.index - second.index;
            });
            const firstBounds = entries[0].bounds;
            const lastBounds = entries[entries.length - 1].bounds;
            const totalSize = entries.reduce((sum, entry) => (
                sum + (horizontal ? entry.bounds.width : entry.bounds.height)
            ), 0);
            const availableSpan = horizontal
                ? lastBounds.right - firstBounds.left
                : lastBounds.bottom - firstBounds.top;
            const gap = Math.max(0, (availableSpan - totalSize) / (entries.length - 1));
            let cursor = horizontal ? firstBounds.left : firstBounds.top;
            entries.forEach(({ object, bounds }) => {
                const delta = cursor - (horizontal ? bounds.left : bounds.top);
                moveObject(object, horizontal ? delta : 0, horizontal ? 0 : delta);
                cursor += (horizontal ? bounds.width : bounds.height) + gap;
            });
        });
        const smartLayoutSelection = () => applyToUngroupedSelection((objects) => {
            const initialBounds = objects.map(objectBounds);
            const centersX = initialBounds.map((bounds) => bounds.left + bounds.width / 2);
            const centersY = initialBounds.map((bounds) => bounds.top + bounds.height / 2);
            const horizontal = Math.max(...centersX) - Math.min(...centersX) >= Math.max(...centersY) - Math.min(...centersY);
            const sorted = objects.slice().sort((first, second) => {
                const firstBounds = objectBounds(first);
                const secondBounds = objectBounds(second);
                return horizontal ? firstBounds.left - secondBounds.left : firstBounds.top - secondBounds.top;
            });
            const crossCenters = (horizontal ? centersY : centersX).slice().sort((first, second) => first - second);
            const crossCenter = crossCenters[Math.floor(crossCenters.length / 2)];
            const averageSize = initialBounds.reduce((sum, bounds) => sum + (horizontal ? bounds.width : bounds.height), 0) / initialBounds.length;
            const gap = Math.max(12, Math.min(40, averageSize * 0.25));
            const startBounds = collectionBounds(objects);
            let cursor = horizontal ? startBounds.left : startBounds.top;
            sorted.forEach((object) => {
                const bounds = objectBounds(object);
                const mainDelta = cursor - (horizontal ? bounds.left : bounds.top);
                const crossDelta = crossCenter - (horizontal ? bounds.top + bounds.height / 2 : bounds.left + bounds.width / 2);
                moveObject(object, horizontal ? mainDelta : crossDelta, horizontal ? crossDelta : mainDelta);
                cursor += (horizontal ? bounds.width : bounds.height) + gap;
            });
            const finalBounds = collectionBounds(objects);
            const padding = 12;
            let deltaX = finalBounds.left < padding ? padding - finalBounds.left : 0;
            let deltaY = finalBounds.top < padding ? padding - finalBounds.top : 0;
            if (finalBounds.right + deltaX > activeCanvas.getWidth() - padding) deltaX += activeCanvas.getWidth() - padding - (finalBounds.right + deltaX);
            if (finalBounds.bottom + deltaY > activeCanvas.getHeight() - padding) deltaY += activeCanvas.getHeight() - padding - (finalBounds.bottom + deltaY);
            objects.forEach((object) => moveObject(object, deltaX, deltaY));
        });
        const commit = (target) => {
            target.setCoords();
            activeCanvas.requestRenderAll();
            activeCanvas.fire("object:modified", { target });
            position();
        };
        const applyText = (target, styles) => {
            if (target.isEditing && target.selectionStart !== target.selectionEnd && typeof target.setSelectionStyles === "function") {
                target.setSelectionStyles(styles, target.selectionStart, target.selectionEnd);
            } else {
                target.set(styles);
            }
            commit(target);
        };
        const position = () => {
            const target = activeCanvas && activeCanvas.getActiveObject();
            if (!target) return;
            const canvasRect = activeCanvas.upperCanvasEl.getBoundingClientRect();
            const bounds = target.getBoundingRect();
            if (target.isCropSelection && !cropPopover.hidden) {
                const scaleX = canvasRect.width / activeCanvas.getWidth();
                const scaleY = canvasRect.height / activeCanvas.getHeight();
                const objectLeft = canvasRect.left + bounds.left * scaleX;
                const objectTop = canvasRect.top + bounds.top * scaleY;
                const objectWidth = bounds.width * scaleX;
                const objectHeight = bounds.height * scaleY;
                const popoverRect = cropPopover.getBoundingClientRect();
                const left = Math.max(8, Math.min(window.innerWidth - popoverRect.width - 8, objectLeft + (objectWidth - popoverRect.width) / 2));
                const belowTop = objectTop + objectHeight + 12;
                const aboveTop = objectTop - popoverRect.height - 12;
                const top = belowTop + popoverRect.height <= window.innerHeight - 8 ? belowTop : Math.max(8, aboveTop);
                cropPopover.style.left = `${Math.round(left)}px`;
                cropPopover.style.top = `${Math.round(top)}px`;
                return;
            }
            if (bar.hidden) return;
            const barRect = bar.getBoundingClientRect();
            const scaleX = canvasRect.width / activeCanvas.getWidth();
            const scaleY = canvasRect.height / activeCanvas.getHeight();
            const objectLeft = canvasRect.left + bounds.left * scaleX;
            const objectTop = canvasRect.top + bounds.top * scaleY;
            const objectWidth = bounds.width * scaleX;
            const objectHeight = bounds.height * scaleY;
            const gap = 14;
            const canvasLeft = Math.max(8, canvasRect.left);
            const canvasTop = Math.max(8, canvasRect.top);
            const canvasRight = Math.min(window.innerWidth - 8, canvasRect.right);
            const canvasBottom = Math.min(window.innerHeight - 8, canvasRect.bottom);
            const clampLeft = (value) => Math.max(canvasLeft, Math.min(canvasRight - barRect.width, value));
            const clampTop = (value) => Math.max(canvasTop, Math.min(canvasBottom - barRect.height, value));
            let left = clampLeft(objectLeft + (objectWidth - barRect.width) / 2);
            const above = objectTop - barRect.height - gap;
            const below = objectTop + objectHeight + gap;
            const canvasSpaceAbove = objectTop - canvasRect.top;
            const canvasSpaceBelow = canvasRect.bottom - (objectTop + objectHeight);
            const placeAbove = canvasSpaceAbove >= barRect.height + gap
                || canvasSpaceAbove > canvasSpaceBelow;
            let top = placeAbove ? above : below;
            if (toolbarPlacement && toolbarPlacementTarget === target) {
                const along = Math.max(0, Math.min(1, toolbarPlacement.along));
                if (toolbarPlacement.side === "top" || toolbarPlacement.side === "bottom") {
                    left = clampLeft(objectLeft + objectWidth * along - barRect.width / 2);
                    top = toolbarPlacement.side === "top" ? above : below;
                } else {
                    left = toolbarPlacement.side === "left"
                        ? objectLeft - barRect.width - gap
                        : objectLeft + objectWidth + gap;
                    top = objectTop + objectHeight * along - barRect.height / 2;
                }
            }
            bar.style.left = `${Math.round(clampLeft(left))}px`;
            bar.style.top = `${Math.round(clampTop(top))}px`;

            [shapeSizePopover, opacityPopover, linkPopover, orderPopover, alignmentPopover, transformPopover, shadowPopover, cropPopover, interactionPopover, motionPopover, textMorePopover, fontPopover, textSizePopover, headingPopover, textAlignmentPopover, colorPopover, textStylePopover, shapeMorePopover, imageMorePopover, groupMorePopover, imageScalePopover, moreActionsPopover].forEach((popover) => {
                if (popover.hidden) return;
                const popoverRect = popover.getBoundingClientRect();
                const fontToggle = bar.querySelector("[data-cg-selection-font-toggle]");
                const anchorLeft = popover === shapeSizePopover
                    ? bar.querySelector('[data-cg-selection-action="shape-size"]').getBoundingClientRect().left
                    : (popover === fontPopover && fontToggle ? fontToggle.getBoundingClientRect().left : barRect.right - popoverRect.width);
                const popoverLeft = Math.max(8, Math.min(window.innerWidth - popoverRect.width - 8, anchorLeft));
                const belowTop = barRect.bottom + 8;
                const aboveTop = barRect.top - popoverRect.height - 8;
                const spaceBelow = window.innerHeight - belowTop - 8;
                const spaceAbove = barRect.top - 16;
                const placePopoverAbove = popoverRect.height > spaceBelow && spaceAbove > spaceBelow;
                const desiredTop = placePopoverAbove ? aboveTop : belowTop;
                const popoverTop = Math.max(8, Math.min(window.innerHeight - popoverRect.height - 8, desiredTop));
                popover.style.left = `${Math.round(popoverLeft)}px`;
                popover.style.top = `${Math.round(popoverTop)}px`;
                popover.classList.toggle("cg-selection-quick-popover--above", placePopoverAbove);
            });
            if (!textSizePopover.hidden) {
                const sizeButton = bar.querySelector('[data-cg-selection-action="font-size"]');
                if (sizeButton) {
                    const anchorRect = sizeButton.getBoundingClientRect();
                    const popupRect = textSizePopover.getBoundingClientRect();
                    const left = Math.max(8, Math.min(window.innerWidth - popupRect.width - 8, anchorRect.left + (anchorRect.width - popupRect.width) / 2));
                    const belowTop = anchorRect.bottom + 8;
                    const top = belowTop + popupRect.height <= window.innerHeight - 8
                        ? belowTop
                        : Math.max(8, anchorRect.top - popupRect.height - 8);
                    textSizePopover.style.left = `${Math.round(left)}px`;
                    textSizePopover.style.top = `${Math.round(top)}px`;
                }
            }
            if (!textAlignmentPopover.hidden) {
                const alignmentButton = bar.querySelector('[data-cg-selection-action="text-alignment"]');
                if (alignmentButton) {
                    const anchorRect = alignmentButton.getBoundingClientRect();
                    const popupRect = textAlignmentPopover.getBoundingClientRect();
                    const belowTop = anchorRect.bottom + 8;
                    const top = belowTop + popupRect.height <= window.innerHeight - 8
                        ? belowTop
                        : Math.max(8, anchorRect.top - popupRect.height - 8);
                    textAlignmentPopover.style.left = `${Math.round(Math.max(8, Math.min(window.innerWidth - popupRect.width - 8, anchorRect.left + (anchorRect.width - popupRect.width) / 2)))}px`;
                    textAlignmentPopover.style.top = `${Math.round(top)}px`;
                }
            }
            [[headingPopover, "heading"], [colorPopover, "color-menu"], [textStylePopover, "text-style"], [moreActionsPopover, "more-actions"]].forEach(([popover, action]) => {
                if (popover.hidden) return;
                const anchor = bar.querySelector(`[data-cg-selection-action="${action}"]`);
                if (!anchor) return;
                const anchorRect = anchor.getBoundingClientRect();
                const popupRect = popover.getBoundingClientRect();
                const belowTop = anchorRect.bottom + 8;
                const top = belowTop + popupRect.height <= window.innerHeight - 8
                    ? belowTop
                    : Math.max(8, anchorRect.top - popupRect.height - 8);
                popover.style.left = `${Math.round(Math.max(8, Math.min(window.innerWidth - popupRect.width - 8, anchorRect.left + (anchorRect.width - popupRect.width) / 2)))}px`;
                popover.style.top = `${Math.round(top)}px`;
            });
            if (!imageScalePopover.hidden) {
                const scaleButton = bar.querySelector('[data-cg-selection-action="image-scale"]');
                if (scaleButton) {
                    const anchorRect = scaleButton.getBoundingClientRect();
                    const popupRect = imageScalePopover.getBoundingClientRect();
                    const belowTop = anchorRect.bottom + 8;
                    const top = belowTop + popupRect.height <= window.innerHeight - 8 ? belowTop : Math.max(8, anchorRect.top - popupRect.height - 8);
                    imageScalePopover.style.left = `${Math.round(Math.max(8, Math.min(window.innerWidth - popupRect.width - 8, anchorRect.left + (anchorRect.width - popupRect.width) / 2)))}px`;
                    imageScalePopover.style.top = `${Math.round(top)}px`;
                }
            }
        };
        const render = () => {
            const target = activeCanvas && activeCanvas.getActiveObject();
            const targetType = target ? String(target.type).toLowerCase() : "";

            if (!target || rightClickSuppressed || dismissedToolbarTarget === target) {
                hide();
                return;
            }

            if (toolbarPlacementTarget !== target) {
                toolbarPlacementTarget = target;
                toolbarPlacement = null;
            }
            if (targetType === "group") target.subTargetCheck = true;

            if (target.isCropSelection) {
                bar.hidden = true;
                if (window.CGImageCropEditor) syncCropControls(window.CGImageCropEditor.getSelectionState());
                return;
            }

            hidePopovers();
            const selectionTargets = selectedTargets(target);
            const isLocked = selectionTargets.length > 0 && selectionTargets.every((object) => (
                object.lockMovementX && object.lockMovementY && object.lockScalingX
                && object.lockScalingY && object.lockRotation
            ));
            const hasLockedTransform = isCanvasObjectLocked(target)
                || selectionTargets.some(isCanvasObjectLocked);
            const isAnimationDisabled = typeof window.isCurrentSlideAnimationDisabled === "function"
                && window.isCurrentSlideAnimationDisabled();
            // STAMP: 2026-09-05 - Save selected text, shapes or groups through the existing library flow.
            const saveToLibraryAction = button("fa-save", "Save to object library", "save-to-library");
            /* STAMP: 2026-09-11 - One-shot same-kind Format Painter is exposed
             * on every individual object toolbar, while ActiveSelection keeps
             * its existing group-only workflow. */
            const formatPainterAction = targetType === "activeselection"
                ? ""
                : button("fa-paint-brush", "Format Painter", "format-painter");
            const inspectorActions = button("fa-sliders", "Quick controls", "dropdown-quick")
                /* STAMP: 2026-09-11 - Hide animation authoring when the active
                 * slide disables playback; Actions remain independently usable. */
                + (isAnimationDisabled ? "" : button("fa-play-circle", "Animation", "dropdown-animation"))
                + button("fa-bolt", "Actions", "dropdown-actions");
            /* STAMP: 2026-09-10 - Apply the same stable right-edge utility
             * order, including Save then Delete, to Shape, Image, Group, and
             * Active Selection toolbars. */
            const commonSecondaryActions = inspectorActions + button("fa-share", "Share properties", "share-properties") + formatPainterAction
                + button("fa-compress", "Move inside canvas", "keep-in-canvas")
                + button("fa-align-center", "Alignment", "alignment")
                + button("fa-arrows", "Transform", "transform")
                + button("fa-sort", "Order", "order")
                + button("fa-adjust", "Transparency", "transparency")
                + button(isLocked ? "fa-unlock" : "fa-lock", isLocked ? "Unlock object" : "Lock object", "lock")
                + saveToLibraryAction;
            /* STAMP: 2026-09-10 - Keep the requested right-edge sequence:
             * Close, Delete, Save, Lock, Opacity when read right to left. */
            const commonMoreSections = [
                { label: "Controls", actions: [
                    { icon: "fa-sliders", label: "Quick controls", action: "dropdown-quick" },
                    ...(isAnimationDisabled ? [] : [{ icon: "fa-play-circle", label: "Animation", action: "dropdown-animation" }]),
                    { icon: "fa-bolt", label: "Actions", action: "dropdown-actions" }
                ] },
                { label: "Arrange", actions: [
                    { icon: "fa-compress", label: "Move inside canvas", action: "keep-in-canvas" },
                    { icon: targetType === "text" || targetType === "textbox" || targetType === "i-text" ? "fa-crosshairs" : "fa-align-center", label: "Alignment", action: "alignment" },
                    { icon: "fa-arrows", label: "Transform", action: "transform" },
                    { icon: "fa-sort", label: "Order", action: "order" },
                    { icon: "fa-adjust", label: "Transparency", action: "transparency" }
                ] },
                { label: "Object", actions: [
                    { icon: "fa-share", label: "Share properties", action: "share-properties" },
                    ...(targetType === "activeselection" ? [] : [{ icon: "fa-paint-brush", label: "Format Painter", action: "format-painter" }]),
                    { icon: isLocked ? "fa-unlock" : "fa-lock", label: isLocked ? "Unlock object" : "Lock object", action: "lock" },
                    { icon: "fa-save", label: "Save to object library", action: "save-to-library" }
                ] }
            ];

            if (targetType === "activeselection") {
                bar.classList.remove("cg-selection-toolbar--text");
                renderMoreActionsMenu(commonMoreSections);
                bar.innerHTML = dragHandle + button("fa-object-group", "Group selected objects", "group")
                    + groupedActionSources(commonSecondaryActions) + moreActionsButton
                    + button("fa-trash", "Delete", "delete") + button("fa-times", "Close quick actions", "close-toolbar");
            } else if (isText(target)) {
                mountTextControls();
                bar.classList.add("cg-selection-toolbar--text");
                const family = String(target.fontFamily || "Arial");
                const safeFill = /^#[0-9a-f]{6}$/i.test(String(target.fill || "")) ? target.fill : "#000000";
                const safeStroke = /^#[0-9a-f]{6}$/i.test(String(target.stroke || "")) ? target.stroke : "#000000";
                bar.innerHTML = dragHandle
                    + button("fa-pencil", "Edit Text", "edit-text")
                    + '<button type="button" class="cg-selection-toolbar__font" data-cg-selection-font-toggle aria-label="Font Family" title="Font Family" aria-haspopup="listbox" aria-expanded="false"><span data-cg-selection-font-label></span><i class="fa fa-angle-down" aria-hidden="true"></i></button>'
                    + button("fa-header", "Heading", "heading")
                    + button("fa-text-height", "Font Size", "font-size")
                    + colorButton(safeFill, safeStroke)
                    + '<button type="button" class="cg-selection-toolbar__menu-button" data-cg-selection-action="text-style" title="Text styles" aria-label="Text styles" aria-haspopup="dialog" aria-expanded="false"><i class="fa fa-bold" aria-hidden="true"></i><i class="fa fa-angle-down" aria-hidden="true"></i></button>'
                    + button(`fa-align-${target.textAlign === "justify" ? "justify" : target.textAlign === "right" ? "right" : target.textAlign === "center" ? "center" : "left"}`, "Text Alignment", "text-alignment")
                    + button("fa-ellipsis-h", "More text properties", "text-more") + button("fa-link", "Add action link", "link")
                    + groupedActionSources(commonSecondaryActions) + moreActionsButton
                    + button("fa-trash", "Delete", "delete") + button("fa-times", "Close quick actions", "close-toolbar");
                renderMoreActionsMenu(commonMoreSections);
                const fontControl = bar.querySelector("[data-cg-selection-font-toggle]");
                if (fontControl) {
                    fontControl.style.fontFamily = family;
                    fontControl.setAttribute("aria-label", `Font Family: ${family}`);
                    fontControl.querySelector("[data-cg-selection-font-label]").textContent = family;
                }
            } else {
                bar.classList.remove("cg-selection-toolbar--text");
                const canFill = target.type !== "image" && target.type !== "group";
                const safeShapeFill = /^#[0-9a-f]{6}$/i.test(String(target.fill || "")) ? target.fill : "#000000";
                const safeShapeStroke = /^#[0-9a-f]{6}$/i.test(String(target.stroke || "")) ? target.stroke : "#000000";
                const typeSpecificSecondaryActions = targetType === "image"
                    ? button("fa-download", "Download image", "download-image") + button("fa-ellipsis-h", "More image properties", "image-more")
                    : (targetType === "group"
                        ? button("fa-ellipsis-h", "More group properties", "group-more")
                        : button("fa-cube", "3D Effect", "shape-3d") + button("fa-undo", "Reset Shape Properties", "shape-reset"));
                const typeSpecificMoreSection = targetType === "image"
                    ? { label: "Image", actions: [
                        { icon: "fa-download", label: "Download image", action: "download-image" },
                        { icon: "fa-ellipsis-h", label: "Image properties", action: "image-more" }
                    ] }
                    : (targetType === "group"
                        ? { label: "Group", actions: [{ icon: "fa-ellipsis-h", label: "Group properties", action: "group-more" }] }
                        : { label: "Shape", actions: [
                            { icon: "fa-cube", label: "3D effect", action: "shape-3d" },
                            { icon: "fa-undo", label: "Reset shape properties", action: "shape-reset" }
                        ] });
                renderMoreActionsMenu([typeSpecificMoreSection, ...commonMoreSections]);
                bar.innerHTML = dragHandle
                    + (targetType === "group" ? button("fa-pencil", "Edit group objects", "edit-group") : "")
                    + (canFill ? colorButton(safeShapeFill, safeShapeStroke) : "")
                    + (canFill ? '<button type="button" data-cg-selection-action="shape-size" aria-label="Size" title="Size" aria-expanded="false" aria-controls="cgShapeSizePopover"><i class="fa fa-expand" aria-hidden="true"></i></button>' : "")
                    + (targetType === "group" ? button("fa-object-ungroup", "Ungroup objects", "ungroup") : "")
                    /* STAMP: 2026-08-31 - Use the established Replace Image
                       flow as the image toolbar's first quick action. */
                    + (targetType === "image" ? button("fa-picture-o", "Replace image", "replace-image") : "")
                    /* STAMP: 2026-09-01 - One-click proportional canvas cover
                       uses the selected Fabric image and normal history flow. */
                    + (targetType === "image"
                        ? button(
                            imageCanvasFitSnapshots.has(target) ? "fa-compress" : "fa-arrows-alt",
                            imageCanvasFitSnapshots.has(target) ? "Restore original image size" : "Fit image to canvas",
                            "image-fit-canvas"
                        )
                        : "")
                    + (targetType === "image" ? button("fa-expand", "Image Scale", "image-scale") : "")
                    + groupedActionSources(typeSpecificSecondaryActions + commonSecondaryActions) + moreActionsButton
                    + button("fa-trash", "Delete", "delete") + button("fa-times", "Close quick actions", "close-toolbar");
            }
            /* STAMP: 2026-09-13 - Locked objects remain selectable so the
               unlock action is available, while every quick size/position
               entry point is visibly and semantically disabled. */
            const lockedTransformActions = new Set([
                "font-size", "heading", "shape-size", "image-scale",
                "image-fit-canvas", "keep-in-canvas", "alignment", "transform"
            ]);
            bar.querySelectorAll("[data-cg-selection-action]").forEach((control) => {
                if (!lockedTransformActions.has(control.dataset.cgSelectionAction)) return;
                control.disabled = hasLockedTransform;
                control.setAttribute("aria-disabled", String(hasLockedTransform));
            });
            moreActionsPopover.querySelectorAll("[data-cg-more-action]").forEach((control) => {
                const source = bar.querySelector(`[data-cg-selection-action="${control.dataset.cgMoreAction}"]`);
                control.disabled = Boolean(source?.disabled);
                control.setAttribute("aria-disabled", String(Boolean(source?.disabled)));
            });
            const fontSizeRange = document.getElementById("fontsize");
            const fontSizeNumber = document.getElementById("fontsizelabel");
            if (fontSizeRange) fontSizeRange.disabled = hasLockedTransform && isText(target);
            if (fontSizeNumber) fontSizeNumber.disabled = hasLockedTransform && isText(target);
            if (imageScaleControl) imageScaleControl.disabled = hasLockedTransform && targetType === "image";
            const formatPainterControl = bar.querySelector('[data-cg-selection-action="format-painter"]');
            const isFormatPainterActive = typeof window.CGIsFormatPainterActive === "function"
                && window.CGIsFormatPainterActive();
            if (formatPainterControl) {
                formatPainterControl.classList.toggle("is-active", isFormatPainterActive);
                formatPainterControl.setAttribute("aria-pressed", String(isFormatPainterActive));
            }
            bar.hidden = false;
            window.requestAnimationFrame(position);
        };

        bar.addEventListener("mousedown", (event) => {
            const linkControl = event.target.closest('[data-cg-selection-action="link"]');
            if (linkControl) linkSelectionScope = getLinkSelectionScope(activeCanvas && activeCanvas.getActiveObject());
            event.stopPropagation();
        });
        bar.addEventListener("pointerdown", (event) => {
            const handle = event.target.closest("[data-cg-selection-drag]");
            const target = activeCanvas && activeCanvas.getActiveObject();
            if (!handle || !target || event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            toolbarDrag = { pointerId: event.pointerId, target };
            bar.classList.add("is-dragging");
            handle.setPointerCapture?.(event.pointerId);
        });
        bar.addEventListener("pointermove", (event) => {
            if (!toolbarDrag || toolbarDrag.pointerId !== event.pointerId || toolbarDrag.target !== activeCanvas?.getActiveObject()) return;
            const canvasRect = activeCanvas.upperCanvasEl.getBoundingClientRect();
            const bounds = toolbarDrag.target.getBoundingRect();
            const scaleX = canvasRect.width / activeCanvas.getWidth();
            const scaleY = canvasRect.height / activeCanvas.getHeight();
            const objectLeft = canvasRect.left + bounds.left * scaleX;
            const objectTop = canvasRect.top + bounds.top * scaleY;
            const objectWidth = bounds.width * scaleX;
            const objectHeight = bounds.height * scaleY;
            const distances = {
                top: Math.abs(event.clientY - objectTop),
                right: Math.abs(event.clientX - (objectLeft + objectWidth)),
                bottom: Math.abs(event.clientY - (objectTop + objectHeight)),
                left: Math.abs(event.clientX - objectLeft)
            };
            const side = Object.keys(distances).reduce((nearest, candidate) => distances[candidate] < distances[nearest] ? candidate : nearest, "top");
            const along = side === "top" || side === "bottom"
                ? (event.clientX - objectLeft) / Math.max(1, objectWidth)
                : (event.clientY - objectTop) / Math.max(1, objectHeight);
            toolbarPlacement = { side, along };
            position();
        });
        const endToolbarDrag = (event) => {
            if (!toolbarDrag || toolbarDrag.pointerId !== event.pointerId) return;
            toolbarDrag = null;
            bar.classList.remove("is-dragging");
        };
        bar.addEventListener("pointerup", endToolbarDrag);
        bar.addEventListener("pointercancel", endToolbarDrag);
        shapeSizePopover.addEventListener("mousedown", (event) => event.stopPropagation());
        shapeSizePopover.addEventListener("click", (event) => {
            if (event.target.closest("[data-cg-shape-size-close]")) hidePopovers();
        });
        shapeSizePopover.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                hidePopovers();
                bar.querySelector('[data-cg-selection-action="shape-size"]')?.focus();
            }
        });
        shapeSizePopover.addEventListener("input", (event) => {
            if (!event.target.matches("[data-cg-shape-size]") || !shapeSizeTarget
                || activeCanvas?.getActiveObject() !== shapeSizeTarget
                || isCanvasObjectLocked(shapeSizeTarget)) return;
            const scale = Number(event.target.value) / 100;
            const center = shapeSizeTarget.getCenterPoint();
            shapeSizeTarget.set({ scaleX: scale, scaleY: scale * shapeSizeRatio });
            // STAMP: 2026-09-05 - Match canvas-handle corner-radius normalization.
            window.CGAdjustRoundedResize?.(shapeSizeTarget);
            shapeSizeTarget.setPositionByOrigin(center, "center", "center");
            shapeSizeTarget.setCoords();
            shapeSizePopover.querySelector("[data-cg-shape-size-value]").textContent = `${event.target.value}%`;
            activeCanvas.requestRenderAll();
        });
        shapeSizePopover.addEventListener("change", (event) => {
            if (!event.target.matches("[data-cg-shape-size]") || !shapeSizeTarget
                || activeCanvas?.getActiveObject() !== shapeSizeTarget
                || isCanvasObjectLocked(shapeSizeTarget)) return;
            activeCanvas.fire("object:modified", { target: shapeSizeTarget, preserveQuickPopover: true });
            position();
        });
        document.addEventListener("mousedown", (event) => {
            if (!shapeSizePopover.hidden && !shapeSizePopover.contains(event.target)
                && !event.target.closest('[data-cg-selection-action="shape-size"]')) hidePopovers();
            if (!fontPopover.hidden && !fontPopover.contains(event.target)
                && !event.target.closest("[data-cg-selection-font-toggle]")) hidePopovers();
            if (!colorPopover.hidden && !colorPopover.contains(event.target)
                && !event.target.closest('[data-cg-selection-action="color-menu"]')) hidePopovers();
            if (!textStylePopover.hidden && !textStylePopover.contains(event.target)
                && !event.target.closest('[data-cg-selection-action="text-style"]')) hidePopovers();
        });
        opacityPopover.addEventListener("mousedown", (event) => event.stopPropagation());
        linkPopover.addEventListener("mousedown", (event) => event.stopPropagation());
        orderPopover.addEventListener("mousedown", (event) => event.stopPropagation());
        alignmentPopover.addEventListener("mousedown", (event) => event.stopPropagation());
        cropPopover.addEventListener("mousedown", (event) => event.stopPropagation());
        shadowPopover.addEventListener("mousedown", (event) => event.stopPropagation());
        interactionPopover.addEventListener("mousedown", (event) => event.stopPropagation());
        motionPopover.addEventListener("mousedown", (event) => event.stopPropagation());
        textMorePopover.addEventListener("mousedown", (event) => event.stopPropagation());
        fontPopover.addEventListener("mousedown", (event) => event.stopPropagation());
        textSizePopover.addEventListener("mousedown", (event) => event.stopPropagation());
        headingPopover.addEventListener("mousedown", (event) => event.stopPropagation());
        textAlignmentPopover.addEventListener("mousedown", (event) => event.stopPropagation());
        colorPopover.addEventListener("mousedown", (event) => event.stopPropagation());
        textStylePopover.addEventListener("mousedown", (event) => event.stopPropagation());
        shapeMorePopover.addEventListener("mousedown", (event) => event.stopPropagation());
        imageMorePopover.addEventListener("mousedown", (event) => event.stopPropagation());
        groupMorePopover.addEventListener("mousedown", (event) => event.stopPropagation());
        imageScalePopover.addEventListener("mousedown", (event) => event.stopPropagation());
        moreActionsPopover.addEventListener("mousedown", (event) => event.stopPropagation());
        moreActionsPopover.addEventListener("click", (event) => {
            if (event.target.closest("[data-cg-more-close]")) {
                hidePopovers();
                bar.querySelector('[data-cg-selection-action="more-actions"]')?.focus();
                return;
            }
            const menuControl = event.target.closest("[data-cg-more-action]");
            if (!menuControl || menuControl.disabled) return;
            const sourceControl = bar.querySelector(`[data-cg-selection-action="${menuControl.dataset.cgMoreAction}"]`);
            if (!sourceControl || sourceControl.disabled) return;
            if (menuControl.dataset.cgMoreAction.startsWith("dropdown-")) {
                const target = activeCanvas?.getActiveObject();
                if (!target) return;
                hidePopovers();
                window.openQuickActionDropdown?.(
                    target,
                    menuControl.dataset.cgMoreAction.replace("dropdown-", ""),
                    bar.querySelector('[data-cg-selection-action="more-actions"]')
                );
                return;
            }
            hidePopovers();
            sourceControl.click();
        });
        moreActionsPopover.addEventListener("keydown", (event) => {
            const controls = Array.from(moreActionsPopover.querySelectorAll("[data-cg-more-action]:not(:disabled)"));
            const index = controls.indexOf(document.activeElement);
            if (event.key === "Escape") {
                event.preventDefault();
                hidePopovers();
                bar.querySelector('[data-cg-selection-action="more-actions"]')?.focus();
            } else if ((event.key === "ArrowDown" || event.key === "ArrowUp") && controls.length) {
                event.preventDefault();
                const direction = event.key === "ArrowDown" ? 1 : -1;
                controls[(index + direction + controls.length) % controls.length].focus();
            }
        });
        colorPopover.addEventListener("click", (event) => {
            if (event.target.closest("[data-cg-quick-close]")) {
                hidePopovers();
                bar.querySelector('[data-cg-selection-action="color-menu"]')?.focus();
                return;
            }
            const tab = event.target.closest("[data-cg-color-tab]");
            const target = activeCanvas?.getActiveObject();
            if (tab && target) {
                colorMode = tab.dataset.cgColorTab;
                syncColorPopover(target);
                return;
            }
            if (!event.target.closest("[data-cg-color-choose]") || !target) return;
            const isStroke = colorMode === "stroke";
            const source = document.getElementById(isText(target)
                ? (isStroke ? "FontStroke" : "FontColor")
                : (isStroke ? "objstrokecolor" : "objbackcolor"));
            if (source) source.click();
            window.requestAnimationFrame(() => window.CGPositionColorPickerForSelection?.(bar));
        });
        textStylePopover.addEventListener("click", (event) => {
            if (event.target.closest("[data-cg-quick-close]")) {
                hidePopovers();
                bar.querySelector('[data-cg-selection-action="text-style"]')?.focus();
                return;
            }
            const control = event.target.closest("[data-cg-text-style]");
            const target = activeCanvas?.getActiveObject();
            if (!control || !isText(target)) return;
            const action = control.dataset.cgTextStyle;
            if (action === "bold") applyText(target, { fontWeight: Number(target.fontWeight) >= 600 || target.fontWeight === "bold" ? "400" : "700" });
            else if (action === "italic") applyText(target, { fontStyle: target.fontStyle === "italic" ? "normal" : "italic" });
            else if (action === "underline") applyText(target, { underline: !target.underline });
            else if (action === "strike") applyText(target, { linethrough: !target.linethrough });
            syncTextStyleControls(target);
        });
        textStylePopover.addEventListener("change", (event) => {
            const weightControl = event.target.closest("[data-cg-font-weight]");
            const target = activeCanvas?.getActiveObject();
            if (!weightControl || !isText(target)) return;
            if (typeof window.CGApplyTextFontWeight === "function") {
                window.CGApplyTextFontWeight(target, weightControl.value);
                commit(target);
            } else {
                applyText(target, { fontWeight: weightControl.value });
            }
            syncTextStyleControls(target);
        });
        [colorPopover, textStylePopover].forEach((popover) => {
            popover.addEventListener("keydown", (event) => {
                if (event.key !== "Escape") return;
                event.preventDefault();
                const action = popover === colorPopover ? "color-menu" : "text-style";
                hidePopovers();
                bar.querySelector(`[data-cg-selection-action="${action}"]`)?.focus();
            });
        });
        textMorePopover.addEventListener("click", (event) => {
            if (!event.target.closest("#TextHighlightEffect")) return;
            textMorePopover.hidden = true;
            document.getElementById("TextHighlight")?.click();
            window.requestAnimationFrame(() => window.CGPositionColorPickerForSelection?.(bar));
        });
        fontPopover.addEventListener("pointerover", (event) => {
            const option = event.target.closest("[data-cg-font-option]");
            if (option) applyFontPreview(option.dataset.cgFontOption);
        });
        fontPopover.addEventListener("pointerout", (event) => {
            const option = event.target.closest("[data-cg-font-option]");
            if (!option || event.relatedTarget?.closest?.("[data-cg-font-option]")) return;
            restoreFontPreview();
        });
        fontPopover.addEventListener("focusin", (event) => {
            const option = event.target.closest("[data-cg-font-option]");
            if (option) applyFontPreview(option.dataset.cgFontOption);
        });
        fontPopover.addEventListener("click", (event) => {
            const option = event.target.closest("[data-cg-font-option]");
            const target = activeCanvas?.getActiveObject();
            if (!option || !isText(target)) return;
            const selectedFont = option.dataset.cgFontOption;
            restoreFontPreview();
            fontPreviewState = null;
            fontPopover.hidden = true;
            const toggle = bar.querySelector("[data-cg-selection-font-toggle]");
            if (toggle) toggle.setAttribute("aria-expanded", "false");
            if (typeof window.CGApplyTextFontFamily === "function") {
                window.CGApplyTextFontFamily(target, selectedFont, () => {
                    if (toggle) {
                        toggle.style.fontFamily = selectedFont;
                        toggle.setAttribute("aria-label", `Font Family: ${selectedFont}`);
                        toggle.querySelector("[data-cg-selection-font-label]").textContent = selectedFont;
                    }
                    commit(target);
                });
            } else {
                applyText(target, { fontFamily: selectedFont });
            }
        });
        fontPopover.addEventListener("keydown", (event) => {
            const options = Array.from(fontPopover.querySelectorAll("[data-cg-font-option]"));
            const index = options.indexOf(document.activeElement);
            if (event.key === "Escape") {
                event.preventDefault();
                restoreFontPreview();
                fontPreviewState = null;
                fontPopover.hidden = true;
                const toggle = bar.querySelector("[data-cg-selection-font-toggle]");
                toggle?.setAttribute("aria-expanded", "false");
                toggle?.focus();
            } else if ((event.key === "ArrowDown" || event.key === "ArrowUp") && options.length) {
                event.preventDefault();
                const direction = event.key === "ArrowDown" ? 1 : -1;
                options[(index + direction + options.length) % options.length].focus();
            }
        });
        imageScalePopover.addEventListener("input", (event) => {
            if (!event.target.matches("#imagewidth")) return;
            imageScalePopover.querySelector("[data-cg-image-scale-value]").textContent = `${Math.round(Number(event.target.value))} px`;
            window.requestAnimationFrame(position);
        });
        textAlignmentPopover.addEventListener("click", (event) => {
            const control = event.target.closest("[data-cg-text-align]");
            const target = activeCanvas && activeCanvas.getActiveObject();
            if (!control || !isText(target)) return;
            applyText(target, { textAlign: control.dataset.cgTextAlign });
            textAlignmentPopover.hidden = true;
        });
        textSizePopover.addEventListener("click", (event) => {
            if (!event.target.closest("[data-cg-text-size-reset]")) return;
            const target = activeCanvas && activeCanvas.getActiveObject();
            if (!isText(target) || isCanvasObjectLocked(target)) return;
            const defaultSize = 30;
            const range = document.getElementById("fontsize");
            const number = document.getElementById("fontsizelabel");
            if (range) range.value = String(defaultSize);
            if (number) number.value = String(defaultSize);
            if (typeof window.CGApplyCanvasFontSize === "function") {
                window.CGApplyCanvasFontSize(defaultSize, true);
            } else {
                applyText(target, { fontSize: defaultSize });
            }
        });
        headingPopover.addEventListener("click", (event) => {
            const control = event.target.closest("[data-cg-heading-level]");
            const target = activeCanvas && activeCanvas.getActiveObject();
            if (!control || !isText(target) || isCanvasObjectLocked(target)) return;
            const level = Number(control.dataset.cgHeadingLevel);
            const size = Number(control.dataset.cgHeadingSize);
            const applyHeading = () => {
                if (!String(target.text || "").trim()) target.set("text", `Heading ${level}`);
                const headingStyle = { fontFamily: "Impact", fontWeight: "300", fontSize: size };
                target.set(headingStyle);
                if (typeof target.setSelectionStyles === "function" && typeof target.text === "string") {
                    target.setSelectionStyles(headingStyle, 0, target.text.length);
                }
                window.CGFitTextboxToContentWidth?.(target);
                target.dirty = true;
                commit(target);
            };
            headingPopover.hidden = true;
            if (typeof window.CGLoadCanvasFont === "function") window.CGLoadCanvasFont("Impact", applyHeading);
            else applyHeading();
        });
        cropPopover.addEventListener("click", (event) => {
            if (event.target.closest("[data-cg-crop-reset]") && window.CGImageCropEditor) {
                syncCropControls(window.CGImageCropEditor.resetSelection());
            }
            if (event.target.closest("[data-cg-crop-cancel]") && window.CGImageCropEditor) {
                window.CGImageCropEditor.cancel();
                cropPopover.hidden = true;
                render();
            }
            if (event.target.closest("[data-cg-crop-apply]") && window.CGImageCropEditor) {
                window.CGImageCropEditor.apply();
                cropPopover.hidden = true;
                render();
            }
        });
        linkPopover.addEventListener("input", (event) => {
            if (event.target.matches("[data-cg-link-url]")) {
                event.target.setCustomValidity("");
                linkPopover.querySelector("[data-cg-link-error]").textContent = "";
            }
        });
        linkPopover.addEventListener("click", (event) => {
            if (!event.target.closest("[data-cg-link-cancel]")) return;
            linkPopover.hidden = true;
            linkSelectionScope = null;
        });
        linkPopover.addEventListener("submit", (event) => {
            event.preventDefault();
            const target = activeCanvas && activeCanvas.getActiveObject();
            const input = linkPopover.querySelector("[data-cg-link-url]");
            const error = linkPopover.querySelector("[data-cg-link-error]");
            let url = String(input.value || "").trim();
            if (!url) {
                input.setCustomValidity("A URL is required.");
                error.textContent = "URL is required.";
                input.focus();
                return;
            }
            if (!/^[a-z][a-z\d+.-]*:\/\//i.test(url)) url = `https://${url}`;
            try {
                const parsed = new URL(url);
                if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Unsupported protocol");
                url = parsed.href;
            } catch (validationError) {
                input.setCustomValidity("Enter a valid web URL.");
                error.textContent = "Enter a valid URL, for example https://example.com.";
                input.focus();
                return;
            }
            input.setCustomValidity("");
            const saved = window.CGObjectLinkEditor && window.CGObjectLinkEditor.save(target.id, {
                url,
                openInNewTab: linkPopover.querySelector("[data-cg-link-new-tab]").checked,
                followLink: linkPopover.querySelector("[data-cg-link-follow]").checked,
                selection: linkSelectionScope
            });
            if (!saved) {
                error.textContent = "The link could not be saved. Select the text and try again.";
                return;
            }
            linkPopover.hidden = true;
            linkSelectionScope = null;
            render();
        });
        opacityPopover.addEventListener("input", (event) => {
            if (!event.target.matches("[data-cg-selection-opacity]")) return;
            const target = activeCanvas && activeCanvas.getActiveObject();
            if (!target) return;
            const opacity = Number(event.target.value);
            selectedTargets(target).forEach((object) => object.set("opacity", opacity));
            opacityPopover.querySelector("[data-cg-selection-opacity-value]").textContent = `${Math.round((1 - opacity) * 100)}%`;
            activeCanvas.requestRenderAll();
        });
        opacityPopover.addEventListener("change", (event) => {
            if (!event.target.matches("[data-cg-selection-opacity]")) return;
            const target = activeCanvas && activeCanvas.getActiveObject();
            if (target) commit(target);
        });
        orderPopover.addEventListener("click", (event) => {
            const control = event.target.closest("[data-cg-order-action]");
            const target = activeCanvas && activeCanvas.getActiveObject();
            if (!control || !target) return;
            const action = control.dataset.cgOrderAction;
            const canvasObjects = activeCanvas.getObjects();
            const targets = selectedTargets(target).slice().sort((first, second) => canvasObjects.indexOf(first) - canvasObjects.indexOf(second));
            if (action === "forward") targets.slice().reverse().forEach((object) => activeCanvas.bringObjectForward(object));
            else if (action === "backward") targets.forEach((object) => activeCanvas.sendObjectBackwards(object));
            else if (action === "front") targets.forEach((object) => activeCanvas.bringObjectToFront(object));
            else if (action === "back") targets.slice().reverse().forEach((object) => activeCanvas.sendObjectToBack(object));
            commit(target);
            orderPopover.hidden = true;
        });
        alignmentPopover.addEventListener("click", (event) => {
            const referenceControl = event.target.closest("[data-cg-alignment-reference]");
            if (referenceControl && !referenceControl.disabled) {
                alignmentReference = referenceControl.dataset.cgAlignmentReference;
                syncAlignmentReferenceControls(activeCanvas && activeCanvas.getActiveObject());
                return;
            }
            const control = event.target.closest("[data-cg-alignment-action]");
            const distributeControl = event.target.closest("[data-cg-distribute-action]");
            const smartControl = event.target.closest("[data-cg-smart-layout]");
            const target = activeCanvas && activeCanvas.getActiveObject();
            if ((!control && !distributeControl && !smartControl) || !target
                || isCanvasObjectLocked(target)) return;
            const isMultiSelection = String(target.type).toLowerCase() === "activeselection";
            /* STAMP: 2026-09-12 - Keep the visible actions unambiguous:
             * Horizontal uses canvas X (left/right); Vertical uses Y (top/bottom). */
            if (distributeControl && isMultiSelection) distributeSelection(distributeControl.dataset.cgDistributeAction);
            else if (smartControl && isMultiSelection) smartLayoutSelection();
            else if (control && isMultiSelection) {
                alignMultiSelection(control.dataset.cgAlignmentAction, alignmentPopover.querySelector("[data-cg-alignment-anchor]").checked);
            } else if (control) {
                alignSingleObject(target, control.dataset.cgAlignmentAction);
            }
            alignmentPopover.hidden = true;
            window.requestAnimationFrame(position);
        });
        transformPopover.addEventListener("click", (event) => {
            const control = event.target.closest("[data-cg-transform-action]");
            const target = activeCanvas && activeCanvas.getActiveObject();
            if (!control || !target || isCanvasObjectLocked(target)) return;
            const action = control.dataset.cgTransformAction;
            if (action === "rotate-left" || action === "rotate-right") {
                target.rotate((target.angle || 0) + (action === "rotate-left" ? -90 : 90));
            } else {
                const flipProperty = action === "flip-x" ? "flipX" : "flipY";
                target.set(flipProperty, !target[flipProperty]);
            }
            commit(target);
            transformPopover.hidden = true;
        });
        bar.addEventListener("input", (event) => {
            const target = activeCanvas && activeCanvas.getActiveObject();
            if (!target) return;
            if (event.target.matches("[data-cg-selection-color]")) isText(target) ? applyText(target, { fill: event.target.value }) : (target.set("fill", event.target.value), commit(target));
            if (event.target.matches("[data-cg-selection-stroke]")) applyText(target, { stroke: event.target.value });
            if (event.target.matches("[data-cg-selection-stroke-width]")) {
                target.set("strokeWidth", Math.max(0, Number(event.target.value) || 0));
                commit(target);
            }
            if (event.target.matches(".cg-selection-toolbar__size") && !isCanvasObjectLocked(target)) {
                applyText(target, { fontSize: Number(event.target.value) || 20 });
            }
        });
        bar.addEventListener("click", (event) => {
            const fontToggle = event.target.closest("[data-cg-selection-font-toggle]");
            if (fontToggle) {
                const target = activeCanvas?.getActiveObject();
                if (!isText(target)) return;
                const shouldOpen = fontPopover.hidden;
                hidePopovers();
                if (shouldOpen) {
                    const family = String(target.fontFamily || "Arial");
                    fontPreviewState = captureFontState(target);
                    buildFontMenu(family);
                    fontPopover.hidden = false;
                    fontToggle.setAttribute("aria-expanded", "true");
                    window.requestAnimationFrame(() => {
                        position();
                        (fontPopover.querySelector(".is-selected") || fontPopover.querySelector("[data-cg-font-option]"))?.focus();
                    });
                }
                return;
            }
            if (event.target.matches("[data-cg-selection-color], [data-cg-selection-stroke]")) {
                event.preventDefault();
                const target = activeCanvas && activeCanvas.getActiveObject();
                const isStroke = event.target.matches("[data-cg-selection-stroke]");
                const source = document.getElementById(isText(target)
                    ? (isStroke ? "FontStroke" : "FontColor")
                    : (isStroke ? "objstrokecolor" : "objbackcolor"));
                if (source) source.click();
                window.requestAnimationFrame(() => {
                    // STAMP: 2026-09-05 - Share selection-aware fill/stroke placement.
                    window.CGPositionColorPickerForSelection?.(bar);
                });
                return;
            }
            const control = event.target.closest("[data-cg-selection-action]");
            const target = activeCanvas && activeCanvas.getActiveObject();
            if (!control || !target) return;
            const action = control.dataset.cgSelectionAction;
            const lockedTransformActions = [
                "font-size", "heading", "shape-size", "image-scale",
                "image-fit-canvas", "keep-in-canvas", "alignment", "transform"
            ];
            if (isCanvasObjectLocked(target) && lockedTransformActions.includes(action)) return;
            if (action.startsWith("dropdown-")) {
                if (action === "dropdown-animation"
                    && typeof window.isCurrentSlideAnimationDisabled === "function"
                    && window.isCurrentSlideAnimationDisabled()) {
                    render();
                    return;
                }
                hidePopovers();
                window.openQuickActionDropdown?.(target, action.replace("dropdown-", ""), control);
                return;
            }
            window.dispatchEvent(new CustomEvent("cg:close-quick-dropdown"));
            window.dispatchEvent(new Event("cg:quick-dropdown-opening"));
            if (action === "save-to-library") {
                // Keep the live selection intact so the library captures the selected object.
                hidePopovers();
                document.getElementById("cgOpenObjectLibrary")?.click();
            }
            else if (action === "format-painter") {
                hidePopovers();
                if (typeof window.CGStartFormatPainter === "function") {
                    window.CGStartFormatPainter(target);
                    render();
                }
            }
            else if (action === "edit-text") {
                hidePopovers();
                window.CGRichTextComponent?.openForEdit?.(target);
            }
            else if (action === "bold") applyText(target, { fontWeight: Number(target.fontWeight) >= 600 || target.fontWeight === "bold" ? "400" : "700" });
            else if (action === "italic") applyText(target, { fontStyle: target.fontStyle === "italic" ? "normal" : "italic" });
            else if (action === "underline") applyText(target, { underline: !target.underline });
            else if (action === "strike") applyText(target, { linethrough: !target.linethrough });
            else if (action === "align") applyText(target, { textAlign: target.textAlign === "left" ? "center" : target.textAlign === "center" ? "right" : "left" });
            else if (["text-left", "text-center", "text-right", "text-justify"].includes(action)) applyText(target, { textAlign: action.replace("text-", "") });
            else if (action === "link") {
                const shouldOpen = linkPopover.hidden;
                hidePopovers();
                if (shouldOpen) {
                    linkSelectionScope = linkSelectionScope || getLinkSelectionScope(target);
                    const savedLink = window.CGObjectLinkEditor && window.CGObjectLinkEditor.get(target.id, linkSelectionScope);
                    linkPopover.querySelector("[data-cg-link-scope]").textContent = linkSelectionScope
                        ? `Selected: ${linkSelectionScope.text}`
                        : "Whole text";
                    linkPopover.querySelector("[data-cg-link-url]").value = savedLink ? savedLink.url : "";
                    linkPopover.querySelector("[data-cg-link-new-tab]").checked = savedLink ? savedLink.openInNewTab : true;
                    linkPopover.querySelector("[data-cg-link-follow]").checked = savedLink ? savedLink.followLink : true;
                    linkPopover.querySelector("[data-cg-link-error]").textContent = "";
                    linkPopover.querySelector("[data-cg-link-url]").setCustomValidity("");
                    linkPopover.hidden = false;
                    window.requestAnimationFrame(() => {
                        position();
                        linkPopover.querySelector("[data-cg-link-url]").focus();
                    });
                }
            }
            else if (action === "color-menu") {
                const shouldOpen = colorPopover.hidden;
                hidePopovers();
                if (shouldOpen) {
                    colorMode = "back";
                    syncColorPopover(target);
                    colorPopover.hidden = false;
                    control.setAttribute("aria-expanded", "true");
                    window.requestAnimationFrame(() => {
                        position();
                        colorPopover.querySelector('[data-cg-color-tab="back"]')?.focus();
                    });
                }
            }
            else if (action === "text-style") {
                const shouldOpen = textStylePopover.hidden;
                hidePopovers();
                if (shouldOpen && isText(target)) {
                    syncTextStyleControls(target);
                    textStylePopover.hidden = false;
                    control.setAttribute("aria-expanded", "true");
                    window.requestAnimationFrame(() => {
                        position();
                        textStylePopover.querySelector("[data-cg-text-style]")?.focus();
                    });
                }
            }
            else if (action === "text-more") {
                const shouldOpen = textMorePopover.hidden;
                hidePopovers();
                textMorePopover.hidden = !shouldOpen;
                window.requestAnimationFrame(position);
            }
            else if (action === "more-actions") {
                const shouldOpen = moreActionsPopover.hidden;
                hidePopovers();
                moreActionsPopover.hidden = !shouldOpen;
                control.setAttribute("aria-expanded", String(shouldOpen));
                if (shouldOpen) {
                    window.requestAnimationFrame(() => {
                        position();
                        moreActionsPopover.querySelector("[data-cg-more-action]:not(:disabled)")?.focus();
                    });
                }
            }
            else if (action === "text-highlight") {
                hidePopovers();
                document.getElementById("TextHighlight")?.click();
                window.requestAnimationFrame(() => window.CGPositionColorPickerForSelection?.(bar));
            }
            else if (action === "font-size") {
                const shouldOpen = textSizePopover.hidden;
                hidePopovers();
                textSizePopover.hidden = !shouldOpen;
                window.requestAnimationFrame(position);
            }
            else if (action === "heading") {
                const shouldOpen = headingPopover.hidden;
                hidePopovers();
                headingPopover.hidden = !shouldOpen;
                window.requestAnimationFrame(position);
            }
            else if (action === "text-alignment") {
                const shouldOpen = textAlignmentPopover.hidden;
                hidePopovers();
                textAlignmentPopover.hidden = !shouldOpen;
                window.requestAnimationFrame(position);
            }
            else if (action === "shape-size") {
                const shouldOpen = shapeSizePopover.hidden;
                hidePopovers();
                if (shouldOpen) {
                    shapeSizeTarget = target;
                    window.CGCaptureRoundedResize?.(target);
                    shapeSizeRatio = Math.abs(Number(target.scaleY) || 1) / Math.max(0.0001, Math.abs(Number(target.scaleX) || 1));
                    const percent = Math.max(1, Math.round(Math.abs(Number(target.scaleX) || 1) * 100));
                    const slider = shapeSizePopover.querySelector("[data-cg-shape-size]");
                    slider.max = String(Math.max(500, percent));
                    slider.value = String(percent);
                    shapeSizePopover.querySelector("[data-cg-shape-size-value]").textContent = `${percent}%`;
                    shapeSizePopover.hidden = false;
                    control.setAttribute("aria-expanded", "true");
                    window.requestAnimationFrame(() => { position(); slider.focus(); });
                }
            }
            else if (action === "shape-more") {
                const shouldOpen = shapeMorePopover.hidden;
                hidePopovers();
                shapeMorePopover.hidden = !shouldOpen;
                if (shapeSettingsPanel) {
                    shapeMorePopover.appendChild(shapeSettingsPanel);
                    shapeSettingsPanel.style.display = "block";
                    shapeSettingsPanel.removeAttribute("data-cg-hidden");
                    shapeSettingsPanel.removeAttribute("hidden");
                }
                window.requestAnimationFrame(position);
            }
            else if (action === "image-scale") {
                const shouldOpen = imageScalePopover.hidden;
                hidePopovers();
                imageScalePopover.hidden = !shouldOpen;
                if (imageScaleControl) {
                    const scaledWidth = Math.round((target.width || 1) * (target.scaleX || 1));
                    imageScaleControl.value = String(Math.max(Number(imageScaleControl.min) || 1, Math.min(Number(imageScaleControl.max) || 500, scaledWidth)));
                    imageScalePopover.querySelector("[data-cg-image-scale-value]").textContent = `${imageScaleControl.value} px`;
                }
                window.requestAnimationFrame(position);
            }
            else if (action === "shape-3d") document.getElementById("Shape3DEffect")?.click();
            else if (action === "shape-reset") shapeSettingsPanel?.querySelector(".cg-reset-properties")?.click();
            else if (action === "image-more" || action === "group-more") {
                const isImageMore = action === "image-more";
                const popover = isImageMore ? imageMorePopover : groupMorePopover;
                const panel = isImageMore ? imageSettingsPanel : groupSettingsPanel;
                const shouldOpen = popover.hidden;
                hidePopovers();
                popover.hidden = !shouldOpen;
                if (panel) {
                    popover.appendChild(panel);
                    panel.style.display = "block";
                    panel.removeAttribute("data-cg-hidden");
                    panel.removeAttribute("hidden");
                }
                window.requestAnimationFrame(position);
            }
            else if (action === "group" || action === "ungroup") {
                if (action === "group" && typeof window.groupActiveCanvasSelection === "function") {
                    window.groupActiveCanvasSelection();
                } else {
                    document.getElementById(action === "group" ? "groupobjects" : "ungroupobjects")?.click();
                }
                window.setTimeout(render, 0);
            }
            else if (action === "share-properties") document.getElementById("SharePropAll")?.click();
            else if (action === "keep-in-canvas") keepSelectionInsideCanvas(target);
            else if (action === "interactions") {
                const shouldOpen = interactionPopover.hidden;
                hidePopovers();
                interactionPopover.hidden = !shouldOpen;
                window.requestAnimationFrame(position);
            }
            else if (action === "motion") {
                const shouldOpen = motionPopover.hidden;
                hidePopovers();
                motionPopover.hidden = !shouldOpen;
                window.requestAnimationFrame(position);
            }
            else if (action === "lock") {
                const targets = selectedTargets(target);
                const shouldLock = !targets.every((object) => object.lockMovementX && object.lockMovementY && object.lockScalingX && object.lockScalingY && object.lockRotation);
                const lockTargets = String(target.type).toLowerCase() === "activeselection"
                    ? [target, ...targets]
                    : targets;
                lockTargets.forEach((object) => object.set({
                    lockMovementX: shouldLock,
                    lockMovementY: shouldLock,
                    lockScalingX: shouldLock,
                    lockScalingY: shouldLock,
                    lockRotation: shouldLock,
                    editable: !shouldLock
                }));
                commit(target);
            }
            else if (action === "replace-image") document.getElementById("btnchangeimagepopup")?.click();
            else if (action === "download-image" && String(target.type).toLowerCase() === "image") {
                downloadSelectedImage(target);
            }
            else if (action === "image-fit-canvas" && String(target.type).toLowerCase() === "image") {
                const originalTransform = imageCanvasFitSnapshots.get(target);
                if (originalTransform) {
                    target.set(originalTransform);
                    imageCanvasFitSnapshots.delete(target);
                } else {
                    imageCanvasFitSnapshots.set(target, {
                        left: target.left,
                        top: target.top,
                        scaleX: target.scaleX,
                        scaleY: target.scaleY,
                        originX: target.originX,
                        originY: target.originY
                    });
                    const sourceWidth = Math.max(1, Number(target.width) || 1);
                    const sourceHeight = Math.max(1, Number(target.height) || 1);
                    const coverScale = Math.max(activeCanvas.getWidth() / sourceWidth, activeCanvas.getHeight() / sourceHeight);
                    target.set({ scaleX: coverScale, scaleY: coverScale });
                    activeCanvas.centerObject(target);
                }
                commit(target);
                render();
            }
            else if (action === "edit-group") openGroupEditor(target);
            else if (action === "close-toolbar") {
                dismissedToolbarTarget = target;
                hide();
            }
            else if (action === "order") {
                const shouldOpen = orderPopover.hidden;
                hidePopovers();
                orderPopover.hidden = !shouldOpen;
                window.requestAnimationFrame(position);
            }
            else if (action === "alignment") {
                const shouldOpen = alignmentPopover.hidden;
                hidePopovers();
                const isMultiSelection = String(target.type).toLowerCase() === "activeselection";
                alignmentPopover.querySelector("[data-cg-alignment-anchor-row]").hidden = !isMultiSelection;
                alignmentPopover.querySelector("[data-cg-alignment-reference-row]").hidden = isMultiSelection;
                alignmentPopover.querySelector("[data-cg-alignment-layout]").hidden = !isMultiSelection;
                if (!isMultiSelection) syncAlignmentReferenceControls(target);
                alignmentPopover.hidden = !shouldOpen;
                window.requestAnimationFrame(position);
            }
            else if (action === "transform") {
                const shouldOpen = transformPopover.hidden;
                hidePopovers();
                transformPopover.hidden = !shouldOpen;
                window.requestAnimationFrame(position);
            }
            else if (action === "transparency") {
                const shouldOpen = opacityPopover.hidden;
                hidePopovers();
                const opacity = Number(selectedTargets(target)[0]?.opacity ?? 1);
                opacityPopover.querySelector("[data-cg-selection-opacity]").value = String(opacity);
                opacityPopover.querySelector("[data-cg-selection-opacity-value]").textContent = `${Math.round((1 - opacity) * 100)}%`;
                opacityPopover.hidden = !shouldOpen;
                window.requestAnimationFrame(position);
            }
            else if (action === "shadow") {
                const shouldOpen = shadowPopover.hidden;
                hidePopovers();
                shadowPopover.hidden = !shouldOpen;
                window.requestAnimationFrame(position);
            }
            else if (action === "rotate-left" || action === "rotate-right") { target.rotate((target.angle || 0) + (action === "rotate-left" ? -90 : 90)); commit(target); }
            else if (action === "flip-x" || action === "flip-y") { target.set(action === "flip-x" ? "flipX" : "flipY", !target[action === "flip-x" ? "flipX" : "flipY"]); commit(target); }
            else if (action === "delete") {
                /* STAMP: 2026-09-10 - ActiveSelection is a temporary wrapper;
                 * delete its canvas objects individually so Delete works for
                 * every toolbar object type. */
                const targetsToDelete = selectedTargets(target).slice();
                activeCanvas.discardActiveObject();
                targetsToDelete.forEach((object) => activeCanvas.remove(object));
                activeCanvas.requestRenderAll();
                hide();
            }
        });

        let attempts = 0;
        const bind = (readyEvent) => {
            const readyCanvas = readyEvent && readyEvent.detail
                ? readyEvent.detail.canvas
                : null;
            const availableCanvas = readyCanvas
                || window.CGCanvas
                || (typeof canvas !== "undefined" ? canvas : null);

            if (!availableCanvas || typeof availableCanvas.on !== "function") {
                if (attempts++ < 120) window.setTimeout(bind, 150);
                return;
            }

            if (activeCanvas === availableCanvas) {
                return;
            }

            activeCanvas = availableCanvas;
            const syncSelectionAnchor = (event) => {
                const target = activeCanvas.getActiveObject();
                if (window.CGImageCropEditor && window.CGImageCropEditor.isActive() && (!target || !target.isCropSelection)) {
                    window.CGImageCropEditor.cancel(false);
                    cropPopover.hidden = true;
                }
                const objects = target && String(target.type).toLowerCase() === "activeselection" ? target.getObjects() : [];
                if (objects.length && !objects.includes(selectionAnchorObject)) selectionAnchorObject = (event && event.selected && event.selected[0]) || objects[0];
                if (!objects.length && target) selectionAnchorObject = target;
                rightClickSuppressed = propertyPopupOpen;
                render();
            };
            activeCanvas.on("selection:created", syncSelectionAnchor);
            activeCanvas.on("selection:updated", syncSelectionAnchor);
            activeCanvas.on("selection:cleared", () => {
                if (window.CGImageCropEditor && window.CGImageCropEditor.isActive()) window.CGImageCropEditor.cancel(false);
                cropPopover.hidden = true;
                selectionAnchorObject = null;
                dismissedToolbarTarget = null;
                hide();
            });
            /* STAMP: 2026-08-31 - Double-click a text child inside an active
               group to open that exact child's live Text Properties editor. */
            activeCanvas.on("mouse:dblclick", (event) => {
                const group = activeCanvas.getActiveObject();
                if (!group || String(group.type).toLowerCase() !== "group" || !Array.isArray(group._objects)) return;
                const isTextChild = (child) => child && ["text", "textbox", "i-text"].includes(String(child.type).toLowerCase());
                let child = (event.subTargets || []).slice().reverse().find(isTextChild);
                if (!child && event.e && typeof activeCanvas.getScenePoint === "function") {
                    const pointer = activeCanvas.getScenePoint(event.e);
                    child = group._objects.slice().reverse().find((candidate) => isTextChild(candidate)
                        && typeof candidate.containsPoint === "function"
                        && candidate.containsPoint(pointer));
                }
                const childIndex = group._objects.indexOf(child);
                if (childIndex < 0) return;
                event.e?.preventDefault();
                openGroupChildEditor(group, childIndex);
            });
            const syncCropSelection = (event) => {
                if (event && event.target && event.target.isCropSelection && window.CGImageCropEditor) {
                    syncCropControls(window.CGImageCropEditor.getSelectionState());
                    position();
                    return;
                }
                position();
            };
            activeCanvas.on("object:moving", syncCropSelection);
            activeCanvas.on("object:scaling", syncCropSelection);
            activeCanvas.on("object:rotating", position);
            activeCanvas.on("object:modified", (event) => {
                if (event && event.target && event.target.isCropSelection && !cropPopover.hidden && window.CGImageCropEditor) {
                    syncCropControls(window.CGImageCropEditor.getSelectionState());
                }
                else if (event && event.preserveQuickPopover && (!cropPopover.hidden || !shapeSizePopover.hidden)) position();
                else render();
            });
            window.addEventListener("cg:animation-availability-changed", (event) => {
                if (event.detail && event.detail.disabled) {
                    window.dispatchEvent(new CustomEvent("cg:close-quick-dropdown"));
                }
                render();
            });
            window.addEventListener("cg:format-painter-changed", render);
            activeCanvas.on("mouse:down", (event) => {
                const nativeEvent = event && event.e;
                if (event && event.target && nativeEvent && nativeEvent.button !== 2 && !nativeEvent.shiftKey && !nativeEvent.ctrlKey && !nativeEvent.metaKey) {
                    const clickedType = String(event.target.type).toLowerCase();
                    if (clickedType !== "activeselection") selectionAnchorObject = event.target;
                    else if (!event.target.getObjects().includes(selectionAnchorObject)) selectionAnchorObject = event.target.getObjects()[0];
                }
                if (event && event.e && event.e.button === 2) {
                    rightClickSuppressed = true;
                    hide();
                }
            });
            /* STAMP: 2026-09-01 - Uniformly scale an image under the pointer
             * with the mouse wheel. Render every step immediately, then emit
             * one modified event per gesture for the existing history flow. */
            activeCanvas.on("mouse:wheel", (event) => {
                const image = event && event.target;
                const nativeEvent = event && event.e;
                if (!image || String(image.type).toLowerCase() !== "image" || !nativeEvent
                    || isCanvasObjectLocked(image)) return;
                nativeEvent.preventDefault();
                nativeEvent.stopPropagation();
                if (activeCanvas.getActiveObject() !== image) activeCanvas.setActiveObject(image);
                const factor = nativeEvent.deltaY < 0 ? 1.08 : (1 / 1.08);
                const nextScaleX = Math.max(0.02, Math.min(20, Number(image.scaleX || 1) * factor));
                const ratio = Number(image.scaleY || 1) / Math.max(0.0001, Number(image.scaleX || 1));
                image.set({ scaleX: nextScaleX, scaleY: Math.max(0.02, Math.min(20, nextScaleX * ratio)) });
                image.setCoords();
                activeCanvas.requestRenderAll();
                position();
                window.clearTimeout(imageWheelCommitTimer);
                imageWheelCommitTimer = window.setTimeout(() => commit(image), 140);
            });
            window.addEventListener("resize", position);
            canvasContainer.addEventListener("scroll", position, { passive: true });
        };
        window.addEventListener("cg:canvas-ready", bind);
        /* STAMP: 2026-08-26 - Property popup and Quick Action bar are mutually
         * exclusive. Restore Quick Actions when the popup closes if Fabric
         * still has an active selection. */
        window.addEventListener("cg:property-popup-opened", () => {
            propertyPopupOpen = true;
            rightClickSuppressed = true;
            hide();
        });
        window.addEventListener("cg:property-popup-closed", () => {
            propertyPopupOpen = false;
            rightClickSuppressed = false;
            render();
        });
        /* STAMP: 2026-08-29 - Slide navigation owns selection reset. Keep the
         * quick-action bar closed until Fabric emits a fresh selection event
         * from an object on the destination slide. */
        window.addEventListener("cg:slide-navigation-start", () => {
            selectionAnchorObject = null;
            rightClickSuppressed = false;
            hide();
        });
        window.addEventListener("cg:open-image-crop", () => {
            propertyPopupOpen = false;
            rightClickSuppressed = false;
            render();
            window.requestAnimationFrame(openCropPopover);
        });
        window.addEventListener("cg:object-context-menu-opened", () => {
            rightClickSuppressed = true;
            hide();
        });
        window.addEventListener("cg:object-context-menu-closed", (event) => {
            rightClickSuppressed = false;
            if (!event.detail || event.detail.restoreToolbar !== false) render();
        });
        bind();
    }

    /* STAMP: 2026-08-25 - Reusable large-description editor for static
     * Properties fields and dynamically rendered Action fields. */
    function initExpandableDescriptionEditor() {
        const dialog = createElement("div", "cg-description-editor");
        dialog.hidden = true;
        dialog.setAttribute("role", "dialog");
        dialog.setAttribute("aria-modal", "true");
        dialog.innerHTML = `
            <button type="button" class="cg-description-editor__backdrop" data-cg-description-close aria-label="Close editor"></button>
            <section class="cg-description-editor__panel">
                <header><div><small>Large text editor</small><h3>Description</h3></div><button type="button" data-cg-description-close aria-label="Close"><i class="fa fa-times"></i></button></header>
                <div class="cg-description-editor__toolbar" role="toolbar" aria-label="Description formatting">
                    <button type="button" data-cg-description-command="bold" title="Bold"><i class="fa fa-bold"></i></button>
                    <button type="button" data-cg-description-command="italic" title="Italic"><i class="fa fa-italic"></i></button>
                    <button type="button" data-cg-description-command="underline" title="Underline"><i class="fa fa-underline"></i></button>
                    <button type="button" data-cg-description-command="insertUnorderedList" title="Bullet list"><i class="fa fa-list-ul"></i></button>
                    <button type="button" data-cg-description-command="insertOrderedList" title="Numbered list"><i class="fa fa-list-ol"></i></button>
                </div>
                <div class="cg-description-editor__surface" contenteditable="true" role="textbox" aria-multiline="true"></div>
                <footer><button type="button" class="cg-description-editor__cancel" data-cg-description-close>Cancel</button><button type="button" class="cg-description-editor__apply">Apply</button></footer>
            </section>`;
        document.body.appendChild(dialog);
        const surface = dialog.querySelector(".cg-description-editor__surface");
        const heading = dialog.querySelector("h3");
        let sourceField = null;

        const close = () => {
            dialog.hidden = true;
            sourceField = null;
        };
        const open = (field) => {
            sourceField = field;
            const label = field.closest("label")?.querySelector(".form-label")?.textContent
                || field.previousElementSibling?.textContent
                || field.getAttribute("aria-label")
                || "Description";
            heading.textContent = String(label).trim() || "Description";
            surface.innerHTML = field.value || "";
            dialog.hidden = false;
            window.requestAnimationFrame(() => surface.focus());
        };
        const isDescriptionField = (field) => {
            if (!(field instanceof HTMLTextAreaElement)) return false;
            const signature = [field.id, field.name, field.placeholder, field.dataset.actionField, field.getAttribute("aria-label")]
                .filter(Boolean).join(" ").toLowerCase();
            return /description|descr|\bdesc\b/.test(signature);
        };
        const enhance = (root) => {
            const fields = root.matches?.("textarea") ? [root] : Array.from(root.querySelectorAll?.("textarea") || []);
            fields.filter(isDescriptionField).forEach((field) => {
                if (field.dataset.cgDescriptionExpandable === "true") return;
                field.dataset.cgDescriptionExpandable = "true";
                const wrapper = createElement("div", "cg-expandable-description");
                const expand = createElement("button", "cg-expandable-description__button");
                expand.type = "button";
                expand.title = "Expand description";
                expand.setAttribute("aria-label", "Expand description editor");
                expand.innerHTML = '<i class="fa fa-expand" aria-hidden="true"></i>';
                field.parentNode.insertBefore(wrapper, field);
                wrapper.appendChild(field);
                wrapper.appendChild(expand);
                expand.addEventListener("click", () => open(field));
            });
        };

        dialog.addEventListener("click", (event) => {
            if (event.target.closest("[data-cg-description-close]")) close();
            const command = event.target.closest("[data-cg-description-command]");
            if (command) {
                event.preventDefault();
                surface.focus();
                document.execCommand(command.dataset.cgDescriptionCommand, false, null);
            }
            if (event.target.closest(".cg-description-editor__apply") && sourceField) {
                sourceField.value = surface.innerHTML;
                sourceField.dispatchEvent(new Event("input", { bubbles: true }));
                sourceField.dispatchEvent(new Event("change", { bubbles: true }));
                close();
            }
        });
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && !dialog.hidden) close();
        });
        enhance(document);
        new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) enhance(node);
        }))).observe(document.body, { childList: true, subtree: true });
    }

    /* STAMP: 2026-08-25 - Two-stage emoji picker: radial quick reactions and
     * a searchable categorized browser. Emoji insertion remains delegated to
     * fabric-main.js so serialization and object defaults stay unchanged. */
    function initEmojiPicker() {
        const menu = document.querySelector(".cg-emoji-dropdown");
        const trigger = document.getElementById("btnEmojiDropdown");
        if (!menu || !trigger || menu.dataset.cgEmojiModern === "true") return;
        menu.dataset.cgEmojiModern = "true";
        trigger.setAttribute("data-bs-auto-close", "outside");
        const catalog = {
            "Frequently used": ["➕", "👍", "👎", "👀", "😍", "😂", "🔥", "😀", "😅"],
            "Smileys & People": ["😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😋", "😛", "😜", "🤪", "🤔", "🫡", "🤗", "🥳", "😎", "😢", "😭", "😡", "👍", "👎", "👏", "🙌", "🙏", "💪", "👋", "👌"],
            "Animals & Nature": ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🌱", "🌿", "🍀", "🌸", "🌞", "⭐", "🌈", "🔥"],
            "Food & Drink": ["🍎", "🍊", "🍋", "🍉", "🍇", "🍓", "🍒", "🥑", "🍕", "🍔", "🍟", "🌮", "🍰", "☕", "🥤"],
            "Activities": ["⚽", "🏀", "🏈", "⚾", "🎾", "🏐", "🎯", "🏆", "🎨", "🎭", "🎮", "🎲", "🎉", "🎊"],
            "Travel & Places": ["🚗", "🚕", "🚌", "🚎", "🏎️", "🚓", "🚑", "🚒", "🚲", "✈️", "🚀", "🏠", "🏢", "🏖️"],
            "Objects": ["⌚", "📱", "💻", "⌨️", "🖥️", "📷", "💡", "📚", "📝", "📌", "🔔", "🔗", "✉️", "🎁"],
            "Symbols": ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "⭐", "✨", "✅", "❌", "⚠️", "❓", "❗", "➕", "➖"]
        };
        const quick = ["❤️", "👍", "+1", "⭐", "❓", "👎", "🔴", "👀"];
        const categoryIcons = ["fa-clock-o", "fa-smile-o", "fa-leaf", "fa-apple", "fa-futbol-o", "fa-plane", "fa-paperclip", "fa-heart-o"];
        menu.innerHTML = `<li class="cg-emoji-wheel-view"><div class="cg-emoji-wheel" aria-label="Quick emoji reactions">${quick.map((emoji, index) => `<button type="button" class="cg-emoji-option cg-emoji-wheel__item" style="--emoji-index:${index}" data-emoji="${emoji}">${emoji}</button>`).join("")}<button type="button" class="cg-emoji-wheel__more" aria-label="Show all emojis" title="Show all emojis">😂<span>•••</span></button></div></li>
            <li class="cg-emoji-browser" hidden><div class="cg-emoji-browser__tabs">${Object.keys(catalog).map((name, index) => `<button type="button" data-emoji-category="${name}" class="${index === 0 ? "is-active" : ""}" title="${name}"><i class="fa ${categoryIcons[index]}"></i></button>`).join("")}</div><label class="cg-emoji-browser__search"><i class="fa fa-search"></i><input type="search" placeholder="Search" aria-label="Search emojis"></label><div class="cg-emoji-browser__content"></div><footer><span>☝</span><button type="button" class="cg-emoji-browser__skin" title="Skin tone">🟡</button></footer></li>`;
        const wheelView = menu.querySelector(".cg-emoji-wheel-view");
        const browser = menu.querySelector(".cg-emoji-browser");
        const content = menu.querySelector(".cg-emoji-browser__content");
        const search = menu.querySelector(".cg-emoji-browser__search input");
        const recentKey = "cgRecentEmojis";
        const getRecent = () => {
            try { return JSON.parse(window.localStorage.getItem(recentKey) || "[]"); } catch (_) { return []; }
        };
        const render = () => {
            const query = search.value.trim().toLowerCase();
            content.innerHTML = Object.entries(catalog).map(([name, values]) => {
                const source = name === "Frequently used" ? [...getRecent(), ...values] : values;
                const emojis = Array.from(new Set(source)).filter((emoji) => !query || emoji.includes(query) || name.toLowerCase().includes(query));
                if (!emojis.length) return "";
                return `<section class="cg-emoji-browser__section" data-emoji-section="${name}"><h4>${name}</h4><div class="cg-emoji-browser__grid">${emojis.map((emoji) => `<button type="button" class="cg-emoji-option" data-emoji="${emoji}">${emoji}</button>`).join("")}</div></section>`;
            }).join("");
        };
        menu.addEventListener("click", (event) => {
            /* STAMP: 2026-08-27 - Emoji option clicks must bubble to the
               delegated Fabric insertion handler in fabric-main.js. */
            if (event.target.closest(".cg-emoji-wheel__more")) {
                wheelView.hidden = true;
                browser.hidden = false;
                render();
                search.focus();
            }
            const tab = event.target.closest("[data-emoji-category]");
            if (tab) {
                menu.querySelectorAll("[data-emoji-category]").forEach((item) => item.classList.toggle("is-active", item === tab));
                const section = Array.from(content.querySelectorAll("[data-emoji-section]")).find((item) => item.dataset.emojiSection === tab.dataset.emojiCategory);
                if (section) content.scrollTo({ top: section.offsetTop - content.offsetTop, behavior: "smooth" });
            }
            const option = event.target.closest(".cg-emoji-option");
            if (option) {
                const recent = [option.dataset.emoji, ...getRecent().filter((item) => item !== option.dataset.emoji)].slice(0, 18);
                window.localStorage.setItem(recentKey, JSON.stringify(recent));
            }
        });
        search.addEventListener("input", render);
        trigger.addEventListener("click", () => {
            wheelView.hidden = false;
            browser.hidden = true;
            search.value = "";
        });
    }

    function init() {
        const hub = document.getElementById("canvashub");
        const toolbar = document.getElementById("canvasheader");
        const canvasContainer = document.getElementById("canvas-container");
        const propertyBars = document.getElementById("propertybars");
        const slideBars = document.getElementById("slidebars");

        if (!hub || !toolbar || !canvasContainer || !propertyBars || hub.dataset.cgModernized === "true") {
            return;
        }

        hub.dataset.cgModernized = "true";
        document.body.classList.add("cg-modern-theme");

        decorateToolbar(toolbar);
        setupFloatingCanvasToolbar(toolbar);
        setupToolbarSelectionDismissal(toolbar);
        enableDraggableDropdownMenus(document);
        enableCanvasDropdownClose(canvasContainer);
        decorateSlideBar(toolbar, slideBars);
        setupSlideIconLabel(toolbar);
        buildWorkspace(hub, canvasContainer, propertyBars, slideBars);
        setupShapeLibrary();
        setupPresetComponentIslands();
        setupSlidePanelToggle(toolbar, slideBars);
        setupLayersIsland(canvasContainer);
        setupEmptyCanvasHint(canvasContainer);
        decoratePropertyBars(propertyBars);
        monitorPropertyPanels(propertyBars);
        keepDockVisible(slideBars);
        setupTextHeadingFlyout();
        setupTextEditBlockToggle();
        monitorSlides(slideBars);
        initQuickObjectPopup(propertyBars);
        initSelectionToolbar(canvasContainer);
        initExpandableDescriptionEditor();
        initEmojiPicker();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
