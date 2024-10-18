/**
 * @file Integration Tests for CloudPulse Dbass Dashboard.
 */
import { mockAppendFeatureFlags } from 'support/intercepts/feature-flags';
import {
  mockCreateCloudPulseJWEToken,
  mockGetCloudPulseDashboard,
  mockCreateCloudPulseMetrics,
  mockGetCloudPulseDashboards,
  mockGetCloudPulseMetricDefinitions,
  mockGetCloudPulseServices,
} from 'support/intercepts/cloudpulse';
import { ui } from 'support/ui';
import { widgetDetails } from 'support/constants/widgets';
import {
  accountFactory,
  cloudPulseMetricsResponseFactory,
  dashboardFactory,
  dashboardMetricFactory,
  databaseFactory,
  linodeFactory,
  regionFactory,
  widgetFactory,
} from 'src/factories';
import { mockGetAccount } from 'support/intercepts/account';
import { mockGetLinodes } from 'support/intercepts/linodes';
import {
  mockGetUserPreferences,
  mockUpdateUserPreferences,
} from 'support/intercepts/profile';
import { mockGetRegions } from 'support/intercepts/regions';
import { extendRegion } from 'support/util/regions';
import { CloudPulseMetricsResponse, Database } from '@linode/api-v4';
import { transformData } from 'src/features/CloudPulse/Utils/unitConversion';
import { getMetrics } from 'src/utilities/statMetrics';
import { Interception } from 'cypress/types/net-stubbing';
import { generateRandomMetricsData } from 'support/util/cloudpulse';
import { mockGetDatabases } from 'support/intercepts/databases';
import { UserPreferences } from '@linode/api-v4/src/profile';
import { userPreferencesFactory } from 'src/factories/dashboards';

/**
 * This test ensures that widget titles are displayed correctly on the dashboard.
 * This test suite is dedicated to verifying the functionality and display of widgets on the Cloudpulse dashboard.
 *  It includes:
 * Validating that widgets are correctly loaded and displayed.
 * Ensuring that widget titles and data match the expected values.
 * Verifying that widget settings, such as granularity and aggregation, are applied correctly.
 * Testing widget interactions, including zooming and filtering, to ensure proper behavior.
 * Each test ensures that widgets on the dashboard operate correctly and display accurate information.
 */
const expectedGranularityArray = ['1 day', '1 hr', '5 min'];
const timeDurationToSelect = 'Last 24 Hours';

const {
  metrics,
  id,
  serviceType,
  dashboardName,
  region,
  engine,
  clusterName,
  nodeType,
} = widgetDetails.dbaas;

const dashboard = dashboardFactory.build({
  label: dashboardName,
  service_type: serviceType,
  widgets: metrics.map(({ title, yLabel, name, unit }) => {
    return widgetFactory.build({
      label: title,
      y_label: yLabel,
      metric: name,
      unit,
    });
  }),
});

const metricDefinitions = {
  data: metrics.map(({ title, name, unit }) =>
    dashboardMetricFactory.build({
      label: title,
      metric: name,
      unit,
    })
  ),
};

const mockLinode = linodeFactory.build({
  label: clusterName,
  id: 1,
});

const mockAccount = accountFactory.build();
const mockRegion = extendRegion(
  regionFactory.build({
    capabilities: ['Linodes'],
    id: 'us-ord',
    label: 'Chicago, IL',
    country: 'us',
  })
);
const metricsAPIResponsePayload = cloudPulseMetricsResponseFactory.build({
  data: generateRandomMetricsData(timeDurationToSelect, '5 min'),
});
const userPreferences = userPreferencesFactory.build({
  aclpPreference: {
    dashboardId: id,
    engine: engine.toLowerCase(),
    region: 'us-ord',
    resources: ['1'],
    timeDuration: timeDurationToSelect,
    node_type: nodeType.toLowerCase(),
    // You can also override widgets if necessary
    widgets: {
      'CPU Utilization': {
        aggregateFunction: 'max',
        label: 'CPU Utilization',
        timeGranularity: { unit: 'hr', value: 1 },
      },
      'Disk I/O': {
        aggregateFunction: 'max',
        label: 'Disk I/O',
        timeGranularity: { unit: 'hr', value: 1 },
      },
      'Memory Usage': {
        aggregateFunction: 'max',
        label: 'Memory Usage',
        timeGranularity: { unit: 'hr', value: 1 },
      },
      'Network Traffic': {
        aggregateFunction: 'max',
        label: 'Network Traffic',
        timeGranularity: { unit: 'hr', value: 1 },
      },
    },
  },
} as Partial<UserPreferences>);

/**
 * Verifies the presence and values of specific properties within the aclpPreference object
 * of the request payload. This function checks that the expected properties exist
 * and have the expected values, allowing for validation of user preferences in the application.
 *
 * @param requestPayload - The payload received from the request, containing the aclpPreference object.
 * @param expectedValues - An object containing the expected values for properties to validate against the requestPayload.
 *    Expected properties may include:
 *    - dashboardId: The ID of the dashboard.
 *    - timeDuration: The selected time duration for metrics.
 *    - engine: The database engine used.
 *    - region: The selected region for the dashboard.
 *    - resources: An array of resource identifiers.
 *    - node type: The node type associated with the dashboard user.
 */
const getWidgetLegendRowValuesFromResponse = (
  responsePayload: CloudPulseMetricsResponse
) => {
  const data = transformData(responsePayload.data.result[0].values, 'Bytes');
  const { average, last, max } = getMetrics(data);
  const roundedAverage = Math.round(average * 100) / 100;
  const roundedLast = Math.round(last * 100) / 100;
  const roundedMax = Math.round(max * 100) / 100;
  return { average: roundedAverage, last: roundedLast, max: roundedMax };
};

const databaseMock: Database = databaseFactory.build({
  label: clusterName,
  type: engine,
  region: region,
  version: '1',
  status: 'provisioning',
  cluster_size: 1,
  engine: 'mysql',
  hosts: {
    primary: undefined,
    secondary: undefined,
  },
});

const viewports = [
  { name: 'iPad', width: 768, height: 1024 },
  { name: 'Tablet', width: 1024, height: 768 },
  { name: 'iPhone', width: 375, height: 667 },
];

viewports.forEach(({ name, width, height }) => {
  describe(`Integration Tests for DBaaS Dashboard Focusing on Responsive Behavior for ${name}`, () => {
    beforeEach(() => {
      mockAppendFeatureFlags({
        aclp: { beta: true, enabled: true },
      });
      mockGetAccount(mockAccount); // Enables the account to have capability for Akamai Cloud Pulse
      mockGetLinodes([mockLinode]);
      mockGetCloudPulseMetricDefinitions(serviceType, metricDefinitions);
      mockGetCloudPulseDashboards(serviceType, [dashboard]).as(
        'fetchDashboard'
      );
      mockGetCloudPulseServices(serviceType).as('fetchServices');
      mockGetCloudPulseDashboard(id, dashboard);
      mockCreateCloudPulseJWEToken(serviceType);
      mockCreateCloudPulseMetrics(serviceType, metricsAPIResponsePayload).as(
        'getMetrics'
      );
      mockGetRegions([mockRegion]);
      mockGetUserPreferences({});
      mockGetDatabases([databaseMock]).as('getDatabases');
      cy.viewport(width, height);

      // navigate to the cloudpulse page
      cy.visitWithLogin('monitor/cloudpulse');

      // Wait for the services and dashboard API calls to complete before proceeding
      cy.wait(['@fetchServices', '@fetchDashboard']);

      // Selecting a dashboard from the autocomplete input.
      ui.autocomplete
        .findByLabel('Dashboard')
        .should('be.visible')
        .type(`${dashboardName}{enter}`)
        .should('be.visible');

      // Select a time duration from the autocomplete input.
      ui.autocomplete
        .findByLabel('Time Range')
        .should('be.visible')
        .type(`${timeDurationToSelect}{enter}`)
        .should('be.visible');

      //Select a Engine from the autocomplete input.
      ui.autocomplete
        .findByLabel('Engine')
        .should('be.visible')
        .type(`${engine}{enter}`)
        .should('be.visible');

      // Select a region from the dropdown.
      ui.regionSelect.find().click().type(`${region}{enter}`);

      // Resource from the autocomplete input.
      ui.autocomplete
        .findByLabel('DB Clusters')
        .scrollIntoView()
        .should('be.visible')
        .type(`${clusterName}{enter}`)
        .click();
      cy.findByText(clusterName).should('be.visible');

      mockUpdateUserPreferences(userPreferences).as('updateUserPreferences');

      //Select a Node from the autocomplete input.
      ui.autocomplete
        .findByLabel('Node Type')
        .scrollIntoView()
        .should('be.visible')
        .type(`${nodeType}{enter}`);

      // Wait for all metrics query requests to resolve.

      cy.wait(['@getMetrics', '@getMetrics', '@getMetrics', '@getMetrics']);
    });

    it('should allow users to select their desired granularity and see the most recent data from the API reflected in the graph', () => {
      // validate the widget level granularity selection and its metrics
      metrics.forEach((testData) => {
        const widgetSelector = `[data-qa-widget="${testData.title}"]`;
        cy.get(widgetSelector)
          .should('be.visible')
          .find('h2')
          .should('have.text', `${testData.title} (${testData.unit.trim()})`);
        cy.get(widgetSelector)
          .should('be.visible')
          .within(() => {
            // check for all available granularity in popper
            ui.autocomplete
              .findByLabel('Select an Interval')
              .scrollIntoView()
              .should('be.visible')
              .click();

            expectedGranularityArray.forEach((option) => {
              ui.autocompletePopper.findByTitle(option).should('exist');
            });
            expectedGranularityArray.forEach((granularityValue) => {
              mockCreateCloudPulseMetrics(
                serviceType,
                metricsAPIResponsePayload
              ).as('getGranularityMetrics');

              //find the interval component and select the expected granularity
              ui.autocomplete
                .findByLabel('Select an Interval')
                .scrollIntoView()
                .should('be.visible')
                .clear()
                .type(`${granularityValue}{enter}`); //type expected granularity

              //check if the API call is made correctly with time granularity value selected
              cy.wait('@getGranularityMetrics').then((interception) => {
                expect(interception)
                  .to.have.property('response')
                  .with.property('statusCode', 200);
                expect(granularityValue).to.include(
                  interception.request.body.time_granularity.value
                );
              });

              //validate the widget linegrah is present
              cy.findByTestId('linegraph-wrapper').within(() => {
                const expectedWidgetValues =
                  getWidgetLegendRowValuesFromResponse(
                    metricsAPIResponsePayload
                  );
                cy.findByText(`${testData.title} (${testData.unit})`).should(
                  'be.visible'
                );
                cy.get(`[data-qa-graph-column-title="Max"]`)
                  .should('be.visible')
                  .should(
                    'have.text',
                    `${expectedWidgetValues.max} ${testData.unit}`
                  );

                cy.get(`[data-qa-graph-column-title="Avg"]`)
                  .should('be.visible')
                  .should(
                    'have.text',
                    `${expectedWidgetValues.average} ${testData.unit}`
                  );

                cy.get(`[data-qa-graph-column-title="Last"]`)
                  .should('be.visible')
                  .should(
                    'have.text',
                    `${expectedWidgetValues.last} ${testData.unit}`
                  );
              });
            });
          });
      });
    });
    it('should allow users to select the desired aggregation and view the latest data from the API displayed in the graph', () => {
      metrics.forEach((testData) => {
        const widgetSelector = `[data-qa-widget="${testData.title}"]`;
        cy.get(widgetSelector)
          .should('be.visible')
          .within(() => {
            testData.expectedAggregationArray.forEach((aggregationValue) => {
              mockCreateCloudPulseMetrics(
                serviceType,
                metricsAPIResponsePayload
              ).as('getAggregationMetrics');

              //find the interval component and select the expected granularity
              ui.autocomplete
                .findByLabel('Select an Aggregate Function')
                .scrollIntoView()
                .should('be.visible')
                .clear()
                .type(`${aggregationValue}{enter}`); //type expected granularity

              //check if the API call is made correctly with time granularity value selected
              cy.wait('@getAggregationMetrics').then((interception) => {
                expect(interception)
                  .to.have.property('response')
                  .with.property('statusCode', 200);
                expect(aggregationValue).to.equal(
                  interception.request.body.aggregate_function
                );
              });

              //validate the widget linegrah is present
              cy.findByTestId('linegraph-wrapper').within(() => {
                const expectedWidgetValues =
                  getWidgetLegendRowValuesFromResponse(
                    metricsAPIResponsePayload
                  );
                cy.findByText(`${testData.title} (${testData.unit})`).should(
                  'be.visible'
                );
                cy.get(`[data-qa-graph-column-title="Max"]`)
                  .should('be.visible')
                  .should(
                    'have.text',
                    `${expectedWidgetValues.max} ${testData.unit}`
                  );

                cy.get(`[data-qa-graph-column-title="Avg"]`)
                  .should('be.visible')
                  .should(
                    'have.text',
                    `${expectedWidgetValues.average} ${testData.unit}`
                  );

                cy.get(`[data-qa-graph-column-title="Last"]`)
                  .should('be.visible')
                  .should(
                    'have.text',
                    `${expectedWidgetValues.last} ${testData.unit}`
                  );
              });
            });
          });
      });
    });
    it('should trigger the global refresh button and verify the corresponding network calls', () => {
      mockCreateCloudPulseMetrics(serviceType, metricsAPIResponsePayload).as(
        'refreshMetrics'
      );

      // click the global refresh button
      ui.button
        .findByAttribute('aria-label', 'Refresh Dashboard Metrics')
        .should('be.visible')
        .click();

      // validate the API calls are going with intended payload
      cy.get('@refreshMetrics.all')
        .should('have.length', 4)
        .each((xhr: unknown) => {
          const interception = xhr as Interception;
          const { body: requestPayload } = interception.request;
          const { metric, relative_time_duration: timeRange } = requestPayload;
          const metricData = metrics.find(({ name }) => name === metric);

          if (!metricData) {
            throw new Error(
              `Unexpected metric name '${metric}' included in the outgoing refresh API request`
            );
          }
          expect(metric).to.equal(metricData.name);
          expect(timeRange).to.have.property('unit', 'hr');
          expect(timeRange).to.have.property('value', 24);
        });
    });

    it('Verify that the widget and global filters reflect the saved user preferences after reloading the page.', () => {
      // Step 1: Mock the user preferences API call
      mockGetUserPreferences(userPreferences).as('userPreferences');

      // Step 1:Nnavigating to  linode
      cy.visitWithLogin('/monitor/cloudpulse');
      // ui.nav.findItemByTitle('Linodes').should('be.visible').click();

      // Step 3: Verify global filter selections
      // Check if the Dashboard filter is visible and has the correct value
      ui.autocomplete
        .findByLabel('Dashboard')
        .should('be.visible')
        .and('have.value', dashboardName);

      // Check if the Time Duration filter is visible and has the correct value
      ui.autocomplete
        .findByLabel('Time Range')
        .should('be.visible')
        .and('have.value', timeDurationToSelect);

      // Check if the Engine filter is visible and has the correct value
      ui.autocomplete
        .findByLabel('Engine')
        .scrollIntoView()
        .should('be.visible')
        .and('have.value', engine);

      // Check if the Region filter is visible and has the correct value
      ui.regionSelect.find().should('be.visible').and('have.value', region);

      // Check if the Resource filter is visible
      ui.autocomplete
        .findByLabel('DB Clusters')
        .scrollIntoView()
        .should('be.visible');

      // Check if the Node Type filter is visible and has the correct value
      ui.autocomplete
        .findByLabel('Node Type')
        .scrollIntoView()
        .scrollIntoView() // Scrolls the element into view
        .should('be.visible')
        .and('have.value', nodeType);

      ui.button.findByTitle('Filters').should('be.visible').click();

      // Step 5: Verify each widget's title and configuration
      metrics.forEach((testData) => {
        // Create a selector for the widget itself
        const widgetSelector = `[data-qa-widget="${testData.title}"]`;

        // Verify the widget is visible
        cy.get(widgetSelector)
          .should('be.visible')
          .first()
          .within(() => {
            // Check if the Interval selection is visible and has the correct value
            ui.autocomplete
              .findByLabel('Select an Interval')
              .should('be.visible')
              .and('have.value', testData.expectedGranularity.toLowerCase());

            // Check if the Aggregate Function selection is visible and has the correct value
            ui.autocomplete
              .findByLabel('Select an Aggregate Function')
              .should('be.visible')
              .invoke('val') // Get the value from the UI
              .then((val) => {
                expect(val.toLowerCase()).to.equal(
                  testData.expectedAggregation.toLowerCase()
                );
              });
          });
      });
    });
  });
});
