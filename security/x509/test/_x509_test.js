// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

'use strict';

var X509Security = require('../lib/x509').X509Security;
var assert = require('chai').assert;

var fakeCert = "fake certificate"

describe('x509', function () {
  this.timeout(1000);

  var obj = new X509Security(fakeCert);

  describe('getCertificate', function() {
    it ('returns the cert', function(callback) {
        obj.getCertificate(function(err, cert) {
          assert(!err);
          assert.equal(cert, fakeCert);
          callback();
        });
    });
  });

  describe('getCertificateChain', function() {
    it ('throws', function() {
      assert.throws(function() {
        obj.getCertificateChain();
      });
    });
  });

});

