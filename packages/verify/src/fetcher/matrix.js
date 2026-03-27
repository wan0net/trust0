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
 * Fetch proofs using Matrix messages
 * @module fetcher/matrix
 * @example
 * import { fetcher } from 'doipjs';
 * const data = await fetcher.matrix.fn({ eventId: '$abc123def456', roomId: '!dBfQZxCoGVmSTujfiv:matrix.org' });
 */

import axios from 'axios'
import isFQDN from 'validator/lib/isFQDN.js'
import isAscii from 'validator/lib/isAscii.js'
import { version } from '../constants.js'

/**
 * Default timeout after which the fetch is aborted
 * @constant
 * @type {number}
 * @default 5000
 */
export const timeout = 5000

/**
 * Execute a fetch request
 * @function
 * @param {object} data - Data used in the request
 * @param {string} data.eventId - The identifier of the targeted post
 * @param {string} data.roomId - The identifier of the room containing the targeted post
 * @param {number} [data.fetcherTimeout] - Optional timeout for the fetcher
 * @param {import('../types').VerificationConfig} [opts] - Options used to enable the request
 * @returns {Promise<object>} The fetched Matrix object
 */
export async function fn (data, opts) {
  let timeoutHandle
  const timeoutPromise = new Promise((resolve, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error('Request was timed out')),
      data.fetcherTimeout ? data.fetcherTimeout : timeout
    )
  })

  const fetchPromise = new Promise((resolve, reject) => {
    try {
      isFQDN(opts.claims.matrix.instance)
      isAscii(opts.claims.matrix.accessToken)
    } catch (err) {
      throw new Error(`Matrix fetcher was not set up properly (${err.message})`)
    }

    const url = `https://${opts.claims.matrix.instance}/_matrix/client/r0/rooms/${data.roomId}/event/${data.eventId}?access_token=${opts.claims.matrix.accessToken}`
    axios.get(url,
      {
        headers: {
          Accept: 'application/json',
          // @ts-ignore
          'User-Agent': `doipjs/${version}`
        }
      })
      .then(res => {
        return res.data
      })
      .then((res) => {
        resolve(res)
      })
      .catch((error) => {
        reject(error)
      })
  })

  return Promise.race([fetchPromise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutHandle)
  })
}
