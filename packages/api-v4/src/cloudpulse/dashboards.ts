import { ResourcePage } from 'src/types';
import Request, { setHeaders, setMethod, setURL } from '../request';
import { Dashboard } from './types';
// import { BETA_API_ROOT as API_ROOT } from 'src/constants';

const API_ROOT = 'https://blr-lhvm1i.bangalore.corp.akamai.com:9000/v4beta';

// Returns the list of all the dashboards available
export const getDashboards = (serviceType: string) =>
  Request<ResourcePage<Dashboard>>(
    setURL(
      `${API_ROOT}/monitor/services/${encodeURIComponent(
        serviceType
      )}/dashboards`
    ),
    setMethod('GET'),
    setHeaders({
      Authorization: 'Bearer vagrant'
    })
  );

export const getDashboardById = (dashboardId: number) =>
  Request<Dashboard>(
    setURL(`${API_ROOT}/monitor/dashboards/${encodeURIComponent(dashboardId)}`),
    setMethod('GET'),
    setHeaders({
      Authorization: 'Bearer vagrant'
    })
  );
