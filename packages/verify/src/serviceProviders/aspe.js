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
 * ASPE service provider ({@link https://docs.keyoxide.org/service-providers/aspe/|Keyoxide docs})
 * @module serviceProviders/aspe
 * @example
 * import { ServiceProviderDefinitions } from 'doipjs';
 * const sp = ServiceProviderDefinitions.data.activitypub.processURI('aspe:domain.example:abc123def456');
 */

import isFQDN from 'validator/lib/isFQDN.js'
import * as E from '../enums.js'
import { ServiceProvider } from '../serviceProvider.js'

export const reURI = /^aspe:([a-zA-Z0-9.\-_]*):([a-zA-Z0-9]*)/

/**
 * @function
 * @param {string} uri - Claim URI to process
 * @returns {ServiceProvider} The service provider information based on the claim URI
 */
export function processURI (uri) {
  const match = uri.match(reURI)

  if (!isFQDN(match[1])) {
    return null
  }

  return new ServiceProvider({
    about: {
      id: 'aspe',
      name: 'ASPE'
    },
    profile: {
      display: uri,
      uri,
      qr: null
    },
    claim: {
      uriRegularExpression: reURI.toString(),
      uriIsAmbiguous: false
    },
    proof: {
      request: {
        uri: null,
        fetcher: E.Fetcher.ASPE,
        accessRestriction: E.ProofAccessRestriction.NONE,
        data: {
          aspeUri: uri
        }
      },
      response: {
        format: E.ProofFormat.JSON
      },
      target: [{
        format: E.ClaimFormat.URI,
        encoding: E.EntityEncodingFormat.PLAIN,
        relation: E.ClaimRelation.CONTAINS,
        path: ['claims']
      }]
    }
  })
}

export const tests = [
  {
    uri: 'aspe:domain.tld:abc123def456',
    shouldMatch: true
  },
  {
    uri: 'aspe:domain.tld',
    shouldMatch: false
  },
  {
    uri: 'dns:domain.tld',
    shouldMatch: false
  },
  {
    uri: 'https://domain.tld',
    shouldMatch: false
  }
]
