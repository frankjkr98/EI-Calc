// Team-vs-Team matrix: every Pokemon in your party vs every Pokemon of the selected trainer.
// Self-contained module. To remove: delete this file, the <script> tag that loads it, and the #matrix-toggle button.
(function () {
    var STYLE = [
        '#matrix-overlay{position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.72);display:none;overflow:auto;padding:24px;box-sizing:border-box}',
        '#matrix-overlay.open{display:block}',
        '#matrix-panel{background:#1f1f24;color:#f1f1f1;border:1px solid #3a3a44;border-radius:10px;max-width:1500px;margin:0 auto;padding:16px 20px;box-shadow:0 10px 40px rgba(0,0,0,.6);font-family:inherit}',
        '#matrix-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px}',
        '#matrix-head h2{margin:0;font-size:20px;font-weight:600}',
        '#matrix-head .mx-sub{opacity:.75;font-size:13px}',
        '#matrix-head button{margin-left:auto;background:#2b2b33;color:#f1f1f1;border:1px solid #555;border-radius:6px;padding:6px 12px;cursor:pointer}',
        '#matrix-head button:hover{background:#3a3a44}',
        '#matrix-table{border-collapse:separate;border-spacing:4px;width:100%}',
        '#matrix-table th{font-weight:600;font-size:12px;text-align:center;padding:4px;vertical-align:bottom;background:#26262d;border-radius:6px}',
        '#matrix-table th img{width:56px;height:56px;image-rendering:pixelated;display:block;margin:0 auto}',
        '#matrix-table th.mx-row{text-align:left;min-width:120px;vertical-align:middle}',
        '#matrix-table th.mx-row img{display:inline-block;vertical-align:middle;width:44px;height:44px;margin:0 6px 0 0}',
        '#matrix-table td{padding:0}',
        '.mx-cell{position:relative;border-radius:6px;padding:6px 8px;background:#2a2a32;border-left:4px solid #444;font-size:12px;line-height:1.35;min-width:130px}',
        '.mx-cell .mx-dealt,.mx-cell .mx-taken{white-space:nowrap}',
        '.mx-cell .mx-move{opacity:.65;font-size:11px;display:block}',
        '.mx-cell.dealt-ohko{background:#1e4d2b}',
        '.mx-cell.dealt-maybe{background:#2f4a2a}',
        '.mx-cell.dealt-2hko{background:#3a3f2a}',
        '.mx-cell.taken-ohko{border-left-color:#e0443e}',
        '.mx-cell.taken-heavy{border-left-color:#e6a23c}',
        '.mx-cell.taken-safe{border-left-color:#4caf50}',
        '.mx-speed{position:absolute;top:4px;right:6px;font-size:11px;font-weight:700;padding:0 5px;border-radius:8px}',
        '.mx-speed.fast{background:#2e7d32;color:#fff}.mx-speed.slow{background:#c62828;color:#fff}.mx-speed.tie{background:#616161;color:#fff}',
        '#matrix-legend{font-size:12px;opacity:.8;margin-top:10px;display:flex;gap:16px;flex-wrap:wrap}',
        '#matrix-legend span i{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:middle;margin-right:4px}',
        '#matrix-empty{padding:30px;text-align:center;opacity:.8}'
    ].join('\n');

    function ensureDom() {
        if (document.getElementById('matrix-overlay')) { return; }
        var style = document.createElement('style'); style.textContent = STYLE; document.head.appendChild(style);
        var ov = document.createElement('div'); ov.id = 'matrix-overlay';
        ov.innerHTML = '<div id="matrix-panel"><div id="matrix-head"><h2>Team vs Team</h2><span class="mx-sub"></span><button type="button" id="matrix-refresh">Refresh</button><button type="button" id="matrix-close">Close</button></div><div id="matrix-body"></div>' +
            '<div id="matrix-legend"><span><i style="background:#1e4d2b"></i>guaranteed OHKO</span><span><i style="background:#2f4a2a"></i>possible OHKO</span><span><i style="background:#3a3f2a"></i>2HKO</span>' +
            '<span><i style="background:#e0443e"></i>you can be OHKO\'d</span><span><i style="background:#e6a23c"></i>you take &ge;50%</span><span><i style="background:#4caf50"></i>you take &lt;50%</span>' +
            '<span><b>F</b>/<b>S</b>/<b>=</b> faster / slower / speed tie (uses current field &amp; Easy mode)</span></div></div>';
        document.body.appendChild(ov);
        ov.addEventListener('click', function (e) { if (e.target === ov) { close(); } });
        document.getElementById('matrix-close').addEventListener('click', close);
        document.getElementById('matrix-refresh').addEventListener('click', render);
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ov.classList.contains('open')) { close(); } });
    }

    function open() { ensureDom(); document.getElementById('matrix-overlay').classList.add('open'); render(); }
    function close() { var ov = document.getElementById('matrix-overlay'); if (ov) { ov.classList.remove('open'); } }

    function spriteHtml(species, cls) {
        try {
            var name = (typeof getPreviewSpriteName === 'function') ? getPreviewSpriteName(species) : String(species).toLowerCase();
            var style = 'pokesprite';
            return '<img class="' + (cls || '') + '" src="./img/' + style + '/' + name + '.png" onerror="this.style.display=\'none\'">';
        } catch (e) { return ''; }
    }

    function zeroEvs() { return { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }; }

    // Player side: party (species with a "My Box" set), else the Pokemon currently in panel 1.
    function playerMons() {
        var out = [];
        var party = (typeof currentParty !== 'undefined' && Array.isArray(currentParty)) ? currentParty : [];
        party.forEach(function (species, i) {
            try {
                var override = (typeof getPartyPreviewSlotOverride === 'function') ? getPartyPreviewSlotOverride(species, i) : null;
                var set = override || (setdex[species] && setdex[species]['My Box']);
                if (!set) { return; }
                var mon = override ? null : createPokemon(species + ' (My Box)');
                if (!mon) { return; }
                if (typeof normalizeBoxAbilityForCalc === 'function') { mon = normalizeBoxAbilityForCalc(mon); }
                out.push({ label: species, species: species, mon: mon });
            } catch (e) { /* skip broken entries */ }
        });
        if (!out.length) {
            try {
                var p1 = createPokemon($('#p1'));
                if (p1 && p1.name) { out.push({ label: p1.name + ' (current)', species: p1.name, mon: p1 }); }
            } catch (e) {}
        }
        return out;
    }

    // Enemy side: the selected trainer's party, else the Pokemon in panel 2.
    function enemyMons() {
        var out = [];
        var ids = (typeof CURRENT_TRAINER_POKS !== 'undefined' && Array.isArray(CURRENT_TRAINER_POKS)) ? CURRENT_TRAINER_POKS : [];
        var seen = {};
        ids.forEach(function (id) {
            try {
                if (!id || seen[id]) { return; }
                seen[id] = true;
                var species = id.split(' (')[0];
                var mon = createPokemon(id);
                if (!mon) { return; }
                if (typeof settings !== 'undefined' && settings && !settings.hasEvs && typeof mon.clone === 'function') { mon = mon.clone({ evs: zeroEvs() }); }
                out.push({ label: species, species: species, mon: mon, id: id });
            } catch (e) {}
        });
        if (!out.length) {
            try {
                var p2 = createPokemon($('#p2'));
                if (p2 && p2.name) { out.push({ label: p2.name + ' (current)', species: p2.name, mon: p2 }); }
            } catch (e) {}
        }
        return out;
    }

    function trainerLabel() {
        try {
            var v = $('#p2 .set-selector').val() || '';
            var t = (typeof getTrainerName === 'function') ? getTrainerName(v) : null;
            return t || '';
        } catch (e) { return ''; }
    }

    function pct(result, defender) {
        if (!result || typeof result.range !== 'function') { return null; }
        var r = result.range();
        var hp = (typeof defender.maxHP === 'function') ? defender.maxHP() : (defender.stats && defender.stats.hp) || (defender.rawStats && defender.rawStats.hp) || 1;
        if (!r || !hp) { return null; }
        var hits = Math.max(1, Number(result.move && result.move.hits) || 1);
        var perHit = Array.isArray(result.damage) && Array.isArray(result.damage[0]);
        var min = r[0] * (perHit ? 1 : hits), max = r[1] * (perHit ? 1 : hits);
        return { min: min / hp * 100, max: max / hp * 100, move: result.move && result.move.name };
    }

    function best(results, defender) {
        var b = null;
        (results || []).forEach(function (res) {
            var p = pct(res, defender);
            if (!p || !p.move || p.move === '(No Move)') { return; }
            if (!b || p.min > b.min || (p.min === b.min && p.max > b.max)) { b = p; }
        });
        return b;
    }

    function fmt(p) { return p ? (p.min.toFixed(0) + '\u2013' + p.max.toFixed(0) + '%') : '\u2014'; }

    function render() {
        ensureDom();
        var body = document.getElementById('matrix-body');
        var sub = document.querySelector('#matrix-head .mx-sub');
        var players = playerMons(), enemies = enemyMons();
        var tl = trainerLabel();
        sub.textContent = (players.length + ' of yours vs ' + enemies.length + (tl ? ' of ' + tl : ' enemy')) + ((typeof isEasyMode === 'function' && isEasyMode()) ? ' \u00b7 Easy mode' : '');
        if (!players.length || !enemies.length) {
            body.innerHTML = '<div id="matrix-empty">Add Pok\u00e9mon to your party (right-click a box Pok\u00e9mon) and select a trainer on the right side, then press Refresh.</div>';
            return;
        }
        var field = createField();
        var p1field = field, p2field = field.clone().swap();
        var html = '<div style="overflow:auto"><table id="matrix-table"><thead><tr><th></th>';
        enemies.forEach(function (e) { html += '<th>' + spriteHtml(e.species) + e.label + '<br><span style="opacity:.7;font-weight:400">Lv ' + e.mon.level + '</span></th>'; });
        html += '</tr></thead><tbody>';
        players.forEach(function (pl) {
            html += '<tr><th class="mx-row">' + spriteHtml(pl.species) + pl.label + '<br><span style="opacity:.7;font-weight:400">Lv ' + pl.mon.level + '</span></th>';
            enemies.forEach(function (en) {
                var cell;
                try {
                    var res = calculateAllMoves(settings.damageGen, pl.mon, p1field, en.mon, p2field, false);
                    var dealt = best(res[0], en.mon), taken = best(res[1], pl.mon);
                    var pSpe = res[0][0] && res[0][0].attacker ? res[0][0].attacker.stats.spe : pl.mon.stats.spe;
                    var eSpe = res[1][0] && res[1][0].attacker ? res[1][0].attacker.stats.spe : en.mon.stats.spe;
                    var cls = 'mx-cell';
                    if (dealt) { cls += dealt.min >= 100 ? ' dealt-ohko' : dealt.max >= 100 ? ' dealt-maybe' : dealt.min >= 50 ? ' dealt-2hko' : ''; }
                    if (taken) { cls += taken.max >= 100 ? ' taken-ohko' : taken.max >= 50 ? ' taken-heavy' : ' taken-safe'; }
                    var spd = pSpe > eSpe ? '<span class="mx-speed fast" title="You are faster (' + pSpe + ' vs ' + eSpe + ')">F</span>' : pSpe < eSpe ? '<span class="mx-speed slow" title="You are slower (' + pSpe + ' vs ' + eSpe + ')">S</span>' : '<span class="mx-speed tie" title="Speed tie (' + pSpe + ')">=</span>';
                    cell = '<div class="' + cls + '">' + spd +
                        '<div class="mx-dealt" title="Your best move">\u2192 ' + fmt(dealt) + '<span class="mx-move">' + (dealt ? dealt.move : '') + '</span></div>' +
                        '<div class="mx-taken" title="Their best move against you">\u2190 ' + fmt(taken) + '<span class="mx-move">' + (taken ? taken.move : '') + '</span></div></div>';
                } catch (e) {
                    cell = '<div class="mx-cell">?</div>';
                }
                html += '<td>' + cell + '</td>';
            });
            html += '</tr>';
        });
        html += '</tbody></table></div>';
        body.innerHTML = html;
    }

    $(function () {
        var btn = document.getElementById('matrix-toggle');
        if (btn) { btn.addEventListener('click', open); }
    });
    window.openTeamMatrix = open;
})();
