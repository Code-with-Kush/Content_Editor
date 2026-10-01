/**
 * Canvas Tutorial
 * STAMP: 2026-09-14
 *
 * A data-driven guide for the live Content Generator UI. Lessons only point to
 * existing controls; Try It leaves the original handlers in charge. Temporary
 * Fabric practice objects are excluded from export and removed without adding
 * an undo-history entry.
 */
/* eslint-disable no-use-before-define -- named functions keep the standalone tutorial lifecycle readable and hoist-safe. */
(function (window, document) {
    "use strict"

    const STORAGE_KEY = "iaotcore.content-generator.canvas-tutorial.v1"
    const CATEGORY_ORDER = ["Canvas Navigation", "Add Content", "Canvas Actions", "Slides", "Canvas Utilities", "Keyboard Shortcuts"]
    const CATEGORY_ICONS = {
        "Canvas Navigation": "fa-location-arrow",
        "Add Content": "fa-plus-circle",
        "Canvas Actions": "fa-magic",
        Slides: "fa-clone",
        "Canvas Utilities": "fa-wrench",
        "Keyboard Shortcuts": "fa-keyboard-o"
    }

    /**
     * Each lesson resolves its target from the live editor at display time.
     * Existing IDs and accessible names are preferred; data attributes are only
     * used for the Help entry point and controls that already expose them.
     */
    const tutorialSteps = [
        lesson("select-tool", "Canvas Navigation", ".cg-floating-canvas-toolbar__select", "Select / Pointer", "Select objects so you can edit, move, resize, or open their quick controls.", ["Choose Select in the top toolbar.", "Click an object on the canvas.", "Use its handles or contextual toolbar."], "Press V to return to selection in editors that support the shortcut."),
        lesson("pan-tool", "Canvas Navigation", ".cg-floating-canvas-toolbar__navigate", "Pan / Hand", "Move around a zoomed canvas without moving its objects.", ["Choose the Hand tool.", "Drag an empty area of the canvas.", "Choose Select when you are ready to edit again."], "Hold Alt while dragging for temporary canvas navigation."),
        lesson("zoom-in", "Canvas Navigation", "#zoomIn", "Zoom In", "Increase the visual canvas scale while authored object coordinates stay unchanged.", ["Click plus once or several times.", "Watch the percentage update.", "Pan if part of the canvas moves off screen."], "Zoom changes your view, not the saved object sizes."),
        lesson("zoom-out", "Canvas Navigation", "#zoomOut", "Zoom Out", "Reduce the visual canvas scale to see more of the slide.", ["Click minus.", "Check the percentage readout.", "Continue until the full work area is comfortable."], "Use Reset Zoom when you want the standard view."),
        lesson("reset-zoom", "Canvas Navigation", "#ResetZoom", "Reset / Fit Canvas", "Return the viewport to the editor's normal canvas scale and position.", ["Click Reset Zoom.", "Confirm the zoom percentage returns to its baseline.", "Continue editing normally."], "This does not clear or resize slide content."),
        lesson("grid-mode", "Canvas Navigation", "#grid-mode", "Grid Mode", "Show the grid and snap moved objects to regular increments for cleaner layouts.", ["Click Grid Mode to turn it on.", "Move an object and notice the snapping.", "Click again when you want free positioning."], "Combine the grid with alignment tools for precise layouts."),

        lesson("canvas-background", "Add Content", "#canvasback", "Canvas Background", "Choose the slide's background colour or image using the existing background editor.", ["Open Canvas Background.", "Choose the required background.", "Preview the contrast with your content."], "Keep strong contrast between the background and readable text."),
        lesson("add-image", "Add Content", "#image", "Image", "Upload one or more supported images as editable canvas objects.", ["Click Image.", "Choose a JPG, PNG, BMP, GIF, or WebP file.", "Position and scale the inserted image."], "Large source images can be resized after insertion."),
        lesson("shape-library", "Add Content", ".cg-shape-toggle", "Shapes", "Open the shape library for connectors, basic shapes, flowchart items, and table-like layouts.", ["Open Shapes.", "Search or expand a section.", "Choose a shape, then click the canvas to place it."], "The mouse cursor previews the selected shape before placement.", "shapes"),
        lesson("basic-shapes", "Add Content", "#circle", "Basic Shapes / Circle", "Add rectangles, circles, diamonds, triangles, polygons, arrows, callouts, and other editable primitives.", ["Open Shapes.", "Choose a basic shape such as Circle.", "Click the canvas where it should appear, then resize or style it."], "Press Escape before placing the shape if you want to cancel.", "shapes"),
        lesson("connections", "Add Content", "[data-shape-preset='nodes']", "Connections / Nodes", "Add connectors, arrows, and connected-node diagrams from the Shapes library.", ["Open the Connections section.", "Choose a connector or Connected nodes.", "Click the canvas to place it, then resize and position the result."], "Use connector presets to explain flows without drawing each segment manually.", "shapes"),
        // STAMP: 2026-09-15 - Normal text is now positioned by the author's next canvas click.
        lesson("add-text", "Add Content", "#addDirectText", "Text", "Place editable Arial 16 text anywhere on the current slide.", ["Click Text.", "Click the canvas where the text should begin.", "Type at the blinking cursor, then use the contextual controls to format it."], "Press Escape before placing the text if you want to cancel."),
        lesson("components", "Add Content", ".cg-component-menu__toggle", "Interactive Components", "Open reusable interactive content such as Flip Cards, Tree Nodes, Stickers, and the Object Library.", ["Open Components.", "Choose the component type.", "Complete its existing editor and add it to the canvas."], "Components keep their normal actions and animations when saved."),
        lesson("emoji", "Add Content", "#btnEmojiDropdown", "Emoji / Icons", "Insert a quick visual symbol as an editable canvas text object.", ["Open Emoji.", "Search or browse the available symbols.", "Select one, then size and position it."], "Use emoji sparingly to support meaning, not replace important labels."),
        lesson("slide-audio", "Add Content", "#btnAudioDropdown", "Slide Audio", "Attach narration or other audio to the active slide when the audio control is available.", ["Open Audio.", "Upload an MP3 or WAV file.", "Preview it and choose whether it plays only once."], "Audio belongs to the slide, not an individual canvas object.", null, true),
        lesson("video-embed", "Add Content", "#divVideoLink button", "Video Embed", "Attach a validated YouTube or Vimeo link to the active slide when this control is available.", ["Open Video Embed.", "Paste a supported URL or iframe snippet.", "Preview it before choosing Add."], "Always preview embedded media before saving the slide.", null, true),

        lesson("select-object", "Canvas Actions", ".upper-canvas", "Object Selection", "Select the temporary practice object to reveal its real Fabric controls.", ["Click the blue practice object.", "Confirm the outline and handles appear.", "Use the quick toolbar for more actions."], "Shift-click is commonly used for multi-selection.", "demo"),
        lesson("move-object", "Canvas Actions", ".upper-canvas", "Move an Object", "Drag an object to reposition it while the canvas preserves the rest of the slide.", ["Click Try It.", "Drag the blue practice object from its centre.", "Release it at the desired position."], "Enable Grid Mode when objects need consistent spacing.", "demo"),
        lesson("resize-object", "Canvas Actions", ".upper-canvas", "Resize an Object", "Use the selection handles to change an object's displayed size.", ["Click Try It.", "Drag a corner handle on the practice object.", "Release when the size is right."], "Corner handles preserve proportions more predictably than side handles.", "demo"),
        lesson("rotate-object", "Canvas Actions", ".upper-canvas", "Rotate an Object", "Rotate an object with its Fabric rotation handle.", ["Click Try It.", "Drag the rotation handle above the practice object.", "Release at the desired angle."], "The Transform quick action also offers exact 90-degree rotation.", "demo"),
        lesson("object-appearance", "Canvas Actions", "[data-cg-selection-action='color-menu']", "Colour and Size", "Adjust a shape's fill, stroke, and proportional size from its contextual Quick Action Bar.", ["Select the practice shape.", "Open Colour to choose Back or Stroke.", "Use Size for proportional scaling."], "Quick controls update the same live object shown on the canvas.", "demo"),
        lesson("object-quick-controls", "Canvas Actions", "[data-cg-selection-action='dropdown-quick']", "Quick Controls", "Open the full property inspector for the selected object without leaving the canvas.", ["Select an object.", "Choose Quick Controls.", "Edit the available type-specific properties."], "The fields change for text, images, shapes, groups, and widgets.", "demo"),
        lesson("object-animation", "Canvas Actions", "[data-cg-selection-action='dropdown-animation']", "Object Animation", "Configure entry, exit, timing, and supported audio animation for the selected object.", ["Select an object.", "Open Animation.", "Choose the effect and timing, then add it."], "Preview the slide to verify animation order and timing.", "demo"),
        lesson("object-actions", "Canvas Actions", "[data-cg-selection-action='dropdown-actions']", "Object Actions", "Attach learner interactions such as links, documents, slide changes, media, or descriptions.", ["Select an object.", "Open Actions.", "Choose an action type and complete its existing fields."], "Use clear labels so learners understand which objects are interactive.", "demo"),
        lesson("share-properties", "Canvas Actions", "[data-cg-selection-action='share-properties']", "Share Properties", "Copy supported styling, behaviour, actions, and animation from one object to another through the existing share flow.", ["Select the source object.", "Choose Share Properties.", "Select the destination object when prompted."], "The existing transfer handler remains the source of truth.", "demo"),
        lesson("keep-in-canvas", "Canvas Actions", "[data-cg-selection-action='keep-in-canvas']", "Move Inside Canvas", "Recover an object whose bounds extend beyond the editable slide.", ["Select the object.", "Choose Move inside canvas.", "Fine-tune its final position."], "This changes object position only when you click the real action.", "demo"),
        lesson("object-alignment", "Canvas Actions", "[data-cg-selection-action='alignment']", "Alignment", "Align the selection to the canvas, an object behind it, or distribute multiple selected objects.", ["Select one or more objects.", "Open Alignment.", "Choose the reference and direction."], "Use Object behind when aligning labels inside a larger shape.", "demo"),
        lesson("object-transform", "Canvas Actions", "[data-cg-selection-action='transform']", "Transform", "Rotate by 90 degrees or flip the selected object horizontally or vertically.", ["Select an object.", "Open Transform.", "Choose rotate or flip."], "Transform commands are useful when drag rotation needs exact increments.", "demo"),
        lesson("object-order", "Canvas Actions", "[data-cg-selection-action='order']", "Object Order", "Move the selected object forward, backward, to the front, or to the back of the layer stack.", ["Select an overlapping object.", "Open Order.", "Choose the required depth command."], "You can also inspect the complete stack in Layers.", "demo"),
        lesson("object-transparency", "Canvas Actions", "[data-cg-selection-action='transparency']", "Transparency", "Adjust the selected object's opacity without changing its colour values.", ["Select an object.", "Open Transparency.", "Move the slider while watching the canvas."], "Lower opacity can help create subtle overlays and watermarks.", "demo"),
        lesson("object-lock", "Canvas Actions", "[data-cg-selection-action='lock']", "Lock / Unlock", "Protect an object's position, size, and rotation from accidental edits, or unlock it again.", ["Select the object.", "Choose Lock.", "Use the same control later to unlock it."], "Lock background and framing elements after placing them.", "demo"),
        lesson("save-object-library", "Canvas Actions", "[data-cg-selection-action='save-to-library']", "Save to Object Library", "Store the selected reusable object with its supported styling and behaviour for later content.", ["Select the object.", "Choose Save to object library.", "Complete the existing library details."], "Use clear library names so the object is easy to find later.", "demo"),
        lesson("close-quick-actions", "Canvas Actions", "[data-cg-selection-action='close-toolbar']", "Close Quick Actions", "Dismiss the contextual toolbar while keeping the canvas and selected object available.", ["Select an object.", "Choose the X at the end of Quick Actions.", "Click the object again whenever you need the controls."], "Closing Quick Actions does not delete or deselect the object data.", "demo"),
        lesson("duplicate-object", "Canvas Actions", "#cgLayerDuplicate", "Duplicate an Object", "Clone the selected object through the existing Layers action.", ["Select the practice object.", "Open Layers if needed.", "Choose Duplicate selected layer."], "The duplicate keeps supported properties, actions, and animation references.", "demo-layers"),
        lesson("delete-object", "Canvas Actions", "[data-cg-selection-action='delete']", "Delete an Object", "Remove the selected object through its contextual quick controls.", ["Select the practice object.", "Choose Delete in the quick toolbar.", "Confirm only when you intend to remove it."], "The tutorial never confirms deletion for you.", "demo"),
        lesson("undo-redo", "Canvas Actions", "#undo", "Undo / Redo", "Travel backward or forward through the current slide's edit history.", ["Make a normal canvas edit.", "Use Undo to reverse it.", "Use Redo to restore it when available."], "Ctrl+Z undoes; Ctrl+Y or Ctrl+Shift+Z redoes.", null, true),
        lesson("clear-canvas", "Canvas Actions", "#clear", "Clear Canvas", "Remove the current slide's canvas objects after the existing confirmation flow.", ["Choose Clear only when you want an empty slide.", "Review the confirmation.", "Cancel if any content must remain."], "This tutorial never activates or confirms Clear Canvas."),
        lesson("refresh-editor", "Canvas Actions", "#refresh", "Refresh", "Reload the editor view through its established refresh action.", ["Save important work first.", "Choose Refresh.", "Wait for the editor to rebuild the workspace."], "Use this for a stale editor view, not as an undo command."),
        lesson("json-code", "Canvas Actions", "#openJsonDataEditor", "Content Code", "Inspect or edit the deck's complete ContentData JSON in the existing full-screen editor.", ["Open Code.", "Search or format the JSON.", "Apply only valid changes you understand."], "Normal canvas editing is safer for routine layout work.", null, true),
        lesson("import-content", "Canvas Actions", "#btnimport", "Import Content", "Load supported packaged or text content through the existing import workflow.", ["Choose Import.", "Select a supported ZIP or TXT file.", "Review the resulting slides before saving."], "Import into a test deck first when the source is unfamiliar."),
        lesson("export-content", "Canvas Actions", "#btndownload", "Export Content", "Download the current generated content using the existing export handler.", ["Review the slide deck.", "Choose Export.", "Keep the downloaded package with its related assets."], "Preview before export to catch layout or media issues.", null, true),
        lesson("editor-settings", "Canvas Actions", "#openSettingModal", "Settings", "Open the editor's slide and canvas behaviour settings.", ["Choose Settings.", "Review the available options.", "Apply only the changes needed for this content."], "Settings can affect how objects and slides behave during playback."),
        lesson("preview-content", "Canvas Actions", "#btnpreview", "Preview", "Open the learner-facing preview without leaving the editor.", ["Choose Preview.", "Navigate through every slide.", "Close the preview to continue editing."], "Check interactions and media in Preview, not only on the authoring canvas.", null, true),
        lesson("save-content", "Canvas Actions", "[aria-label='Save content']", "Save / Submit", "Delegate the current content to the owning Add or Edit Content screen for saving.", ["Review the canvas and slides.", "Choose Save.", "Complete any parent-screen validation or submission."], "Save before closing a long editing session.", null, true),
        lesson("close-editor", "Canvas Actions", "[aria-label='Cancel content editing']", "Close / Exit", "Return to the owning screen through the existing cancel flow.", ["Choose Cancel or Close.", "Review any unsaved-change warning.", "Stay in the editor if more work is needed."], "The tutorial never closes the editor automatically."),

        lesson("slides-panel", "Slides", ".cg-slide-shell", "Slides Panel", "See and manage the complete slide stack in the right-side rail.", ["Open the Slides panel if it is collapsed.", "Review the slide count and thumbnails.", "Use its close button when you need more canvas room."], "Closing the rail does not remove slides.", "slides"),
        lesson("add-slide", "Slides", "#slidesection .addSlide:first-of-type", "Add Slide", "Create a new slide through the existing slide builder.", ["Open Slides.", "Choose Add.", "Design the new blank slide."], "A new slide is added only when you click the real Add control.", "slides"),
        lesson("import-slide", "Slides", "#Choosetemplate", "Import Slide", "Create a slide from an available template or imported source.", ["Open Slides.", "Choose Import.", "Select the source and review the new slide."], "Imported slides remain editable after they load.", "slides"),
        lesson("slide-thumbnail", "Slides", ".generatedSlides > .sld:first-child", "Select a Slide", "Switch the live canvas by choosing a slide thumbnail.", ["Open Slides.", "Click a thumbnail.", "Confirm its name and content appear on the canvas."], "Save object edits before moving rapidly between slides.", "slides", true),
        lesson("slide-reorder", "Slides", ".generatedSlides", "Reorder Slides", "Drag thumbnails to change the learner's slide sequence.", ["Open Slides.", "Drag a thumbnail up or down.", "Release it in the required position."], "Review Next/Previous navigation after reordering.", "slides"),
        lesson("slide-menu", "Slides", ".cg-slide-action-button", "Slide Menu", "Open per-slide Preview, Clone, Settings, Media, Animation, Actions, Authoring Tools, AI, and Delete commands.", ["Open Slides.", "Choose the three-dot button on a thumbnail.", "Select the required existing command."], "Delete Slide always uses its confirmation; Clone is the safe way to experiment.", "slides", true),

        lesson("layers", "Canvas Utilities", "#cgLayersIslandToggle", "Layers / Object List", "Open the ordered list of canvas objects for selection, visibility, duplication, deletion, and reordering.", ["Choose Layers.", "Select an object row.", "Use row or footer actions as needed."], "Layer order controls which objects appear in front.", "layers"),
        lesson("keyboard-shortcuts", "Canvas Utilities", ".cg-canvas-stage", "Keyboard Shortcuts", "Use standard editing shortcuts while focus is in the canvas editor.", ["Select an object.", "Use Ctrl+C and Ctrl+V to copy and paste.", "Use Ctrl+Z to undo or Delete to request removal."], "Mac users can use Command for supported copy, paste, and history shortcuts.", "demo"),
        lesson("tutorial-help", "Canvas Utilities", "[data-tutorial-id='canvas-help']", "Help / Canvas Tutorial", "Return to this guide whenever you need a feature refresher.", ["Click the ? control.", "Choose a category or lesson.", "Resume from your saved progress later."], "Progress is stored locally in this browser."),

        // STAMP: 2026-09-16 - General shortcuts are distinct from text-only commands.
        // Keep the lesson ID for existing saved tutorial progress.
        lesson("canvas-background-shortcut", "Keyboard Shortcuts", ".cg-canvas-stage", "General shortcuts", "Use editor commands for canvas display and Format Painter across supported object types.", [], "Select one source object before starting Format Painter. Shortcuts do not intercept form fields or active text editing. Canvas display remains a local browser preference.", "general-shortcuts"),
        lesson("format-painter", "Canvas Actions", ".cg-selection-toolbar", "Format Painter", "Copy a selected object's formatting onto matching objects while retaining their text/content, identity, position and actions.", ["Select one object with the formatting you want to copy.", "Press {formatPainterKey}, or choose Format Painter in the object's Controls menu.", "Click a matching object to apply the copied style. Compatible objects in a multi-selection can receive the style together.", "Painter mode ends after successful application. Press {formatPainterKey} again or {cancelPainterKey} to cancel."], "Text can paint text, vector shapes can paint compatible shapes, and groups must have compatible children. Incompatible objects are skipped; Ctrl+Z undoes applied formatting."),
        lesson("text-keyboard-shortcuts", "Keyboard Shortcuts", ".upper-canvas", "Text Shortcuts", "Format only the selected text object or selected characters without opening a toolbar.", [], "Select a text object first. These commands do not change images, shapes, widgets, or form fields.", "text-shortcuts")
    ]

    function lesson(id, category, target, title, description, steps, tip, action, optional) {
        return { id, category, target, title, description, steps, tip, action: action || null, optional: optional === true }
    }

    /* STAMP: 2026-09-14 - Read the shared registries at render time so future
     * shortcut additions automatically appear in the matching tutorial lesson. */
    function getStepInstructions(step) {
        if (step.id === "format-painter") {
            const items = window.CGGeneralShortcuts?.items || []
            const painterKey = items.find(item => item.id === "format-painter")?.label || "Alt+P"
            const cancelKey = items.find(item => item.id === "cancel-format-painter")?.label || "Escape"
            return step.steps.map(instruction => instruction.replaceAll("{formatPainterKey}", painterKey).replaceAll("{cancelPainterKey}", cancelKey))
        }
        if (step.action !== "text-shortcuts" && step.action !== "general-shortcuts") return step.steps
        const registry = step.action === "general-shortcuts" ? window.CGGeneralShortcuts : window.CGTextShortcuts
        const shortcuts = registry?.items || []
        return shortcuts.map(function (shortcut) {
            const label = shortcut.macLabel ? `${shortcut.label} (${shortcut.macLabel} on Mac)` : shortcut.label
            return `${label} — ${shortcut.description}`
        })
    }

    const state = {
        root: null,
        helpButton: null,
        activeCategory: CATEGORY_ORDER[0],
        activeIndex: -1,
        target: null,
        completed: readProgress(),
        demoObject: null,
        previousActiveObject: null,
        previousRestoring: null,
        raf: 0
    }

    function readProgress() {
        try {
            const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]")
            return new Set(Array.isArray(parsed) ? parsed : [])
        } catch (error) {
            return new Set()
        }
    }

    function saveProgress() {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(state.completed)))
        } catch (error) {
            // Restricted storage must never block the tutorial.
        }
    }

    function isVisible(element) {
        if (!(element instanceof HTMLElement)) return false
        const style = window.getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return !element.hidden && style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0
    }

    function resolveTarget(step) {
        const candidates = Array.from(document.querySelectorAll(step.target))
        return candidates.find(isVisible) || null
    }

    function closeLeftIslands() {
        window.CGShapeSidebar?.close?.()
        window.CGLayersIsland?.close?.()
        window.CGStickerIsland?.close?.()
        window.CGObjectLibraryIsland?.close?.()
        window.CGFlipCardIsland?.close?.()
        window.CGTreeNodesIsland?.close?.()
    }

    function getEditorCanvas() {
        const candidate = typeof canvas !== "undefined" ? canvas : null
        return candidate && typeof candidate.getObjects === "function" && typeof candidate.requestRenderAll === "function" ? candidate : null
    }

    function getHistoryConfig() {
        return typeof ruConfig !== "undefined" ? ruConfig : null
    }

    function getSelectedSlideId() {
        return typeof selected_slide_id !== "undefined" ? selected_slide_id : ""
    }

    function prepareStep(step) {
        closeDemoObject()
        if (step.action !== "shapes") window.CGShapeSidebar?.close?.()
        if (step.action !== "layers" && step.action !== "demo-layers") window.CGLayersIsland?.close?.()
        if (step.action === "slides") window.CGSlidePanel?.open?.()
        if (step.action === "layers") window.CGLayersIsland?.open?.()
        if (step.action === "shapes") window.CGShapeSidebar?.open?.()
        if (step.action === "demo" || step.action === "demo-layers") createDemoObject()
        if (step.action === "demo-layers") window.CGLayersIsland?.open?.()
    }

    function createDemoObject() {
        const editorCanvas = getEditorCanvas()
        const historyConfig = getHistoryConfig()
        if (!editorCanvas || !window.fabric || typeof editorCanvas.add !== "function") return
        const width = Math.max(110, Math.min(180, editorCanvas.getWidth() * 0.2))
        const height = Math.max(70, Math.min(110, editorCanvas.getHeight() * 0.2))
        state.previousActiveObject = editorCanvas.getActiveObject?.() || null
        if (historyConfig) {
            state.previousRestoring = historyConfig.isRestoring
            historyConfig.isRestoring = true
        }
        const object = new window.fabric.Rect({
            id: `cg_tutorial_demo_${  Date.now()}`,
            name: "Tutorial practice object",
            left: Math.max(40, (editorCanvas.getWidth() - width) / 2),
            top: Math.max(40, (editorCanvas.getHeight() - height) / 2),
            width,
            height,
            rx: 14,
            ry: 14,
            fill: "#4f46e5",
            stroke: "#ffffff",
            strokeWidth: 3,
            shadow: new window.fabric.Shadow({ color: "rgba(79, 70, 229, 0.32)", blur: 18, offsetX: 0, offsetY: 8 }),
            selectable: true,
            evented: true,
            excludeFromExport: true,
            tutorialOnly: true
        })
        state.demoObject = object
        editorCanvas.add(object)
        window.applyCanvasObjectActionControls?.(object)
        object.setCoords()
        editorCanvas.setActiveObject(object)
        editorCanvas.requestRenderAll()
        window.LoadTimeline?.()
    }

    function closeDemoObject() {
        const hadDemoSession = Boolean(state.demoObject) || state.previousRestoring !== null
        if (!hadDemoSession) return
        const editorCanvas = getEditorCanvas()
        const historyConfig = getHistoryConfig()
        if (editorCanvas && state.demoObject && editorCanvas.getObjects().indexOf(state.demoObject) !== -1) {
            editorCanvas.remove(state.demoObject)
        }
        if (editorCanvas) {
            if (state.previousActiveObject && editorCanvas.getObjects().indexOf(state.previousActiveObject) !== -1) {
                editorCanvas.setActiveObject(state.previousActiveObject)
            } else {
                editorCanvas.discardActiveObject()
            }
            editorCanvas.requestRenderAll?.()
            window.LoadTimeline?.()
            const slideId = getSelectedSlideId()
            if (typeof updateSlideThumbnail === "function" && slideId) {
                updateSlideThumbnail(slideId, editorCanvas.toDataURL())
            }
        }
        if (historyConfig && state.previousRestoring !== null) {
            historyConfig.isRestoring = state.previousRestoring
        }
        state.demoObject = null
        state.previousActiveObject = null
        state.previousRestoring = null
    }

    function buildRoot() {
        const root = document.createElement("div")
        root.id = "cgCanvasTutorial"
        root.className = "cg-tutorial"
        root.hidden = true
        root.setAttribute("role", "dialog")
        root.setAttribute("aria-modal", "true")
        root.setAttribute("aria-labelledby", "cgTutorialTitle")
        root.innerHTML = [
            '<div class="cg-tutorial__modal">',
            '  <header class="cg-tutorial__header"><div class="cg-tutorial__brand"><span class="cg-tutorial__brand-icon"><i class="fa fa-graduation-cap" aria-hidden="true"></i></span><div><span>Content Generator</span><h1 id="cgTutorialTitle">Canvas Tutorial</h1></div></div><div class="cg-tutorial__progress"><span data-tutorial-progress></span><div><i data-tutorial-progress-bar></i></div></div><button type="button" class="cg-tutorial__close" data-tutorial-close aria-label="Close Canvas Tutorial"><i class="fa fa-times" aria-hidden="true"></i></button></header>',
            '  <div class="cg-tutorial__body"><aside class="cg-tutorial__sidebar"><p>Learn the editor</p><nav data-tutorial-categories aria-label="Tutorial categories"></nav><div class="cg-tutorial__sidebar-tip"><i class="fa fa-lightbulb-o" aria-hidden="true"></i><span>Your progress is saved on this device.</span></div></aside><main class="cg-tutorial__content"><div class="cg-tutorial__intro"><div><span data-tutorial-category-kicker>Category</span><h2 data-tutorial-category-title></h2><p>Choose a feature for a guided demonstration on the real canvas UI.</p></div><button type="button" data-tutorial-resume><i class="fa fa-play" aria-hidden="true"></i> Start category</button></div><div class="cg-tutorial__lesson-grid" data-tutorial-lessons></div></main></div>',
            '</div>',
            '<div class="cg-tutorial__shade cg-tutorial__shade--top"></div><div class="cg-tutorial__shade cg-tutorial__shade--right"></div><div class="cg-tutorial__shade cg-tutorial__shade--bottom"></div><div class="cg-tutorial__shade cg-tutorial__shade--left"></div>',
            '<div class="cg-tutorial__spotlight" aria-hidden="true"></div>',
            '<section class="cg-tutorial__coach" role="document" aria-live="polite"><header><div><span data-tutorial-step-count></span><h2 data-tutorial-step-title></h2></div><button type="button" data-tutorial-close aria-label="Close tutorial"><i class="fa fa-times" aria-hidden="true"></i></button></header><p data-tutorial-step-description></p><ol data-tutorial-step-instructions></ol><div class="cg-tutorial__tip"><i class="fa fa-lightbulb-o" aria-hidden="true"></i><span data-tutorial-step-tip></span></div><p class="cg-tutorial__try-status" data-tutorial-try-status hidden><i class="fa fa-hand-pointer-o" aria-hidden="true"></i> Try it on the highlighted real control. Your canvas remains active.</p><footer><button type="button" data-tutorial-back><i class="fa fa-arrow-left" aria-hidden="true"></i> Back</button><button type="button" class="cg-tutorial__try" data-tutorial-try><i class="fa fa-hand-pointer-o" aria-hidden="true"></i> Try It</button><button type="button" data-tutorial-skip>Skip</button><button type="button" class="cg-tutorial__next" data-tutorial-next>Next <i class="fa fa-arrow-right" aria-hidden="true"></i></button><button type="button" data-tutorial-close>Close</button></footer></section>',
            '<div class="cg-tutorial__missing" role="status"><i class="fa fa-info-circle" aria-hidden="true"></i><span>This control is not available in the current canvas state.</span><button type="button" data-tutorial-menu>Back to tutorial</button></div>'
        ].join("")
        document.body.appendChild(root)
        state.root = root
        bindEvents()
        renderMenu()
    }

    function bindEvents() {
        state.root.addEventListener("click", function (event) {
            const category = event.target.closest("[data-tutorial-category]")
            const lessonButton = event.target.closest("[data-tutorial-lesson]")
            if (category) {
                state.activeCategory = category.dataset.tutorialCategory
                renderMenu()
                return
            }
            if (lessonButton) {
                showStep(tutorialSteps.findIndex(function (step) { return step.id === lessonButton.dataset.tutorialLesson }))
                return
            }
            if (event.target.closest("[data-tutorial-close]")) closeTutorial()
            else if (event.target.closest("[data-tutorial-back]")) previousStep()
            else if (event.target.closest("[data-tutorial-next]")) nextStep(true)
            else if (event.target.closest("[data-tutorial-skip]")) nextStep(false)
            else if (event.target.closest("[data-tutorial-try]")) enableTryMode()
            else if (event.target.closest("[data-tutorial-menu]")) showMenu()
            else if (event.target.closest("[data-tutorial-resume]")) startCategory()
        })
        document.addEventListener("keydown", function (event) {
            if (state.root.hidden) return
            if (event.key === "Escape") {
                event.preventDefault()
                closeTutorial()
                return
            }
            if (event.key === "Tab") trapFocus(event)
        })
        window.addEventListener("resize", schedulePosition, { passive: true })
        window.addEventListener("scroll", schedulePosition, true)
    }

    function trapFocus(event) {
        const scope = state.root.classList.contains("cg-tutorial--guided") ? state.root.querySelector(".cg-tutorial__coach") : state.root.querySelector(".cg-tutorial__modal")
        const focusable = Array.from(scope.querySelectorAll("button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex='-1'])")).filter(isVisible)
        if (!focusable.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first.focus()
        }
    }

    function openTutorial() {
        state.root.hidden = false
        state.root.classList.add("cg-tutorial--open")
        document.body.classList.add("cg-tutorial-open")
        showMenu()
        state.root.querySelector(".cg-tutorial__close").focus()
    }

    function closeTutorial() {
        closeDemoObject()
        closeLeftIslands()
        state.activeIndex = -1
        state.target = null
        state.root.classList.remove("cg-tutorial--open", "cg-tutorial--guided", "cg-tutorial--trying", "cg-tutorial--missing-target")
        document.body.classList.remove("cg-tutorial-open", "cg-tutorial-trying")
        state.root.hidden = true
        state.helpButton?.focus({ preventScroll: true })
    }

    function showMenu() {
        closeDemoObject()
        state.activeIndex = -1
        state.target = null
        state.root.classList.remove("cg-tutorial--guided", "cg-tutorial--trying", "cg-tutorial--missing-target")
        document.body.classList.remove("cg-tutorial-trying")
        renderMenu()
    }

    function renderMenu() {
        const categoryNav = state.root.querySelector("[data-tutorial-categories]")
        categoryNav.innerHTML = CATEGORY_ORDER.map(function (category) {
            const categorySteps = tutorialSteps.filter(function (step) { return step.category === category })
            const completed = categorySteps.filter(function (step) { return state.completed.has(step.id) }).length
            return `<button type="button" class="${  category === state.activeCategory ? "is-active" : ""  }" data-tutorial-category="${  category  }"><i class="fa ${  CATEGORY_ICONS[category]  }" aria-hidden="true"></i><span><b>${  category  }</b><small>${  completed  } / ${  categorySteps.length  } completed</small></span><i class="fa fa-angle-right" aria-hidden="true"></i></button>`
        }).join("")
        const activeSteps = tutorialSteps.filter(function (step) { return step.category === state.activeCategory })
        state.root.querySelector("[data-tutorial-category-title]").textContent = state.activeCategory
        state.root.querySelector("[data-tutorial-category-kicker]").textContent = `${activeSteps.length  } guided lessons`
        state.root.querySelector("[data-tutorial-lessons]").innerHTML = activeSteps.map(function (step, index) {
            const available = step.action === "demo" || step.action === "demo-layers" || step.action === "slides" || step.action === "layers" || step.action === "shapes" || resolveTarget(step)
            return `<button type="button" class="cg-tutorial__lesson ${  state.completed.has(step.id) ? "is-complete " : ""  }${!available && step.optional ? "is-contextual" : ""  }" data-tutorial-lesson="${  step.id  }"><span class="cg-tutorial__lesson-number">${  state.completed.has(step.id) ? '<i class="fa fa-check" aria-hidden="true"></i>' : index + 1  }</span><span><b>${  step.title  }</b><small>${  step.description  }</small></span><i class="fa fa-chevron-right" aria-hidden="true"></i></button>`
        }).join("")
        renderProgress()
    }

    function renderProgress() {
        const count = tutorialSteps.filter(function (step) { return state.completed.has(step.id) }).length
        const percent = tutorialSteps.length ? Math.round((count / tutorialSteps.length) * 100) : 0
        state.root.querySelector("[data-tutorial-progress]").textContent = `${count  } / ${  tutorialSteps.length  } completed`
        state.root.querySelector("[data-tutorial-progress-bar]").style.width = `${percent  }%`
    }

    function startCategory() {
        const firstIncomplete = tutorialSteps.findIndex(function (step) { return step.category === state.activeCategory && !state.completed.has(step.id) })
        const first = tutorialSteps.findIndex(function (step) { return step.category === state.activeCategory })
        showStep(firstIncomplete >= 0 ? firstIncomplete : first)
    }

    function showStep(index) {
        if (index < 0 || index >= tutorialSteps.length) {
            showMenu()
            return
        }
        const step = tutorialSteps[index]
        state.activeIndex = index
        state.activeCategory = step.category
        state.root.classList.add("cg-tutorial--guided")
        state.root.classList.remove("cg-tutorial--trying", "cg-tutorial--missing-target")
        document.body.classList.remove("cg-tutorial-trying")
        state.root.querySelector("[data-tutorial-step-count]").textContent = `${step.category  } · ${  index + 1  } of ${  tutorialSteps.length}`
        state.root.querySelector("[data-tutorial-step-title]").textContent = step.title
        state.root.querySelector("[data-tutorial-step-description]").textContent = step.description
        state.root.querySelector("[data-tutorial-step-instructions]").innerHTML = getStepInstructions(step).map(function (instruction) { return `<li>${  instruction  }</li>` }).join("")
        state.root.querySelector("[data-tutorial-step-tip]").textContent = step.tip
        state.root.querySelector("[data-tutorial-try-status]").hidden = true
        state.root.querySelector("[data-tutorial-next]").innerHTML = index === tutorialSteps.length - 1 ? 'Finish <i class="fa fa-check" aria-hidden="true"></i>' : 'Next <i class="fa fa-arrow-right" aria-hidden="true"></i>'
        prepareStep(step)
        window.requestAnimationFrame(function () {
            state.target = resolveTarget(step)
            if (!state.target) {
                state.root.classList.add("cg-tutorial--missing-target")
                return
            }
            state.target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" })
            if (typeof state.target.focus === "function") state.target.focus({ preventScroll: true })
            schedulePosition()
            state.root.querySelector("[data-tutorial-try]").focus({ preventScroll: true })
        })
    }

    function previousStep() {
        if (state.activeIndex <= 0) showMenu()
        else showStep(state.activeIndex - 1)
    }

    function nextStep(markComplete) {
        const step = tutorialSteps[state.activeIndex]
        if (markComplete && step) {
            state.completed.add(step.id)
            saveProgress()
            renderProgress()
        }
        if (state.activeIndex >= tutorialSteps.length - 1) showMenu()
        else showStep(state.activeIndex + 1)
    }

    function enableTryMode() {
        state.root.classList.add("cg-tutorial--trying")
        document.body.classList.add("cg-tutorial-trying")
        state.root.querySelector("[data-tutorial-try-status]").hidden = false
        if (state.target && typeof state.target.focus === "function") state.target.focus({ preventScroll: true })
        schedulePosition()
    }

    function schedulePosition() {
        window.cancelAnimationFrame(state.raf)
        state.raf = window.requestAnimationFrame(positionGuide)
    }

    function positionGuide() {
        if (!state.target || !state.root.classList.contains("cg-tutorial--guided") || !isVisible(state.target)) return
        const margin = 10
        const gap = 14
        const viewportWidth = document.documentElement.clientWidth
        const viewportHeight = document.documentElement.clientHeight
        const target = state.target.getBoundingClientRect()
        const left = Math.max(margin, target.left - 6)
        const top = Math.max(margin, target.top - 6)
        const right = Math.min(viewportWidth - margin, target.right + 6)
        const bottom = Math.min(viewportHeight - margin, target.bottom + 6)
        const spotlight = state.root.querySelector(".cg-tutorial__spotlight")
        spotlight.style.left = `${left  }px`
        spotlight.style.top = `${top  }px`
        spotlight.style.width = `${Math.max(20, right - left)  }px`
        spotlight.style.height = `${Math.max(20, bottom - top)  }px`
        setShade("top", 0, 0, viewportWidth, top)
        setShade("bottom", 0, bottom, viewportWidth, Math.max(0, viewportHeight - bottom))
        setShade("left", 0, top, left, Math.max(0, bottom - top))
        setShade("right", right, top, Math.max(0, viewportWidth - right), Math.max(0, bottom - top))
        const coach = state.root.querySelector(".cg-tutorial__coach")
        const coachWidth = Math.min(400, viewportWidth - (margin * 2))
        coach.style.width = `${coachWidth  }px`
        const coachHeight = coach.offsetHeight
        const spaces = {
            right: viewportWidth - right,
            left,
            bottom: viewportHeight - bottom,
            top
        }
        const horizontal = spaces.right >= coachWidth + gap || spaces.left >= coachWidth + gap
        let coachLeft
        let coachTop
        if (horizontal) {
            coachLeft = spaces.right >= spaces.left ? right + gap : left - coachWidth - gap
            coachTop = target.top + ((target.height - coachHeight) / 2)
        } else {
            coachLeft = target.left + ((target.width - coachWidth) / 2)
            coachTop = spaces.bottom >= spaces.top ? bottom + gap : top - coachHeight - gap
        }
        coach.style.left = `${clamp(coachLeft, margin, viewportWidth - coachWidth - margin)  }px`
        coach.style.top = `${clamp(coachTop, margin, viewportHeight - coachHeight - margin)  }px`
    }

    function setShade(side, left, top, width, height) {
        const shade = state.root.querySelector(`.cg-tutorial__shade--${  side}`)
        shade.style.left = `${left  }px`
        shade.style.top = `${top  }px`
        shade.style.width = `${width  }px`
        shade.style.height = `${height  }px`
    }

    function clamp(value, minimum, maximum) {
        return Math.max(minimum, Math.min(maximum, value))
    }

    function init() {
        state.helpButton = document.getElementById("cgCanvasHelp")
        if (!state.helpButton || document.getElementById("cgCanvasTutorial")) return
        buildRoot()
        state.helpButton.addEventListener("click", function (event) {
            event.preventDefault()
            openTutorial()
        })
        window.CGCanvasTutorial = {
            open: openTutorial,
            close: closeTutorial,
            steps: tutorialSteps.slice()
        }
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true })
    else init()
})(window, document)
