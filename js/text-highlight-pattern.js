/* STAMP: 2026-09-05 - Editable per-character marker highlights.
 * Shared geometry for canvas and SVG keeps previews/export consistent.
 * Stored character styles preserve the effect through cloning and reload. */
(function (window) {
    'use strict';
    const fabric = window.fabric;
    const Text = fabric && (fabric.FabricText || fabric.Text);
    if (!Text) return;
    const prototype = Text.prototype;
    const originalRender = prototype._renderTextLinesBackground;
    const originalSvg = prototype._setSVGTextLineBg;
    const originalObject = prototype.toObject;
    const marker = object => Object.values(object.styles || {}).some(line => Object.values(line || {}).some(style => style.cgHighlightPattern === 'marker' && style.textBackgroundColor));
    function polygons(x, y, width, height) {
        return [
            { opacity: .55, points: [[0,.13],[.1,.08],[.72,.12],[.94,.2],[1,.26],[.98,.77],[.65,.83],[.06,.78]] },
            { opacity: .65, points: [[.02,.24],[.17,.19],[.89,.22],[.98,.3],[1,.91],[.72,.86],[.08,.94],[0,.8]] },
            { opacity: .28, points: [[0,.45],[.3,.38],[.95,.44],[1,.59],[.97,.72],[.35,.64],[.01,.7]] }
        ].map(stroke => ({ opacity: stroke.opacity, points: stroke.points.map(point => [x + point[0] * width, y + point[1] * height]) }));
    }
    function runs(object, line, left, top, callback) {
        let run = null;
        const chars = object._textLines[line];
        for (let index = 0; index < chars.length; index++) {
            const color = object.getValueOfPropertyAt(line, index, 'textBackgroundColor');
            const pattern = object.getValueOfPropertyAt(line, index, 'cgHighlightPattern');
            const bounds = object.__charBounds[line][index];
            if (run && run.color === color && run.pattern === pattern) run.width += bounds.kernedWidth;
            else {
                if (run && run.color) callback(run);
                run = { color, pattern, left: left + bounds.left, top, width: bounds.width, height: object.getHeightOfLineImpl(line) };
            }
        }
        if (run && run.color) callback(run);
    }
    prototype._renderTextLinesBackground = function (context) {
        if (!marker(this) || this.path) return originalRender.call(this, context);
        context.save();
        let top = this._getTopOffset();
        for (let line = 0; line < this._textLines.length; line++) {
            runs(this, line, this._getLeftOffset() + this._getLineLeftOffset(line), top, run => {
                const left = this.direction === 'rtl' ? this.width - run.left - run.width : run.left;
                context.fillStyle = run.color;
                if (run.pattern !== 'marker') context.fillRect(left, run.top, run.width, run.height);
                else polygons(left, run.top, run.width, run.height).forEach(stroke => {
                    context.save(); context.globalAlpha *= stroke.opacity; context.beginPath();
                    stroke.points.forEach((point, index) => index ? context.lineTo(point[0], point[1]) : context.moveTo(point[0], point[1]));
                    context.closePath(); context.fill(); context.restore();
                });
            });
            top += this.getHeightOfLine(line);
        }
        context.restore(); this._removeShadow(context);
    };
    prototype._setSVGTextLineBg = function (rectangles, line, left, top) {
        if (!marker(this) || this.path) return originalSvg.call(this, rectangles, line, left, top);
        const escape = value => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        runs(this, line, left, top, run => {
            if (run.pattern !== 'marker') rectangles.push(`<rect fill="${escape(run.color)}" x="${run.left}" y="${run.top}" width="${run.width}" height="${run.height}"/>`);
            else polygons(run.left, run.top, run.width, run.height).forEach(stroke => rectangles.push(`<polygon fill="${escape(run.color)}" opacity="${stroke.opacity}" points="${stroke.points.map(point => point.join(',')).join(' ')}"/>`));
        });
    };
    prototype.toObject = function (properties) {
        const result = originalObject.call(this, properties);
        // Fabric's compact style serializer does not compare custom style keys.
        if (marker(this)) result.styles = JSON.parse(JSON.stringify(this.styles));
        return result;
    };
}(window));
