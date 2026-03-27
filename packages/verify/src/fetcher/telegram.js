/*
Copyright 2022 Maximilian Siling

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
 * Fetch proofs using Telegram groups
 * @module fetcher/telegram
 * @example
 * import { fetcher } from 'doipjs';
 * const data = await fetcher.telegram.fn({ user: 'alice', chat: 'alice_identity_proof' });
 */

import axios from 'axios'
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
 * @param {string} data.chat - Telegram public group name (slug)
 * @param {string} data.user - Telegram username
 * @param {number} [data.fetcherTimeout] - Optional timeout for the fetcher
 * @param {import('../types').VerificationConfig} [opts] - Options used to enable the request
 * @returns {Promise<object|string>} The fetched Telegram object
 */
export async function fn (data, opts) {
  let timeoutHandle
  const timeoutPromise = new Promise((resolve, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error('Request was timed out')),
      data.fetcherTimeout ? data.fetcherTimeout : timeout
    )
  })

  const apiPromise = (/** @type {string} */ method) => new Promise((resolve, reject) => {
    try {
      isAscii(opts.claims.telegram.token)
    } catch (err) {
      throw new Error(`Telegram fetcher was not set up properly (${err.message})`)
    }

    if (!(data.chat && data.user)) {
      reject(new Error('Both chat name and user name must be provided'))
      return
    }

    const url = `https://api.telegram.org/bot${opts.claims.telegram.token}/${method}?chat_id=@${data.chat}`
    axios.get(url, {
      headers: {
        Accept: 'application/json',
        // @ts-ignore
        'User-Agent': `doipjs/${version}`
      },
      validateStatus: (status) => status === 200
    })
      .then(res => resolve(res.data))
      .catch(e => reject(e))
  })

  const fetchPromise = apiPromise('getChatAdministrators').then(admins => {
    if (!admins.ok) {
      throw new Error('Request to get chat administrators failed')
    }

    return apiPromise('getChat').then(chat => {
      if (!chat.ok) {
        throw new Error('Request to get chat info failed')
      }

      let creator
      for (const admin of admins.result) {
        if (admin.status === 'creator') {
          creator = admin.user.username
        }
      }

      if (!chat.result.description) {
        throw new Error('There is no chat description')
      }

      if (creator !== data.user) {
        throw new Error('User doesn\'t match')
      }

      return {
        user: creator,
        text: chat.result.description
      }
    })
  })

  return Promise.race([fetchPromise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutHandle)
  })
}
