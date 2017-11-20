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

var registerX509Individual = function(Transport, registrationId, deviceCert, callback) {
  var securityClient = new X509Security(deviceCert);
  var transport = new Transport(idScope);
  var provisioningDeviceClient = ProvisioningDeviceClient.create(transport, securityClient);
  provisioningDeviceClient.register(registrationId, false, function(err, result) {
    callback(err, result);
  });
};

var cleanupX509Individual = function(registrationId, deviceId, callback) {
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
      debug('done X509 individual cleanup');
      callback();
    });
  });
};

var createX509GroupCert = function(registrationId, callback) {
  pem.createCSR( { commonName: registrationId }, function (err, csrResult) {
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

var enrollX509Group = function(registrationId, deviceId, x509, callback) {
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

var registerX509Group = function(Transport, registrationId, deviceCert, callback) {
  var securityClient = new X509Security(deviceCert);
  var transport = new Transport(idScope);
  var provisioningDeviceClient = ProvisioningDeviceClient.create(transport, securityClient);
  provisioningDeviceClient.register(registrationId, false, function(err, result) {
    callback(err, result);
  });
};

var cleanupX509Group = function(registrationId, deviceId, callback) {
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
      debug('done X509 individual cleanup');
      callback();
    });
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
  [{
    testDescription: 'X509 Individual enrollment',
    createCert: createX509IndividualDeviceCert,
    enroll: enrollX509Indivitual,
    register: registerX509Individual,
    cleanup: cleanupX509Individual,
    transports: [Http]
  },
  {
    testDescription: 'X509 group enrollment',
    createCert: createX509GroupCert,
    enroll: enrollX509Group,
    register: registerX509Group,
    cleanup: cleanupX509Group,
    transports: [Http]
  }].forEach(function(testConfiguration) {

    describe(testConfiguration.testDescription, function() {
      var deviceId;
      var registrationId;
      this.timeout(30000);

      beforeEach (function() {
        var id = uuid.v4();
        deviceId = 'deleteme_provisioning_node_e2e_' + id;
        registrationId = 'reg-' + id;
      });

      afterEach(function(callback) {
        testConfiguration.cleanup(registrationId, deviceId, callback);
      });

      testConfiguration.transports.forEach(function (Transport) {
        it ('can create an enrollment, register it using ' + Transport.name + ', and verify twin contents', function(callback) {
          var deviceCert;

          async.waterfall([
            function(callback) {
              debug('creating x509 certificate');
              testConfiguration.createCert(registrationId, callback);
            },
            function(cert, callback) {
              deviceCert = cert;
              debug('enrolling');
              testConfiguration.enroll(registrationId, deviceId, deviceCert, callback);
            },
            function(callback) {
              debug('verifying registration status is unassigned');
              assertRegistrationStatus(registrationId, 'unassigned',null, callback);
            },
            function(callback) {
              debug('registering device');
              testConfiguration.register(Transport, registrationId, deviceCert, callback);
            },
            function(result, callback) {
              debug('success registering device');
              debug(JSON.stringify(result,null,'  '));
              debug('verifying registration status is assigned');
              assertRegistrationStatus(registrationId, 'assigned', deviceId, callback);
            },
            function(callback) {
              debug('getting twin');
              registry.getTwin(deviceId,function(err, twin) {
                callback(err, twin);
              });
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
  });
});
