/*
Copyright 2024 Bad Manners

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
 * Bluesky service provider ({@link https://docs.keyoxide.org/service-providers/bsky/|Keyoxide docs})
 * @module serviceProviders/bsky
 * @example
 * import { ServiceProviderDefinitions } from 'doipjs';
 * const spPost = ServiceProviderDefinitions.data.bsky.processURI('https://bsky.app/profile/alice.bsky.social/post/123456789');
 * const spProfile = ServiceProviderDefinitions.data.bsky.processURI('https://bsky.app/profile/alice.bsky.social');
 */

import * as E from '../enums.js'
import { ServiceProvider } from '../serviceProvider.js'

export const reURI = /^https:\/\/bsky\.app\/profile\/([^/]+)(?:\/?$|\/post\/([^/]+)\/?)/

/**
 * @function
 * @param {string} uri - Claim URI to process
 * @returns {ServiceProvider} The service provider information based on the claim URI
 */
export function processURI (uri) {
  const match = uri.match(reURI)

  const urlsp = new URLSearchParams()
  if (match[2]) {
    urlsp.set('uri', `at://${match[1]}/app.bsky.feed.post/${match[2]}`)
  } else {
    urlsp.set('actor', match[1])
  }

  return new ServiceProvider({
    about: {
      id: 'bsky',
      name: 'Bluesky',
      homepage: 'https://bsky.app'
    },
    profile: {
      display: `@${match[1]}`,
      uri: `https://bsky.app/profile/${match[1]}`,
      qr: null
    },
    claim: {
      uriRegularExpression: reURI.toString(),
      uriIsAmbiguous: true
    },
    proof: {
      request: {
        uri,
        fetcher: E.Fetcher.HTTP,
        accessRestriction: E.ProofAccessRestriction.NOCORS,
        data: {
          url: match[2] ? `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?${urlsp}` : `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?${urlsp}`,
          format: E.ProofFormat.JSON
        }
      },
      response: {
        format: E.ProofFormat.JSON
      },
      target: [{
        format: E.ClaimFormat.URI,
        encoding: E.EntityEncodingFormat.PLAIN,
        relation: E.ClaimRelation.CONTAINS,
        path: match[2] ? ['thread', 'post', 'record', 'text'] : ['description']
      }]
    }
  })
}

export const tests = [
  {
    uri: 'https://bsky.app/profile/alice.bsky.social/post/123456789',
    shouldMatch: true
  },
  {
    uri: 'https://bsky.app/profile/alice.bsky.social/post/123456789/',
    shouldMatch: true
  },
  {
    uri: 'https://bsky.app/profile/alice.example.org/post/a1b2c3d4e5',
    shouldMatch: true
  },
  {
    uri: 'https://bsky.app/profile/alice.example.org/post/a1b2c3d4e5/',
    shouldMatch: true
  },
  {
    uri: 'https://bsky.app/profile/alice.bsky.social',
    shouldMatch: true
  },
  {
    uri: 'https://bsky.app/profile/alice.bsky.social/',
    shouldMatch: true
  },
  {
    uri: 'https://bsky.app/profile/alice.example.org',
    shouldMatch: true
  },
  {
    uri: 'https://bsky.app/profile/alice.example.org/',
    shouldMatch: true
  },
  {
    uri: 'https://bsky.app/profile/alice.bsky.social/post',
    shouldMatch: false
  },
  {
    uri: 'https://bsky.app/profile/alice.example.org/post/',
    shouldMatch: false
  },
  {
    uri: 'https://bsky.app/profile/alice.bsky.social/123456789',
    shouldMatch: false
  },
  {
    uri: 'https://bsky.app/profile/alice.example.org/a1b2c3d4e5/',
    shouldMatch: false
  },
  {
    uri: 'https://bsky.app/alice.bsky.social',
    shouldMatch: false
  },
  {
    uri: 'https://bsky.app/alice.example.org/',
    shouldMatch: false
  },
  {
    uri: 'https://bsky.app/alice.bsky.social/123456789',
    shouldMatch: false
  },
  {
    uri: 'https://bsky.app/alice.example.org/a1b2c3d4e5/',
    shouldMatch: false
  },
  {
    uri: 'https://bsky.app/alice.bsky.social/post/123456789',
    shouldMatch: false
  },
  {
    uri: 'https://bsky.app/alice.example.org/post/a1b2c3d4e5/',
    shouldMatch: false
  },
  {
    uri: 'https://bsky.app/profile/post/123456789',
    shouldMatch: false
  },
  {
    uri: 'https://bsky.app/profile/post/a1b2c3d4e5/',
    shouldMatch: false
  },
  {
    uri: 'https://bsky.app/post/123456789',
    shouldMatch: false
  },
  {
    uri: 'https://bsky.app/post/a1b2c3d4e5/',
    shouldMatch: false
  }
]
