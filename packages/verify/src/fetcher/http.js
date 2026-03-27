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
 * Fetch proofs using HTTP requests
 * @module fetcher/http
 * @example
 * import { fetcher } from 'doipjs';
 * const data = await fetcher.http.fn({ url: 'https://domain.example/data.json', format: 'json' });
 */

import axios from 'axios'
import { ProofFormat } from '../enums.js'
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
 * @param {string} data.url - The URL pointing at targeted content
 * @param {string} data.format - The format of the targeted content
 * @param {number} [data.fetcherTimeout] - Optional timeout for the fetcher
 * @param {import('../types').VerificationConfig} [opts] - Options used to enable the request
 * @returns {Promise<object|string>} The fetched JSON object or text
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
    if (!data.url) {
      reject(new Error('No valid URI provided'))
      return
    }

    switch (data.format) {
      case ProofFormat.JSON:
        axios.get(data.url, {
          headers: {
            Accept: 'application/json',
            // @ts-ignore
            'User-Agent': `doipjs/${version}`
          },
          validateStatus: function (status) {
            return status >= 200 && status < 400
          }
        })
          .then(res => {
            resolve(res.data)
          })
          .catch(e => {
            reject(e)
          })
        break
      case ProofFormat.TEXT:
        axios.get(data.url, {
          validateStatus: function (status) {
            return status >= 200 && status < 400
          },
          responseType: 'text'
        })
          .then(res => {
            resolve(res.data)
          })
          .catch(e => {
            reject(e)
          })
        break
      default:
        reject(new Error('No specified data format'))
        break
    }
  })

  return Promise.race([fetchPromise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutHandle)
  })
}
