/**
 * @file Integration Tests for contextualview of Dbass Dashboard.
 */
import { mockAppendFeatureFlags } from 'support/intercepts/feature-flags';
import {
  mockCreateCloudPulseJWEToken,
  mockGetCloudPulseDashboard,
  mockCreateCloudPulseMetrics,
  mockGetCloudPulseMetricDefinitions,
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
import { mockGetRegions } from 'support/intercepts/regions';
import { CloudPulseMetricsResponse, Database } from '@linode/api-v4';
import { transformData } from 'src/features/CloudPulse/Utils/unitConversion';
import { getMetrics } from 'src/utilities/statMetrics';
import { generateRandomMetricsData } from 'support/util/cloudpulse';
import {
  mockGetDatabase,
  mockGetDatabaseTypes,
  mockGetDatabases,
} from 'support/intercepts/databases';
import { mockDatabaseNodeTypes } from 'support/constants/databases';
import { randomIp } from 'support/util/random';
import { extendRegion } from 'support/util/regions';

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
const expectedGranularityArray = ['Auto', '1 day', '1 hr', '5 min'];
const timeDurationToSelect = 'Last 24 Hours';

const {
  metrics,
  serviceType,
  dashboardName,
  region,
  engine,
  clusterName,
  nodeType,
} = widgetDetails.dbaas;

const dashboard = dashboardFactory.build({
  label: dashboardName,
  id: 2,
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

const metricsAPIResponsePayload = cloudPulseMetricsResponseFactory.build({
  data: generateRandomMetricsData(timeDurationToSelect, '5 min'),
});

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
 *    - node_type: The node_type associated with the dashboard user.
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
const allowedIp = randomIp();

const databaseMock: Database = databaseFactory.build({
  label: clusterName,
  id: 100,
  type: engine,
  region: region,
  version: '1',
  status: 'active',
  cluster_size: 1,
  engine: 'mysql',
  allow_list: [allowedIp],
});
const mockRegion = extendRegion(
  regionFactory.build({
    capabilities: ['Linodes'],
    id: 'us-ord',
    label: 'Chicago, IL',
    country: 'us',
  })
);

describe('Integration Tests for DBaaS Dashboard ', () => {
  beforeEach(() => {
    mockAppendFeatureFlags({
      aclp: { beta: true, enabled: true },
    });
    mockGetAccount(mockAccount);
    mockGetLinodes([mockLinode]);
    mockGetCloudPulseMetricDefinitions(serviceType, metricDefinitions);
    mockGetCloudPulseDashboard(2, dashboard);
    mockCreateCloudPulseJWEToken(serviceType);
    mockCreateCloudPulseMetrics(serviceType, metricsAPIResponsePayload).as(
      'getMetrics'
    );
    mockGetRegions([mockRegion]);
    mockGetDatabase(databaseMock).as('getDatabase');
    mockGetDatabases([databaseMock]).as('getDatabases');
    mockGetDatabaseTypes(mockDatabaseNodeTypes).as('getDatabaseTypes');

    // navigate to the linodes page
    cy.visitWithLogin('/linodes');

    // navigate to the Databases
    ui.nav.findItemByTitle('Databases').should('be.visible').click();

    // navigate to the Monitor
    cy.visitWithLogin(
      `/databases/${databaseMock.engine}/${databaseMock.id}/monitor`
    );

    // Select a time duration from the autocomplete input.
    ui.autocomplete
      .findByLabel('Time Range')
      .should('be.visible')
      .type(`${timeDurationToSelect}{enter}`)
      .should('be.visible');

    //Select a Node from the autocomplete input.
    ui.autocomplete
      .findByLabel('Node Type')
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
            .should('be.visible')
            .click();

          // Verify tooltip message for granularity selection

          ui.tooltip
            .findByText('Data aggregation interval')
            .should('be.visible');

          expectedGranularityArray.forEach((option) => {
            ui.autocompletePopper.findByTitle(option).should('exist');
          });

          mockCreateCloudPulseMetrics(
            serviceType,
            metricsAPIResponsePayload
          ).as('getGranularityMetrics');

          //find the interval component and select the expected granularity
          ui.autocomplete
            .findByLabel('Select an Interval')
            .should('be.visible')
            .type(`${testData.expectedGranularity}{enter}`); //type expected granularity

          //check if the API call is made correctly with time granularity value selected
          cy.wait('@getGranularityMetrics').then((interception) => {
            expect(interception)
              .to.have.property('response')
              .with.property('statusCode', 200);
            expect(testData.expectedGranularity).to.include(
              interception.request.body.time_granularity.value
            );
          });

          //validate the widget linegrah is present
          cy.findByTestId('linegraph-wrapper').within(() => {
            const expectedWidgetValues = getWidgetLegendRowValuesFromResponse(
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

  it('should allow users to select the desired aggregation and view the latest data from the API displayed in the graph', () => {
    metrics.forEach((testData) => {
      const widgetSelector = `[data-qa-widget="${testData.title}"]`;
      cy.get(widgetSelector)
        .should('be.visible')
        .within(() => {
          mockCreateCloudPulseMetrics(
            serviceType,
            metricsAPIResponsePayload
          ).as('getAggregationMetrics');

          //find the interval component and select the expected granularity
          ui.autocomplete
            .findByLabel('Select an Aggregate Function')
            .should('be.visible')
            .type(`${testData.expectedAggregation}{enter}`); //type expected granularity

          // Verify tooltip message for aggregation selection

          ui.tooltip.findByText('Aggregation function').should('be.visible');

          //check if the API call is made correctly with time granularity value selected
          cy.wait('@getAggregationMetrics').then((interception) => {
            expect(interception)
              .to.have.property('response')
              .with.property('statusCode', 200);
            expect(testData.expectedAggregation).to.equal(
              interception.request.body.aggregate_function
            );
          });

          //validate the widget linegrah is present
          cy.findByTestId('linegraph-wrapper').within(() => {
            const expectedWidgetValues = getWidgetLegendRowValuesFromResponse(
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

  it('should zoom in and out of all the widgets', () => {
    // do zoom in and zoom out test on all the widgets
    metrics.forEach((testData) => {
      cy.get(`[data-qa-widget="${testData.title}"]`).as('widget');
      cy.get('@widget')
        .should('be.visible')
        .within(() => {
          ui.button
            .findByAttribute('aria-label', 'Zoom In')
            .should('be.visible')
            .should('be.enabled')
            .click();

          // Verify tooltip message for Zoom-in

          ui.tooltip.findByText('Maximize').should('be.visible');
          cy.get('@widget').should('be.visible');
          cy.findByTestId('linegraph-wrapper').within(() => {
            const expectedWidgetValues = getWidgetLegendRowValuesFromResponse(
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

          // click zoom out and validate the same
          ui.button
            .findByAttribute('aria-label', 'Zoom Out')
            .should('be.visible')
            .should('be.enabled')
            .scrollIntoView()
            .click({ force: true });

          // Verify tooltip message for Zoom-out

          ui.tooltip.findByText('Minimize').should('be.visible');

          cy.get('@widget').should('be.visible');
          cy.findByTestId('linegraph-wrapper').within(() => {
            const expectedWidgetValues = getWidgetLegendRowValuesFromResponse(
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
