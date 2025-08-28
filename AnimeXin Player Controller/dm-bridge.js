/**
 * AnimeXin Dailymotion Bridge
 * Injected into https://*.dailymotion.com/* iframes to control playback
 * without requiring api=1 or origin query params.
 *
 * Communicates with parent (animexin.dev) via postMessage using a namespaced schema:
 * - Incoming from parent: { source:'animexin-controller', type:'dm_bridge_command', action, data }
 * - Outgoing to parent:   { source:'animexin-controller', type:'dm_bridge_event',   event, data }
 */

(function () {
  try {
    const MESSAGE_SOURCE = 'animexin-controller';
    const ALLOWED_PARENT_RE = /(^|\.)animexin\.dev$/i;

    let videoEl = null;
    let lastTimeEventTs = 0;

    function findVideo() {
      if (videoEl && !videoEl.isConnected) videoEl = null;
      if (videoEl) return videoEl;
      videoEl = document.querySelector('video');
      if (videoEl) attachVideoListeners(videoEl);
      return videoEl;
    }

    function attachVideoListeners(v) {
      try {
        v.addEventListener('play', () => emit('play'));
        v.addEventListener('pause', () => emit('pause'));
        v.addEventListener('ended', () => emit('ended'));
        v.addEventListener('durationchange', () => emit('durationchange', { duration: v.duration || 0 }));
        v.addEventListener('timeupdate', () => {
          const now = performance.now();
          if (now - lastTimeEventTs < 250) return; // throttle
          lastTimeEventTs = now;
          emit('timeupdate', { time: v.currentTime || 0 });
        });
      } catch (_) {}
    }

    function emit(eventName, data) {
      try {
        window.parent.postMessage({
          source: MESSAGE_SOURCE,
          type: 'dm_bridge_event',
          event: eventName,
          data: data || {}
        }, '*');
      } catch (_) {}
    }

    function respond(eventName, data) {
      emit(eventName, data);
    }

    function handleCommand(cmd, data) {
      const v = findVideo();
      // Some commands don't require video
      try {
        switch (cmd) {
          case 'play':
            if (!v) return;
            v.play().catch(() => {});
            break;
          case 'pause':
            if (!v) return;
            v.pause();
            break;
          case 'seek': {
            if (!v) return;
            const t = Math.max(0, Math.floor(Number(data?.time) || 0));
            v.currentTime = t;
            respond('current_time', t);
            break;
          }
          case 'get_current_time':
            if (v) respond('current_time', v.currentTime || 0);
            break;
          case 'get_duration':
            if (v) respond('duration', v.duration || 0);
            break;
          case 'get_player_state':
            if (v) respond('player_state', { isPlaying: !v.paused });
            break;
          case 'fullscreen':
            requestFullscreenInFrame();
            break;
          case 'arm_fullscreen':
            armFullscreenOnGesture();
            break;
        }
      } catch (_) {}
    }

    function requestFullscreenInFrame() {
      try {
        const target = findVideo() || document.documentElement;
        const p = target && (target.requestFullscreen ? target.requestFullscreen() : (target.webkitRequestFullscreen ? target.webkitRequestFullscreen() : null));
        if (p && typeof p.then === 'function') {
          p.then(() => emit('fs_success')).catch(() => {
            emit('fs_blocked');
            armFullscreenOnGesture();
          });
        } else {
          // Non-promise path
          emit('fs_success');
        }
      } catch (_) {
        emit('fs_blocked');
        armFullscreenOnGesture();
      }
    }

    function armFullscreenOnGesture() {
      try {
        const handler = () => {
          requestFullscreenInFrame();
        };
        window.addEventListener('click', handler, { once: true, capture: true });
      } catch (_) {}
    }

    // Listen for commands from parent (top page on animexin.dev)
    window.addEventListener('message', (evt) => {
      try {
        const { origin, data, source } = evt;
        if (!data || typeof data !== 'object') return;
        if (data.source !== MESSAGE_SOURCE || data.type !== 'dm_bridge_command') return;

        // Optional origin check (best effort)
        try {
          const u = new URL(origin);
          if (!ALLOWED_PARENT_RE.test(u.hostname)) return;
        } catch (_) {}

        handleCommand(data.action, data.data);
      } catch (_) {}
    }, { passive: true });

    // Attempt initial discovery
    findVideo();

    // Observe DOM for late-mounted <video>
    const mo = new MutationObserver(() => { findVideo(); });
    mo.observe(document.documentElement || document.body, { childList: true, subtree: true });

    // Announce readiness so parent can start syncing
    emit('apiready');
  } catch (e) {
    // Silent fail inside third-party frame
  }
})();


