/*
Copyright 2024 Tyler Beckman

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
 * pronouns.page service provider
 * @module serviceProviders/pronounspage
 * @example
 * import { ServiceProviderDefinitions } from 'doipjs';
 * const sp = ServiceProviderDefinitions.data.pronounspage.processURI('https://pronouns.page/@doipjs');
 */

import * as E from '../enums.js'
import { ServiceProvider } from '../serviceProvider.js'

export const reURI = /^https:\/\/((?:(\w+)\.)?pronouns\.page|pronombr\.es|pronoms\.fr|zaimki\.pl)\/(?:@|u\/)([a-zA-Z0-9.\-_]+)\/?(?:#.+)?/

const languageCodes = {
  'pronombr.es': 'es',
  'pronoms.fr': 'fr',
  'zaimki.pl': 'pl'
}

/**
 * @function
 * @param {string} uri - Claim URI to process
 * @returns {ServiceProvider} The service provider information based on the claim URI
 */
export function processURI (uri) {
  const match = uri.match(reURI)

  const languageCode = languageCodes[match[1]] ?? match[2]

  return new ServiceProvider({
    about: {
      id: 'pronounspage',
      name: match[1],
      homepage: 'https://pronouns.page'
    },
    profile: {
      display: `@${match[3]}`,
      uri: `https://${match[1]}/@${match[3]}`,
      qr: null
    },
    claim: {
      uriRegularExpression: reURI.toString(),
      uriIsAmbiguous: false
    },
    proof: {
      request: {
        uri,
        fetcher: E.Fetcher.HTTP,
        accessRestriction: E.ProofAccessRestriction.NONE,
        data: {
          url: `https://pronouns.page/api/profile/get/${match[3]}?version=2&props=description,links`,
          format: E.ProofFormat.JSON
        }
      },
      response: {
        format: E.ProofFormat.JSON
      },
      target: [
        {
          format: E.ClaimFormat.URI,
          encoding: E.EntityEncodingFormat.PLAIN,
          relation: E.ClaimRelation.CONTAINS,
          path: ['profiles', languageCode ?? '*', 'links']
        },
        {
          format: E.ClaimFormat.URI,
          encoding: E.EntityEncodingFormat.PLAIN,
          relation: E.ClaimRelation.CONTAINS,
          path: ['profiles', languageCode ?? '*', 'description']
        }
      ]
    }
  })
}

export const tests = [
  {
    uri: 'https://pronouns.page/@doipjs',
    shouldMatch: true
  },
  {
    uri: 'https://pronouns.page/@doipjs#it/its',
    shouldMatch: true
  },
  {
    uri: 'https://pronouns.page/u/doipjs',
    shouldMatch: true
  },
  {
    uri: 'https://nl.pronouns.page/u/doipjs',
    shouldMatch: true
  },
  {
    uri: 'https://lad.pronouns.page/u/doipjs',
    shouldMatch: true
  },
  {
    uri: 'https://pronombr.es/@doipjs',
    shouldMatch: true
  },
  {
    uri: 'https://pronoms.fr/@doipjs',
    shouldMatch: true
  },
  {
    uri: 'https://zaimki.pl/@doipjs',
    shouldMatch: true
  },
  {
    uri: 'https://pronouns.page/doipjs',
    shouldMatch: false
  }
]
