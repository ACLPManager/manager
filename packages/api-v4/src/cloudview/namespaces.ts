import { API_ROOT } from '../constants';
import Request, {
  setMethod,
  setParams,
  setURL,
  setXFilter,
  setData,
} from '../request';
import { Filter, Params, ResourcePage as Page } from '../types';
import { Namespace, CreateNameSpacePayload } from './types';
import { createCloudViewNamespaceSchema } from '@linode/validation';

/**
 * getCloudViewNamespaces
 *
 * Returns a paginated list of CloudView Namespaces on your account.
 *
 */
export const getCloudViewNamespaces = (params?: Params, filter?: Filter) =>
  Request<Page<Namespace>>(
    setURL(`${API_ROOT}/cloudview/namespaces`),
    setMethod('GET'),
    setXFilter(filter),
    setParams(params)
  );

/**
 * createCloudViewNamespace
 *
 * Creates a namespace for your account
 *
 */
export const createCloudViewNamespace = (data: CreateNameSpacePayload) =>
  Request<Namespace>(
    setURL(`${API_ROOT}/cloudview/namespaces`),
    setMethod('POST'),
    setData(data, createCloudViewNamespaceSchema)
  );
