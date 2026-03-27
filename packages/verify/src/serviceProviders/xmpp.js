/*
Copyright 2021 Yarmo Mackenbach

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
 * XMPP service provider ({@link https://docs.keyoxide.org/service-providers/xmpp/|Keyoxide docs})
 * @module serviceProviders/xmpp
 * @example
 * import { ServiceProviderDefinitions } from 'doipjs';
 * const sp = ServiceProviderDefinitions.data.xmpp.processURI('xmpp:alice@domain.example');
 */

import * as E from '../enums.js'
import { ServiceProvider } from '../serviceProvider.js'

export const reURI = /^xmpp:([a-zA-Z0-9.\-_]*)@([a-zA-Z0-9.\-_]*)(?:\?(.*))?/

/**
 * @function
 * @param {string} uri - Claim URI to process
 * @returns {ServiceProvider} The service provider information based on the claim URI
 */
export function processURI (uri) {
  const match = uri.match(reURI)

  return new ServiceProvider({
    about: {
      id: 'xmpp',
      name: 'XMPP',
      homepage: 'https://xmpp.org'
    },
    profile: {
      display: `${match[1]}@${match[2]}`,
      uri,
      qr: uri
    },
    claim: {
      uriRegularExpression: reURI.toString(),
      uriIsAmbiguous: false
    },
    proof: {
      request: {
        uri: null,
        fetcher: E.Fetcher.XMPP,
        accessRestriction: E.ProofAccessRestriction.SERVER,
        data: {
          id: `${match[1]}@${match[2]}`
        }
      },
      response: {
        format: E.ProofFormat.JSON
      },
      target: [{
        format: E.ClaimFormat.URI,
        encoding: E.EntityEncodingFormat.PLAIN,
        relation: E.ClaimRelation.CONTAINS,
        path: []
      }]
    }
  })
}

export const tests = [
  {
    uri: 'xmpp:alice@domain.org',
    shouldMatch: true
  },
  {
    uri: 'xmpp:alice@domain.org?omemo-sid-123456789=A1B2C3D4E5F6G7H8I9',
    shouldMatch: true
  },
  {
    uri: 'https://domain.org',
    shouldMatch: false
  }
]
