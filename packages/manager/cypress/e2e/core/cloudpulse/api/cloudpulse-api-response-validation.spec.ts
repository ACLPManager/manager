/**
 * @file cloudpulse-api.spec.ts
 * @description Self-contained Cypress tests for /monitor dashboards and metric-definitions.
 */

import type { Dashboard } from '@linode/api-v4';

// -----------------------------
// Single source of truth for all service configurations
// -----------------------------
const services = [
  { type: 'dbaas', id: 1, hasMetricDefinitions: true },
  { type: 'nodebalancer', id: 3, hasMetricDefinitions: true },
  { type: 'firewall', id: 4, hasMetricDefinitions: true },
  { type: 'objectstorage', id: 6, hasMetricDefinitions: true },
  { type: 'netloadbalancer', id: 5, hasMetricDefinitions: false },
];

describe('CloudPulse API - Dashboards and Metric Definitions', () => {
  const apiRoot = Cypress.env('REACT_APP_API_ROOT');
  const token = Cypress.env('MANAGER_OAUTH');

  // Map of environments to their corresponding Cloud URLs
  const apiRootToCloudMap: Record<string, string> = {
    'https://api.linode.com/v4': 'https://api.linode.com',
    'https://api.dev.linode.com/v4': 'https://api.dev.linode.com',
    'https://api.staging.linode.com/v4': 'https://api.staging.linode.com',
    'https://api.devcloud.linode.com/v4': 'https://api.devcloud.linode.com',
  };

  // top of describe block
  const toList = (raw: unknown): Dashboard[] => {
    if (
      raw != null &&
      !Array.isArray(raw) &&
      typeof raw === 'object' &&
      'data' in (raw as object)
    ) {
      return (raw as { data: Dashboard[] }).data;
    }
    return Array.isArray(raw) ? raw : [raw as Dashboard];
  };

  const apiBaseUrl = apiRootToCloudMap[apiRoot];

  // Guard: fail fast with a clear message if env is misconfigured
  before(() => {
    if (!apiBaseUrl) {
      throw new Error(
        `Unknown REACT_APP_API_ROOT: "${apiRoot}". ` +
          `Expected one of: ${Object.keys(apiRootToCloudMap).join(', ')}`
      );
    }
    if (!token) {
      throw new Error('MANAGER_OAUTH env variable is not set.');
    }
  });

  const IGNORED_KEYS: string[] = [
    'id',
    'uuid',
    'created',
    'updated',
    'timestamp',
    'page',
    'pages',
    'results',
    'is_alertable',
  ];

  const UNORDERED_ARRAY_PATHS: string[] = [
    'available_aggregate_functions',
    'dimensions.values',
  ];

  // -----------------------------
  // Recursive deep comparison
  // -----------------------------
  const assertDeepEqual = (
    actual: unknown,
    expected: unknown,
    path = '',
    ignoreKeys: string[] = IGNORED_KEYS,
    unorderedPaths: string[] = UNORDERED_ARRAY_PATHS
  ): void => {
    if (actual === undefined || expected === undefined) {
      expect(actual, `path "${path}" — undefined mismatch`).to.equal(expected);
      return;
    }
    if (actual === null || expected === null) {
      expect(actual, `path "${path}" — null mismatch`).to.equal(expected);
      return;
    }

    const actualIsArray = Array.isArray(actual);
    const expectedIsArray = Array.isArray(expected);

    if (actualIsArray !== expectedIsArray) {
      throw new Error(
        `path "${path}" — type mismatch: one is array, the other is not`
      );
    }

    if (actualIsArray && expectedIsArray) {
      const unordered = unorderedPaths.some((p) => path.endsWith(p));

      if (unordered) {
        const sortByStringify = (a: unknown, b: unknown) =>
          JSON.stringify(a).localeCompare(JSON.stringify(b));
        expect(
          [...actual].sort(sortByStringify),
          `path "${path}" — unordered array mismatch`
        ).to.deep.equal([...expected].sort(sortByStringify));
      } else {
        expect(actual.length, `path "${path}" — array length`).to.equal(
          expected.length
        );
        actual.forEach((item: unknown, idx: number) => {
          assertDeepEqual(
            item,
            expected[idx],
            `${path}[${idx}]`,
            ignoreKeys,
            unorderedPaths
          );
        });
      }
      return;
    }

    if (typeof actual === 'object' && typeof expected === 'object') {
      const actualKeys = Object.keys(actual as object)
        .filter((k) => !ignoreKeys.includes(k))
        .sort();
      const expectedKeys = Object.keys(expected as object)
        .filter((k) => !ignoreKeys.includes(k))
        .sort();

      const extraInActual = actualKeys.filter((k) => !expectedKeys.includes(k));
      const missingInActual = expectedKeys.filter(
        (k) => !actualKeys.includes(k)
      );

      if (extraInActual.length || missingInActual.length) {
        throw new Error(
          `path "${path}" — object key mismatch.\n` +
            (extraInActual.length
              ? `Extra keys in response:  ${extraInActual.join(', ')}\n`
              : '') +
            (missingInActual.length
              ? `Missing keys in response: ${missingInActual.join(', ')}`
              : '')
        );
      }

      expectedKeys.forEach((key) => {
        assertDeepEqual(
          (actual as Record<string, unknown>)[key],
          (expected as Record<string, unknown>)[key],
          path ? `${path}.${key}` : key,
          ignoreKeys,
          unorderedPaths
        );
      });
      return;
    }

    expect(actual, `path "${path}" — value mismatch`).to.equal(expected);
  };

  // -----------------------------
  // Strip ignored keys recursively (used for normalizing before comparison)
  // -----------------------------
  const stripIgnoredKeys = (obj: unknown): unknown => {
    if (Array.isArray(obj)) return obj.map(stripIgnoredKeys);
    if (typeof obj !== 'object' || obj === null) return obj;

    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>)
        .filter(([key]) => !IGNORED_KEYS.includes(key))
        .map(([key, value]) => [key, stripIgnoredKeys(value)])
    );
  };

  // Fixture path helper
  const fixturePath = (type: string, file: string): string =>
    `${Cypress.config('fileServerFolder')}/cypress/e2e/core/cloudpulse/api-response/${type}-${file}.json`;

  // -----------------------------
  // Dashboards tests
  // -----------------------------
  context('Dashboards', () => {
    // --- List by service type ---
    context('List dashboards by service type', () => {
      services.forEach(({ type }) => {
        it(`should fetch ${type.toUpperCase()} dashboards`, () => {
          const url = `${apiBaseUrl}/v4beta/monitor/services/${type}/dashboards`;

          cy.readFile(fixturePath(type, 'dashboard-response')).then(
            (templateData) => {
              const templateList: Dashboard[] = toList(templateData);

              cy.request({
                method: 'GET',
                url,
                headers: { Authorization: `Bearer ${token}` },
              }).then((res) => {
                expect(res.status).to.eq(200);
                expect(res.body).to.have.property('data').that.is.an('array');
                expect(res.body.data.length, 'dashboard list length').to.equal(
                  templateList.length
                );
                assertDeepEqual(res.body.data, templateList);
              });
            }
          );
        });
      });
    });

    // --- Fetch by dashboard ID (ID discovered dynamically from the list endpoint) ---
    context('Fetch dashboard by ID', () => {
      services.forEach(({ type }) => {
        it(`should fetch ${type.toUpperCase()} dashboard by ID`, () => {
          const listUrl = `${apiBaseUrl}/v4beta/monitor/services/${type}/dashboards`;

          cy.readFile(fixturePath(type, 'dashboard-response')).then(
            (templateData) => {
              const templateList: Dashboard[] =
                templateData?.data ?? templateData;
              const templateFirst = stripIgnoredKeys(
                templateList[0]
              ) as Dashboard;

              // Derive the ID from the live list so tests stay env-agnostic
              cy.request({
                method: 'GET',
                url: listUrl,
                headers: { Authorization: `Bearer ${token}` },
              }).then((listRes) => {
                expect(listRes.status).to.eq(200);
                expect(listRes.body.data)
                  .to.be.an('array')
                  .with.length.greaterThan(0);

                const dashboardId: number = listRes.body.data[0].id;
                const byIdUrl = `${apiBaseUrl}/v4beta/monitor/dashboards/${dashboardId}`;

                cy.request({
                  method: 'GET',
                  url: byIdUrl,
                  headers: { Authorization: `Bearer ${token}` },
                }).then((res) => {
                  expect(res.status).to.eq(200);
                  const actualNormalized = stripIgnoredKeys(
                    res.body
                  ) as Dashboard;
                  assertDeepEqual(actualNormalized, templateFirst);
                });
              });
            }
          );
        });
      });
    });
  });

  // -----------------------------
  // Metric Definitions tests
  // -----------------------------
  context('Metric Definitions', () => {
    services
      .filter(({ hasMetricDefinitions }) => hasMetricDefinitions)
      .forEach(({ type }) => {
        it(`should fetch ${type.toUpperCase()} metric definitions`, () => {
          const url = `${apiBaseUrl}/v4beta/monitor/services/${type}/metric-definitions`;

          cy.readFile(fixturePath(type, 'metric-definition')).then(
            (templateData) => {
              cy.request({
                method: 'GET',
                url,
                headers: { Authorization: `Bearer ${token}` },
              }).then((res) => {
                expect(res.status).to.eq(200);
                expect(res.body).to.have.property('data').that.is.an('array');
                assertDeepEqual(
                  res.body.data,
                  templateData.data,
                  '',
                  IGNORED_KEYS,
                  UNORDERED_ARRAY_PATHS
                );
              });
            }
          );
        });
      });
  });
});
