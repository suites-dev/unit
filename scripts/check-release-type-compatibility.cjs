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
const {
  compatibilityPlan,
  declarationPackages: releases,
} = require('./type-compatibility-plan.cjs');

// Exercise published declarations together with packed candidates; workspace links
// alone always align package versions and cannot reproduce these failures.
const root = process.cwd();
const scratch = mkdtempSync(join(tmpdir(), 'suites-type-compatibility-'));
const candidate = join(scratch, 'candidate');
const published = join(scratch, 'published');
const fixtureRoot = join(__dirname, 'fixtures', 'release-type-compatibility');
const results = [];
let plan;
const registry = process.env.SUITES_TYPE_COMPAT_REGISTRY || 'https://registry.npmjs.org';
const packages = [
  ['@suites/core.unit', 'packages/core'],
  ['@suites/unit', 'packages/unit'],
  ['@suites/doubles.jest', 'packages/doubles/jest'],
  ['@suites/doubles.vitest', 'packages/doubles/vitest'],
  ['@suites/types.common', 'packages/types/common'],
  ['@suites/types.di', 'packages/types/di'],
  ['@suites/types.doubles', 'packages/types/doubles'],
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
  const candidateVersions = {};
  for (const [name, folder] of packages) {
    if (!existsSync(join(root, folder, 'dist')) && releases.includes(name)) {
      throw new Error('Build the workspace before running type compatibility checks.');
    }
    candidateVersions[name] = JSON.parse(readFileSync(join(root, folder, 'package.json'))).version;
    run('pnpm', ['pack', '--pack-destination', candidate], join(root, folder));
  }
  const publishedVersions = Object.fromEntries(
    releases.map((name) => {
      const prefix = `${name}@`;
      const versions = run('git', ['tag', '-l', `${prefix}*`])
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((tag) => tag.slice(prefix.length));
      return [name, versions];
    })
  );
  plan = compatibilityPlan({ candidateVersions, publishedVersions });
  const fixtures = plan.fixtureSet === 'v4' ? fixtureRoot : join(fixtureRoot, plan.fixtureSet);
  const packTargets = [
    ...Object.entries(plan.baselines).map(([name, version]) => `${name}@${version}`),
    ...(plan.compilerProfiles.includes('5.2.2') ? ['typescript@5.2.2'] : []),
  ];
  if (packTargets.length > 0) {
    run('npm', [
      'pack',
      ...packTargets,
      '--ignore-scripts',
      '--registry',
      registry,
      '--cache',
      join(scratch, 'npm-cache'),
      '--pack-destination',
      published,
    ]);
  }

  const compilers = [
    ['current', join(root, 'node_modules/typescript/bin/tsc'), 'NodeNext', 'NodeNext'],
  ];
  if (plan.compilerProfiles.includes('5.2.2')) {
    unpack(join(published, 'typescript-5.2.2.tgz'), join(scratch, 'typescript-5.2.2'));
    // Published Vitest rejects TS 5.2 NodeNext's CJS/ESM checks. Keep its
    // supported classic resolver in the V4 baseline comparison.
    compilers.push(['5.2.2', join(scratch, 'typescript-5.2.2/lib/tsc.js'), 'CommonJS', 'Node10']);
  }
  const currentCompiler = JSON.parse(
    readFileSync(join(root, 'node_modules/typescript/package.json'), 'utf8')
  ).version;
  console.log(
    `Compatibility mode: ${plan.mode}; candidate major ${plan.candidateMajor}; fixtures ${plan.fixtureSet}.`
  );
  for (const [label, current] of plan.combinations) {
    for (const framework of ['jest', 'vitest']) {
      const consumer = join(scratch, `${label}-${framework}`);
      const modules = join(consumer, 'node_modules');
      mkdirSync(modules, { recursive: true });
      dependencies(modules);
      const selectedPackages = {};
      for (const [name, folder] of packages) {
        const usePublished = plan.baselines[name] !== undefined && !current.includes(name);
        const version = usePublished ? plan.baselines[name] : candidateVersions[name];
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
  if (process.env.GITHUB_STEP_SUMMARY && plan) {
    const packageRows = plan.combinations.map(([label]) => {
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
        `Mode: **${plan.mode}** for candidate major **${plan.candidateMajor}** using **${plan.fixtureSet}** fixtures.`,
        '',
        plan.mode === 'same-major'
          ? 'Published same-major baselines exist for all declaration-coupled packages, so the complete published, mixed-package, and aligned matrix remains release-blocking.'
          : 'No declaration-coupled package has a published stable baseline in this candidate major. Cross-major combinations are inapplicable; aligned candidate declarations remain release-blocking.',
        '',
        'Candidate Unit checks fluent APIs and declaration emission/consumption. Compiler failures remain release-blocking.',
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
