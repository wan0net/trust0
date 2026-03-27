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
 * Fetch proofs using DNS TXT records
 * @module fetcher/dns
 * @example
 * import { fetcher } from 'doipjs';
 * const data = await fetcher.dns.fn({ domain: 'domain.example' });
 */

import { isBrowser } from 'browser-or-node'
import dns from 'dns'

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
 * @param {string} data.domain - The targeted domain
 * @param {number} [data.fetcherTimeout] - Optional timeout for the fetcher
 * @param {import('../types').VerificationConfig} [opts] - Options used to enable the request
 * @returns {Promise<object>} The fetched DNS records
 */
export async function fn (data, opts) {
  if (isBrowser) {
    return null
  }

  let timeoutHandle
  const timeoutPromise = new Promise((resolve, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error('Request was timed out')),
      data.fetcherTimeout ? data.fetcherTimeout : timeout
    )
  })

  const fetchPromise = new Promise((resolve, reject) => {
    dns.resolveTxt(data.domain, (err, records) => {
      if (err) {
        reject(err)
        return
      }

      resolve({
        domain: data.domain,
        records: {
          txt: records
        }
      })
    })
  })

  return Promise.race([fetchPromise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutHandle)
  })
}
