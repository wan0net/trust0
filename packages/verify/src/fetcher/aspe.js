/*
Copyright 2024 Yarmo Mackenbach

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
 * Fetch proofs from Profile obtained through ASPE
 * @module fetcher/aspe
 * @example
 * import { fetcher } from 'doipjs';
 * const data = await fetcher.aspe.fn({ aspeUri: 'aspe:domain.example:abc123def456' });
 */
import axios from 'axios'
import isFQDN from 'validator/lib/isFQDN.js'
import { version } from '../constants.js'
import { parseProfileJws } from '../asp.js'

/**
 * Default timeout after which the fetch is aborted
 * @constant
 * @type {number}
 * @default 5000
 */
export const timeout = 5000

const reURI = /^aspe:([a-zA-Z0-9.\-_]*):([a-zA-Z0-9]*)/

/**
 * Execute a fetch request
 * @function
 * @param {object} data - Data used in the request
 * @param {string} data.aspeUri - ASPE URI of the targeted profile
 * @param {number} [data.fetcherTimeout] - Optional timeout for the fetcher
 * @param {import('../types').VerificationConfig} [opts] - Options used to enable the request
 * @returns {Promise<object>} The fetched claims from an ASP profile
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
    const match = data.aspeUri.match(reURI)

    if (!data.aspeUri || !reURI.test(data.aspeUri) || !isFQDN(match[1])) {
      reject(new Error('No valid ASPE URI provided'))
      return
    }

    const url = `https://${match[1]}/.well-known/aspe/id/${match[2].toUpperCase()}`

    axios.get(url, {
      headers: {
        Accept: 'application/asp+jwt',
        'User-Agent': `doipjs/${version}`
      },
      validateStatus: (status) => status >= 200 && status < 400
    })
      .then(async res => await parseProfileJws(res.data, data.aspeUri))
      .then(profile =>
        profile.personas.flatMap(p => { return p.claims.map(c => c._uri) })
      )
      .then(res => {
        resolve({
          claims: res
        })
      })
      .catch(e => {
        reject(e)
      })
  })

  return Promise.race([fetchPromise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutHandle)
  })
}
