// Save codes and backups. OUT prefix.
export default async (page, H) => {
  const out = process.env.OUT || '/tmp/st';
  await H.load('?manual=1'); await H.adv(30);
  const r = await H.eval(async () => {
    const { Save, validate } = await import('/src/core/save.js'); const g = window.__game, o = {};
    g.state.level = 14; g.state.coins = 321; g.slot = 1; g.saveGame(true);
    const code = Save.exportCode(1); o.codeOk = /^MB1\.[a-z0-9]+\./.test(code); o.len = code.length;
    o.import = Save.importCode(2, code); o.sameLevel = Save.read(2)?.state.level === 14;
    o.bad1 = Save.importCode(0, 'garbage'); o.bad2 = Save.importCode(0, code.slice(0, -5) + 'AAAA'); const parts = code.split('.'); o.bad3 = Save.importCode(0, parts[0] + '.zzz.' + parts[2]);
    const broken = JSON.parse(JSON.stringify(Save.read(1))); delete broken.state.checkpoint; o.validateBroken = validate(broken);
    // a backup appears once an older save exists and enough time has passed
    localStorage.setItem('moltborn.bakt.1', '0'); g.state.coins = 999; g.saveGame(true); o.hasBackup = !!Save.backup(1); o.backupCoins = Save.backup(1)?.state.coins;
    o.restore = Save.restoreBackup(1); o.restoredCoins = Save.read(1).state.coins;
    // the scene
    const { SaveToolsScene } = await import('/src/ui/savetools.js'); window.prompt = () => code; g.engine.push(new SaveToolsScene(g)); g.advance(3); const sc = g.engine.top; sc.slot = 0; sc.run('IMPORT'); o.sceneImport = !!Save.read(0); o.msg = sc.msg;
    g.advance(2); return o;
  });
  console.log('[t]', JSON.stringify(r)); await H.canvas(`${out}_tools.png`);
};
