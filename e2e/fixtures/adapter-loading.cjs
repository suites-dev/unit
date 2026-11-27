const assert = require('node:assert/strict');

module.exports = async function verify(TestBed, scenario, packageName) {
  globalThis.adapterFailure = new Error('adapter initialization failed');
  class Subject {}
  const builders = [TestBed.solitary(Subject), TestBed.sociable(Subject).compose()];
  // A consumer can configure a builder and compile on a later turn.
  await new Promise((resolve) => setImmediate(resolve));
  for (const builder of builders) {
    if (['legacy', 'invalid-registry', 'invalid-failure'].includes(scenario)) {
      await assert.rejects(builder.compile(), { code: 'ER021', message: /Update your DI adapter for v5/ });
      continue;
    }
    if (scenario === 'valid' || scenario === 'multiple') {
      const { unit } = await builder.compile();
      assert.ok(unit instanceof Subject);
      continue;
    }
    await assert.rejects(builder.compile(), (error) => {
      assert.equal(error.code, scenario === 'missing' ? 'ER020' : 'ER021');
      if (scenario !== 'missing') assert.ok(error.message.includes(packageName), error.message);
      if (scenario === 'throws') assert.equal(error.cause, globalThis.adapterFailure);
      if (scenario === 'broken-entry' || scenario === 'invalid-exports')
        assert.ok(error.cause instanceof Error);
      return true;
    });
  }
};
