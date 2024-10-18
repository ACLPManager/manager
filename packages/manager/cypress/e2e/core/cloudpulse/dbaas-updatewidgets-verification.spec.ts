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
import { Database } from '@linode/api-v4';
import { generateRandomMetricsData } from 'support/util/cloudpulse';
import { mockGetDatabases } from 'support/intercepts/databases';
import { UserPreferences } from '@linode/api-v4/src/profile';
import { userPreferencesFactory } from 'src/factories/dashboards';
import { Interception } from 'cypress/types/net-stubbing';

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

const updateMockLinode = linodeFactory.build({
  label: 'test2',
  id: 2,
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

const databaseMock: Database = databaseFactory.build({
  label: clusterName,
  type: engine,
  id: 1,
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
const updateDatabaseMock: Database = databaseFactory.build({
  label: 'test2',
  id: 1,
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
const metricsAPIResponsePayload = cloudPulseMetricsResponseFactory.build({
  data: generateRandomMetricsData(timeDurationToSelect, '5 min'),
});

describe('Integration Tests for DBaaS Dashboard ', () => {
  beforeEach(() => {
    mockAppendFeatureFlags({
      aclp: { beta: true, enabled: true },
    });
    mockGetAccount(mockAccount); // Enables the account to have capability for Akamai Cloud Pulse
    mockGetLinodes([mockLinode, updateMockLinode]);
    mockGetCloudPulseMetricDefinitions(serviceType, metricDefinitions);
    mockGetCloudPulseDashboards(serviceType, [dashboard]).as('fetchDashboard');
    mockGetCloudPulseServices(serviceType).as('fetchServices');
    mockGetCloudPulseDashboard(id, dashboard);
    mockCreateCloudPulseJWEToken(serviceType);
    mockCreateCloudPulseMetrics(serviceType, metricsAPIResponsePayload).as(
      'getMetrics'
    );
    mockGetRegions([mockRegion]);
    mockGetUserPreferences({});
    mockGetDatabases([databaseMock, updateDatabaseMock]).as('getDatabases');

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
      .should('be.visible')
      .type(`${clusterName}{enter}`)
      .click();
    cy.findByText(clusterName).should('be.visible');

    mockUpdateUserPreferences(userPreferences).as('updateUserPreferences');

    //Select a Node from the autocomplete input.
    ui.autocomplete
      .findByLabel('Node Type')
      .should('be.visible')
      .type(`${nodeType}{enter}`);

    // Verify Node Type Preference Update
    cy.wait('@updateUserPreferences').then((interception) => {
      const { body: requestPayload } = interception.request;
      const preferences = requestPayload.aclpPreference;
      expect(preferences).to.have.property('dashboardId', id);
      expect(preferences).to.have.property(
        'timeDuration',
        timeDurationToSelect
      );
      expect(preferences).to.have.property('region', 'us-ord');
      expect(preferences).to.have.property('engine', engine.toLowerCase());
      expect(preferences).to.have.property('node_type', nodeType.toLowerCase());
      expect(preferences).to.have.property('resources').that.deep.equals(['1']);
    });

    // Wait for all metrics query requests to resolve.
    cy.wait(['@getMetrics', '@getMetrics', '@getMetrics', '@getMetrics']);
  });

  const updateMetricsAPIResponsePayload =
    cloudPulseMetricsResponseFactory.build({
      data: generateRandomMetricsData('Last 30 Days', '5 min'),
    });

  it.only('I have verified the values for the first time. Now, I want to check if the updated global and widget filter values are preserved', () => {
    // Step 1: Mock the user preferences API call

    mockGetUserPreferences(userPreferences).as('userPreferences');
    mockCreateCloudPulseMetrics(serviceType, metricsAPIResponsePayload).as(
      'changeRefreshMetrics'
    );

    // Step 1:Nnavigating to  linode
    cy.visitWithLogin('/linodes');
    // ui.nav.findItemByTitle('Linodes').should('be.visible').click();

    // Step 2: click on Monitor button from sidebar to nagigate to cloudPulse
    ui.nav.findItemByTitle('Monitor').should('be.visible').click();

    ui.autocomplete
      .findByLabel('Time Range')
      .should('be.visible')
      .type('Last 30 Days{enter}')
      .should('have.value', 'Last 30 Days');

    cy.wait('@changeRefreshMetrics');
    // validate the API calls are going with intended payload
    cy.get('@changeRefreshMetrics.all').should('have.length', 4);

    mockCreateCloudPulseMetrics(
      serviceType,
      updateMetricsAPIResponsePayload
    ).as('changeNode');

    //Select a Node from the autocomplete input.
    ui.autocomplete
      .findByLabel('Node Type')
      .should('be.visible')
      .scrollIntoView()
      .type(`Primary{enter}`);

    cy.wait('@changeNode');

    cy.get('@changeNode.all').should('have.length', 4);

    mockCreateCloudPulseMetrics(
      serviceType,
      updateMetricsAPIResponsePayload
    ).as('changeEngine');

    ui.autocomplete
      .findByLabel('Engine')
      .should('be.visible')
      .type(`PostgreSQL{enter}`)
      .should('be.visible');

    // Resource from the autocomplete input.
    ui.autocomplete
      .findByLabel('DB Clusters')
      .should('be.visible')
      .type(`test2{enter}`)
      .click();

    cy.wait('@changeEngine');

    cy.get('@changeEngine.all')
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
        expect(timeRange).to.have.property('unit', 'days');
        expect(timeRange).to.have.property('value', 30);
        expect(interception.request.body.resource_ids).to.deep.equal([1]);
        expect('primary').to.equal(interception.request.body.filters[0]?.value);
        expect('node_type').to.equal(interception.request.body.filters[0]?.key);
      });
  });
});
