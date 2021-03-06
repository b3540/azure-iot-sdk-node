// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

'use strict';

// tslint:disable-next-line:no-var-requires
const packageJson = require('../package.json');

export class ProvisioningDeviceConstants {
  /**
   * User-Agent string passed to the service as part of communication
   */
  static userAgent: string = packageJson.name + '/' + packageJson.version;

  /**
   * Default interval for polling, to use in case service doesn't provide it to us.
   */
  static defaultPollingInterval: number = 2000;

  /**
   * Default host for the provisioning service
   */
  static defaultProvisioningHost: string = 'global.azure-devices-provisioning.net';

  /**
   * apiVersion to use while communicating with service.
   */
  static apiVersion: string = '2017-08-31-preview';

  /**
   * default timeout to use when communicating with the service
   */
  static defaultTimeoutInterval: number = 4000;




}
