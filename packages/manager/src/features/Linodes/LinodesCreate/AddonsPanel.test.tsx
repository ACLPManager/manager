import React from 'react';

import { imageFactory, linodeTypeFactory } from 'src/factories';
import { HttpResponse, http, server } from 'src/mocks/testServer';
import { getMonthlyBackupsPrice } from 'src/utilities/pricing/backups';
import { renderWithTheme, wrapWithTheme } from 'src/utilities/testHelpers';

import { AddonsPanel } from './AddonsPanel';

import type { AddonsPanelProps } from './AddonsPanel';

const type = linodeTypeFactory.build({
  addons: {
    backups: {
      price: {
        hourly: 0.004,
        monthly: 2.5,
      },
      region_prices: [
        {
          hourly: 0.0048,
          id: 'id-cgk',
          monthly: 3.57,
        },
      ],
    },
  },
});

const props: AddonsPanelProps = {
  accountBackups: true,
  backups: false,
  changeBackups: vi.fn(),
  createType: 'fromLinode',
  disabled: false,
  diskEncryptionEnabled: false,
  handleVLANChange: vi.fn(),
  ipamAddress: 'ipadAddress',
  ipamError: 'test ipad error',
  isPrivateIPChecked: false,
  labelError: 'testError',
  linodesData: [
    {
      alerts: {
        cpu: 90,
        io: 10000,
        network_in: 10,
        network_out: 10,
        transfer_quota: 80,
      },
      backups: {
        enabled: true,
        last_successful: '2023-04-20T08:28:33',
        schedule: {
          day: 'Scheduling',
          window: 'Scheduling',
        },
      },
      created: '2023-03-18T04:41:27',
      group: '',
      hypervisor: 'kvm',
      id: 44071363,
      image: 'linode/ubuntu18.04',
      ipv4: ['45.56.75.98'],
      ipv6: '2600:3c00::f03c:93ff:fe85:576d/128',
      label: 'test_instance',
      lke_cluster_id: null,
      placement_group: {
        id: 1,
        label: 'test',
        placement_group_policy: 'strict',
        placement_group_type: 'anti_affinity:local',
      },
      region: 'us-central',
      site_type: 'core',
      specs: {
        disk: 51200,
        gpus: 0,
        memory: 2048,
        transfer: 2000,
        vcpus: 1,
      },
      status: 'running',
      tags: [],
      type: 'g6-standard-1',
      updated: '2023-03-18T04:45:17',
      watchdog_enabled: true,
    },
    {
      alerts: {
        cpu: 90,
        io: 10000,
        network_in: 10,
        network_out: 10,
        transfer_quota: 80,
      },
      backups: {
        enabled: true,

        last_successful: null,
        schedule: {
          day: 'Scheduling',
          window: 'Scheduling',
        },
      },
      created: '2023-04-20T16:10:32',
      group: '',
      hypervisor: 'kvm',
      id: 45329311,
      image: 'linode/ubuntu24.04',
      ipv4: ['192.168.139.183', '139.144.17.202'],
      ipv6: '2600:3c04::f03c:93ff:fe75:0612/128',
      label: 'debian-ca-central',
      lke_cluster_id: null,
      placement_group: {
        id: 1,
        label: 'test',
        placement_group_policy: 'strict',
        placement_group_type: 'anti_affinity:local',
      },
      region: 'ca-central',
      site_type: 'core',
      specs: {
        disk: 25600,
        gpus: 0,
        memory: 1024,
        transfer: 1000,
        vcpus: 1,
      },
      status: 'running',
      tags: [],
      type: 'g6-nanode-1',
      updated: '2023-04-20T16:11:06',
      watchdog_enabled: true,
    },
    {
      alerts: {
        cpu: 90,
        io: 10000,
        network_in: 10,
        network_out: 10,
        transfer_quota: 80,
      },
      backups: {
        enabled: true,
        last_successful: null,
        schedule: {
          day: 'Scheduling',
          window: 'Scheduling',
        },
      },
      created: '2023-04-20T17:35:32',
      group: '',
      hypervisor: 'kvm',
      id: 45332614,
      image: 'linode/almalinux8',
      ipv4: ['45.79.74.95'],
      ipv6: '2600:3c01::f03c:93ff:fe75:e4f9/128',
      label: 'almalinux-us-west',
      lke_cluster_id: null,
      placement_group: {
        id: 1,
        label: 'test',
        placement_group_policy: 'strict',
        placement_group_type: 'anti_affinity:local',
      },
      region: 'us-west',
      site_type: 'core',
      specs: {
        disk: 25600,
        gpus: 0,
        memory: 1024,
        transfer: 1000,
        vcpus: 1,
      },
      status: 'running',
      tags: [],
      type: 'g6-nanode-1',
      updated: '2023-04-20T17:40:33',
      watchdog_enabled: true,
    },
  ],
  selectedImageID: '1234',
  selectedLinodeID: 45329311,
  selectedRegionID: '1234',
  selectedTypeID: '12345',
  togglePrivateIP: vi.fn(),
  userData: {
    createType: 'fromLinode',
    onChange: vi.fn(),
    showUserData: false,
    userData: '1234',
  },
  vlanLabel: 'abc',
};

describe('AddonsPanel', () => {
  beforeEach(() => {
    server.use(
      http.get('*/images/*', () => {
        return HttpResponse.json(imageFactory.build());
      })
    );
  });

  it('should render AddonsPanel', () => {
    renderWithTheme(<AddonsPanel {...props} />);
  });

  it('should render UserDataAccordion if showUserData is true and hide it if false', () => {
    const userDataProps = {
      userData: { ...props.userData, showUserData: true },
    };
    const { getByText, queryByText, rerender } = renderWithTheme(
      <AddonsPanel {...props} {...userDataProps} />
    );
    getByText('Add User Data');
    userDataProps.userData.showUserData = false;
    rerender(wrapWithTheme(<AddonsPanel {...props} {...userDataProps} />));
    expect(queryByText('Add User Data')).not.toBeInTheDocument();
  });

  it('Should trigger changePrivateIP if source linode has been allocated a private IP', () => {
    renderWithTheme(<AddonsPanel {...props} />);

    expect(props.togglePrivateIP).toBeCalled();
  });

  it('Should select Private IP checkbox if source linode has been allocated a private IP', () => {
    const addOnProps = { ...props, isPrivateIPChecked: true };
    const { getByTestId } = renderWithTheme(<AddonsPanel {...addOnProps} />);
    const PrivateIpAddress = getByTestId('private_ip');
    expect(
      (PrivateIpAddress?.firstElementChild as HTMLInputElement)?.checked
    ).toBe(true);
  });

  it('Should display base backups price when Backups checkbox is checked', () => {
    const backupsMonthlyPrice = getMonthlyBackupsPrice({
      region: 'us-east',
      type,
    });
    const addOnProps = {
      ...props,
      backups: true,
      backupsMonthlyPrice,
    };

    const { getByTestId, getByText } = renderWithTheme(
      <AddonsPanel {...addOnProps} />
    );

    const backupsCheckbox = getByTestId('backups');
    backupsCheckbox.click();

    expect(getByText(/\$2.50/)).toBeInTheDocument();
  });

  it('Should display DC-specific backups price for region with special pricing when Backups checkbox is checked', () => {
    const backupsMonthlyPrice = getMonthlyBackupsPrice({
      region: 'id-cgk',
      type,
    });
    const addOnProps = {
      ...props,
      backups: true,
      backupsMonthlyPrice,
    };

    const { getByTestId, getByText } = renderWithTheme(
      <AddonsPanel {...addOnProps} />
    );

    const backupsCheckbox = getByTestId('backups');
    backupsCheckbox.click();

    expect(getByText(/\$3.57/)).toBeInTheDocument();
  });

  it('should render a warning notice if isDistributedRegionSelected is true and disable backups and private ip checkbox', () => {
    const propsWithDistributedRegionSelected = {
      ...props,
      isDistributedRegionSelected: true,
    };
    const { getByTestId } = renderWithTheme(
      <AddonsPanel {...propsWithDistributedRegionSelected} />
    );
    expect(getByTestId('notice-warning')).toBeInTheDocument();
    expect(getByTestId('private_ip')).toHaveAttribute('aria-disabled', 'true');
    expect(getByTestId('backups')).toHaveAttribute('aria-disabled', 'true');
  });
  it('should not render a warning notice if isDistributedRegionSelected is false', () => {
    const propsWithDistributedRegionNotSelected = {
      ...props,
      isDistributedRegionSelected: false,
    };
    const { queryByTestId } = renderWithTheme(
      <AddonsPanel {...propsWithDistributedRegionNotSelected} />
    );
    expect(queryByTestId('notice-warning')).not.toBeInTheDocument();
  });
});
