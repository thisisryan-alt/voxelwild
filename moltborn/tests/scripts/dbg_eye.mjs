export default async (page, H) => {
  await H.load('?manual=1');
  console.log('[t]', await H.eval(async () => {
    const { Painter, unpack } = await import('/src/gfx/painter.js'); const { eyeStalk } = await import('/src/gfx/crab_kit.js'); const { R } = await import('/src/gfx/palette.js');
    const p = new Painter(16, 16, '#170d1c'); eyeStalk(p, 8, 8, 14, { stalk: '#552', r: 2.2 });
    const before = []; for (let y = 5; y < 12; y++) { let r = ''; for (let x = 4; x < 12; x++) { const [rr, g, b, a] = unpack(p.d[y * 16 + x]); r += a ? ((rr + g + b) < 150 ? '#' : (rr + g + b) > 600 ? 'o' : '+') : '.'; } before.push(r); }
    p.finish(); const after = []; for (let y = 5; y < 12; y++) { let r = ''; for (let x = 4; x < 12; x++) { const [rr, g, b, a] = unpack(p.d[y * 16 + x]); r += a ? ((rr + g + b) < 150 ? '#' : (rr + g + b) > 600 ? 'o' : '+') : '.'; } after.push(r); }
    return before.join('\n') + '\n\n' + after.join('\n');
  }));
};
