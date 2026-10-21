// Background of the "matchs de la semaine" screen: the stands seen from the pitch, animated,
// dimmed by CSS under the list. Same scenery as the title, framed on the crowd.

const Stadium = (() => {
  const CH = 90; // core height: big sky and stands, little grass
  const MIN_W = 120; // room for the tower on the left and the rooster on the right
  let W = 160;
  let H = CH;
  let theme = 'neutral';
  let canvas, ctx, bg, raf = null;

  // Stands a third of the way down
  const bandY = () => Math.round(H * 0.32);

  function build() {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    Scenery.paint(c.getContext('2d'), theme, W, H, bandY(), Math.floor(W / 2));
    return c;
  }

  function frame(now) {
    ctx.drawImage(bg, 0, 0);
    ctx.save();
    ctx.translate(0, bandY());
    Scenery.animate(ctx, theme, now, W);
    ctx.restore();
    raf = requestAnimationFrame(frame);
  }

  return {
    init(el) {
      canvas = el;
      ctx = canvas.getContext('2d');
      canvas.width = W;
      canvas.height = H;
      bg = build();
      ctx.drawImage(bg, 0, 0);
    },
    // Same proportions as the window: nothing cropped, nothing stretched
    resize(aspect) {
      const w = Math.max(MIN_W, Math.round(CH * aspect));
      const h = Math.max(CH, Math.round(w / aspect));
      if ((w === W && h === H) || !ctx) return;
      W = w;
      H = h;
      canvas.width = W;
      canvas.height = H;
      bg = build();
      ctx.drawImage(bg, 0, 0);
    },
    setTheme(name) {
      theme = name;
      bg = build();
      ctx.drawImage(bg, 0, 0);
    },
    start() {
      if (raf || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = null;
    },
  };
})();
