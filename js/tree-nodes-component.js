/**
 * Native Fabric Tree Nodes component.
 * STAMP: 2026-08-19
 * Kept independent from the legacy controller tail so modal actions remain
 * available even when unrelated legacy initialization stops early.
 */
(function (window, $) {
    "use strict";

    function getCanvas() { return window.canvas; }
    function makeId(prefix) {
        return typeof window.generate_id === "function"
            ? window.generate_id(prefix)
            : prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }
    function getBranches() {
        var values = $(".tree-node-branch-input").map(function () { return $(this).val().trim(); }).get().filter(Boolean);
        return values.length ? values : ["Branch 1"];
    }
    function values() {
        return {
            rootText: $("#treeNodesRootText").val().trim() || "Main topic",
            branches: getBranches(),
            nodeWidth: Math.min(260, Math.max(100, Number($("#treeNodesNodeWidth").val()) || 150)),
            spacing: Math.min(140, Math.max(20, Number($("#treeNodesSpacing").val()) || 60)),
            rootColor: $("#treeNodesRootColor").val() || "#1d4ed8",
            rootTextColor: $("#treeNodesRootTextColor").val() || "#ffffff",
            branchColor: $("#treeNodesBranchColor").val() || "#eff6ff",
            textColor: $("#treeNodesTextColor").val() || "#0f172a",
            linkColor: $("#treeNodesLinkColor").val() || "#3b82f6",
            duration: Math.min(3000, Math.max(200, Number($("#treeNodesAnimationDuration").val()) || 700))
        };
    }
    function renderBranches(branches) {
        var list = $("#treeNodesBranchList").empty();
        branches.forEach(function (label, index) {
            var row = $("<div>", { class: "cg-tree-preset__branch" });
            row.append($("<span>", { class: "cg-tree-preset__branch-index", text: index + 1 }));
            row.append($("<input>", { type: "text", maxlength: 80, class: "tree-node-branch-input", value: label, "aria-label": "Branch " + (index + 1) }));
            row.append($("<button>", { type: "button", class: "cg-tree-preset__remove", title: "Remove branch", "aria-label": "Remove branch" })
                .prop("disabled", branches.length <= 1).append($("<i>", { class: "fa fa-times", "aria-hidden": "true" })));
            list.append(row);
        });
    }
    function status(message) {
        $("#treeNodesPresetStatus").prop("hidden", !message).text(message || "");
    }
    function ensureSlide() {
        if (window.slide_index >= 0 && window.generated_slides && window.generated_slides[window.slide_index]) return true;
        if (typeof window.addSlide === "function") window.addSlide(1);
        return window.slide_index >= 0 && window.generated_slides && window.generated_slides[window.slide_index];
    }
    function save() {
        var canvas = getCanvas();
        var fabric = window.fabric;
        if (!canvas || !fabric) throw new Error("The Fabric canvas is not ready yet.");
        if (!ensureSlide()) throw new Error("The active slide could not be prepared.");

        var data = values();
        var editingId = $("#treeNodesPresetModal").data("editing-id");
        var existing = editingId && canvas.getObjectById ? canvas.getObjectById(editingId) : null;
        var id = existing ? existing.id : makeId("tree_");
        var height = 58;
        var childTop = 160;
        var totalWidth = data.branches.length * data.nodeWidth + Math.max(0, data.branches.length - 1) * data.spacing;
        var center = totalWidth / 2;
        var objects = [];

        data.branches.forEach(function (_, index) {
            var childCenter = index * (data.nodeWidth + data.spacing) + data.nodeWidth / 2;
            objects.push(new fabric.Line([center, height, childCenter, childTop], {
                id: id + "_link_" + index, stroke: data.linkColor, strokeWidth: 3, selectable: false, evented: false
            }));
        });
        objects.push(new fabric.Rect({ left: center - data.nodeWidth / 2, top: 0, width: data.nodeWidth, height: height,
            rx: 14, ry: 14, fill: data.rootColor, stroke: data.linkColor, strokeWidth: 2 }));
        objects.push(new fabric.Textbox(data.rootText, { left: center - data.nodeWidth * .42, top: 17,
            width: data.nodeWidth * .84, fontFamily: "Arial", fontSize: 18, fontWeight: "700",
            fill: data.rootTextColor, textAlign: "center" }));
        data.branches.forEach(function (label, index) {
            var left = index * (data.nodeWidth + data.spacing);
            objects.push(new fabric.Rect({ left: left, top: childTop, width: data.nodeWidth, height: height,
                rx: 12, ry: 12, fill: data.branchColor, stroke: data.linkColor, strokeWidth: 2 }));
            objects.push(new fabric.Textbox(label, { left: left + data.nodeWidth * .08, top: childTop + 17,
                width: data.nodeWidth * .84, fontFamily: "Arial", fontSize: 16, fontWeight: "600",
                fill: data.textColor, textAlign: "center" }));
        });

        var fitScale = Math.min(1, Math.max(.25, (canvas.getWidth() - 60) / totalWidth));
        var tree = new fabric.Group(objects, {
            id: id, name: "Tree Nodes", treeNodesComponent: true,
            treeNodesRootText: data.rootText, treeNodesBranches: data.branches,
            treeNodesNodeWidth: data.nodeWidth, treeNodesSpacing: data.spacing,
            treeNodesRootColor: data.rootColor, treeNodesRootTextColor: data.rootTextColor,
            treeNodesBranchColor: data.branchColor, treeNodesTextColor: data.textColor,
            treeNodesLinkColor: data.linkColor, treeNodesAnimationDuration: data.duration,
            left: existing ? existing.left : Math.max(30, (canvas.getWidth() - totalWidth * fitScale) / 2),
            top: existing ? existing.top : 70, angle: existing ? existing.angle : 0,
            scaleX: existing ? existing.scaleX : fitScale, scaleY: existing ? existing.scaleY : fitScale,
            subTargetCheck: false, transparentCorners: true
        });

        if (existing) canvas.remove(existing);
        canvas.add(tree);
        canvas.setActiveObject(tree);
        if (!Array.isArray(window.slide_actions)) window.slide_actions = [];
        var action = window.slide_actions.find(function (item) { return item.function === "treereveal" && item.actionFrom === id; });
        if (action) action.duration = data.duration;
        else window.slide_actions.push({ id: makeId("ca_"), actionFrom: id, event: "click",
            function: "treereveal", linkPrefix: id + "_link_", duration: data.duration });
        var slide = window.generated_slides[window.slide_index];
        slide.actions = window.slide_actions;
        slide.jsonobj = canvas.toObject(["id"]);
        slide.svg = encodeURIComponent(canvas.toSVG());
        slide.imgprev = canvas.toDataURL();
        if (typeof window.applyCanvasObjectActionControls === "function") window.applyCanvasObjectActionControls(tree);
        if (!existing && typeof window.pushControl === "function") window.pushControl(id, "Group");
        if (typeof window.updateCanvasState === "function") window.updateCanvasState();
        canvas.requestRenderAll();
        status("");
        // STAMP: 2026-09-10 - Keep the legacy save bridge aligned with the
        // footer-safe left-island controller used by the current editor.
        if (window.CGTreeNodesIsland) window.CGTreeNodesIsland.close();
    }

    window.handleSaveTreeNodesPreset = function () {
        try { save(); }
        catch (error) { console.error("Tree Nodes component could not be created", error); status("Unable to add the tree: " + error.message); }
    };
    window.addTreeNodeBranchInput = function () {
        var branches = getBranches();
        branches.push("Branch " + (branches.length + 1));
        renderBranches(branches);
    };

    $(document).off("click.cgTreeStandaloneRemove", ".cg-tree-preset__remove").on("click.cgTreeStandaloneRemove", ".cg-tree-preset__remove", function () {
        var branches = getBranches();
        branches.splice($(this).closest(".cg-tree-preset__branch").index(), 1);
        renderBranches(branches.length ? branches : ["Branch 1"]);
    });
}(window, window.jQuery));
