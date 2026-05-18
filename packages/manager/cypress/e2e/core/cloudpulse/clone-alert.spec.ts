/**
 * @file Integration Tests for CloudPulse Alert Clone functionality.
 */
import { profileFactory, regionFactory } from '@linode/utilities';
import { statusMap } from 'support/constants/alert';
import { mockGetAccount } from 'support/intercepts/account';
import {
  mockCloneAlert,
  mockGetAlertDefinitions,
  mockGetAllAlertDefinitions,
  mockGetCloudPulseServices,
  mockGetEntitiesByAlertId,
} from 'support/intercepts/cloudpulse';
import { mockGetDatabases } from 'support/intercepts/databases';
import { mockAppendFeatureFlags } from 'support/intercepts/feature-flags';
import { mockGetProfile } from 'support/intercepts/profile';
import { mockGetRegions } from 'support/intercepts/regions';
import { ui } from 'support/ui';

import {
  accountFactory,
  alertFactory,
  databaseFactory,
  entitiesFactory,
  flagsFactory,
} from 'src/factories';
import { formatDate } from 'src/utilities/formatDate';

import type {
  AlertStatusType,
  CloudPulseServiceType,
  Database,
} from '@linode/api-v4';

const alertDefinitionsUrl = '/alerts/definitions';

const mockProfile = profileFactory.build({ timezone: 'gmt' });
const mockAccount = accountFactory.build();

interface AlertMenuItem {
  enabled: boolean;
  serviceType: CloudPulseServiceType;
  type: 'system' | 'user';
}

const mockRegions = [
  regionFactory.build({
    capabilities: ['Managed Databases'],
    id: 'us-ord',
    label: 'Chicago, IL',
    monitors: { alerts: ['Managed Databases'], metrics: [] },
  }),
  regionFactory.build({
    capabilities: ['Managed Databases'],
    id: 'us-east',
    label: 'New York, NY',
    monitors: { alerts: ['Managed Databases'], metrics: [] },
  }),
];

const databases: Database[] = databaseFactory.buildList(5).map((db, index) => ({
  ...db,
  engine: 'mysql',
  region: mockRegions[index % mockRegions.length].id,
  status: 'active',
  type: 'MySQL',
}));

// Only statuses where Clone is enabled get a navigation test
const alertMenuItems: Record<AlertStatusType, AlertMenuItem[]> = {
  enabled: [
    { enabled: true, serviceType: 'dbaas', type: 'user' },
    { enabled: true, serviceType: 'dbaas', type: 'system' },
  ],
  disabled: [{ enabled: true, serviceType: 'dbaas', type: 'user' }],
  disabling: [{ enabled: false, serviceType: 'dbaas', type: 'user' }],
  enabling: [{ enabled: false, serviceType: 'dbaas', type: 'user' }],
  failed: [{ enabled: false, serviceType: 'dbaas', type: 'user' }],
  provisioning: [{ enabled: false, serviceType: 'dbaas', type: 'user' }],
};

const metricLabelMap: Record<string, string> = {
  cpu_usage: 'CPU Usage',
  memory_usage: 'Memory Usage',
};

const aggregationLabelMap: Record<string, string> = {
  avg: 'Avg',
  sum: 'Sum',
  max: 'Max',
  min: 'Min',
};

const thresholdOperatorLabelMap: Record<string, string> = {
  gt: '>',
  gte: '>=',
  lte: '<=',
  lt: '<',
  eq: '=',
};

const dimensionOperatorLabelMap: Record<string, string> = {
  in: 'In',
  eq: 'Equal',
  neq: 'Not Equal',
  endswith: 'Ends with',
  startswith: 'Starts with',
  contains: 'Contains',
};

const buildMockAlert = (
  label: string,
  serviceType: CloudPulseServiceType,
  status: AlertStatusType,
  type: 'system' | 'user'
) =>
  alertFactory.build({
    label,
    service_type: serviceType,
    status,
    type,
    created_by: 'user1',
    updated_by: 'user1',
    description: 'Test description',
    scope: 'entity',
    severity: 0,
    rule_criteria: {
      rules: [
        {
          threshold: 100,
          aggregate_function: 'avg',
          metric: 'cpu_usage',
          operator: 'gt',
          dimension_filters: [
            {
              dimension_label: 'node_type',
              operator: 'in',
              value: 'primary,secondary',
            },
            { dimension_label: 'node_type', operator: 'eq', value: 'primary' },
            { dimension_label: 'node_type', operator: 'neq', value: 'primary' },
            {
              dimension_label: 'node_type',
              operator: 'endswith',
              value: 'Primary',
            },
          ],
        },
        {
          threshold: 10000,
          aggregate_function: 'sum',
          metric: 'memory_usage',
          operator: 'gte',
          dimension_filters: [
            {
              dimension_label: 'node_type',
              operator: 'endswith',
              value: '1000',
            },
          ],
        },
        {
          threshold: 10000,
          aggregate_function: 'max',
          metric: 'memory_usage',
          operator: 'lte',
          dimension_filters: [],
        },
        {
          threshold: 100000,
          aggregate_function: 'min',
          metric: 'memory_usage',
          operator: 'gt',
          dimension_filters: [],
        },
      ],
    },
    trigger_conditions: {
      criteria_condition: 'ALL',
      polling_interval_seconds: 300,
      evaluation_period_seconds: 300,
      trigger_occurrences: 10000,
    },
  });

describe('Integration Tests for CloudPulse Alert Clone', () => {
  beforeEach(() => {
    mockAppendFeatureFlags(flagsFactory.build());
    mockGetAccount(mockAccount);
    mockGetProfile(mockProfile);
    mockGetRegions(mockRegions);
    mockGetDatabases(databases);
  });

  (
    Object.entries(alertMenuItems) as [AlertStatusType, AlertMenuItem[]][]
  ).forEach(([status, items]) => {
    items.forEach(({ enabled, serviceType, type }) => {
      const label = `Alert-${status}`;
      const mockAlert = buildMockAlert(label, serviceType, status, type);

      it(`should show ${enabled ? 'enabled' : 'greyed out'} Clone option for ${type} alert with status: ${status}`, () => {
        mockGetAllAlertDefinitions([mockAlert]).as(`getAlerts-${status}`);
        mockGetCloudPulseServices([serviceType]);

        cy.visitWithLogin(alertDefinitionsUrl);
        cy.wait(`@getAlerts-${status}`);

        cy.findByText(label)
          .should('be.visible')
          .closest('tr')
          .within(() => {
            ui.actionMenu
              .findByTitle(`Action menu for Alert ${label}`)
              .should('be.visible')
              .click();
          });

        cy.get('[data-qa-action-menu-item="Clone"]')
          .should('exist')
          .and('be.visible')
          .and(
            enabled ? 'not.have.attr' : 'have.attr',
            'aria-disabled',
            'true'
          );
      });
    });
  });

  // ─── Test 2: Clone navigation + pre-fill validation (enabled & disabled only) ─

  (['enabled', 'disabled'] as AlertStatusType[]).forEach((status) => {
    const { serviceType, type } = alertMenuItems[status][0];
    const label = `Alert-${status}`;
    const mockAlert = buildMockAlert(label, serviceType, status, type);
    const alertEntities = entitiesFactory
      .buildList(5)
      .map((e) => ({ ...e, id: '2' }));
    const cloneLabel = `${label}_Clone 1`;
    const mockClonedAlert = alertFactory.build({
      ...mockAlert,
      label: cloneLabel,
      status: 'enabling',
    });

    it(`should navigate to clone page and validate pre-filled details for status: ${status}`, () => {
      mockGetAllAlertDefinitions([mockAlert]).as(`getAlerts-${status}`);
      mockGetCloudPulseServices([serviceType]);
      mockGetAlertDefinitions(serviceType, mockAlert.id, mockAlert).as(
        'getAlertDefinitions'
      );
      mockGetEntitiesByAlertId(serviceType, mockAlert.id, alertEntities);
      mockCloneAlert(serviceType, mockClonedAlert).as('cloneAlert');

      cy.visitWithLogin(alertDefinitionsUrl);
      cy.wait(`@getAlerts-${status}`);

      cy.findByText(label)
        .should('be.visible')
        .closest('tr')
        .within(() => {
          ui.actionMenu
            .findByTitle(`Action menu for Alert ${label}`)
            .should('be.visible')
            .click();
        });

      cy.get('[data-qa-action-menu-item="Clone"]')
        .should('exist')
        .and('be.visible')
        .and('not.have.attr', 'aria-disabled', 'true')
        .click();

      cy.url().should(
        'include',
        `/alerts/definitions/clone/${serviceType}/${mockAlert.id}`
      );
      cy.wait('@getAlertDefinitions');

      // Section 1: General Information
      cy.findByPlaceholderText('Enter a Name').should('have.value', cloneLabel);
      cy.findByPlaceholderText('Enter a Description').should(
        'have.value',
        mockAlert.description
      );
      cy.findByPlaceholderText('Select a Service')
        .should('be.disabled')
        .and('have.value', 'Databases');
      cy.findByPlaceholderText('Select a scope')
        .should('be.disabled')
        .and('have.value', 'Entity');

      // Section 2: Criteria - Rules
      mockAlert.rule_criteria.rules.forEach((rule, ruleIndex) => {
        const ruleSelector = (field: string) =>
          `[data-qa-metric-threshold="rule_criteria.rules.${ruleIndex}-${field}"] input`;

        cy.get(ruleSelector('data-field')).should(
          'have.value',
          metricLabelMap[rule.metric]
        );
        cy.get(ruleSelector('aggregation-type')).should(
          'have.value',
          aggregationLabelMap[rule.aggregate_function]
        );
        cy.get(ruleSelector('operator')).should(
          'have.value',
          thresholdOperatorLabelMap[rule.operator]
        );
        cy.get(ruleSelector('threshold')).should(
          'have.value',
          String(rule.threshold)
        );

        (rule.dimension_filters ?? []).forEach((filter, filterIndex) => {
          const dimSelector = (field: string) =>
            `[data-qa-dimension-filter="rule_criteria.rules.${ruleIndex}.dimension_filters.${filterIndex}-${field}"] input`;

          cy.get(dimSelector('operator')).should(
            'have.value',
            dimensionOperatorLabelMap[filter.operator]
          );

          if (filter.operator === 'in') {
            const values = filter.value.split(',');
            const chipSelector = `[data-qa-dimension-filter="rule_criteria.rules.${ruleIndex}.dimension_filters.${filterIndex}-value"]`;

            cy.get(chipSelector)
              .find('.MuiChip-label')
              .first()
              .invoke('text')
              .then((text) => {
                expect(values.map((v) => v.toLowerCase().trim())).to.include(
                  text.toLowerCase().trim()
                );
              });

            if (values.length > 1) {
              cy.get(chipSelector)
                .find('span')
                .contains(`+${values.length - 1}`)
                .should('exist');
            }
          }
        });
      });

      // Section 3: Trigger Conditions
      cy.get('[data-testid="evaluation-period"] input').should(
        'have.value',
        `${mockAlert.trigger_conditions.evaluation_period_seconds / 60} min`
      );
      cy.get('[data-testid="polling-interval"] input').should(
        'have.value',
        `${mockAlert.trigger_conditions.polling_interval_seconds / 60} min`
      );
      cy.get('[data-testid="trigger-occurences"] input').should(
        'have.value',
        String(mockAlert.trigger_conditions.trigger_occurrences)
      );

      // Section 4: Entity selection
      cy.get('[data-testid="select_item_1"]').should(
        'have.attr',
        'data-qa-checked',
        'false'
      );
      cy.get('[data-testid="select_item_2"]').should(
        'have.attr',
        'data-qa-checked',
        'true'
      );

      cy.get('[data-qa-alert-row="3"]')
        .find('[data-testid="select_item_3"]')
        .should('have.attr', 'data-qa-checked', 'false')
        .click();
      cy.get('[data-testid="select_item_3"]').should(
        'have.attr',
        'data-qa-checked',
        'true'
      );

      cy.findByText('2 of 5 entities are selected.').should('be.visible');
      cy.findByRole('button', { name: 'Submit' }).click();
      ui.toast.assertMessage('Alert definition was successfully cloned.');

      // Section 5: Verify cloned alert in list
      cy.findByPlaceholderText('Search for Alerts')
        .should('be.visible')
        .and('not.be.disabled')
        .type(mockClonedAlert.label);

      cy.findByText(mockClonedAlert.label)
        .closest('tr')
        .within(() => {
          cy.findByText(mockClonedAlert.label).should('be.visible');
          cy.findByText('Enabling').should('be.visible');
          cy.findByText(statusMap[mockClonedAlert.status]).should('be.visible');
          cy.findByText(
            formatDate(mockClonedAlert.updated, {
              format: 'MMM dd, yyyy, h:mm a',
              timezone: 'GMT',
            })
          ).should('be.visible');
        });

      // Section 6: Validate clone request payload
      cy.wait('@cloneAlert').then(({ request: { body } }) => {
        expect(body.label).to.eq(cloneLabel);
        expect(body.description).to.eq(mockAlert.description);
        expect(body.scope).to.eq(mockAlert.scope);
        expect(body.severity).to.eq(mockAlert.severity);
        expect(body.rule_criteria).to.deep.eq(mockAlert.rule_criteria);
        expect(body.trigger_conditions).to.deep.eq(
          mockAlert.trigger_conditions
        );
        expect(body.entity_ids).to.include.members(['2', '3']);
        expect(body.regions).to.deep.eq(mockAlert.regions);
      });
    });
  });
});
