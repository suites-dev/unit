const assert = require('node:assert/strict');

module.exports = async function verify(TestBed, scenario, packageName) {
  globalThis.adapterFailure = new Error('adapter initialization failed');
  class Subject {}
  const builder = TestBed.solitary(Subject);
  // A consumer can configure a builder and compile on a later turn.
  await new Promise((resolve) => setImmediate(resolve));
  if (scenario === 'valid') {
    const { unit } = await builder.compile();
    assert.ok(unit instanceof Subject);
    return;
  }
  await assert.rejects(builder.compile(), (error) => {
    assert.equal(error.code, scenario === 'missing' ? 'ER020' : 'ER021');
    if (scenario !== 'missing') assert.ok(error.message.includes(packageName), error.message);
    if (scenario === 'throws') assert.equal(error.cause, globalThis.adapterFailure);
    return true;
  });
};
