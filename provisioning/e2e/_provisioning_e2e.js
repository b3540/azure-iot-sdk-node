// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

'use strict';

var async = require('async');
var pem = require('pem');
var uuid = require('uuid');
var assert = require('chai').assert;
var debug = require('debug')('azure-device-provisioning-e2e');
var Http = require('azure-iot-provisioning-device-http').Http;
var ProvisioningDeviceClient = require('azure-iot-provisioning-device').ProvisioningDeviceClient;
var ProvisioningServiceClient = require('azure-iot-provisioning-service').ProvisioningServiceClient;
var X509Security = require('azure-iot-security-x509').X509Security;
var Registry = require('azure-iothub').Registry;

var idScope = process.env.IOT_PROVISIONING_DEVICE_IDSCOPE;
var provisioningConnectionString = process.env.IOT_PROVISIONING_SERVICE_CONNECTION_STRING;
var registryConnectionString = process.env.IOTHUB_CONNECTION_STRING;
//var CARootCert = new Buffer(process.env.IOTHUB_CA_ROOT_CERT, 'base64').toString('ascii');
//var CARootCertKey = new Buffer(process.env.IOTHUB_CA_ROOT_CERT_KEY, 'base64').toString('ascii');
var x509provisioningTransports = [ Http ];


var provisioningServiceClient = ProvisioningServiceClient.fromConnectionString(provisioningConnectionString);
var registry = Registry.fromConnectionString(registryConnectionString);


var createX509Certificate = function(certOptions, callback) {
  pem.createCertificate(certOptions, function (err, result) {
    if (err) {
      callback(err);
    } else {
      var x509 = {
        cert: result.certificate,
        key: result.clientKey
      };
      callback(null, x509);
    }
  });
};

/*
var createX509CADeviceCertificate = function(deviceId, callback) {
  pem.createCSR( { commonName: deviceId }, function (err, csrResult) {
    if (err) {
      callback(err);
    } else {
      var certOptions = {
        csr: csrResult.csr,
        clientKey: csrResult.clientKey,
        serviceKey: CARootCertKey,
        serviceCertificate: CARootCert,
        serial: Math.floor(Math.random() * 1000000000),
        days: 1
      };
      createX509Certificate(certOptions, callback);
    }
  });
};
*/

var createX509IndividualDeviceCert = function(registrationId, callback) {
  var certOptions = {
    commonName: registrationId,
    selfSigned: true,
    days: 10
  };
  createX509Certificate(certOptions, callback);
};

var enrollX509Indivitual = function(registrationId, deviceId, x509, callback) {
  var enrollment =  {
    registrationId: registrationId,
    deviceId: deviceId,
    attestation: {
      type: 'x509',
      x509: {
        clientCertificates: {
          primary: {
            certificate: new Buffer(x509.cert).toString('base64')
          }
        }
      }
    },
    initialTwinState: {
      desiredProperties: {
        testProp: registrationId + ' ' + deviceId
      }
    }
  };

  provisioningServiceClient.createOrUpdateIndividualEnrollment(enrollment, function(err) {
    callback(err);
  });
};

var assertRegistrationStatus = function(registrationId, expectedStatus, expectedDeviceId, callback) {
  provisioningServiceClient.getIndividualEnrollment(registrationId, function(err, enrollment) {
    assert(!err);
    assert.strictEqual(enrollment.registrationStatus.status, expectedStatus);
    if (expectedDeviceId) {
      assert.strictEqual(enrollment.registrationStatus.deviceId, expectedDeviceId);
    }
    callback();
  });
};


describe('IoT Provisioning', function() {
  var deviceId;
  var registrationId;
  this.timeout(30000);


  beforeEach (function() {
    var id = uuid.v4();
    deviceId = 'deleteme_provisioning_node_e2e_' + id;
    registrationId = 'reg-' + id;
  });

  afterEach (function(callback) {
    debug('deleting enrollment');
    provisioningServiceClient.deleteIndividualEnrollment(registrationId, function(err) {
      if (err) {
        debug('ignoring deleteIndividualEnrollment error');
      }
      debug('deleting device');
      registry.delete(deviceId, function(err) {
        if (err) {
          debug('ignoring delete error');
        }
        debug('done with per-test cleanup');
        callback();
      });
    });
  });

  x509provisioningTransports.forEach(function (Transport) {
    it ('can create an x509 enrollment, register it using ' + Transport.name + ', and verify twin contents', function(callback) {
      var x509cert;

      async.waterfall([
        function(callback) {
          debug('creating x509 certificate');
          createX509IndividualDeviceCert(registrationId, callback);
        },
        function(cert, callback) {
          debug('enrolling');
          enrollX509Indivitual(registrationId, deviceId, cert, callback);
        },
        function(callback) {
          debug('verifying registration status is unassigned');
          assertRegistrationStatus(registrationId, 'unassigned',null, callback);
        },
        function(callback) {
          debug('registering device');
          var securityClient = new X509Security(x509cert);
          var transport = new Transport(idScope);
          var provisioningDeviceClient = ProvisioningDeviceClient.create(transport, securityClient);
          provisioningDeviceClient.register(registrationId, false, callback);
        },
        function(result, callback) {
          debug('success registering device');
          debug(JSON.stringify(result,null,'  '));
          debug('verifying registration status is assigned');
          assertRegistrationStatus(registrationId, 'assigned', deviceId, callback);
        },
        function(callback) {
          debug('getting twin');
          registry.getTwin(deviceId,callback);
        },
        function(twin, callback) {
          debug('asserting twin contents');
          assert.strictEqual(twin.properties.desired.testProp, registrationId + ' ' + deviceId);
          callback();
        }
      ], callback);
    });
  });
});
