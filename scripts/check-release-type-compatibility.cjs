const { execFileSync } = require('node:child_process');
const {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

// Exercise published declarations together with packed candidates; workspace links
// alone always align package versions and cannot reproduce these failures.
const root = process.cwd();
const scratch = mkdtempSync(join(tmpdir(), 'suites-type-compatibility-'));
const candidate = join(scratch, 'candidate');
const published = join(scratch, 'published');
const fixtures = join(__dirname, 'fixtures', 'release-type-compatibility');
const results = [];
const packages = [
  ['@suites/core.unit', 'packages/core'],
  ['@suites/unit', 'packages/unit'],
  ['@suites/doubles.jest', 'packages/doubles/jest'],
  ['@suites/doubles.vitest', 'packages/doubles/vitest'],
  ['@suites/types.common', 'packages/types/common'],
  ['@suites/types.di', 'packages/types/di'],
  ['@suites/types.doubles', 'packages/types/doubles'],
];
const releases = [
  '@suites/core.unit',
  '@suites/unit',
  '@suites/doubles.jest',
  '@suites/doubles.vitest',
];
const matrix = [
  ['published', []],
  ['core-only', ['@suites/core.unit']],
  ['old-unit', ['@suites/core.unit', '@suites/doubles.jest', '@suites/doubles.vitest']],
  ['old-adapters', ['@suites/core.unit', '@suites/unit']],
  ['aligned', releases],
];
const run = (command, args, cwd = root) =>
  execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
const link = (source, target) => {
  mkdirSync(resolve(target, '..'), { recursive: true });
  if (!existsSync(target)) symlinkSync(realpathSync(source), target, 'dir');
};
function unpack(archive, destination) {
  mkdirSync(destination, { recursive: true });
  run('tar', ['-xzf', archive, '--strip-components=1', '-C', destination]);
}
function dependencies(destination) {
  for (const dependency of readdirSync(join(root, 'node_modules'))) {
    if (dependency.startsWith('.') || dependency === '@suites') continue;
    link(join(root, 'node_modules', dependency), join(destination, dependency));
  }
  for (const [name, folder] of [
    ['@vitest/spy', 'packages/doubles/vitest'],
    ['@jest/globals', 'packages/doubles/jest'],
  ]) {
    link(join(root, folder, 'node_modules', name), join(destination, name));
  }
}

try {
  mkdirSync(candidate);
  mkdirSync(published);
  for (const [name, folder] of packages) {
    if (!existsSync(join(root, folder, 'dist')) && releases.includes(name)) {
      throw new Error('Build the workspace before running type compatibility checks.');
    }
    run('pnpm', ['pack', '--pack-destination', candidate], join(root, folder));
  }
  run('npm', [
    'pack',
    ...releases.map((name) => `${name}@4.1.2`),
    'typescript@5.2.2',
    '--ignore-scripts',
    '--registry=https://registry.npmjs.org',
    '--pack-destination',
    published,
  ]);
  unpack(join(published, 'typescript-5.2.2.tgz'), join(scratch, 'typescript-5.2.2'));

  const compilers = [
    ['current', join(root, 'node_modules/typescript/bin/tsc'), 'NodeNext', 'NodeNext'],
    // Vitest 4.1.2 already rejects TS 5.2 NodeNext's CJS/ESM checks. Keep its
    // supported classic resolver in this baseline comparison.
    ['5.2.2', join(scratch, 'typescript-5.2.2/lib/tsc.js'), 'CommonJS', 'Node10'],
  ];
  const currentCompiler = JSON.parse(
    readFileSync(join(root, 'node_modules/typescript/package.json'), 'utf8')
  ).version;
  for (const [label, current] of matrix) {
    for (const framework of ['jest', 'vitest']) {
      const consumer = join(scratch, `${label}-${framework}`);
      const modules = join(consumer, 'node_modules');
      mkdirSync(modules, { recursive: true });
      dependencies(modules);
      const selectedPackages = {};
      for (const [name, folder] of packages) {
        const manifest = JSON.parse(readFileSync(join(root, folder, 'package.json'), 'utf8'));
        const usePublished = releases.includes(name) && !current.includes(name);
        const version = usePublished ? '4.1.2' : manifest.version;
        selectedPackages[name] = { version, source: usePublished ? 'published' : 'candidate' };
        const filename = `${name.replace('@', '').replace('/', '-')}-${version}.tgz`;
        unpack(join(usePublished ? published : candidate, filename), join(modules, name));
      }
      writeFileSync(join(consumer, 'package.json'), '{"private":true}');
      const files = ['legacy.ts', 'core.ts', 'testbed-subclasses.ts'];
      const hasCandidateUnit = current.includes('@suites/unit');
      if (hasCandidateUnit) files.push('fluent.ts', 'helpers.ts');
      for (const file of [...files, ...(hasCandidateUnit ? ['emitted.ts'] : [])]) {
        writeFileSync(
          join(consumer, file),
          readFileSync(join(fixtures, file), 'utf8').replaceAll(
            '@suites/doubles.jest/unit',
            `@suites/doubles.${framework}/unit`
          )
        );
      }
      for (const [version, compiler, module, moduleResolution] of compilers) {
        const config = join(consumer, 'tsconfig.json');
        writeFileSync(
          config,
          JSON.stringify({
            compilerOptions: {
              target: 'ES2022',
              module,
              moduleResolution,
              strict: true,
              skipLibCheck: false,
              noEmit: true,
              types: [],
            },
            files,
          })
        );
        const compilerVersion = version === 'current' ? currentCompiler : version;
        const description = `${label}, ${framework}, TypeScript ${compilerVersion} (${moduleResolution})`;
        const result = {
          label,
          framework,
          compiler: compilerVersion,
          moduleResolution,
          packages: selectedPackages,
          status: 'passed',
        };
        let stage = 'consumer compilation';
        if (process.env.GITHUB_ACTIONS) console.log(`::group::${description}`);
        console.log(
          `Checking ${description}: ${releases
            .map(
              (name) =>
                `${name}@${selectedPackages[name].version} (${selectedPackages[name].source})`
            )
            .join(', ')}`
        );
        try {
          run(process.execPath, [compiler, '-p', config]);
          if (hasCandidateUnit) {
            stage = 'declaration emission';
            run(process.execPath, [
              compiler,
              '-p',
              config,
              '--noEmit',
              'false',
              '--declaration',
              '--emitDeclarationOnly',
              '--outDir',
              join(consumer, 'declarations'),
            ]);
            const emittedConfig = join(consumer, 'tsconfig.emitted.json');
            writeFileSync(
              emittedConfig,
              JSON.stringify({
                extends: './tsconfig.json',
                files: ['emitted.ts'],
              })
            );
            stage = 'emitted declaration consumption';
            run(process.execPath, [compiler, '-p', emittedConfig]);
          }
          console.log(`Passed ${description}`);
        } catch (error) {
          result.status = 'failed';
          result.stage = stage;
          result.error = [error.stdout, error.stderr].filter(Boolean).join('\n') || error.message;
          console.error(`Failed ${description} during ${stage}`);
          console.error(result.error);
          process.exitCode = 1;
        } finally {
          results.push(result);
          if (process.env.GITHUB_ACTIONS) console.log('::endgroup::');
        }
      }
    }
  }
  const passed = results.filter((result) => result.status === 'passed').length;
  console.log(
    `Packed-package compatibility: ${passed} passed, ${results.length - passed} failed, ${results.length} total.`
  );
} catch (error) {
  console.error(error.stdout || error.stderr || error.message);
  process.exitCode = 1;
} finally {
  writeFileSync(join(scratch, 'results.json'), JSON.stringify(results, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY) {
    const packageRows = matrix.map(([label]) => {
      const result = results.find((entry) => entry.label === label);
      if (!result) return `| ${label} | not prepared | | | |`;
      const versions = releases.map((name) => {
        const pkg = result.packages[name];
        return `${pkg.version} (${pkg.source})`;
      });
      return `| ${label} | ${versions.join(' | ')} |`;
    });
    const resultRows = results.map(
      (result) =>
        `| ${result.label} | ${result.framework} | ${result.compiler} / ${result.moduleResolution} | ${result.status} | ${result.stage || ''} |`
    );
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      [
        '### Published and candidate type compatibility',
        '',
        'The same legacy consumer fixtures, including TestBed subclass overrides, are compiled against each package combination. Candidate Unit also checks fluent APIs and declaration emission/consumption. Compiler failures remain release-blocking.',
        '',
        '| Combination | Core | Unit | Jest doubles | Vitest doubles |',
        '| --- | --- | --- | --- | --- |',
        ...packageRows,
        '',
        '| Combination | Adapter | TypeScript / resolution | Result | Failed stage |',
        '| --- | --- | --- | --- | --- |',
        ...resultRows,
        '',
        process.exitCode
          ? '**Compatibility verification failed. See the labeled compiler errors in the job log.**'
          : '**All compatibility checks passed.**',
        '',
      ].join('\n')
    );
  }
  if (process.exitCode) console.error(`Compatibility artifacts retained at ${scratch}`);
  else rmSync(scratch, { recursive: true, force: true });
}
