/*
Copyright 2022 Yarmo Mackenbach

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
 * ActivityPub service provider ({@link https://docs.keyoxide.org/service-providers/activitypub/|Keyoxide docs})
 * @module serviceProviders/activitypub
 * @example
 * import { ServiceProviderDefinitions } from 'doipjs';
 * const sp = ServiceProviderDefinitions.data.activitypub.processURI('https://domain.example/@alice');
 */

import * as E from '../enums.js'
import { fetcher } from '../index.js'
import { ServiceProvider } from '../serviceProvider.js'

export const reURI = /^https:\/\/(.*)\/?/

/**
 * @function
 * @param {string} uri - Claim URI to process
 * @returns {ServiceProvider} The service provider information based on the claim URI
 */
export function processURI (uri) {
  return new ServiceProvider({
    about: {
      id: 'activitypub',
      name: 'ActivityPub',
      homepage: 'https://activitypub.rocks'
    },
    profile: {
      display: uri,
      uri,
      qr: null
    },
    claim: {
      uriRegularExpression: reURI.toString().toString(),
      uriIsAmbiguous: true
    },
    proof: {
      request: {
        uri,
        fetcher: E.Fetcher.ACTIVITYPUB,
        accessRestriction: E.ProofAccessRestriction.NONE,
        data: {
          url: uri
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
          path: ['summary']
        },
        {
          format: E.ClaimFormat.URI,
          encoding: E.EntityEncodingFormat.PLAIN,
          relation: E.ClaimRelation.CONTAINS,
          path: ['attachment', 'value']
        },
        {
          format: E.ClaimFormat.URI,
          encoding: E.EntityEncodingFormat.PLAIN,
          relation: E.ClaimRelation.CONTAINS,
          path: ['content']
        }
      ]
    }
  })
}

export const functions = {
  postprocess: async (/** @type {ServiceProvider} */ claimData, proofData, opts) => {
    switch (proofData.result.type) {
      case 'Note': {
        claimData.profile.uri = proofData.result.attributedTo
        claimData.profile.display = proofData.result.attributedTo
        const personData = await fetcher.activitypub.fn({ url: proofData.result.attributedTo }, opts)
          .catch(_ => null)
        if (personData) {
          claimData.profile.display = `@${personData.preferredUsername}@${new URL(claimData.proof.request.uri).hostname}`
        }
        break
      }

      case 'Person':
        claimData.profile.display = `@${proofData.result.preferredUsername}@${new URL(claimData.proof.request.uri).hostname}`
        break

      default:
        break
    }

    // Attempt to fetch and process the instance's NodeInfo data
    const nodeinfo = await _processNodeinfo(new URL(claimData.proof.request.uri).hostname)
    if (nodeinfo) {
      claimData.about.name = nodeinfo.software.name
      claimData.about.id = nodeinfo.software.name
      claimData.about.homepage = nodeinfo.software.homepage
    }

    return { claimData, proofData }
  }
}

const _processNodeinfo = async (/** @type {string} */ domain) => {
  const nodeinfoRef = await fetch(`https://${domain}/.well-known/nodeinfo`)
    .then(res => {
      if (res.status !== 200) {
        throw new Error('HTTP Status was not 200')
      }
      return res.json()
    })
    .catch(_ => {
      return null
    })

  if (!nodeinfoRef) return null

  // NodeInfo version 2.1
  {
    const nodeinfo = nodeinfoRef.links.find(x => { return x.rel === 'http://nodeinfo.diaspora.software/ns/schema/2.1' })
    if (nodeinfo) {
      return await fetch(nodeinfo.href)
        .then(res => {
          if (res.status !== 200) {
            throw new Error('HTTP Status was not 200')
          }
          return res.json()
        })
        .then(res => {
          return {
            software: {
              name: res.software.name,
              version: res.software.version,
              homepage: res.software.homepage || 'https://activitypub.rocks'
            }
          }
        })
        .catch(_ => {
          return null
        })
    }
  }
  // NodeInfo version 2.0
  {
    const nodeinfo = nodeinfoRef.links.find(x => { return x.rel === 'http://nodeinfo.diaspora.software/ns/schema/2.0' })
    if (nodeinfo) {
      return await fetch(nodeinfo.href)
        .then(res => {
          if (res.status !== 200) {
            throw new Error('HTTP Status was not 200')
          }
          return res.json()
        })
        .then(res => {
          return {
            software: {
              name: res.software.name,
              version: res.software.version,
              homepage: 'https://activitypub.rocks'
            }
          }
        })
        .catch(_ => {
          return null
        })
    }
  }
  // NodeInfo version 1.1
  {
    const nodeinfo = nodeinfoRef.links.find(x => { return x.rel === 'http://nodeinfo.diaspora.software/ns/schema/1.1' })
    if (nodeinfo) {
      return await fetch(nodeinfo.href)
        .then(res => {
          if (res.status !== 200) {
            throw new Error('HTTP Status was not 200')
          }
          return res.json()
        })
        .then(res => {
          return {
            software: {
              name: res.software.name,
              version: res.software.version,
              homepage: 'https://activitypub.rocks'
            }
          }
        })
        .catch(_ => {
          return null
        })
    }
  }
  // NodeInfo version 1.0
  {
    const nodeinfo = nodeinfoRef.links.find(x => { return x.rel === 'http://nodeinfo.diaspora.software/ns/schema/1.0' })
    if (nodeinfo) {
      return await fetch(nodeinfo.href)
        .then(res => {
          if (res.status !== 200) {
            throw new Error('HTTP Status was not 200')
          }
          return res.json()
        })
        .then(res => {
          return {
            software: {
              name: res.software.name,
              version: res.software.version,
              homepage: 'https://activitypub.rocks'
            }
          }
        })
        .catch(_ => {
          return null
        })
    }
  }
}

export const tests = [
  {
    uri: 'https://domain.org',
    shouldMatch: true
  },
  {
    uri: 'https://domain.org/@/alice/',
    shouldMatch: true
  },
  {
    uri: 'https://domain.org/@alice',
    shouldMatch: true
  },
  {
    uri: 'https://domain.org/@alice/123456',
    shouldMatch: true
  },
  {
    uri: 'https://domain.org/u/alice/',
    shouldMatch: true
  },
  {
    uri: 'https://domain.org/users/alice/',
    shouldMatch: true
  },
  {
    uri: 'https://domain.org/users/alice/123456',
    shouldMatch: true
  },
  {
    uri: 'http://domain.org/alice',
    shouldMatch: false
  }
]
