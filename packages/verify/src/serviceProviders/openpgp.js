/*
Copyright 2024 Yarmo Mackenbach

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
/**
 * OpenPGP service provider ({@link https://docs.keyoxide.org/service-providers/openpgp/|Keyoxide docs})
 * @module serviceProviders/openpgp
 * @example
 * import { ServiceProviderDefinitions } from 'doipjs';
 * const sp = ServiceProviderDefinitions.data.openpgp.processURI('openpgp4fpr:ABC123DEF456');
 */

import * as E from '../enums.js'
import { ServiceProvider } from '../serviceProvider.js'

export const reURI = /^(.*)/

const reURIHkp = /^openpgp4fpr:(?:0x)?([a-zA-Z0-9.\-_]*)/
const reURIWkdDirect = /^https:\/\/(.*)\/.well-known\/openpgpkey\/hu\/([a-zA-Z0-9]*)(?:\?l=(.*))?/
const reURIWkdAdvanced = /^https:\/\/(openpgpkey.*)\/.well-known\/openpgpkey\/(.*)\/hu\/([a-zA-Z0-9]*)(?:\?l=(.*))?/

/**
 * @function
 * @param {string} uri - Claim URI to process
 * @returns {ServiceProvider} The service provider information based on the claim URI
 */
export function processURI (uri) {
  let reURI = null
  let mode = null
  let match = null

  if (reURIHkp.test(uri)) {
    reURI = reURIHkp
    mode = E.OpenPgpQueryProtocol.HKP
    match = uri.match(reURI)
  }
  if (!mode && reURIWkdAdvanced.test(uri)) {
    reURI = reURIWkdAdvanced
    mode = E.OpenPgpQueryProtocol.WKD
    match = uri.match(reURI)
  }
  if (!mode && reURIWkdDirect.test(uri)) {
    reURI = reURIWkdDirect
    mode = E.OpenPgpQueryProtocol.WKD
    match = uri.match(reURI)
  }

  let output = null

  switch (mode) {
    case E.OpenPgpQueryProtocol.HKP:
      output = new ServiceProvider({
        about: {
          id: 'openpgp',
          name: 'OpenPGP'
        },
        profile: {
          display: `openpgp4fpr:${match[1]}`,
          uri: `https://keys.openpgp.org/search?q=${match[1]}`,
          qr: null
        },
        claim: {
          uriRegularExpression: reURI.toString(),
          uriIsAmbiguous: false
        },
        proof: {
          request: {
            uri: `https://keys.openpgp.org/vks/v1/by-fingerprint/${match[1].toUpperCase()}`,
            fetcher: E.Fetcher.OPENPGP,
            accessRestriction: E.ProofAccessRestriction.NONE,
            data: {
              url: `https://keys.openpgp.org/vks/v1/by-fingerprint/${match[1].toUpperCase()}`,
              protocol: E.OpenPgpQueryProtocol.HKP
            }
          },
          response: {
            format: E.ProofFormat.JSON
          },
          target: [{
            format: E.ClaimFormat.URI,
            encoding: E.EntityEncodingFormat.PLAIN,
            relation: E.ClaimRelation.EQUALS,
            path: ['notations', 'proof@ariadne.id']
          }]
        }
      })
      break
    case E.OpenPgpQueryProtocol.WKD:
      output = new ServiceProvider({
        about: {
          id: 'openpgp',
          name: 'OpenPGP'
        },
        profile: {
          display: 'unknown fingerprint',
          uri,
          qr: null
        },
        claim: {
          uriRegularExpression: reURI.toString(),
          uriIsAmbiguous: false
        },
        proof: {
          request: {
            uri,
            fetcher: E.Fetcher.OPENPGP,
            accessRestriction: E.ProofAccessRestriction.NONE,
            data: {
              url: uri,
              protocol: E.OpenPgpQueryProtocol.WKD
            }
          },
          response: {
            format: E.ProofFormat.JSON
          },
          target: [{
            format: E.ClaimFormat.URI,
            encoding: E.EntityEncodingFormat.PLAIN,
            relation: E.ClaimRelation.EQUALS,
            path: ['notations', 'proof@ariadne.id']
          }]
        }
      })
      break
  }

  return output
}

export const tests = [
  {
    uri: 'openpgp4fpr:123456789',
    shouldMatch: true
  },
  {
    uri: 'openpgp4fpr:abcdef123',
    shouldMatch: true
  },
  {
    uri: 'https://openpgpkey.domain.tld/.well-known/openpgpkey/domain.tld/hu/123abc456def?l=name',
    shouldMatch: true
  },
  {
    uri: 'https://openpgpkey.domain.tld/.well-known/openpgpkey/domain.tld/hu/123abc456def',
    shouldMatch: true
  },
  {
    uri: 'https://domain.tld/.well-known/openpgpkey/hu/123abc456def?l=name',
    shouldMatch: true
  },
  {
    uri: 'https://domain.tld/.well-known/openpgpkey/hu/123abc456def',
    shouldMatch: true
  },
  // The following will not pass .processURI, but reURI currently accepts anything
  {
    uri: 'https://domain.tld',
    shouldMatch: true
  },
  {
    uri: 'https://openpgpkey.domain.tld/.well-known/openpgpkey/hu/123abc456def?l=name',
    shouldMatch: true
  },
  {
    uri: 'https://domain.tld/.well-known/openpgpkey/123abc456def?l=name',
    shouldMatch: true
  }
]
