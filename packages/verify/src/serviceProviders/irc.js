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
 * IRC service provider ({@link https://docs.keyoxide.org/service-providers/irc/|Keyoxide docs})
 * @module serviceProviders/irc
 * @example
 * import { ServiceProviderDefinitions } from 'doipjs';
 * const sp = ServiceProviderDefinitions.data.irc.processURI('irc://domain.example/alice');
 */

import * as E from '../enums.js'
import { ServiceProvider } from '../serviceProvider.js'

export const reURI = /^irc:\/\/(.*)\/([a-zA-Z0-9\-[\]\\`_^{|}]*)/

/**
 * @function
 * @param {string} uri - Claim URI to process
 * @returns {ServiceProvider} The service provider information based on the claim URI
 */
export function processURI (uri) {
  const match = uri.match(reURI)

  return new ServiceProvider({
    about: {
      id: 'irc',
      name: 'IRC'
    },
    profile: {
      display: `${match[1]}/${match[2]}`,
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
        fetcher: E.Fetcher.IRC,
        accessRestriction: E.ProofAccessRestriction.SERVER,
        data: {
          domain: match[1],
          nick: match[2]
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
    uri: 'irc://chat.ircserver.org/Alice1',
    shouldMatch: true
  },
  {
    uri: 'irc://chat.ircserver.org/alice?param=123',
    shouldMatch: true
  },
  {
    uri: 'irc://chat.ircserver.org/alice_bob',
    shouldMatch: true
  },
  {
    uri: 'https://chat.ircserver.org/alice',
    shouldMatch: false
  }
]
