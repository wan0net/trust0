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
 * Gitlab service provider ({@link https://docs.keyoxide.org/service-providers/gitlab/|Keyoxide docs})
 * @module serviceProviders/gitlab
 * @example
 * import { ServiceProviderDefinitions } from 'doipjs';
 * const sp = ServiceProviderDefinitions.data.gitlab.processURI('https://domain.example/alice/repo');
 */

import * as E from '../enums.js'
import { ServiceProvider } from '../serviceProvider.js'

export const reURI = /^https:\/\/(.*)\/(.*)\/gitlab_proof\/?/

/**
 * @function
 * @param {string} uri - Claim URI to process
 * @returns {ServiceProvider} The service provider information based on the claim URI
 */
export function processURI (uri) {
  const match = uri.match(reURI)

  return new ServiceProvider({
    about: {
      id: 'gitlab',
      name: 'GitLab',
      homepage: 'https://about.gitlab.com'
    },
    profile: {
      display: `${match[2]}@${match[1]}`,
      uri: `https://${match[1]}/${match[2]}`,
      qr: null
    },
    claim: {
      uriRegularExpression: reURI.toString(),
      uriIsAmbiguous: true
    },
    proof: {
      request: {
        fetcher: E.Fetcher.HTTP,
        accessRestriction: E.ProofAccessRestriction.NONE,
        data: {
          url: `https://${match[1]}/api/v4/projects/${match[2]}%2Fgitlab_proof`,
          format: E.ProofFormat.JSON
        }
      },
      response: {
        format: E.ProofFormat.JSON
      },
      target: [{
        format: E.ClaimFormat.URI,
        encoding: E.EntityEncodingFormat.PLAIN,
        relation: E.ClaimRelation.EQUALS,
        path: ['description']
      }]
    }
  })
}

export const tests = [
  {
    uri: 'https://gitlab.domain.org/alice/gitlab_proof',
    shouldMatch: true
  },
  {
    uri: 'https://gitlab.domain.org/alice/gitlab_proof/',
    shouldMatch: true
  },
  {
    uri: 'https://domain.org/alice/other_proof',
    shouldMatch: false
  }
]
