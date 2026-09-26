// Easy mode: loads every trainer Pokemon 2 levels lower (on top of level-cap scaling).
// Self-contained: remove this file and the #easy-mode-toggle button to disable.
(function () {
    function isEasy() { try { return localStorage.easyMode === "1"; } catch (e) { return false; } }
    function setEasy(v) { try { localStorage.easyMode = v ? "1" : "0"; } catch (e) {} }
    window.isEasyMode = isEasy;
    // Offset applied to a set's level. Only trainer sets (which carry tr_id) are affected, never the player's box.
    window.easyModeLevelOffset = function (set) {
        return (isEasy() && set && typeof set.tr_id !== "undefined") ? -2 : 0;
    };
    // --- Level-cap fallback ---------------------------------------------------------------
    // HZLA uses the level shown in the enemy panel as the "cap" when no cap has been typed.
    // That number already contains the displayed Pokemon's offset and the Easy-mode -2, so
    // feeding it back in makes levels drift on every click. We remember what is on screen and
    // recover the real cap from it: cap = shown level - easy offset - the set's own offset.
    var displayed = null;
    window.rememberDisplayedTrainerSet = function (set, shownLevel) {
        displayed = { set: set, level: parseInt(shownLevel, 10) };
    };
    window.inferLevelCapFallback = function (panelLevel) {
        var shown = parseInt(panelLevel, 10);
        if (!Number.isFinite(shown)) { return panelLevel; }
        if (!displayed || !displayed.set) { return shown; }
        var set = displayed.set;
        var rel = (typeof set.sublevel !== "undefined") ? parseInt(set.sublevel, 10) : (parseInt(set.level, 10) < 1 ? parseInt(set.level, 10) : 0);
        if (!Number.isFinite(rel)) { rel = 0; }
        var cap = shown - window.easyModeLevelOffset(set) - rel;
        return cap > 0 ? cap : shown;
    };

    function reloadTrainerSets() {
        $(".set-selector").each(function () {
            var v = $(this).val();
            if (v && v.indexOf("(Lvl ") !== -1) { $(this).val(v).trigger("change"); }
        });
    }
    // Re-level the enemy that is already on screen when the level cap changes (HZLA only applies a new cap on the next selection).
    var capTimer = null;
    $(document).on("change", "#lvl-cap", function () {
        var v = parseInt($(this).val(), 10);
        if (Number.isFinite(v)) { window.lvlCap = v; }
        clearTimeout(capTimer);
        capTimer = setTimeout(reloadTrainerSets, 400);
    });
    $(function () {
        var btn = $("#easy-mode-toggle");
        function render() { btn.toggleClass("active", isEasy()); btn.attr("aria-pressed", isEasy() ? "true" : "false"); }
        render();
        btn.on("click", function () { setEasy(!isEasy()); render(); reloadTrainerSets(); });
    });
})();
