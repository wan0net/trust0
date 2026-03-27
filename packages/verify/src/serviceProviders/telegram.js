/*
Copyright 2022 Maximilian Siling

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
 * Telegram service provider ({@link https://docs.keyoxide.org/service-providers/telegram/|Keyoxide docs})
 * @module serviceProviders/telegram
 * @example
 * import { ServiceProviderDefinitions } from 'doipjs';
 * const sp = ServiceProviderDefinitions.data.telegram.processURI('https://t.me/alice?proof=mygroup');
 */

import * as E from '../enums.js'
import { ServiceProvider } from '../serviceProvider.js'

export const reURI = /https:\/\/t.me\/([A-Za-z0-9_]{5,32})\?proof=([A-Za-z0-9_]{5,32})/

/**
 * @function
 * @param {string} uri - Claim URI to process
 * @returns {ServiceProvider} The service provider information based on the claim URI
 */
export function processURI (uri) {
  const match = uri.match(reURI)

  return new ServiceProvider({
    about: {
      id: 'telegram',
      name: 'Telegram',
      homepage: 'https://telegram.org'
    },
    profile: {
      display: `@${match[1]}`,
      uri: `https://t.me/${match[1]}`,
      qr: `https://t.me/${match[1]}`
    },
    claim: {
      uriRegularExpression: reURI.toString(),
      uriIsAmbiguous: false
    },
    proof: {
      request: {
        uri: `https://t.me/${match[2]}`,
        fetcher: E.Fetcher.TELEGRAM,
        accessRestriction: E.ProofAccessRestriction.GRANTED,
        data: {
          user: match[1],
          chat: match[2]
        }
      },
      response: {
        format: E.ProofFormat.JSON
      },
      target: [{
        format: E.ClaimFormat.URI,
        encoding: E.EntityEncodingFormat.PLAIN,
        relation: E.ClaimRelation.EQUALS,
        path: ['text']
      }]
    }
  })
}

export const tests = [
  {
    uri: 'https://t.me/alice?proof=foobar',
    shouldMatch: true
  },
  {
    uri: 'https://t.me/complex_user_1234?proof=complex_chat_1234',
    shouldMatch: true
  },
  {
    uri: 'https://t.me/foobar',
    shouldMatch: false
  },
  {
    uri: 'https://t.me/foobar?proof=',
    shouldMatch: false
  },
  {
    uri: 'https://t.me/?proof=foobar',
    shouldMatch: false
  }
]
