// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

'use strict';
import { RegistrationClient, X509ProvisioningTransport, X509SecurityClient } from './interfaces';
import * as dbg from 'debug';
const debug = dbg('azure-device-provisioning:x509');

/**
 * @private
 */
export class X509Registration implements RegistrationClient {

  private _transport: X509ProvisioningTransport;
  private _securityClient: X509SecurityClient;

  constructor(transport: X509ProvisioningTransport, securityClient: X509SecurityClient) {
    this._transport = transport;
    this._securityClient = securityClient;
  }

  /**
   * Register the device with the provisioning service
   * @param registrationId The registration Id for the device
   * @param forceRegistration Set to true to force re-registration
   * @param callback function called when registration is complete.
   */
  register(registrationId: string, forceRegistration: boolean, callback: (err?: Error, result?: any) => void): void {

    this._securityClient.getCertificate((err, cert)  => {
      if (err) {
        debug('security client returned error on cert acquisition');
        callback(err);
      } else {
        this._transport.registerX509(registrationId, cert, forceRegistration, (err, result) => {
          if (err) {
            debug('_stateMachine.register returned error');
            debug(err.toString);
            callback(err);
          } else {
            callback(null, result);
          }
        });
      }
    });
  }

  cancel(callback: (err?: Error) => void): void {
    this.endSession(callback);
  }

  /**
   * @private
   */
  endSession(callback: (err?: Error) => void): void {
    this._transport.endSession(callback);
  }

}

