import { styled } from '@mui/material/styles';
import { useLDClient } from 'launchdarkly-react-client-sdk';
import React, { useEffect } from 'react';
import { useHistory } from 'react-router-dom';

import { ActionsPanel } from 'src/components/ActionsPanel/ActionsPanel';
import { Dialog } from 'src/components/Dialog/Dialog';
import { Link } from 'src/components/Link';
import { Tab } from 'src/components/Tabs/Tab';
import { TabList } from 'src/components/Tabs/TabList';
import { TabPanels } from 'src/components/Tabs/TabPanels';
import { Tabs } from 'src/components/Tabs/Tabs';
import { Typography } from 'src/components/Typography';
import { LD_DX_TOOLS_METRICS_KEYS } from 'src/constants';
import { useFlags } from 'src/hooks/useFlags';
import { useIsAkamaiAccount } from 'src/hooks/useIsAkamaiAccount';
import { useInProgressEvents } from 'src/queries/events/events';
import { sendApiAwarenessClickEvent } from 'src/utilities/analytics/customEventAnalytics';

import { CurlTabPanel } from './CurlTabPanel';
import { IntegrationsTabPanel } from './IntegrationsTabPanel';
import { LinodeCLIPanel } from './LinodeCLIPanel';
import { SDKTabPanel } from './SDKTabPanel';

import type { CreateLinodeRequest } from '@linode/api-v4/lib/linodes';

export interface ApiAwarenessModalProps {
  isOpen: boolean;
  onClose: () => void;
  payLoad: CreateLinodeRequest;
}

export const tabs = [
  {
    component: LinodeCLIPanel,
    title: 'Linode CLI',
    type: 'CLI',
  },
  {
    component: CurlTabPanel,
    title: 'cURL',
    type: 'API',
  },
  {
    component: IntegrationsTabPanel,
    title: 'Integrations',
    type: 'INTEGRATIONS',
  },
  {
    component: SDKTabPanel,
    title: 'SDKs',
    type: 'INTEGRATIONS',
  },
];

export const ApiAwarenessModal = (props: ApiAwarenessModalProps) => {
  const { isOpen, onClose, payLoad } = props;

  const flags = useFlags();
  const ldClient = useLDClient();
  const history = useHistory();
  const { data: events } = useInProgressEvents();
  const { isAkamaiAccount: isInternalAccount } = useIsAkamaiAccount();

  const linodeCreationEvent = events?.find(
    (event) =>
      (event.action === 'linode_create' || event.action === 'linode_clone') &&
      event.entity?.label === payLoad.label &&
      (event.status === 'scheduled' || event.status === 'started')
  );

  const isLinodeCreated = linodeCreationEvent !== undefined;

  const apicliButtonCopy = flags?.testdxtoolabexperiment;

  const handleTabChange = (index: number) => {
    const { title, type } = tabs[index];

    sendApiAwarenessClickEvent(`${type} Tab`, type);

    const trackingKey =
      type === 'INTEGRATIONS' && title !== 'SDKs'
        ? LD_DX_TOOLS_METRICS_KEYS.INTEGRATION_TAB_SELECTION
        : type === 'API'
        ? LD_DX_TOOLS_METRICS_KEYS.CURL_TAB_SELECTION
        : title === 'SDKs'
        ? LD_DX_TOOLS_METRICS_KEYS.SDK_TAB_SELECTION
        : title === 'Linode CLI'
        ? LD_DX_TOOLS_METRICS_KEYS.LINODE_CLI_TAB_SELECTION
        : undefined;

    if (trackingKey) {
      if (!isInternalAccount) {
        ldClient?.track(trackingKey, {
          variation: apicliButtonCopy,
        });
      }

      ldClient?.flush();
    }
  };

  useEffect(() => {
    if (isLinodeCreated && isOpen) {
      onClose();
      history.replace(`/linodes/${linodeCreationEvent.entity?.id}`);
    }
  }, [isLinodeCreated]);

  return (
    <Dialog
      sx={{
        overflowX: 'hidden',
        paddingBottom: '0px',
      }}
      fullHeight
      fullWidth
      maxWidth="sm"
      onClose={onClose}
      open={isOpen}
      title="Create Linode"
    >
      <Typography sx={{ paddingBottom: '6px' }} variant="body1">
        Create a Linode in the command line, powered by the{' '}
        <Link
          onClick={() => sendApiAwarenessClickEvent('link', 'Linode API')}
          to="https://techdocs.akamai.com/linode-api/reference/api/"
        >
          Linode API
        </Link>
        . Select one of the methods below and paste the corresponding command
        into your local terminal. The values for each command have been
        populated with the selections made in the Cloud Manager create form.
      </Typography>
      <StyledTabs defaultIndex={0} onChange={handleTabChange}>
        <TabList>
          {tabs.map((tab) => (
            <Tab key={tab.title}>{tab.title}</Tab>
          ))}
        </TabList>
        <TabPanels>
          {tabs.map((tab, index) => (
            <tab.component
              index={index}
              key={index}
              payLoad={payLoad}
              title={tab.title}
            />
          ))}
        </TabPanels>
      </StyledTabs>
      <ActionsPanel
        secondaryButtonProps={{
          compactX: true,
          'data-testid': 'close-button',
          label: 'Close',
          onClick: onClose,
        }}
        sx={{
          display: 'flex',
          marginTop: '18px !important',
          paddingBottom: 0,
          paddingTop: 0,
        }}
      />
    </Dialog>
  );
};

const StyledTabs = styled(Tabs, {
  label: 'StyledTabs',
})(() => ({
  position: 'relative',
}));
