/*
Copyright 2023 Yarmo Mackenbach

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
 * Fetch proofs using GraphQL queries
 * @module fetcher/graphql
 * @example
 * import { fetcher } from 'doipjs';
 * const data = await fetcher.graphql.fn({ url: 'https://domain.example/graphql/v2', query: '{ "query": "..." }' });
 */

import axios from 'axios'
import { version } from '../constants.js'

/**
 * Default timeout after which the fetch is aborted
 * @constant
 * @type {number}
 * @default 5000
 */
export const timeout = 5000

/**
 * Execute a GraphQL query via HTTP request
 * @function
 * @param {object} data - Data used in the request
 * @param {string} data.url - The URL pointing at the GraphQL HTTP endpoint
 * @param {string} data.query - The GraphQL query to fetch the data containing the proof
 * @param {number} [data.fetcherTimeout] - Optional timeout for the fetcher
 * @param {import('../types').VerificationConfig} [opts] - Options used to enable the request
 * @returns {Promise<object>} The fetched GraphQL object
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

    let jsonData
    try {
      jsonData = JSON.parse(data.query)
    } catch (error) {
      reject(new Error('Invalid GraphQL query object'))
    }

    axios.post(data.url, jsonData, {
      headers: {
        'Content-Type': 'application/json',
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
  })

  return Promise.race([fetchPromise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutHandle)
  })
}
