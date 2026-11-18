/* Panda Tv Elite 2.0.18 Home-only D-pad focus recovery.
 * Fixed path to Live / Movies / Series from the Home hero.
 * Never changes catalog syncing, Back behavior, guide navigation, or Media3.
 * Must be invoked before PandaRemoteNav207 by the 1.8.6 navigation arbiter.
 */
(function () {
  'use strict';
  if (window.PandaHomeFocus218) return;
  const MAIN = document.getElementById('main');
  const NAV = document.getElementById('nav');
  if (!MAIN) return;
  const KEY = { ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right' };
  const stats = { handled:0, last:'', target:'' };
  function home() {
    try { return typeof state === 'object' && state && state.route === 'home'; }
    catch (_) { return false; }
  }
  function visible(node) {
    if (!node || !node.isConnected || node.closest?.('[hidden],[inert]')) return false;
    const style = getComputedStyle(node), r = node.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' &&
      style.pointerEvents !== 'none' && r.width >= 5 && r.height >= 5;
  }
  function quickTiles() {
    // The "History" tile has no action: do not send TV focus to a dead control.
    const tiles = Array.from(MAIN.querySelectorAll('.quickGrid .quickTile[onclick]')).filter(visible);
    for (const tile of tiles) {
      if (!tile.hasAttribute('tabindex')) tile.tabIndex = 0;
      if (!tile.hasAttribute('role')) tile.setAttribute('role','button');
      if (!tile.hasAttribute('aria-label')) {
        tile.setAttribute('aria-label',(tile.textContent || 'Open section').trim().replace(/\s+/g,' '));
      }
    }
    return tiles;
  }
  function focused(node) {
    if (!visible(node)) return false;
    try { node.focus({preventScroll:true}); } catch (_) { node.focus(); }
    if (document.activeElement !== node) return false;
    // Only one small element is scrolled, never the full catalog.
    try { node.scrollIntoView({behavior:'instant',block:'nearest',inline:'nearest'}); }
    catch (_) { node.scrollIntoView({block:'nearest',inline:'nearest'}); }
    MAIN.querySelectorAll('.ptv-remote-focus').forEach(el=>el.classList.remove('ptv-remote-focus'));
    node.classList.add('ptv-remote-focus');
    stats.handled++; stats.target = (node.getAttribute('aria-label') || node.textContent || '').trim().slice(0,64);
    return true;
  }
  function center(el) {
    const r = el.getBoundingClientRect();
    return {x:(r.left+r.right)/2,y:(r.top+r.bottom)/2,w:r.width,h:r.height};
  }
  function nextTile(tiles, current, direction) {
    const origin = center(current), vertical = direction === 'down' || direction === 'up';
    let best=null, score=Infinity;
    for (const node of tiles) {
      if (node===current) continue;
      const p=center(node),dx=p.x-origin.x,dy=p.y-origin.y;
      const forward=direction==='down'?dy:direction==='up'?-dy:direction==='right'?dx:-dx;
      if (forward<4) continue;
      const lateral=vertical?Math.abs(dx):Math.abs(dy);
      // Prefer the same grid column/row, without any maximum-distance trap.
      const sameBand=vertical?lateral<(p.w+origin.w)*.47:lateral<(p.h+origin.h)*.47;
      const rank=forward+lateral*(sameBand?.2:2.2);
      if (rank<score) {best=node;score=rank;}
    }
    return best;
  }
  function firstSectionControl() {
    const candidates=MAIN.querySelectorAll('.eliteSection .sectionHead button:not([disabled]),.eliteSection .rail .card[onclick],.eliteSection .rail button:not([disabled])');
    for (const node of candidates) {
      if (!visible(node)) continue;
      if (!node.hasAttribute('tabindex') && !/^(BUTTON|A|INPUT|SELECT)$/.test(node.tagName)) {
        node.tabIndex=0;
        node.setAttribute('role','button');
      }
      return node;
    }
    return null;
  }
  function heroControl() {
    return MAIN.querySelector('.eliteHero .heroActions button:not([disabled])');
  }
  function handleKey(event) {
    if (!home() || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
    const direction=KEY[event.key];
    if (!direction) return false;
    if (document.querySelector('#player.open,.playerOverlay.open') || document.fullscreenElement) return false;
    if (document.body.classList.contains('p165SetupActive') ||
        document.body.classList.contains('p291SetupActive')) return false;
    const active=document.activeElement || event.target;
    if (active?.closest?.('input,textarea,select,[contenteditable="true"]')) return false;
    const tiles=quickTiles();
    if (!tiles.length) return false;
    const fromTile=tiles.find(node=>node===active);
    if (fromTile) {
      const target=nextTile(tiles,fromTile,direction);
      if (target) {stats.last='tile-'+direction;return focused(target);}
      if (direction==='up') {stats.last='hero';return focused(heroControl());}
      if (direction==='down') {stats.last='sections';return focused(firstSectionControl());}
      // At left/right grid boundaries, do not consume the key.
      return false;
    }
    // The old page-scroller consumes ArrowDown before the older Home shortcut.
    // Capture it before that scroller so remote focus can actually reach the tiles.
    const fromHeader=!!active?.closest?.('header,.top,.eliteHero');
    const fromTabs=!!(NAV && active && NAV.contains(active));
    const outsideMain=!active || !MAIN.contains(active);
    if (direction==='down' && (fromHeader || fromTabs || outsideMain)) {
      stats.last='enter-grid';return focused(tiles[0]);
    }
    if (direction==='up' && active?.closest?.('.eliteSection')) {
      stats.last='return-grid';return focused(tiles[0]);
    }
    // Other Home controls, such as horizontal content rails, keep existing navigation.
    return false;
  }
  window.PandaHomeFocus218=Object.freeze({
    version:'2.0.18',handleKey,focusFirst:()=>focused(quickTiles()[0]),
    inspect:()=>({route:home()?'home':'other',...stats})
  });
})();
