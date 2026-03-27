/*
Copyright 2024 Bram Hagens

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
 * Discord service provider
 * @module serviceProviders/discord
 * @example
 * import { ServiceProviderDefinitions } from 'doipjs';
 * const sp = ServiceProviderDefinitions.data.discord.processURI('https://discord.com/invite/AbCdEf');
 */

import * as E from '../enums.js'
import { ServiceProvider } from '../serviceProvider.js'

export const reURI = /^https:\/\/(?:discord\.gg|discord\.com\/invite)\/(.+)/

/**
 * @function
 * @param {string} uri - Claim URI to process
 * @returns {ServiceProvider} The service provider information based on the claim URI
 */
export function processURI (uri) {
  const match = uri.match(reURI)

  return new ServiceProvider({
    about: {
      id: 'discord',
      name: 'Discord',
      homepage: 'https://discord.com'
    },
    profile: {
      display: 'Unknown username',
      uri: null,
      qr: null
    },
    claim: {
      uriRegularExpression: reURI.toString(),
      uriIsAmbiguous: false
    },
    // Get proof from invites (https://discord.com/developers/docs/resources/invite#get-invite)
    // See https://discord.com/developers/docs/reference#api-versioning for Discord's API versioning
    proof: {
      request: {
        uri: `https://discord.com/api/v10/invites/${match[1]}`,
        fetcher: E.Fetcher.HTTP,
        accessRestriction: E.ProofAccessRestriction.NOCORS,
        data: {
          url: `https://discord.com/api/v10/invites/${match[1]}`,
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
          path: ['guild', 'description']
        },
        {
          format: E.ClaimFormat.URI,
          encoding: E.EntityEncodingFormat.PLAIN,
          relation: E.ClaimRelation.CONTAINS,
          path: ['guild', 'name']
        }
      ]
    }
  })
}

export const functions = {
  postprocess: async (claimData, proofData, opts) => {
    // Extract inviter's username from https://discord.com/developers/docs/resources/invite#invite-object
    claimData.profile.display = proofData.result.inviter.username
    claimData.profile.uri = `https://discordapp.com/users/${proofData.result.inviter.id}`

    return { claimData, proofData }
  }
}

export const tests = [
  {
    uri: 'https://discord.com/invite/AbCdEf',
    shouldMatch: true
  },
  {
    uri: 'https://discord.com/invite/AbCdEfGh',
    shouldMatch: true
  },
  {
    uri: 'https://discord.gg/AbCdEf',
    shouldMatch: true
  },
  {
    uri: 'https://discord.gg/AbCdEfGh',
    shouldMatch: true
  },
  {
    uri: 'https://domain.com/invite/AbCdEf',
    shouldMatch: false
  },
  {
    uri: 'https://domain.gg/AbCdEf',
    shouldMatch: false
  },
  {
    uri: 'https://discord.com/invite/',
    shouldMatch: false
  },
  {
    uri: 'https://discord.gg/',
    shouldMatch: false
  }
]
