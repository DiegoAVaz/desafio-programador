(async () => {
  const results = [];
  for (const f of FILES) {
    try {
      results.push(await analyzeFile(f));
    } catch (e) {
      results.push({ file: f, error: String(e) });
    }
  }
  const out = JSON.stringify({ analyzedAt: new Date().toISOString(), results }, null, 2);
  fs.writeFileSync(path.join(__dirname, 'payroll-analysis-output.json'), out, 'utf8');
})();
