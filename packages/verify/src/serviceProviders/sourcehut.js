/*
Copyright 2022 tianruiwei
Copyright 2024 quaff

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
 * SourceHut service provider ({@link https://docs.keyoxide.org/service-providers/sourcehut/|Keyoxide docs})
 * @module serviceProviders/sourcehut
 * @example
 * import { ServiceProviderDefinitions } from 'doipjs';
 * const sp = ServiceProviderDefinitions.data.sourcehut.processURI('https://git.sr.ht/~alice/keyoxide_proof')
 */

import * as E from '../enums.js'
import { ServiceProvider } from '../serviceProvider.js'

export const reURI = /^https:\/\/git\.sr\.ht\/~([^~/]*)\/([^/]*)(\/tree\/([^/]*))?\/?/

/**
 * @function
 * @param {string} uri - Claim URI to process
 * @returns {ServiceProvider} The service provider information based on the claim URI
 */
export function processURI (uri) {
  const [, username, repo, , branch] = uri.match(reURI)

  return new ServiceProvider({
    about: {
      id: 'sourcehut',
      name: 'SourceHut',
      homepage: 'https://sourcehut.org'
    },
    profile: {
      display: username,
      uri: `https://sr.ht/~${username}`,
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
          url: `https://git.sr.ht/~${username}/${repo}/blob/${branch ?? 'main'}/proof.md`,
          format: E.ProofFormat.TEXT
        }
      },
      response: {
        format: E.ProofFormat.TEXT
      },
      target: [
        {
          format: E.ClaimFormat.URI,
          encoding: E.EntityEncodingFormat.PLAIN,
          relation: E.ClaimRelation.CONTAINS,
          path: []
        }
      ]
    }
  })
}

export const tests = [
  {
    uri: 'https://git.sr.ht/~alice/sourcehut_proof',
    shouldMatch: true
  },
  {
    uri: 'https://git.sr.ht/~alice/keyoxide_proof/',
    shouldMatch: true
  },
  {
    uri: 'https://git.sr.ht/~alice/proof_repo/tree/master',
    shouldMatch: true
  },
  {
    uri: 'https://domain.org/alice/keyoxide_proof',
    shouldMatch: false
  }
]
