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
import { ProxyPolicy } from './enums.js'

/**
 * Contains default values
 * @module defaults
 */

/**
 * The default claim verification config used throughout the library
 * @type {import('./types').VerificationConfig}
 */
export const opts = {
  proxy: {
    hostname: null,
    policy: ProxyPolicy.NEVER
  },
  claims: {
    activitypub: {
      url: null,
      privateKey: null
    },
    irc: {
      nick: null
    },
    matrix: {
      instance: null,
      accessToken: null
    },
    telegram: {
      token: null
    },
    xmpp: {
      service: null,
      username: null,
      password: null
    }
  }
}
