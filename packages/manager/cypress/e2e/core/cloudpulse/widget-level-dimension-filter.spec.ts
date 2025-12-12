import { linodeFactory, regionFactory } from '@linode/utilities';
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
import {
  mockAppendFeatureFlags,
  mockGetFeatureFlagClientstream,
} from 'support/intercepts/feature-flags';
import { mockGetLinodes } from 'support/intercepts/linodes';
import { mockGetUserPreferences } from 'support/intercepts/profile';
import { mockGetRegions } from 'support/intercepts/regions';
import { mockGetVolumes } from 'support/intercepts/volumes';
import { ui } from 'support/ui';
import { generateRandomMetricsData } from 'support/util/cloudpulse';

import {
  accountFactory,
  cloudPulseMetricsResponseFactory,
  dashboardFactory,
  dashboardMetricFactory,
  flagsFactory,
  volumeFactory,
  widgetFactory,
} from 'src/factories';

import type { Dashboard, Filters } from '@linode/api-v4';
import type { Interception } from 'support/cypress-exports';

// Test data constants
const timeDurationToSelect = 'Last 24 Hours';
const { dashboardName, id, metrics } = widgetDetails.blockstorage;
const serviceType = 'blockstorage';

// Interface for addFilter props
interface AddFilterProps {
  dimension: string;
  index: number;
  operator: string;
  value: string;
}

// Helper function to add a filter in the drawer
const addFilter = ({ index, dimension, operator, value }: AddFilterProps) => {
  ui.button.findByTitle('Add Filter').click();
  cy.get(`[data-testid="dimension_filters.${index}-id"]`).within(() => {
    ui.autocomplete
      .findByLabel('Dimension')
      .should('be.visible')
      .type(dimension);
    ui.autocompletePopper.findByTitle(dimension).should('be.visible').click();

    ui.autocomplete.findByLabel('Operator').should('be.visible').type(operator);
    ui.autocompletePopper.findByTitle(operator).should('be.visible').click();

    cy.get(`[data-qa-dimension-filter="dimension_filters.${index}-value"]`)
      .findByPlaceholderText('Enter a Value')
      .should('be.visible')
      .type(value);
  });
};

// Helper function to open the filter drawer for a widget
const openFilterDrawer = (widgetIndex: number = 0) => {
  ui.button
    .findByAttribute(
      'aria-label',
      `Widget Dimension Filter${dashboard.widgets[widgetIndex].label}`
    )
    .should('be.visible')
    .click();
  cy.get('[data-testid="drawer"]').should('be.visible');
};

// Helper function to verify drawer content
const verifyDrawerContent = (widgetIndex: number = 0) => {
  ui.drawer
    .find()
    .should('be.visible')
    .within(() => {
      cy.get('[data-testid="drawer-title"]')
        .should('be.visible')
        .and('contain.text', 'Dimension Filters');

      cy.get('[data-qa-id="filter-drawer-subtitle"]')
        .should('be.visible')
        .and('contain.text', dashboard.widgets[widgetIndex].label);

      cy.get('[data-qa-id="filter-drawer-selection-title"]')
        .should('be.visible')
        .and('contain.text', 'Select up to 5 filters');

      ui.button
        .findByTitle('Add Filter')
        .should('be.visible')
        .and('be.enabled');

      ui.button
        .findByAttribute('label', 'Apply')
        .should('be.visible')
        .and('be.enabled')
        .and('not.have.attr', 'aria-disabled', 'true');

      ui.button
        .findByAttribute('label', 'Cancel')
        .should('be.visible')
        .and('be.enabled');

      ui.drawerCloseButton.find().should('be.visible').and('be.enabled');

      cy.get('[data-qa-dimension-filter="dimension_filters.0-id"]').should(
        'not.exist'
      );
    });
};

// Helper function to verify badge count
const verifyBadgeCount = (count: string, widgetIndex: number = 0) => {
  ui.button
    .findByAttribute(
      'aria-label',
      `Widget Dimension Filter${dashboard.widgets[widgetIndex].label}`
    )
    .within(() => {
      if (count === '0') {
        cy.get('[data-qa-badge="dimension-filter-badge-content"]')
          .should('be.visible')
          .invoke('text')
          .should('be.empty');
      } else {
        cy.get('[data-qa-badge="dimension-filter-badge-content"]')
          .should('be.visible')
          .and('contain.text', count);
      }
    });
};

// Helper function to verify dimensions exclude certain filters
// const verifyDimensionsExcludeFilters = (excludedFilters: string[]) => {
//   ui.autocompletePopper
//     .find()
//     .should('be.visible')
//     .find('[data-qa-option]')
//     .then(($options) => {
//       cy.log(`${$options}`);
//       const dimensionOptions = $options
//         .toArray()
//         .map((el) => el.textContent?.trim() || '')
//         .filter((text) => text !== '');

//       // Verify each excluded filter (global filter) is NOT present in dimension options array
//       excludedFilters.forEach((excludedFilter) => {
//         expect(dimensionOptions).to.not.include(excludedFilter);
//       });
//     });
// };

const verifyDimensionsExcludeFilters = (excludedFilters: string[]) => {
  ui.autocompletePopper.find().within(() => {
    excludedFilters.forEach((filter) => {
      cy.findByText(filter).should('not.exist');
    });
  });
};

// Helper function to select dashboard and resources
const selectDashboardAndResources = () => {
  ui.autocomplete
    .findByLabel('Dashboard')
    .should('be.visible')
    .type(dashboardName);

  ui.autocompletePopper.findByTitle(dashboardName).should('be.visible').click();

  ui.regionSelect.find().clear();
  ui.regionSelect.find().click();
  ui.regionSelect.find().click().type(`${mockRegions[0].label}{enter}`);

  ui.autocomplete
    .findByLabel('Volumes')
    .should('be.visible')
    .type(mockVolumesEncrypted[0].label);

  ui.autocompletePopper
    .findByTitle(mockVolumesEncrypted[0].label)
    .should('be.visible')
    .click();

  ui.autocomplete.findByLabel('Volumes').type('{esc}');

  cy.wait(Array(6).fill('@getMetrics'));
  cy.get('[data-qa-widget]').should('have.length.at.least', 1);
};

// Dashboard definition
const dashboard = dashboardFactory.build({
  label: dashboardName,
  service_type: serviceType,
  id,
  widgets: metrics.map(({ name, title, unit, yLabel }) =>
    widgetFactory.build({
      filters: [],
      label: title,
      metric: name,
      unit,
      y_label: yLabel,
      namespace_id: id,
      service_type: serviceType,
    })
  ),
});

// Convert widget filters to dashboard filters
const getFiltersForMetric = (metricName: string) => {
  const metric = metrics.find((m) => m.name === metricName);
  if (!metric) return [];

  return metric.filters.map((filter) => ({
    dimension_label: filter.dimension_label,
    label: filter.dimension_label,
    values: filter.value
      ? Array.isArray(filter.value)
        ? filter.value
        : [filter.value]
      : undefined,
  }));
};

// Metric definitions
const metricDefinitions = metrics.map(({ name, title, unit }) =>
  dashboardMetricFactory.build({
    label: title,
    metric: name,
    unit,
    dimensions: [...getFiltersForMetric(name)],
  })
);

const mockRegions = [
  regionFactory.build({
    capabilities: ['Block Storage'],
    id: 'us-ord',
    label: 'Chicago, IL',
    monitors: {
      metrics: ['Block Storage'],
      alerts: [],
    },
  }),
];

const metricsAPIResponsePayload = cloudPulseMetricsResponseFactory.build({
  data: generateRandomMetricsData(timeDurationToSelect, '5 min'),
});

const mockVolumesEncrypted = [
  volumeFactory.build({
    encryption: 'enabled',
    label: 'test-volume-ord',
    region: 'us-ord', // Chicago
  }),
];

describe('Widget level dimension filter ', () => {
  beforeEach(() => {
    /*
     * - Verifies Initial state of filter is correct.
     * - Validates clicking the filter icon opens the filter drawer.
     * - Confirms the clearall,close icon, apply and cancel buttons are enabled.
     * - Verifies the mock response contains the applied filter.
     * - Ensures a maximum of 5 filters can be added and the add filter button is disabled on adding the 5th filter.
     * - Validates removing individual filters updates the badge count and the correct filters are applied.
     * - Confirms unsaved filters are discarded when the drawer is closed or canceled.
     * - Validates the clear all button removes all filters and badge count is updated.
     * - Ensures the filter drawer opens correctly for all widgets and filters can be added.
     * - Verifies that widget level filters exclude global dashboard filters for all widgets.
     */
    // Block LaunchDarkly clientstream to prevent feature flags from being overridden
    mockGetFeatureFlagClientstream();
    const flags = flagsFactory.build();
    const mergedFlags = {
      ...flags,
      aclp: {
        ...flags.aclp,
      },
    };
    mockAppendFeatureFlags(mergedFlags).as('featureFlags');
    mockGetAccount(accountFactory.build());
    mockGetCloudPulseMetricDefinitions(serviceType, metricDefinitions);
    mockGetCloudPulseDashboards(serviceType, [dashboard]).as('fetchDashboard');
    mockGetCloudPulseServices([serviceType]).as('fetchServices');
    mockGetCloudPulseDashboard(id, dashboard).as('fetchDashboard');
    mockCreateCloudPulseJWEToken(serviceType);
    mockCreateCloudPulseMetrics(serviceType, metricsAPIResponsePayload).as(
      'getMetrics'
    );
    mockGetRegions(mockRegions);
    mockGetVolumes(mockVolumesEncrypted);
    mockGetUserPreferences({});

    // Navigate to the metrics page
    cy.visitWithLogin('/metrics');

    // Wait for the services and dashboard API calls to complete before proceeding
    cy.wait(['@fetchServices']);
    cy.wait('@fetchDashboard').then((interception: Interception) => {
      const dashboards = interception.response?.body?.data as Dashboard[];
      const dashboard = dashboards[0];
      expect(dashboard.widgets).to.have.length(6);
    });

    selectDashboardAndResources();
  });

  it('should verify initial UI state of the filter drawer and apply functionality', () => {
    // Verifies the tooltip message on hover of filter icon
    ui.tooltip.findByText('Dimension Filters').should('be.visible');

    ui.drawer.find().should('not.exist');
    // Open the filter drawer
    openFilterDrawer();
    // Verify drawer content for apply
    verifyDrawerContent();

    addFilter({
      index: 0,
      dimension: 'entity_id',
      operator: 'Equal',
      value: '123',
    });

    ui.button
      .findByAttribute('label', 'Apply')
      .should('be.visible')
      .and('not.have.attr', 'aria-disabled', 'true');

    ui.button.findByAttribute('label', 'Apply').click();

    ui.drawer.find().should('not.exist');

    verifyBadgeCount('1');

    // Validate the widget-level metrics API call contains correct filters
    cy.wait('@getMetrics').then((interception) => {
      expect(interception)
        .to.have.property('response')
        .with.property('statusCode', 200);

      // Check for entity_id filter with value "123"
      const entityIdFilter = interception.request.body.filters.find(
        (filter: Filters) => filter.dimension_label === 'entity_id'
      );

      expect(entityIdFilter).to.exist;
      expect(entityIdFilter.operator).to.equal('eq');
      expect(entityIdFilter.value).to.equal('123');

      // Ensure only one filter is applied
      expect(interception.request.body.filters).to.have.length(1);
    });
  });

  it('should verify at max 5 filters can be added at widget level and add filter to be disabled on adding 5th filter', () => {
    openFilterDrawer();

    const filters = [
      { dimension: 'entity_id', operator: 'Equal', value: '123' },
      { dimension: 'entity_id', operator: 'Equal', value: '345' },
      { dimension: 'response_type', operator: 'Equal', value: '2xx' },
      { dimension: 'response_type', operator: 'Equal', value: '4xx' },
      { dimension: 'entity_id', operator: 'Equal', value: '123' },
    ];

    filters.forEach(({ dimension, operator, value }, index) =>
      addFilter({
        index,
        dimension,
        operator,
        value,
      })
    );

    // After 5th filter, Add Filter button should be disabled
    ui.button.findByTitle('Add Filter').should('be.visible').and('be.disabled');

    ui.button
      .findByAttribute('label', 'Apply')
      .should('be.visible')
      .and('not.have.attr', 'aria-disabled', 'true');

    ui.button.findByAttribute('label', 'Apply').click();

    ui.drawer.find().should('not.exist');

    verifyBadgeCount('5');

    // intercept api call to validate 5 filters applied
    cy.wait('@getMetrics').then((interception) => {
      expect(interception)
        .to.have.property('response')
        .with.property('statusCode', 200);

      // Ensure 5 filters are applied
      expect(interception.request.body.filters).to.have.length(5);

      // Verify the order and values of filters applied
      filters.forEach(({ dimension, value }, index) => {
        const appliedFilter = interception.request.body.filters[index];
        expect(appliedFilter.dimension_label).to.equal(dimension);
        expect(appliedFilter.operator).to.equal('eq');
        expect(appliedFilter.value).to.equal(value);
      });
    });
  });

  it('should remove individual filters and verify badge count updates', () => {
    openFilterDrawer();

    const filters = [
      { dimension: 'entity_id', operator: 'Equal', value: '123' },
      { dimension: 'entity_id', operator: 'Equal', value: '345' },
      { dimension: 'response_type', operator: 'Equal', value: '2xx' },
      { dimension: 'response_type', operator: 'Equal', value: '4xx' },
      { dimension: 'entity_id', operator: 'Equal', value: '123' },
    ];

    filters.forEach(({ dimension, operator, value }, index) =>
      addFilter({
        index,
        dimension,
        operator,
        value,
      })
    );
    ui.button.findByAttribute('label', 'Apply').click();

    // Wait for first metrics call with 5 filters
    cy.wait('@getMetrics');

    ui.drawer.find().should('not.exist');
    verifyBadgeCount('5');
    openFilterDrawer();

    // Delete the filter
    ui.button
      .findByAttribute('data-testid', 'clear-icon')
      .should('be.visible')
      .and('be.enabled')
      .first()
      .as('deleteFirstFilterBtn');

    cy.get('@deleteFirstFilterBtn').click();

    // Delete the filter
    ui.button
      .findByAttribute('data-testid', 'clear-icon')
      .should('be.visible')
      .and('be.enabled')
      .last()
      .as('deleteLastFilterBtn');

    cy.get('@deleteLastFilterBtn').click();

    ui.button.findByAttribute('label', 'Apply').click();

    verifyBadgeCount('3');

    // intercept api call to validate 3 filters applied
    cy.wait('@getMetrics').then((interception) => {
      expect(interception)
        .to.have.property('response')
        .with.property('statusCode', 200);

      // Ensure 3 filters are applied
      expect(interception.request.body.filters).to.have.length(3);

      // Verify first and last filters are removed
      const remainingFilters = filters.slice(1, 4);
      remainingFilters.forEach(({ dimension, value }, index) => {
        const appliedFilter = interception.request.body.filters[index];
        expect(appliedFilter.dimension_label).to.equal(dimension);
        expect(appliedFilter.operator).to.equal('eq');
        expect(appliedFilter.value).to.equal(value);
      });
    });
  });

  it('should discard unsaved filters when drawer is closed or canceled', () => {
    // Create alias for filter button
    ui.button
      .findByAttribute(
        'aria-label',
        `Widget Dimension Filter${dashboard.widgets[0].label}`
      )
      .as('filterBtn');

    openFilterDrawer();

    addFilter({
      index: 0,
      dimension: 'entity_id',
      operator: 'Equal',
      value: '123',
    });

    // Close the drawer without applying
    ui.drawerCloseButton.find().should('be.visible').and('be.enabled').click();

    verifyBadgeCount('0');

    ui.drawer.find().should('not.exist');

    cy.get('@filterBtn').within(() => {
      cy.get('[data-qa-badge="dimension-filter-badge-content"]')
        .should('exist')
        .invoke('text')
        .should('be.empty');
    });

    // Reopen the drawer to verify no filters are present
    cy.get('@filterBtn').should('be.enabled').click();
    ui.drawer.find().should('exist');

    // Verify no filters are present
    cy.get(
      `[data-qa-dimension-filter="dimension_filters.0-dimension-field"]`
    ).should('not.exist');

    addFilter({
      index: 0,
      dimension: 'entity_id',
      operator: 'Equal',
      value: '123',
    });

    // Click on Cancel button to close the drawer
    ui.button.findByAttribute('label', 'Cancel').click();
    verifyBadgeCount('0');
  });

  it('should verify clear all at widget level', () => {
    // Create alias for filter button
    ui.button
      .findByAttribute(
        'aria-label',
        `Widget Dimension Filter${dashboard.widgets[0].label}`
      )
      .as('filterBtn');

    openFilterDrawer();

    // Add 2 filters
    const filters = [
      { dimension: 'entity_id', operator: 'Equal', value: '123' },
      { dimension: 'response_type', operator: 'Equal', value: '2xx' },
    ];

    filters.forEach(({ dimension, operator, value }, index) =>
      addFilter({
        index,
        dimension,
        operator,
        value,
      })
    );

    // Click Clear All button
    cy.get('[data-qa-id="filter-drawer-clear-all"]')
      .should('be.visible')
      .click();

    cy.get('[data-testid="dimension_filters.0-id"]').should('not.exist');

    ui.button.findByAttribute('label', 'Apply').click();

    ui.drawer.find().should('not.exist');

    // Verify badge is empty after clearing all filters
    verifyBadgeCount('0');
  });

  // Verify for all 6 widgets
  it('should verify that filter drawer opens correctly for all widgets and able to add filters', () => {
    dashboard.widgets.forEach((widget, index) => {
      openFilterDrawer(index);
      verifyDrawerContent(index);
      ui.button
        .findByAttribute('label', 'Cancel')
        .should('be.visible')
        .and('be.enabled');

      ui.button
        .findByAttribute('label', 'Apply')
        .should('be.visible')
        .and('not.have.attr', 'aria-disabled', 'true');

      ui.drawerCloseButton.find().should('be.visible').and('be.enabled');
      addFilter({
        index: 0,
        dimension: 'entity_id',
        operator: 'Equal',
        value: '123',
      });

      ui.button
        .findByAttribute('label', 'Apply')
        .should('be.visible')
        .and('not.have.attr', 'aria-disabled', 'true');

      ui.button.findByAttribute('label', 'Apply').click();

      ui.drawer.find().should('not.exist');

      verifyBadgeCount('1', index);
    });
  });

  // Have a global filter for dashboard and now for each widget verify the widget level filters are the ones not in the global filters
  it.only('should verify that widget level filters exclude global dashboard filters for all widgets', () => {
    const globalFilters = ['region', 'volume_id', 'Port', 'Protocol'];

    dashboard.widgets.forEach((widget, index) => {
      openFilterDrawer(index);

      ui.button.findByTitle('Add Filter').click();

      cy.get('[data-testid="dimension_filters.0-id"]').within(() => {
        ui.autocomplete.findByLabel('Dimension').should('be.visible').click();
      });

      // Verify dimension options exclude global filters
      verifyDimensionsExcludeFilters(globalFilters);

      // Close the drawer
      ui.drawerCloseButton.find().should('be.visible').click();
    });
  });

  it('should support different operators and different values (Equal, Not Equal, StartsWith, EndsWith, in)', () => {
    openFilterDrawer();
    const filtersWithOperators = [
      { dimension: 'entity_id', operator: 'Not Equal', value: '345' },
      { dimension: 'response_type', operator: 'Starts with', value: '2x' },
      { dimension: 'response_type', operator: 'Ends with', value: '5xx' },
    ];

    filtersWithOperators.forEach((filter, index) =>
      addFilter({
        index,
        dimension: filter.dimension,
        operator: filter.operator,
        value: filter.value,
      })
    );

    // Add 4th filter with 'Select All ' values
    ui.button.findByTitle('Add Filter').click();
    cy.get('[data-testid="dimension_filters.3-id"]').within(() => {
      ui.autocomplete
        .findByLabel('Dimension')
        .should('be.visible')
        .type('Protocol');
      ui.autocompletePopper
        .findByTitle('Protocol')
        .should('be.visible')
        .click();
      ui.autocomplete.findByLabel('Operator').should('be.visible').type('In');
      ui.autocompletePopper.findByTitle('In').should('be.visible').click();
      // Click on Value field to open values dropdown
      cy.get('[data-qa-dimension-filter="dimension_filters.3-value"]')
        .findByPlaceholderText('Select Values')
        .should('be.visible')
        .click();

      // Select 'Select All' option from the dropdown
      ui.autocompletePopper
        .findByTitle('Select All')
        .should('be.visible')
        .click();
    });

    // Add 5th filter with 'In' operator
    ui.button.findByTitle('Add Filter').click();
    cy.get('[data-testid="dimension_filters.4-id"]').within(() => {
      ui.autocomplete
        .findByLabel('Dimension')
        .should('be.visible')
        .type('Protocol');
      ui.autocompletePopper
        .findByTitle('Protocol')
        .should('be.visible')
        .click();

      ui.autocomplete
        .findByLabel('Operator')
        .should('be.visible')
        .type('Equal');
      ui.autocompletePopper.findByTitle('Equal').should('be.visible').click();

      // Click on Value field to open values dropdown
      cy.get('[data-qa-dimension-filter="dimension_filters.4-value"]')
        .findByPlaceholderText('Select a Value')
        .should('be.visible')
        .click();
    });
    // Select a Value from the dropdown
    ui.autocompletePopper.findByTitle('TCP').should('be.visible').click();
    ui.button.findByAttribute('label', 'Apply').click();

    verifyBadgeCount('5');

    // intercept api call to validate filters applied with correct operators
    cy.wait('@getMetrics').then((interception) => {
      expect(interception)
        .to.have.property('response')
        .with.property('statusCode', 200);

      // Ensure 5 filters are applied
      expect(interception.request.body.filters).to.have.length(5);

      // Verify the operators of filters applied
      filtersWithOperators.forEach((filter, index) => {
        const appliedFilter = interception.request.body.filters[index];
        expect(appliedFilter.dimension_label).to.equal(filter.dimension);
        // Map operator text to expected API operator values
        const operatorMap: { [key: string]: string } = {
          Equal: 'eq',
          'Not Equal': 'neq',
          'Starts with': 'startswith',
          'Ends with': 'endswith',
          In: 'in',
        };
        expect(appliedFilter.operator).to.equal(operatorMap[filter.operator]);
        expect(appliedFilter.value).to.equal(filter.value);
      });
      // Verify the 4th filter with 'Select All' values
      const fourthFilter = interception.request.body.filters[3];
      expect(fourthFilter.dimension_label).to.equal('Protocol');
      expect(fourthFilter.operator).to.equal('in');
      // Assuming 'Select All' translates to an empty string or a specific value in the API
      expect(fourthFilter.value).to.equal('TCP,UDP');
      // Verify the 5th filter with 'In' operator
      const fifthFilter = interception.request.body.filters[4];
      expect(fifthFilter.dimension_label).to.equal('Protocol');
      expect(fifthFilter.operator).to.equal('eq');
      expect(fifthFilter.value).to.equal('TCP');
    });
  });

  it('should allow editing existing filters - add/update values', () => {
    openFilterDrawer();

    // Add initial filter
    addFilter({
      index: 0,
      dimension: 'entity_id',
      operator: 'Equal',
      value: '123',
    });

    // Add initial filter
    addFilter({
      index: 1,
      dimension: 'response_type',
      operator: 'Equal',
      value: '2xx',
    });

    // Add initial filter
    addFilter({
      index: 2,
      dimension: 'entity_id',
      operator: 'Equal',
      value: '456',
    });

    ui.button.findByAttribute('label', 'Apply').click();
    verifyBadgeCount('3');

    // Wait for metrics call
    cy.wait('@getMetrics');

    // Reopen drawer to edit
    openFilterDrawer();

    // Edit the filter - change value
    cy.get('[data-testid="dimension_filters.0-id"]').within(() => {
      cy.get('[data-qa-dimension-filter="dimension_filters.0-value"]')
        .findByPlaceholderText('Enter a Value')
        .should('be.visible')
        .clear();

      cy.get('[data-qa-dimension-filter="dimension_filters.0-value"]')
        .findByPlaceholderText('Enter a Value')
        .type('456');
    });

    // Edit the filter - change operator
    cy.get('[data-testid="dimension_filters.1-id"]').within(() => {
      ui.autocomplete.findByLabel('Operator').should('be.visible').click();

      ui.autocompletePopper
        .findByTitle('Not Equal')
        .should('be.visible')
        .click();

      cy.get('[data-qa-dimension-filter="dimension_filters.1-value"]')
        .findByPlaceholderText('Enter a Value')
        .type('3xx');
    });

    // Edit the filter - change dimension

    cy.get('[data-testid="dimension_filters.2-id"]').within(() => {
      ui.autocomplete.findByLabel('Dimension').should('be.visible').click();
      ui.autocompletePopper
        .findByTitle('response_type')
        .should('be.visible')
        .click();

      ui.autocomplete.findByLabel('Operator').should('be.visible').click();

      ui.autocompletePopper.findByTitle('Equal').should('be.visible').click();

      cy.get('[data-qa-dimension-filter="dimension_filters.2-value"]')
        .findByPlaceholderText('Enter a Value')
        .type('4xx');
    });

    // Add 2 more filters to verify editing works with multiple filters
    addFilter({
      index: 3,
      dimension: 'entity_id',
      operator: 'Equal',
      value: '789',
    });

    addFilter({
      index: 4,
      dimension: 'response_type',
      operator: 'Equal',
      value: '5xx',
    });

    // Verify addfilter button is disabled on adding 5 filters

    ui.button.findByTitle('Add Filter').should('be.visible').and('be.disabled');

    ui.button.findByAttribute('label', 'Apply').click();

    verifyBadgeCount('5');

    // Verify updated filter in API
    cy.wait('@getMetrics').then((interception) => {
      expect(interception)
        .to.have.property('response')
        .with.property('statusCode', 200);

      // Ensure 5 filters are applied
      expect(interception.request.body.filters).to.have.length(5);

      // Verify the updated first filter and other two filters
      const expectedFilters = [
        { dimension: 'entity_id', operator: 'eq', value: '456' },
        { dimension: 'response_type', operator: 'neq', value: '3xx' },
        { dimension: 'response_type', operator: 'eq', value: '4xx' },
        { dimension: 'entity_id', operator: 'eq', value: '789' },
        { dimension: 'response_type', operator: 'eq', value: '5xx' },
      ];

      expectedFilters.forEach(({ dimension, operator, value }, index) => {
        const appliedFilter = interception.request.body.filters[index];
        expect(appliedFilter.dimension_label).to.equal(dimension);
        expect(appliedFilter.operator).to.equal(operator);
        expect(appliedFilter.value).to.equal(value);
      });
    });
  });
});

describe('Widget level dimension filter - edge cases', () => {
  beforeEach(() => {
    /*
        1. Verifies that when the feature flag is disabled, the filter button is not displayed.
        2. Confirms that when metrics have no dimensions, the filter button is shown but disabled.
        3. Validates that predefined filters in the dashboard configuration are correctly displayed in the filter drawer.
        4. Ensures that when a user inputs a Linode label as a filter value, it is correctly converted to the corresponding Linode ID in the API request.
     */
    // Block LaunchDarkly clientstream to prevent feature flags from being overridden
    mockGetAccount(accountFactory.build());
    mockGetCloudPulseMetricDefinitions(serviceType, metricDefinitions);
    mockGetCloudPulseDashboards(serviceType, [dashboard]).as('fetchDashboard');
    mockGetCloudPulseServices([serviceType]).as('fetchServices');
    mockGetCloudPulseDashboard(id, dashboard).as('fetchDashboard');
    mockCreateCloudPulseJWEToken(serviceType);
    mockCreateCloudPulseMetrics(serviceType, metricsAPIResponsePayload).as(
      'getMetrics'
    );
    mockGetRegions(mockRegions);
    mockGetVolumes(mockVolumesEncrypted);
    mockGetUserPreferences({});
  });

  it('should not show filter button when showWidgetDimensionFilters flag is disabled', () => {
    mockGetFeatureFlagClientstream();
    mockAppendFeatureFlags({
      ...flagsFactory.build(),
      aclp: {
        ...flagsFactory.build().aclp,
        showWidgetDimensionFilters: false,
      },
    });

    cy.visitWithLogin('/metrics');
    cy.wait(['@fetchServices', '@fetchDashboard']);

    selectDashboardAndResources();

    ui.button
      .findByAttribute(
        'aria-label',
        `Widget Dimension Filter${dashboard.widgets[0].label}`
      )
      .should('not.exist');
  });

  it('should show filter button as disabled when metrics have no dimensions', () => {
    const metricDefinitionsWithNoDimensions = metrics.map(
      ({ name, title, unit }) =>
        dashboardMetricFactory.build({
          label: title,
          metric: name,
          unit,
          dimensions: [],
        })
    );

    mockGetFeatureFlagClientstream();
    mockAppendFeatureFlags(flagsFactory.build());
    mockGetCloudPulseMetricDefinitions(
      serviceType,
      metricDefinitionsWithNoDimensions
    );

    cy.visitWithLogin('/metrics');
    cy.wait(['@fetchServices', '@fetchDashboard']);

    selectDashboardAndResources();

    dashboard.widgets.forEach((widget) => {
      ui.button
        .findByAttribute('aria-label', `Widget Dimension Filter${widget.label}`)
        .should('be.visible')
        .and('be.disabled');
    });
  });

  it('should display predefined filters correctly in filter drawer', () => {
    const dashboardWithPredefinedFilters = dashboardFactory.build({
      label: dashboardName,
      service_type: serviceType,
      id,
      widgets: metrics.map(({ name, title, unit, yLabel }) =>
        widgetFactory.build({
          label: title,
          metric: name,
          unit,
          y_label: yLabel,
          namespace_id: id,
          service_type: serviceType,
          filters: [
            {
              dimension_label: 'entity_id',
              operator: 'eq',
              value: '123',
            },
          ],
        })
      ),
    });

    mockGetFeatureFlagClientstream();
    mockAppendFeatureFlags(flagsFactory.build());
    mockGetCloudPulseDashboards(serviceType, [
      dashboardWithPredefinedFilters,
    ]).as('fetchDashboard');
    mockGetCloudPulseDashboard(id, dashboardWithPredefinedFilters).as(
      'fetchDashboard'
    );

    cy.visitWithLogin('/metrics');
    cy.wait(['@fetchServices', '@fetchDashboard']);

    selectDashboardAndResources();

    ui.button
      .findByAttribute(
        'aria-label',
        `Widget Dimension Filter${dashboardWithPredefinedFilters.widgets[0].label}`
      )
      .should('be.visible')
      .and('not.be.disabled')
      .click();

    ui.drawer.find().should('exist');

    cy.get('[data-testid="dimension_filters.0-id"]').within(() => {
      ui.autocomplete
        .findByLabel('Dimension')
        .should('be.visible')
        .and('have.value', 'entity_id');
      ui.autocomplete
        .findByLabel('Operator')
        .should('be.visible')
        .and('have.value', 'Equal');
      cy.findByPlaceholderText('Enter a Value')
        .should('be.visible')
        .and('have.value', '123');
    });

    ui.drawerCloseButton.find().should('be.visible').click();
  });

  it('should convert linode label to linode_id when applying dynamic filters', () => {
    const linodes = [
      linodeFactory.build({
        id: 123,
        label: 'Test-linode-1',
        region: 'us-ord',
        tags: ['tag-1'],
      }),
      linodeFactory.build({
        id: 456,
        label: 'Test-linode-2',
        region: 'us-ord',
        tags: ['tag-2'],
      }),
      linodeFactory.build({
        id: 789,
        label: 'Test-linode-3',
        region: 'us-ord',
      }),
    ];

    mockGetFeatureFlagClientstream();
    mockAppendFeatureFlags(flagsFactory.build());
    mockGetLinodes(linodes).as('getLinodes');

    cy.visitWithLogin('/metrics');
    cy.wait(['@fetchServices', '@fetchDashboard']);

    selectDashboardAndResources();

    // Open filter drawer
    ui.button
      .findByAttribute(
        'aria-label',
        `Widget Dimension Filter${dashboard.widgets[0].label}`
      )
      .should('be.visible')
      .click();
    cy.get('[data-testid="drawer"]').should('be.visible');

    ui.button.findByTitle('Add Filter').click();

    cy.get('[data-testid="dimension_filters.0-id"]').within(() => {
      // Select 'linode_id' dimension - this triggers GET /linode/instances call
      ui.autocomplete
        .findByLabel('Dimension')
        .should('be.visible')
        .type('linode_id');
      ui.autocompletePopper
        .findByTitle('linode_id')
        .should('be.visible')
        .click();

      // Select operator
      ui.autocomplete
        .findByLabel('Operator')
        .should('be.visible')
        .type('Equal');
      ui.autocompletePopper.findByTitle('Equal').should('be.visible').click();
    });

    // Wait for linodes to be fetched after dimension selection
    cy.wait('@getLinodes');

    // Click on Value field to open linode dropdown
    cy.get('[data-testid="dimension_filters.0-id"]').within(() => {
      ui.autocomplete.findByLabel('Value').should('be.visible').click();
    });

    // Select a linode label from the dropdown
    ui.autocompletePopper
      .findByTitle('Test-linode-1')
      .should('be.visible')
      .click();

    // Apply the filter
    ui.button.findByAttribute('label', 'Apply').click();

    ui.drawer.find().should('not.exist');

    // Verify badge count
    ui.button
      .findByAttribute(
        'aria-label',
        `Widget Dimension Filter${dashboard.widgets[0].label}`
      )
      .within(() => {
        {
          cy.get('[data-qa-badge="dimension-filter-badge-content"]')
            .should('be.visible')
            .and('contain.text', '1');
        }
      });

    // Verify the API request contains linode_id (converted from label)
    cy.wait('@getMetrics').then((interception) => {
      expect(interception)
        .to.have.property('response')
        .with.property('statusCode', 200);

      // Check if filters exist in the request
      const filters = interception.request.body.filters;

      // Find the linode_id filter
      const linodeFilter = filters.find(
        (filter: Filters) => filter.dimension_label === 'linode_id'
      );

      // Verify the dimension label used (could be 'Linode', 'linode', or 'linode_id')
      expect(linodeFilter.operator).to.equal('eq');
      // Verify the value is the linode ID (123), not the label ('Test-linode-1')
      expect(linodeFilter.value).to.equal('123');
    });
  });
});
