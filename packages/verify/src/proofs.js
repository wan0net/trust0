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
import { isNode } from 'browser-or-node'
import { fetcher } from './index.js'
import { generateProxyURL } from './utils.js'
import { ProxyPolicy, ProofAccessRestriction } from './enums.js'
import { ServiceProvider } from './serviceProvider.js'

/**
 * @module proofs
 */

/**
 * Delegate the proof request to the correct fetcher.
 * This method uses the current environment (browser/node), certain values from
 * the `data` parameter and the proxy policy set in the `opts` parameter to
 * choose the right approach to fetch the proof. An error will be thrown if no
 * approach is possible.
 * @param {ServiceProvider} data - Data from a claim definition
 * @param {import('./types').VerificationConfig} opts - Options to enable the request
 * @returns {Promise<object|string>} Fetched proof data
 */
export async function fetch (data, opts) {
  if (isNode) {
    return handleNodeRequests(data, opts)
  }

  return handleBrowserRequests(data, opts)
}

/**
 * @param {ServiceProvider} data - Data from a claim definition
 * @param {object} opts - Options to enable the request
 * @returns {Promise<object|string>} Fetched proof data
 */
const handleBrowserRequests = (data, opts) => {
  switch (opts.proxy.policy) {
    case ProxyPolicy.ALWAYS:
      return createProxyRequestPromise(data, opts)

    case ProxyPolicy.NEVER:
      switch (data.proof.request.accessRestriction) {
        case ProofAccessRestriction.NONE:
        case ProofAccessRestriction.GRANTED:
          return createDefaultRequestPromise(data, opts)
        case ProofAccessRestriction.NOCORS:
        case ProofAccessRestriction.SERVER:
          throw new Error(
            'Impossible to fetch proof (bad combination of service access and proxy policy)'
          )
        default:
          throw new Error('Invalid proof access value')
      }

    case ProxyPolicy.ADAPTIVE:
      switch (data.proof.request.accessRestriction) {
        case ProofAccessRestriction.NONE:
          return createFallbackRequestPromise(data, opts)
        case ProofAccessRestriction.NOCORS:
          return createProxyRequestPromise(data, opts)
        case ProofAccessRestriction.GRANTED:
          return createFallbackRequestPromise(data, opts)
        case ProofAccessRestriction.SERVER:
          return createProxyRequestPromise(data, opts)
        default:
          throw new Error('Invalid proof access value')
      }

    default:
      throw new Error('Invalid proxy policy')
  }
}

/**
 * @param {ServiceProvider} data - Data from a claim definition
 * @param {object} opts - Options to enable the request
 * @returns {Promise<object|string>} Fetched proof data
 */
const handleNodeRequests = (data, opts) => {
  switch (opts.proxy.policy) {
    case ProxyPolicy.ALWAYS:
      return createProxyRequestPromise(data, opts)

    case ProxyPolicy.NEVER:
      return createDefaultRequestPromise(data, opts)

    case ProxyPolicy.ADAPTIVE:
      return createFallbackRequestPromise(data, opts)

    default:
      throw new Error('Invalid proxy policy')
  }
}

/**
 * @param {ServiceProvider} data - Data from a claim definition
 * @param {object} opts - Options to enable the request
 * @returns {Promise<object|string>} Fetched proof data
 */
const createDefaultRequestPromise = (data, opts) => {
  return new Promise((resolve, reject) => {
    if (!(data.proof.request.fetcher in fetcher)) {
      reject(new Error(`fetcher for ${data.proof.request.fetcher} not found`))
    }
    fetcher[data.proof.request.fetcher]
      .fn(data.proof.request.data, opts)
      .then((res) => {
        return resolve({
          fetcher: data.proof.request.fetcher,
          data,
          viaProxy: false,
          result: res
        })
      })
      .catch((err) => {
        return reject(err)
      })
  })
}

/**
 * @param {ServiceProvider} data - Data from a claim definition
 * @param {object} opts - Options to enable the request
 * @returns {Promise<object|string>} Fetched proof data
 */
const createProxyRequestPromise = (data, opts) => {
  return new Promise((resolve, reject) => {
    let proxyUrl
    try {
      proxyUrl = generateProxyURL(
        data.proof.request.fetcher,
        data.proof.request.data,
        opts
      )
    } catch (err) {
      reject(err)
    }

    const requestData = {
      url: proxyUrl,
      format: data.proof.response.format,
      fetcherTimeout: data.proof.request.fetcher in fetcher ? fetcher[data.proof.request.fetcher].timeout : 30000
    }
    fetcher.http
      .fn(requestData, opts)
      .then((res) => {
        return resolve({
          fetcher: 'http',
          data,
          viaProxy: true,
          result: res
        })
      })
      .catch((err) => {
        return reject(err)
      })
  })
}

/**
 * @param {ServiceProvider} data - Data from a claim definition
 * @param {object} opts - Options to enable the request
 * @returns {Promise<object|string>} Fetched proof data
 */
const createFallbackRequestPromise = (data, opts) => {
  return new Promise((resolve, reject) => {
    createDefaultRequestPromise(data, opts)
      .then((res) => {
        return resolve(res)
      })
      .catch((err1) => {
        createProxyRequestPromise(data, opts)
          .then((res) => {
            return resolve(res)
          })
          .catch((err2) => {
            return reject(err2)
          })
      })
  })
}
