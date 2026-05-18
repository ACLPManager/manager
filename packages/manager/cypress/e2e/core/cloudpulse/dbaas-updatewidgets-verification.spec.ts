/* eslint-disable cypress/no-unnecessary-waiting */

/**
 * @file Integration Tests for CloudPulse Custom and Preset Verification
 */
import { profileFactory, regionFactory } from '@linode/utilities';
import { widgetDetails } from 'support/constants/widgets';
import { mockGetAccount } from 'support/intercepts/account';
import {
  mockCreateCloudPulseJWEToken,
  mockCreateCloudPulseMetrics,
  mockGetCloudPulseDashboard,
  mockGetCloudPulseDashboards,
  mockGetCloudPulseMetricDefinitions,
  mockGetCloudPulseServices,
} from 'support/intercepts/cloudpulse';
import { mockGetDatabases } from 'support/intercepts/databases';
import { mockAppendFeatureFlags } from 'support/intercepts/feature-flags';
import {
  mockGetProfile,
  mockGetUserPreferences,
} from 'support/intercepts/profile';
import { mockGetRegions } from 'support/intercepts/regions';
import { ui } from 'support/ui';
import { generateRandomMetricsData } from 'support/util/cloudpulse';

import {
  accountFactory,
  cloudPulseMetricsResponseFactory,
  dashboardFactory,
  dashboardMetricFactory,
  databaseFactory,
  flagsFactory,
  widgetFactory,
} from 'src/factories';

import type { Database } from '@linode/api-v4';
import type { Interception } from 'support/cypress-exports';

const mockRegion = regionFactory.build({
  capabilities: ['Managed Databases'],
  id: 'us-ord',
  label: 'Chicago, IL',
  monitors: {
    metrics: ['Managed Databases'],
    alerts: [],
  },
});

const { dashboardName, engine, id, metrics } = widgetDetails.dbaas;
const serviceType = 'dbaas';
const dashboard = dashboardFactory.build({
  label: dashboardName,
  service_type: serviceType,
  widgets: metrics.map(({ name, title, unit, yLabel }) => {
    return widgetFactory.build({
      label: title,
      metric: name,
      unit,
      y_label: yLabel,
      group_by: ['entity_id', 'node_type'],
    });
  }),
});

const metricDefinitions = {
  data: metrics.map(({ name, title, unit }) =>
    dashboardMetricFactory.build({
      label: title,
      metric: name,
      unit,
    })
  ),
};
const mockProfile = profileFactory.build({
  timezone: 'gmt',
});

const mockAccount = accountFactory.build();

const metricsAPIResponsePayload = cloudPulseMetricsResponseFactory.build({
  data: generateRandomMetricsData('Last 24 Hours', '1 hr'),
});

const databaseMock: Database = databaseFactory.build({
  region: mockRegion.id,
  type: engine,
});

describe('Integration tests for verifying Cloudpulse custom and preset configurations', () => {
  const now = new Date();
  const end = new Date(now.getTime() + 5.5 * 60 * 60 * 1000); // Adjust to IST
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);

  beforeEach(() => {
    mockAppendFeatureFlags(flagsFactory.build());
    mockGetAccount(mockAccount);
    mockGetProfile(mockProfile);
    mockGetCloudPulseMetricDefinitions(serviceType, metricDefinitions.data);
    mockGetCloudPulseDashboards(serviceType, [dashboard]);
    mockGetCloudPulseServices([serviceType]);
    mockGetCloudPulseDashboard(id, dashboard);
    mockCreateCloudPulseJWEToken(serviceType);
    mockCreateCloudPulseMetrics(serviceType, metricsAPIResponsePayload).as(
      'getMetrics'
    );
    mockGetRegions([mockRegion]);
    mockGetUserPreferences({
      aclpPreference: {
        dashboardId: id,
        engine: engine.toLowerCase(),
        region: mockRegion.id,
        resources: ['1'],
        node_type: 'secondary',
        dateTimeDuration: {
          end: end.toISOString(),
          preset: 'Last day',
          start: start.toISOString(),
          timeZone: 'Etc/GMT',
        },
        widgets: {
          'Disk I/O': {
            label: 'Disk I/O',
            timeGranularity: {
              unit: 'hr',
              value: 1,
            },
            aggregateFunction: 'min',
          },
          'CPU Utilization': {
            label: 'CPU Utilization',
            timeGranularity: {
              unit: 'hr',
              value: 1,
            },
            aggregateFunction: 'min',
          },
          'Memory Usage': {
            label: 'Memory Usage',
            timeGranularity: {
              unit: 'hr',
              value: 1,
            },
            aggregateFunction: 'min',
          },
          'Network Traffic': {
            label: 'Network Traffic',
            timeGranularity: {
              unit: 'hr',
              value: 1,
            },
            aggregateFunction: 'min',
          },
        },
      },
    }).as('fetchPreferences');
    mockGetDatabases([databaseMock]);
    cy.visitWithLogin('/metrics');
    mockCreateCloudPulseMetrics(serviceType, metricsAPIResponsePayload).as(
      'getMetrics'
    );
    // validate the API calls are going with intended payload
    cy.get('@getMetrics.all')
      .should('have.length', 4)
      .each((xhr: unknown) => {
        const interception = xhr as Interception;
        const { body: requestPayload } = interception.request;
        const {
          metrics: metric,
          relative_time_duration: timeRange,
          entity_ids,
          filters,
        } = requestPayload;
        const metricData = metrics.find(({ name }) => name === metric[0].name);

        if (!metricData) {
          throw new Error(
            `Unexpected metric name '${metric[0].name}' included in the outgoing refresh API request`
          );
        }
        expect(metric[0].name).to.equal(metricData.name);
        expect(metric[0].aggregate_function).to.equal('min');
        expect(timeRange).to.have.property('unit', 'days');
        expect(timeRange).to.have.property('value', 1);
        expect(entity_ids).to.deep.equal([1]);
        const filtersStr = JSON.stringify(filters);
        expect(filtersStr).to.include('"dimension_label":"node_type"');
        expect(filtersStr).to.include('"operator":"eq"');
        expect(filtersStr).to.include('"value":"secondary"');
      });
  });

  it('preserves updated global and widget filter values after reloading metrics dashboard', () => {
    cy.visitWithLogin('/linodes');
    ui.nav.findItemByTitle('Metrics').click();
    mockCreateCloudPulseMetrics(serviceType, metricsAPIResponsePayload).as(
      'getMetrics'
    );
    cy.wait('@fetchPreferences');
    cy.wait(5000);
    // validate the API calls are going with intended payload
    ui.button.findByTitle('Last day').click();
    cy.get('[data-qa-preset="Last 7 days"]', { timeout: 50000 }).click();
    cy.get('[data-qa-buttons="apply"]')
      .should('be.visible')
      .should('be.enabled')
      .click();
    // Select a Database Engine from the autocomplete input.
    ui.autocomplete
      .findByLabel('Database Engine')
      .should('be.visible')
      .type('MySQL');

    ui.autocompletePopper.findByTitle('MySQL').should('be.visible').click();

    ui.regionSelect.find().click();
    ui.regionSelect
      .findItemByRegionId(mockRegion.id, [mockRegion])
      .should('be.visible')
      .click();

    // Select a resource (Database Clusters) from the autocomplete input.
    ui.autocomplete
      .findByLabel('Database Clusters')
      .should('be.visible')
      .type('database-1 {enter}');

    ui.autocomplete.findByLabel('Database Clusters').click();

    // Select a Node from the autocomplete input.
    ui.autocomplete
      .findByLabel('Node Type')
      .should('be.visible')
      .type('Primary{enter}');

    cy.get('@getMetrics.all')
      .invoke('slice', -4)
      .each((xhr: unknown) => {
        const interception = xhr as Interception;
        const { body: requestPayload } = interception.request;
        const {
          metrics: metric,
          relative_time_duration: timeRange,
          entity_ids,
          filters,
        } = requestPayload;
        const metricData = metrics.find(({ name }) => name === metric[0].name);

        if (!metricData) {
          throw new Error(
            `Unexpected metric name '${metric[0].name}' included in the outgoing refresh API request`
          );
        }
        expect(metric[0].name).to.equal(metricData.name);
        expect(metric[0].aggregate_function).to.equal('min');
        expect(timeRange).to.have.property('unit', 'days');
        expect(timeRange).to.have.property('value', 7);
        expect(entity_ids).to.deep.equal([1]);
        const filtersStr = JSON.stringify(filters);
        expect(filtersStr).to.include('"dimension_label":"node_type"');
        expect(filtersStr).to.include('"operator":"eq"');
        expect(filtersStr).to.include('"value":"primary"');
      });
  });

  // Define the widget mapping
  const WidgetMap = [
    { title: 'Network Traffic', unit: 'B' },
    { title: 'Memory Usage', unit: 'B' },
    { title: 'CPU Utilization', unit: '%' },
    { title: 'Disk I/O', unit: 'OPS' },
  ];

  it('ensures graph tooltips reflect accurate metric data', () => {
    WidgetMap.forEach(({ title, unit }) => {
      const widgetSelector = `[data-qa-widget="${title}"]`;

      // 1. Ensure Cypress waits until the background mock response body is fully attached
      cy.get('@getMetrics.all')
        .should((interceptions: any) => {
          const relevant = interceptions.filter((xhr: any) => {
            const { metrics: metric } = xhr.request.body;
            const metricData = metrics.find(
              ({ name }) => name === metric[0]?.name
            );
            return metricData && metricData.title === title;
          });

          expect(relevant.length).to.be.greaterThan(0);
          expect(relevant[relevant.length - 1].response?.body).to.exist;
        })
        .then((interceptions: any) => {
          const relevantInterceptions = interceptions.filter((xhr: any) => {
            const { metrics: metric } = xhr.request.body;
            const metricData = metrics.find(
              ({ name }) => name === metric[0]?.name
            );
            return metricData && metricData.title === title;
          });

          const latestInterception =
            relevantInterceptions[relevantInterceptions.length - 1];
          const responseData = latestInterception.response.body;
          const results = responseData.data?.result || [];

          // 2. Find the correct series matching the current node type filter ('secondary')
          const matchingSeries =
            results.find((res: any) => {
              const targetTags = JSON.stringify(
                res.metric || res.tags || {}
              ).toLowerCase();
              return targetTags.includes('secondary');
            }) || results[0];

          const apiValues = matchingSeries?.values || [];

          // 3. Scroll to widget and initiate recursive dot validation
          cy.get(widgetSelector).scrollIntoView();

          cy.get(widgetSelector)
            .find('circle.recharts-area-dot')
            .its('length')
            .then((count) => {
              const checkDot = (index: number) => {
                if (index >= count) return; // Exit condition

                // Re-query by index every time to prevent detached DOM errors
                cy.get(widgetSelector)
                  .find('circle.recharts-area-dot')
                  .eq(index)
                  .trigger('mouseover', { force: true });

                // Allow React/Recharts state to settle and render the tooltip
                cy.wait(250);

                cy.get(widgetSelector)
                  .find('.recharts-tooltip-wrapper', { timeout: 10000 })
                  .should('be.visible')
                  .invoke('text')
                  .then((text) => {
                    // Standardize white spaces for reliable parsing
                    const cleanText = text.replace(/\s+/g, ' ').trim();

                    // Regex maps everything up to the widget title, then captures the value right before the unit
                    const regex = new RegExp(
                      `(.*)${title}\\s*([\\d.]+)\\s*${unit}`
                    );
                    const match = cleanText.match(regex);

                    if (!match) {
                      throw new Error(
                        `Failed to parse tooltip text: "${cleanText}" for widget "${title}"`
                      );
                    }

                    const domDateStr = match[1].trim();
                    const domValue = parseFloat(match[2]);

                    // 4. Convert DOM date string to a universal epoch timestamp
                    // Force the date to be parsed as GMT to match the mocked user profile
                    const domEpoch = Math.round(
                      new Date(`${domDateStr} GMT`).getTime() / 1000
                    );

                    // 5. Look up the corresponding data point in the API array by matching timestamps
                    const matchingApiPoint = apiValues.find(
                      ([apiEpoch]: [number, string]) => {
                        return Math.abs(apiEpoch - domEpoch) <= 60; // 60-second tolerance window
                      }
                    );

                    if (!matchingApiPoint) {
                      throw new Error(
                        `No matching API data point found for DOM timestamp: ${domDateStr} (${domEpoch})`
                      );
                    }

                    const apiValue = parseFloat(matchingApiPoint[1]);

                    // 6. Execute direct data validation
                    expect(domValue).to.eq(apiValue);

                    // 7. Proceed to the next dot in the chart
                    checkDot(index + 1);
                  });
              };

              // Start the recursive check
              checkDot(0);
            });
        });
    });
  });
});
